"""JSON REST endpoints with session ownership, CSRF, and atomic writes."""

import copy
import json
import uuid
from functools import wraps
from django.db import IntegrityError, transaction
from django.db.models import F
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from .itineraries import InvalidInput, serialize, validate, write_days
from .models import Trip
from .routing import RoutingError, calculate_route


def endpoint(methods):
    """Keep expected failures readable without leaking internal exception details."""

    def decorate(view):
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            if request.method not in methods:
                response = JsonResponse({"error": "Method not allowed."}, status=405)
                response["Allow"] = ", ".join(methods)
                return response
            try:
                return view(request, *args, **kwargs)
            except (InvalidInput, json.JSONDecodeError, UnicodeDecodeError) as error:
                return JsonResponse({"error": str(error)}, status=400)
            except Trip.DoesNotExist:
                return JsonResponse({"error": "Trip not found."}, status=404)
            except RoutingError as error:
                return JsonResponse({"error": str(error)}, status=502)
            except IntegrityError:
                return JsonResponse(
                    {"error": "Conflicting itinerary data. Reload and try again."},
                    status=409,
                )

        return wrapped

    return decorate


def owner(request):
    if not request.session.session_key:
        request.session.create()
    return request.session.session_key


def body(request):
    if request.content_type != "application/json":
        raise InvalidInput("Send application/json.")
    return json.loads(request.body)


def owned_trip(request, trip_id):
    return Trip.objects.prefetch_related("days__places").get(
        id=trip_id, owner=owner(request)
    )


@endpoint(["GET"])
def health(request):
    return JsonResponse({"status": "ok", "service": "atlas"})


@ensure_csrf_cookie
@endpoint(["GET"])
def session(request):
    owner(request)
    return JsonResponse({"csrfToken": get_token(request)})


@endpoint(["GET", "POST"])
def trips(request):
    if request.method == "GET":
        items = Trip.objects.filter(owner=owner(request)).prefetch_related(
            "days__places"
        )
        return JsonResponse({"trips": [serialize(trip) for trip in items]})
    data = validate(body(request))
    with transaction.atomic():
        days = data.pop("days")
        trip = Trip.objects.create(owner=owner(request), **data)
        write_days(trip, days)
    return JsonResponse(serialize(trip), status=201)


@endpoint(["GET", "PUT", "DELETE"])
def trip_detail(request, trip_id):
    trip = owned_trip(request, trip_id)
    if request.method == "GET":
        return JsonResponse(serialize(trip))
    data = body(request)
    if not isinstance(data, dict) or type(data.get("revision")) is not int:
        raise InvalidInput("Include the current trip revision.")
    validated = validate(data) if request.method == "PUT" else None
    with transaction.atomic():
        # Compare-and-swap avoids silently replacing changes from another tab.
        changed = Trip.objects.filter(id=trip.id, revision=data["revision"]).update(
            revision=F("revision") + 1
        )
        if not changed:
            return JsonResponse(
                {"error": "This trip changed in another tab. Reload before saving."},
                status=409,
            )
        if request.method == "DELETE":
            trip.delete()
            return JsonResponse({"deleted": True})
        days = validated.pop("days")
        Trip.objects.filter(id=trip.id).update(**validated)
        write_days(trip, days)
    return JsonResponse(serialize(owned_trip(request, trip_id)))


@endpoint(["POST"])
def import_trips(request):
    data = body(request)
    if (
        not isinstance(data, dict)
        or not isinstance(data.get("trips"), list)
        or len(data["trips"]) > 100
    ):
        raise InvalidInput("Import a list containing at most 100 trips.")
    prepared = []
    for original in data["trips"]:
        if (
            not isinstance(original, dict)
            or not isinstance(original.get("id"), str)
            or not 1 <= len(original["id"]) <= 100
        ):
            raise InvalidInput("Each imported trip needs its original ID.")
        item = copy.deepcopy(original)
        # Regenerate place IDs so imports never collide with existing destinations.
        for day in item.get("days", []) if isinstance(item.get("days"), list) else []:
            if isinstance(day, dict) and isinstance(day.get("places"), list):
                for place in day["places"]:
                    if isinstance(place, dict):
                        place["id"] = str(uuid.uuid4())
        prepared.append((original["id"], validate(item)))
    created = 0
    session_owner = owner(request)
    with transaction.atomic():
        for legacy_id, item in prepared:
            days = item.pop("days")
            trip, is_new = Trip.objects.get_or_create(
                owner=session_owner, legacy_id=legacy_id, defaults=item
            )
            if is_new:
                write_days(trip, days)
                created += 1
    return JsonResponse({"imported": created, "skipped": len(prepared) - created})


@endpoint(["POST"])
def route(request, trip_id, day_date):
    trip = owned_trip(request, trip_id)
    day = next(
        (day for day in trip.days.all() if day.date.isoformat() == day_date), None
    )
    if day is None:
        return JsonResponse({"error": "Itinerary day not found."}, status=404)
    return JsonResponse(calculate_route(list(day.places.all())))


def csrf_failure(request, reason=""):
    return JsonResponse(
        {"error": "Your session needs to be refreshed. Reload the page and try again."},
        status=403,
    )
