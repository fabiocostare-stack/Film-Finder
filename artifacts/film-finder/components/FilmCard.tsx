import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  getGetMovieAvailabilityQueryKey,
  useGetMovieAvailability,
  type GetMovieAvailabilityParams,
  type Movie,
  type MovieCreditsResponse,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

type FilmCardProps = {
  movie: Movie;
  credits?: MovieCreditsResponse;
  creditsLoading?: boolean;
  isWatched: boolean;
  isSaved: boolean;
  onToggleWatched: (movie: Movie) => void;
  onToggleSave: (movie: Movie) => void;
  onDismiss?: (movie: Movie) => void;
};

function yearOf(date: string): string {
  return date?.slice(0, 4) || "Anno non disponibile";
}

function formatRuntime(runtime: number | null | undefined): string | null {
  if (!runtime || !Number.isInteger(runtime) || runtime < 1) return null;
  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;
  return `${hours} h ${minutes} min`;
}

export function FilmCard({
  movie,
  credits,
  creditsLoading = false,
  isWatched,
  isSaved,
  onToggleWatched,
  onToggleSave,
  onDismiss,
}: FilmCardProps) {
  const colors = useColors();
  const [showAvailability, setShowAvailability] = useState<boolean>(false);
  const params: GetMovieAvailabilityParams = {
    movieId: movie.id,
    region: "IT",
  };
  const availability = useGetMovieAvailability(params, {
    query: {
      enabled: showAvailability,
      queryKey: getGetMovieAvailabilityQueryKey(params),
      staleTime: 6 * 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: false,
    },
  });
  const posterUri = movie.posterPath
    ? `https://image.tmdb.org/t/p/w342${movie.posterPath}`
    : null;
  const runtimeLabel = formatRuntime(credits?.runtime);

  return (
    <View
      testID={`movie-card-${movie.id}`}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {posterUri ? (
        <Image
          source={{ uri: posterUri }}
          style={[styles.poster, { backgroundColor: colors.secondary }]}
          resizeMode="cover"
          accessibilityLabel={`Locandina di ${movie.title}`}
        />
      ) : (
        <View
          style={[
            styles.poster,
            styles.posterFallback,
            { backgroundColor: colors.secondary },
          ]}
        >
          <Feather name="film" size={23} color={colors.mutedForeground} />
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.titleLine}>
          <Text
            numberOfLines={2}
            style={[styles.title, { color: colors.foreground }]}
          >
            {movie.title}
          </Text>
          <View style={styles.rating}>
            <Feather name="star" size={12} color={colors.primary} />
            <Text style={[styles.ratingText, { color: colors.foreground }]}>
              {movie.voteAverage > 0 ? movie.voteAverage.toFixed(1) : "—"}
            </Text>
          </View>
        </View>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {yearOf(movie.releaseDate)}
          {movie.originalLanguage
            ? ` · ${movie.originalLanguage.toUpperCase()}`
            : ""}
          {runtimeLabel ? ` · ${runtimeLabel}` : ""}
        </Text>
        {creditsLoading && !credits ? (
          <View style={styles.creditLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text
              style={[styles.creditText, { color: colors.mutedForeground }]}
            >
              Caricamento regia e cast…
            </Text>
          </View>
        ) : !credits ? (
          <Text
            style={[
              styles.creditText,
              styles.credits,
              { color: colors.mutedForeground },
            ]}
          >
            Regia e cast non disponibili al momento.
          </Text>
        ) : (
          <View style={styles.credits}>
            <View style={styles.creditRow}>
              <Feather name="video" size={12} color={colors.primary} />
              <Text
                numberOfLines={1}
                style={[styles.creditText, { color: colors.mutedForeground }]}
              >
                <Text
                  style={[styles.creditLabel, { color: colors.foreground }]}
                >
                  Regia:{" "}
                </Text>
                {credits.directors.length
                  ? credits.directors.join(", ")
                  : "Non disponibile"}
              </Text>
            </View>
            <View style={styles.creditRow}>
              <Feather name="users" size={12} color={colors.primary} />
              <Text
                numberOfLines={2}
                style={[styles.creditText, { color: colors.mutedForeground }]}
              >
                <Text
                  style={[styles.creditLabel, { color: colors.foreground }]}
                >
                  Cast:{" "}
                </Text>
                {credits.cast.length
                  ? credits.cast.join(", ")
                  : "Non disponibile"}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.actions}>
          <Pressable
            testID={`availability-${movie.id}`}
            accessibilityRole="button"
            accessibilityLabel={
              showAvailability
                ? `Nascondi disponibilità di ${movie.title}`
                : `Vedi dove guardare ${movie.title}`
            }
            onPress={() => setShowAvailability((value) => !value)}
            style={({ pressed }) => [
              styles.availabilityAction,
              { backgroundColor: colors.accent, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="tv" size={13} color={colors.primary} />
            <Text style={[styles.actionLabel, { color: colors.foreground }]}>
              Dove vederlo
            </Text>
          </Pressable>
          <Pressable
            testID={`watched-${movie.id}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isWatched }}
            accessibilityLabel={
              isWatched
                ? `Rimuovi ${movie.title} dai film già visti`
                : `Segna ${movie.title} come già visto`
            }
            onPress={() => onToggleWatched(movie)}
            style={({ pressed }) => [
              styles.watchedAction,
              {
                backgroundColor: isWatched ? colors.accent : "transparent",
                borderColor: isWatched ? colors.accent : colors.border,
                opacity: pressed ? 0.65 : 1,
              },
            ]}
          >
            <Feather
              name={isWatched ? "check-circle" : "eye"}
              size={13}
              color={isWatched ? colors.primary : colors.mutedForeground}
            />
            <Text
              style={[
                styles.actionLabel,
                { color: isWatched ? colors.primary : colors.mutedForeground },
              ]}
            >
              Già visto
            </Text>
          </Pressable>
          <View style={styles.iconActions}>
            <Pressable
              testID={`save-${movie.id}`}
              accessibilityRole="button"
              accessibilityState={{ checked: isSaved }}
              hitSlop={6}
              accessibilityLabel={
                isSaved
                  ? `Rimuovi ${movie.title} dalla lista`
                  : `Salva ${movie.title} da guardare`
              }
              onPress={() => onToggleSave(movie)}
              style={({ pressed }) => [
                styles.saveAction,
                {
                  backgroundColor: isSaved ? colors.accent : "transparent",
                  borderColor: isSaved ? colors.accent : colors.border,
                  opacity: pressed ? 0.65 : 1,
                },
              ]}
            >
              <Feather
                name="bookmark"
                size={17}
                color={isSaved ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.actionLabel,
                  { color: isSaved ? colors.primary : colors.mutedForeground },
                ]}
              >
                {isSaved ? "In lista" : "Da vedere"}
              </Text>
            </Pressable>
            {onDismiss ? (
              <Pressable
                testID={`dismiss-${movie.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Non consigliarmi ${movie.title}`}
                onPress={() => onDismiss(movie)}
                style={({ pressed }) => [
                  styles.iconAction,
                  { opacity: pressed ? 0.55 : 1 },
                ]}
              >
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      {showAvailability ? (
        <View style={[styles.availability, { borderTopColor: colors.border }]}>
          <Text
            style={[styles.availabilityTitle, { color: colors.foreground }]}
          >
            In streaming in Italia
          </Text>
          {availability.isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : availability.isError ? (
            <Text
              style={[
                styles.availabilityText,
                { color: colors.mutedForeground },
              ]}
            >
              Disponibilità non verificabile al momento.
            </Text>
          ) : availability.data?.providers.length ? (
            <View style={styles.providerList}>
              {availability.data.providers.map((provider) => (
                <Text
                  key={provider.id}
                  style={[
                    styles.providerPill,
                    { color: colors.foreground, borderColor: colors.border },
                  ]}
                >
                  {provider.name}
                </Text>
              ))}
              {availability.data.link ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() =>
                    void Linking.openURL(availability.data?.link ?? "")
                  }
                  style={({ pressed }) => [
                    styles.tmdbLink,
                    { opacity: pressed ? 0.65 : 1 },
                  ]}
                >
                  <Text
                    style={[styles.tmdbLinkText, { color: colors.primary }]}
                  >
                    Dettagli
                  </Text>
                  <Feather
                    name="external-link"
                    size={12}
                    color={colors.primary}
                  />
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Text
              style={[
                styles.availabilityText,
                { color: colors.mutedForeground },
              ]}
            >
              Non risultano piattaforme streaming per questo film in Italia.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 19,
    padding: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    overflow: "hidden",
  },
  poster: { width: 92, height: 136, borderRadius: 12 },
  posterFallback: { alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minWidth: 160, paddingLeft: 12, paddingVertical: 3 },
  titleLine: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  title: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "Inter_600SemiBold",
  },
  rating: { flexDirection: "row", alignItems: "center", gap: 3, paddingTop: 2 },
  ratingText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  meta: { marginTop: 5, fontSize: 9, letterSpacing: 0.4 },
  credits: { marginTop: 8, gap: 5 },
  creditRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  creditText: { flex: 1, fontSize: 10, lineHeight: 14 },
  creditLabel: { fontFamily: "Inter_600SemiBold" },
  creditLoading: {
    marginTop: 8,
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  actions: {
    marginTop: "auto",
    paddingTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 6,
  },
  availabilityAction: {
    minHeight: 36,
    paddingHorizontal: 8,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  watchedAction: {
    minHeight: 36,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  saveAction: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  actionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  iconActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  iconAction: {
    width: 27,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  availability: {
    width: "100%",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 9,
  },
  availabilityTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  availabilityText: { fontSize: 10, lineHeight: 15 },
  providerList: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  providerPill: {
    overflow: "hidden",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 9,
    fontFamily: "Inter_500Medium",
  },
  tmdbLink: { flexDirection: "row", alignItems: "center", gap: 4, padding: 4 },
  tmdbLinkText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
});
