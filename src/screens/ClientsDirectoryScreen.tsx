import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { RootStackParamList } from "../navigation/RootNavigator";
import { colors, radii, spacing } from "../theme/theme";
import { useAppStore } from "../state/useAppStore";
import { PublicUser, UserStatus } from "../services/authService";

type Props = NativeStackScreenProps<RootStackParamList, "ClientsDirectory">;

type ClientFormState = {
  name: string;
  email: string;
  phone: string;
  bio: string;
};

const initialFormState: ClientFormState = {
  name: "",
  email: "",
  phone: "",
  bio: ""
};

const statusFilters: Array<{ label: string; value: UserStatus | "all" }> = [
  { label: "Todos", value: "all" },
  { label: "Activos", value: "active" },
  { label: "Inactivos", value: "inactive" }
];

export default function ClientsDirectoryScreen({ navigation }: Props) {
  const hasPermission = useAppStore((s) => s.hasPermission);
  const recordAccessDenied = useAppStore((s) => s.recordAccessDenied);
  const loadClients = useAppStore((s) => s.loadClients);
  const clients = useAppStore((s) => s.clients);
  const clientsLoading = useAppStore((s) => s.clientsLoading);
  const clientSearch = useAppStore((s) => s.clientSearch);
  const clientStatusFilter = useAppStore((s) => s.clientStatusFilter);
  const setClientSearch = useAppStore((s) => s.setClientSearch);
  const setClientStatusFilter = useAppStore((s) => s.setClientStatusFilter);
  const registerClient = useAppStore((s) => s.registerClient);
  const updateClientEntry = useAppStore((s) => s.updateClientEntry);
  const disableClientEntry = useAppStore((s) => s.disableClientEntry);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ClientFormState>(initialFormState);
  const [editing, setEditing] = useState<PublicUser | null>(null);
  const [editForm, setEditForm] = useState<ClientFormState>(initialFormState);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const allowed = hasPermission("accounts:create");
      if (!allowed) {
        recordAccessDenied("clients:access", "Intento de acceder al directorio sin permiso.", {
          screen: "ClientsDirectory"
        });
        Alert.alert("Sin permisos", "No tienes permisos para acceder a esta funcion.", [
          { text: "Entendido", onPress: () => navigation.goBack() }
        ]);
        return;
      }
      loadClients();
    }, [hasPermission, recordAccessDenied, navigation, loadClients])
  );

  const filteredClients = useMemo(() => {
    const term = clientSearch.trim().toLowerCase();
    return clients.filter((client) => {
      if (clientStatusFilter !== "all" && client.status !== clientStatusFilter) {
        return false;
      }
      if (!term) {
        return true;
      }
      return (
        client.name.toLowerCase().includes(term) ||
        client.email.toLowerCase().includes(term) ||
        (client.phone ?? "").toLowerCase().includes(term)
      );
    });
  }, [clients, clientSearch, clientStatusFilter]);

  const handleInputChange = <K extends keyof ClientFormState>(key: K, value: string, mode: "create" | "edit") => {
    const trimmed = value;
    if (mode === "create") {
      setForm((prev) => ({ ...prev, [key]: trimmed }));
    } else {
      setEditForm((prev) => ({ ...prev, [key]: trimmed }));
    }
  };

  const validateForm = (state: ClientFormState) => {
    if (!state.name.trim()) {
      return "El nombre es obligatorio.";
    }
    if (!state.email.trim()) {
      return "El correo electronico es obligatorio.";
    }
    if (!state.phone.trim()) {
      return "El telefono es obligatorio.";
    }
    return null;
  };

  const handleRegister = async () => {
    if (submitting) {
      return;
    }
    const validation = validateForm(form);
    if (validation) {
      Alert.alert("Verifica los datos", validation);
      return;
    }
    setSubmitting(true);
    const result = await registerClient({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      bio: form.bio.trim()
    });
    setSubmitting(false);
    if (!result.success) {
      Alert.alert("Error", result.error ?? "Error al registrar el cliente. Intenta nuevamente.");
      return;
    }
    setForm(initialFormState);
    setCreating(false);
    const passwordMessage = result.temporaryPassword
      ? `Entrega esta contrasena temporal al cliente: ${result.temporaryPassword}`
      : "";
    Alert.alert(
      "Cliente registrado correctamente.",
      passwordMessage ? `Cliente registrado correctamente.\n\n${passwordMessage}` : "Cliente registrado correctamente."
    );
  };

  const handleEdit = (client: PublicUser) => {
    setEditing(client);
    setEditForm({
      name: client.name ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      bio: client.bio ?? ""
    });
  };

  const submitEdit = async () => {
    if (!editing || submitting) {
      return;
    }
    const validation = validateForm(editForm);
    if (validation) {
      Alert.alert("Verifica los datos", validation);
      return;
    }
    setSubmitting(true);
    const result = await updateClientEntry(editing.id, {
      name: editForm.name.trim(),
      email: editForm.email.trim(),
      phone: editForm.phone.trim(),
      bio: editForm.bio.trim()
    });
    setSubmitting(false);
    if (!result.success) {
      Alert.alert("No se pudo actualizar el cliente.", result.error ?? "Intenta de nuevo.");
      return;
    }
    Alert.alert("Datos del cliente actualizados correctamente.");
    setEditing(null);
    setEditForm(initialFormState);
  };

  const confirmDisable = (client: PublicUser) => {
    Alert.alert(
      "Deshabilitar cliente",
      `El cliente ${client.name} ya no podra interactuar hasta que lo reactives. Deseas continuar?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Deshabilitar",
          style: "destructive",
          onPress: async () => {
            const result = await disableClientEntry(client.id);
            if (!result.success) {
              Alert.alert("No se pudo completar la accion.", result.error ?? "Intenta nuevamente.");
              return;
            }
            Alert.alert(result.message ?? "Cliente deshabilitado correctamente.");
          }
        }
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Directorio de clientes</Text>
          <Text style={styles.subtitle}>
            Gestiona tus clientes registrados, edita sus datos o deshabilitalos cuando sea necesario.
          </Text>
        </View>

        <View style={styles.filters}>
          <TextInput
            style={styles.input}
            placeholder="Buscar por nombre, correo o telefono"
            placeholderTextColor={colors.muted}
            value={clientSearch}
            onChangeText={setClientSearch}
          />
          <View style={styles.filterRow}>
            {statusFilters.map((filter) => {
              const active = filter.value === clientStatusFilter;
              return (
                <Pressable
                  key={filter.value}
                  onPress={() => setClientStatusFilter(filter.value)}
                  style={[styles.filterChip, active ? styles.filterChipActive : null]}
                >
                  <Text style={active ? styles.filterTextActive : styles.filterText}>{filter.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Pressable
            style={[styles.toggleButton, creating ? styles.toggleButtonActive : null]}
            onPress={() => {
              setCreating((prev) => !prev);
              setForm(initialFormState);
            }}
          >
            <Text style={styles.toggleButtonText}>
              {creating ? "Cerrar formulario" : "Registrar nuevo cliente"}
            </Text>
          </Pressable>
          {creating ? (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Nuevo cliente</Text>
              <TextInput
                style={styles.input}
                placeholder="Nombre completo"
                placeholderTextColor={colors.muted}
                value={form.name}
                onChangeText={(text) => handleInputChange("name", text, "create")}
              />
              <TextInput
                style={styles.input}
                placeholder="correo@cliente.com"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={form.email}
                onChangeText={(text) => handleInputChange("email", text, "create")}
              />
              <TextInput
                style={styles.input}
                placeholder="Telefono"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                value={form.phone}
                onChangeText={(text) => handleInputChange("phone", text, "create")}
              />
              <TextInput
                style={[styles.input, styles.multiline]}
                placeholder="Descripcion breve"
                placeholderTextColor={colors.muted}
                value={form.bio}
                onChangeText={(text) => handleInputChange("bio", text, "create")}
                multiline
              />
              <Pressable style={styles.submitButton} onPress={handleRegister} disabled={submitting}>
                <Text style={styles.submitButtonText}>
                  {submitting ? "Guardando..." : "Guardar cliente"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Clientes registrados</Text>
          {clientsLoading ? (
            <Text style={styles.helperText}>Cargando clientes...</Text>
          ) : filteredClients.length === 0 ? (
            <Text style={styles.helperText}>No hay clientes registrados actualmente.</Text>
          ) : (
            filteredClients.map((client) => (
              <View key={client.id} style={styles.clientCard}>
                <View style={styles.clientHeader}>
                  <Text style={styles.clientName}>{client.name}</Text>
                  <Text
                    style={[
                      styles.clientStatus,
                      client.status === "active" ? styles.statusActive : styles.statusInactive
                    ]}
                  >
                    {client.status === "active" ? "Activo" : "Inactivo"}
                  </Text>
                </View>
                <Text style={styles.clientDetail}>{client.email}</Text>
                <Text style={styles.clientDetail}>{client.phone ?? "Sin telefono"}</Text>
                <Text style={styles.clientDetail}>
                  Registrado el {new Date(client.createdAt).toLocaleDateString()}
                </Text>
                {client.bio ? <Text style={styles.clientBio}>{client.bio}</Text> : null}
                <View style={styles.clientActions}>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() =>
                      navigation.navigate("ClientTimeline", {
                        clientId: client.id,
                        clientName: client.name
                      })
                    }
                  >
                    <Text style={styles.actionButtonText}>Historial</Text>
                  </Pressable>
                  <Pressable style={styles.actionButton} onPress={() => handleEdit(client)}>
                    <Text style={styles.actionButtonText}>Editar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, styles.actionDanger]}
                    onPress={() => confirmDisable(client)}
                  >
                    <Text style={styles.actionDangerText}>Deshabilitar</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        {editing ? (
          <View style={styles.section}>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Editar cliente</Text>
              <TextInput
                style={styles.input}
                placeholder="Nombre completo"
                placeholderTextColor={colors.muted}
                value={editForm.name}
                onChangeText={(text) => handleInputChange("name", text, "edit")}
              />
              <TextInput
                style={styles.input}
                placeholder="correo@cliente.com"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={editForm.email}
                onChangeText={(text) => handleInputChange("email", text, "edit")}
              />
              <TextInput
                style={styles.input}
                placeholder="Telefono"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                value={editForm.phone}
                onChangeText={(text) => handleInputChange("phone", text, "edit")}
              />
              <TextInput
                style={[styles.input, styles.multiline]}
                placeholder="Descripcion breve"
                placeholderTextColor={colors.muted}
                value={editForm.bio}
                onChangeText={(text) => handleInputChange("bio", text, "edit")}
                multiline
              />
              <View style={styles.editActions}>
                <Pressable style={styles.submitButton} onPress={submitEdit} disabled={submitting}>
                  <Text style={styles.submitButtonText}>
                    {submitting ? "Guardando..." : "Actualizar cliente"}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => {
                    setEditing(null);
                    setEditForm(initialFormState);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </Pressable>
              </View>
            </View>
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
  header: {
    gap: spacing(1.5)
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
  filters: {
    gap: spacing(1)
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.25),
    color: colors.text,
    fontSize: 16
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top"
  },
  filterRow: {
    flexDirection: "row",
    gap: spacing(1)
  },
  filterChip: {
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.75),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  filterText: {
    color: colors.muted,
    fontWeight: "600"
  },
  filterTextActive: {
    color: colors.text,
    fontWeight: "700"
  },
  section: {
    gap: spacing(1.5)
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700"
  },
  toggleButton: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: spacing(1.25),
    alignItems: "center",
    backgroundColor: colors.card
  },
  toggleButtonActive: {
    backgroundColor: colors.primary
  },
  toggleButtonText: {
    color: colors.text,
    fontWeight: "700"
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing(2),
    gap: spacing(1.25),
    borderWidth: 1,
    borderColor: colors.border
  },
  formTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700"
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing(1.25),
    alignItems: "center"
  },
  submitButtonText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 16
  },
  cancelButton: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(1.1),
    alignItems: "center"
  },
  cancelButtonText: {
    color: colors.muted,
    fontWeight: "600"
  },
  helperText: {
    color: colors.muted,
    fontSize: 14
  },
  clientCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing(2),
    gap: spacing(0.75),
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing(1.5)
  },
  clientHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing(1)
  },
  clientName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700"
  },
  clientStatus: {
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.5),
    borderRadius: radii.md,
    fontSize: 12,
    fontWeight: "700"
  },
  statusActive: {
    backgroundColor: colors.primary,
    color: colors.text
  },
  statusInactive: {
    backgroundColor: colors.border,
    color: colors.muted
  },
  clientDetail: {
    color: colors.muted,
    fontSize: 14
  },
  clientBio: {
    color: colors.text,
    fontSize: 14
  },
  clientActions: {
    flexDirection: "row",
    gap: spacing(1),
    marginTop: spacing(1)
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing(1),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    backgroundColor: colors.card
  },
  actionButtonText: {
    color: colors.primary,
    fontWeight: "700"
  },
  actionDanger: {
    borderColor: colors.danger
  },
  actionDangerText: {
    color: colors.danger,
    fontWeight: "700"
  },
  editActions: {
    gap: spacing(1)
  }
});
