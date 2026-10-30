import type {
  DirectorDiscoveriesResponse,
  DirectorProfile,
  DirectorRecommendation,
  HealthStatus,
  Movie,
  MovieAvailabilityResponse,
  MovieCreditsBatchResponse,
  MovieCreditsResponse,
  MovieErrorResponse,
  MovieProvider,
  MovieProviderListResponse,
  MovieSearchResponse,
} from "./generated/api.schemas";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const cache = new Map<string, { expiresAt: number; value: unknown }>();

let inMemoryTmdbKey: string | null = null;

export function setTmdbApiKey(key: string | null): void {
  inMemoryTmdbKey = key ? key.trim() : null;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      if (key && key.trim()) {
        window.localStorage.setItem("TMDB_API_KEY", key.trim());
      } else {
        window.localStorage.removeItem("TMDB_API_KEY");
      }
    }
  } catch {
    // Ignore storage errors in restricted iframe environments
  }
}

export function getTmdbApiKey(): string | null {
  if (inMemoryTmdbKey) return inMemoryTmdbKey;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = window.localStorage.getItem("TMDB_API_KEY");
      if (stored && stored.trim()) return stored.trim();
    }
  } catch {
    // Ignore storage errors
  }
  const globalObj = globalThis as unknown as {
    process?: { env?: Record<string, string | undefined> };
  };
  if (globalObj.process?.env?.EXPO_PUBLIC_TMDB_API_KEY) {
    return globalObj.process.env.EXPO_PUBLIC_TMDB_API_KEY.trim();
  }
  return null;
}

export class ClientMovieError extends Error {
  readonly status: number;
  readonly code: string;
  readonly data: MovieErrorResponse;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = { error: message, code };
  }
}

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

function parseIds(value?: string | number[] | null): number[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [
    ...new Set(value.split(",").map((part) => Number(part.trim()))),
  ].filter((id) => Number.isInteger(id) && id > 0);
}

