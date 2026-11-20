---
name: Atlas Travel Editions
description: An editorial travel workspace pairing a linen day board with an interactive trip map.
colors:
  wine: '#783f43'
  paper: '#f8f5ef'
  card: '#fffcf7'
  ink: '#302b28'
  muted: '#665b55'
  wash: '#f2e6e1'
  rule: '#d8cfc5'
  field-line: '#91847b'
  error-ink: '#7a302e'
  error-paper: '#f9ece6'
  studio-linen: '#d6bd98'
  studio-print: '#fbf3df'
  studio-green: '#244c3e'
  studio-green-soft: '#e6ece2'
typography:
  dashboard-title:
    fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif"
    fontSize: 'clamp(40px, 5.2vw, 72px)'
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: '-0.045em'
  trip-title:
    fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif"
    fontSize: 'clamp(33px, 4.25vw, 56px)'
    fontWeight: 500
    lineHeight: 1.06
    letterSpacing: '-0.04em'
  trip-title-mobile:
    fontSize: 'clamp(28px, 8.5vw, 38px)'
  studio-section:
    fontSize: '28px'
  studio-day:
    fontSize: '25px'
  studio-route:
    fontSize: '22px'
  studio-shelf:
    fontSize: '20px'
  studio-shelf-mobile:
    fontSize: '18px'
  studio-control:
    fontSize: '13px'
  studio-detail:
    fontSize: '12px'
  studio-category:
    fontSize: '11px'
  studio-credit:
    fontSize: '10px'
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '14px'
    lineHeight: 1.5
  stop-title:
    fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif"
    fontSize: '19px'
    fontWeight: 500
    lineHeight: 1.2
rounded:
  field: '4px'
  control: '5px'
  dialog: '8px'
  studio-print: '2px'
spacing:
  compact: '8px'
  row: '16px'
  section: '24px'
components:
  primary-button:
    backgroundColor: '{colors.wine}'
    textColor: '{colors.card}'
    rounded: '{rounded.control}'
    padding: '12px 20px'
  text-field:
    backgroundColor: '{colors.card}'
    textColor: '{colors.ink}'
    rounded: '{rounded.field}'
  stop-selected:
    backgroundColor: '{colors.studio-green-soft}'
    rounded: '{rounded.studio-print}'
    padding: '{spacing.row}'
---

# Atlas · Travel Editions

## Overview

Travel Editions treats each trip as a journal the traveler can edit. Photography establishes the destination on the homepage. Journey Studio brings the same linen and pinned prints into the day board, with matching numbers on cards and map markers. A traveler should be able to find Point State Park in the itinerary, select it, and recognize the same stop on the map.

My trips is a searchable shelf of saved itineraries. Journey Studio supports denser work, including ordering stops, collecting places for later, editing notes, and calculating routes. Both use paper and ink surfaces and serif headings. The planner uses forest green for selection and keeps burgundy for calculated paths.

## Colors

| Role                   | Application                                                                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paper, card, rule      | Warm page canvas, lighter working surfaces, and quiet separators between sections or trips.                                                                           |
| Ink, muted             | Titles and editable content use ink. Dates, addresses, captions, and supporting explanations use muted text.                                                          |
| Wine, wash             | Use burgundy for the homepage, editor controls, and calculated route geometry. Use forest green and a light green tint for active planner controls, stops, and focus. |
| Flax linen, ivory      | Use the homepage linen inside the board frame and ivory for day columns and mounts. Preserve plain paper around the workspace.                                        |
| Field line             | Stronger outline for editable fields, particularly on a light dialog surface.                                                                                         |
| Error ink, error paper | Pair with an explicit error message. Keep the error adjacent to the operation that failed.                                                                            |

The category tags retain their existing pastel colors. The interactive basemap uses OpenStreetMap tiles; the application controls the marker and route overlays.

## Typography

Use the local serif stack for the Atlas wordmark, trip titles, stop names, dialog titles, and section headings. System sans serif carries dates, addresses, notes, buttons, and search results. No downloaded font is required.

The dashboard title is the largest text. In Journey Studio, size the trip title from 33–56px on desktop and 28–38px on mobile. Studio section titles are 28px on desktop, day headings are 25px, and stop names are 19px. Use 13px for secondary controls, 12px for dates and addresses, and 11px for photo credits. Keep the traveler’s actual names and notes readable when they wrap.

## Layout

