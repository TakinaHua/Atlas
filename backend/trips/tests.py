"""Regression tests use a fake mapping provider: no network or changing road data."""

import json
import uuid
from unittest.mock import patch
from django.test import Client, TestCase, SimpleTestCase
from django.core.cache import cache
from .models import Trip
from .routing import RoutingError, calculate_route, dijkstra
from types import SimpleNamespace


def payload():
    return {
        "name": "Pittsburgh weekend",
        "destination": "Pittsburgh",
        "startDate": "2026-10-10",
        "endDate": "2026-10-11",
    }


def place(name="Museum", longitude=-79.95):
    return {
        "id": str(uuid.uuid4()),
        "name": name,
        "latitude": 40.44,
        "longitude": longitude,
        "notes": "",
        "address": "",
        "category": "Sightseeing",
    }


class ApiTests(TestCase):
    def create(self):
        response = self.client.post(
            "/api/trips", payload(), content_type="application/json"
        )
        self.assertEqual(response.status_code, 201)
        return response.json()

    def save(self, trip):
        return self.client.put(
            f'/api/trips/{trip["id"]}', trip, content_type="application/json"
        )

    def test_create_edit_reorder_persist_delete(self):
        trip = self.create()
        self.assertEqual(len(trip["days"]), 2)
        first, second = place(), place("Park", -80.01)
        trip["days"][0]["places"] = [first, second]
        trip = self.save(trip).json()
        trip["days"][0]["places"].reverse()
        trip["days"][0]["places"][0]["notes"] = "Bring lunch"
        trip = self.save(trip).json()
        saved = self.client.get(f'/api/trips/{trip["id"]}').json()
        self.assertEqual(saved["days"][0]["places"][0]["name"], "Park")
        self.assertEqual(saved["days"][0]["places"][0]["notes"], "Bring lunch")
        self.assertEqual(saved["days"][1]["places"], [])
        self.assertEqual(
            self.client.delete(
                f'/api/trips/{trip["id"]}',
                {"revision": trip["revision"]},
                content_type="application/json",
            ).status_code,
            200,
        )
        self.assertEqual(Trip.objects.count(), 0)

    def test_other_browser_cannot_read_update_delete_or_route(self):
        trip = self.create()
        stranger = Client()
        path = f'/api/trips/{trip["id"]}'
        self.assertEqual(stranger.get(path).status_code, 404)
        self.assertEqual(
            stranger.put(path, trip, content_type="application/json").status_code, 404
        )
        self.assertEqual(
            stranger.delete(path, trip, content_type="application/json").status_code,
            404,
        )
        self.assertEqual(
            stranger.post(path + "/days/2026-10-10/route").status_code, 404
        )
        self.assertEqual(stranger.get("/api/trips").json()["trips"], [])

    def test_stale_revision_does_not_overwrite(self):
        trip = self.create()
        self.assertEqual(self.save(trip).status_code, 200)
        trip["name"] = "Stale edit"
        self.assertEqual(self.save(trip).status_code, 409)
        self.assertEqual(Trip.objects.get().name, "Pittsburgh weekend")

    def test_validation_is_atomic(self):
        trip = self.create()
        trip["days"][0]["places"] = [place()]
        trip = self.save(trip).json()
        trip["days"][0]["places"][0]["latitude"] = 999
        self.assertEqual(self.save(trip).status_code, 400)
        self.assertEqual(Trip.objects.get().days.first().places.count(), 1)
        for invalid in [
            [],
            None,
            {"name": ""},
            {**payload(), "endDate": "2026-01-01"},
            {**payload(), "endDate": "2027-10-01"},
        ]:
            self.assertEqual(
                self.client.post(
                    "/api/trips", json.dumps(invalid), content_type="application/json"
                ).status_code,
                400,
            )

    def test_duplicate_place_id_cannot_remove_saved_data(self):
        trip = self.create()
        stop = place()
        trip["days"][0]["places"] = [stop, stop]
        self.assertEqual(self.save(trip).status_code, 400)
        self.assertEqual(Trip.objects.get().days.count(), 2)

    def test_import_is_atomic_and_idempotent(self):
        original = {**payload(), "id": "old-local-id"}
        response = self.client.post(
            "/api/trips/import", {"trips": [original]}, content_type="application/json"
        )
        self.assertEqual(response.json()["imported"], 1)
        response = self.client.post(
            "/api/trips/import", {"trips": [original]}, content_type="application/json"
        )
        self.assertEqual(response.json()["skipped"], 1)
        response = self.client.post(
            "/api/trips/import",
            {"trips": [{**original, "id": "new-id"}, {"id": "broken"}]},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Trip.objects.count(), 1)

    def test_import_accepts_old_destination_ids(self):
        original = {
            **payload(),
            "id": "old-trip",
            "endDate": "2026-10-10",
            "days": [
                {"date": "2026-10-10", "places": [{**place(), "id": "old-place"}]}
            ],
        }
        self.assertEqual(
            self.client.post(
                "/api/trips/import",
                {"trips": [original]},
                content_type="application/json",
            ).status_code,
            200,
        )

    def test_csrf_is_required(self):
        client = Client(enforce_csrf_checks=True)
        self.assertEqual(
            client.post(
                "/api/trips", payload(), content_type="application/json"
            ).status_code,
            403,
        )
        token = client.get("/api/session").json()["csrfToken"]
        self.assertEqual(
            client.post(
                "/api/trips",
                payload(),
                content_type="application/json",
                HTTP_X_CSRFTOKEN=token,
            ).status_code,
            201,
        )

    @patch("trips.views.calculate_route")
    def test_route_endpoint_uses_saved_day(self, calculate):
        trip = self.create()
        trip["days"][0]["places"] = [place(), place("Park")]
        self.save(trip)
        calculate.return_value = {"distanceMeters": 123}
        response = self.client.post(f'/api/trips/{trip["id"]}/days/2026-10-10/route')
        self.assertEqual(response.json()["distanceMeters"], 123)
        self.assertEqual(len(calculate.call_args.args[0]), 2)
        calculate.side_effect = RoutingError("Provider offline")
        self.assertEqual(
            self.client.post(
                f'/api/trips/{trip["id"]}/days/2026-10-10/route'
            ).status_code,
            502,
        )


