"""A trip owns days; each day owns an ordered list of destinations."""

import uuid
from django.db import models


class Trip(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # A browser session owns its trips. Knowing another trip's UUID grants no access.
    owner = models.CharField(max_length=40, db_index=True)
    legacy_id = models.CharField(max_length=100, null=True, blank=True)
    name = models.CharField(max_length=100)
    destination = models.CharField(max_length=150)
    start_date = models.DateField()
    end_date = models.DateField()
    revision = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "legacy_id"], name="unique_import_per_owner"
            )
        ]


class Day(models.Model):
    trip = models.ForeignKey(Trip, related_name="days", on_delete=models.CASCADE)
    date = models.DateField()

    class Meta:
        ordering = ["date"]
        constraints = [
            models.UniqueConstraint(fields=["trip", "date"], name="unique_trip_day")
        ]


class Place(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    day = models.ForeignKey(Day, related_name="places", on_delete=models.CASCADE)
    name = models.CharField(max_length=150)
    address = models.CharField(max_length=300, blank=True)
    category = models.CharField(max_length=40, default="Sightseeing")
    notes = models.TextField(blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    position = models.PositiveIntegerField()

    class Meta:
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(
                fields=["day", "position"], name="unique_day_position"
            )
        ]
