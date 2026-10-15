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
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

type FilmCardProps = {
  movie: Movie;
  isLiked: boolean;
  isSaved: boolean;
  onToggleLike: (movie: Movie) => void;
  onToggleSave: (movie: Movie) => void;
  onDismiss?: (movie: Movie) => void;
};

function yearOf(date: string): string {
  return date?.slice(0, 4) || "Anno non disponibile";
}

export function FilmCard({
  movie,
  isLiked,
  isSaved,
  onToggleLike,
  onToggleSave,
  onDismiss,
}: FilmCardProps) {
  const colors = useColors();
  const [showAvailability, setShowAvailability] = useState<boolean>(false);
  const params: GetMovieAvailabilityParams = { movieId: movie.id, region: "IT" };
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
          {movie.originalLanguage ? ` · ${movie.originalLanguage.toUpperCase()}` : ""}
        </Text>
        {movie.overview ? (
          <Text
            numberOfLines={3}
            style={[styles.overview, { color: colors.mutedForeground }]}
          >
            {movie.overview}
          </Text>
        ) : (
          <Text style={[styles.overview, { color: colors.mutedForeground }]}>
            La trama non è disponibile.
          </Text>
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
          <View style={styles.iconActions}>
            <Pressable
              testID={`like-${movie.id}`}
              accessibilityRole="button"
              accessibilityLabel={
                isLiked ? `Rimuovi ${movie.title} dai preferiti` : `Mi piace ${movie.title}`
              }
              onPress={() => onToggleLike(movie)}
              style={({ pressed }) => [styles.iconAction, { opacity: pressed ? 0.55 : 1 }]}
            >
              <Feather
                name={isLiked ? "heart" : "heart"}
                size={17}
                color={isLiked ? colors.primary : colors.mutedForeground}
              />
            </Pressable>
            <Pressable
              testID={`save-${movie.id}`}
              accessibilityRole="button"
              accessibilityLabel={
                isSaved ? `Rimuovi ${movie.title} dalla lista` : `Salva ${movie.title} da guardare`
              }
              onPress={() => onToggleSave(movie)}
              style={({ pressed }) => [styles.iconAction, { opacity: pressed ? 0.55 : 1 }]}
            >
              <Feather
                name={isSaved ? "bookmark" : "bookmark"}
                size={17}
                color={isSaved ? colors.primary : colors.mutedForeground}
              />
            </Pressable>
            {onDismiss ? (
              <Pressable
                testID={`dismiss-${movie.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Non consigliarmi ${movie.title}`}
                onPress={() => onDismiss(movie)}
                style={({ pressed }) => [styles.iconAction, { opacity: pressed ? 0.55 : 1 }]}
              >
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      {showAvailability ? (
        <View style={[styles.availability, { borderTopColor: colors.border }]}>
          <Text style={[styles.availabilityTitle, { color: colors.foreground }]}>
            In streaming in Italia
          </Text>
          {availability.isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : availability.isError ? (
            <Text style={[styles.availabilityText, { color: colors.mutedForeground }]}>
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
                  onPress={() => void Linking.openURL(availability.data?.link ?? "")}
                  style={({ pressed }) => [styles.tmdbLink, { opacity: pressed ? 0.65 : 1 }]}
                >
                  <Text style={[styles.tmdbLinkText, { color: colors.primary }]}>
                    Dettagli
                  </Text>
                  <Feather name="external-link" size={12} color={colors.primary} />
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Text style={[styles.availabilityText, { color: colors.mutedForeground }]}>
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
  title: { flex: 1, fontSize: 14, lineHeight: 18, fontFamily: "Inter_600SemiBold" },
  rating: { flexDirection: "row", alignItems: "center", gap: 3, paddingTop: 2 },
  ratingText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  meta: { marginTop: 5, fontSize: 9, letterSpacing: 0.4 },
  overview: { marginTop: 8, fontSize: 10, lineHeight: 15 },
  actions: {
    marginTop: "auto",
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  availabilityAction: {
    minHeight: 31,
    paddingHorizontal: 8,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  actionLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
  iconActions: { flexDirection: "row", alignItems: "center", gap: 5 },
  iconAction: { width: 27, height: 30, alignItems: "center", justifyContent: "center" },
  availability: {
    width: "100%",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 9,
  },
  availabilityTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  availabilityText: { fontSize: 10, lineHeight: 15 },
  providerList: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
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
