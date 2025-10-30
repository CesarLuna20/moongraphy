import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { colors, radii, spacing } from "../theme/theme";
import { useAppStore } from "../state/useAppStore";
import { Gallery, GalleryStatus } from "../services/authService";

type Props = NativeStackScreenProps<RootStackParamList, "Gallery">;

type GroupingKey = "status" | "client" | "session";

type GalleryGroup = {
  key: string;
  title: string;
  subtitle?: string;
  items: Gallery[];
};

const statusOrder: GalleryStatus[] = ["pending", "review", "delivered", "received"];

const statusLabels: Record<GalleryStatus, string> = {
  pending: "Pendiente",
  review: "En revision",
  delivered: "Entregado",
  received: "Recibido"
};

const statusAccent: Record<GalleryStatus, string> = {
  pending: colors.muted,
  review: colors.accent,
  delivered: colors.primary,
  received: colors.success
};

const groupingOptions: { id: GroupingKey; label: string }[] = [
  { id: "status", label: "Estado" },
  { id: "client", label: "Cliente" },
  { id: "session", label: "Sesion" }
];

const statusFilterOptions: ({ id: "all"; label: string } | { id: GalleryStatus; label: string })[] = [
  { id: "all", label: "Todos" },
  { id: "pending", label: statusLabels.pending },
  { id: "review", label: statusLabels.review },
  { id: "delivered", label: statusLabels.delivered },
  { id: "received", label: statusLabels.received }
];

