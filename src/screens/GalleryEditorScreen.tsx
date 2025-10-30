import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { colors, radii, spacing } from "../theme/theme";
import { useAppStore } from "../state/useAppStore";
import { Session } from "../services/authService";

type Props = NativeStackScreenProps<RootStackParamList, "GalleryEditor">;

const GalleryEditorScreen: React.FC<Props> = ({ route, navigation }) => {
  const { mode, galleryId } = route.params;

  const user = useAppStore((state) => state.user);
  const sessions = useAppStore((state) => state.sessions);
  const sessionsLoading = useAppStore((state) => state.sessionsLoading);
  const loadSessions = useAppStore((state) => state.loadSessions);
  const createGalleryEntry = useAppStore((state) => state.createGalleryEntry);
  const updateGalleryEntry = useAppStore((state) => state.updateGalleryEntry);
  const fetchGallery = useAppStore((state) => state.fetchGallery);
  const galleries = useAppStore((state) => state.galleries);

  const isEdit = mode === "edit" && galleryId;

  const gallery = useMemo(
    () => (galleryId ? galleries.find((item) => item.id === galleryId) : undefined),
    [galleries, galleryId]
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedSession, setSelectedSession] = useState<Session | undefined>(undefined);
  const [sessionModalVisible, setSessionModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (mode === "create") {
      loadSessions().catch((error) => {
        console.error("[gallery-editor] Error cargando sesiones", error);
      });
    }
  }, [loadSessions, mode]);

  useEffect(() => {
    if (!isEdit) {
      return;
    }
    if (!gallery) {
      fetchGallery(galleryId!).catch((error) => {
        console.error("[gallery-editor] Error cargando galeria", error);
        Alert.alert("Error", "No fue posible cargar la galeria para editar.");
        navigation.goBack();
      });
      return;
    }
    if (gallery.photoCount > 0) {
      Alert.alert("Edicion no disponible", "Solo puedes editar nombre o descripcion antes de subir fotos.");
      navigation.goBack();
      return;
    }
    setName(gallery.name);
    setDescription(gallery.description ?? "");
  }, [gallery, galleryId, fetchGallery, navigation, isEdit]);

  const availableSessions = useMemo(() => {
    if (mode === "create") {
      const photographerId = user?.id;
      return sessions.filter((session) => session.photographerId === photographerId);
    }
    return sessions;
  }, [mode, sessions, user]);

  const handleSubmit = useCallback(async () => {
    if (submitting) {
      return;
    }
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName) {
      Alert.alert("Datos incompletos", "Ingresa el nombre de la galeria.");
      return;
    }
    if (!isEdit && !selectedSession) {
      Alert.alert("Selecciona sesion", "Selecciona la sesion a vincular.");
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit && galleryId) {
        const result = await updateGalleryEntry(galleryId, {
          name: trimmedName,
          description: trimmedDescription
        });
        if (!result.success) {
          Alert.alert("Error", result.error ?? "No se pudo actualizar la galeria.");
          return;
        }
        Alert.alert("Exito", "Galeria actualizada correctamente.", [
          {
            text: "Ver galeria",
            onPress: () => navigation.replace("GalleryDetail", { galleryId })
          }
        ]);
      } else if (selectedSession) {
        const result = await createGalleryEntry({
          sessionId: selectedSession.id,
          name: trimmedName,
          description: trimmedDescription || undefined
        });
        if (!result.success || !result.gallery) {
          Alert.alert("Error", result.error ?? "No se pudo crear la galeria.");
          return;
        }
        Alert.alert("Galeria creada", "Comienza a subir tus fotos.", [
          {
            text: "Continuar",
            onPress: () => navigation.replace("GalleryDetail", { galleryId: result.gallery!.id })
          }
        ]);
      }
    } finally {
      setSubmitting(false);
    }
  }, [submitting, isEdit, galleryId, name, description, selectedSession, updateGalleryEntry, createGalleryEntry, navigation]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{isEdit ? "Editar galeria" : "Nueva galeria"}</Text>
        <Text style={styles.subtitle}>
          {isEdit
            ? "Actualiza el nombre o descripcion antes de subir imagenes."
            : "Selecciona la sesion y asigna un nombre antes de cargar las fotos."}
        </Text>

        {!isEdit ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Sesion</Text>
            <Pressable
              style={styles.selector}
              onPress={() => setSessionModalVisible(true)}
              disabled={sessionsLoading}
            >
              <Text style={styles.selectorText}>
                {selectedSession
                  ? `${selectedSession.type} • ${new Date(selectedSession.start).toLocaleDateString()}`
                  : "Selecciona sesion"}
              </Text>
            </Pressable>
            <Text style={styles.hint}>La galeria quedara vinculada a la sesion y cliente seleccionados.</Text>
          </View>
        ) : null}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. Entrega Sesion Familiar"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Descripcion (opcional)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Notas para el cliente o detalles de la entrega"
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <Pressable
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitButtonText}>
            {submitting ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear galeria"}
          </Text>
        </Pressable>
      </ScrollView>

      <Modal visible={sessionModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecciona una sesion</Text>
            <ScrollView contentContainerStyle={styles.modalList}>
              {sessionsLoading ? (
                <ActivityIndicator color={colors.accent} />
              ) : availableSessions.length === 0 ? (
                <Text style={styles.modalEmptyText}>
                  No encontramos sesiones asociadas a tu cuenta. Registra una sesion primero.
                </Text>
              ) : (
                availableSessions.map((session) => (
                  <Pressable
                    key={session.id}
                    style={[
                      styles.modalItem,
                      selectedSession?.id === session.id && styles.modalItemSelected
                    ]}
                    onPress={() => {
                      setSelectedSession(session);
                      setSessionModalVisible(false);
                    }}
                  >
                    <Text style={styles.modalItemTitle}>{session.type}</Text>
                    <Text style={styles.modalItemSubtitle}>
                      {new Date(session.start).toLocaleString()} • {session.location}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
            <Pressable style={styles.modalClose} onPress={() => setSessionModalVisible(false)}>
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    gap: spacing(2)
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700"
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18
  },
  fieldGroup: {
    gap: spacing(1)
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600"
  },
  hint: {
    color: colors.muted,
    fontSize: 11
  },
  selector: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: spacing(1.25),
    paddingHorizontal: spacing(1.5)
  },
  selectorText: {
    color: colors.text
  },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1),
    color: colors.text
  },
  inputMultiline: {
    minHeight: 120,
    textAlignVertical: "top"
  },
  submitButton: {
    borderRadius: radii.lg,
    backgroundColor: colors.accent,
    paddingVertical: spacing(1.5),
    alignItems: "center",
    marginTop: spacing(1)
  },
  submitButtonDisabled: {
    opacity: 0.6
  },
  submitButtonText: {
    color: "#0D0F14",
    fontWeight: "700",
    fontSize: 16
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing(2)
  },
  modalContent: {
    width: "100%",
    maxHeight: "70%",
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2)
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing(1.5)
  },
  modalList: {
    gap: spacing(1)
  },
  modalItem: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(1.5),
    backgroundColor: "#131722"
  },
  modalItemSelected: {
    borderColor: colors.primary,
    backgroundColor: "rgba(108,160,255,0.12)"
  },
  modalItemTitle: {
    color: colors.text,
    fontWeight: "700"
  },
  modalItemSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing(0.5)
  },
  modalEmptyText: {
    color: colors.muted,
    textAlign: "center",
    fontSize: 12,
    paddingVertical: spacing(2)
  },
  modalClose: {
    marginTop: spacing(2),
    alignItems: "center"
  },
  modalCloseText: {
    color: colors.accent,
    fontWeight: "600"
  }
});

export default GalleryEditorScreen;
