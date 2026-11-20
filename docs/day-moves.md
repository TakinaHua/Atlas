# Moving places between days

Drag a card within its day to reorder it or into another day to move it. On touch screens, press and hold the card before dragging. The insertion line shows where the card will land. For a menu-based move, open **More**, choose a day under **Move to another day**, and Atlas appends the stop there. The menu is available for multi-day trips and excludes the current day. Days with 30 places are unavailable as move targets.

The move sends one updated itinerary through the existing revision-checked PUT endpoint. Source removal and target insertion are committed together in SQLite; no new schema or backend endpoint is required. The same place object retains its ID, name, address, category, notes, and coordinates. Neither day is changed locally until save succeeds. Failure displays an error and leaves the original itinerary visible; existing revision conflicts protect against another tab's newer changes. Sample-trip moves remain local until the sample is saved.

Successful saves invalidate cached route state. The destination day becomes active and the moved stop becomes selected; its pin appears if it has coordinates. Other stops retain their relative order. Day switching and movement controls are disabled during the save.

## Manual checks

1. Create a two-day trip. Add a located stop to day 1 and another stop to day 2.
2. On day 1, drag the stop above the existing card on day 2. Confirm day 2 opens with the moved stop first and selected.
3. Check its details and pin; reopen day 1 and confirm the original stop is gone.
4. Refresh, reopen the trip, and check both days. Use **More** and **Move to another day** to move the stop back.
5. Stop the API and attempt a move: the app should show an error and preserve the original position. Reload after restoring the API before retrying.
6. A full destination day is unavailable. One-day trips have no move menu.

Playwright covers pointer and touch dragging, menu-based moves, failed-save preservation, selection, and reopening saved trips. The backend handles transaction rollback, persistence, day limits, and stale revisions.
