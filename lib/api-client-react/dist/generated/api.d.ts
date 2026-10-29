import type { QueryKey, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { DirectorDiscoveriesResponse, GetDirectorDiscoveriesParams, GetMovieAvailabilityParams, GetMovieCreditsBatchParams, GetMovieCreditsParams, GetMovieRecommendationsParams, HealthStatus, ListMovieProvidersParams, MovieAvailabilityResponse, MovieCreditsBatchResponse, MovieCreditsResponse, MovieErrorResponse, MovieProviderListResponse, MovieSearchResponse, SearchMoviesParams } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * Returns server health status
 * @summary Health check
 */
export declare const healthCheck: (options?: Parameters<typeof customFetch>[1]) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getSearchMoviesUrl: (params: SearchMoviesParams) => string;
/**
 * @summary Search the movie catalog
 */
export declare const searchMovies: (params: SearchMoviesParams, options?: Parameters<typeof customFetch>[1]) => Promise<MovieSearchResponse>;
export declare const getSearchMoviesQueryKey: (params?: SearchMoviesParams) => readonly ["/api/movies/search", ...SearchMoviesParams[]];
export declare const getSearchMoviesQueryOptions: <TData = Awaited<ReturnType<typeof searchMovies>>, TError = ErrorType<MovieErrorResponse>>(params: SearchMoviesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof searchMovies>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof searchMovies>>, TError, TData> & {
    queryKey: QueryKey;
};
export type SearchMoviesQueryResult = NonNullable<Awaited<ReturnType<typeof searchMovies>>>;
export type SearchMoviesQueryError = ErrorType<MovieErrorResponse>;
/**
 * @summary Search the movie catalog
 */
export declare function useSearchMovies<TData = Awaited<ReturnType<typeof searchMovies>>, TError = ErrorType<MovieErrorResponse>>(params: SearchMoviesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof searchMovies>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListMovieProvidersUrl: (params?: ListMovieProvidersParams) => string;
/**
 * @summary List streaming services in a region
 */
export declare const listMovieProviders: (params?: ListMovieProvidersParams, options?: Parameters<typeof customFetch>[1]) => Promise<MovieProviderListResponse>;
export declare const getListMovieProvidersQueryKey: (params?: ListMovieProvidersParams) => readonly ["/api/movies/providers", ...ListMovieProvidersParams[]];
export declare const getListMovieProvidersQueryOptions: <TData = Awaited<ReturnType<typeof listMovieProviders>>, TError = ErrorType<MovieErrorResponse>>(params?: ListMovieProvidersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMovieProviders>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listMovieProviders>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListMovieProvidersQueryResult = NonNullable<Awaited<ReturnType<typeof listMovieProviders>>>;
export type ListMovieProvidersQueryError = ErrorType<MovieErrorResponse>;
/**
 * @summary List streaming services in a region
 */
export declare function useListMovieProviders<TData = Awaited<ReturnType<typeof listMovieProviders>>, TError = ErrorType<MovieErrorResponse>>(params?: ListMovieProvidersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMovieProviders>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetMovieRecommendationsUrl: (params: GetMovieRecommendationsParams) => string;
/**
 * @summary Recommend highly rated films matching selected streaming services and watched titles
 */
export declare const getMovieRecommendations: (params: GetMovieRecommendationsParams, options?: Parameters<typeof customFetch>[1]) => Promise<MovieSearchResponse>;
export declare const getGetMovieRecommendationsQueryKey: (params?: GetMovieRecommendationsParams) => readonly ["/api/movies/recommendations", ...GetMovieRecommendationsParams[]];
export declare const getGetMovieRecommendationsQueryOptions: <TData = Awaited<ReturnType<typeof getMovieRecommendations>>, TError = ErrorType<MovieErrorResponse>>(params: GetMovieRecommendationsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMovieRecommendations>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMovieRecommendations>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMovieRecommendationsQueryResult = NonNullable<Awaited<ReturnType<typeof getMovieRecommendations>>>;
export type GetMovieRecommendationsQueryError = ErrorType<MovieErrorResponse>;
/**
 * @summary Recommend highly rated films matching selected streaming services and watched titles
 */
export declare function useGetMovieRecommendations<TData = Awaited<ReturnType<typeof getMovieRecommendations>>, TError = ErrorType<MovieErrorResponse>>(params: GetMovieRecommendationsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMovieRecommendations>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetMovieAvailabilityUrl: (params: GetMovieAvailabilityParams) => string;
/**
 * @summary Get streaming availability for one movie
 */
export declare const getMovieAvailability: (params: GetMovieAvailabilityParams, options?: Parameters<typeof customFetch>[1]) => Promise<MovieAvailabilityResponse>;
export declare const getGetMovieAvailabilityQueryKey: (params?: GetMovieAvailabilityParams) => readonly ["/api/movies/availability", ...GetMovieAvailabilityParams[]];
export declare const getGetMovieAvailabilityQueryOptions: <TData = Awaited<ReturnType<typeof getMovieAvailability>>, TError = ErrorType<MovieErrorResponse>>(params: GetMovieAvailabilityParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMovieAvailability>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMovieAvailability>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMovieAvailabilityQueryResult = NonNullable<Awaited<ReturnType<typeof getMovieAvailability>>>;
export type GetMovieAvailabilityQueryError = ErrorType<MovieErrorResponse>;
/**
 * @summary Get streaming availability for one movie
 */
export declare function useGetMovieAvailability<TData = Awaited<ReturnType<typeof getMovieAvailability>>, TError = ErrorType<MovieErrorResponse>>(params: GetMovieAvailabilityParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMovieAvailability>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetMovieCreditsUrl: (params: GetMovieCreditsParams) => string;
/**
 * @summary Get a movie's director and main cast
 */
export declare const getMovieCredits: (params: GetMovieCreditsParams, options?: Parameters<typeof customFetch>[1]) => Promise<MovieCreditsResponse>;
export declare const getGetMovieCreditsQueryKey: (params?: GetMovieCreditsParams) => readonly ["/api/movies/credits", ...GetMovieCreditsParams[]];
export declare const getGetMovieCreditsQueryOptions: <TData = Awaited<ReturnType<typeof getMovieCredits>>, TError = ErrorType<MovieErrorResponse>>(params: GetMovieCreditsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMovieCredits>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMovieCredits>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMovieCreditsQueryResult = NonNullable<Awaited<ReturnType<typeof getMovieCredits>>>;
export type GetMovieCreditsQueryError = ErrorType<MovieErrorResponse>;
/**
 * @summary Get a movie's director and main cast
 */
export declare function useGetMovieCredits<TData = Awaited<ReturnType<typeof getMovieCredits>>, TError = ErrorType<MovieErrorResponse>>(params: GetMovieCreditsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMovieCredits>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetMovieCreditsBatchUrl: (params: GetMovieCreditsBatchParams) => string;
/**
 * @summary Get director and main cast for multiple movies
 */
export declare const getMovieCreditsBatch: (params: GetMovieCreditsBatchParams, options?: Parameters<typeof customFetch>[1]) => Promise<MovieCreditsBatchResponse>;
export declare const getGetMovieCreditsBatchQueryKey: (params?: GetMovieCreditsBatchParams) => readonly ["/api/movies/credits/batch", ...GetMovieCreditsBatchParams[]];
export declare const getGetMovieCreditsBatchQueryOptions: <TData = Awaited<ReturnType<typeof getMovieCreditsBatch>>, TError = ErrorType<MovieErrorResponse>>(params: GetMovieCreditsBatchParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMovieCreditsBatch>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMovieCreditsBatch>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMovieCreditsBatchQueryResult = NonNullable<Awaited<ReturnType<typeof getMovieCreditsBatch>>>;
export type GetMovieCreditsBatchQueryError = ErrorType<MovieErrorResponse>;
/**
 * @summary Get director and main cast for multiple movies
 */
export declare function useGetMovieCreditsBatch<TData = Awaited<ReturnType<typeof getMovieCreditsBatch>>, TError = ErrorType<MovieErrorResponse>>(params: GetMovieCreditsBatchParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMovieCreditsBatch>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetDirectorDiscoveriesUrl: (params: GetDirectorDiscoveriesParams) => string;
/**
 * @summary Recommend directors and highly rated films available on selected services
 */
export declare const getDirectorDiscoveries: (params: GetDirectorDiscoveriesParams, options?: Parameters<typeof customFetch>[1]) => Promise<DirectorDiscoveriesResponse>;
export declare const getGetDirectorDiscoveriesQueryKey: (params?: GetDirectorDiscoveriesParams) => readonly ["/api/movies/director-discoveries", ...GetDirectorDiscoveriesParams[]];
export declare const getGetDirectorDiscoveriesQueryOptions: <TData = Awaited<ReturnType<typeof getDirectorDiscoveries>>, TError = ErrorType<MovieErrorResponse>>(params: GetDirectorDiscoveriesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDirectorDiscoveries>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getDirectorDiscoveries>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetDirectorDiscoveriesQueryResult = NonNullable<Awaited<ReturnType<typeof getDirectorDiscoveries>>>;
export type GetDirectorDiscoveriesQueryError = ErrorType<MovieErrorResponse>;
/**
 * @summary Recommend directors and highly rated films available on selected services
 */
export declare function useGetDirectorDiscoveries<TData = Awaited<ReturnType<typeof getDirectorDiscoveries>>, TError = ErrorType<MovieErrorResponse>>(params: GetDirectorDiscoveriesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDirectorDiscoveries>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export {};
//# sourceMappingURL=api.d.ts.map