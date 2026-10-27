---
name: Film recommendation priorities
description: Product requirements for Film Finder's first-run setup and recommendation relevance.
---

New users choose their streaming services before seeing recommendations. Suggestions must be available on at least one selected service and should closely reflect watched titles, including shared actors or directors where possible, while favoring high viewer ratings. Film cards should show the director, principal cast, and runtime in “x h y min” format instead of a plot synopsis, with details fetched in batches rather than once per card.

The Home opens on director discovery, with the existing personalized film feed kept under “Film per te.” Following a director is an explicit positive preference; a watched movie is only a discovery signal and must not automatically be treated as a favorite.

**Why:** The user explicitly wants platforms selected at the start, a strict availability filter, recommendations connected to watched titles through cast or directing, and high ratings. They approved a director-first Home while keeping the current film recommendations and cineteca, with watched titles informing director discovery without assuming the user liked every watched movie. Recommendation refreshes also exposed ETag-based 304 responses, which the generated client treats as errors; individual detail lookups create excessive mobile requests.

**How to apply:** Preserve platform choice as a hard eligibility filter and use watched films as a relevance signal, not a rating. Keep explicitly followed directors distinct from directors inferred from watched movies; keep the original film feed reachable and unchanged. Keep API responses non-cacheable at the HTTP layer, batch movie-detail lookups, avoid automatic pagination when the feed is empty, and format available runtime as “x h y min” beside the year.
