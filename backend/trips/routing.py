"""Shortest-path calculation over a directed graph of provider travel times.

OSRM supplies road-network costs and geometry. Our own Dijkstra implementation
searches the destination graph; it does not pretend to replace OSRM's road engine
or solve the traveling-salesperson problem. Required stops retain the user's order.
"""

import heapq
import math
import requests
from django.conf import settings
from django.core.cache import cache


class RoutingError(ValueError):
    pass


def dijkstra(graph, source, target):
    """Return (minimum cost, node path), using a heap for O((V + E) log V).

    Edges must have finite nonnegative costs. Missing edges mean unreachable,
    not zero travel time. Stale queue entries are skipped after a better path wins.
    """
    for edges in graph.values():
        for neighbor, cost in edges:
            if neighbor not in graph or not math.isfinite(cost) or cost < 0:
                raise ValueError(
                    "Dijkstra requires valid nodes and nonnegative finite costs."
                )
    if source not in graph or target not in graph:
        raise ValueError("Unknown graph node.")
    distances = {source: 0.0}
    previous = {}
    queue = [(0.0, source)]
    while queue:
        distance, current = heapq.heappop(queue)
        if distance > distances[current]:
            continue
        if current == target:
            path = [target]
            while path[-1] != source:
                path.append(previous[path[-1]])
            return distance, list(reversed(path))
        for neighbor, weight in graph[current]:
            candidate = distance + weight
            if candidate < distances.get(neighbor, math.inf):
                distances[neighbor] = candidate
                previous[neighbor] = current
                heapq.heappush(queue, (candidate, neighbor))
    raise RoutingError("No drivable route connects these destinations.")


def provider_get(service, coordinates, params):
    """Only the configured provider is contacted; users cannot supply a URL."""
    url = f"{settings.OSRM_BASE_URL.rstrip('/')}/{service}/v1/driving/{coordinates}"
    try:
        response = requests.get(url, params=params, timeout=(5, 20))
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict) or data.get("code") != "Ok":
            raise RoutingError("The mapping service could not find a drivable route.")
        return data
    except (requests.RequestException, ValueError) as error:
        if isinstance(error, RoutingError):
            raise
        raise RoutingError(
            "The mapping service is unavailable. Please try again."
        ) from error


def calculate_route(places):
    if not 2 <= len(places) <= 30:
        raise RoutingError("Add between 2 and 30 destinations to calculate a route.")
    if any(place.latitude is None or place.longitude is None for place in places):
        raise RoutingError("Add coordinates to every destination before calculating.")
    coordinates = ";".join(f"{place.longitude},{place.latitude}" for place in places)
    # Include provider and ordered coordinates so edited/reordered stops never reuse a stale route.
    import hashlib

    key = (
        "route:"
        + hashlib.sha256((settings.OSRM_BASE_URL + coordinates).encode()).hexdigest()
    )
    cached = cache.get(key)
    if cached is not None:
        return cached
    table = provider_get("table", coordinates, {"annotations": "duration"})
    matrix = table.get("durations")
    count = len(places)
    if not isinstance(matrix, list) or len(matrix) != count:
        raise RoutingError("The mapping service returned an invalid cost table.")
    graph = {}
    for index, row in enumerate(matrix):
        if not isinstance(row, list) or len(row) != count:
            raise RoutingError("The mapping service returned an invalid cost table.")
        graph[index] = []
        for neighbor, duration in enumerate(row):
            if duration is None or index == neighbor:
                continue
            if (
                isinstance(duration, bool)
                or not isinstance(duration, (float, int))
                or not math.isfinite(duration)
                or duration < 0
            ):
                raise RoutingError(
                    "The mapping service returned an invalid travel time."
                )
            graph[index].append((neighbor, duration))
    path = [0]
    graph_seconds = 0
    for index in range(count - 1):
        seconds, leg = dijkstra(graph, index, index + 1)
        graph_seconds += seconds
        path.extend(leg[1:])
    path_coordinates = ";".join(
        f"{places[index].longitude},{places[index].latitude}" for index in path
    )
    data = provider_get(
        "route",
        path_coordinates,
        {"overview": "full", "geometries": "geojson", "steps": "false"},
    )
    try:
        route = data["routes"][0]
        geometry = route["geometry"]
        distance, duration = route["distance"], route["duration"]
        if geometry["type"] != "LineString" or len(geometry["coordinates"]) < 2:
            raise ValueError()
        for coordinate in geometry["coordinates"]:
            if (
                len(coordinate) != 2
                or any(
                    not isinstance(v, (int, float)) or not math.isfinite(v)
                    for v in coordinate
                )
                or abs(coordinate[0]) > 180
                or abs(coordinate[1]) > 90
            ):
                raise ValueError()
        if any(
            not isinstance(v, (int, float)) or not math.isfinite(v) or v < 0
            for v in (distance, duration)
        ):
            raise ValueError()
    except (KeyError, IndexError, TypeError, ValueError):
        raise RoutingError("The mapping service returned invalid route geometry.")
    result = {
        "geometry": geometry,
        "distanceMeters": distance,
        "durationSeconds": duration,
        "graphDurationSeconds": graph_seconds,
        "pathIndices": path,
        "algorithm": "Dijkstra",
        "profile": "driving",
        "provider": "OSRM",
    }
    cache.set(key, result, 300)
    return result
