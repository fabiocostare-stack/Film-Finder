import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useGetMovieRecommendations } from "@workspace/api-client-react";
import type {
  GetMovieRecommendationsParams,
  Movie,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FilmCard } from "@/components/FilmCard";
import {
  CatalogNotice,
  getCatalogErrorMessage,
} from "@/components/CatalogNotice";
import { useColors } from "@/hooks/useColors";
import { useMovieCredits } from "@/hooks/useMovieCredits";
import { usePreferences } from "@/context/PreferencesContext";

const MAX_VISIBLE_MOVIES = 30;
let nextFeedSessionId = 0;

type RecommendationProfile = {
  providerIds: string;
  seedMovieIds: string;
  genreIds: string;
  taste: string;
};

function getPreferredGenres(movies: Movie[]): number[] {
  const weights = new Map<number, number>();
  movies.slice(0, 60).forEach((movie, index) => {
    const recencyWeight = 1 / (1 + index * 0.12);
    for (const genreId of new Set(movie.genreIds)) {
      weights.set(genreId, (weights.get(genreId) ?? 0) + recencyWeight);
    }
  });
  return [...weights.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 4)
    .map(([genreId]) => genreId);
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    preferences,
    isReady,
    markShown,
    toggleWatchedMovie,
    toggleSavedMovie,
    dismissMovie,
    clearRecommendationHistory,
  } = usePreferences();
  const [page, setPage] = useState<number>(1);
  const [feedGeneration, setFeedGeneration] = useState<number>(0);
  const [feedSessionId] = useState<number>(() => ++nextFeedSessionId);
  const [feedProfile, setFeedProfile] =
    useState<RecommendationProfile | null>(null);
  const [feedMovies, setFeedMovies] = useState<Movie[]>([]);
  const [totalPages, setTotalPages] = useState<number>(0);
  const feedMoviesRef = useRef<Movie[]>([]);
  const appendedPageRef = useRef<number>(0);
  const requestedPageRef = useRef<number | null>(null);
  const previousPreferenceKeyRef = useRef<string | null>(null);
  const hasSelectedProviders = preferences.selectedProviders.length > 0;
  const preferredGenres = useMemo(
    () => getPreferredGenres(preferences.watchedMovies),
    [preferences.watchedMovies],
  );
  const currentProfile = useMemo<RecommendationProfile>(
    () => ({
      providerIds: preferences.selectedProviders
        .map((provider) => provider.id)
        .join(","),
      seedMovieIds: preferences.watchedMovies
        .slice(0, 4)
        .map((movie) => movie.id)
        .join(","),
      genreIds: preferredGenres.join(","),
      taste: preferences.taste.trim(),
    }),
    [
      preferredGenres,
      preferences.selectedProviders,
      preferences.taste,
      preferences.watchedMovies,
    ],
  );
  const currentProfileRef = useRef<RecommendationProfile>(currentProfile);
  currentProfileRef.current = currentProfile;
  const preferenceKey = useMemo(
    () =>
      JSON.stringify([
        preferences.selectedProviders
          .map((provider) => provider.id)
          .sort((a, b) => a - b),
        preferences.taste.trim(),
        preferences.historyRevision,
      ]),
    [
      preferences.historyRevision,
      preferences.selectedProviders,
      preferences.taste,
    ],
  );

  const excludedIds = useMemo(
    () =>
      [
        ...preferences.shownMovieIds,
        ...preferences.dismissedMovieIds,
        ...preferences.watchedMovies.map((movie) => movie.id),
      ]
        .slice(-900)
        .join(","),
    [
      preferences.dismissedMovieIds,
      preferences.watchedMovies,
      preferences.shownMovieIds,
    ],
  );
  const startNewFeed = useCallback(() => {
    feedMoviesRef.current = [];
    setFeedMovies([]);
    setTotalPages(0);
    setPage(1);
    appendedPageRef.current = 0;
    requestedPageRef.current = null;
    setFeedProfile(currentProfileRef.current);
    setFeedGeneration((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (previousPreferenceKeyRef.current === null) {
      previousPreferenceKeyRef.current = preferenceKey;
      setFeedProfile(currentProfileRef.current);
      return;
    }
    if (previousPreferenceKeyRef.current !== preferenceKey) {
      previousPreferenceKeyRef.current = preferenceKey;
      startNewFeed();
    }
  }, [isReady, preferenceKey, startNewFeed]);

  const queryParams = useMemo<GetMovieRecommendationsParams>(
    () => ({
      region: "IT",
      page,
      providerIds: feedProfile?.providerIds ?? "",
      seedMovieIds: feedProfile?.seedMovieIds || undefined,
      genreIds: feedProfile?.genreIds || undefined,
      excludeIds: excludedIds || undefined,
      taste: feedProfile?.taste || undefined,
    }),
    [excludedIds, feedProfile, page],
  );
  const recommendations = useGetMovieRecommendations(queryParams, {
    query: {
      enabled:
        isReady &&
        preferences.platformSetupComplete &&
        hasSelectedProviders &&
        feedProfile !== null,
      queryKey: [
        "movie-recommendations",
        feedSessionId,
        feedGeneration,
        page,
      ],
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      retry: false,
    },
  });
  const movieCredits = useMovieCredits(feedMovies.map((movie) => movie.id));

  useEffect(() => {
    const response = recommendations.data;
    if (
      !response ||
      response.page !== page ||
      appendedPageRef.current === page
    ) {
      return;
    }

    appendedPageRef.current = page;
    requestedPageRef.current = null;
    setTotalPages(response.totalPages);

    const existingIds = new Set(feedMoviesRef.current.map((movie) => movie.id));
    const additions = response.results
      .filter((movie) => !existingIds.has(movie.id))
      .slice(0, Math.max(0, MAX_VISIBLE_MOVIES - feedMoviesRef.current.length));
    if (additions.length === 0) return;

    const nextMovies = [...feedMoviesRef.current, ...additions];
    feedMoviesRef.current = nextMovies;
    setFeedMovies(nextMovies);
    markShown(additions.map((movie) => movie.id));
  }, [markShown, page, recommendations.data]);

  useEffect(() => {
    if (recommendations.isError) requestedPageRef.current = null;
  }, [recommendations.isError]);

  const requestNextPage = useCallback(() => {
    if (
      !feedProfile ||
      !hasSelectedProviders ||
      recommendations.isFetching ||
      recommendations.isError ||
      requestedPageRef.current !== null ||
      feedMoviesRef.current.length >= MAX_VISIBLE_MOVIES ||
      page >= totalPages
    ) {
      return;
    }

    const nextPage = Math.min(page + 1, 500);
    if (nextPage === page) return;
    requestedPageRef.current = nextPage;
    setPage(nextPage);
  }, [
    feedProfile,
    hasSelectedProviders,
    page,
    recommendations.isError,
    recommendations.isFetching,
    totalPages,
  ]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (feedMoviesRef.current.length === 0) return;
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      if (
        contentOffset.y + layoutMeasurement.height >=
        contentSize.height - 320
      ) {
        requestNextPage();
      }
    },
    [requestNextPage],
  );

  const movieCount = feedMovies.length;
  const paddingTop = Platform.OS === "web" ? 67 : insets.top + 10;
  const resetRecommendations = useCallback(() => {
    clearRecommendationHistory();
  }, [clearRecommendationHistory]);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop,
          paddingBottom: Platform.OS === "web" ? 110 : 36,
        },
      ]}
      showsVerticalScrollIndicator={false}
      onScroll={handleScroll}
      scrollEventThrottle={16}
    >
      <View style={styles.topline}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            FILM FINDER
          </Text>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>
            Stasera,{"\n"}qualcosa di nuovo.
          </Text>
        </View>
        <View style={[styles.regionBadge, { borderColor: colors.border }]}>
          <Feather name="map-pin" size={13} color={colors.mutedForeground} />
          <Text style={[styles.regionText, { color: colors.mutedForeground }]}>
            ITALIA
          </Text>
        </View>
      </View>

      <LinearGradient
        colors={[colors.accent, colors.card]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.feature}
      >
        <View style={styles.featureCopy}>
          <Text style={[styles.featureLabel, { color: colors.primary }]}>
            IL TUO PROSSIMO FILM
          </Text>
          <Text style={[styles.featureTitle, { color: colors.foreground }]}>
            Meno scroll.{"\n"}Più cinema.
          </Text>
          <Text style={[styles.featureBody, { color: colors.mutedForeground }]}>
            Solo sui servizi che hai. Prima i film più apprezzati e vicini a ciò che hai visto.
          </Text>
        </View>
        <View style={[styles.reelMark, { backgroundColor: colors.primary }]}>
          <Feather name="film" size={25} color={colors.primaryForeground} />
        </View>
      </LinearGradient>

      <View style={styles.sectionHeading}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Scelti per te
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
            {movieCount}/{MAX_VISIBLE_MOVIES} film · solo sui tuoi servizi
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ricarica tutti i consigli"
          testID="refresh-recommendations"
          disabled={!hasSelectedProviders || recommendations.isFetching}
          onPress={startNewFeed}
          style={({ pressed }) => [
            styles.iconButton,
            {
              borderColor: colors.border,
              opacity:
                pressed || !hasSelectedProviders || recommendations.isFetching
                  ? 0.65
                  : 1,
            },
          ]}
        >
          {recommendations.isFetching ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="shuffle" size={17} color={colors.primary} />
          )}
        </Pressable>
      </View>

      {!isReady ||
      (hasSelectedProviders &&
        feedMovies.length === 0 &&
        (feedProfile === null || recommendations.isLoading)) ? (
        <View style={[styles.loadingPanel, { borderColor: colors.border }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Prepariamo i tuoi consigli…
          </Text>
        </View>
      ) : !hasSelectedProviders ? (
        <View style={[styles.emptyPanel, { borderColor: colors.border }]}>
          <Feather name="tv" size={24} color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Scegli dove guardare
          </Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
            Per mostrarti solo film disponibili per te, seleziona almeno una
            piattaforma nel profilo.
          </Text>
          <Pressable
            accessibilityRole="button"
            testID="choose-streaming-platforms"
            onPress={() => router.push("/(tabs)/profile")}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
              Scegli piattaforme
            </Text>
          </Pressable>
        </View>
      ) : recommendations.isError && movieCount === 0 ? (
        <CatalogNotice
          title="Catalogo non disponibile"
          message={getCatalogErrorMessage(
            recommendations.error,
            "Non è stato possibile caricare i consigli. Verifica la connessione e riprova.",
          )}
          onRetry={() => void recommendations.refetch()}
        />
      ) : movieCount === 0 ? (
        <View style={[styles.emptyPanel, { borderColor: colors.border }]}>
          <Feather name="film" size={24} color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Nessun titolo nuovo in questo gruppo
          </Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
            I film già mostrati o segnati come visti sono esclusi. Prova un altro gruppo o azzera la cronologia dei consigli.
          </Text>
          <Pressable
            accessibilityRole="button"
            testID="load-more-recommendations-empty"
            disabled={page >= totalPages || recommendations.isFetching}
            onPress={requestNextPage}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor: colors.border,
                opacity:
                  pressed || page >= totalPages || recommendations.isFetching
                    ? 0.5
                    : 1,
              },
            ]}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
              Cerca altri film
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={resetRecommendations}
            style={({ pressed }) => [styles.textButton, { opacity: pressed ? 0.65 : 1 }]}
          >
            <Text style={[styles.textButtonText, { color: colors.primary }]}>
              Azzera la cronologia
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.movieList}>
          {feedMovies.map((movie) => (
            <FilmCard
              key={movie.id}
              movie={movie}
              credits={movieCredits.creditsByMovieId.get(movie.id)}
              creditsLoading={
                movieCredits.isFetching &&
                !movieCredits.creditsByMovieId.has(movie.id)
              }
              isWatched={preferences.watchedMovies.some((item) => item.id === movie.id)}
              isSaved={preferences.savedMovies.some((item) => item.id === movie.id)}
              onToggleWatched={toggleWatchedMovie}
              onToggleSave={toggleSavedMovie}
              onDismiss={(movie) => {
                dismissMovie(movie);
                const nextMovies = feedMoviesRef.current.filter(
                  (item) => item.id !== movie.id,
                );
                feedMoviesRef.current = nextMovies;
                setFeedMovies(nextMovies);
              }}
            />
          ))}
          {recommendations.isError ? (
            <CatalogNotice
              title="Altri film non disponibili"
              message={getCatalogErrorMessage(
                recommendations.error,
                "Non è stato possibile caricare altri consigli. Riprova.",
              )}
              onRetry={() => void recommendations.refetch()}
            />
          ) : recommendations.isFetching ? (
            <View style={[styles.loadingPanel, { borderColor: colors.border }]}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                Aggiungiamo altri film…
              </Text>
            </View>
          ) : movieCount >= MAX_VISIBLE_MOVIES ? (
            <View style={[styles.emptyPanel, { borderColor: colors.border }]}>
              <Feather name="check-circle" size={22} color={colors.primary} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Hai raggiunto i 30 film
              </Text>
              <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
                Ricarica per iniziare una nuova lista di consigli.
              </Text>
              <Pressable
                accessibilityRole="button"
                testID="reload-recommendations-at-limit"
                onPress={startNewFeed}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
                  Ricarica tutti i consigli
                </Text>
              </Pressable>
            </View>
          ) : page < totalPages ? (
            <Pressable
              accessibilityRole="button"
              testID="load-more-recommendations"
              onPress={requestNextPage}
              style={({ pressed }) => [
                styles.secondaryButton,
                styles.loadMoreButton,
                { borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Feather name="chevrons-down" size={16} color={colors.primary} />
              <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
                Carica altri film
              </Text>
            </Pressable>
          ) : (
            <Text style={[styles.feedEndText, { color: colors.mutedForeground }]}>
              Hai raggiunto la fine dei risultati disponibili.
            </Text>
          )}
        </View>
      )}

      <Text style={[styles.footer, { color: colors.mutedForeground }]}>
        I consigli si adattano ai film che hai già visto e alle piattaforme che selezioni.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 24 },
  topline: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  eyebrow: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 2.5 },
  pageTitle: {
    marginTop: 10,
    fontSize: 34,
    lineHeight: 39,
    letterSpacing: -1.2,
    fontFamily: "Inter_700Bold",
  },
  regionBadge: {
    marginTop: 5,
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  regionText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  feature: {
    minHeight: 168,
    borderRadius: 24,
    padding: 20,
    overflow: "hidden",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  featureCopy: { flex: 1, paddingRight: 6 },
  featureLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.5 },
  featureTitle: {
    marginTop: 9,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.5,
    fontFamily: "Inter_700Bold",
  },
  featureBody: { marginTop: 9, maxWidth: 250, fontSize: 13, lineHeight: 19 },
  reelMark: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-8deg" }],
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: { fontSize: 21, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
  sectionSubtitle: { marginTop: 4, fontSize: 12 },
  iconButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  movieList: { gap: 14 },
  loadMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  feedEndText: {
    paddingVertical: 12,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  loadingPanel: {
    minHeight: 120,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { fontSize: 13 },
  emptyPanel: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    gap: 12,
  },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  emptyBody: { fontSize: 13, lineHeight: 20, textAlign: "center" },
  secondaryButton: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  secondaryButtonText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  textButton: { padding: 8 },
  textButtonText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  footer: { fontSize: 11, lineHeight: 17, textAlign: "center", paddingHorizontal: 18 },
});
