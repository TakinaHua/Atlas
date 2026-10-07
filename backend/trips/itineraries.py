"""Validate whole itineraries before writing anything to the database."""

import math
import uuid
from datetime import date, timedelta
from .models import Day, Place


class InvalidInput(ValueError):
    pass


def text(value, field, limit, required=False):
    if not isinstance(value, str) or len(value) > limit:
        raise InvalidInput(f"{field} must be text of at most {limit} characters.")
    value = value.strip()
    if required and not value:
        raise InvalidInput(f"Enter {field}.")
    return value


def validate(data):
    if not isinstance(data, dict):
        raise InvalidInput("An itinerary must be a JSON object.")
    result = {
        "name": text(data.get("name"), "trip name", 100, True),
        "destination": text(data.get("destination"), "destination", 150, True),
    }
    try:
        start = date.fromisoformat(data["startDate"])
        end = date.fromisoformat(data["endDate"])
    except (KeyError, ValueError, TypeError):
        raise InvalidInput("Use valid YYYY-MM-DD start and end dates.")
    length = (end - start).days + 1
    if not 1 <= length <= 60:
        raise InvalidInput("Trips must last between 1 and 60 days.")
    dates = [(start + timedelta(days=i)).isoformat() for i in range(length)]
    days = data.get("days", [{"date": value, "places": []} for value in dates])
    if (
        not isinstance(days, list)
        or len(days) != length
        or any(not isinstance(day, dict) for day in days)
    ):
        raise InvalidInput("Include exactly one itinerary day for each date.")
    if [day.get("date") for day in days] != dates:
        raise InvalidInput("Itinerary days must match the trip dates, in order.")
    clean_days = []
    used_ids = set()
    for day in days:
        places = day.get("places")
        if not isinstance(places, list) or len(places) > 30:
            raise InvalidInput("Each day supports up to 30 destinations.")
        clean_places = []
        for place in places:
            if not isinstance(place, dict):
                raise InvalidInput("Each destination must be an object.")
            cleaned = {
                field: text(place.get(field, default), field, limit, field == "name")
                for field, limit, default in [
                    ("name", 150, ""),
                    ("address", 300, ""),
                    ("category", 40, "Sightseeing"),
                    ("notes", 2000, ""),
                ]
            }
            latitude, longitude = place.get("latitude"), place.get("longitude")
            if (latitude is None) != (longitude is None):
                raise InvalidInput("Supply both coordinates, or leave both empty.")
            if latitude is not None:
                for value, limit in [(latitude, 90), (longitude, 180)]:
                    if (
                        isinstance(value, bool)
                        or not isinstance(value, (int, float))
                        or not math.isfinite(value)
                        or abs(value) > limit
                    ):
                        raise InvalidInput("Coordinates are outside the valid range.")
            try:
                place_id = (
                    uuid.UUID(str(place["id"])) if place.get("id") else uuid.uuid4()
                )
            except (ValueError, TypeError, AttributeError):
                # Older versions used non-UUID IDs. Import converts them before validation.
                raise InvalidInput("Destination IDs must be UUIDs.")
            if place_id in used_ids:
                raise InvalidInput("Destination IDs must be unique within a trip.")
            used_ids.add(place_id)
            cleaned.update(id=place_id, latitude=latitude, longitude=longitude)
            clean_places.append(cleaned)
        clean_days.append({"date": day["date"], "places": clean_places})
    result.update(start_date=start, end_date=end, days=clean_days)
    return result


def write_days(trip, days):
    """Called inside a transaction: replace the nested itinerary atomically."""
    trip.days.all().delete()
    for day_data in days:
        day = Day.objects.create(trip=trip, date=day_data["date"])
        Place.objects.bulk_create(
            [
                Place(day=day, position=index, **place)
                for index, place in enumerate(day_data["places"])
            ]
        )


def serialize(trip):
    return {
        "id": str(trip.id),
        "name": trip.name,
        "destination": trip.destination,
        "startDate": trip.start_date.isoformat(),
        "endDate": trip.end_date.isoformat(),
        "revision": trip.revision,
        "days": [
            {
                "date": day.date.isoformat(),
                "places": [
                    {
                        "id": str(place.id),
                        "name": place.name,
                        "address": place.address,
                        "category": place.category,
                        "notes": place.notes,
                        "latitude": place.latitude,
                        "longitude": place.longitude,
                    }
                    for place in day.places.all()
                ],
            }
            for day in trip.days.all()
        ],
    }
