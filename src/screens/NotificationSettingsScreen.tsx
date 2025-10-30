import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useAppStore } from "../state/useAppStore";
import { colors, radii, spacing } from "../theme/theme";
import { NotificationPreferences } from "../services/authService";

export default function NotificationSettingsScreen() {
  const preferences = useAppStore((state) => state.notificationPreferences);
  const updatePreferences = useAppStore((state) => state.updateNotificationPreferences);

  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences>(preferences);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalPrefs(preferences);
  }, [preferences]);

  const handleToggle = (key: keyof NotificationPreferences) => (value: boolean) => {
    setLocalPrefs((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await updatePreferences(localPrefs);
    setSaving(false);
    if (!result.success) {
      Alert.alert("Error", result.error ?? "No se pudieron actualizar las alertas.");
      return;
    }
    Alert.alert("Preferencias actualizadas", "Tus alertas se guardaron correctamente.");
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Configuracion de alertas</Text>
      <Text style={styles.subtitle}>
        Ajusta los canales y tipos de notificaciones push e in-app que deseas recibir.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Canales</Text>
        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Push</Text>
          <Switch value={localPrefs.pushEnabled} onValueChange={handleToggle("pushEnabled")} />
        </View>
        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>In-app</Text>
          <Switch value={localPrefs.inAppEnabled} onValueChange={handleToggle("inAppEnabled")} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tipos de alerta</Text>
        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Confirmaciones y altas</Text>
          <Switch value={localPrefs.confirmation} onValueChange={handleToggle("confirmation")} />
        </View>
        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Recordatorios 48h</Text>
          <Switch value={localPrefs.reminder48h} onValueChange={handleToggle("reminder48h")} />
        </View>
        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Recordatorios 24h</Text>
          <Switch value={localPrefs.reminder24h} onValueChange={handleToggle("reminder24h")} />
        </View>
        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Cambios y cancelaciones</Text>
          <Switch value={localPrefs.changes} onValueChange={handleToggle("changes")} />
        </View>
      </View>

      <Pressable
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>{saving ? "Guardando..." : "Guardar cambios"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing(2),
    gap: spacing(2),
    backgroundColor: colors.bg,
    paddingBottom: spacing(4)
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700"
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2),
    gap: spacing(1.5)
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700"
  },
  preferenceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing(0.5)
  },
  preferenceLabel: {
    color: colors.text,
    fontSize: 15
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing(1.5),
    alignItems: "center"
  },
  saveButtonDisabled: {
    opacity: 0.6
  },
  saveButtonText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 16
  }
});
