import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
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

type Props = NativeStackScreenProps<RootStackParamList, "SessionTimeline">;

const formatDateTime = (value?: string) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const SessionTimelineScreen: React.FC<Props> = ({ route, navigation }) => {
  const { sessionId, sessionType, clientName, clientId } = route.params;
  const loadSessionTimeline = useAppStore((state) => state.loadSessionTimeline);
  const addSessionNote = useAppStore((state) => state.addSessionNote);
  const sessionTimeline = useAppStore((state) => state.sessionTimeline);
  const sessionTimelineFor = useAppStore((state) => state.sessionTimelineFor);
  const sessionTimelineLoading = useAppStore((state) => state.sessionTimelineLoading);

  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadSessionTimeline(sessionId).catch((error) => {
        console.error("[session-timeline] Error cargando historial", error);
      });
    }, [sessionId, loadSessionTimeline])
  );

  const events = useMemo(() => {
    if (sessionTimelineFor !== sessionId) {
      return [] as typeof sessionTimeline;
    }
    return [...sessionTimeline].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [sessionTimeline, sessionTimelineFor, sessionId]);

  const resolvedClientId = useMemo(() => {
    if (clientId) {
      return clientId;
    }
    const withClient = events.find((event) => event.clientId);
    return withClient?.clientId;
  }, [clientId, events]);

  const resolvedClientName = useMemo(() => {
    if (clientName) {
      return clientName;
    }
    const withClient = events.find((event) => event.client?.name);
    return withClient?.client?.name;
  }, [clientName, events]);

  const sessionInfo = useMemo(() => {
    const withSession = events.find((event) => event.session);
    return withSession?.session;
  }, [events]);

  const refreshing = sessionTimelineLoading && sessionTimelineFor === sessionId;

  const handleRefresh = () => {
    loadSessionTimeline(sessionId).catch((error) => {
      console.error("[session-timeline] Error refrescando historial", error);
    });
  };

  const handleAddNote = async () => {
    const trimmed = noteDraft.trim();
    if (!trimmed) {
      Alert.alert("Ingresa una nota", "Escribe el contenido antes de guardar.");
      return;
    }
    setSavingNote(true);
    const result = await addSessionNote(sessionId, trimmed);
    setSavingNote(false);
    if (!result.success) {
      Alert.alert("Error", result.error ?? "No se pudo registrar la nota.");
      return;
    }
    setNoteDraft("");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Historial de sesion</Text>
          <Text style={styles.subtitle}>
            {sessionType ?? sessionInfo?.type ?? "Sesion"} ・ ID {sessionId}
          </Text>
          {resolvedClientName ? (
            <Text style={styles.subtitle}>Cliente: {resolvedClientName}</Text>
          ) : null}
          {sessionInfo?.start ? (
            <Text style={styles.subtitle}>Inicio: {formatDateTime(sessionInfo.start)}</Text>
          ) : null}
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Agregar nota interna</Text>
          <TextInput
            style={styles.noteInput}
            placeholder="Escribe instrucciones, pendientes o detalles relevantes."
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={4}
            value={noteDraft}
            onChangeText={setNoteDraft}
          />
          <Pressable
            style={[styles.saveButton, savingNote && styles.saveButtonDisabled]}
            onPress={handleAddNote}
            disabled={savingNote}
          >
            <Text style={styles.saveButtonText}>{savingNote ? "Guardando..." : "Guardar nota"}</Text>
          </Pressable>
        </View>

        {resolvedClientId ? (
          <Pressable
            style={styles.linkButton}
            onPress={() =>
              navigation.navigate("ClientTimeline", {
                clientId: resolvedClientId,
                clientName: resolvedClientName
              })
            }
          >
            <Text style={styles.linkButtonText}>Ver historial del cliente</Text>
          </Pressable>
        ) : null}

        {refreshing && events.length === 0 ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.loadingText}>Cargando historial...</Text>
          </View>
        ) : null}

        {!refreshing && events.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No hay historial disponible</Text>
            <Text style={styles.emptySubtitle}>
              Las acciones de la sesion se iran registrando conforme avances en la gestion.
            </Text>
          </View>
        ) : null}

        {events.map((event) => (
          <View key={event.id} style={styles.eventCard}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={styles.eventMeta}>{formatDateTime(event.createdAt)}</Text>
            {event.description ? <Text style={styles.eventDescription}>{event.description}</Text> : null}
            {event.actorName ? (
              <Text style={styles.eventDetail}>Registrado por: {event.actorName}</Text>
            ) : null}
            {event.gallery?.name ? (
              <Text style={styles.eventDetail}>Galeria: {event.gallery.name}</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  content: {
    padding: spacing(2),
    gap: spacing(2),
    paddingBottom: spacing(4)
  },
  header: {
    gap: spacing(0.5)
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800"
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14
  },
  noteCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2),
    gap: spacing(1)
  },
  noteTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1),
    color: colors.text,
    backgroundColor: colors.bg,
    minHeight: 120,
    textAlignVertical: "top"
  },
  saveButton: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing(1.75),
    paddingVertical: spacing(0.9),
    borderRadius: radii.md,
    backgroundColor: colors.accent
  },
  saveButtonDisabled: {
    opacity: 0.6
  },
  saveButtonText: {
    color: colors.bg,
    fontWeight: "700"
  },
  linkButton: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing(1.75),
    paddingVertical: spacing(0.9),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.card
  },
  linkButtonText: {
    color: colors.primary,
    fontWeight: "700"
  },
  loadingState: {
    alignItems: "center",
    gap: spacing(1)
  },
  loadingText: {
    color: colors.muted
  },
  emptyState: {
    marginTop: spacing(6),
    alignItems: "center",
    gap: spacing(1.25),
    paddingHorizontal: spacing(2)
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700"
  },
  emptySubtitle: {
    color: colors.muted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20
  },
  eventCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2),
    gap: spacing(0.75)
  },
  eventTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  eventMeta: {
    color: colors.muted,
    fontSize: 12
  },
  eventDescription: {
    color: colors.text,
    fontSize: 14
  },
  eventDetail: {
    color: colors.muted,
    fontSize: 13
  }
});

export default SessionTimelineScreen;
