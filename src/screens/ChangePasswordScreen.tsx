import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { colors, radii, spacing } from "../theme/theme";
import { useAppStore } from "../state/useAppStore";

type Props = NativeStackScreenProps<RootStackParamList, "ChangePassword">;

export default function ChangePasswordScreen({ navigation }: Props) {
  const completePasswordChange = useAppStore((s) => s.completePasswordChange);
  const logout = useAppStore((s) => s.logout);
  const user = useAppStore((s) => s.user);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const validatePassword = () => {
    if (!newPassword.trim()) {
      return "La nueva contrasena no puede estar vacia.";
    }
    if (newPassword.length < 8) {
      return "La contrasena debe tener al menos 8 caracteres.";
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return "Debe incluir letras mayusculas, minusculas y numeros.";
    }
    if (newPassword !== confirmPassword) {
      return "Las contrasenas no coinciden.";
    }
    return null;
  };

  const handleSubmit = async () => {
    const error = validatePassword();
    if (error) {
      Alert.alert("Atencion", error);
      return;
    }

    setLoading(true);
    const result = await completePasswordChange(newPassword);
    setLoading(false);

    if (!result.success && result.error) {
      Alert.alert("Error", `❌ Error al actualizar la contrasena. Intenta nuevamente.\n${result.error}`);
      return;
    }

    Alert.alert("Contrasena actualizada", "✅ Tu contrasena ha sido actualizada correctamente.");
    navigation.reset({
      index: 0,
      routes: [{ name: "Home" }]
    });
  };

  const handleLogout = async () => {
    await logout();
    Alert.alert("Sesion cerrada", "Sesion cerrada correctamente.");
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Actualiza tu contrasena</Text>
        <Text style={styles.subtitle}>
          Enviamos una contrasena temporal a {user?.email}. Para continuar, crea una nueva contrasena
          segura.
        </Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Nueva contrasena</Text>
          <TextInput
            style={styles.input}
            placeholder="Nueva contrasena"
            placeholderTextColor={colors.muted}
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Confirmar contrasena</Text>
          <TextInput
            style={styles.input}
            placeholder="Repite la contrasena"
            placeholderTextColor={colors.muted}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </View>

        <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.submitButtonText}>
            {loading ? "Guardando..." : "Guardar nueva contrasena"}
          </Text>
        </Pressable>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Cerrar sesion</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    padding: spacing(2)
  },
  content: {
    backgroundColor: colors.card,
    padding: spacing(3),
    borderRadius: radii.lg,
    gap: spacing(2)
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700"
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 20
  },
  formGroup: {
    gap: spacing(1)
  },
  label: {
    color: colors.muted,
    fontSize: 14
  },
  input: {
    backgroundColor: colors.bg,
    color: colors.text,
    borderRadius: radii.md,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.5),
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    alignItems: "center",
    paddingVertical: spacing(1.75)
  },
  submitButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  logoutButton: {
    paddingVertical: spacing(1)
  },
  logoutText: {
    color: colors.accent,
    textAlign: "center",
    fontWeight: "600"
  }
});
