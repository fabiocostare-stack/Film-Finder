import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  getListMovieProvidersQueryKey,
  useListMovieProviders,
  type MovieProvider,
} from "@workspace/api-client-react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CatalogNotice,
  getCatalogErrorMessage,
} from "@/components/CatalogNotice";
import { usePreferences } from "@/context/PreferencesContext";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    preferences,
    isReady,
    storageError,
    saveTaste,
    toggleProvider,
    clearRecommendationHistory,
  } = usePreferences();
  const [draftTaste, setDraftTaste] = useState<string>(preferences.taste);
  const [saved, setSaved] = useState<boolean>(true);
  const providers = useListMovieProviders(
    { region: "IT" },
    {
      query: {
        enabled: isReady,
        queryKey: getListMovieProvidersQueryKey({ region: "IT" }),
        staleTime: 12 * 60 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  );

  const toggleTasteDraft = (value: string) => {
    setDraftTaste(value);
    setSaved(value.trim() === preferences.taste);
  };

  const submitTaste = () => {
    saveTaste(draftTaste.trim());
    setSaved(true);
  };

  const contentTop = Platform.OS === "web" ? 67 : insets.top + 10;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: contentTop,
          paddingBottom: Platform.OS === "web" ? 110 : 36,
        },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.eyebrow, { color: colors.primary }]}>IL TUO PROFILO</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>I tuoi gusti.</Text>
      <Text style={[styles.description, { color: colors.mutedForeground }]}>
        Ci basta sapere cosa guardi volentieri. Le preferenze restano su questo dispositivo.
      </Text>

      <View style={[styles.panel, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <View style={styles.panelHeading}>
          <View style={[styles.iconTile, { backgroundColor: colors.accent }]}>
            <Feather name="edit-3" size={16} color={colors.primary} />
          </View>
          <View style={styles.panelHeadingCopy}>
            <Text style={[styles.panelTitle, { color: colors.foreground }]}>
              Descrivici cosa ti piace
            </Text>
            <Text style={[styles.panelCaption, { color: colors.mutedForeground }]}>
              Generi, atmosfere, ritmo o storie.
            </Text>
          </View>
        </View>
        <TextInput
          key={isReady ? "preferences-ready" : "preferences-loading"}
          testID="taste-description"
          defaultValue={preferences.taste}
          onChangeText={toggleTasteDraft}
          multiline
          maxLength={500}
          textAlignVertical="top"
          placeholder="Per esempio: thriller pieni di suspense, fantascienza con idee originali e commedie leggere."
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel="Descrivi i film che ti piace guardare"
          style={[
            styles.tasteInput,
            {
              color: colors.foreground,
              borderColor: colors.border,
              backgroundColor: colors.background,
            },
          ]}
        />
        <View style={styles.saveRow}>
          <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
            {draftTaste.length}/500
          </Text>
          <Pressable
            testID="save-taste"
            accessibilityRole="button"
            disabled={saved}
            onPress={submitTaste}
            style={({ pressed }) => [
              styles.saveButton,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.75 : saved ? 0.55 : 1,
              },
            ]}
          >
            <Feather
              name={saved ? "check" : "save"}
              size={15}
              color={colors.primaryForeground}
            />
            <Text style={[styles.saveButtonText, { color: colors.primaryForeground }]}>
              {saved ? "Salvato" : "Salva i gusti"}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.providerHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Le tue piattaforme
          </Text>
          <Text style={[styles.sectionCaption, { color: colors.mutedForeground }]}>
            Seleziona solo i servizi che hai.
          </Text>
        </View>
        <Feather name="tv" size={18} color={colors.primary} />
      </View>

      {providers.isLoading ? (
        <View style={[styles.loadingBox, { borderColor: colors.border }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Carico le piattaforme in Italia…
          </Text>
        </View>
      ) : providers.isError ? (
        <CatalogNotice
          title="Piattaforme non disponibili"
          message={getCatalogErrorMessage(
            providers.error,
            "Non è stato possibile caricare le piattaforme. Verifica la connessione e riprova.",
          )}
          onRetry={() => void providers.refetch()}
        />
      ) : (
        <View style={styles.providerGrid}>
          {providers.data?.results.map((provider) => (
            <ProviderChip
              key={provider.id}
              provider={provider}
              selected={preferences.selectedProviders.some(
                (item) => item.id === provider.id,
              )}
              onPress={() => toggleProvider(provider)}
            />
          ))}
          {providers.data?.results.length === 0 && (
            <Text style={[styles.sectionCaption, { color: colors.mutedForeground }]}>
              Nessuna piattaforma trovata per questa regione.
            </Text>
          )}
        </View>
      )}

      <View style={[styles.historyPanel, { borderColor: colors.border }]}>
        <View style={styles.historyCopy}>
          <Text style={[styles.panelTitle, { color: colors.foreground }]}>
            Varietà dei consigli
          </Text>
          <Text style={[styles.panelCaption, { color: colors.mutedForeground }]}>
            Evitiamo di riproporre titoli già mostrati.
          </Text>
        </View>
        <Text style={[styles.historyCount, { color: colors.primary }]}>
          {preferences.seenMovieIds.length}
        </Text>
        <Pressable
          testID="clear-recommendation-history"
          accessibilityRole="button"
          accessibilityLabel="Azzera la cronologia dei consigli"
          onPress={clearRecommendationHistory}
          style={({ pressed }) => [
            styles.resetButton,
            { borderColor: colors.border, opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Feather name="rotate-ccw" size={15} color={colors.foreground} />
          <Text style={[styles.resetText, { color: colors.foreground }]}>Azzera</Text>
        </Pressable>
      </View>

      {storageError ? (
        <Text style={[styles.storageError, { color: colors.destructive }]}>
          Non è stato possibile salvare alcune preferenze su questo dispositivo.
        </Text>
      ) : null}

      <View style={[styles.credit, { borderColor: colors.border }]}>
        <Text style={[styles.creditTitle, { color: colors.foreground }]}>
          Dati del catalogo
        </Text>
        <Text style={[styles.creditText, { color: colors.mutedForeground }]}>
          Questo prodotto usa l’API TMDB ma non è approvato né certificato da TMDB.
        </Text>
      </View>
    </ScrollView>
  );
}

function ProviderChip({
  provider,
  selected,
  onPress,
}: {
  provider: MovieProvider;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={`provider-${provider.id}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.providerChip,
        {
          backgroundColor: selected ? colors.accent : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.providerName,
          { color: selected ? colors.foreground : colors.mutedForeground },
        ]}
      >
        {provider.name}
      </Text>
      <Feather
        name={selected ? "check-circle" : "plus-circle"}
        size={16}
        color={selected ? colors.primary : colors.mutedForeground}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 18 },
  eyebrow: { marginTop: 6, fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 2.4 },
  title: { marginTop: -7, fontSize: 32, letterSpacing: -1, fontFamily: "Inter_700Bold" },
  description: { marginTop: -10, marginBottom: 3, fontSize: 13, lineHeight: 20 },
  panel: { padding: 17, borderWidth: 1, borderRadius: 20, gap: 14 },
  panelHeading: { flexDirection: "row", alignItems: "center", gap: 11 },
  iconTile: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  panelHeadingCopy: { flex: 1 },
  panelTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  panelCaption: { marginTop: 4, fontSize: 11, lineHeight: 16 },
  tasteInput: {
    minHeight: 112,
    padding: 13,
    borderWidth: 1,
    borderRadius: 14,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
  saveRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  charCount: { fontSize: 10 },
  saveButton: {
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  saveButtonText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  providerHeader: {
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  sectionCaption: { marginTop: 4, fontSize: 11, lineHeight: 16 },
  loadingBox: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  loadingText: { fontSize: 12 },
  providerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  providerChip: {
    minHeight: 42,
    maxWidth: "100%",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  providerName: { maxWidth: 195, fontSize: 11, fontFamily: "Inter_500Medium" },
  historyPanel: {
    padding: 15,
    borderWidth: 1,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  historyCopy: { flex: 1 },
  historyCount: { fontSize: 18, fontFamily: "Inter_700Bold" },
  resetButton: {
    minHeight: 35,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  resetText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  storageError: { fontSize: 11, lineHeight: 17 },
  credit: { marginTop: 1, paddingTop: 15, borderTopWidth: 1, gap: 6 },
  creditTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  creditText: { fontSize: 10, lineHeight: 16 },
});
