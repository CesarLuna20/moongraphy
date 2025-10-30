import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { colors, radii, spacing } from "../theme/theme";
import { useAppStore } from "../state/useAppStore";

type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

type FormState = {
  name: string;
  email: string;
  avatarUrl: string;
  bio: string;
  phone: string;
  specialty: string;
  location: string;
  portfolioUrl: string;
};

export default function ProfileScreen({ navigation }: Props) {
  const user = useAppStore((s) => s.user);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const disableAccount = useAppStore((s) => s.disableAccount);
  const changePassword = useAppStore((s) => s.changePassword);

  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    avatarUrl: "",
    bio: "",
    phone: "",
    specialty: "",
    location: "",
    portfolioUrl: ""
  });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avatarPreviewError, setAvatarPreviewError] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [confirmPasswordValue, setConfirmPasswordValue] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const isPhotographer =
    user?.role === "photographer" || user?.role === "photographer-admin";
  const services = user?.services ?? [];

  useEffect(() => {
    if (!user) {
      return;
    }
    setForm({
      name: user.name ?? "",
      email: user.email ?? "",
      avatarUrl: user.avatarUrl ?? "",
      bio: user.bio ?? "",
      phone: user.phone ?? "",
      specialty: user.specialty ?? "",
      location: user.location ?? "",
      portfolioUrl: user.portfolioUrl ?? ""
    });
  }, [user]);

  const avatarPreviewSource = useMemo(() => {
    const trimmed = form.avatarUrl.trim();
    if (!trimmed) {
      return null;
    }
    return { uri: trimmed };
  }, [form.avatarUrl]);

  useEffect(() => {
    setAvatarPreviewError(false);
  }, [avatarPreviewSource]);

  const handleInputChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const validate = (): string | null => {
    if (!form.name.trim()) {
      return "El nombre no puede estar vacio.";
    }
    if (!form.email.trim()) {
      return "El correo electronico es obligatorio.";
    }
    if (user?.role === "client" && !form.phone.trim()) {
      return "El telefono es obligatorio.";
    }
    return null;
  };

  const validatePasswordChange = (): string | null => {
    if (!currentPassword.trim()) {
      return "Ingresa tu contrasena actual.";
    }
    if (!newPasswordValue.trim()) {
      return "Ingresa la nueva contrasena.";
    }
    if (
      newPasswordValue.length < 8 ||
      !/[A-Z]/.test(newPasswordValue) ||
      !/[a-z]/.test(newPasswordValue) ||
      !/\d/.test(newPasswordValue)
    ) {
      return "La nueva contrasena debe incluir mayusculas, minusculas y numeros (minimo 8 caracteres).";
    }
    if (newPasswordValue !== confirmPasswordValue) {
      return "Las contrasenas no coinciden.";
    }
    return null;
  };

  const handleSave = async () => {
    if (!user || loading) {
      return;
    }
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      Alert.alert("Revisa tus datos", validationError);
      return;
    }
    setLoading(true);
    setError(null);
    setFeedback(null);

    const result = await updateProfile({
      name: form.name.trim(),
      email: form.email.trim(),
      avatarUrl: form.avatarUrl.trim(),
      bio: form.bio.trim(),
      phone: form.phone.trim(),
      specialty: isPhotographer ? form.specialty.trim() : undefined,
      location: isPhotographer ? form.location.trim() : undefined,
      portfolioUrl: isPhotographer ? form.portfolioUrl.trim() : undefined
    });

    setLoading(false);

    if (!result.success) {
      const message = result.error ?? "No se pudo actualizar el perfil.";
      setError(message);
      Alert.alert("Error", message);
      return;
    }

    setFeedback("Perfil actualizado correctamente.");
    Alert.alert("Listo", "Perfil actualizado correctamente.");
  };

  const handlePasswordChange = async () => {
    if (passwordLoading) {
      return;
    }
    const validationError = validatePasswordChange();
    if (validationError) {
      Alert.alert("Revisa tus datos", validationError);
      return;
    }
    setPasswordLoading(true);
    const result = await changePassword(currentPassword, newPasswordValue);
    setPasswordLoading(false);
    if (!result.success) {
      const message = result.error
        ? `❌ Error al actualizar la contrasena. Intenta nuevamente.\n${result.error}`
        : "❌ Error al actualizar la contrasena. Intenta nuevamente.";
      Alert.alert("Error", message);
      return;
    }
    setCurrentPassword("");
    setNewPasswordValue("");
    setConfirmPasswordValue("");
    Alert.alert("Contrasena actualizada", "✅ Tu contrasena ha sido actualizada correctamente.");
  };

  const handleDisableAccount = () => {
    Alert.alert(
      "Deshabilitar cuenta",
      "Tu cuenta quedara inactiva hasta que vuelvas a iniciar sesion. Confirma para continuar.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Deshabilitar",
          style: "destructive",
          onPress: async () => {
            const result = await disableAccount();
            if (!result.success) {
              Alert.alert("Error", result.error ?? "No se pudo deshabilitar la cuenta.");
              return;
            }
            Alert.alert(
              "Cuenta deshabilitada",
              result.message ??
                "Tu cuenta ha sido deshabilitada. Podras reactivarla iniciando sesion nuevamente.",
              [{ text: "Entendido", onPress: () => navigation.navigate("Login") }]
            );
          }
        }
      ]
    );
  };

  if (!user) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.subtitle}>No hay sesion activa.</Text>
        <Pressable style={styles.linkButton} onPress={() => navigation.navigate("Login")}>
          <Text style={styles.linkText}>Volver al inicio de sesion</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Mi perfil</Text>
          <Text style={styles.subtitle}>
            Gestiona tu informacion personal y profesional para mantener tu presencia al dia.
          </Text>

          <View style={styles.badges}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                Rol:{" "}
                {user.role === "photographer-admin"
                  ? "Fotografo admin"
                  : user.role === "photographer"
                  ? "Fotografo"
                  : "Cliente"}
              </Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                Estado: {user.status === "active" ? "Activo" : "Inactivo"}
              </Text>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(value) => handleInputChange("name", value)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Correo electronico</Text>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(value) => handleInputChange("email", value)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Telefono</Text>
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={(value) => handleInputChange("phone", value)}
              keyboardType="phone-pad"
              placeholder="Ej. +52 55 1234 5678"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Foto de perfil</Text>
            <TextInput
              style={styles.input}
              value={form.avatarUrl}
              onChangeText={(value) => handleInputChange("avatarUrl", value)}
              placeholder="https://..."
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
            />
            {avatarPreviewSource ? (
              <View style={styles.avatarPreviewWrapper}>
                <Image
                  source={avatarPreviewSource}
                  style={styles.avatarPreview}
                  onError={() => setAvatarPreviewError(true)}
                />
                {avatarPreviewError ? (
                  <Text style={styles.previewError}>
                    No se pudo cargar la imagen. Verifica la URL.
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.hint}>Se mostrara una vista previa al ingresar una URL valida.</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Descripcion</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={form.bio}
              onChangeText={(value) => handleInputChange("bio", value)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholder="Comparte informacion sobre ti."
              placeholderTextColor={colors.muted}
            />
          </View>

          {isPhotographer ? (
            <>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Especialidad</Text>
                <TextInput
                  style={styles.input}
                  value={form.specialty}
                  onChangeText={(value) => handleInputChange("specialty", value)}
                  placeholder="Bodas, retratos..."
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Ubicacion</Text>
                <TextInput
                  style={styles.input}
                  value={form.location}
                  onChangeText={(value) => handleInputChange("location", value)}
                  placeholder="Ciudad, Pais"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Portafolio</Text>
                <TextInput
                  style={styles.input}
                  value={form.portfolioUrl}
                  onChangeText={(value) => handleInputChange("portfolioUrl", value)}
                  placeholder="https://miportafolio.com"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
            </>
          ) : null}

          {feedback ? <Text style={styles.success}>{feedback}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={styles.primaryButton} onPress={handleSave} disabled={loading}>
            <Text style={styles.primaryButtonText}>
              {loading ? "Guardando..." : "Guardar cambios"}
            </Text>
          </Pressable>

          <Pressable style={styles.linkButton} onPress={() => navigation.goBack()}>
            <Text style={styles.linkText}>Volver</Text>
          </Pressable>
        </View>

        {user?.role === "client" ? (
          <View style={styles.servicesCard}>
            <Text style={styles.sectionTitle}>Servicios registrados</Text>
            {services.length === 0 ? (
              <Text style={styles.helperText}>Aun no tienes servicios registrados.</Text>
            ) : (
              services.map((service) => (
                <View key={service.id} style={styles.serviceRow}>
                  <Text style={styles.serviceTitle}>{service.title}</Text>
                  <Text style={styles.serviceMeta}>
                    {new Date(service.createdAt).toLocaleDateString()} - {service.status}
                  </Text>
                  {service.notes ? <Text style={styles.serviceNotes}>{service.notes}</Text> : null}
                </View>
              ))
            )}
          </View>
        ) : null}

        <View style={styles.passwordCard}>
          <Text style={styles.sectionTitle}>Cambiar contrasena</Text>
          <Text style={styles.helperText}>
            Actualiza tu contrasena manualmente cuando lo necesites. Asegurate de usar una combinacion segura.
          </Text>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Contrasena actual</Text>
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Contrasena actual"
              placeholderTextColor={colors.muted}
              secureTextEntry
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Nueva contrasena</Text>
            <TextInput
              style={styles.input}
              value={newPasswordValue}
              onChangeText={setNewPasswordValue}
              placeholder="Nueva contrasena"
              placeholderTextColor={colors.muted}
              secureTextEntry
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Confirmar contrasena</Text>
            <TextInput
              style={styles.input}
              value={confirmPasswordValue}
              onChangeText={setConfirmPasswordValue}
              placeholder="Repite la contrasena"
              placeholderTextColor={colors.muted}
              secureTextEntry
            />
          </View>
          <Pressable
            style={[styles.primaryButton, passwordLoading && styles.disabledButton]}
            onPress={handlePasswordChange}
            disabled={passwordLoading}
          >
            <Text style={styles.primaryButtonText}>
              {passwordLoading ? "Actualizando..." : "Actualizar contrasena"}
            </Text>
          </Pressable>
        </View>

        {user?.role === "client" ? null : (
          <View style={styles.dangerCard}>
            <Text style={styles.dangerTitle}>Deshabilitar cuenta</Text>
            <Text style={styles.dangerSubtitle}>
              La cuenta quedara inactiva hasta que un administrador la reactive. Confirma para
              continuar.
            </Text>
            <Pressable style={styles.dangerButton} onPress={handleDisableAccount}>
              <Text style={styles.dangerButtonText}>Deshabilitar cuenta</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  centered: {
    justifyContent: "center",
    alignItems: "center"
  },
  scrollContent: {
    padding: spacing(2)
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing(3),
    gap: spacing(2)
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800"
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(1)
  },
  badge: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.75),
    borderWidth: 1,
    borderColor: colors.border
  },
  badgeText: {
    color: colors.text,
    fontWeight: "600"
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
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.25),
    color: colors.text,
    fontSize: 16
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: "top"
  },
  hint: {
    color: colors.muted,
    fontSize: 12
  },
  avatarPreviewWrapper: {
    alignItems: "center",
    gap: spacing(0.5)
  },
  avatarPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.bg
  },
  previewError: {
    color: colors.danger,
    fontSize: 12
  },
  success: {
    color: colors.success,
    fontSize: 14
  },
  error: {
    color: colors.danger,
    fontSize: 14
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing(1.75),
    alignItems: "center"
  },
  primaryButtonText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 16
  },
  disabledButton: {
    opacity: 0.6
  },
  linkButton: {
    paddingVertical: spacing(1)
  },
  linkText: {
    color: colors.accent,
    fontWeight: "600",
    textAlign: "center"
  },
  passwordCard: {
    marginTop: spacing(2),
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing(3),
    gap: spacing(1.25),
    borderWidth: 1,
    borderColor: colors.border
  },
  servicesCard: {
    marginTop: spacing(2),
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing(3),
    gap: spacing(1.25),
    borderWidth: 1,
    borderColor: colors.border
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700"
  },
  helperText: {
    color: colors.muted,
    fontSize: 14
  },
  serviceRow: {
    gap: spacing(0.5)
  },
  serviceTitle: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 16
  },
  serviceMeta: {
    color: colors.muted,
    fontSize: 12
  },
  serviceNotes: {
    color: colors.text,
    fontSize: 13
  },
  dangerCard: {
    marginTop: spacing(2),
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing(3),
    gap: spacing(1.5),
    borderWidth: 1,
    borderColor: colors.border
  },
  dangerTitle: {
    color: colors.danger,
    fontSize: 18,
    fontWeight: "700"
  },
  dangerSubtitle: {
    color: colors.muted,
    fontSize: 14
  },
  dangerButton: {
    backgroundColor: colors.danger,
    borderRadius: radii.md,
    paddingVertical: spacing(1.5),
    alignItems: "center"
  },
  dangerButtonText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 15
  }
});
