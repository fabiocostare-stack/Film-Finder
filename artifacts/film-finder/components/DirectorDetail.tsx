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
import { useQuery } from "@tanstack/react-query";
import {
  loadDirectorFilmography,
  loadMoviesOnProviders,
  type DirectorProfile,
} from "@workspace/api-client-react";
import {
  CatalogNotice,
  getCatalogErrorMessage,
} from "@/components/CatalogNotice";
import { FilmCard } from "@/components/FilmCard";
import { usePreferences } from "@/context/PreferencesContext";
import { useColors } from "@/hooks/useColors";
import { useMovieCredits } from "@/hooks/useMovieCredits";

type SortMode = "recent" | "oldest" | "rating";

const SORT_OPTIONS: Array<{ mode: SortMode; label: string }> = [
  { mode: "recent", label: "Più recenti" },
  { mode: "oldest", label: "Più vecchi" },
  { mode: "rating", label: "Voto" },
];

type DirectorDetailProps = {
  director: DirectorProfile;
  onBack: () => void;
};

export function DirectorDetail({ director, onBack }: DirectorDetailProps) {
  const colors = useColors();
  const directorId = director.id;
  const {
    preferences,
    toggleFollowedDirector,
    toggleWatchedMovie,
    toggleSavedMovie,
  } = usePreferences();

  const filmography = useQuery({
    queryKey: ["director-filmography", directorId],
    queryFn: () => loadDirectorFilmography(directorId),
    staleTime: 12 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  const allMovies = filmography.data?.movies ?? [];
  const providerIds = useMemo(
    () => preferences.selectedProviders.map((provider) => provider.id),
    [preferences.selectedProviders],
  );
  const availability = useQuery({
    queryKey: [
      "director-availability",
      directorId,
      providerIds.join(","),
      allMovies.length,
    ],
    queryFn: () =>
      loadMoviesOnProviders(
        allMovies.map((movie) => movie.id),
        providerIds,
      ),
    enabled: onlyAvailable && allMovies.length > 0 && providerIds.length > 0,
    staleTime: 6 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const movies = useMemo(() => {
    let list = allMovies;
    if (onlyAvailable) {
      const ids = new Set(availability.data ?? []);
      list = list.filter((movie) => ids.has(movie.id));
    }
    const sorted = [...list];
    if (sortMode === "recent") {
      sorted.sort((a, b) =>
        (b.releaseDate || "0000").localeCompare(a.releaseDate || "0000"),
      );
    } else if (sortMode === "oldest") {
      sorted.sort((a, b) =>
        (a.releaseDate || "9999").localeCompare(b.releaseDate || "9999"),
      );
    } else {
      sorted.sort((a, b) => b.voteAverage - a.voteAverage);
    }
    return sorted;
  }, [allMovies, availability.data, onlyAvailable, sortMode]);
  const movieCredits = useMovieCredits(movies.map((movie) => movie.id));
  const watchedMovieIds = useMemo(
    () => new Set(preferences.watchedMovies.map((movie) => movie.id)),
    [preferences.watchedMovies],
  );
  const savedMovieIds = useMemo(
    () => new Set(preferences.savedMovies.map((movie) => movie.id)),
    [preferences.savedMovies],
  );

  const name = filmography.data?.director.name ?? director.name ?? "Regista";
  const profilePath =
    filmography.data?.director.profilePath ?? director.profilePath ?? null;
  const profileUri = profilePath
    ? `https://image.tmdb.org/t/p/w185${profilePath}`
    : null;
  const isFollowing = preferences.followedDirectors.some(
    (director) => director.id === directorId,
  );

  return (
    <View style={styles.content}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Torna alla lista dei registi"
        onPress={onBack}
        style={({ pressed }) => [
          styles.backButton,
          { borderColor: colors.border, opacity: pressed ? 0.65 : 1 },
        ]}
      >
        <Feather name="arrow-left" size={16} color={colors.foreground} />
        <Text style={[styles.backText, { color: colors.foreground }]}>
          Indietro
        </Text>
      </Pressable>

      <View style={styles.header}>
        {profileUri ? (
          <Image
            source={{ uri: profileUri }}
            style={[styles.portrait, { backgroundColor: colors.secondary }]}
            resizeMode="cover"
            accessibilityLabel={`Foto di ${name}`}
          />
        ) : (
          <View
            style={[
              styles.portrait,
              styles.portraitFallback,
              { backgroundColor: colors.secondary },
            ]}
          >
            <Feather name="user" size={30} color={colors.mutedForeground} />
          </View>
        )}
        <View style={styles.headerCopy}>
          <Text style={[styles.name, { color: colors.foreground }]}>{name}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {filmography.data
              ? `${allMovies.length} ${allMovies.length === 1 ? "film diretto" : "film diretti"}`
              : "Regista"}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isFollowing ? `Smetti di seguire ${name}` : `Segui ${name}`
            }
            onPress={() =>
              toggleFollowedDirector({
                id: directorId,
                name,
                profilePath,
              })
            }
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
                styles.followText,
                { color: isFollowing ? colors.primary : colors.foreground },
              ]}
            >
              {isFollowing ? "Seguito" : "Segui"}
            </Text>
          </Pressable>
        </View>
      </View>

      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        Tutti i suoi film, anche quelli che non sono sui tuoi servizi. Tocca
        l'icona della TV per vedere dove guardarli.
      </Text>

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: onlyAvailable }}
          accessibilityLabel="Mostra solo i film disponibili sulle mie piattaforme"
          onPress={() => setOnlyAvailable((value) => !value)}
          style={({ pressed }) => [
            styles.chip,
            {
              borderColor: onlyAvailable ? colors.primary : colors.border,
              backgroundColor: onlyAvailable ? colors.accent : "transparent",
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather
            name={onlyAvailable ? "check-circle" : "circle"}
            size={14}
            color={onlyAvailable ? colors.primary : colors.mutedForeground}
          />
          <Text
            style={[
              styles.chipText,
              { color: onlyAvailable ? colors.primary : colors.foreground },
            ]}
          >
            Disponibili per me
          </Text>
        </Pressable>
        <View style={styles.sortRow}>
          {SORT_OPTIONS.map(({ mode, label }) => {
            const active = sortMode === mode;
            return (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setSortMode(mode)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.accent : "transparent",
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? colors.primary : colors.mutedForeground },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {filmography.isLoading ? (
        <View style={[styles.statusPanel, { borderColor: colors.border }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
            Carico i film di {name}…
          </Text>
        </View>
      ) : filmography.isError ? (
        <CatalogNotice
          title="Film non disponibili"
          message={getCatalogErrorMessage(
            filmography.error,
            "Non è stato possibile caricare i film del regista. Verifica la connessione e riprova.",
          )}
          onRetry={() => void filmography.refetch()}
        />
      ) : onlyAvailable && availability.isLoading ? (
        <View style={[styles.statusPanel, { borderColor: colors.border }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
            Controllo quali film sono sui tuoi servizi…
          </Text>
        </View>
      ) : onlyAvailable && availability.isError ? (
        <CatalogNotice
          title="Disponibilità non verificabile"
          message="Non è stato possibile controllare le piattaforme. Riprova tra poco."
          onRetry={() => void availability.refetch()}
        />
      ) : movies.length === 0 ? (
        <View style={[styles.statusPanel, { borderColor: colors.border }]}>
          <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
            {onlyAvailable
              ? "Nessun film di questo regista è sui tuoi servizi. Disattiva il filtro per vederli tutti."
              : "Non risultano film diretti da questo regista."}
          </Text>
        </View>
      ) : (
        <View style={styles.movieList}>
          {movies.map((movie) => (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  backButton: {
    alignSelf: "flex-start",
    minHeight: 38,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  backText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  portrait: { width: 78, height: 94, borderRadius: 16 },
  portraitFallback: { alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, gap: 6 },
  name: { fontSize: 22, lineHeight: 27, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12 },
  followButton: {
    alignSelf: "flex-start",
    minHeight: 34,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  followText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  hint: { fontSize: 11, lineHeight: 16 },
  controls: { gap: 10 },
  sortRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    alignSelf: "flex-start",
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  movieList: { gap: 12 },
  statusPanel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 10,
  },
  statusText: { fontSize: 12, textAlign: "center" },
});
