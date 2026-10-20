import { useListMovieProviders, getListMovieProvidersQueryKey } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  CatalogNotice,
  getCatalogErrorMessage,
} from "@/components/CatalogNotice";
import { usePreferences } from "@/context/PreferencesContext";
import { useColors } from "@/hooks/useColors";

export default function PlatformOnboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    isReady,
    preferences,
    toggleProvider,
    completePlatformSetup,
  } = usePreferences();
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
  const selectedCount = preferences.selectedProviders.length;
  const topInset = Platform.OS === "web" ? 67 : insets.top + 14;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom + 12;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset, paddingBottom: 170 + bottomInset },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <View style={[styles.brandMark, { backgroundColor: colors.accent }]}>
            <Feather name="film" size={15} color={colors.primary} />
          </View>
          <Text style={[styles.brandName, { color: colors.foreground }]}>
            FILM FINDER
          </Text>
          <Text style={[styles.step, { color: colors.mutedForeground }]}>
            CONFIGURAZIONE · 1/1
          </Text>
        </View>

        <View style={[styles.hero, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            PRIMA DI COMINCIARE
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Dove guardi i film?
          </Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>
            Seleziona i servizi che hai. Ti proporremo solo titoli disponibili
            lì, scelti in base ai film che hai già visto e alle loro valutazioni.
          </Text>
          <View style={[styles.qualityNote, { backgroundColor: colors.accent }]}>
            <Feather name="check-circle" size={16} color={colors.primary} />
            <Text style={[styles.qualityText, { color: colors.foreground }]}>
              Prima piattaforme e affinità, poi il catalogo.
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Le tue piattaforme
            </Text>
            <Text style={[styles.sectionCaption, { color: colors.mutedForeground }]}>
              Catalogo streaming in Italia
            </Text>
          </View>
          <View style={[styles.countPill, { borderColor: colors.border }]}>
            <Text style={[styles.countText, { color: colors.primary }]}>
              {selectedCount}
            </Text>
            <Text style={[styles.countLabel, { color: colors.mutedForeground }]}>
              scelte
            </Text>
          </View>
        </View>

        {providers.isLoading ? (
          <View style={[styles.statusPanel, { borderColor: colors.border }]}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
              Carico i servizi disponibili…
            </Text>
          </View>
        ) : providers.isError ? (
          <CatalogNotice
            title="Piattaforme non disponibili"
            message={getCatalogErrorMessage(
              providers.error,
              "Non è stato possibile caricare i servizi. Verifica la connessione e riprova.",
            )}
            onRetry={() => void providers.refetch()}
          />
        ) : (
          <View style={styles.providerGrid}>
            {providers.data?.results.map((provider) => {
              const selected = preferences.selectedProviders.some(
                (item) => item.id === provider.id,
              );
              return (
                <Pressable
                  key={provider.id}
                  testID={`onboarding-provider-${provider.id}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => toggleProvider(provider)}
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
            })}
            {providers.data?.results.length === 0 ? (
              <Text style={[styles.sectionCaption, { color: colors.mutedForeground }]}>
                Nessuna piattaforma trovata per questa regione.
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            borderColor: colors.border,
            backgroundColor: colors.background,
            paddingBottom: bottomInset,
          },
        ]}
      >
        <Text style={[styles.footerHint, { color: colors.mutedForeground }]}>
          Potrai aggiornare la selezione in Profilo.
        </Text>
        <Pressable
          testID="complete-platform-setup"
          accessibilityRole="button"
          accessibilityState={{ disabled: selectedCount === 0 }}
          disabled={selectedCount === 0}
          onPress={completePlatformSetup}
          style={({ pressed }) => [
            styles.continueButton,
            {
              backgroundColor: colors.primary,
              opacity: selectedCount === 0 ? 0.45 : pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={[styles.continueText, { color: colors.primaryForeground }]}>
            {selectedCount === 0
              ? "Scegli almeno una piattaforma"
              : "Vai ai tuoi consigli"}
          </Text>
          <Feather
            name="arrow-right"
            size={17}
            color={colors.primaryForeground}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 22 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1.5 },
  step: { marginLeft: "auto", fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.7 },
  hero: { padding: 20, borderWidth: 1, borderRadius: 22, gap: 12 },
  eyebrow: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.8 },
  title: { fontSize: 31, lineHeight: 36, letterSpacing: -1, fontFamily: "Inter_700Bold" },
  description: { fontSize: 13, lineHeight: 20 },
  qualityNote: {
    marginTop: 3,
    padding: 11,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  qualityText: { flex: 1, fontSize: 11, lineHeight: 16, fontFamily: "Inter_500Medium" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  sectionCaption: { marginTop: 4, fontSize: 11, lineHeight: 16 },
  countPill: {
    minWidth: 66,
    minHeight: 40,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  countText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  countLabel: { fontSize: 9, fontFamily: "Inter_500Medium" },
  statusPanel: {
    minHeight: 86,
    borderWidth: 1,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  statusText: { fontSize: 12 },
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
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
  },
  footerHint: { textAlign: "center", fontSize: 10 },
  continueButton: {
    minHeight: 52,
    paddingHorizontal: 17,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  continueText: { fontSize: 13, fontFamily: "Inter_700Bold" },
});
