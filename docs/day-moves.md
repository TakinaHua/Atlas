# Moving places between days

Completed October 14, 2026. Each stop in a multi-day trip has a **Move to another day** menu. Select a day to append the stop there. After saving, Atlas opens that day and selects the moved stop. Current-day entries are excluded, and days with 30 places are marked full and disabled. Single-day trips do not show the menu.

The move sends one updated itinerary through the existing revision-checked PUT endpoint. Source removal and target insertion are committed together in SQLite; no new schema or backend endpoint is required. The same place object retains its ID, name, address, category, notes, and coordinates. Neither day is changed locally until save succeeds. Failure displays an error and leaves the original itinerary visible; existing revision conflicts protect against another tab's newer changes. Sample-trip moves remain local until the sample is saved.

Successful saves invalidate cached route state. The destination day becomes active and the moved stop becomes selected; its pin appears if it has coordinates. Other stops retain their relative order. Day switching and movement controls are disabled during the save.

## Manual checks

1. Create a two-day trip. Add a located stop to day 1 and another stop to day 2.
2. On day 1, select day 2 from the stop's move menu. Confirm day 2 opens, with the moved stop last and selected.
3. Check its details and pin; reopen day 1 and confirm the original stop is gone.
4. Refresh, reopen the trip, and check both days. Move the stop back.
5. Stop the API and attempt a move: the app should show an error and preserve the original position. Reload after restoring the API before retrying.
6. A full destination day is unavailable. One-day trips have no move menu.

Playwright covers failed-save preservation, successful append, selected pin, unchanged saved place data/ID, refresh/reopen, and moving back. The existing backend handles transaction rollback, persistence, day limits, and stale revisions. No road routing or Dijkstra is added here.
