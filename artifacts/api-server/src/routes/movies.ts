import {
  GetMovieAvailabilityQueryParams,
  GetMovieAvailabilityResponse,
  GetMovieRecommendationsQueryParams,
  GetMovieRecommendationsResponse,
  ListMovieProvidersQueryParams,
  ListMovieProvidersResponse,
  MovieErrorResponse,
  SearchMoviesQueryParams,
  SearchMoviesResponse,
  type Movie,
  type MovieProvider,
} from "@workspace/api-zod";
import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
const cache = new Map<string, { expiresAt: number; value: unknown }>();

type TmdbMovie = {
  id: number;
  title?: string;
  original_title?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  vote_average?: number;
  genre_ids?: number[];
  original_language?: string;
};

type TmdbProvider = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority?: number;
};

type TmdbList<T> = {
  results?: T[];
  page?: number;
  total_pages?: number;
  total_results?: number;
};

type TmdbAvailability = {
  id?: number;
  results?: Record<
    string,
    {
      link?: string;
      flatrate?: TmdbProvider[];
      free?: TmdbProvider[];
      ads?: TmdbProvider[];
    }
  >;
};

class MovieServiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MovieServiceError";
  }
}

function mapMovie(movie: TmdbMovie): Movie {
  return {
    id: movie.id,
    title: movie.title ?? movie.original_title ?? "",
    originalTitle: movie.original_title ?? movie.title ?? "",
    overview: movie.overview ?? "",
    posterPath: movie.poster_path ?? null,
    backdropPath: movie.backdrop_path ?? null,
    releaseDate: movie.release_date ?? "",
    voteAverage: movie.vote_average ?? 0,
    genreIds: movie.genre_ids ?? [],
    originalLanguage: movie.original_language ?? "",
  };
}

function mapProvider(provider: TmdbProvider): MovieProvider {
  return {
    id: provider.provider_id,
    name: provider.provider_name,
    logoPath: provider.logo_path ?? null,
    displayPriority: provider.display_priority ?? 999,
  };
}

function parseIds(value?: string): number[] {
  if (!value) return [];
  return [...new Set(value.split(",").map((part) => Number(part.trim())))].filter(
    (id) => Number.isInteger(id) && id > 0,
  );
}

const genreTerms: Record<number, string[]> = {
  12: ["avventura", "avventuroso", "adventure"],
  14: ["fantasy", "magia", "magico", "fantastico", "fantastici"],
  16: ["animazione", "animato", "cartoon", "anime"],
  18: ["dramma", "drammatico", "drammatici", "emozionante"],
  27: ["horror", "paura", "spaventoso", "terrificante"],
  28: ["azione", "action", "adrenalina", "spionaggio", "supereroi"],
  35: ["commedia", "comico", "comicità", "divertente", "risate"],
  36: ["storico", "storica", "storia", "history"],
  37: ["western", "cowboy"],
  53: ["thriller", "suspense", "tensione", "colpo di scena"],
  80: ["crime", "criminale", "mafia", "poliziesco", "gangster"],
  99: ["documentario", "documentary", "realtà"],
  878: ["fantascienza", "sci-fi", "scifi", "futuro", "spaziale"],
  9648: ["giallo", "mistero", "misterioso", "indagine", "investigativo"],
  10402: ["musicale", "musical", "musica", "concerti"],
  10749: ["romantico", "romantica", "romantici", "romance", "amore"],
  10751: ["famiglia", "family", "per tutta la famiglia"],
  10752: ["guerra", "bellico", "war"],
};

function inferGenres(taste?: string): number[] {
  if (!taste) return [];
  const normalized = taste.toLocaleLowerCase("it-IT");
  return Object.entries(genreTerms)
    .filter(([, terms]) => terms.some((term) => normalized.includes(term)))
    .map(([id]) => Number(id));
}

