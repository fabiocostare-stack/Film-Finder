import { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Feather } from "@expo/vector-icons";
import {
  getSearchMoviesQueryKey,
  useSearchMovies,
} from "@workspace/api-client-react";
import type { SearchMoviesParams } from "@workspace/api-client-react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CatalogNotice } from "@/components/CatalogNotice";
import { FilmCard } from "@/components/FilmCard";
import { usePreferences } from "@/context/PreferencesContext";
import { useColors } from "@/hooks/useColors";

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { preferences, toggleLikedMovie, toggleSavedMovie } = usePreferences();
  const [draft, setDraft] = useState<string>("");
  const [submitted, setSubmitted] = useState<string>("");
  const searchParams: SearchMoviesParams = {
    query: submitted,
    page: 1,
    region: "IT",
  };
  const search = useSearchMovies(searchParams, {
    query: {
      enabled: submitted.trim().length >= 2,
      queryKey: getSearchMoviesQueryKey(searchParams),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: false,
    },
  });

  const submit = () => {
    const query = draft.trim();
    if (query.length >= 2) {
      setSubmitted(query);
      Keyboard.dismiss();
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top + 10,
            paddingBottom: Platform.OS === "web" ? 110 : 36,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.eyebrow, { color: colors.primary }]}>ESPLORA</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Cerca quel{"\n"}film che hai in mente.
        </Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]}>
          Trova un titolo e aggiungilo ai film che ami o alla lista da guardare.
        </Text>

        <View
          style={[
            styles.searchBox,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          <Feather name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            testID="movie-search-input"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={submit}
            placeholder="Titolo del film"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
            autoCapitalize="sentences"
            accessibilityLabel="Cerca un film per titolo"
            style={[styles.searchInput, { color: colors.foreground }]}
          />
          <Pressable
            testID="movie-search-submit"
            accessibilityRole="button"
            accessibilityLabel="Avvia la ricerca"
            onPress={submit}
            disabled={draft.trim().length < 2}
            style={({ pressed }) => [
              styles.searchAction,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.7 : draft.trim().length < 2 ? 0.5 : 1,
              },
            ]}
          >
            <Feather name="arrow-up" size={17} color={colors.primaryForeground} />
          </Pressable>
        </View>

        {!submitted ? (
          <View style={[styles.hint, { borderColor: colors.border }]}>
            <Feather name="search" size={20} color={colors.primary} />
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              Cerca per titolo, anche nella sua lingua originale.
            </Text>
          </View>
        ) : search.isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              Cerco nel catalogo…
            </Text>
          </View>
        ) : search.isError ? (
          <CatalogNotice
            title="Ricerca non disponibile"
            message="Il catalogo reale non è ancora collegato. Aggiungi una chiave API TMDB ai Secrets del progetto e riprova."
            onRetry={() => void search.refetch()}
          />
        ) : search.data?.results.length ? (
          <View style={styles.results}>
            <Text style={[styles.resultsTitle, { color: colors.foreground }]}>
              {search.data.totalResults.toLocaleString("it-IT")} risultati
            </Text>
            {search.data.results.map((movie) => (
              <FilmCard
                key={movie.id}
                movie={movie}
                isLiked={preferences.likedMovies.some((item) => item.id === movie.id)}
                isSaved={preferences.savedMovies.some((item) => item.id === movie.id)}
                onToggleLike={toggleLikedMovie}
                onToggleSave={toggleSavedMovie}
              />
            ))}
          </View>
        ) : (
          <View style={[styles.hint, { borderColor: colors.border }]}>
            <Feather name="film" size={20} color={colors.primary} />
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              Nessun film trovato per “{submitted}”. Prova un altro titolo.
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  eyebrow: { marginTop: 6, fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 2.4 },
  title: { fontSize: 32, lineHeight: 38, letterSpacing: -1, fontFamily: "Inter_700Bold" },
  description: { maxWidth: 330, fontSize: 14, lineHeight: 21 },
  searchBox: {
    minHeight: 58,
    marginTop: 8,
    paddingLeft: 16,
    paddingRight: 7,
    borderWidth: 1,
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  searchInput: { flex: 1, minHeight: 48, fontSize: 15, fontFamily: "Inter_400Regular" },
  searchAction: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    marginTop: 10,
    minHeight: 92,
    padding: 18,
    borderWidth: 1,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  hintText: { flex: 1, fontSize: 13, lineHeight: 20 },
  loading: { minHeight: 160, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { fontSize: 13 },
  results: { gap: 14, marginTop: 7 },
  resultsTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
