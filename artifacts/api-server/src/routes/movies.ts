import {
  GetDirectorDiscoveriesQueryParams,
  GetDirectorDiscoveriesResponse,
  GetMovieAvailabilityQueryParams,
  GetMovieAvailabilityResponse,
  GetMovieCreditsBatchQueryParams,
  GetMovieCreditsBatchResponse,
  GetMovieCreditsQueryParams,
  GetMovieCreditsResponse,
  GetMovieRecommendationsQueryParams,
  GetMovieRecommendationsResponse,
  ListMovieProvidersQueryParams,
  ListMovieProvidersResponse,
  MovieErrorResponse,
  SearchMoviesQueryParams,
  SearchMoviesResponse,
  type DirectorProfile,
  type DirectorRecommendation,
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
  vote_count?: number;
  genre_ids?: number[];
  original_language?: string;
};

type TmdbProvider = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority?: number;
};

type TmdbCreditPerson = {
  id: number;
  name?: string;
  profile_path?: string | null;
  order?: number;
  job?: string;
};

type TmdbCredits = {
  cast?: TmdbCreditPerson[];
  crew?: TmdbCreditPerson[];
};

type TmdbMovieDetails = TmdbMovie & {
  runtime?: number | null;
  credits?: TmdbCredits;
};

type TmdbPersonDetails = {
  name?: string;
  profile_path?: string | null;
};

type TmdbPersonMovieCredits = {
  crew?: Array<TmdbMovie & { job?: string }>;
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

type SimilarMovie = {
  movie: TmdbMovie;
  matchedSeeds: number;
  rankScore: number;
};

type WatchedPeople = {
  actorIds: number[];
  directorIds: number[];
};

type PersonDiscoverCandidate = {
  movie: TmdbMovie;
  matchedActors: boolean;
  matchedDirectors: boolean;
};

async function getSimilarMovies(
  seedMovieIds: number[],
  page: number,
): Promise<SimilarMovie[]> {
  const candidates = new Map<number, SimilarMovie>();
  const responses = await Promise.allSettled(
    seedMovieIds.slice(0, 4).map((movieId) =>
      getTmdb<TmdbList<TmdbMovie>>(
        `/movie/${movieId}/recommendations`,
        { language: "it-IT", page },
        12 * 60 * 60 * 1000,
      ),
    ),
  );

  for (const response of responses) {
    if (response.status !== "fulfilled") continue;
    for (const [index, movie] of (response.value.results ?? [])
      .slice(0, 20)
      .entries()) {
      const current = candidates.get(movie.id) ?? {
        movie,
        matchedSeeds: 0,
        rankScore: 0,
      };
      current.matchedSeeds += 1;
      current.rankScore += 1 / Math.log2(index + 2);
      candidates.set(movie.id, current);
    }
  }

  return [...candidates.values()].sort(
    (a, b) =>
      b.matchedSeeds - a.matchedSeeds ||
      b.rankScore - a.rankScore ||
      (b.movie.vote_average ?? 0) - (a.movie.vote_average ?? 0) ||
      (b.movie.vote_count ?? 0) - (a.movie.vote_count ?? 0),
  );
}

async function getWatchedPeople(seedMovieIds: number[]): Promise<WatchedPeople> {
  const actorWeights = new Map<number, number>();
  const directorWeights = new Map<number, number>();
  const responses = await Promise.allSettled(
    seedMovieIds.slice(0, 4).map((movieId) =>
      getTmdb<TmdbCredits>(
        `/movie/${movieId}/credits`,
        { language: "it-IT" },
        12 * 60 * 60 * 1000,
      ),
    ),
  );

  responses.forEach((response, seedIndex) => {
    if (response.status !== "fulfilled") return;
    const recencyWeight = 1 / (1 + seedIndex * 0.35);
    const credits = response.value;

    (credits.cast ?? []).slice(0, 8).forEach((person, rank) => {
      const castOrder = person.order ?? rank;
      const weight = recencyWeight / (1 + castOrder * 0.12);
      actorWeights.set(person.id, (actorWeights.get(person.id) ?? 0) + weight);
    });

    (credits.crew ?? [])
      .filter((person) => person.job === "Director")
      .slice(0, 2)
      .forEach((person, rank) => {
        const weight = recencyWeight * (1.5 / (1 + rank * 0.2));
        directorWeights.set(
          person.id,
          (directorWeights.get(person.id) ?? 0) + weight,
        );
      });
  });

  const topPeople = (weights: Map<number, number>, limit: number) =>
    [...weights.entries()]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, limit)
      .map(([personId]) => personId);

  return {
    actorIds: topPeople(actorWeights, 5),
    directorIds: topPeople(directorWeights, 3),
  };
}

