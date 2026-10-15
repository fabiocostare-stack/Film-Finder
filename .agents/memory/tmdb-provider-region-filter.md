---
name: TMDB streaming-region filter
description: The required regional parameter when filtering TMDB movie discovery by streaming providers.
---

When calling TMDB `/discover/movie` with `with_watch_providers`, include `watch_region` for the same country whose streaming services the user selected. The `region` parameter is not a substitute; it controls release-region behavior and can otherwise return titles unavailable from the selected provider.

**Why:** Provider-filtered recommendations initially returned films whose Italian availability endpoint had no selected provider.

**How to apply:** Whenever recommendations are filtered by a user's streaming provider, pass the user's country as `watch_region` and validate sample results against the availability endpoint for that country.
