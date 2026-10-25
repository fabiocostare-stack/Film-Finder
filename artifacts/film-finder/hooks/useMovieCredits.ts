import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  getGetMovieCreditsBatchQueryOptions,
  type MovieCreditsResponse,
} from "@workspace/api-client-react";

const CREDIT_BATCH_SIZE = 20;
const CREDIT_STALE_TIME = 12 * 60 * 60 * 1000;

export function useMovieCredits(movieIds: readonly number[]) {
  const movieIdsKey = movieIds.join(",");
  const batches = useMemo(() => {
    const ids = [
      ...new Set(
        movieIdsKey
          .split(",")
          .filter(Boolean)
          .map(Number)
          .filter((id) => Number.isSafeInteger(id) && id > 0),
      ),
    ];
    const result: number[][] = [];
    for (let index = 0; index < ids.length; index += CREDIT_BATCH_SIZE) {
      result.push(ids.slice(index, index + CREDIT_BATCH_SIZE));
    }
    return result;
  }, [movieIdsKey]);

  const queries = useQueries({
    queries: batches.map((ids) => {
      const params = { movieIds: ids.join(",") };
      return {
        ...getGetMovieCreditsBatchQueryOptions(params),
        queryKey: ["movie-credits-with-runtime-v1", params.movieIds],
        staleTime: CREDIT_STALE_TIME,
        refetchOnWindowFocus: false,
        retry: false,
      };
    }),
  });

  const creditsByMovieId = useMemo(() => {
    const credits = new Map<number, MovieCreditsResponse>();
    for (const query of queries) {
      for (const item of query.data?.results ?? []) {
        credits.set(item.movieId, item);
      }
    }
    return credits;
  }, [queries]);

  return {
    creditsByMovieId,
    isFetching: queries.some((query) => query.isFetching),
  };
}