async function getPersonDiscoverAtQuality(
  people: WatchedPeople,
  params: Record<string, string | number>,
  page: number,
  minRating: number,
  minVoteCount: number,
): Promise<PersonDiscoverCandidate[]> {
  const requestFor = (
    ids: number[],
    filter: "with_cast" | "with_crew",
  ): Promise<TmdbList<TmdbMovie>> =>
    ids.length === 0
      ? Promise.resolve({ results: [] })
      : getTmdb<TmdbList<TmdbMovie>>(
          "/discover/movie",
          {
            ...params,
            [filter]: ids.join("|"),
            "vote_average.gte": minRating,
            "vote_count.gte": minVoteCount,
            page,
          },
          3 * 60 * 1000,
        );

  const [castResults, crewResults] = await Promise.all([
    requestFor(people.actorIds, "with_cast"),
    requestFor(people.directorIds, "with_crew"),
  ]);
  const candidates = new Map<number, PersonDiscoverCandidate>();

  for (const movie of castResults.results ?? []) {
    candidates.set(movie.id, {
      movie,
      matchedActors: true,
      matchedDirectors: false,
    });
  }
  for (const movie of crewResults.results ?? []) {
    const candidate = candidates.get(movie.id);
    if (candidate) {
      candidate.matchedDirectors = true;
    } else {
      candidates.set(movie.id, {
        movie,
        matchedActors: false,
        matchedDirectors: true,
      });
    }
  }

  return [...candidates.values()];
}

async function getPersonDiscoverCandidates(
  people: WatchedPeople,
  params: Record<string, string | number>,
  page: number,
): Promise<PersonDiscoverCandidate[]> {
  if (people.actorIds.length === 0 && people.directorIds.length === 0) {
    return [];
  }

  const preferred = await getPersonDiscoverAtQuality(
    people,
    params,
    page,
    7,
    100,
  );
  if (preferred.length >= 20) return preferred;

  const relaxed = await getPersonDiscoverAtQuality(
    people,
    params,
    page,
    6.5,
    50,
  );
  const candidates = new Map<number, PersonDiscoverCandidate>();
  for (const candidate of [...preferred, ...relaxed]) {
    const existing = candidates.get(candidate.movie.id);
    if (existing) {
      existing.matchedActors ||= candidate.matchedActors;
      existing.matchedDirectors ||= candidate.matchedDirectors;
    } else {
      candidates.set(candidate.movie.id, candidate);
    }
  }

  return [...candidates.values()];
}

async function getAvailableSimilarMovies(
  candidates: SimilarMovie[],
  region: string,
  selectedProviderIds: number[],
  excludeIds: number[],
  minRating: number,
  minVoteCount: number,
  maxChecks: number,
  checkedIds: Set<number>,
): Promise<SimilarMovie[]> {
  const excluded = new Set(excludeIds);
  const providerIds = new Set(selectedProviderIds);
  const eligible = candidates.filter(
    ({ movie }) =>
      !excluded.has(movie.id) &&
      !checkedIds.has(movie.id) &&
      (movie.vote_average ?? 0) >= minRating &&
      (movie.vote_count ?? 0) >= minVoteCount,
  );
  const available: SimilarMovie[] = [];

  for (
    let offset = 0;
    offset < eligible.length &&
    offset < maxChecks &&
    available.length < 20;
    offset += 4
  ) {
    const batch = eligible.slice(offset, Math.min(offset + 4, maxChecks));
    for (const candidate of batch) checkedIds.add(candidate.movie.id);
    const responses = await Promise.allSettled(
      batch.map(({ movie }) =>
        getTmdb<TmdbAvailability>(
          `/movie/${movie.id}/watch/providers`,
          {},
          6 * 60 * 60 * 1000,
        ),
      ),
    );

    responses.forEach((response, index) => {
      if (response.status !== "fulfilled") return;
      const availability = response.value.results?.[region];
      const availableOnSelectedProvider = [
        ...(availability?.flatrate ?? []),
        ...(availability?.free ?? []),
        ...(availability?.ads ?? []),
      ].some((provider) => providerIds.has(provider.provider_id));
      if (availableOnSelectedProvider) available.push(batch[index]);
    });
  }

  return available;
}

