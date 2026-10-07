import { escapeHTML as e } from '../utilities/helpers.js';
import { formatDate } from '../utilities/dates.js';
import { DaySelector, ItineraryPanel } from '../components/ItineraryPanel.js';
import { AgentPlaceholder } from '../components/Navbar.js';
export const TripPlannerPage = (trip, date, selected) =>
  `<main class="planner page"><a class="back-link" href="#/dashboard">← All trips</a><div class="page-heading"><div><p class="eyebrow">${e(trip.destination)}</p><h1>${e(trip.name)}</h1><p>${formatDate(trip.startDate)} – ${formatDate(trip.endDate)} · ${trip.days.length} days</p></div>${AgentPlaceholder()}</div>${DaySelector(trip, date)}<div class="planner-grid">${ItineraryPanel(
    trip.days.find((d) => d.date === date),
    selected,
  )}<section class="map-panel"><div class="section-heading"><div><p class="eyebrow">A DIFFERENT PERSPECTIVE</p><h2>Your day, mapped.</h2></div><span class="map-badge">Explore</span></div><div id="map" class="map-canvas" aria-label="Map of selected day"></div><p class="map-note">Map tiles require internet. Add coordinates to locate places.</p></section></div></main>`;