async function getTmdb<T>(
  path: string,
  params: Record<string, string | number>,
  cacheMs = 5 * 60 * 1000,
): Promise<T> {
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!apiKey) {
    throw new MovieServiceError(
      503,
      "movie_service_not_configured",
      "Il catalogo film non è ancora configurato. Aggiungi una chiave API TMDB nei Secrets del progetto.",
    );
  }

  const sortedParams = Object.entries(params).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const cacheKey = `${path}?${JSON.stringify(sortedParams)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value as T;

  const url = new URL(`${TMDB_BASE_URL}${path}`);
  url.searchParams.set("api_key", apiKey);
  for (const [key, value] of sortedParams) {
    url.searchParams.set(key, String(value));
  }

  let response: globalThis.Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  } catch {
    throw new MovieServiceError(
      502,
      "movie_catalog_unreachable",
      "Il catalogo non risponde. Riprova tra poco.",
    );
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new MovieServiceError(
        503,
        "movie_catalog_rate_limited",
        "Il catalogo è momentaneamente occupato. Riprova tra poco.",
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new MovieServiceError(
        503,
        "movie_service_credentials_invalid",
        "La configurazione del catalogo non è valida. Controlla la chiave TMDB nei Secrets del progetto.",
      );
    }
    throw new MovieServiceError(
      response.status === 404 ? 404 : 502,
      "movie_catalog_request_failed",
      "Non è stato possibile recuperare i dati del film.",
    );
  }

  const value = (await response.json()) as T;
  cache.set(cacheKey, { expiresAt: Date.now() + cacheMs, value });
  if (cache.size > 400) {
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= now || cache.size > 350) cache.delete(key);
    }
  }
  return value;
}

function respondWithError(
  req: Request,
  res: Response,
  error: unknown,
): void {
  const known =
    error instanceof MovieServiceError
      ? error
      : new MovieServiceError(
          502,
          "movie_catalog_request_failed",
          "Non è stato possibile recuperare i dati del film.",
        );
  req.log.warn(
    { status: known.status, code: known.code },
    "Movie catalog request failed",
  );
  const body: MovieErrorResponse = {
    error: known.message,
    code: known.code,
  };
  res.status(known.status).json(body);
}

function parseListResponse(
  payload: TmdbList<TmdbMovie>,
  excludeIds: number[] = [],
): {
  results: Movie[];
  page: number;
  totalPages: number;
  totalResults: number;
} {
  const excluded = new Set(excludeIds);
  return {
    results: (payload.results ?? [])
      .map(mapMovie)
      .filter((movie) => !excluded.has(movie.id)),
    page: payload.page ?? 1,
    totalPages: payload.total_pages ?? 0,
    totalResults: payload.total_results ?? 0,
  };
}

router.get("/movies/search", async (req, res): Promise<void> => {
  const parsed = SearchMoviesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Inserisci un titolo da cercare.",
      code: "invalid_search",
    } satisfies MovieErrorResponse);
    return;
  }
  const { query, page, region } = parsed.data;
  try {
    const payload = await getTmdb<TmdbList<TmdbMovie>>("/search/movie", {
      query,
      page: page ?? 1,
      language: "it-IT",
      region: (region ?? "IT").toUpperCase(),
      include_adult: "false",
    });
    res.json(SearchMoviesResponse.parse(parseListResponse(payload)));
  } catch (error) {
    respondWithError(req, res, error);
  }
});

router.get("/movies/providers", async (req, res): Promise<void> => {
  const parsed = ListMovieProvidersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "La regione indicata non è valida.",
      code: "invalid_region",
    } satisfies MovieErrorResponse);
    return;
  }
  const region = (parsed.data.region ?? "IT").toUpperCase();
  try {
    const payload = await getTmdb<{ results?: TmdbProvider[] }>(
      "/watch/providers/movie",
      { language: "it-IT", watch_region: region },
      12 * 60 * 60 * 1000,
    );
    const results = (payload.results ?? [])
      .map(mapProvider)
      .sort(
        (a, b) =>
          a.displayPriority - b.displayPriority || a.name.localeCompare(b.name),
      );
    res.json(
      ListMovieProvidersResponse.parse({
        region,
        results,
      }),
    );
  } catch (error) {
    respondWithError(req, res, error);
  }
});

router.get("/movies/recommendations", async (req, res): Promise<void> => {
  const parsed = GetMovieRecommendationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Le preferenze per i consigli non sono valide.",
      code: "invalid_recommendations",
    } satisfies MovieErrorResponse);
    return;
  }

  const {
    page,
    region: rawRegion,
    genreIds: rawGenreIds,
    providerIds: rawProviderIds,
    excludeIds: rawExcludeIds,
    taste,
  } = parsed.data;
  const region = (rawRegion ?? "IT").toUpperCase();
  const genres = [
    ...new Set([...parseIds(rawGenreIds), ...inferGenres(taste)]),
  ];
  const providers = parseIds(rawProviderIds);
  const excludeIds = parseIds(rawExcludeIds);
  const pageNumber = page ?? 1;
  const sorts = [
    "popularity.desc",
    "vote_average.desc",
    "revenue.desc",
    "primary_release_date.desc",
  ];
  const sortBy = sorts[(pageNumber - 1) % sorts.length] ?? "popularity.desc";
  const params: Record<string, string | number> = {
    language: "it-IT",
    region,
    include_adult: "false",
    sort_by: sortBy,
    page: pageNumber,
  };
  if (genres.length > 0) params.with_genres = genres.join(",");
  if (providers.length > 0) {
    params.with_watch_providers = providers.join("|");
    params.with_watch_monetization_types = "flatrate|free|ads";
  }
  if (sortBy === "vote_average.desc") params["vote_count.gte"] = 50;

  try {
    const payload = await getTmdb<TmdbList<TmdbMovie>>(
      "/discover/movie",
      params,
      3 * 60 * 1000,
    );
    res.json(
      GetMovieRecommendationsResponse.parse(
        parseListResponse(payload, excludeIds),
      ),
    );
  } catch (error) {
    respondWithError(req, res, error);
  }
});

router.get("/movies/availability", async (req, res): Promise<void> => {
  const parsed = GetMovieAvailabilityQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Il film richiesto non è valido.",
      code: "invalid_movie_id",
    } satisfies MovieErrorResponse);
    return;
  }

  const region = (parsed.data.region ?? "IT").toUpperCase();
  try {
    const payload = await getTmdb<TmdbAvailability>(
      `/movie/${parsed.data.movieId}/watch/providers`,
      {},
      6 * 60 * 60 * 1000,
    );
    const availability = payload.results?.[region];
    const providers = new Map<number, MovieProvider>();
    for (const provider of [
      ...(availability?.flatrate ?? []),
      ...(availability?.free ?? []),
      ...(availability?.ads ?? []),
    ]) {
      const mapped = mapProvider(provider);
      providers.set(mapped.id, mapped);
    }
    res.json(
      GetMovieAvailabilityResponse.parse({
        movieId: parsed.data.movieId,
        region,
        providers: [...providers.values()].sort(
          (a, b) =>
            a.displayPriority - b.displayPriority ||
            a.name.localeCompare(b.name),
        ),
        link: availability?.link ?? null,
      }),
    );
  } catch (error) {
    respondWithError(req, res, error);
  }
});

export default router;