const formatDate = (value?: string) => {
  if (!value) {
    return "-";
  }
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const buildGroups = (galleries: Gallery[], grouping: GroupingKey): GalleryGroup[] => {
  if (grouping === "status") {
    return statusOrder
      .map((status) => ({
        key: status,
        title: statusLabels[status],
        items: galleries.filter((gallery) => gallery.status === status)
      }))
      .filter((group) => group.items.length > 0);
  }

  if (grouping === "client") {
    const map = new Map<string, GalleryGroup>();
    galleries.forEach((gallery) => {
      const clientName = gallery.client?.name ?? "Cliente sin asignar";
      const existing = map.get(gallery.clientId);
      if (existing) {
        existing.items.push(gallery);
      } else {
        map.set(gallery.clientId, {
          key: gallery.clientId,
          title: clientName,
          subtitle: gallery.client?.email,
          items: [gallery]
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
  }

  const sessionMap = new Map<string, GalleryGroup>();
  galleries.forEach((gallery) => {
    const sessionTitle = gallery.session
      ? `${gallery.session.type} • ${new Date(gallery.session.start).toLocaleDateString()}`
      : "Sesion";
    const key = gallery.sessionId;
    const existing = sessionMap.get(key);
    if (existing) {
      existing.items.push(gallery);
    } else {
      sessionMap.set(key, {
        key,
        title: sessionTitle,
        subtitle: gallery.session?.location,
        items: [gallery]
      });
    }
  });
  return Array.from(sessionMap.values()).sort((a, b) => a.title.localeCompare(b.title));
};

const GalleryScreen: React.FC<Props> = ({ navigation }) => {
  const user = useAppStore((state) => state.user);
  const galleries = useAppStore((state) => state.galleries);
  const galleriesLoading = useAppStore((state) => state.galleriesLoading);
  const galleryTotals = useAppStore((state) => state.galleryTotals);
  const galleryFilters = useAppStore((state) => state.galleryFilters);
  const galleryGrouping = useAppStore((state) => state.galleryGrouping);
  const loadGalleries = useAppStore((state) => state.loadGalleries);
  const setGalleryFilters = useAppStore((state) => state.setGalleryFilters);
  const setGalleryGrouping = useAppStore((state) => state.setGalleryGrouping);
  const lastError = useAppStore((state) => state.lastError);

  const [refreshing, setRefreshing] = useState(false);
  const isPhotographer = user?.role === "photographer" || user?.role === "photographer-admin";
  const isClient = user?.role === "client";
  const statusFilter = galleryFilters.status;

  useFocusEffect(
    useCallback(() => {
      loadGalleries().catch((error) => {
        console.error("[gallery] Error cargando galerias", error);
      });
    }, [loadGalleries])
  );

  const groupedGalleries = useMemo(() => buildGroups(galleries, galleryGrouping), [galleries, galleryGrouping]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadGalleries();
    } finally {
      setRefreshing(false);
    }
  }, [loadGalleries]);

  const handleStatusFilterChange = useCallback(
    async (next?: GalleryStatus) => {
      setGalleryFilters({ status: next });
      await loadGalleries({ status: next });
    },
    [loadGalleries, setGalleryFilters]
  );

  const handleGroupingChange = (grouping: GroupingKey) => {
    setGalleryGrouping(grouping);
  };

  const handleOpenGallery = (gallery: Gallery) => {
    if (isClient && gallery.status !== "delivered" && gallery.status !== "received") {
      Alert.alert("En revision", "El material aun esta en revision. Te avisaremos cuando este listo.");
      return;
    }
    navigation.navigate("GalleryDetail", { galleryId: gallery.id });
  };

  const handleCreateGallery = () => {
    navigation.navigate("GalleryEditor", { mode: "create" });
  };

  if (lastError) {
    console.error("[gallery] error:", lastError);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            progressBackgroundColor={colors.card}
            colors={[colors.primary, colors.accent]}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Entregas</Text>
            <Text style={styles.subtitle}>
              {isPhotographer
                ? "Gestiona galerias por sesion y comparte el material con tus clientes."
                : "Revisa y descarga tus entregas disponibles."}
            </Text>
          </View>
          <View style={styles.chipsRow}>
            {statusFilterOptions.map((option) => {
              const isActive =
                option.id === "all" ? statusFilter === undefined : statusFilter === option.id;
              const count =
                option.id === "all" ? galleryTotals.total : galleryTotals[option.id] ?? 0;
              return (
                <Pressable
                  key={option.id}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() =>
                    handleStatusFilterChange(option.id === "all" ? undefined : option.id)
                  }
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                    {option.label}
                    <Text style={styles.chipCount}> {count}</Text>
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.groupingRow}>
            {groupingOptions.map((option) => {
              const isActive = galleryGrouping === option.id;
              return (
                <Pressable
                  key={option.id}
                  style={[styles.groupingButton, isActive && styles.groupingButtonActive]}
                  onPress={() => handleGroupingChange(option.id)}
                >
                  <Text style={[styles.groupingText, isActive && styles.groupingTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {galleriesLoading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.loadingText}>Cargando galerias...</Text>
          </View>
        ) : null}

        {!galleriesLoading && groupedGalleries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Sin entregas</Text>
            <Text style={styles.emptySubtitle}>
              {isPhotographer
                ? "Crea tu primera galeria desde el boton flotante."
                : "Aun no tienes entregas disponibles. Te avisaremos cuando tu fotografo marque una como entregada."}
            </Text>
          </View>
        ) : (
          groupedGalleries.map((group) => (
            <View key={group.key} style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{group.title}</Text>
                {group.subtitle ? <Text style={styles.groupSubtitle}>{group.subtitle}</Text> : null}
              </View>
              <View style={styles.cardGrid}>
                {group.items.map((gallery) => (
                  <Pressable
                    key={gallery.id}
                    style={styles.galleryCard}
                    onPress={() => handleOpenGallery(gallery)}
                  >
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {gallery.name}
                      </Text>
                      <View
                        style={[styles.statusPill, { backgroundColor: statusAccent[gallery.status] }]}
                      >
                        <Text style={styles.statusText}>{statusLabels[gallery.status]}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardMeta}>
                      {gallery.photoCount} {gallery.photoCount === 1 ? "foto" : "fotos"}
                    </Text>
                    {gallery.session ? (
                      <Text style={styles.cardMeta}>
                        Sesion: {gallery.session.type} •{" "}
                        {new Date(gallery.session.start).toLocaleDateString()}
                      </Text>
                    ) : null}
                    {gallery.client ? (
                      <Text style={styles.cardMeta}>Cliente: {gallery.client.name}</Text>
                    ) : null}
                    {gallery.description ? (
                      <Text style={styles.cardDescription} numberOfLines={2}>
                        {gallery.description}
                      </Text>
                    ) : null}
                    <Text style={styles.cardFooter}>
                      Actualizado: {formatDate(gallery.updatedAt)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {isPhotographer ? (
        <Pressable style={styles.fab} onPress={handleCreateGallery}>
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      ) : null}
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
    paddingBottom: spacing(8)
  },
  header: {
    marginBottom: spacing(2)
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: spacing(0.5)
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(1),
    marginTop: spacing(2)
  },
  chip: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(0.75),
    backgroundColor: colors.card
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(155, 108, 255, 0.12)"
  },
  chipText: {
    color: colors.muted,
    fontWeight: "600"
  },
  chipTextActive: {
    color: colors.accent
  },
  chipCount: {
    color: colors.muted,
    fontWeight: "400"
  },
  groupingRow: {
    flexDirection: "row",
    gap: spacing(1),
    marginTop: spacing(2)
  },
  groupingButton: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(1),
    alignItems: "center",
    backgroundColor: colors.card
  },
  groupingButtonActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(108, 160, 255, 0.12)"
  },
  groupingText: {
    color: colors.muted,
    fontWeight: "600"
  },
  groupingTextActive: {
    color: colors.primary
  },
  loadingContainer: {
    paddingVertical: spacing(4),
    alignItems: "center",
    gap: spacing(1.5)
  },
  loadingText: {
    color: colors.muted
  },
  emptyState: {
    marginTop: spacing(6),
    alignItems: "center",
    paddingHorizontal: spacing(4),
    gap: spacing(1)
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700"
  },
  emptySubtitle: {
    color: colors.muted,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18
  },
  groupCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2),
    marginBottom: spacing(2)
  },
  groupHeader: {
    marginBottom: spacing(1.5)
  },
  groupTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700"
  },
  groupSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing(0.5)
  },
  cardGrid: {
    flexDirection: "column",
    gap: spacing(1.5)
  },
  galleryCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: spacing(1.5),
    gap: spacing(0.75)
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(1)
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    flex: 1
  },
  statusPill: {
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.5),
    borderRadius: radii.lg
  },
  statusText: {
    color: "#0D0F14",
    fontSize: 11,
    fontWeight: "700"
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 12
  },
  cardDescription: {
    color: colors.text,
    fontSize: 13
  },
  cardFooter: {
    color: colors.muted,
    fontSize: 11,
    marginTop: spacing(0.5)
  },
  fab: {
    position: "absolute",
    bottom: spacing(3),
    right: spacing(3),
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6
  },
  fabText: {
    color: "#0D0F14",
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 36
  }
});

export default GalleryScreen;