type DirectorCandidate = {
  id: number;
  source: DirectorRecommendation["source"];
  profile?: DirectorProfile;
};

async function loadDirectorPicks(
  candidates: DirectorCandidate[],
  region: string,
  providerIds: number[],
  excludeMovieIds: number[],
): Promise<DirectorRecommendation[]> {
  const hydrated = await Promise.all(
    candidates.map(async (candidate) => {
      const [personResult, movieCreditsResult] = await Promise.allSettled([
        candidate.profile
          ? Promise.resolve(null)
          : getTmdb<TmdbPersonDetails>(
              `/person/${candidate.id}`,
              { language: "it-IT" },
              12 * 60 * 60 * 1000,
            ),
        getTmdb<TmdbPersonMovieCredits>(
          `/person/${candidate.id}/movie_credits`,
          { language: "it-IT" },
          12 * 60 * 60 * 1000,
        ),
      ]);

      const person =
        personResult.status === "fulfilled" ? personResult.value : null;
      const director =
        candidate.profile ??
        (person?.name?.trim()
          ? {
              id: candidate.id,
              name: person.name.trim(),
              profilePath: person.profile_path ?? null,
            }
          : null);
      if (!director || movieCreditsResult.status !== "fulfilled") return null;

      const uniqueMovies = new Map<number, TmdbMovie>();
      for (const movie of movieCreditsResult.value.crew ?? []) {
        if (
          movie.job === "Director" &&
          (movie.vote_average ?? 0) >= 7 &&
          (movie.vote_count ?? 0) >= 100
        ) {
          uniqueMovies.set(movie.id, movie);
        }
      }

      const movies = [...uniqueMovies.values()]
        .sort(
          (a, b) =>
            (b.vote_average ?? 0) - (a.vote_average ?? 0) ||
            (b.vote_count ?? 0) - (a.vote_count ?? 0),
        )
        .map((movie, index) => ({
          movie,
          matchedSeeds: 0,
          rankScore: 1 / (index + 1),
        }));

      return { director, source: candidate.source, movies };
    }),
  );

  const selectedMovieIds = new Set(excludeMovieIds);
  const picks: DirectorRecommendation[] = [];
  for (const item of hydrated) {
    if (!item) continue;
    const checkedIds = new Set<number>();
    let available = await getAvailableSimilarMovies(
      item.movies,
      region,
      providerIds,
      [...selectedMovieIds],
      7,
      100,
      8,
      checkedIds,
    );
    if (available.length < 2) {
      const additional = await getAvailableSimilarMovies(
        item.movies,
        region,
        providerIds,
        [...selectedMovieIds],
        7,
        100,
        16,
        checkedIds,
      );
      available = [...available, ...additional];
    }

    const movies = available.slice(0, 2).map(({ movie }) => mapMovie(movie));
    movies.forEach((movie) => selectedMovieIds.add(movie.id));
    picks.push({ director: item.director, source: item.source, movies });
  }
  return picks;
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
    seedMovieIds: rawSeedMovieIds,
    excludeIds: rawExcludeIds,
    taste,
  } = parsed.data;
  const region = (rawRegion ?? "IT").toUpperCase();
  const genres = [
    ...new Set([...parseIds(rawGenreIds), ...inferGenres(taste)]),
  ];
  const providers = parseIds(rawProviderIds);
  const seedMovieIds = parseIds(rawSeedMovieIds).slice(0, 4);
  const excludeIds = parseIds(rawExcludeIds);
  const pageNumber = page ?? 1;

  if (providers.length === 0) {
    res.status(400).json({
      error: "Seleziona almeno una piattaforma per ricevere consigli.",
      code: "streaming_provider_required",
    } satisfies MovieErrorResponse);
    return;
  }

  const providerParams: Record<string, string | number> = {
    language: "it-IT",
    region,
    include_adult: "false",
    sort_by: "vote_average.desc",
    with_watch_providers: providers.join("|"),
    with_watch_monetization_types: "flatrate|free|ads",
    watch_region: region,
  };
  const params: Record<string, string | number> = {
    ...providerParams,
    "vote_average.gte": 7,
    "vote_count.gte": 100,
  };
  if (genres.length > 0) params.with_genres = genres.join("|");

  try {
    const discoveryPagePromise = getTmdb<TmdbList<TmdbMovie>>(
      "/discover/movie",
      { ...params, page: pageNumber },
      3 * 60 * 1000,
    );
    const similarMoviesPromise = getSimilarMovies(seedMovieIds, pageNumber);
    const watchedPeoplePromise = getWatchedPeople(seedMovieIds);
    const [discoveryPage, similarMovies, watchedPeople] = await Promise.all([
      discoveryPagePromise,
      similarMoviesPromise,
      watchedPeoplePromise,
    ]);
    const checkedSimilarIds = new Set<number>();
    const [relatedMovies, personCandidates] = await Promise.all([
      getAvailableSimilarMovies(
        similarMovies,
        region,
        providers,
        excludeIds,
        7,
        100,
        32,
        checkedSimilarIds,
      ),
      getPersonDiscoverCandidates(watchedPeople, providerParams, pageNumber),
    ]);
    const relaxedRelatedMovies =
      relatedMovies.length < 20
        ? await getAvailableSimilarMovies(
            similarMovies,
            region,
            providers,
            excludeIds,
            6.5,
            50,
            32,
            checkedSimilarIds,
          )
        : [];
    type ScoredMovie = {
      movie: Movie;
      matchedSeeds: number;
      rankScore: number;
      matchedActors: boolean;
      matchedDirectors: boolean;
      voteCount: number;
    };
    const movieResults = new Map<number, ScoredMovie>();
    let totalPages = discoveryPage.total_pages ?? 0;
    let totalResults = discoveryPage.total_results ?? 0;
    const excluded = new Set(excludeIds);

    const addMovie = (
      movie: TmdbMovie,
      signals: {
        matchedSeeds?: number;
        rankScore?: number;
        matchedActors?: boolean;
        matchedDirectors?: boolean;
      } = {},
    ) => {
      if (excluded.has(movie.id)) return;
      const current = movieResults.get(movie.id);
      if (current) {
        current.matchedSeeds = Math.max(
          current.matchedSeeds,
          signals.matchedSeeds ?? 0,
        );
        current.rankScore = Math.max(
          current.rankScore,
          signals.rankScore ?? 0,
        );
        current.matchedActors ||= signals.matchedActors ?? false;
        current.matchedDirectors ||= signals.matchedDirectors ?? false;
        return;
      }
      movieResults.set(movie.id, {
        movie: mapMovie(movie),
        matchedSeeds: signals.matchedSeeds ?? 0,
        rankScore: signals.rankScore ?? 0,
        matchedActors: signals.matchedActors ?? false,
        matchedDirectors: signals.matchedDirectors ?? false,
        voteCount: movie.vote_count ?? 0,
      });
    };

    for (const candidate of [...relatedMovies, ...relaxedRelatedMovies]) {
      addMovie(candidate.movie, {
        matchedSeeds: candidate.matchedSeeds,
        rankScore: candidate.rankScore,
      });
    }
    for (const candidate of personCandidates) {
      addMovie(candidate.movie, {
        matchedActors: candidate.matchedActors,
        matchedDirectors: candidate.matchedDirectors,
      });
    }

    const qualityLevels = [
      { "vote_average.gte": 7, "vote_count.gte": 100 },
      { "vote_average.gte": 6.5, "vote_count.gte": 50 },
    ];
    for (const [qualityIndex, quality] of qualityLevels.entries()) {
      if (movieResults.size >= 20) break;
      const qualityParams = { ...params, ...quality };
      const lastPageToScan = Math.min(500, pageNumber + 2);

      for (
        let scanPage = pageNumber;
        scanPage <= lastPageToScan && movieResults.size < 20;
        scanPage += 1
      ) {
        const payload =
          qualityIndex === 0 && scanPage === pageNumber
            ? discoveryPage
            : await getTmdb<TmdbList<TmdbMovie>>(
                "/discover/movie",
                { ...qualityParams, page: scanPage },
                3 * 60 * 1000,
              );
        totalPages = payload.total_pages ?? 0;
        totalResults = payload.total_results ?? 0;

        for (const movie of payload.results ?? []) {
          addMovie(movie);
        }

        if (scanPage >= totalPages) break;
      }

      if (
        movieResults.size >= 20 ||
        (totalResults === 0 && qualityIndex === 1)
      ) {
        break;
      }
    }

    const rankedMovies = [...movieResults.values()];
    const combinedScore = (item: ScoredMovie) => {
      const seedAffinity = Math.min(
        1,
        (item.matchedSeeds / 4) * 0.65 + (item.rankScore / 4) * 0.35,
      );
      const artistAffinity =
        (item.matchedActors ? 0.5 : 0) +
        (item.matchedDirectors ? 0.5 : 0);
      return (
        (item.movie.voteAverage / 10) * 0.5 +
        seedAffinity * 0.25 +
        artistAffinity * 0.25
      );
    };
    rankedMovies.sort(
      (a, b) =>
        combinedScore(b) - combinedScore(a) ||
        Number(b.matchedDirectors) - Number(a.matchedDirectors) ||
        Number(b.matchedActors) - Number(a.matchedActors) ||
        b.matchedSeeds - a.matchedSeeds ||
        b.rankScore - a.rankScore ||
        b.movie.voteAverage - a.movie.voteAverage ||
        b.voteCount - a.voteCount,
    );

    res.json(
      GetMovieRecommendationsResponse.parse(
        {
          results: rankedMovies.slice(0, 20).map((item) => item.movie),
          page: pageNumber,
          totalPages,
          totalResults,
        },
      ),
    );
  } catch (error) {
    respondWithError(req, res, error);
  }
});

