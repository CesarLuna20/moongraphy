import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  Pressable
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { colors, radii, spacing } from "../theme/theme";
import { useAppStore } from "../state/useAppStore";
import { AvailabilitySlot } from "../services/authService";

type Props = NativeStackScreenProps<RootStackParamList, "Availability">;

type DayAvailability = {
  id?: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
};

const dayNames = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const buildInitialState = (slots: AvailabilitySlot[]): Record<number, DayAvailability> => {
  const base: Record<number, DayAvailability> = {};
  for (let day = 0; day < 7; day += 1) {
    base[day] = {
      enabled: false,
      startTime: "09:00",
      endTime: "18:00"
    };
  }
  slots.forEach((slot) => {
    if (slot.dayOfWeek >= 0 && slot.dayOfWeek <= 6) {
      base[slot.dayOfWeek] = {
        id: slot.id,
        enabled: true,
        startTime: slot.startTime,
        endTime: slot.endTime
      };
    }
  });
  return base;
};

const AvailabilityScreen = ({ navigation }: Props) => {
  const user = useAppStore((state) => state.user);
  const availability = useAppStore((state) => state.availability);
  const availabilityLoading = useAppStore((state) => state.availabilityLoading);
  const loadAvailability = useAppStore((state) => state.loadAvailability);
  const saveAvailability = useAppStore((state) => state.saveAvailability);

  const isPhotographer =
    user?.role === "photographer" || user?.role === "photographer-admin";

  const [formState, setFormState] = useState<Record<number, DayAvailability>>(() =>
    buildInitialState(availability)
  );

  useEffect(() => {
    if (isPhotographer) {
      loadAvailability();
    }
  }, [isPhotographer, loadAvailability]);

  useEffect(() => {
    setFormState(buildInitialState(availability));
  }, [availability]);

  const handleToggleDay = (day: number, enabled: boolean) => {
    setFormState((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled
      }
    }));
  };

  const handleChangeTime = (day: number, key: "startTime" | "endTime", value: string) => {
    setFormState((prev) => {
      const current = prev[day] ?? { enabled: false, startTime: "09:00", endTime: "18:00" };
      return {
        ...prev,
        [day]: {
          ...current,
          [key]: value
        }
      };
    });
  };

  const handleSave = async () => {
    if (!isPhotographer) {
      Alert.alert("Sin permisos", "Solo los fotografos pueden modificar su disponibilidad.");
      return;
    }
    const slots: AvailabilitySlot[] = [];
    for (let day = 0; day < 7; day += 1) {
      const entry = formState[day];
      if (!entry || !entry.enabled) {
        continue;
      }
      const { startTime, endTime, id } = entry;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        Alert.alert("Horario invalido", `Revisa los horarios del dia ${dayNames[day]}. Usa el formato HH:mm.`);
        return;
      }
      const [startHour, startMinute] = startTime.split(":").map((part) => Number.parseInt(part, 10));
      const [endHour, endMinute] = endTime.split(":").map((part) => Number.parseInt(part, 10));
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      if (endMinutes <= startMinutes) {
        Alert.alert(
          "Horario invalido",
          `La hora de fin debe ser posterior a la de inicio para ${dayNames[day]}.`
        );
        return;
      }
      slots.push({
        id,
        dayOfWeek: day,
        startTime,
        endTime
      });
    }
    const result = await saveAvailability(slots);
    if (!result.success && result.error) {
      Alert.alert("Error", result.error);
      return;
    }
    Alert.alert("Disponibilidad actualizada", "Tu disponibilidad laboral se guardo correctamente.");
  };

  if (!isPhotographer) {
    return (
      <View style={styles.container}>
        <View style={styles.messageCard}>
          <Text style={styles.messageTitle}>Acceso restringido</Text>
          <Text style={styles.messageBody}>
            Solo los fotografos pueden definir su disponibilidad. Comunicate con el administrador si necesitas
            realizar cambios.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryButtonText}>Volver</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Disponibilidad laboral</Text>
          <Text style={styles.subtitle}>
            Ajusta los dias y horarios en los que aceptas sesiones. Estos rangos se validaran al crear o editar citas.
          </Text>
        </View>

        {availabilityLoading ? (
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        ) : (
          dayNames.map((name, index) => {
            const entry = formState[index];
            const enabled = entry?.enabled ?? false;
            return (
              <View key={name} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayTitle}>{name}</Text>
                  <Switch
                    value={enabled}
                    onValueChange={(value) => handleToggleDay(index, value)}
                    thumbColor={enabled ? colors.accent : colors.border}
                    trackColor={{ true: colors.accent, false: colors.border }}
                  />
                </View>
                {enabled ? (
                  <View style={styles.timeRow}>
                    <View style={styles.timeField}>
                      <Text style={styles.timeLabel}>Inicio (HH:mm)</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={entry?.startTime ?? "09:00"}
                        onChangeText={(value) => handleChangeTime(index, "startTime", value)}
                        placeholder="09:00"
                        placeholderTextColor={colors.muted}
                      />
                    </View>
                    <View style={styles.timeField}>
                      <Text style={styles.timeLabel}>Fin (HH:mm)</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={entry?.endTime ?? "18:00"}
                        onChangeText={(value) => handleChangeTime(index, "endTime", value)}
                        placeholder="18:00"
                        placeholderTextColor={colors.muted}
                      />
                    </View>
                  </View>
                ) : (
                  <Text style={styles.dayHint}>Dia deshabilitado</Text>
                )}
              </View>
            );
          })
        )}

        <Pressable style={[styles.primaryButton, styles.saveButton, availabilityLoading && styles.disabledButton]} onPress={handleSave}>
          <Text style={styles.primaryButtonText}>Guardar disponibilidad</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  scrollContent: {
    padding: spacing(2),
    gap: spacing(2),
    paddingBottom: spacing(4)
  },
  header: {
    gap: spacing(1)
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
  loader: {
    marginTop: spacing(2)
  },
  dayCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing(2),
    gap: spacing(1),
    borderWidth: 1,
    borderColor: colors.border
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  dayTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700"
  },
  dayHint: {
    color: colors.muted,
    fontStyle: "italic"
  },
  timeRow: {
    flexDirection: "row",
    gap: spacing(1)
  },
  timeField: {
    flex: 1,
    gap: spacing(0.5)
  },
  timeLabel: {
    color: colors.muted,
    fontSize: 13
  },
  timeInput: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1),
    color: colors.text,
    fontSize: 15
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing(1.25),
    alignItems: "center"
  },
  primaryButtonText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 16
  },
  saveButton: {
    marginTop: spacing(1)
  },
  disabledButton: {
    opacity: 0.6
  },
  messageCard: {
    margin: spacing(2),
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing(3),
    gap: spacing(1.5),
    borderWidth: 1,
    borderColor: colors.border,
    flexGrow: 1,
    justifyContent: "center"
  },
  messageTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700"
  },
  messageBody: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 20
  }
});

export default AvailabilityScreen;
