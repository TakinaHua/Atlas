---
name: Atlas Travel Editions
description: An editorial travel workspace pairing a personal trip journal with an interactive day map.
colors:
  wine: "#783f43"
  paper: "#f8f5ef"
  card: "#fffcf7"
  ink: "#302b28"
  muted: "#665b55"
  wash: "#f2e6e1"
  rule: "#d8cfc5"
  field-line: "#91847b"
  error-ink: "#7a302e"
  error-paper: "#f9ece6"
typography:
  dashboard-title:
    fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif"
    fontSize: "clamp(40px, 5.2vw, 72px)"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.045em"
  trip-title:
    fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif"
    fontSize: "clamp(32px, 4vw, 60px)"
    fontWeight: 500
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  stop-title:
    fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif"
    fontSize: "21px"
    fontWeight: 500
    lineHeight: 1.2
rounded:
  field: "4px"
  control: "5px"
  dialog: "8px"
spacing:
  compact: "8px"
  row: "16px"
  section: "24px"
components:
  primary-button:
    backgroundColor: "{colors.wine}"
    textColor: "{colors.card}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  text-field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
  stop-selected:
    backgroundColor: "{colors.wash}"
    rounded: "{rounded.control}"
    padding: "{spacing.row}"
---
# Atlas · Travel Editions

## Overview

Travel Editions treats each trip as a journal the traveler can edit. Photography establishes the destination on the dashboard. Inside the planner, the date, stop names, and numbered map markers carry the identity. A traveler should be able to find Point State Park in the itinerary, select it, and recognize the same stop on the map.

The dashboard has one prominent creation action and a searchable shelf of saved trips. The planner supports denser work: ordering stops, moving them between days, editing notes, and calculating routes. Both use the same paper and ink surfaces, serif headings, and burgundy selection treatment.

## Colors

| Role | Application |
|---|---|
| Paper, card, rule | Warm page canvas, lighter working surfaces, and quiet separators between sections or trips. |
| Ink, muted | Titles and editable content use ink. Dates, addresses, captions, and supporting explanations use muted text. |
| Wine, wash | Wine identifies primary actions, active days, the selected stop, keyboard focus, and route geometry. Wash connects selected rows and route results to those elements. |
| Field line | Stronger outline for editable fields, particularly on a light dialog surface. |
| Error ink, error paper | Pair with an explicit error message. Keep the error adjacent to the operation that failed. |

The category tags retain their existing pastel colors. The interactive basemap uses OpenStreetMap tiles; the application controls the marker and route overlays.

## Typography

Use the local serif stack for the Atlas wordmark, trip titles, stop names, dialog titles, and section headings. System sans serif carries dates, addresses, notes, buttons, and search results. No downloaded font is required.

The dashboard title is the largest text. Saved-trip names are 26px on desktop and 22px on small screens. The planner gives the trip title more emphasis than the selected date; stop names sit one level below. Day metadata and destination labels use 12px text. Keep the traveler’s actual names and notes readable when they wrap.

## Layout

| Surface | Desktop | Narrow screens |
|---|---|---|
| Dashboard | Center within 1200px. Pair the journal headline and **Plan a trip** with one captioned destination photo. Follow with saved trips, samples, and import/export. | At 650px and below, stack the hero, crop the photo to 130px high, retain compact thumbnails beside saved-trip details, and stack backup controls. |
| Planner | Center within 1512px. Put the trip header and day strip above an approximately 48/52 itinerary–map split. The map panel stays sticky while the list grows. | Keep both panels side by side from 768px upward. Below 768px, stack the map after the itinerary and use sticky Days, Stops, Map, and Route links. Provide a return link to the selected stop. At 650px and below, use horizontal day scrolling and a compact trip header. |
| Editors | Center a native dialog with a maximum width of 540px and internal scrolling. Keep paired dates and coordinates aligned. | Fit within 94vw, use 18px dialog padding, and stack paired fields on small screens. |

## Elevation & Depth

Saved-trip rows sit flat against the page. A thin border, lighter card surface, or selected wash separates adjacent regions. The selected stop adds a 4px inset wine rule. Floating search suggestions and the modal retain shadows so their relationship to the field or page beneath remains clear.

## Shapes

Use compact corners for working elements: 4px on fields and dashboard photos, 5px on stop cards, day controls, and the map, and 8px on editor dialogs. Circular numbers pair itinerary entries with map markers. Keep photography cropped within its frame and preserve available attribution.

## Components

| Component | Behavior and visual contract |
|---|---|
| Journal hero and trip shelf | Give **Plan a trip** the filled wine treatment. Each saved row contains an image or destination fallback, destination, trip name, dates, and separate open and delete actions. Keep samples below the traveler’s collection. |
| Day navigation | Show day number, date, and stop count. Fill the current day and expose its current state to assistive technology. Trips longer than four days also offer **Jump to day**. Day changes clear the previous stop selection and route. |
| Stop and marker | Use matching numbers. The selected row gains wash, border, and inset rule; the pin fills with wine and rises above neighbors. Use **Fit day to map** to recover the full extent after panning or resizing. Update selection without rebuilding map layers. Preserve zoom and pan to an offscreen selected pin. Support pointer, Enter, and Space on markers. |
| Stop editing | Keep edit, remove, reorder, and cross-day move controls available. Label their group with the place name. Stop tools have a 44px minimum height. A stop without coordinates remains editable and explains how to add a pin. |
| Route panel | Keep driving and the Pittsburgh walking demo distinct. Show total distance, travel time where available, and per-leg results. Pair unavailable actions with the reason. Preserve route attribution, limitations, clearing, and error recovery. |
| Trip and place editors | Use a native modal, labeled fields, a serif title, explicit close and cancel, and a wine Save action. Keep values in place after a failed save. Destination autocomplete supports keyboard selection; place search can populate a stop or the traveler can enter details manually. |
| Loading, empty, and error states | Keep loading text visible. Distinguish an empty collection from a search with no matches. Offer clear-search or retry where the relevant action exists. Use a visible focus outline on the element being operated. |
| Backup controls | Place import/export after trip content. Keep export, JSON file selection, and conditional import of legacy browser trips distinct. Preserve import notices and errors. |

## Do's and Don'ts

- Do use real destinations, trip names, dates, and stop counts to establish hierarchy.
- Do maintain the selected stop across the list-to-map jump and return.
- Do retain photo fallback, provider credit, and routing limitations when compacting a surface.
- Don't present an editable sample as a saved trip before the traveler adds it.
- Don't draw an inferred route between stops before a route calculation succeeds.
- Don't add dashboard promotional sections between the primary action and saved trips.

The implemented styles are in `frontend/app/planner-edition.css`, `frontend/app/dashboard-edition.css`, and the inherited `frontend/app/globals.css`. Selection behavior is in `frontend/components/TripMap.tsx` and `frontend/app/page.tsx`.
