import React, { useCallback } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  Pressable
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAppStore } from "../state/useAppStore";
import { colors, radii, spacing } from "../theme/theme";

export default function NotificationsScreen() {
  const notifications = useAppStore((state) => state.notifications);
  const notificationsLoading = useAppStore((state) => state.notificationsLoading);
  const notificationsUnread = useAppStore((state) => state.notificationsUnread);
  const loadNotifications = useAppStore((state) => state.loadNotifications);
  const markNotificationsRead = useAppStore((state) => state.markNotificationsRead);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const handleRefresh = useCallback(async () => {
    await loadNotifications();
  }, [loadNotifications]);

  const handleMarkAll = useCallback(async () => {
    await markNotificationsRead(undefined, true);
  }, [markNotificationsRead]);

  const handleMarkSingle = useCallback(
    async (notificationId: string, readAt?: string) => {
      if (readAt) {
        return;
      }
      await markNotificationsRead([notificationId], false);
    },
    [markNotificationsRead]
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={notificationsLoading} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Notificaciones</Text>
        <Pressable
          style={[styles.markAllButton, notificationsUnread === 0 && styles.markAllButtonDisabled]}
          onPress={handleMarkAll}
          disabled={notificationsUnread === 0}
        >
          <Text style={styles.markAllButtonText}>Marcar todas como leidas</Text>
        </Pressable>
      </View>

      {notifications.length === 0 ? (
        <Text style={styles.emptyText}>No hay notificaciones recientes.</Text>
      ) : (
        notifications.map((notification) => {
          const createdAtLabel = new Date(notification.createdAt).toLocaleString();
          const unread = !notification.readAt;
          return (
            <Pressable
              key={notification.id}
              style={[styles.notificationCard, unread && styles.notificationUnread]}
              onPress={() => handleMarkSingle(notification.id, notification.readAt)}
            >
              <View style={styles.notificationHeader}>
                <Text style={styles.notificationTitle}>{notification.title}</Text>
                {unread ? <Text style={styles.badge}>Nuevo</Text> : null}
              </View>
              <Text style={styles.notificationMessage}>{notification.message}</Text>
              <View style={styles.notificationMeta}>
                <Text style={styles.notificationChannel}>
                  Canales: {notification.channels.join(", ")}
                </Text>
                <Text style={styles.notificationDate}>{createdAtLabel}</Text>
              </View>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  content: {
    padding: spacing(2),
    gap: spacing(1.5),
    paddingBottom: spacing(4)
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700"
  },
  markAllButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.md,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(0.75),
    backgroundColor: colors.card
  },
  markAllButtonDisabled: {
    opacity: 0.4
  },
  markAllButtonText: {
    color: colors.accent,
    fontWeight: "600"
  },
  emptyText: {
    color: colors.muted,
    fontStyle: "italic"
  },
  notificationCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2),
    gap: spacing(0.5)
  },
  notificationUnread: {
    borderColor: colors.accent
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(1)
  },
  notificationTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    flexShrink: 1
  },
  badge: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: 12
  },
  notificationMessage: {
    color: colors.text,
    fontSize: 14
  },
  notificationMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  notificationChannel: {
    color: colors.muted,
    fontSize: 12
  },
  notificationDate: {
    color: colors.muted,
    fontSize: 12
  }
});