| Surface        | Desktop                                                                                                                                                                                                          | Narrow screens                                                                                                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard      | Center within 1200px. Pair the journal headline and **Plan a trip** with one captioned destination photo. Follow with saved trips, samples, and import/export.                                                   | At 650px and below, stack the hero, crop the photo to 130px high, retain compact thumbnails beside saved-trip details, and stack backup controls.                                                               |
| Journey Studio | Center within 1512px. Put a compact trip header above the 58/42 board and map. Day columns scroll horizontally and stops scroll inside each column. The map remains sticky as the shelf or route details expand. | Below 768px, use sticky Itinerary, Map, and Saved places controls. Card View shows one day column plus a preview of the next. Use 44px controls and allow jumping directly between a selected card and its pin. |
| Editors        | Center a native dialog with a maximum width of 540px and internal scrolling. Keep paired dates and coordinates aligned.                                                                                          | Fit within 94vw, use 18px dialog padding, and stack paired fields on small screens.                                                                                                                             |

## Elevation & Depth

Saved-trip rows sit flat against the page. A thin border, lighter card surface, or selected wash separates adjacent regions. A selected stop uses a complete green border and a light green tint. Small offset shadows lift the print mounts and keep the rest of the card readable. Floating search suggestions and the modal retain shadows so their relationship to the field or page beneath remains clear.

## Shapes

Use 4px planner controls, 2px postcard corners, square board and map edges, and 8px editor dialogs. Circular numbers pair scheduled stops with geographical markers. Saved markers are diamonds. Brass photo pins sit on the print mount only, with rotation and placement derived from place ID. Keep credits linked. When a location has no verified photo, give the place name, location, and notes the full card.

## Components

| Component                        | Behavior and visual contract                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Journal hero and trip shelf      | Give **Plan a trip** the filled wine treatment. Each saved row contains an image or destination fallback, destination, trip name, dates, and separate open and delete actions. Keep samples below the traveler’s collection.                                                                                                                                                                      |
| Day navigation                   | Show day number, date, and stop count with a green top rule on the active column. Offer previous/next and a date jump for trips of up to 60 days. Card View shows the board. List View uses the same data and shows compact rows for the active day.                                                                                                                                              |
| Stop and marker                  | Use matching numbers and show the day index in marker labels. Use **Fit trip** to restore all scheduled stops. Map layers show the active day, all scheduled stops, or saved places. All days markers display day and stop numbers together. Card hover emphasizes the marker. Selection pans when the pin is outside the comfortable viewing area. Support pointer, Enter, and Space on markers. |
| Stop editing                     | Keep Edit and reorder within the card footer. Use More for moving, saving for later, and removing. Drag-and-drop shows an insertion or end-of-day indicator. All drag actions have button or select alternatives.                                                                                                                                                                                 |
| Saved for later                  | Use a collapsible strip below the board or a dedicated mobile panel. Keep the save action available while collapsed. Schedule, edit, and remove from the shelf. Keep one record as a place moves between a day and the shelf.                                                                                                                                                                     |
| Route panel                      | Keep driving and the Pittsburgh walking demo distinct. Show total distance, travel time where available, and per-leg results. Pair unavailable actions with the reason. Preserve route attribution, limitations, clearing, and error recovery. Draw the returned geometry on completion with a short stroke animation. Show the complete line immediately under reduced motion.                   |
| Trip and place editors           | Use a native modal, labeled fields, a serif title, explicit close and cancel, and a wine Save action. Keep values in place after a failed save. Destination autocomplete supports keyboard selection; place search can populate a stop or the traveler can enter details manually.                                                                                                                |
| Loading, empty, and error states | Keep loading text visible. Distinguish an empty collection from a search with no matches. Offer clear-search or retry where the relevant action exists. Use a visible focus outline on the element being operated.                                                                                                                                                                                |
| Backup controls                  | Place import/export after trip content. Keep export, JSON file selection, and conditional import of legacy browser trips distinct. Preserve import notices and errors.                                                                                                                                                                                                                            |

## Do's and Don'ts

- Do use real destinations, trip names, dates, and stop counts to establish hierarchy.
- Do maintain the selected stop across the list-to-map jump and return.
- Do retain photo fallback, provider credit, and routing limitations when compacting a surface.
- Don't present an editable sample as a saved trip before the traveler adds it.
- Don't draw an inferred route between stops before a route calculation succeeds.
- Don't add dashboard promotional sections between the primary action and saved trips.

Planner implementation lives in `frontend/app/journey-studio.css`, `frontend/components/JourneyStudio.tsx`, `frontend/components/JourneyCard.tsx`, `frontend/components/JourneyRoutes.tsx`, and `frontend/components/TripMap.tsx`. Each of the bundled postcard photos links to its source and license from the print caption. The files are resized as WebP and cropped in the UI.

## Homepage · By the rivers

The opening spread pairs a full-viewport destination photograph with an editorial title and a sample itinerary. My trips rises from a bottom handle. Use warm flax linen (#d6bd98), ivory photo borders, and small brass pins. Arrange up to four prints per page with independent pin positions, shallow rotations, and staggered vertical offsets. Page horizontally within the fixed board. Respect reduced motion for the slideshow, board lift, and pagination.