function rotateItems<T>(items: readonly T[], offset: number): T[] {
  if (items.length === 0) return [];
  const start = offset % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
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

type DirectorCandidate = {
  id: number;
  source: DirectorRecommendation["source"];
  profile?: DirectorProfile;
};

async function getTmdb<T>(
  path: string,
  params: Record<string, string | number>,
  cacheMs = 5 * 60 * 1000,
): Promise<T> {
  const apiKey = getTmdbApiKey();
  if (!apiKey) {
    throw new ClientMovieError(
      503,
      "movie_service_not_configured",
      "Il catalogo film non è ancora configurato. Inserisci la tua chiave API TMDB nelle impostazioni del profilo.",
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

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new ClientMovieError(
      502,
      "movie_catalog_unreachable",
      "Il catalogo TMDB non risponde. Verifica la connessione e riprova tra poco.",
    );
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new ClientMovieError(
        503,
        "movie_catalog_rate_limited",
        "TMDB sta limitando temporaneamente le richieste. Attendi qualche secondo e riprova.",
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new ClientMovieError(
        503,
        "movie_service_credentials_invalid",
        "La chiave TMDB inserita non è valida. Controlla la chiave nelle impostazioni del profilo.",
      );
    }
    throw new ClientMovieError(
      response.status === 404 ? 404 : 502,
      "movie_catalog_request_failed",
      "Non è stato possibile recuperare i dati del film da TMDB.",
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

function parseListResponse(
  payload: TmdbList<TmdbMovie>,
  excludeIds: number[] = [],
): MovieSearchResponse {
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

async function getSimilarMovies(
  seedMovieIds: number[],
  page: number,
): Promise<SimilarMovie[]> {
  const candidates = new Map<number, SimilarMovie>();
  const responses = await Promise.allSettled(
    seedMovieIds
      .slice(0, 4)
      .map((movieId) =>
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

async function getWatchedPeople(
  seedMovieIds: number[],
  options: {
    maxSeedMovies?: number;
    maxActors?: number;
    maxDirectors?: number;
  } = {},
): Promise<WatchedPeople> {
  const { maxSeedMovies = 4, maxActors = 5, maxDirectors = 3 } = options;
  const actorWeights = new Map<number, number>();
  const directorWeights = new Map<number, number>();
  const responses = await Promise.allSettled(
    seedMovieIds
      .slice(0, maxSeedMovies)
      .map((movieId) =>
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
    actorIds: topPeople(actorWeights, maxActors),
    directorIds: topPeople(directorWeights, maxDirectors),
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

async function filterMoviesOnSelectedProviders<T extends { movie: Movie }>(
  items: T[],
  region: string,
  selectedProviderIds: number[],
  limit: number,
): Promise<T[]> {
  const providerIds = new Set(selectedProviderIds);
  const verified: T[] = [];
  for (
    let offset = 0;
    offset < items.length && verified.length < limit;
    offset += 6
  ) {
    const batch = items.slice(offset, offset + 6);
    const responses = await Promise.allSettled(
      batch.map((item) =>
        getTmdb<TmdbAvailability>(
          `/movie/${item.movie.id}/watch/providers`,
          {},
          6 * 60 * 60 * 1000,
        ),
      ),
    );
    responses.forEach((response, index) => {
      if (response.status !== "fulfilled") return;
      const availability = response.value.results?.[region];
      const onSelected = [
        ...(availability?.flatrate ?? []),
        ...(availability?.free ?? []),
        ...(availability?.ads ?? []),
      ].some((provider) => providerIds.has(provider.provider_id));
      if (onSelected) verified.push(batch[index]);
    });
  }
  return verified.slice(0, limit);
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
    offset < eligible.length && offset < maxChecks && available.length < 20;
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

async function getSimilarDirectorCandidates(
  people: WatchedPeople,
  params: Record<string, string | number>,
  page: number,
  excludedDirectorIds: Set<number>,
  excludedMovieIds: Set<number>,
  limit: number,
): Promise<DirectorCandidate[]> {
  if (people.actorIds.length === 0 && people.directorIds.length === 0) {
    return [];
  }

  const movieCandidates = (
    await getPersonDiscoverCandidates(people, params, page)
  )
    .filter(
      ({ movie }) =>
        !excludedMovieIds.has(movie.id) &&
        (movie.vote_average ?? 0) >= 7 &&
        (movie.vote_count ?? 0) >= 100,
    )
    .sort(
      (a, b) =>
        Number(b.matchedDirectors) - Number(a.matchedDirectors) ||
        Number(b.matchedActors) - Number(a.matchedActors) ||
        (b.movie.vote_average ?? 0) - (a.movie.vote_average ?? 0) ||
        (b.movie.vote_count ?? 0) - (a.movie.vote_count ?? 0),
    )
    .slice(0, 20);
  const directorScores = new Map<
    number,
    { profile: DirectorProfile; score: number; matches: number }
  >();

  for (let offset = 0; offset < movieCandidates.length; offset += 4) {
    const batch = movieCandidates.slice(offset, offset + 4);
    const responses = await Promise.allSettled(
      batch.map(({ movie }) =>
        getTmdb<TmdbCredits>(
          `/movie/${movie.id}/credits`,
          { language: "it-IT" },
          12 * 60 * 60 * 1000,
        ),
      ),
    );

    responses.forEach((response, index) => {
      if (response.status !== "fulfilled") return;
      const candidate = batch[index];
      const positionWeight = 1 / Math.log2(offset + index + 2);
      const affinityWeight =
        (candidate.matchedActors ? 1.5 : 1) *
        (candidate.matchedDirectors ? 1.5 : 1);
      for (const person of response.value.crew ?? []) {
        if (
          person.job !== "Director" ||
          !person.name?.trim() ||
          excludedDirectorIds.has(person.id)
        ) {
          continue;
        }
        const current = directorScores.get(person.id) ?? {
          profile: {
            id: person.id,
            name: person.name.trim(),
            profilePath: person.profile_path ?? null,
          },
          score: 0,
          matches: 0,
        };
        current.score += positionWeight * affinityWeight;
        current.matches += 1;
        directorScores.set(person.id, current);
      }
    });
  }

  return [...directorScores.values()]
    .sort((a, b) => b.score - a.score || b.matches - a.matches)
    .slice(0, limit)
    .map(({ profile }) => ({
      id: profile.id,
      source: "similar",
      profile,
    }));
}

async function loadDirectorPicks(
  candidates: DirectorCandidate[],
  region: string,
  providerIds: number[],
  excludeMovieIds: number[],
  rotation: number,
): Promise<DirectorRecommendation[]> {
  const maxMoviesPerDirector = 4;
  type HydratedDirectorPick = {
    director: DirectorProfile;
    source: DirectorRecommendation["source"];
    movies: SimilarMovie[];
  };
  const hydrated: Array<HydratedDirectorPick | null> = [];
  for (let offset = 0; offset < candidates.length; offset += 4) {
    const batch = await Promise.all(
      candidates.slice(offset, offset + 4).map(async (candidate) => {
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

        const rankedMovies = [...uniqueMovies.values()].sort(
          (a, b) =>
            (b.vote_average ?? 0) - (a.vote_average ?? 0) ||
            (b.vote_count ?? 0) - (a.vote_count ?? 0),
        );
        const startIndex =
          rankedMovies.length > 0 ? (rotation * 2) % rankedMovies.length : 0;
        const rotatedMovies = [
          ...rankedMovies.slice(startIndex),
          ...rankedMovies.slice(0, startIndex),
        ];
        const movies = rotatedMovies.map((movie, index) => ({
          movie,
          matchedSeeds: 0,
          rankScore: 1 / (index + 1),
        }));

        return { director, source: candidate.source, movies };
      }),
    );
    hydrated.push(...batch);
  }

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
      12,
      checkedIds,
    );
    if (available.length < maxMoviesPerDirector) {
      const additional = await getAvailableSimilarMovies(
        item.movies,
        region,
        providerIds,
        [...selectedMovieIds],
        7,
        100,
        12,
        checkedIds,
      );
      available = [...available, ...additional];
    }

    const movies = available
      .slice(0, maxMoviesPerDirector)
      .map(({ movie }) => mapMovie(movie));
    movies.forEach((movie) => selectedMovieIds.add(movie.id));
    picks.push({ director: item.director, source: item.source, movies });
  }
  return picks;
}

export type DirectorFilmography = {
  director: DirectorProfile;
  movies: Movie[];
};

export async function loadDirectorFilmography(
  directorId: number,
): Promise<DirectorFilmography> {
  const [person, credits] = await Promise.all([
    getTmdb<TmdbPersonDetails>(
      `/person/${directorId}`,
      { language: "it-IT" },
      12 * 60 * 60 * 1000,
    ),
    getTmdb<TmdbPersonMovieCredits>(
      `/person/${directorId}/movie_credits`,
      { language: "it-IT" },
      12 * 60 * 60 * 1000,
    ),
  ]);
  const unique = new Map<number, TmdbMovie>();
  for (const movie of credits.crew ?? []) {
    if (movie.job === "Director" && movie.title?.trim()) {
      unique.set(movie.id, movie);
    }
  }
  const movies = [...unique.values()]
    .sort((a, b) => {
      const dateA = a.release_date || "0000";
      const dateB = b.release_date || "0000";
      return dateB.localeCompare(dateA);
    })
    .slice(0, 80)
    .map(mapMovie);
  return {
    director: {
      id: directorId,
      name: person.name?.trim() || "Regista",
      profilePath: person.profile_path ?? null,
    },
    movies,
  };
}

export async function loadMovieCredits(
  movieId: number,
): Promise<MovieCreditsResponse> {
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

  return { movieId, directors, cast, runtime };
}

export async function handleClientApiRequest(
  urlPath: string,
): Promise<unknown> {
  const url = new URL(urlPath, "https://local-app.internal");
  const path = url.pathname;
  const searchParams = url.searchParams;

  if (path === "/api/healthz") {
    const result: HealthStatus = { status: "ok" };
    return result;
  }

  if (path === "/api/movies/search") {
    const query = searchParams.get("query")?.trim();
    if (!query) {
      throw new ClientMovieError(400, "invalid_search", "Inserisci un titolo da cercare.");
    }
    const page = searchParams.has("page") ? Number(searchParams.get("page")) : 1;
    const region = (searchParams.get("region") ?? "IT").toUpperCase();
    const payload = await getTmdb<TmdbList<TmdbMovie>>("/search/movie", {
      query,
      page,
      language: "it-IT",
      region,
      include_adult: "false",
    });
    return parseListResponse(payload);
  }

  if (path === "/api/movies/providers") {
    const region = (searchParams.get("region") ?? "IT").toUpperCase();
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
    const result: MovieProviderListResponse = { region, results };
    return result;
  }

  if (path === "/api/movies/recommendations") {
    const pageNumber = searchParams.has("page") ? Number(searchParams.get("page")) : 1;
    const region = (searchParams.get("region") ?? "IT").toUpperCase();
    const taste = searchParams.get("taste") ?? undefined;
    const genres = [
      ...new Set([...parseIds(searchParams.get("genreIds")), ...inferGenres(taste)]),
    ];
    const providers = parseIds(searchParams.get("providerIds"));
    const seedMovieIds = parseIds(searchParams.get("seedMovieIds")).slice(0, 4);
    const excludeIds = parseIds(searchParams.get("excludeIds"));

    if (providers.length === 0) {
      throw new ClientMovieError(
        400,
        "streaming_provider_required",
        "Seleziona almeno una piattaforma per ricevere consigli.",
      );
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
        current.rankScore = Math.max(current.rankScore, signals.rankScore ?? 0);
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
        (item.matchedActors ? 0.5 : 0) + (item.matchedDirectors ? 0.5 : 0);
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

    // Doppio controllo: TMDB discover a volte include film non realmente
    // disponibili sulle piattaforme scelte, quindi verifichiamo ogni film.
    const verifiedMovies = await filterMoviesOnSelectedProviders(
      rankedMovies,
      region,
      providers,
      20,
    );

    const response: MovieSearchResponse = {
      results: verifiedMovies.map((item) => item.movie),
      page: pageNumber,
      totalPages,
      totalResults,
    };
    return response;
  }

  if (path === "/api/movies/director-discoveries") {
    const region = (searchParams.get("region") ?? "IT").toUpperCase();
    const providerIds = parseIds(searchParams.get("providerIds"));
    const rotation = searchParams.has("rotation") ? Number(searchParams.get("rotation")) : 0;
    const discoveryPage = (rotation % 5) + 1;
    if (providerIds.length === 0) {
      throw new ClientMovieError(
        400,
        "streaming_provider_required",
        "Seleziona almeno una piattaforma per scoprire i registi.",
      );
    }

    const watchedMovieIds = parseIds(searchParams.get("watchedMovieIds"));
    const followedDirectorIds = parseIds(searchParams.get("followedDirectorIds"));
    const excludedMovieIds = [
      ...new Set([...watchedMovieIds, ...parseIds(searchParams.get("excludeMovieIds"))]),
    ];
    const discoverParams: Record<string, string | number> = {
      language: "it-IT",
      region,
      watch_region: region,
      include_adult: "false",
      sort_by: "popularity.desc",
      "vote_average.gte": 7.2,
      "vote_count.gte": 1000,
      with_watch_providers: providerIds.join("|"),
      with_watch_monetization_types: "flatrate|free|ads",
    };

    const [watchedPeople, popularMovies] = await Promise.all([
      getWatchedPeople(watchedMovieIds.slice(0, 16), {
        maxSeedMovies: 16,
        maxActors: 8,
        maxDirectors: 8,
      }),
      getTmdb<TmdbList<TmdbMovie>>(
        "/discover/movie",
        { ...discoverParams, page: discoveryPage },
        30 * 60 * 1000,
      ),
    ]);

    const usedDirectorIds = new Set<number>();
    const followedCandidates = rotateItems(followedDirectorIds, rotation)
      .slice(0, 4)
      .map((id) => ({ id, source: "followed" as const }));
    for (const candidate of followedCandidates) {
      usedDirectorIds.add(candidate.id);
    }

    const watchedCandidates = rotateItems(
      watchedPeople.directorIds.filter((id) => !usedDirectorIds.has(id)),
      rotation,
    )
      .slice(0, 5)
      .map((id) => ({ id, source: "watched" as const }));
    for (const candidate of watchedCandidates) {
      usedDirectorIds.add(candidate.id);
    }
    const personalizedCandidates: DirectorCandidate[] = [
      ...followedCandidates,
      ...watchedCandidates,
    ];

    const similarCandidates = await getSimilarDirectorCandidates(
      watchedPeople,
      discoverParams,
      discoveryPage,
      usedDirectorIds,
      new Set(excludedMovieIds),
      6,
    );
    for (const candidate of rotateItems(similarCandidates, rotation).slice(
      0,
      4,
    )) {
      if (usedDirectorIds.has(candidate.id)) continue;
      usedDirectorIds.add(candidate.id);
      personalizedCandidates.push(candidate);
    }

    const popularDirectorProfiles = new Map<number, DirectorProfile>();
    const popularMovieCandidates = (popularMovies.results ?? []).slice(0, 20);
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
      if (popularDirectorProfiles.size >= 12) break;
    }

    const discoverCandidates: DirectorCandidate[] = [
      ...popularDirectorProfiles.values(),
    ]
      .slice(0, 8)
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
      rotation,
    );

    const response: DirectorDiscoveriesResponse = {
      personalized: picks.filter(
        (pick) =>
          pick.source !== "popular" &&
          (pick.source === "followed" || pick.movies.length > 0),
      ),
      discover: picks.filter(
        (pick) => pick.source === "popular" && pick.movies.length > 0,
      ),
    };
    return response;
  }

  if (path === "/api/movies/credits/batch") {
    const rawMovieIds = parseIds(searchParams.get("movieIds"));
    if (rawMovieIds.length === 0) {
      throw new ClientMovieError(400, "invalid_movie_ids", "Inserisci da 1 a 20 ID film validi.");
    }
    const movieIds = [...new Set(rawMovieIds)].slice(0, 20);
    const results: MovieCreditsResponse[] = [];
    for (let index = 0; index < movieIds.length; index += 6) {
      const batch = await Promise.all(
        movieIds
          .slice(index, index + 6)
          .map((movieId) => loadMovieCredits(movieId)),
      );
      results.push(...batch);
    }
    const response: MovieCreditsBatchResponse = { results };
    return response;
  }

  if (path === "/api/movies/credits") {
    const movieId = Number(searchParams.get("movieId"));
    if (!Number.isInteger(movieId) || movieId <= 0) {
      throw new ClientMovieError(400, "invalid_movie_id", "Il film richiesto non è valido.");
    }
    return loadMovieCredits(movieId);
  }

  if (path === "/api/movies/availability") {
    const movieId = Number(searchParams.get("movieId"));
    if (!Number.isInteger(movieId) || movieId <= 0) {
      throw new ClientMovieError(400, "invalid_movie_id", "Il film richiesto non è valido.");
    }
    const region = (searchParams.get("region") ?? "IT").toUpperCase();
    const payload = await getTmdb<TmdbAvailability>(
      `/movie/${movieId}/watch/providers`,
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
    const response: MovieAvailabilityResponse = {
      movieId,
      region,
      providers: [...providers.values()].sort(
        (a, b) =>
          a.displayPriority - b.displayPriority || a.name.localeCompare(b.name),
      ),
      link: availability?.link ?? null,
    };
    return response;
  }

  throw new ClientMovieError(404, "not_found", `Route non trovata: ${path}`);
}
