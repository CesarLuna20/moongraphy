import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { colors, radii, spacing } from "../theme/theme";
import { useAppStore } from "../state/useAppStore";
import { PublicUser, Session, SessionStatus, SessionType } from "../services/authService";

type Props = NativeStackScreenProps<RootStackParamList, "SessionsAgenda">;

const statusFilterOptions: Array<{ value: SessionStatus | "all"; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "scheduled", label: "Programadas" },
  { value: "confirmed", label: "Confirmadas" },
  { value: "client-confirmed", label: "Cliente confirmo" },
  { value: "completed", label: "Completadas" },
  { value: "cancelled", label: "Canceladas" }
];

const sessionStatusLabels: Record<SessionStatus, string> = {
  scheduled: "Programada",
  confirmed: "Confirmada",
  "client-confirmed": "Confirmada por cliente",
  completed: "Completada",
  cancelled: "Cancelada"
};

const sessionStatusColors: Record<SessionStatus, { background: string; text: string }> = {
  scheduled: { background: "rgba(108,160,255,0.18)", text: colors.primary },
  confirmed: { background: "rgba(83,215,105,0.2)", text: colors.success },
  "client-confirmed": { background: "rgba(155,108,255,0.2)", text: colors.accent },
  completed: { background: "rgba(234,239,247,0.08)", text: colors.text },
  cancelled: { background: "rgba(255,59,48,0.2)", text: colors.danger }
};

type SessionFormState = {
  clientId: string;
  sessionTypeId?: string;
  type: string;
  location: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  notes: string;
};

const formatDateForInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatTimeForInput = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const createInitialSessionForm = (): SessionFormState => {
  const now = new Date();
  const end = new Date(now.getTime() + 60 * 60 * 1000);
  return {
    clientId: "",
    sessionTypeId: undefined,
    type: "",
    location: "",
    startDate: formatDateForInput(now),
    startTime: formatTimeForInput(now),
    endDate: formatDateForInput(end),
    endTime: formatTimeForInput(end),
    notes: ""
  };
};

const isoToDateInput = (iso?: string) => {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return formatDateForInput(date);
};

const isoToTimeInput = (iso?: string) => {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return formatTimeForInput(date);
};

const formatDateTime = (value?: string) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const buildIsoDateTime = (date: string, time: string) => {
  const [yearStr, monthStr, dayStr] = date.split("-");
  const [hourStr, minuteStr] = time.split(":");
  if (!yearStr || !monthStr || !dayStr || !hourStr || !minuteStr) {
    return null;
  }
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if ([year, month, day, hour, minute].some((value) => Number.isNaN(value))) {
    return null;
  }
  const instance = new Date(year, month - 1, day, hour, minute, 0, 0);
  return instance.toISOString();
};

const validateSessionForm = (state: SessionFormState) => {
  if (!state.clientId) {
    return "Selecciona el cliente asociado a la sesion.";
  }
  if (!state.type.trim()) {
    return "Ingresa el tipo de sesion.";
  }
  if (!state.location.trim()) {
    return "Ingresa la ubicacion.";
  }
  if (!state.startDate || !state.startTime) {
    return "Define fecha y hora de inicio.";
  }
  if (!state.endDate || !state.endTime) {
    return "Define fecha y hora de finalizacion.";
  }
  const startIso = buildIsoDateTime(state.startDate, state.startTime);
  const endIso = buildIsoDateTime(state.endDate, state.endTime);
  if (!startIso || !endIso) {
    return "Las fechas ingresadas no son validas.";
  }
  if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
    return "La hora de fin debe ser posterior al inicio.";
  }
  return null;
};

