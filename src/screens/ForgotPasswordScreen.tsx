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

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const requestPasswordReset = useAppStore((s) => s.requestPasswordReset);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert("Atencion", "Por favor ingresa tu correo electronico.");
      return;
    }
    setLoading(true);
    const result = await requestPasswordReset(email);
    setLoading(false);
    if (result.success) {
      const message =
        result.message ??
        "Se ha generado una contrasena temporal. Como esta demo no envia correos, usa este codigo.";
      const tempPassword = result.temporaryPassword;
      const alertMessage = tempPassword
        ? `${message}\n\nContrasena temporal:\n${tempPassword}`
        : message;
      setFeedback(
        tempPassword
          ? { message: `Contrasena temporal: ${tempPassword}`, tone: "success" }
          : { message, tone: "success" }
      );
      Alert.alert("Recuperacion generada", alertMessage, [
        {
          text: "Ok",
          onPress: () => navigation.navigate("Login")
        }
      ]);
    } else if (result.error) {
      setFeedback({ message: result.error, tone: "error" });
      Alert.alert("Error", result.error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Recuperar contrasena</Text>
        <Text style={styles.subtitle}>
          Ingresa el correo asociado a tu cuenta. Te enviaremos una contrasena temporal.
        </Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Correo electronico</Text>
          <TextInput
            style={styles.input}
            placeholder="tu@correo.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {feedback ? (
          <Text
            style={[
              styles.feedback,
              feedback.tone === "success" ? styles.success : styles.error
            ]}
          >
            {feedback.message}
          </Text>
        ) : null}

        <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.submitButtonText}>
            {loading ? "Enviando..." : "Enviar contrasena temporal"}
          </Text>
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
    fontSize: 15
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
  feedback: {
    fontSize: 14
  },
  success: {
    color: colors.success
  },
  error: {
    color: colors.danger
  }
});
