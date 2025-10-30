import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useAppStore } from "../state/useAppStore";
import { colors, radii, spacing } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "ClientTimeline">;

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

const ClientTimelineScreen: React.FC<Props> = ({ route, navigation }) => {
  const { clientId, clientName } = route.params;
  const user = useAppStore((state) => state.user);
  const loadClientTimeline = useAppStore((state) => state.loadClientTimeline);
  const clientTimeline = useAppStore((state) => state.clientTimeline);
  const clientTimelineFor = useAppStore((state) => state.clientTimelineFor);
  const clientTimelineLoading = useAppStore((state) => state.clientTimelineLoading);

  useFocusEffect(
    useCallback(() => {
      if (user?.role === "client" && user.id !== clientId) {
        Alert.alert("Acceso restringido", "Solo puedes consultar tu propio historial.", [
          { text: "Volver", onPress: () => navigation.goBack() }
        ]);
        return;
      }
      loadClientTimeline(clientId).catch((error) => {
        console.error("[client-timeline] Error cargando historial", error);
      });
    }, [user, clientId, loadClientTimeline, navigation])
  );

  const events = useMemo(() => {
    if (clientTimelineFor !== clientId) {
      return [] as typeof clientTimeline;
    }
    return [...clientTimeline].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [clientTimeline, clientTimelineFor, clientId]);

  const refreshing = clientTimelineLoading && clientTimelineFor === clientId;

  const handleRefresh = () => {
    loadClientTimeline(clientId).catch((error) => {
      console.error("[client-timeline] Error refrescando historial", error);
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Historial del cliente</Text>
          <Text style={styles.subtitle}>{clientName ?? "Cliente"}</Text>
        </View>

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
              Las acciones relacionadas con sesiones, entregas y confirmaciones apareceran aqui.
            </Text>
          </View>
        ) : null}

        {events.map((event) => {
          const sessionId = event.sessionId;
          const timelineClientName = clientName ?? event.client?.name ?? "Cliente";
          return (
            <View key={event.id} style={styles.eventCard}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventMeta}>{formatDateTime(event.createdAt)}</Text>
              {event.description ? <Text style={styles.eventDescription}>{event.description}</Text> : null}
              {event.session?.type ? (
                <Text style={styles.eventDetail}>
                  Sesion: {event.session.type} (inicio {formatDateTime(event.session.start)})
                </Text>
              ) : null}
              {event.gallery?.name ? (
                <Text style={styles.eventDetail}>Galeria: {event.gallery.name}</Text>
              ) : null}
              {event.actorName ? (
                <Text style={styles.eventDetail}>Registrado por: {event.actorName}</Text>
              ) : null}
              {sessionId ? (
                <Pressable
                  style={styles.linkButton}
                  onPress={() =>
                    navigation.navigate("SessionTimeline", {
                      sessionId,
                      sessionType: event.session?.type,
                      clientName: timelineClientName,
                      clientId
                    })
                  }
                >
                  <Text style={styles.linkButtonText}>Ver historial de sesion</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
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
    gap: spacing(0.75)
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
  loadingState: {
    alignItems: "center",
    gap: spacing(1)
  },
  loadingText: {
    color: colors.muted
  },
  emptyState: {
    marginTop: spacing(6),
    paddingHorizontal: spacing(2),
    alignItems: "center",
    gap: spacing(1.25)
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
  },
  linkButton: {
    marginTop: spacing(1),
    alignSelf: "flex-start",
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.75),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary
  },
  linkButtonText: {
    color: colors.primary,
    fontWeight: "700"
  }
});

export default ClientTimelineScreen;