router.get("/movies/director-discoveries", async (req, res): Promise<void> => {
  const parsed = GetDirectorDiscoveriesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Le preferenze per i registi non sono valide.",
      code: "invalid_director_discoveries",
    } satisfies MovieErrorResponse);
    return;
  }

  const region = (parsed.data.region ?? "IT").toUpperCase();
  const providerIds = parseIds(parsed.data.providerIds);
  if (providerIds.length === 0) {
    res.status(400).json({
      error: "Seleziona almeno una piattaforma per scoprire i registi.",
      code: "streaming_provider_required",
    } satisfies MovieErrorResponse);
    return;
  }

  const watchedMovieIds = parseIds(parsed.data.watchedMovieIds);
  const followedDirectorIds = parseIds(parsed.data.followedDirectorIds).slice(0, 4);
  const excludedMovieIds = [
    ...new Set([
      ...watchedMovieIds,
      ...parseIds(parsed.data.excludeMovieIds),
    ]),
  ];
  const discoverParams: Record<string, string | number> = {
    language: "it-IT",
    region,
    watch_region: region,
    include_adult: "false",
    sort_by: "vote_average.desc",
    "vote_average.gte": 7,
    "vote_count.gte": 300,
    with_watch_providers: providerIds.join("|"),
    with_watch_monetization_types: "flatrate|free|ads",
  };

  try {
    const [watchedPeople, popularMovies] = await Promise.all([
      getWatchedPeople(watchedMovieIds.slice(0, 4)),
      getTmdb<TmdbList<TmdbMovie>>(
        "/discover/movie",
        { ...discoverParams, page: 1 },
        30 * 60 * 1000,
      ),
    ]);

    const personalizedCandidates: DirectorCandidate[] = [];
    const usedDirectorIds = new Set<number>();
    for (const id of followedDirectorIds) {
      if (usedDirectorIds.has(id)) continue;
      usedDirectorIds.add(id);
      personalizedCandidates.push({ id, source: "followed" });
    }
    for (const id of watchedPeople.directorIds) {
      if (personalizedCandidates.length >= 4) break;
      if (usedDirectorIds.has(id)) continue;
      usedDirectorIds.add(id);
      personalizedCandidates.push({ id, source: "watched" });
    }

    const popularDirectorProfiles = new Map<number, DirectorProfile>();
    const popularMovieCandidates = (popularMovies.results ?? []).slice(0, 12);
    for (let offset = 0; offset < popularMovieCandidates.length; offset += 4) {
      const movieBatch = popularMovieCandidates.slice(offset, offset + 4);
      const creditResponses = await Promise.allSettled(
        movieBatch.map((movie) =>
          getTmdb<TmdbCredits>(
            `/movie/${movie.id}/credits`,
            { language: "it-IT" },
            12 * 60 * 60 * 1000,
          ),
        ),
      );
      creditResponses.forEach((response) => {
        if (response.status !== "fulfilled") return;
        for (const person of response.value.crew ?? []) {
          if (
            person.job !== "Director" ||
            !person.name?.trim() ||
            usedDirectorIds.has(person.id) ||
            popularDirectorProfiles.has(person.id)
          ) {
            continue;
          }
          popularDirectorProfiles.set(person.id, {
            id: person.id,
            name: person.name.trim(),
            profilePath: person.profile_path ?? null,
          });
        }
      });
      if (popularDirectorProfiles.size >= 6) break;
    }

    const discoverCandidates: DirectorCandidate[] = [
      ...popularDirectorProfiles.values(),
    ]
      .slice(0, 4)
      .map((profile) => ({
        id: profile.id,
        source: "popular" as const,
        profile,
      }));

    const picks = await loadDirectorPicks(
      [...personalizedCandidates, ...discoverCandidates],
      region,
      providerIds,
      excludedMovieIds,
    );
    res.json(
      GetDirectorDiscoveriesResponse.parse({
        personalized: picks.filter(
          (pick) => pick.source !== "popular" && (pick.source === "followed" || pick.movies.length > 0),
        ),
        discover: picks.filter(
          (pick) => pick.source === "popular" && pick.movies.length > 0,
        ),
      }),
    );
  } catch (error) {
    respondWithError(req, res, error);
  }
});

