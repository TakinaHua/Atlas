# Atlas design system

## Direction

Airbnb's white canvas, welcoming photography and rounded surfaces provide the dominant visual influence. Notion's restrained row hierarchy, compact controls and pastel labels organize the planner. These are references, not product requirements or copied brand identities.

References read: https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/airbnb/DESIGN.md and https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/notion/DESIGN.md.

## Shared rules

- White canvas, warm off-white secondary surfaces, charcoal text, forest green #245e4d as the sole action accent. Pastels identify categories only. Red means an error or destructive action.
- System sans-serif throughout; 14px body, 12px metadata, 20–24px section titles, 34px trip titles, up to 46px discovery headline. Medium/semibold headings with tight tracking.
- Spacing on a 4px scale: 8px control gaps, 16px row padding, 24px panel padding, 32–48px page sections.
- 10px controls, 16px cards, 24px discovery photography. Minimal shadows; borders and whitespace establish hierarchy.
- Simple monochrome directional symbols; numbered circles link stops and map markers. Text labels accompany actions.
- Primary actions are green; secondary actions outlined; contextual edits use quiet text buttons. Hover softens the surface, selection adds a green border and pale green fill, keyboard focus has a high contrast outline. Touch targets at least 44px on small screens.

## Application

Dashboard: compact navigation, a welcoming photo feature, two clearly labeled editable samples, searchable saved trips, and a quieter backup/import section. No fabricated travel data. Trip counts include all stored trips; no date-based hiding.
Planner: small destination image beside trip metadata; horizontally scrollable day buttons with date and stop count; itinerary and sticky map side by side. Daily rows have no photography. Place name leads, category is a small tag, address is muted, notes retain line breaks. Move, reorder, edit and remove remain directly accessible.
Dialogs: native modal focus containment and Escape support; explicit close and cancel, clear labels, grouped dates/coordinates, persistent field values on failed saves. Search/manual-entry behavior stays intact.
Responsive: cards collapse from three to two to one column; planner stacks below 900px; day strip scrolls within the viewport. No page-level horizontal scrolling. Reduced motion disables transitions.
States: visible loading message and subtle loading indicator, useful empty copy, inline errors and reload recovery, selected stops and day indicators. Samples explicitly remain unsaved until added.

## Photography

Locally served, cropped licensed photographs with visible destination context; failed/unknown images fall back to an Atlas destination tile. Do not assign unrelated city photography to unknown destinations.

- Oʻahu: Colton Jones, https://unsplash.com/photos/msqjXkiT34Y — https://images.unsplash.com/photo-1518765397694-6178fdb62875
- Pittsburgh: Mausam Majhi, https://unsplash.com/photos/3GAhEoe0PuE — https://images.unsplash.com/photo-1742842983846-79c45e3be8f9
- Both photo pages identify free use under https://unsplash.com/license. No accounts, bookings or travel claims added.

## Preservation checklist (recorded before implementation)

- Trip create/edit/delete, SQLite persistence and revision conflicts.
- Day navigation; stop add/edit/remove/reorder/move; notes/custom categories/coordinates.
- Destination autocomplete and place search; keyboard selection and manual fallbacks.
- Leaflet interaction, numbered pins and linked selected state; missing tile feedback.
- Driving route legs/distance/time, stale response cancellation, Pittsburgh walking demo.
- Unsaved samples and explicit saving; JSON export/import; original browser-trip migration.
- Save failure recovery with retained input, empty/loading/error states, responsive layout and keyboard access.

Backend, stored records and API contracts remain unchanged. Existing untracked work is preserved.
