import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Movie, MovieProvider } from "@workspace/api-client-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "film-finder.preferences.v1";

export type MoviePreferences = {
  watchedMovies: Movie[];
  savedMovies: Movie[];
  shownMovieIds: number[];
  dismissedMovieIds: number[];
  selectedProviders: MovieProvider[];
  platformSetupComplete: boolean;
  taste: string;
  historyRevision: number;
};

type PreferencesContextValue = {
  preferences: MoviePreferences;
  isReady: boolean;
  storageError: boolean;
  toggleWatchedMovie: (movie: Movie) => void;
  toggleSavedMovie: (movie: Movie) => void;
  toggleProvider: (provider: MovieProvider) => void;
  completePlatformSetup: () => void;
  saveTaste: (taste: string) => void;
  markShown: (ids: number[]) => void;
  dismissMovie: (movie: Movie) => void;
  clearRecommendationHistory: () => void;
};

const emptyPreferences: MoviePreferences = {
  watchedMovies: [],
  savedMovies: [],
  shownMovieIds: [],
  dismissedMovieIds: [],
  selectedProviders: [],
  platformSetupComplete: false,
  taste: "",
  historyRevision: 0,
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function restorePreferences(value: unknown): MoviePreferences | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.taste !== "string") return null;

  const legacyLikes = Array.isArray(candidate.likedMovies)
    ? (candidate.likedMovies as Movie[])
    : [];
  const selectedProviders = Array.isArray(candidate.selectedProviders)
    ? (candidate.selectedProviders as MovieProvider[])
    : [];

  return {
    watchedMovies: Array.isArray(candidate.watchedMovies)
      ? (candidate.watchedMovies as Movie[])
      : legacyLikes,
    savedMovies: Array.isArray(candidate.savedMovies)
      ? (candidate.savedMovies as Movie[])
      : [],
    shownMovieIds: Array.isArray(candidate.shownMovieIds)
      ? (candidate.shownMovieIds as number[])
      : Array.isArray(candidate.seenMovieIds)
        ? (candidate.seenMovieIds as number[])
      : [],
    dismissedMovieIds: Array.isArray(candidate.dismissedMovieIds)
      ? (candidate.dismissedMovieIds as number[])
      : [],
    selectedProviders,
    platformSetupComplete:
      typeof candidate.platformSetupComplete === "boolean"
        ? candidate.platformSetupComplete
        : selectedProviders.length > 0,
    taste: candidate.taste,
    historyRevision:
      typeof candidate.historyRevision === "number"
        ? candidate.historyRevision
        : 0,
  };
}

function toggleMovie(movies: Movie[], movie: Movie): Movie[] {
  return movies.some((item) => item.id === movie.id)
    ? movies.filter((item) => item.id !== movie.id)
    : [movie, ...movies];
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] =
    useState<MoviePreferences>(emptyPreferences);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [storageError, setStorageError] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!mounted || !stored) return;
        const parsed: unknown = JSON.parse(stored);
        const restored = restorePreferences(parsed);
        if (restored) setPreferences(restored);
      })
      .catch(() => {
        if (mounted) setStorageError(true);
      })
      .finally(() => {
        if (mounted) setIsReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)).catch(
      () => setStorageError(true),
    );
  }, [isReady, preferences]);

  const toggleWatchedMovie = useCallback((movie: Movie) => {
    setPreferences((current) => {
      const wasWatched = current.watchedMovies.some(
        (item) => item.id === movie.id,
      );
      return {
        ...current,
        watchedMovies: toggleMovie(current.watchedMovies, movie),
        savedMovies: wasWatched
          ? current.savedMovies
          : current.savedMovies.filter((item) => item.id !== movie.id),
      };
    });
  }, []);

  const toggleSavedMovie = useCallback((movie: Movie) => {
    setPreferences((current) => ({
      ...current,
      savedMovies: toggleMovie(current.savedMovies, movie),
    }));
  }, []);

  const toggleProvider = useCallback((provider: MovieProvider) => {
    setPreferences((current) => ({
      ...current,
      selectedProviders: current.selectedProviders.some(
        (item) => item.id === provider.id,
      )
        ? current.selectedProviders.filter((item) => item.id !== provider.id)
        : [...current.selectedProviders, provider],
    }));
  }, []);

  const completePlatformSetup = useCallback(() => {
    setPreferences((current) => ({
      ...current,
      platformSetupComplete: current.selectedProviders.length > 0,
    }));
  }, []);

  const saveTaste = useCallback((taste: string) => {
    setPreferences((current) => ({ ...current, taste }));
  }, []);

  const markShown = useCallback((ids: number[]) => {
    if (ids.length === 0) return;
    setPreferences((current) => {
      const shown = new Set(current.shownMovieIds);
      for (const id of ids) shown.add(id);
      const next = [...shown].slice(-1000);
      if (
        next.length === current.shownMovieIds.length &&
        next.every((id, index) => id === current.shownMovieIds[index])
      ) {
        return current;
      }
      return { ...current, shownMovieIds: next };
    });
  }, []);

  const dismissMovie = useCallback((movie: Movie) => {
    setPreferences((current) => ({
      ...current,
      dismissedMovieIds: [...new Set([...current.dismissedMovieIds, movie.id])].slice(
        -1000,
      ),
      shownMovieIds: [...new Set([...current.shownMovieIds, movie.id])].slice(-1000),
    }));
  }, []);

  const clearRecommendationHistory = useCallback(() => {
    setPreferences((current) => ({
      ...current,
      shownMovieIds: [],
      dismissedMovieIds: [],
      historyRevision: current.historyRevision + 1,
    }));
  }, []);

  const value = useMemo(
    () => ({
      preferences,
      isReady,
      storageError,
      toggleWatchedMovie,
      toggleSavedMovie,
      toggleProvider,
      completePlatformSetup,
      saveTaste,
      markShown,
      dismissMovie,
      clearRecommendationHistory,
    }),
    [
      preferences,
      isReady,
      storageError,
      toggleWatchedMovie,
      toggleSavedMovie,
      toggleProvider,
      completePlatformSetup,
      saveTaste,
      markShown,
      dismissMovie,
      clearRecommendationHistory,
    ],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return context;
}
