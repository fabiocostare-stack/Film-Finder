import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useGetMovieRecommendations } from "@workspace/api-client-react";
import type { GetMovieRecommendationsParams } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FilmCard } from "@/components/FilmCard";
import {
  CatalogNotice,
  getCatalogErrorMessage,
} from "@/components/CatalogNotice";
import { useColors } from "@/hooks/useColors";
import { usePreferences } from "@/context/PreferencesContext";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
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
  const queryParams = useMemo<GetMovieRecommendationsParams>(
    () => ({
      region: "IT",
      page,
      providerIds:
        preferences.selectedProviders.length > 0
          ? preferences.selectedProviders.map((provider) => provider.id).join(",")
          : undefined,
      genreIds: [...new Set(preferences.watchedMovies.flatMap((movie) => movie.genreIds))]
        .slice(0, 12)
        .join(",") || undefined,
      excludeIds: excludedIds || undefined,
      taste: preferences.taste.trim() || undefined,
    }),
    [
      excludedIds,
      page,
      preferences.watchedMovies,
      preferences.selectedProviders,
      preferences.taste,
    ],
  );
  const recommendationKey = useMemo(
    () => [
      "movie-recommendations",
      page,
      preferences.selectedProviders.map((provider) => provider.id).join(","),
      preferences.watchedMovies.map((movie) => movie.id).join(","),
      preferences.taste,
      preferences.historyRevision,
    ],
    [
      page,
      preferences.watchedMovies,
      preferences.selectedProviders,
      preferences.taste,
      preferences.historyRevision,
    ],
  );
  const recommendations = useGetMovieRecommendations(queryParams, {
    query: {
      enabled: isReady,
      queryKey: recommendationKey,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      retry: false,
    },
  });

  useEffect(() => {
    const ids = recommendations.data?.results.map((movie) => movie.id) ?? [];
    if (ids.length > 0) markShown(ids);
  }, [markShown, recommendations.data?.results]);

  const movieCount = recommendations.data?.results.length ?? 0;
  const paddingTop = Platform.OS === "web" ? 67 : insets.top + 10;

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
            Consigli basati sui tuoi gusti e sui servizi che hai già.
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
            Ogni giro, una selezione diversa
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mostra nuovi consigli"
          testID="refresh-recommendations"
          disabled={recommendations.isFetching}
          onPress={() => {
            if (movieCount > 0) {
              markShown(recommendations.data?.results.map((movie) => movie.id) ?? []);
            }
            setPage((current) =>
              recommendations.data?.totalPages &&
              current >= recommendations.data.totalPages
                ? 1
                : current + 1,
            );
          }}
          style={({ pressed }) => [
            styles.iconButton,
            { borderColor: colors.border, opacity: pressed ? 0.65 : 1 },
          ]}
        >
          {recommendations.isFetching ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="shuffle" size={17} color={colors.primary} />
          )}
        </Pressable>
      </View>

      {!isReady || recommendations.isLoading ? (
        <View style={[styles.loadingPanel, { borderColor: colors.border }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Prepariamo i tuoi consigli…
          </Text>
        </View>
      ) : recommendations.isError ? (
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
            onPress={() => setPage((current) => (current >= 500 ? 1 : current + 1))}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
              Prova un altro gruppo
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={clearRecommendationHistory}
            style={({ pressed }) => [styles.textButton, { opacity: pressed ? 0.65 : 1 }]}
          >
            <Text style={[styles.textButtonText, { color: colors.primary }]}>
              Azzera la cronologia
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.movieList}>
          {recommendations.data?.results.map((movie) => (
            <FilmCard
              key={movie.id}
              movie={movie}
              isWatched={preferences.watchedMovies.some((item) => item.id === movie.id)}
              isSaved={preferences.savedMovies.some((item) => item.id === movie.id)}
              onToggleWatched={toggleWatchedMovie}
              onToggleSave={toggleSavedMovie}
              onDismiss={(movie) => {
                dismissMovie(movie);
                setPage((current) => (current >= 500 ? 1 : current + 1));
              }}
            />
          ))}
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
