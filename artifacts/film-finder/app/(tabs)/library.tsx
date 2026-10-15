import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FilmCard } from "@/components/FilmCard";
import { usePreferences } from "@/context/PreferencesContext";
import { useColors } from "@/hooks/useColors";

export default function LibraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { preferences, toggleLikedMovie, toggleSavedMovie } = usePreferences();
  const savedIds = new Set(preferences.savedMovies.map((movie) => movie.id));

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Platform.OS === "web" ? 67 : insets.top + 10,
          paddingBottom: Platform.OS === "web" ? 110 : 36,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.eyebrow, { color: colors.primary }]}>LA TUA CINETECA</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>La mia lista</Text>
      <Text style={[styles.description, { color: colors.mutedForeground }]}>
        Film da guardare e storie che ti sono rimaste.
      </Text>

      <SectionTitle
        icon="bookmark"
        title="Da guardare"
        count={preferences.savedMovies.length}
      />
      {preferences.savedMovies.length > 0 ? (
        <View style={styles.list}>
          {preferences.savedMovies.map((movie) => (
            <FilmCard
              key={`saved-${movie.id}`}
              movie={movie}
              isLiked={preferences.likedMovies.some((item) => item.id === movie.id)}
              isSaved={savedIds.has(movie.id)}
              onToggleLike={toggleLikedMovie}
              onToggleSave={toggleSavedMovie}
            />
          ))}
        </View>
      ) : (
        <EmptyCollection
          icon="bookmark"
          title="La lista è ancora vuota"
          message="Aggiungi qui i film che vuoi tenere da parte."
        />
      )}

      <SectionTitle
        icon="heart"
        title="Mi piacciono"
        count={preferences.likedMovies.length}
      />
      {preferences.likedMovies.length > 0 ? (
        <View style={styles.list}>
          {preferences.likedMovies.map((movie) => (
            <FilmCard
              key={`liked-${movie.id}`}
              movie={movie}
              isLiked
              isSaved={savedIds.has(movie.id)}
              onToggleLike={toggleLikedMovie}
              onToggleSave={toggleSavedMovie}
            />
          ))}
        </View>
      ) : (
        <EmptyCollection
          icon="heart"
          title="Ancora nessun preferito"
          message="Cerca un film e tocca il cuore: i tuoi gusti aiuteranno a scegliere i prossimi."
        />
      )}
    </ScrollView>
  );
}

function SectionTitle({
  icon,
  title,
  count,
}: {
  icon: "bookmark" | "heart";
  title: string;
  count: number;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionLead}>
        <Feather name={icon} size={17} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {title}
        </Text>
      </View>
      <Text style={[styles.count, { color: colors.mutedForeground }]}>{count}</Text>
    </View>
  );
}

function EmptyCollection({
  icon,
  title,
  message,
}: {
  icon: "bookmark" | "heart";
  title: string;
  message: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.empty, { borderColor: colors.border }]}>
      <Feather name={icon} size={19} color={colors.primary} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: colors.mutedForeground }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 15 },
  eyebrow: { marginTop: 6, fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 2.4 },
  title: { marginTop: -5, fontSize: 32, letterSpacing: -1, fontFamily: "Inter_700Bold" },
  description: { marginTop: -9, marginBottom: 12, fontSize: 14, lineHeight: 21 },
  sectionTitleRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionLead: { flexDirection: "row", alignItems: "center", gap: 9 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  count: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  list: { gap: 13 },
  empty: {
    minHeight: 142,
    padding: 20,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptyMessage: { maxWidth: 290, textAlign: "center", fontSize: 12, lineHeight: 18 },
});
