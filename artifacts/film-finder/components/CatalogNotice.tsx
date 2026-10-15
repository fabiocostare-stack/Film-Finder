import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

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
