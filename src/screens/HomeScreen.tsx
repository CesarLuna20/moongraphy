import React, { useEffect } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { colors, radii, spacing } from "../theme/theme";
import Box from "../components/Box";
import { useAppStore } from "../state/useAppStore";
import { Canvas, RoundedRect, LinearGradient, vec } from "@shopify/react-native-skia";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isSmall = width < 380; // breakpoint sencillo para phones angostos

  const photos = useAppStore((s) => s.photosCount);
  const inc = useAppStore((s) => s.incPhotos);
  const logout = useAppStore((s) => s.logout);
  const user = useAppStore((s) => s.user);
  const hasPermission = useAppStore((s) => s.hasPermission);
  const recordAccessDenied = useAppStore((s) => s.recordAccessDenied);
  const notificationsUnread = useAppStore((s) => s.notificationsUnread);

  useEffect(() => {
    if (user?.forcePasswordReset) {
      navigation.replace("ChangePassword");
    }
  }, [user, navigation]);

  const lastLogin = user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "-";
  const roleLabel =
    user?.role === "photographer-admin"
      ? "Fotografo admin"
      : user?.role === "photographer"
      ? "Fotografo"
      : "Cliente";
  const statusLabel = user?.status === "active" ? "Activo" : "Inactivo";
  const canManageAccounts = user ? hasPermission("accounts:create") : false;
  const isClient = user?.role === "client";
  const isPhotographer =
    user?.role === "photographer" || user?.role === "photographer-admin";
  const isAdmin = user?.role === "photographer-admin";

  const handleLogout = async () => {
    await logout();
    Alert.alert("Sesion cerrada", "Sesion cerrada correctamente.");
  };

  const handleManageAccounts = () => {
    if (!canManageAccounts) {
      recordAccessDenied("accounts:create", "Intento de abrir la gestion de cuentas sin permiso.", {
        origin: "home",
      });
      Alert.alert("Sin permisos", "No tienes permisos para acceder a esta funcion.");
      return;
    }
    navigation.navigate("CreateAccount");
  };

  const handleOpenDirectory = () => {
    if (!canManageAccounts) {
      recordAccessDenied("clients:list", "Intento de abrir el directorio sin permiso.", {
        origin: "home",
      });
      Alert.alert("Sin permisos", "No tienes permisos para acceder a esta funcion.");
      return;
    }
    navigation.navigate("ClientsDirectory");
  };

  const handleOpenSessions = () => {
    if (!isPhotographer) {
      recordAccessDenied("sessions:list", "Intento de abrir agenda sin permisos.", {
        origin: "home",
      });
      Alert.alert("Sin permisos", "Solo los fotografos pueden acceder a la agenda de sesiones.");
      return;
    }
    navigation.navigate("SessionsAgenda");
  };

  const handleOpenAvailability = () => {
    if (!isPhotographer) {
      recordAccessDenied("availability:view", "Intento de abrir disponibilidad sin permisos.", {
        origin: "home",
      });
      Alert.alert("Sin permisos", "Solo los fotografos pueden ajustar su disponibilidad.");
      return;
    }
    navigation.navigate("Availability");
  };

  const handleOpenAdminConfiguration = () => {
    if (!isAdmin) {
      recordAccessDenied("admin:configuration", "Intento de abrir configuracion sin permisos.", {
        origin: "home",
      });
      Alert.alert("Sin permisos", "Solo los administradores pueden modificar la configuracion.");
      return;
    }
    navigation.navigate("AdminConfiguration");
  };

  const handleIncrement = () => {
    if (isClient) {
      recordAccessDenied("portfolio:increment", "Cliente intento modificar portafolio", {
        origin: "home",
      });
      Alert.alert("Sin permisos", "No tienes permisos para acceder a esta funcion.");
      return;
    }
    inc();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Canvas style={styles.bgCanvas}>
            <RoundedRect x={-40} y={-60} width={420} height={320} r={40}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(420, 320)}
                colors={[colors.accent, colors.primary]}
              />
            </RoundedRect>
          </Canvas>

          <View style={[styles.header, isSmall && styles.headerSmall]}>
            <View style={styles.headerTextCol}>
              <Text style={styles.title}>Moongraphy</Text>
              <Text style={styles.subtitle}>
                {isClient
                  ? "Panel de cliente"
                  : user?.role === "photographer-admin"
                  ? "Panel administrativo de fotografia"
                  : "Panel de fotografo"}
              </Text>
            </View>

            {/* Botonera responsiva */}
            <View style={[styles.headerButtons, isSmall && styles.headerButtonsSmall]}>
              {canManageAccounts ? (
                <>
                  <Pressable
                    style={[styles.headerButton, isSmall && styles.headerButtonSmall, styles.accountButton]}
                    onPress={handleManageAccounts}
                  >
                    <Text style={styles.accountText} numberOfLines={1}>
                      Gestionar cuentas
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.headerButton, isSmall && styles.headerButtonSmall, styles.directoryButton]}
                    onPress={handleOpenDirectory}
                  >
                    <Text style={styles.directoryText} numberOfLines={1}>
                      Directorio clientes
                    </Text>
                  </Pressable>
                </>
              ) : null}

              {isPhotographer ? (
                <>
                  <Pressable
                    style={[styles.headerButton, isSmall && styles.headerButtonSmall, styles.scheduleButton]}
                    onPress={handleOpenSessions}
                  >
                    <Text style={styles.scheduleText} numberOfLines={1}>
                      Agenda
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.headerButton, isSmall && styles.headerButtonSmall, styles.availabilityButton]}
                    onPress={handleOpenAvailability}
                  >
                    <Text style={styles.availabilityText} numberOfLines={1}>
                      Disponibilidad
                    </Text>
                  </Pressable>
                </>
              ) : null}

              <Pressable
                style={[styles.headerButton, isSmall && styles.headerButtonSmall, styles.notificationsButton]}
                onPress={() => navigation.navigate("Notifications")}
              >
                <Text style={styles.notificationsText} numberOfLines={1}>
                  {notificationsUnread > 0
                    ? `Notificaciones (${notificationsUnread})`
                    : "Notificaciones"}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.headerButton, isSmall && styles.headerButtonSmall, styles.settingsButton]}
                onPress={() => navigation.navigate("NotificationSettings")}
              >
                <Text style={styles.settingsText} numberOfLines={1}>
              Alertas
            </Text>
          </Pressable>

          {isAdmin ? (
            <Pressable
              style={[styles.headerButton, isSmall && styles.headerButtonSmall, styles.adminButton]}
              onPress={handleOpenAdminConfiguration}
            >
              <Text style={styles.adminText} numberOfLines={1}>
                Configuracion
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            style={[styles.headerButton, isSmall && styles.headerButtonSmall, styles.profileButton]}
            onPress={() => navigation.navigate("Profile")}
          >
                <Text style={styles.profileText} numberOfLines={1}>
                  Mi perfil
                </Text>
              </Pressable>

              <Pressable
                style={[styles.headerButton, isSmall && styles.headerButtonSmall, styles.logoutButton]}
                onPress={handleLogout}
              >
                <Text style={styles.logoutText} numberOfLines={1}>
                  Cerrar sesion
                </Text>
              </Pressable>
            </View>
          </View>

          <Box style={styles.summaryCard}>
            <Text style={styles.label}>Hola, {user?.name ?? "usuario"}</Text>
            <Text style={styles.lastLogin}>Ultimo acceso: {lastLogin}</Text>
            {user ? (
              <View style={styles.badgeRow}>
                <Text style={styles.badge}>Rol: {roleLabel}</Text>
                <Text style={styles.badge}>Estado: {statusLabel}</Text>
              </View>
            ) : null}
            {user && user.role !== "client" && user.specialty ? (
              <Text style={styles.specialty}>Especialidad: {user.specialty}</Text>
            ) : null}
            {isClient ? (
              <Text style={styles.clientNotice}>
                Acceso limitado: puedes explorar galerias y solicitar servicios, pero no modificar
                configuraciones globales.
              </Text>
            ) : null}

            <View style={{ height: spacing(2) }} />

            <Text style={styles.label}>Fotos guardadas</Text>
            <Text style={styles.big}>{photos}</Text>

            <View style={{ height: spacing(2) }} />

            <View style={styles.row}>
              <Pressable style={styles.btn} onPress={handleIncrement}>
                <Text style={styles.btnText}>{isClient ? "Solo lectura" : "Agregar 1"}</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnOutline]}
                onPress={() => navigation.navigate("Gallery")}
              >
                <Text style={styles.btnText}>Ir a Galeria</Text>
              </Pressable>
            </View>
          </Box>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    padding: spacing(2),
    gap: spacing(2),
  },
  content: {
    flex: 1,
    alignItems: "center",
    position: "relative",
    width: "100%",
  },
  bgCanvas: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 260,
    opacity: 0.25,
  },

  // Header
  header: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginTop: spacing(2),
    gap: spacing(1),
  },
  headerSmall: {
    flexDirection: "column", // en pantallas pequeñas, apila
    alignItems: "stretch",
  },
  headerTextCol: {
    flexShrink: 1,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 4 },

  // Botonera
  headerButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(1),
    justifyContent: "flex-end",
    maxWidth: "100%",
  },
  headerButtonsSmall: {
    justifyContent: "flex-start",
    alignSelf: "stretch",
  },
  headerButton: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    alignItems: "center",
    justifyContent: "center",
  },
  // En pantallas pequeñas, que ocupen ~50% y hagan wrap en 2 columnas
  headerButtonSmall: {
    flexBasis: "48%",
    flexGrow: 1,
  },

  profileButton: {
    borderColor: colors.primary,
  },
  profileText: {
    color: colors.primary,
    fontWeight: "700",
  },
  logoutButton: {
    borderColor: colors.danger,
  },
  logoutText: {
    color: colors.danger,
    fontWeight: "700",
  },
  accountButton: {
    borderColor: colors.accent,
  },
  accountText: {
    color: colors.accent,
    fontWeight: "700",
  },
  directoryButton: {
    borderColor: colors.success,
  },
  directoryText: {
    color: colors.success,
    fontWeight: "700",
  },
  scheduleButton: {
    borderColor: colors.primary,
  },
  scheduleText: {
    color: colors.primary,
    fontWeight: "700",
  },
  notificationsButton: {
    borderColor: colors.accent,
  },
  notificationsText: {
    color: colors.accent,
    fontWeight: "700",
  },
  settingsButton: {
    borderColor: colors.primary,
  },
  settingsText: {
    color: colors.primary,
    fontWeight: "700",
  },
  adminButton: {
    borderColor: colors.accent,
  },
  adminText: {
    color: colors.accent,
    fontWeight: "700",
  },
  availabilityButton: {
    borderColor: colors.accent,
  },
  availabilityText: {
    color: colors.accent,
    fontWeight: "700",
  },

  // Card resumen
  summaryCard: {
    width: "100%",
    marginTop: spacing(2),
  },
  label: { color: colors.muted, marginBottom: 6 },
  lastLogin: { color: colors.text, fontSize: 12, marginBottom: spacing(1) },
  badgeRow: {
    flexDirection: "row",
    gap: spacing(1),
    marginBottom: spacing(1),
    flexWrap: "wrap",
  },
  badge: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.5),
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  specialty: {
    color: colors.text,
    fontSize: 13,
    marginBottom: spacing(1),
  },
  clientNotice: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: spacing(1),
  },
  big: { color: colors.text, fontSize: 40, fontWeight: "800" },

  row: { flexDirection: "row", gap: spacing(1), width: "100%" },
  btn: {
    flex: 1,
    paddingVertical: spacing(1.5),
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  btnOutline: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnText: { color: colors.text, fontWeight: "700" },
});
