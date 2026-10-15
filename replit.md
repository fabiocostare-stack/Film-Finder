# Film Finder

App mobile in italiano per ricevere consigli di film basati sui propri gusti e sulle piattaforme streaming disponibili in Italia.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/film-finder run dev` — run the Expo mobile app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required secret for live movie data: `TMDB_API_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/film-finder` — Expo app, AsyncStorage preferences, movie browsing and recommendations
- `artifacts/api-server/src/routes/movies.ts` — TMDB catalog, streaming provider, and availability proxy
- `lib/api-spec/openapi.yaml` — API contract and generated client schemas

## Architecture decisions

- Keep profile, liked titles, selected providers, saved titles, and recommendation history on-device; no account or database is needed for this first mobile version.
- Send TMDB requests through the API server so the TMDB key is never bundled in the mobile app.
- Do not show sample films when the live catalog is unavailable.

## Product

- Search a large movie catalog, like films, keep a watchlist, describe viewing preferences, select Italian streaming providers, and see verified availability for each film.
- Recommendations use liked-film genres, free-text taste keywords, selected providers, and a persistent exclusion history to rotate suggestions.

## User preferences

- The interface and user-facing copy should be in Italian.

## Gotchas

- Live catalog and streaming data return an explicit configuration message until the `TMDB_API_KEY` secret is set.
- Re-run API code generation after changing `lib/api-spec/openapi.yaml`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