const SessionsAgendaScreen: React.FC<Props> = ({ navigation }) => {
  const user = useAppStore((state) => state.user);
  const recordAccessDenied = useAppStore((state) => state.recordAccessDenied);
  const sessions = useAppStore((state) => state.sessions);
  const sessionsLoading = useAppStore((state) => state.sessionsLoading);
  const loadSessions = useAppStore((state) => state.loadSessions);
  const sessionFilters = useAppStore((state) => state.sessionFilters);
  const setSessionFilters = useAppStore((state) => state.setSessionFilters);
  const createSession = useAppStore((state) => state.createSession);
  const updateSessionEntry = useAppStore((state) => state.updateSessionEntry);
  const cancelSessionEntry = useAppStore((state) => state.cancelSessionEntry);
  const confirmSession = useAppStore((state) => state.confirmSession);
  const confirmSessionAttendance = useAppStore((state) => state.confirmSessionAttendance);
  const clients = useAppStore((state) => state.clients);
  const clientsLoading = useAppStore((state) => state.clientsLoading);
  const loadClients = useAppStore((state) => state.loadClients);
  const sessionTypes = useAppStore((state) => state.sessionTypes);
  const sessionTypesLoading = useAppStore((state) => state.sessionTypesLoading);
  const loadSessionTypes = useAppStore((state) => state.loadSessionTypes);

  const isPhotographer =
    user?.role === "photographer" || user?.role === "photographer-admin";

  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formState, setFormState] = useState<SessionFormState>(() => createInitialSessionForm());
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [clientPickerVisible, setClientPickerVisible] = useState(false);
  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [filterDraft, setFilterDraft] = useState({
    from: sessionFilters.from ?? "",
    to: sessionFilters.to ?? "",
    type: sessionFilters.type ?? ""
  });

  useEffect(() => {
    setFilterDraft({
      from: sessionFilters.from ?? "",
      to: sessionFilters.to ?? "",
      type: sessionFilters.type ?? ""
    });
  }, [sessionFilters.from, sessionFilters.to, sessionFilters.type]);

  const selectedStatus: SessionStatus | "all" = sessionFilters.status ?? "all";

  useFocusEffect(
    useCallback(() => {
      if (!isPhotographer) {
        recordAccessDenied("sessions:access", "Intento de acceder a la agenda sin permisos.", {
          screen: "SessionsAgenda"
        });
        Alert.alert("Sin permisos", "Solo los fotografos pueden acceder a la agenda.", [
          { text: "Entendido", onPress: () => navigation.goBack() }
        ]);
        return;
      }
      void loadSessions();
      if (!clientsLoading && clients.length === 0) {
        void loadClients();
      }
      if (!sessionTypesLoading && sessionTypes.length === 0) {
        void loadSessionTypes(false);
      }
    }, [
      isPhotographer,
      recordAccessDenied,
      navigation,
      loadSessions,
      clients.length,
      clientsLoading,
      loadClients,
      sessionTypes.length,
      sessionTypesLoading,
      loadSessionTypes
    ])
  );

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );

  const filteredClients = useMemo(() => {
    const term = clientSearch.trim().toLowerCase();
    if (!term) {
      return sortedClients;
    }
    return sortedClients.filter((client) => {
      const haystack = `${client.name} ${client.email} ${client.phone ?? ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [sortedClients, clientSearch]);

  const activeSessionTypes = useMemo(
    () => sessionTypes.filter((entry) => !entry.archived),
    [sessionTypes]
  );

  const selectedClient: PublicUser | undefined = useMemo(
    () => sortedClients.find((client) => client.id === formState.clientId),
    [sortedClients, formState.clientId]
  );

  const selectedSessionType: SessionType | undefined = useMemo(
    () => sessionTypes.find((entry) => entry.id === formState.sessionTypeId),
    [sessionTypes, formState.sessionTypeId]
  );

  const sessionsByDay = useMemo(() => {
    const groups = new Map<string, { label: string; items: Session[]; order: number }>();
    const undated: Session[] = [];
    sessions.forEach((session) => {
      const date = session.start ? new Date(session.start) : null;
      if (!date || Number.isNaN(date.getTime())) {
        undated.push(session);
        return;
      }
      const key = formatDateForInput(date);
      const label = date.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric"
      });
      const existing = groups.get(key);
      if (existing) {
        existing.items.push(session);
      } else {
        groups.set(key, { label, items: [session], order: date.getTime() });
      }
    });
    const ordered = Array.from(groups.entries())
      .sort((a, b) => a[1].order - b[1].order)
      .map(([key, value]) => ({
        key,
        label: value.label,
        items: value.items.sort(
          (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
        )
      }));
    if (undated.length > 0) {
      ordered.push({
        key: "sin-fecha",
        label: "Sin fecha",
        items: undated
      });
    }
    return ordered;
  }, [sessions]);

  const handleOpenCreate = () => {
    setFormMode("create");
    setEditingSession(null);
    setFormState(createInitialSessionForm());
    setFormModalVisible(true);
  };

  const handleEditSession = (session: Session) => {
    setFormMode("edit");
    setEditingSession(session);
    setFormState({
      clientId: session.clientId,
      sessionTypeId: session.sessionTypeId,
      type: session.type,
      location: session.location,
      startDate: isoToDateInput(session.start),
      startTime: isoToTimeInput(session.start),
      endDate: isoToDateInput(session.end),
      endTime: isoToTimeInput(session.end),
      notes: session.notes ?? ""
    });
    setFormModalVisible(true);
  };

  const closeFormModal = () => {
    setFormModalVisible(false);
    setSubmitting(false);
    setEditingSession(null);
    setFormState(createInitialSessionForm());
  };

  const handleSubmitSession = async () => {
    if (submitting) {
      return;
    }
    const validation = validateSessionForm(formState);
    if (validation) {
      Alert.alert("Verifica los datos", validation);
      return;
    }
    const startIso = buildIsoDateTime(formState.startDate, formState.startTime);
    const endIso = buildIsoDateTime(formState.endDate, formState.endTime);
    if (!startIso || !endIso) {
      Alert.alert("Verifica los datos", "No fue posible construir las fechas de la sesion.");
      return;
    }
    setSubmitting(true);
    try {
      if (formMode === "create") {
        const result = await createSession({
          clientId: formState.clientId,
          type: formState.type.trim(),
          sessionTypeId: formState.sessionTypeId,
          location: formState.location.trim(),
          start: startIso,
          end: endIso,
          notes: formState.notes.trim() ? formState.notes.trim() : undefined
        });
        if (!result.success) {
          Alert.alert("Error", result.error ?? "No se pudo crear la sesion.");
          return;
        }
        const notificationMessage =
          result.notificationError ??
          (result.notificationSent ? "Se notifico al cliente." : undefined);
        Alert.alert(
          "Sesion creada",
          notificationMessage ?? "La sesion quedo registrada correctamente."
        );
      } else if (editingSession) {
        const result = await updateSessionEntry(editingSession.id, {
          type: formState.type.trim() || undefined,
          sessionTypeId: formState.sessionTypeId,
          location: formState.location.trim() || undefined,
          start: startIso,
          end: endIso,
          notes: formState.notes.trim() ? formState.notes.trim() : undefined
        });
        if (!result.success) {
          Alert.alert("Error", result.error ?? "No se pudo actualizar la sesion.");
          return;
        }
        const notificationMessage =
          result.notificationError ??
          (result.notificationSent ? "Se notifico a los participantes." : undefined);
        Alert.alert(
          "Cambios guardados",
          notificationMessage ?? "La sesion se actualizo correctamente."
        );
      }
      closeFormModal();
      void loadSessions();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSession = (session: Session) => {
    Alert.alert(
      "Cancelar sesion",
      "Esta accion notificara al cliente y marcara la sesion como cancelada.",
      [
        { text: "Mantener", style: "cancel" },
        {
          text: "Cancelar sesion",
          style: "destructive",
          onPress: async () => {
            const result = await cancelSessionEntry(session.id);
            if (!result.success) {
              Alert.alert("Error", result.error ?? "No se pudo cancelar la sesion.");
              return;
            }
            const notificationMessage =
              result.notificationError ??
              (result.notificationSent ? "Se envio aviso al cliente." : undefined);
            Alert.alert(
              "Sesion cancelada",
              notificationMessage ?? "El estado se actualizo correctamente."
            );
          }
        }
      ]
    );
  };

  const handleConfirmSession = async (session: Session) => {
    const result = await confirmSession(session.id);
    if (!result.success) {
      Alert.alert("Error", result.error ?? "No se pudo confirmar la sesion.");
      return;
    }
    const notificationMessage =
      result.notificationError ??
      (result.notificationSent ? "Se notifico al cliente acerca de la confirmacion." : undefined);
    Alert.alert(
      "Sesion confirmada",
      notificationMessage ?? "El estado se actualizo correctamente."
    );
  };

  const handleConfirmAttendance = async (session: Session) => {
    const result = await confirmSessionAttendance(session.id);
    if (!result.success) {
      Alert.alert(
        "Error",
        result.error ?? "No se pudo registrar la confirmacion del cliente."
      );
      return;
    }
    const notificationMessage =
      result.notificationError ??
      (result.notificationSent
        ? "Se confirmo la asistencia del cliente y se compartio la actualizacion."
        : undefined);
    Alert.alert(
      "Confirmacion registrada",
      notificationMessage ?? "El estado se actualizo correctamente."
    );
  };

  const applyFilters = () => {
    const trimmedType = filterDraft.type.trim();
    setSessionFilters({
      type: trimmedType || undefined,
      from: filterDraft.from || undefined,
      to: filterDraft.to || undefined
    });
    const payload: { type?: string; from?: string; to?: string } = {};
    if (trimmedType) {
      payload.type = trimmedType;
    }
    if (filterDraft.from) {
      payload.from = filterDraft.from;
    }
    if (filterDraft.to) {
      payload.to = filterDraft.to;
    }
    if (Object.keys(payload).length === 0) {
      void loadSessions();
    } else {
      void loadSessions(payload);
    }
  };

  const handleStatusChange = (value: SessionStatus | "all") => {
    if (value === "all") {
      setSessionFilters({ status: undefined });
      void loadSessions();
    } else {
      setSessionFilters({ status: value });
      void loadSessions({ status: value });
    }
  };

  const handleClearFilters = () => {
    setFilterDraft({ from: "", to: "", type: "" });
    setSessionFilters({ from: undefined, to: undefined, type: undefined, status: undefined });
    void loadSessions();
  };

  const handleSelectClient = (client: PublicUser) => {
    setFormState((prev) => ({
      ...prev,
      clientId: client.id
    }));
    setClientPickerVisible(false);
  };

  const handleSelectSessionType = (sessionType: SessionType) => {
    setFormState((prev) => ({
      ...prev,
      sessionTypeId: sessionType.id,
      type: sessionType.name
    }));
    setTypePickerVisible(false);
  };

  const handleTypeTextChange = (value: string) => {
    setFormState((prev) => {
      const currentTypeName = selectedSessionType?.name ?? "";
      const keepSelection =
        prev.sessionTypeId && value.trim().toLowerCase() === currentTypeName.toLowerCase();
      return {
        ...prev,
        type: value,
        sessionTypeId: keepSelection ? prev.sessionTypeId : undefined
      };
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={sessionsLoading} onRefresh={() => void loadSessions()} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Agenda de sesiones</Text>
          <Text style={styles.subtitle}>
            Organiza tus sesiones, notifica a los clientes y manten el estado actualizado en un solo
            lugar.
          </Text>
        </View>

        <View style={styles.filtersCard}>
          <Text style={styles.sectionTitle}>Filtros</Text>
          <Text style={styles.helper}>
            Combina filtros por tipo, fecha y estado para encontrar sesiones especificas.
          </Text>

          <View style={styles.filterRow}>
            <View style={styles.filterField}>
              <Text style={styles.label}>Tipo</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. Boda, Producto..."
                placeholderTextColor={colors.muted}
                value={filterDraft.type}
                onChangeText={(value) =>
                  setFilterDraft((prev) => ({
                    ...prev,
                    type: value
                  }))
                }
                onSubmitEditing={applyFilters}
                returnKeyType="search"
              />
            </View>
          </View>

          <View style={styles.filterRow}>
            <View style={styles.filterFieldHalf}>
              <Text style={styles.label}>Desde (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="2025-01-01"
                placeholderTextColor={colors.muted}
                value={filterDraft.from}
                onChangeText={(value) =>
                  setFilterDraft((prev) => ({
                    ...prev,
                    from: value
                  }))
                }
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.filterFieldHalf}>
              <Text style={styles.label}>Hasta (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="2025-12-31"
                placeholderTextColor={colors.muted}
                value={filterDraft.to}
                onChangeText={(value) =>
                  setFilterDraft((prev) => ({
                    ...prev,
                    to: value
                  }))
                }
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statusScroll}
          >
            {statusFilterOptions.map((option) => {
              const active = option.value === selectedStatus;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.statusChip, active && styles.statusChipActive]}
                  onPress={() => handleStatusChange(option.value)}
                >
                  <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.filterActions}>
            <Pressable style={styles.applyButton} onPress={applyFilters}>
              <Text style={styles.applyButtonText}>Aplicar filtros</Text>
            </Pressable>
            <Pressable style={styles.clearButton} onPress={handleClearFilters}>
              <Text style={styles.clearButtonText}>Limpiar</Text>
            </Pressable>
          </View>
        </View>

        {sessionsLoading && sessions.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Cargando sesiones...</Text>
          </View>
        ) : null}

        {!sessionsLoading && sessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Sin sesiones programadas</Text>
            <Text style={styles.emptySubtitle}>
              Programa la primera sesion para comenzar a gestionar tu agenda y generar historial
              automaticamente.
            </Text>
          </View>
        ) : null}

        {sessionsByDay.map((group) => (
          <View key={group.key} style={styles.groupCard}>
            <Text style={styles.groupTitle}>{group.label}</Text>
            <View style={styles.sessionList}>
              {group.items.map((session) => {
                const canEdit =
                  session.status !== "cancelled" && session.status !== "completed";
                const canCancel =
                  session.status !== "cancelled" && session.status !== "completed";
                const canConfirm = session.status === "scheduled";
                const canConfirmAttendance = session.status === "confirmed";
                const colorsInfo = sessionStatusColors[session.status];
                return (
                  <View key={session.id} style={styles.sessionCard}>
                    <View style={styles.sessionHeader}>
                      <Text style={styles.sessionTitle}>{session.type}</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: colorsInfo.background }
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            { color: colorsInfo.text }
                          ]}
                        >
                          {sessionStatusLabels[session.status]}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.sessionMeta}>
                      Cliente: {session.client?.name ?? "Sin asignar"} |{" "}
                      {session.client?.email ?? "-"}
                    </Text>
                    <Text style={styles.sessionMeta}>Ubicacion: {session.location}</Text>
                    <Text style={styles.sessionMeta}>
                      Inicio: {formatDateTime(session.start)}
                    </Text>
                    <Text style={styles.sessionMeta}>
                      Fin: {formatDateTime(session.end)}
                    </Text>
                    {session.notes ? <Text style={styles.sessionNotes}>{session.notes}</Text> : null}
                    <View style={styles.sessionActions}>
                      <Pressable
                        style={styles.sessionButton}
                        onPress={() =>
                          navigation.navigate("SessionTimeline", {
                            sessionId: session.id,
                            sessionType: session.type,
                            clientName: session.client?.name,
                            clientId: session.clientId
                          })
                        }
                      >
                        <Text style={styles.sessionButtonText}>Historial</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.sessionButton, !canEdit && styles.sessionButtonDisabled]}
                        onPress={() => handleEditSession(session)}
                        disabled={!canEdit}
                      >
                        <Text
                          style={[
                            styles.sessionButtonText,
                            !canEdit && styles.sessionButtonTextDisabled
                          ]}
                        >
                          Editar
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.sessionButton, !canConfirm && styles.sessionButtonDisabled]}
                        onPress={() => handleConfirmSession(session)}
                        disabled={!canConfirm}
                      >
                        <Text
                          style={[
                            styles.sessionButtonText,
                            !canConfirm && styles.sessionButtonTextDisabled
                          ]}
                        >
                          Confirmar
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.sessionButton,
                          !canConfirmAttendance && styles.sessionButtonDisabled
                        ]}
                        onPress={() => handleConfirmAttendance(session)}
                        disabled={!canConfirmAttendance}
                      >
                        <Text
                          style={[
                            styles.sessionButtonText,
                            !canConfirmAttendance && styles.sessionButtonTextDisabled
                          ]}
                        >
                          Cliente ok
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.sessionButton,
                          styles.sessionButtonDanger,
                          !canCancel && styles.sessionButtonDisabled
                        ]}
                        onPress={() => handleCancelSession(session)}
                        disabled={!canCancel}
                      >
                        <Text
                          style={[
                            styles.sessionButtonText,
                            styles.sessionButtonTextDanger,
                            !canCancel && styles.sessionButtonTextDisabled
                          ]}
                        >
                          Cancelar
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {isPhotographer ? (
        <Pressable style={styles.fab} onPress={handleOpenCreate}>
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      ) : null}

      <Modal
        visible={formModalVisible}
        animationType="slide"
        onRequestClose={closeFormModal}
      >
        <SafeAreaView style={styles.formModalContainer}>
          <KeyboardAvoidingView
            style={styles.formModalInner}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView contentContainerStyle={styles.formContent}>
              <Text style={styles.formTitle}>
                {formMode === "create" ? "Programar sesion" : "Editar sesion"}
              </Text>
              <Text style={styles.formSubtitle}>
                Define los detalles clave. El sistema notificara al cliente y registrara el evento
                en el historial automaticamente.
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Cliente</Text>
                <Pressable
                  style={styles.selector}
                  onPress={() => setClientPickerVisible(true)}
                >
                  <Text style={styles.selectorValue}>
                    {selectedClient ? selectedClient.name : "Selecciona cliente"}
                  </Text>
                  <Text style={styles.selectorHint}>
                    {selectedClient ? selectedClient.email : "Se notificara segun sus preferencias"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Tipo desde catalogo</Text>
                <Pressable
                  style={[styles.selector, activeSessionTypes.length === 0 && styles.selectorDisabled]}
                  onPress={() => activeSessionTypes.length > 0 && setTypePickerVisible(true)}
                  disabled={activeSessionTypes.length === 0}
                >
                  <Text style={styles.selectorValue}>
                    {selectedSessionType ? selectedSessionType.name : "Selecciona del catalogo"}
                  </Text>
                  <Text style={styles.selectorHint}>
                    {activeSessionTypes.length === 0
                      ? "Configura los tipos en Administracion -> Configuracion."
                      : "Puedes editar el texto manualmente si necesitas variantes."}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Tipo / descripcion</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. Boda en exteriores"
                  placeholderTextColor={colors.muted}
                  value={formState.type}
                  onChangeText={handleTypeTextChange}
                />
                {formState.sessionTypeId ? (
                  <Text style={styles.helper}>
                    Editar el texto manualmente desvinculara este registro del catalogo.
                  </Text>
                ) : null}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Ubicacion</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Direccion, estudio, locacion"
                  placeholderTextColor={colors.muted}
                  value={formState.location}
                  onChangeText={(value) =>
                    setFormState((prev) => ({
                      ...prev,
                      location: value
                    }))
                  }
                />
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldColumn}>
                  <Text style={styles.label}>Inicio (fecha)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.muted}
                    value={formState.startDate}
                    onChangeText={(value) =>
                      setFormState((prev) => ({
                        ...prev,
                        startDate: value
                      }))
                    }
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                <View style={styles.fieldColumn}>
                  <Text style={styles.label}>Inicio (hora)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="HH:MM"
                    placeholderTextColor={colors.muted}
                    value={formState.startTime}
                    onChangeText={(value) =>
                      setFormState((prev) => ({
                        ...prev,
                        startTime: value
                    }))
                  }
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={styles.fieldColumn}>
                <Text style={styles.label}>Fin (fecha)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.muted}
                  value={formState.endDate}
                  onChangeText={(value) =>
                    setFormState((prev) => ({
                      ...prev,
                      endDate: value
                    }))
                  }
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.fieldColumn}>
                <Text style={styles.label}>Fin (hora)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="HH:MM"
                  placeholderTextColor={colors.muted}
                  value={formState.endTime}
                  onChangeText={(value) =>
                    setFormState((prev) => ({
                      ...prev,
                      endTime: value
                    }))
                  }
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Notas internas (opcional)</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Indicaciones relevantes, requerimientos o informacion adicional."
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={4}
                value={formState.notes}
                onChangeText={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    notes: value
                  }))
                }
              />
            </View>

            <View style={styles.formButtons}>
              <Pressable
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmitSession}
                disabled={submitting}
              >
                <Text style={styles.submitButtonText}>
                  {submitting
                    ? "Guardando..."
                    : formMode === "create"
                    ? "Crear sesion"
                    : "Guardar cambios"}
                </Text>
              </Pressable>
              <Pressable style={styles.cancelButton} onPress={closeFormModal}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>

    <Modal
      visible={clientPickerVisible}
      animationType="fade"
      transparent
      onRequestClose={() => setClientPickerVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Seleccionar cliente</Text>
          <TextInput
            style={styles.modalSearch}
            placeholder="Buscar por nombre, correo o telefono"
            placeholderTextColor={colors.muted}
            value={clientSearch}
            onChangeText={setClientSearch}
          />
          <ScrollView style={styles.modalList}>
            {filteredClients.length === 0 ? (
              <Text style={styles.modalEmpty}>No hay clientes que coincidan.</Text>
            ) : (
              filteredClients.map((client) => (
                <Pressable
                  key={client.id}
                  style={styles.modalItem}
                  onPress={() => handleSelectClient(client)}
                >
                  <Text style={styles.modalItemTitle}>{client.name}</Text>
                  <Text style={styles.modalItemSubtitle}>{client.email}</Text>
                  {client.phone ? (
                    <Text style={styles.modalItemSubtitle}>{client.phone}</Text>
                  ) : null}
                </Pressable>
              ))
            )}
          </ScrollView>
          <Pressable style={styles.modalCloseButton} onPress={() => setClientPickerVisible(false)}>
            <Text style={styles.modalCloseText}>Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>

    <Modal
      visible={typePickerVisible}
      animationType="fade"
      transparent
      onRequestClose={() => setTypePickerVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Tipos de sesion disponibles</Text>
          <ScrollView style={styles.modalList}>
            {activeSessionTypes.length === 0 ? (
              <Text style={styles.modalEmpty}>
                Configura tipos de sesion en Administracion para agilizar la carga.
              </Text>
            ) : (
              activeSessionTypes.map((entry) => (
                <Pressable
                  key={entry.id}
                  style={styles.modalItem}
                  onPress={() => handleSelectSessionType(entry)}
                >
                  <Text style={styles.modalItemTitle}>{entry.name}</Text>
                  {entry.description ? (
                    <Text style={styles.modalItemSubtitle}>{entry.description}</Text>
                  ) : null}
                </Pressable>
              ))
            )}
          </ScrollView>
          <Pressable style={styles.modalCloseButton} onPress={() => setTypePickerVisible(false)}>
            <Text style={styles.modalCloseText}>Cerrar</Text>
          </Pressable>
        </View>
      </View>
  </Modal>
  </SafeAreaView>
);

};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  scrollContent: {
    padding: spacing(2),
    paddingBottom: spacing(7),
    gap: spacing(2)
  },
  header: {
    gap: spacing(1)
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800"
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  filtersCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2),
    gap: spacing(1.5)
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700"
  },
  helper: {
    color: colors.muted,
    fontSize: 13
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(1)
  },
  filterField: {
    flex: 1,
    gap: spacing(0.5)
  },
  filterFieldHalf: {
    flex: 1,
    minWidth: 150,
    gap: spacing(0.5)
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600"
  },
  input: {
    backgroundColor: colors.bg,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1),
    fontSize: 15
  },
  inputMultiline: {
    minHeight: 120,
    textAlignVertical: "top"
  },
  statusScroll: {
    flexDirection: "row",
    gap: spacing(1),
    paddingVertical: spacing(0.5)
  },
  statusChip: {
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.75),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing(1)
  },
  statusChipActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(108,160,255,0.15)"
  },
  statusChipText: {
    color: colors.muted,
    fontWeight: "600"
  },
  statusChipTextActive: {
    color: colors.primary
  },
  filterActions: {
    flexDirection: "row",
    gap: spacing(1),
    flexWrap: "wrap"
  },
  applyButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing(1.25),
    paddingHorizontal: spacing(2.5),
    alignItems: "center"
  },
  applyButtonText: {
    color: colors.text,
    fontWeight: "700"
  },
  clearButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing(1.25),
    paddingHorizontal: spacing(2.5),
    alignItems: "center"
  },
  clearButtonText: {
    color: colors.muted,
    fontWeight: "600"
  },
  loadingContainer: {
    alignItems: "center",
    gap: spacing(1)
  },
  loadingText: {
    color: colors.muted
  },
  emptyState: {
    alignItems: "center",
    gap: spacing(1),
    paddingVertical: spacing(5),
    paddingHorizontal: spacing(3)
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700"
  },
  emptySubtitle: {
    color: colors.muted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20
  },
  groupCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2),
    gap: spacing(1.5)
  },
  groupTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  sessionList: {
    gap: spacing(1.25)
  },
  sessionCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing(1.5),
    gap: spacing(0.75),
    backgroundColor: "rgba(255,255,255,0.02)"
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing(1)
  },
  sessionTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  statusBadge: {
    borderRadius: radii.md,
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.5)
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700"
  },
  sessionMeta: {
    color: colors.muted,
    fontSize: 13
  },
  sessionNotes: {
    color: colors.text,
    fontSize: 13
  },
  sessionActions: {
    marginTop: spacing(1),
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(1)
  },
  sessionButton: {
    paddingVertical: spacing(0.9),
    paddingHorizontal: spacing(1.75),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.card
  },
  sessionButtonDanger: {
    borderColor: colors.danger
  },
  sessionButtonDisabled: {
    opacity: 0.4
  },
  sessionButtonText: {
    color: colors.primary,
    fontWeight: "700"
  },
  sessionButtonTextDanger: {
    color: colors.danger
  },
  sessionButtonTextDisabled: {
    color: colors.muted
  },
  fab: {
    position: "absolute",
    right: spacing(3),
    bottom: spacing(3),
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 6
  },
  fabText: {
    color: colors.bg,
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 32
  },
  formModalContainer: {
    flex: 1,
    backgroundColor: colors.bg
  },
  formModalInner: {
    flex: 1
  },
  formContent: {
    padding: spacing(2),
    gap: spacing(1.5),
    paddingBottom: spacing(4)
  },
  formTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800"
  },
  formSubtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  fieldGroup: {
    gap: spacing(0.75)
  },
  fieldRow: {
    flexDirection: "row",
    gap: spacing(1)
  },
  fieldColumn: {
    flex: 1,
    gap: spacing(0.75)
  },
  selector: {
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg
  },
  selectorDisabled: {
    opacity: 0.4
  },
  selectorValue: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 15
  },
  selectorHint: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing(0.25)
  },
  formButtons: {
    gap: spacing(1)
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing(1.5),
    alignItems: "center"
  },
  submitButtonDisabled: {
    opacity: 0.6
  },
  submitButtonText: {
    color: colors.bg,
    fontWeight: "700",
    fontSize: 16
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing(1.25),
    alignItems: "center"
  },
  cancelButtonText: {
    color: colors.muted,
    fontWeight: "600"
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: spacing(2)
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing(2),
    gap: spacing(1.25),
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: "80%"
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700"
  },
  modalSearch: {
    backgroundColor: colors.bg,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1),
    fontSize: 15
  },
  modalList: {
    maxHeight: 400
  },
  modalItem: {
    paddingVertical: spacing(1),
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  modalItemTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700"
  },
  modalItemSubtitle: {
    color: colors.muted,
    fontSize: 12
  },
  modalEmpty: {
    color: colors.muted,
    paddingVertical: spacing(1)
  },
  modalCloseButton: {
    alignSelf: "flex-end",
    paddingVertical: spacing(0.75),
    paddingHorizontal: spacing(1.5),
    borderRadius: radii.md,
    backgroundColor: colors.primary
  },
  modalCloseText: {
    color: colors.text,
    fontWeight: "700"
  }
});

export default SessionsAgendaScreen;