class DijkstraTests(SimpleTestCase):
    def test_shortest_path_beats_direct_edge(self):
        graph = {0: [(1, 10), (2, 2)], 1: [], 2: [(1, 3)]}
        self.assertEqual(dijkstra(graph, 0, 1), (5, [0, 2, 1]))

    def test_directed_disconnected_zero_and_same_node(self):
        graph = {0: [(1, 0)], 1: [], 2: []}
        self.assertEqual(dijkstra(graph, 0, 1), (0, [0, 1]))
        self.assertEqual(dijkstra(graph, 0, 0), (0, [0]))
        with self.assertRaises(RoutingError):
            dijkstra(graph, 1, 0)
        with self.assertRaises(RoutingError):
            dijkstra(graph, 0, 2)

    def test_rejects_invalid_costs(self):
        for cost in [-1, float("inf"), float("nan")]:
            with self.assertRaises(ValueError):
                dijkstra({0: [(1, cost)], 1: []}, 0, 1)

    @patch("trips.routing.provider_get")
    def test_multistop_geometry_and_cache(self, provider):
        cache.clear()
        provider.side_effect = [
            {"durations": [[0, 20, 5], [None, 0, 8], [None, 2, 0]]},
            {
                "routes": [
                    {
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [[0, 0], [1, 1]],
                        },
                        "distance": 1200,
                        "duration": 15,
                    }
                ]
            },
        ]
        places = [
            SimpleNamespace(longitude=index, latitude=index) for index in range(3)
        ]
        result = calculate_route(places)
        self.assertEqual(result["pathIndices"], [0, 2, 1, 2])
        self.assertEqual(result["graphDurationSeconds"], 15)
        self.assertEqual(calculate_route(places), result)
        self.assertEqual(provider.call_count, 2)

    @patch("trips.routing.provider_get")
    def test_null_edges_and_malformed_provider_data(self, provider):
        places = [
            SimpleNamespace(longitude=index, latitude=index) for index in range(2)
        ]
        for table in [
            {"durations": [[0, None], [None, 0]]},
            {"durations": [[0]]},
            {"durations": [[0, -1], [2, 0]]},
        ]:
            cache.clear()
            provider.return_value = table
            with self.assertRaises(RoutingError):
                calculate_route(places)

    def test_missing_coordinates_and_too_few_stops(self):
        for places in [
            [],
            [SimpleNamespace(latitude=0, longitude=0)],
            [SimpleNamespace(latitude=None, longitude=None)] * 2,
        ]:
            with self.assertRaises(RoutingError):
                calculate_route(places)
