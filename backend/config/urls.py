from django.urls import path
from trips import views

urlpatterns = [
    path("api/health", views.health),
    path("api/session", views.session),
    path("api/trips", views.trips),
    path("api/trips/import", views.import_trips),
    path("api/trips/<uuid:trip_id>", views.trip_detail),
    path("api/trips/<uuid:trip_id>/days/<str:day_date>/route", views.route),
]
