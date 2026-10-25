---
name: Film recommendation priorities
description: Product requirements for Film Finder's first-run setup and recommendation relevance.
---

New users choose their streaming services before seeing recommendations. Suggestions must be available on at least one selected service and should closely reflect watched titles, including shared actors or directors where possible, while favoring high viewer ratings. Film cards should show the director, principal cast, and runtime in “x h y min” format instead of a plot synopsis, with details fetched in batches rather than once per card.

**Why:** The user explicitly wants platforms selected at the start, a strict availability filter, recommendations connected to watched films through cast or directing, high ratings, and director/cast/runtime information on each film card. Recommendation refreshes also exposed ETag-based 304 responses, which the generated client treats as errors; individual detail lookups create excessive mobile requests.

**How to apply:** Preserve platform choice as a hard eligibility filter and watched films, shared actors, and shared directors as core relevance signals when changing recommendation ranking. Keep API responses non-cacheable at the HTTP layer, batch movie-detail lookups, avoid automatic pagination when the feed is empty, and format available runtime as “x h y min” beside the year.
