import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { colors, radii, spacing } from "../theme/theme";
import { useAppStore } from "../state/useAppStore";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const login = useAppStore((s) => s.login);
  const lastError = useAppStore((s) => s.lastError);
  const clearError = useAppStore((s) => s.clearError);

  const [email, setEmail] = useState("demo@moongraphy.dev");
  const [password, setPassword] = useState("Demo#123");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    clearError();
  }, [email, password, clearError]);

  const handleLogin = async () => {
    if (loading) {
      return;
    }
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.success && result.error) {
      Alert.alert("Error", result.error);
      return;
    }
    if (result.reactivated) {
      Alert.alert(
        "Cuenta reactivada",
        "Tu cuenta estaba inactiva y se reactivo con este inicio de sesion."
      );
    }
    if (result.success && result.requiresPasswordChange) {
      Alert.alert(
        "Actualiza tu contrasena",
        "Debes actualizar tu contrasena antes de ingresar al panel principal."
      );
      navigation.reset({
        index: 0,
        routes: [{ name: "ChangePassword" }]
      });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Moongraphy</Text>
        <Text style={styles.subtitle}>Inicia sesion para continuar</Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Correo electronico</Text>
          <TextInput
            style={styles.input}
            placeholder="tu@correo.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="username"
            value={email}
            onChangeText={setEmail}
            returnKeyType="next"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Contrasena</Text>
          <TextInput
            style={styles.input}
            placeholder="********"
            placeholderTextColor={colors.muted}
            secureTextEntry
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />
        </View>

        {lastError ? <Text style={styles.error}>{lastError}</Text> : null}

        <Pressable style={styles.loginButton} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.loginButtonText}>Iniciar sesion</Text>
          )}
        </Pressable>

        <Pressable style={styles.linkButton} onPress={() => navigation.navigate("ForgotPassword")}>
          <Text style={styles.linkText}>Olvidaste tu contrasena?</Text>
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
    fontSize: 28,
    fontWeight: "800"
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16
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
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing(1.75)
  },
  loginButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  linkButton: {
    paddingVertical: spacing(1)
  },
  linkText: {
    color: colors.accent,
    textAlign: "center",
    fontWeight: "600"
  },
  error: {
    color: colors.danger,
    fontSize: 14
  }
});
