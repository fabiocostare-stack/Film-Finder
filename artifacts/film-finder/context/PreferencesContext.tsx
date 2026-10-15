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
  likedMovies: Movie[];
  savedMovies: Movie[];
  seenMovieIds: number[];
  dismissedMovieIds: number[];
  selectedProviders: MovieProvider[];
  taste: string;
  historyRevision: number;
};

type PreferencesContextValue = {
  preferences: MoviePreferences;
  isReady: boolean;
  storageError: boolean;
  toggleLikedMovie: (movie: Movie) => void;
  toggleSavedMovie: (movie: Movie) => void;
  toggleProvider: (provider: MovieProvider) => void;
  saveTaste: (taste: string) => void;
  markSeen: (ids: number[]) => void;
  dismissMovie: (movie: Movie) => void;
  clearRecommendationHistory: () => void;
};

const emptyPreferences: MoviePreferences = {
  likedMovies: [],
  savedMovies: [],
  seenMovieIds: [],
  dismissedMovieIds: [],
  selectedProviders: [],
  taste: "",
  historyRevision: 0,
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function isMoviePreferences(value: unknown): value is MoviePreferences {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MoviePreferences>;
  return (
    Array.isArray(candidate.likedMovies) &&
    Array.isArray(candidate.savedMovies) &&
    Array.isArray(candidate.seenMovieIds) &&
    Array.isArray(candidate.dismissedMovieIds) &&
    Array.isArray(candidate.selectedProviders) &&
    typeof candidate.taste === "string"
  );
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
        if (isMoviePreferences(parsed)) {
          setPreferences({
            ...parsed,
            historyRevision:
              typeof parsed.historyRevision === "number"
                ? parsed.historyRevision
                : 0,
          });
        }
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

  const toggleLikedMovie = useCallback((movie: Movie) => {
    setPreferences((current) => ({
      ...current,
      likedMovies: toggleMovie(current.likedMovies, movie),
    }));
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

  const saveTaste = useCallback((taste: string) => {
    setPreferences((current) => ({ ...current, taste }));
  }, []);

  const markSeen = useCallback((ids: number[]) => {
    if (ids.length === 0) return;
    setPreferences((current) => {
      const seen = new Set(current.seenMovieIds);
      for (const id of ids) seen.add(id);
      const next = [...seen].slice(-1000);
      if (
        next.length === current.seenMovieIds.length &&
        next.every((id, index) => id === current.seenMovieIds[index])
      ) {
        return current;
      }
      return { ...current, seenMovieIds: next };
    });
  }, []);

  const dismissMovie = useCallback((movie: Movie) => {
    setPreferences((current) => ({
      ...current,
      dismissedMovieIds: [...new Set([...current.dismissedMovieIds, movie.id])].slice(
        -1000,
      ),
      seenMovieIds: [...new Set([...current.seenMovieIds, movie.id])].slice(-1000),
    }));
  }, []);

  const clearRecommendationHistory = useCallback(() => {
    setPreferences((current) => ({
      ...current,
      seenMovieIds: [],
      dismissedMovieIds: [],
      historyRevision: current.historyRevision + 1,
    }));
  }, []);

  const value = useMemo(
    () => ({
      preferences,
      isReady,
      storageError,
      toggleLikedMovie,
      toggleSavedMovie,
      toggleProvider,
      saveTaste,
      markSeen,
      dismissMovie,
      clearRecommendationHistory,
    }),
    [
      preferences,
      isReady,
      storageError,
      toggleLikedMovie,
      toggleSavedMovie,
      toggleProvider,
      saveTaste,
      markSeen,
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
