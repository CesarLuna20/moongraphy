import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useAppStore } from "../state/useAppStore";
import { colors, radii, spacing } from "../theme/theme";
import { SessionType } from "../services/authService";

type Props = NativeStackScreenProps<RootStackParamList, "AdminConfiguration">;

const AdminConfigurationScreen: React.FC<Props> = ({ navigation }) => {
  const user = useAppStore((state) => state.user);

  const sessionTypes = useAppStore((state) => state.sessionTypes);
  const sessionTypesLoading = useAppStore((state) => state.sessionTypesLoading);
  const sessionTypesIncludeArchived = useAppStore((state) => state.sessionTypesIncludeArchived);
  const loadSessionTypes = useAppStore((state) => state.loadSessionTypes);
  const createSessionTypeEntry = useAppStore((state) => state.createSessionTypeEntry);
  const updateSessionTypeEntryDetails = useAppStore((state) => state.updateSessionTypeEntryDetails);
  const archiveSessionTypeEntry = useAppStore((state) => state.archiveSessionTypeEntry);
  const restoreSessionTypeEntry = useAppStore((state) => state.restoreSessionTypeEntry);

  const notificationTemplates = useAppStore((state) => state.notificationTemplates);
  const notificationTemplatesLoading = useAppStore((state) => state.notificationTemplatesLoading);
  const loadNotificationTemplates = useAppStore((state) => state.loadNotificationTemplates);
  const saveNotificationTemplate = useAppStore((state) => state.saveNotificationTemplate);
  const resetNotificationTemplate = useAppStore((state) => state.resetNotificationTemplate);

  const cancellationPolicy = useAppStore((state) => state.cancellationPolicy);
  const cancellationPolicyLoading = useAppStore((state) => state.cancellationPolicyLoading);
  const loadCancellationPolicy = useAppStore((state) => state.loadCancellationPolicy);
  const saveCancellationPolicy = useAppStore((state) => state.saveCancellationPolicy);

  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeDescription, setNewTypeDescription] = useState("");
  const [creatingType, setCreatingType] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingDescription, setEditingDescription] = useState("");

  const [templateDrafts, setTemplateDrafts] = useState<Record<string, string>>({});
  const [savingTemplateKey, setSavingTemplateKey] = useState<string | null>(null);

  const [policyDraft, setPolicyDraft] = useState({
    minHoursCancel: "",
    minHoursReschedule: "",
    toleranceMinutes: ""
  });
  const [savingPolicy, setSavingPolicy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (user?.role !== "photographer-admin") {
        Alert.alert("Acceso restringido", "Esta seccion es exclusiva para administradores.", [
          { text: "Volver", onPress: () => navigation.goBack() }
        ]);
        return;
      }
      loadSessionTypes(false).catch((error) => {
        console.error("[admin-config] Error cargando tipos de sesion", error);
      });
      loadNotificationTemplates().catch((error) => {
        console.error("[admin-config] Error cargando plantillas", error);
      });
      loadCancellationPolicy().catch((error) => {
        console.error("[admin-config] Error cargando politica", error);
      });
    }, [
      user?.role,
      navigation,
      loadSessionTypes,
      loadNotificationTemplates,
      loadCancellationPolicy
    ])
  );

  useEffect(() => {
    setTemplateDrafts((prev) => {
      const next: Record<string, string> = {};
      notificationTemplates.forEach((template) => {
        next[template.key] = prev[template.key] ?? template.body;
      });
      return next;
    });
  }, [notificationTemplates]);

  useEffect(() => {
    if (!cancellationPolicy) {
      return;
    }
    setPolicyDraft({
      minHoursCancel: String(cancellationPolicy.settings.minHoursCancel),
      minHoursReschedule: String(cancellationPolicy.settings.minHoursReschedule),
      toleranceMinutes: String(cancellationPolicy.settings.toleranceMinutes)
    });
  }, [cancellationPolicy]);

  const activeSessionTypes = useMemo(
    () =>
      sessionTypesIncludeArchived
        ? sessionTypes
        : sessionTypes.filter((entry) => !entry.archived),
    [sessionTypes, sessionTypesIncludeArchived]
  );

  const handleCreateSessionType = async () => {
    const trimmedName = newTypeName.trim();
    const trimmedDescription = newTypeDescription.trim();
    if (!trimmedName) {
      Alert.alert("Datos incompletos", "Ingresa el nombre del tipo de sesion.");
      return;
    }
    setCreatingType(true);
    const result = await createSessionTypeEntry(
      trimmedName,
      trimmedDescription ? trimmedDescription : undefined
    );
    setCreatingType(false);
    if (!result.success) {
      Alert.alert("Error", result.error ?? "No se pudo crear el tipo de sesion.");
      return;
    }
    setNewTypeName("");
    setNewTypeDescription("");
  };

  const startEditingType = (type: SessionType) => {
    setEditingTypeId(type.id);
    setEditingName(type.name);
    setEditingDescription(type.description ?? "");
  };

  const cancelEditingType = () => {
    setEditingTypeId(null);
    setEditingName("");
    setEditingDescription("");
  };

  const handleUpdateSessionType = async () => {
    if (!editingTypeId) {
      return;
    }
    const trimmedName = editingName.trim();
    const trimmedDescription = editingDescription.trim();
    if (!trimmedName) {
      Alert.alert("Datos incompletos", "Ingresa el nombre del tipo de sesion.");
      return;
    }
    const result = await updateSessionTypeEntryDetails(editingTypeId, {
      name: trimmedName,
      description: trimmedDescription ? trimmedDescription : undefined
    });
    if (!result.success) {
      Alert.alert("Error", result.error ?? "No se pudo actualizar el tipo de sesion.");
      return;
    }
    cancelEditingType();
  };

  const handleArchiveSessionType = (type: SessionType) => {
    Alert.alert(
      "Archivar tipo",
      `El tipo "${type.name}" se ocultara del catalogo para nuevas sesiones.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Archivar",
          style: "destructive",
          onPress: async () => {
            const result = await archiveSessionTypeEntry(type.id);
            if (!result.success) {
              Alert.alert("Error", result.error ?? "No se pudo archivar el tipo.");
            }
          }
        }
      ]
    );
  };

  const handleRestoreSessionType = async (type: SessionType) => {
    const result = await restoreSessionTypeEntry(type.id);
    if (!result.success) {
      Alert.alert("Error", result.error ?? "No se pudo restaurar el tipo.");
    }
  };

  const handleToggleArchived = () => {
    loadSessionTypes(!sessionTypesIncludeArchived).catch((error) => {
      console.error("[admin-config] Error alternando tipos archivados", error);
    });
  };

  const handleTemplateChange = (key: string, value: string) => {
    setTemplateDrafts((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveTemplate = async (key: string) => {
    const body = (templateDrafts[key] ?? "").trim();
    if (!body) {
      Alert.alert("Datos incompletos", "La plantilla no puede quedar vacia.");
      return;
    }
    setSavingTemplateKey(key);
    const result = await saveNotificationTemplate(key, body);
    setSavingTemplateKey(null);
    if (!result.success) {
      Alert.alert("Error", result.error ?? "No se pudo actualizar la plantilla.");
      return;
    }
    setTemplateDrafts((prev) => ({
      ...prev,
      [key]: result.template.body
    }));
  };

  const handleResetTemplate = (key: string) => {
    Alert.alert(
      "Restaurar plantilla",
      "Se reemplazara el contenido personalizado por el texto por defecto. Deseas continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Restaurar",
          style: "destructive",
          onPress: async () => {
            setSavingTemplateKey(key);
            const result = await resetNotificationTemplate(key);
            setSavingTemplateKey(null);
            if (!result.success) {
              Alert.alert("Error", result.error ?? "No se pudo restaurar la plantilla.");
              return;
            }
            setTemplateDrafts((prev) => ({
              ...prev,
              [key]: result.template.body
            }));
          }
        }
      ]
    );
  };

  const handleSavePolicy = async () => {
    const minCancel = Number(policyDraft.minHoursCancel);
    const minReschedule = Number(policyDraft.minHoursReschedule);
    const tolerance = Number(policyDraft.toleranceMinutes);
    if ([minCancel, minReschedule, tolerance].some((value) => Number.isNaN(value) || value < 0)) {
      Alert.alert(
        "Datos invalidos",
        "Ingresa valores numericos validos (0 o mayores) para las politicas."
      );
      return;
    }
    setSavingPolicy(true);
    const result = await saveCancellationPolicy({
      minHoursCancel: minCancel,
      minHoursReschedule: minReschedule,
      toleranceMinutes: tolerance
    });
    setSavingPolicy(false);
    if (!result.success) {
      Alert.alert("Error", result.error ?? "No se pudieron actualizar las politicas.");
      return;
    }
    Alert.alert("Politica actualizada", "Las nuevas reglas aplicaran a sesiones futuras.");
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.screenTitle}>Configuracion avanzada</Text>
          <Text style={styles.screenSubtitle}>
            Gestiona tu catalogo de tipos de sesion, personaliza los mensajes automaticos y ajusta
            las politicas de cancelacion y reprogramacion.
          </Text>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Tipos de sesion</Text>
              <Pressable style={styles.smallButton} onPress={handleToggleArchived}>
                <Text style={styles.smallButtonText}>
                  {sessionTypesIncludeArchived ? "Ocultar archivados" : "Ver archivados"}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.sectionDescription}>
              Define las categorias que podras seleccionar al programar una sesion. Puedes activar o
              archivar tipos sin perder el historial.
            </Text>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Nuevo tipo</Text>
              <TextInput
                style={styles.input}
                placeholder="Nombre (ej. Boda, Producto, Exterior)"
                placeholderTextColor={colors.muted}
                value={newTypeName}
                onChangeText={setNewTypeName}
              />
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Descripcion opcional para el equipo"
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={3}
                value={newTypeDescription}
                onChangeText={setNewTypeDescription}
              />
              <Pressable
                style={[styles.primaryButton, creatingType && styles.primaryButtonDisabled]}
                onPress={handleCreateSessionType}
                disabled={creatingType}
              >
                <Text style={styles.primaryButtonText}>
                  {creatingType ? "Guardando..." : "Agregar tipo"}
                </Text>
              </Pressable>
            </View>

            {sessionTypesLoading && activeSessionTypes.length === 0 ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={styles.loadingText}>Cargando catalogo...</Text>
              </View>
            ) : null}

            {activeSessionTypes.map((type) => {
              const isEditing = editingTypeId === type.id;
              return (
                <View key={type.id} style={styles.card}>
                  <View style={styles.typeHeader}>
                    <View style={styles.typeHeaderText}>
                      <Text style={styles.cardTitle}>{type.name}</Text>
                      {type.archived ? (
                        <Text style={styles.badgeArchived}>Archivado</Text>
                      ) : (
                        <Text style={styles.badgeActive}>Activo</Text>
                      )}
                    </View>
                    <Text style={styles.typeMeta}>
                      Creado el {new Date(type.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  {type.description ? (
                    <Text style={styles.typeDescription}>{type.description}</Text>
                  ) : (
                    <Text style={styles.typeDescriptionMuted}>Sin descripcion</Text>
                  )}

                  {isEditing ? (
                    <View style={styles.editContainer}>
                      <TextInput
                        style={styles.input}
                        placeholder="Nombre del tipo"
                        placeholderTextColor={colors.muted}
                        value={editingName}
                        onChangeText={setEditingName}
                      />
                      <TextInput
                        style={[styles.input, styles.inputMultiline]}
                        placeholder="Descripcion"
                        placeholderTextColor={colors.muted}
                        multiline
                        numberOfLines={3}
                        value={editingDescription}
                        onChangeText={setEditingDescription}
                      />
                      <View style={styles.row}>
                        <Pressable style={styles.primaryButton} onPress={handleUpdateSessionType}>
                          <Text style={styles.primaryButtonText}>Guardar</Text>
                        </Pressable>
                        <Pressable style={styles.secondaryButton} onPress={cancelEditingType}>
                          <Text style={styles.secondaryButtonText}>Cancelar</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.row}>
                      <Pressable style={styles.secondaryButton} onPress={() => startEditingType(type)}>
                        <Text style={styles.secondaryButtonText}>Editar</Text>
                      </Pressable>
                      {type.archived ? (
                        <Pressable
                          style={styles.secondaryButton}
                          onPress={() => handleRestoreSessionType(type)}
                        >
                          <Text style={styles.secondaryButtonText}>Restaurar</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          style={styles.dangerButton}
                          onPress={() => handleArchiveSessionType(type)}
                        >
                          <Text style={styles.dangerButtonText}>Archivar</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Plantillas de mensajes</Text>
            <Text style={styles.sectionDescription}>
              Ajusta el contenido de los recordatorios automaticos. Respeta los placeholders
              indicados para insertar informacion dinamica.
            </Text>

            {notificationTemplatesLoading && notificationTemplates.length === 0 ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={styles.loadingText}>Cargando plantillas...</Text>
              </View>
            ) : null}

            {notificationTemplates.map((template) => (
              <View key={template.key} style={styles.card}>
                <Text style={styles.cardTitle}>{template.name}</Text>
                <Text style={styles.typeMeta}>Clave: {template.key}</Text>
                {template.description ? (
                  <Text style={styles.typeDescription}>{template.description}</Text>
                ) : null}
                {template.placeholders.length > 0 ? (
                  <Text style={styles.placeholderHelper}>
                    Placeholders disponibles: {template.placeholders.join(", ")}
                  </Text>
                ) : null}
                <TextInput
                  style={[styles.input, styles.templateInput]}
                  multiline
                  numberOfLines={6}
                  value={templateDrafts[template.key] ?? ""}
                  onChangeText={(value) => handleTemplateChange(template.key, value)}
                  placeholder="Contenido del mensaje"
                  placeholderTextColor={colors.muted}
                />
                <View style={styles.row}>
                  <Pressable
                    style={[
                      styles.primaryButton,
                      savingTemplateKey === template.key && styles.primaryButtonDisabled
                    ]}
                    onPress={() => handleSaveTemplate(template.key)}
                    disabled={savingTemplateKey === template.key}
                  >
                    <Text style={styles.primaryButtonText}>
                      {savingTemplateKey === template.key ? "Guardando..." : "Guardar cambios"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => handleResetTemplate(template.key)}
                    disabled={savingTemplateKey === template.key}
                  >
                    <Text style={styles.secondaryButtonText}>Restaurar por defecto</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Politicas de cancelacion</Text>
            <Text style={styles.sectionDescription}>
              Establece las reglas que aplicaran a nuevas reservas. Los cambios no afectan sesiones
              ya registradas.
            </Text>

            {cancellationPolicyLoading && !cancellationPolicy ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={styles.loadingText}>Cargando politicas...</Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <View style={styles.fieldRow}>
                <View style={styles.fieldColumn}>
                  <Text style={styles.label}>Horas min. para cancelar</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={policyDraft.minHoursCancel}
                    onChangeText={(value) =>
                      setPolicyDraft((prev) => ({ ...prev, minHoursCancel: value }))
                    }
                    placeholder="Ej. 48"
                    placeholderTextColor={colors.muted}
                  />
                </View>
                <View style={styles.fieldColumn}>
                  <Text style={styles.label}>Horas min. para reprogramar</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={policyDraft.minHoursReschedule}
                    onChangeText={(value) =>
                      setPolicyDraft((prev) => ({ ...prev, minHoursReschedule: value }))
                    }
                    placeholder="Ej. 24"
                    placeholderTextColor={colors.muted}
                  />
                </View>
              </View>
              <View style={styles.fieldColumn}>
                <Text style={styles.label}>Tolerancia (minutos)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={policyDraft.toleranceMinutes}
                  onChangeText={(value) =>
                    setPolicyDraft((prev) => ({ ...prev, toleranceMinutes: value }))
                  }
                  placeholder="Ej. 15"
                  placeholderTextColor={colors.muted}
                />
              </View>
              <Pressable
                style={[styles.primaryButton, savingPolicy && styles.primaryButtonDisabled]}
                onPress={handleSavePolicy}
                disabled={savingPolicy}
              >
                <Text style={styles.primaryButtonText}>
                  {savingPolicy ? "Guardando..." : "Guardar politicas"}
                </Text>
              </Pressable>
              {cancellationPolicy ? (
                <Text style={styles.policyMeta}>
                  Version actual: {cancellationPolicy.version} ・ Actualizado el{" "}
                  {new Date(cancellationPolicy.createdAt).toLocaleString()}
                </Text>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  flex: {
    flex: 1
  },
  content: {
    padding: spacing(2),
    gap: spacing(2),
    paddingBottom: spacing(6)
  },
  screenTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800"
  },
  screenSubtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  section: {
    backgroundColor: "transparent",
    gap: spacing(1.5)
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700"
  },
  sectionDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2),
    gap: spacing(1)
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  typeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing(1)
  },
  typeHeaderText: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1)
  },
  typeMeta: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "right"
  },
  typeDescription: {
    color: colors.text,
    fontSize: 14
  },
  typeDescriptionMuted: {
    color: colors.muted,
    fontSize: 14,
    fontStyle: "italic"
  },
  editContainer: {
    gap: spacing(1)
  },
  placeholderHelper: {
    color: colors.muted,
    fontSize: 12
  },
  badgeActive: {
    backgroundColor: "rgba(83,215,105,0.18)",
    color: colors.success,
    paddingHorizontal: spacing(1),
    paddingVertical: spacing(0.25),
    borderRadius: radii.sm,
    fontSize: 11,
    fontWeight: "700"
  },
  badgeArchived: {
    backgroundColor: "rgba(255,59,48,0.18)",
    color: colors.danger,
    paddingHorizontal: spacing(1),
    paddingVertical: spacing(0.25),
    borderRadius: radii.sm,
    fontSize: 11,
    fontWeight: "700"
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(1)
  },
  fieldRow: {
    flexDirection: "row",
    gap: spacing(1)
  },
  fieldColumn: {
    flex: 1,
    gap: spacing(0.75)
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600"
  },
  input: {
    backgroundColor: colors.bg,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1),
    fontSize: 15
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: "top"
  },
  templateInput: {
    minHeight: 140,
    textAlignVertical: "top"
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.1),
    alignItems: "center"
  },
  primaryButtonDisabled: {
    opacity: 0.6
  },
  primaryButtonText: {
    color: colors.text,
    fontWeight: "700"
  },
  secondaryButton: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.1),
    alignItems: "center"
  },
  secondaryButtonText: {
    color: colors.muted,
    fontWeight: "600"
  },
  dangerButton: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.1),
    alignItems: "center"
  },
  dangerButtonText: {
    color: colors.danger,
    fontWeight: "700"
  },
  smallButton: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.75)
  },
  smallButtonText: {
    color: colors.primary,
    fontWeight: "600"
  },
  loadingState: {
    alignItems: "center",
    gap: spacing(1)
  },
  loadingText: {
    color: colors.muted
  },
  policyMeta: {
    color: colors.muted,
    fontSize: 12
  }
});

export default AdminConfigurationScreen;
