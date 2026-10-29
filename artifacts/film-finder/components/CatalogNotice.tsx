import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

export function getCatalogErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (!error || typeof error !== "object") return fallback;

  const failure = error as {
    data?: unknown;
    message?: unknown;
    status?: unknown;
  };
  const data =
    failure.data && typeof failure.data === "object"
      ? (failure.data as Record<string, unknown>)
      : undefined;
  const code = typeof data?.code === "string" ? data.code : undefined;
  const apiMessage = typeof data?.error === "string" ? data.error.trim() : "";

  if (code === "movie_service_not_configured") {
    return "Il catalogo film non è ancora configurato. Inserisci la tua chiave API gratuita di TMDB nella scheda Profilo per iniziare.";
  }
  if (code === "movie_service_credentials_invalid") {
    return "TMDB ha rifiutato la chiave inserita. Verifica di aver inserito una chiave API TMDB attiva e corretta nella scheda Profilo.";
  }
  if (code === "movie_catalog_rate_limited") {
    return "TMDB sta limitando temporaneamente le richieste. Attendi qualche secondo e riprova.";
  }
  if (apiMessage) return apiMessage;

  const message =
    typeof failure.message === "string" ? failure.message.toLowerCase() : "";
  if (
    error instanceof TypeError ||
    /network request failed|failed to fetch|network error|timed out|timeout/.test(
      message,
    )
  ) {
    return "Il telefono non riesce a raggiungere il server di Film Finder. Verifica la connessione e riprova.";
  }

  if (failure.status === 401 || failure.status === 403) {
    return "Il server non ha autorizzato la richiesta. Controlla la configurazione del catalogo e riprova.";
  }
  if (typeof failure.status === "number" && failure.status >= 500) {
    return "Il server del catalogo ha avuto un problema temporaneo. Riprova tra poco.";
  }

  return fallback;
}

export function CatalogNotice({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  const colors = useColors();
  return (
    <View
      testID="catalog-unavailable"
      style={[
        styles.panel,
        { borderColor: colors.border, backgroundColor: colors.card },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.accent }]}>
        <Feather name="wifi-off" size={18} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [
          styles.retry,
          { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Feather name="refresh-cw" size={13} color={colors.foreground} />
        <Text style={[styles.retryText, { color: colors.foreground }]}>Riprova</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: 20,
    borderWidth: 1,
    borderRadius: 19,
    alignItems: "center",
    gap: 10,
  },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  message: { fontSize: 11, lineHeight: 17, textAlign: "center" },
  retry: {
    marginTop: 2,
    minHeight: 36,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  retryText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
});
