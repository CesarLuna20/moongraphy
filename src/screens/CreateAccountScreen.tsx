import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { colors, radii, spacing } from "../theme/theme";
import { useAppStore } from "../state/useAppStore";
import { CreateUserPayload, UserRole } from "../services/authService";
import { useFocusEffect } from "@react-navigation/native";

type Props = NativeStackScreenProps<RootStackParamList, "CreateAccount">;

type FormState = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  specialty: string;
  location: string;
  portfolioUrl: string;
  phone: string;
  bio: string;
};

const isPhotographerRole = (role: UserRole) =>
  role === "photographer" || role === "photographer-admin";

export default function CreateAccountScreen({ navigation }: Props) {
  const createAccount = useAppStore((s) => s.createAccount);
  const hasPermission = useAppStore((s) => s.hasPermission);
  const recordAccessDenied = useAppStore((s) => s.recordAccessDenied);
  const refreshAuditLog = useAppStore((s) => s.refreshAuditLog);
  const auditLog = useAppStore((s) => s.auditLog);
  const currentUser = useAppStore((s) => s.user);

  const isAdmin = currentUser?.role === "photographer-admin";

  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "client",
    specialty: "",
    location: "",
    portfolioUrl: "",
    phone: "",
    bio: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleOptions = useMemo(() => {
    const base: Array<{ value: UserRole; title: string; description: string }> = [
      {
        value: "client",
        title: "Cliente",
        description: "Puede explorar fotografos y solicitar servicios."
      },
      {
        value: "photographer",
        title: "Fotografo estandar",
        description: "Gestiona su portafolio y eventos personales."
      }
    ];
    if (isAdmin) {
      base.push({
        value: "photographer-admin",
        title: "Fotografo admin",
        description: "Puede administrar cuentas y configuraciones criticas."
      });
    }
    return base;
  }, [isAdmin]);

  const passwordHint = useMemo(
    () => "Minimo 8 caracteres, combinando letras y numeros.",
    []
  );

  useFocusEffect(
    useCallback(() => {
      const allowed = hasPermission("accounts:create");
      if (!allowed) {
        recordAccessDenied("accounts:create", "Intento de acceder sin permisos", {
          screen: "CreateAccount"
        });
        Alert.alert("Sin permisos", "No tienes permisos para acceder a esta funcion.", [
          { text: "Entendido", onPress: () => navigation.goBack() }
        ]);
      }
    }, [hasPermission, navigation, recordAccessDenied])
  );

  const handleInputChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleRoleChange = (role: UserRole) => {
    setForm((prev) => ({
      ...prev,
      role,
      specialty: isPhotographerRole(role) ? prev.specialty : "",
      location: isPhotographerRole(role) ? prev.location : "",
      portfolioUrl: isPhotographerRole(role) ? prev.portfolioUrl : ""
    }));
  };

  const validate = (): string | null => {
    const isClient = form.role === "client";
    if (!form.name.trim()) {
      return "El nombre es obligatorio.";
    }
    if (!form.email.trim()) {
      return "El correo electronico es obligatorio.";
    }
    if (!form.password.trim()) {
      return "La contrasena es obligatoria.";
    }
    if (form.password !== form.confirmPassword) {
      return "Las contrasenas no coinciden.";
    }
    if (isClient && !form.phone.trim()) {
      return "El telefono es obligatorio.";
    }
    if (isPhotographerRole(form.role)) {
      if (!form.specialty.trim()) {
        return "Debes indicar la especialidad fotografica.";
      }
      if (!form.location.trim()) {
        return "Debes indicar la ubicacion principal.";
      }
    }
    return null;
  };

  const resetForm = () => {
    setForm({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "client",
      specialty: "",
      location: "",
      portfolioUrl: "",
      phone: "",
      bio: ""
    });
  };

  const handleSubmit = async () => {
    if (loading) {
      return;
    }
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      Alert.alert("Revisa los datos", validationError);
      return;
    }
    setLoading(true);
    setError(null);

    const payload: CreateUserPayload = {
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password.trim(),
      role: form.role
    };

    if (form.phone.trim()) {
      payload.phone = form.phone.trim();
    }
    if (form.bio.trim()) {
      payload.bio = form.bio.trim();
    }
    if (isPhotographerRole(form.role)) {
      payload.specialty = form.specialty.trim();
      payload.location = form.location.trim();
      if (form.portfolioUrl.trim()) {
        payload.portfolioUrl = form.portfolioUrl.trim();
      }
    }

    const result = await createAccount(payload);
    setLoading(false);

    if (!result.success) {
      const message = result.error ?? "No se pudo crear la cuenta.";
      setError(message);
      Alert.alert("Accion incompleta", message);
      refreshAuditLog();
      return;
    }

    refreshAuditLog();
    resetForm();
    Alert.alert(
      "Registro exitoso",
      "Registro exitoso. Bienvenido a Moongraphy!",
      [{ text: "Listo" }],
      { cancelable: true }
    );
  };

  const recentAudit = auditLog.slice(0, 5);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Crear nueva cuenta</Text>
          <Text style={styles.subtitle}>
          Solo los fotografos administradores pueden registrar usuarios adicionales.
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Nombre completo</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(value) => handleInputChange("name", value)}
              placeholder="Nombre y apellidos"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Correo electronico</Text>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(value) => handleInputChange("email", value)}
              placeholder="usuario@correo.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Contrasena</Text>
            <TextInput
              style={styles.input}
              value={form.password}
              onChangeText={(value) => handleInputChange("password", value)}
              placeholder="********"
              placeholderTextColor={colors.muted}
              secureTextEntry
            />
            <Text style={styles.hint}>{passwordHint}</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Confirmar contrasena</Text>
            <TextInput
              style={styles.input}
              value={form.confirmPassword}
              onChangeText={(value) => handleInputChange("confirmPassword", value)}
              placeholder="********"
              placeholderTextColor={colors.muted}
              secureTextEntry
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Telefono</Text>
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={(value) => handleInputChange("phone", value)}
              placeholder="Ej. +52 55 1234 5678"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Descripcion personal (opcional)</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={form.bio}
              onChangeText={(value) => handleInputChange("bio", value)}
              placeholder="Comparte informacion relevante, max 200 caracteres"
              placeholderTextColor={colors.muted}
              multiline
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Rol asignado</Text>
            <View style={styles.roleRow}>
              {roleOptions.map((option) => {
                const selected = option.value === form.role;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => handleRoleChange(option.value)}
                    style={[styles.roleOption, selected ? styles.roleSelected : null]}
                  >
                    <Text
                      style={[
                        styles.roleTitle,
                        selected ? styles.roleSelectedText : styles.roleUnselectedText
                      ]}
                    >
                      {option.title}
                    </Text>
                    <Text
                      style={[
                        styles.roleDescription,
                        selected ? styles.roleSelectedText : styles.roleUnselectedText
                      ]}
                    >
                      {option.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {isPhotographerRole(form.role) ? (
            <>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Especialidad</Text>
                <TextInput
                  style={styles.input}
                  value={form.specialty}
                  onChangeText={(value) => handleInputChange("specialty", value)}
                  placeholder="Bodas, eventos, retratos..."
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
                <Text style={styles.label}>
                  Portafolio <Text style={styles.optional}>(opcional)</Text>
                </Text>
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

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
            <Text style={styles.submitText}>{loading ? "Creando..." : "Crear cuenta"}</Text>
          </Pressable>

          <Pressable style={styles.linkButton} onPress={() => navigation.goBack()}>
            <Text style={styles.linkText}>Volver</Text>
          </Pressable>
        </View>

        {auditLog.length > 0 ? (
          <View style={styles.auditCard}>
            <Text style={styles.auditTitle}>Auditoria reciente</Text>
            {recentAudit.map((event) => (
              <View key={event.id} style={styles.auditRow}>
                <Text style={styles.auditAction}>{event.action}</Text>
                <Text style={styles.auditMeta}>
                  {new Date(event.createdAt).toLocaleString()} - {event.status.toUpperCase()}
                </Text>
                <Text style={styles.auditDetails}>{event.message}</Text>
              </View>
            ))}
            <Pressable style={styles.auditButton} onPress={refreshAuditLog}>
              <Text style={styles.auditButtonText}>Actualizar auditoria</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  scrollContent: {
    padding: spacing(2),
    gap: spacing(2)
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing(3),
    gap: spacing(2)
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text
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
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.25),
    color: colors.text,
    fontSize: 16
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: "top"
  },
  hint: {
    color: colors.muted,
    fontSize: 12
  },
  optional: {
    color: colors.muted,
    fontStyle: "italic"
  },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(1)
  },
  roleOption: {
    flex: 1,
    minWidth: 160,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(1.5),
    backgroundColor: colors.bg
  },
  roleSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  roleTitle: {
    fontWeight: "700",
    fontSize: 15
  },
  roleDescription: {
    marginTop: spacing(0.5),
    fontSize: 13
  },
  roleSelectedText: {
    color: colors.text
  },
  roleUnselectedText: {
    color: colors.muted
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing(1.75),
    alignItems: "center"
  },
  submitText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 16
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
  },
  auditCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing(3),
    gap: spacing(1.5),
    borderWidth: 1,
    borderColor: colors.border
  },
  auditTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 18
  },
  auditRow: {
    gap: spacing(0.5),
    paddingVertical: spacing(0.5),
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  auditAction: {
    color: colors.text,
    fontWeight: "600"
  },
  auditMeta: {
    color: colors.muted,
    fontSize: 12
  },
  auditDetails: {
    color: colors.text,
    fontSize: 13
  },
  auditButton: {
    marginTop: spacing(1),
    alignSelf: "flex-start",
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg
  },
  auditButtonText: {
    color: colors.text,
    fontWeight: "600"
  }
});
