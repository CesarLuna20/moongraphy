import React from "react";
import { NavigationContainer, DefaultTheme, Theme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/HomeScreen";
import GalleryScreen from "../screens/GalleryScreen";
import GalleryDetailScreen from "../screens/GalleryDetailScreen";
import GalleryEditorScreen from "../screens/GalleryEditorScreen";
import LoginScreen from "../screens/LoginScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import ChangePasswordScreen from "../screens/ChangePasswordScreen";
import CreateAccountScreen from "../screens/CreateAccountScreen";
import ClientsDirectoryScreen from "../screens/ClientsDirectoryScreen";
import ProfileScreen from "../screens/ProfileScreen";
import SessionsAgendaScreen from "../screens/SessionsAgendaScreen";
import AvailabilityScreen from "../screens/AvailabilityScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import NotificationSettingsScreen from "../screens/NotificationSettingsScreen";
import { colors } from "../theme/theme";
import { useAppStore } from "../state/useAppStore";
import ClientTimelineScreen from "../screens/ClientTimelineScreen";
import SessionTimelineScreen from "../screens/SessionTimelineScreen";
import AdminConfigurationScreen from "../screens/AdminConfigurationScreen";

export type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  ChangePassword: undefined;
  Home: undefined;
  Gallery: undefined;
  GalleryDetail: { galleryId: string };
  GalleryEditor: { mode: "create" | "edit"; galleryId?: string };
  Profile: undefined;
  CreateAccount: undefined;
  ClientsDirectory: undefined;
  SessionsAgenda: undefined;
  Availability: undefined;
  Notifications: undefined;
  NotificationSettings: undefined;
  ClientTimeline: { clientId: string; clientName?: string };
  SessionTimeline: { sessionId: string; sessionType?: string; clientName?: string; clientId?: string };
  AdminConfiguration: undefined;
};

const MyTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.card,
    text: colors.text,
    primary: colors.primary,
    border: colors.border,
    notification: colors.accent
  }
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const user = useAppStore((state) => state.user);
  const requiresPasswordChange = !!user?.forcePasswordReset;

  return (
    <NavigationContainer theme={MyTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg }
        }}
      >
        {!user ? (
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{ title: "Recuperar contrasena" }}
            />
          </>
        ) : null}

        {user && requiresPasswordChange ? (
          <Stack.Screen
            name="ChangePassword"
            component={ChangePasswordScreen}
            options={{
              title: "Actualizar contrasena",
              headerLeft: () => null,
              gestureEnabled: false
            }}
          />
        ) : null}

        {user && !requiresPasswordChange ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Moongraphy" }} />
            <Stack.Screen name="Gallery" component={GalleryScreen} options={{ title: "Galeria" }} />
            <Stack.Screen
              name="GalleryDetail"
              component={GalleryDetailScreen}
              options={{ title: "Detalle de entrega" }}
            />
            <Stack.Screen
              name="GalleryEditor"
              component={GalleryEditorScreen}
              options={{ title: "Gestionar galeria" }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ title: "Mi perfil" }}
            />
            <Stack.Screen
              name="CreateAccount"
              component={CreateAccountScreen}
              options={{ title: "Registrar cuenta" }}
            />
            <Stack.Screen
              name="ClientsDirectory"
              component={ClientsDirectoryScreen}
              options={{ title: "Directorio de clientes" }}
            />
            <Stack.Screen
              name="ClientTimeline"
              component={ClientTimelineScreen}
              options={{ title: "Historial del cliente" }}
            />
            <Stack.Screen
              name="SessionsAgenda"
              component={SessionsAgendaScreen}
              options={{ title: "Sesiones" }}
            />
            <Stack.Screen
              name="SessionTimeline"
              component={SessionTimelineScreen}
              options={{ title: "Historial de sesion" }}
            />
            <Stack.Screen
              name="Availability"
              component={AvailabilityScreen}
              options={{ title: "Disponibilidad" }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ title: "Notificaciones" }}
            />
            <Stack.Screen
              name="NotificationSettings"
              component={NotificationSettingsScreen}
              options={{ title: "Alertas" }}
            />
            <Stack.Screen
              name="AdminConfiguration"
              component={AdminConfigurationScreen}
              options={{ title: "Configuracion" }}
            />
          </>
        ) : null}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
