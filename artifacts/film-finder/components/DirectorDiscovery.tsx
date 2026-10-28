import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  getGetDirectorDiscoveriesQueryKey,
  useGetDirectorDiscoveries,
  type DirectorRecommendation,
  type GetDirectorDiscoveriesParams,
} from "@workspace/api-client-react";
import { FilmCard } from "@/components/FilmCard";
import {
  CatalogNotice,
  getCatalogErrorMessage,
} from "@/components/CatalogNotice";
import { usePreferences } from "@/context/PreferencesContext";
import { useColors } from "@/hooks/useColors";
import { useMovieCredits } from "@/hooks/useMovieCredits";

const DIRECTOR_STALE_TIME = 30 * 60 * 1000;

export function DirectorDiscovery() {
  const colors = useColors();
  const [rotation, setRotation] = useState(0);
  const {
    preferences,
    isReady,
    toggleFollowedDirector,
    toggleWatchedMovie,
    toggleSavedMovie,
  } = usePreferences();
  const params = useMemo<GetDirectorDiscoveriesParams>(
    () => ({
      region: "IT",
      rotation,
      providerIds: preferences.selectedProviders
        .map((provider) => provider.id)
        .join(","),
      watchedMovieIds:
        preferences.watchedMovies
          .slice(0, 200)
          .map((movie) => movie.id)
          .join(",") || undefined,
      followedDirectorIds:
        preferences.followedDirectors
          .map((director) => director.id)
          .join(",") || undefined,
      excludeMovieIds:
        preferences.dismissedMovieIds.slice(-200).join(",") || undefined,
    }),
    [
      rotation,
      preferences.dismissedMovieIds,
      preferences.followedDirectors,
      preferences.selectedProviders,
      preferences.watchedMovies,
    ],
  );
  const discoveries = useGetDirectorDiscoveries(params, {
    query: {
      enabled:
        isReady &&
        preferences.platformSetupComplete &&
        preferences.selectedProviders.length > 0,
      queryKey: getGetDirectorDiscoveriesQueryKey(params),
      staleTime: DIRECTOR_STALE_TIME,
      placeholderData: (previousData) => previousData,
      refetchOnWindowFocus: false,
      retry: false,
    },
  });

  const recommendations = useMemo(
    () => [
      ...(discoveries.data?.personalized ?? []),
      ...(discoveries.data?.discover ?? []),
    ],
    [discoveries.data?.discover, discoveries.data?.personalized],
  );
  const movieCredits = useMovieCredits(
    recommendations.flatMap((item) => item.movies.map((movie) => movie.id)),
  );
  const watchedMovieIds = useMemo(
    () => new Set(preferences.watchedMovies.map((movie) => movie.id)),
    [preferences.watchedMovies],
  );
  const savedMovieIds = useMemo(
    () => new Set(preferences.savedMovies.map((movie) => movie.id)),
    [preferences.savedMovies],
  );
  const followedDirectorIds = useMemo(
    () => new Set(preferences.followedDirectors.map((director) => director.id)),
    [preferences.followedDirectors],
  );

  const renderDirector = (item: DirectorRecommendation) => {
    const isFollowing = followedDirectorIds.has(item.director.id);
    const profileUri = item.director.profilePath
      ? `https://image.tmdb.org/t/p/w185${item.director.profilePath}`
      : null;
    const sourceLabel =
      item.source === "followed"
        ? "Lo segui"
        : item.source === "watched"
          ? "Dai film che hai già visto"
          : item.source === "similar"
            ? "Affini ai film che hai visto"
            : "Da un film molto apprezzato";

    return (
      <View
        key={`${item.source}-${item.director.id}`}
        style={[
          styles.directorCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.directorHeader}>
          {profileUri ? (
            <Image
              source={{ uri: profileUri }}
              style={[styles.portrait, { backgroundColor: colors.secondary }]}
              resizeMode="cover"
              accessibilityLabel={`Foto di ${item.director.name}`}
            />
          ) : (
            <View
              style={[
                styles.portrait,
                styles.portraitFallback,
                { backgroundColor: colors.secondary },
              ]}
            >
              <Feather name="user" size={23} color={colors.mutedForeground} />
            </View>
          )}
          <View style={styles.directorCopy}>
            <Text
              numberOfLines={2}
              style={[styles.directorName, { color: colors.foreground }]}
            >
              {item.director.name}
            </Text>
            <Text
              style={[styles.sourceText, { color: colors.mutedForeground }]}
            >
              {sourceLabel}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isFollowing
                ? `Smetti di seguire ${item.director.name}`
                : `Segui ${item.director.name}`
            }
            onPress={() => toggleFollowedDirector(item.director)}
            style={({ pressed }) => [
              styles.followButton,
              {
                borderColor: isFollowing ? colors.primary : colors.border,
                backgroundColor: isFollowing ? colors.accent : "transparent",
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather
              name={isFollowing ? "check" : "plus"}
              size={14}
              color={isFollowing ? colors.primary : colors.foreground}
            />
            <Text
              style={[
                styles.followButtonText,
                { color: isFollowing ? colors.primary : colors.foreground },
              ]}
            >
              {isFollowing ? "Seguito" : "Segui"}
            </Text>
          </Pressable>
        </View>

        {item.movies.length > 0 ? (
          <View style={styles.movieList}>
            {item.movies.map((movie) => (
              <FilmCard
                key={movie.id}
                movie={movie}
                credits={movieCredits.creditsByMovieId.get(movie.id)}
                creditsLoading={
                  movieCredits.isFetching &&
                  !movieCredits.creditsByMovieId.has(movie.id)
                }
                isWatched={watchedMovieIds.has(movie.id)}
                isSaved={savedMovieIds.has(movie.id)}
                onToggleWatched={toggleWatchedMovie}
                onToggleSave={toggleSavedMovie}
              />
            ))}
          </View>
        ) : (
          <View
            style={[
              styles.noMovies,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[styles.noMoviesText, { color: colors.mutedForeground }]}
            >
              Al momento non trovo film inediti di questo regista sui tuoi
              servizi.
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (!isReady || discoveries.isLoading) {
    return (
      <View style={[styles.loadingPanel, { borderColor: colors.border }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
          Cerchiamo i registi e i loro film sui tuoi servizi…
        </Text>
      </View>
    );
  }

  if (discoveries.isError) {
    return (
      <CatalogNotice
        title="Catalogo non disponibile"
        message={getCatalogErrorMessage(
          discoveries.error,
          "Non è stato possibile caricare i registi. Verifica la connessione e riprova.",
        )}
        onRetry={() => void discoveries.refetch()}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeading}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Registi per te
          </Text>
          <Text
            style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}
          >
            Dai film visti, dai registi seguiti e da quelli affini
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Aggiorna i registi"
          onPress={() => setRotation((current) => (current + 1) % 1_000_000)}
          disabled={discoveries.isFetching}
          style={({ pressed }) => [
            styles.refreshButton,
            {
              borderColor: colors.border,
              opacity: pressed || discoveries.isFetching ? 0.6 : 1,
            },
          ]}
        >
          {discoveries.isFetching ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="refresh-cw" size={16} color={colors.primary} />
          )}
        </Pressable>
      </View>

      {discoveries.data?.personalized.length ? (
        <View style={styles.directorList}>
          {discoveries.data.personalized.map(renderDirector)}
        </View>
      ) : (
        <View
          style={[
            styles.emptyPersonalized,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          <Feather name="compass" size={22} color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Costruiamo i tuoi gusti da qui
          </Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
            Segui un regista o segna come visti alcuni film: useremo quelle
            informazioni senza presumere che ogni film visto ti sia piaciuto.
          </Text>
        </View>
      )}

      <View style={styles.sectionHeading}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Grandi registi da scoprire
          </Text>
          <Text
            style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}
          >
            Film molto apprezzati e disponibili sui tuoi servizi
          </Text>
        </View>
      </View>
      {discoveries.data?.discover.length ? (
        <View style={styles.directorList}>
          {discoveries.data.discover.map(renderDirector)}
        </View>
      ) : (
        <View style={[styles.noDiscoveries, { borderColor: colors.border }]}>
          <Text
            style={[styles.noMoviesText, { color: colors.mutedForeground }]}
          >
            Non ci sono altri registi da suggerire con i servizi e i film
            attualmente selezionati.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 18 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  sectionSubtitle: { marginTop: 4, fontSize: 12, lineHeight: 17 },
  refreshButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  directorList: { gap: 14 },
  directorCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 13,
    gap: 14,
  },
  directorHeader: { flexDirection: "row", alignItems: "center", gap: 11 },
  portrait: { width: 52, height: 62, borderRadius: 13 },
  portraitFallback: { alignItems: "center", justifyContent: "center" },
  directorCopy: { flex: 1, gap: 5 },
  directorName: { fontSize: 15, lineHeight: 20, fontFamily: "Inter_700Bold" },
  sourceText: { fontSize: 11, lineHeight: 15 },
  followButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderRadius: 12,
  },
  followButtonText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  movieList: { gap: 11 },
  noMovies: { borderWidth: 1, borderRadius: 13, padding: 12 },
  noMoviesText: { fontSize: 12, lineHeight: 18 },
  emptyPersonalized: {
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 18,
    padding: 19,
  },
  emptyTitle: {
    fontSize: 16,
    textAlign: "center",
    fontFamily: "Inter_600SemiBold",
  },
  emptyBody: { fontSize: 12, lineHeight: 18, textAlign: "center" },
  noDiscoveries: { borderWidth: 1, borderRadius: 16, padding: 15 },
  loadingPanel: {
    minHeight: 130,
    borderWidth: 1,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { fontSize: 12, textAlign: "center" },
});