async function loadMovieCredits(movieId: number) {
  const details = await getTmdb<TmdbMovieDetails>(
    `/movie/${movieId}`,
    { language: "it-IT", append_to_response: "credits" },
    12 * 60 * 60 * 1000,
  );
  const credits = details.credits ?? {};
  const directors = [
    ...new Set(
      (credits.crew ?? [])
        .filter((person) => person.job === "Director")
        .map((person) => person.name?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ].slice(0, 2);
  const cast = (credits.cast ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .map((person) => person.name?.trim())
    .filter((name): name is string => Boolean(name))
    .slice(0, 5);
  const runtime =
    typeof details.runtime === "number" &&
    Number.isInteger(details.runtime) &&
    details.runtime > 0
      ? details.runtime
      : null;

  return GetMovieCreditsResponse.parse({ movieId, directors, cast, runtime });
}

router.get("/movies/credits/batch", async (req, res): Promise<void> => {
  const parsed = GetMovieCreditsBatchQueryParams.safeParse(req.query);
  const rawMovieIds = parsed.success
    ? parsed.data.movieIds.split(",").map((value) => Number(value.trim()))
    : [];
  if (
    !parsed.success ||
    rawMovieIds.length === 0 ||
    rawMovieIds.length > 20 ||
    rawMovieIds.some((movieId) => !Number.isSafeInteger(movieId) || movieId < 1)
  ) {
    res.status(400).json({
      error: "Inserisci da 1 a 20 ID film validi.",
      code: "invalid_movie_ids",
    } satisfies MovieErrorResponse);
    return;
  }

  try {
    const movieIds = [...new Set(rawMovieIds)];
    const results: Awaited<ReturnType<typeof loadMovieCredits>>[] = [];
    for (let index = 0; index < movieIds.length; index += 6) {
      const batch = await Promise.all(
        movieIds
          .slice(index, index + 6)
          .map((movieId) => loadMovieCredits(movieId)),
      );
      results.push(...batch);
    }
    res.json(GetMovieCreditsBatchResponse.parse({ results }));
  } catch (error) {
    respondWithError(req, res, error);
  }
});

router.get("/movies/credits", async (req, res): Promise<void> => {
  const parsed = GetMovieCreditsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Il film richiesto non è valido.",
      code: "invalid_movie_id",
    } satisfies MovieErrorResponse);
    return;
  }

  try {
    res.json(await loadMovieCredits(parsed.data.movieId));
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
