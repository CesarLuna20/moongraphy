import { create } from "zustand";
import {
  authService,
  PublicUser,
  CreateUserPayload,
  UpdateProfilePayload,
  AuditEvent,
  Permission,
  CreateClientPayload,
  UpdateClientPayload,
  UserStatus,
  Session,
  CreateSessionPayload,
  UpdateSessionPayload,
  SessionFilters,
  AvailabilitySlot,
  NotificationPreferences,
  UserNotification,
  Gallery,
  GalleryFilters,
  GalleryTotals,
  GalleryStatus,
  UploadableGalleryAsset,
  TimelineEvent,
  SessionType,
  NotificationTemplate,
  CancellationPolicy
} from "../services/authService";

const sortSessions = (sessions: Session[]) =>
  [...sessions].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

const sessionMatchesFilters = (session: Session, filters: SessionFilters) => {
  if (filters.clientId && session.clientId !== filters.clientId) {
    return false;
  }
  if (filters.photographerId && session.photographerId !== filters.photographerId) {
    return false;
  }
  if (filters.status && session.status !== filters.status) {
    return false;
  }
  if (filters.from && new Date(session.start).getTime() < new Date(filters.from).getTime()) {
    return false;
  }
  if (filters.to && new Date(session.start).getTime() > new Date(filters.to).getTime()) {
    return false;
  }
  if (filters.type) {
    const target = filters.type.toLowerCase();
    if (!session.type.toLowerCase().includes(target)) {
      return false;
    }
  }
  return true;
};

const hasActiveFilters = (filters: SessionFilters) =>
  Object.values(filters).some((value) => value !== undefined && value !== "");

const defaultNotificationPreferences: NotificationPreferences = {
  pushEnabled: true,
  inAppEnabled: true,
  confirmation: true,
  reminder48h: true,
  reminder24h: true,
  changes: true
};

const sortGalleries = (galleries: Gallery[]) =>
  [...galleries].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

const createEmptyGalleryTotals = (): GalleryTotals => ({
  total: 0,
  pending: 0,
  review: 0,
  delivered: 0,
  received: 0
});

const computeGalleryTotals = (galleries: Gallery[]): GalleryTotals => {
  const totals = createEmptyGalleryTotals();
  galleries.forEach((gallery) => {
    totals.total += 1;
    totals[gallery.status] = (totals[gallery.status] ?? 0) + 1;
  });
  return totals;
};

const sortSessionTypes = (types: SessionType[]) =>
  [...types].sort((a, b) => a.name.localeCompare(b.name));

type LoginResult = {
  success: boolean;
  error?: string;
  reactivated?: boolean;
  requiresPasswordChange?: boolean;
};

type AppState = {
  photosCount: number;
  user: PublicUser | null;
  token: string | null;
  lastError?: string;
  isHydrated: boolean;
  auditLog: AuditEvent[];
  clients: PublicUser[];
  clientsLoading: boolean;
  clientSearch: string;
  clientStatusFilter: UserStatus | "all";
  sessions: Session[];
  sessionsLoading: boolean;
  sessionFilters: SessionFilters;
  availability: AvailabilitySlot[];
  availabilityLoading: boolean;
  notifications: UserNotification[];
  notificationsLoading: boolean;
  notificationsUnread: number;
  notificationPreferences: NotificationPreferences;
  sessionTypes: SessionType[];
  sessionTypesLoading: boolean;
  sessionTypesIncludeArchived: boolean;
  notificationTemplates: NotificationTemplate[];
  notificationTemplatesLoading: boolean;
  cancellationPolicy?: CancellationPolicy;
  cancellationPolicyLoading: boolean;
  clientTimeline: TimelineEvent[];
  clientTimelineLoading: boolean;
  clientTimelineFor?: string;
  sessionTimeline: TimelineEvent[];
  sessionTimelineLoading: boolean;
  sessionTimelineFor?: string;
  galleries: Gallery[];
  galleriesLoading: boolean;
  galleryFilters: GalleryFilters;
  galleryTotals: GalleryTotals;
  galleryGrouping: "status" | "client" | "session";
  galleryUploadStates: Record<string, { progress: number; uploading: boolean; error?: string }>;
  selectedGallery?: Gallery;
  incPhotos: () => void;
  resetPhotos: () => void;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<LoginResult>;
  createAccount: (data: CreateUserPayload) => Promise<{ success: boolean; error?: string; user?: PublicUser }>;
  logout: () => Promise<void>;
  updateProfile: (
    updates: UpdateProfilePayload
  ) => Promise<{ success: boolean; error?: string; user?: PublicUser }>;
  disableAccount: () => Promise<{ success: boolean; error?: string; message?: string }>;
  requestPasswordReset: (
    email: string
  ) => Promise<{ success: boolean; message?: string; error?: string; temporaryPassword?: string }>;
  completePasswordChange: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ success: boolean; error?: string }>;
  loadClients: () => Promise<void>;
  setClientSearch: (value: string) => void;
  setClientStatusFilter: (value: UserStatus | "all") => void;
  registerClient: (
    payload: CreateClientPayload
  ) => Promise<{ success: boolean; error?: string; temporaryPassword?: string }>;
  updateClientEntry: (clientId: string, updates: UpdateClientPayload) => Promise<{ success: boolean; error?: string }>;
  disableClientEntry: (
    clientId: string
  ) => Promise<{ success: boolean; error?: string; message?: string }>;
  refreshAuditLog: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  recordAccessDenied: (action: string, message: string, metadata?: Record<string, unknown>) => Promise<void>;
  clearError: () => void;
  loadSessions: (filters?: SessionFilters) => Promise<void>;
  setSessionFilters: (filters: Partial<SessionFilters>) => void;
  createSession: (
    payload: CreateSessionPayload
  ) => Promise<{ success: boolean; error?: string; session?: Session; notificationSent?: boolean; notificationError?: string }>;
  updateSessionEntry: (
    sessionId: string,
    updates: UpdateSessionPayload
  ) => Promise<{ success: boolean; error?: string; session?: Session; notificationSent?: boolean; notificationError?: string }>;
  cancelSessionEntry: (
    sessionId: string,
    reason?: string
  ) => Promise<{ success: boolean; error?: string; session?: Session; notificationSent?: boolean; notificationError?: string }>;
  loadAvailability: () => Promise<void>;
  saveAvailability: (slots: AvailabilitySlot[]) => Promise<{ success: boolean; error?: string }>;
  loadNotifications: (unreadOnly?: boolean) => Promise<void>;
  markNotificationsRead: (ids?: string[], readAll?: boolean) => Promise<void>;
  updateNotificationPreferences: (
    updates: Partial<NotificationPreferences>
  ) => Promise<{ success: boolean; error?: string }>;
  loadSessionTypes: (includeArchived?: boolean) => Promise<void>;
  createSessionTypeEntry: (name: string, description?: string) => Promise<{ success: boolean; error?: string }>;
  updateSessionTypeEntryDetails: (
    sessionTypeId: string,
    payload: { name?: string; description?: string }
  ) => Promise<{ success: boolean; error?: string }>;
  archiveSessionTypeEntry: (sessionTypeId: string) => Promise<{ success: boolean; error?: string }>;
  restoreSessionTypeEntry: (sessionTypeId: string) => Promise<{ success: boolean; error?: string }>;
  loadNotificationTemplates: () => Promise<void>;
  saveNotificationTemplate: (
    key: string,
    body: string
  ) => Promise<{ success: true; template: NotificationTemplate } | { success: false; error?: string }>;
  resetNotificationTemplate: (
    key: string
  ) => Promise<{ success: true; template: NotificationTemplate } | { success: false; error?: string }>;
  loadCancellationPolicy: () => Promise<void>;
  saveCancellationPolicy: (
    settings: { minHoursCancel: number; minHoursReschedule: number; toleranceMinutes: number }
  ) => Promise<{ success: boolean; error?: string }>;
  loadClientTimeline: (clientId: string) => Promise<void>;
  loadSessionTimeline: (sessionId: string) => Promise<void>;
  addSessionNote: (sessionId: string, note: string) => Promise<{ success: boolean; error?: string }>;
  confirmSession: (
    sessionId: string
  ) => Promise<{
    success: boolean;
    error?: string;
    session?: Session;
    notificationSent?: boolean;
    notificationError?: string;
  }>;
  confirmSessionAttendance: (
    sessionId: string
  ) => Promise<{
    success: boolean;
    error?: string;
    session?: Session;
    notificationSent?: boolean;
    notificationError?: string;
  }>;
  loadGalleries: (filters?: Partial<GalleryFilters>) => Promise<void>;
  setGalleryFilters: (filters: Partial<GalleryFilters>) => void;
  setGalleryGrouping: (grouping: "status" | "client" | "session") => void;
  createGalleryEntry: (
    payload: { sessionId: string; name: string; description?: string }
  ) => Promise<{ success: boolean; error?: string; gallery?: Gallery }>;
  updateGalleryEntry: (
    galleryId: string,
    updates: { name?: string; description?: string }
  ) => Promise<{ success: boolean; error?: string; gallery?: Gallery }>;
  uploadGalleryAssets: (
    galleryId: string,
    assets: UploadableGalleryAsset[],
    onProgress?: (progress: number) => void
  ) => Promise<{ success: boolean; error?: string; gallery?: Gallery }>;
  updateGalleryStatus: (
    galleryId: string,
    status: Exclude<GalleryStatus, "received">
  ) => Promise<{
    success: boolean;
    error?: string;
    gallery?: Gallery;
    notificationSent?: boolean;
    notificationError?: string;
  }>;
  confirmGalleryDelivery: (
    galleryId: string
  ) => Promise<{
    success: boolean;
    error?: string;
    gallery?: Gallery;
    notificationSent?: boolean;
    notificationError?: string;
  }>;
  fetchGallery: (
    galleryId: string
  ) => Promise<{ success: boolean; error?: string; gallery?: Gallery }>;
  setSelectedGallery: (gallery?: Gallery) => void;
  clearGalleryUploadState: (galleryId: string) => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  photosCount: 0,
  user: null,
  token: null,
  lastError: undefined,
  isHydrated: false,
  auditLog: [],
  clients: [],
  clientsLoading: false,
  clientSearch: "",
  clientStatusFilter: "all",
  sessions: [],
  sessionsLoading: false,
  sessionFilters: {},
  availability: [],
  availabilityLoading: false,
  notifications: [],
  notificationsLoading: false,
  notificationsUnread: 0,
  notificationPreferences: { ...defaultNotificationPreferences },
  sessionTypes: [],
  sessionTypesLoading: false,
  sessionTypesIncludeArchived: false,
  notificationTemplates: [],
  notificationTemplatesLoading: false,
  cancellationPolicy: undefined,
  cancellationPolicyLoading: false,
  clientTimeline: [],
  clientTimelineLoading: false,
  clientTimelineFor: undefined,
  sessionTimeline: [],
  sessionTimelineLoading: false,
  sessionTimelineFor: undefined,
  galleries: [],
  galleriesLoading: false,
  galleryFilters: {},
  galleryTotals: createEmptyGalleryTotals(),
  galleryGrouping: "status",
  galleryUploadStates: {},
  selectedGallery: undefined,
  incPhotos: () =>
    set((state) => ({
      photosCount: state.photosCount + 1
    })),
  resetPhotos: () => set({ photosCount: 0 }),
  hydrate: async () => {
    await authService.ensureSeedData();
    const session = await authService.getStoredSession();
    const user = session?.user ?? null;
    const token = session?.token ?? null;
    const shouldLoadClients = !!user;
    const shouldLoadAvailability = user
      ? user.role === "photographer" || user.role === "photographer-admin"
      : false;
    const shouldLoadNotifications = !!user;
    const shouldLoadGalleries = !!user;
    const shouldLoadSessionTypes = user
      ? user.role === "photographer" || user.role === "photographer-admin"
      : false;
    const [auditLog, clients, availabilityResult, notificationsResult, galleriesResult, sessionTypesResult] =
      await Promise.all([
        authService.getAuditLog(),
        shouldLoadClients ? authService.getClients() : Promise.resolve([]),
        shouldLoadAvailability
          ? authService.getAvailability()
          : Promise.resolve({ success: true, availability: [] as AvailabilitySlot[] }),
      shouldLoadNotifications
        ? authService.getNotifications()
        : Promise.resolve({ success: true, notifications: [] as UserNotification[] }),
      shouldLoadGalleries
          ? authService.getGalleries()
          : Promise.resolve({
              success: true as const,
              galleries: [] as Gallery[],
              totals: createEmptyGalleryTotals()
          }),
        shouldLoadSessionTypes
          ? authService.getSessionTypes()
          : Promise.resolve({ success: true as const, types: [] as SessionType[] })
      ]);
    const sortedGalleries =
      galleriesResult.success && Array.isArray(galleriesResult.galleries)
        ? sortGalleries(galleriesResult.galleries)
        : [];
    const sortedSessionTypes =
      shouldLoadSessionTypes && sessionTypesResult.success
        ? sortSessionTypes(sessionTypesResult.types)
        : [];
    const sessionTypesError = sessionTypesResult.success ? undefined : sessionTypesResult.error;
    const galleriesError = galleriesResult.success ? undefined : galleriesResult.error;
    set({
      user,
      token,
      isHydrated: true,
      auditLog,
      clients,
      clientsLoading: false,
      availability: availabilityResult.success ? availabilityResult.availability : [],
      availabilityLoading: false,
      notifications: notificationsResult.success ? notificationsResult.notifications : [],
      notificationsLoading: false,
      notificationsUnread: notificationsResult.success
        ? notificationsResult.notifications.filter((notification) => !notification.readAt).length
        : 0,
      notificationPreferences: user
        ? user.notificationPreferences
        : { ...defaultNotificationPreferences },
      sessionTypes: sortedSessionTypes,
      sessionTypesLoading: false,
      sessionTypesIncludeArchived: shouldLoadSessionTypes ? false : false,
      galleries: sortedGalleries,
      galleriesLoading: false,
      galleryFilters: {},
      galleryTotals:
        galleriesResult.success && galleriesResult.totals
          ? galleriesResult.totals
          : computeGalleryTotals(sortedGalleries),
      galleryGrouping: "status",
      galleryUploadStates: {},
      selectedGallery: undefined,
      lastError: galleriesError ?? sessionTypesError
    });
  },
  login: async (email, password) => {
    const response = await authService.login(email, password);
    if (!response.success) {
      set({ lastError: response.error });
      return { success: false, error: response.error };
    }
    const { user: loggedUser, token } = response;
    const [auditLog, clients, notificationsResult, galleriesResult, sessionTypesResult] = await Promise.all([
      authService.getAuditLog(),
      authService.getClients(),
      authService.getNotifications(),
      authService.getGalleries(),
      authService.getSessionTypes()
    ]);
    const sortedGalleries =
      galleriesResult.success && Array.isArray(galleriesResult.galleries)
        ? sortGalleries(galleriesResult.galleries)
        : [];
    const sessionTypesError = sessionTypesResult.success ? undefined : sessionTypesResult.error;
    const galleriesError = galleriesResult.success ? undefined : galleriesResult.error;
    set({
      user: loggedUser,
      token,
      lastError: galleriesError ?? sessionTypesError,
      auditLog,
      clients,
      clientsLoading: false,
      availability: loggedUser.availability ?? [],
      availabilityLoading: false,
      sessions: [],
      sessionFilters: {},
      sessionsLoading: false,
      notifications: notificationsResult.success ? notificationsResult.notifications : [],
      notificationsLoading: false,
      notificationsUnread: notificationsResult.success
        ? notificationsResult.notifications.filter((notification) => !notification.readAt).length
        : 0,
      notificationPreferences: loggedUser.notificationPreferences ?? { ...defaultNotificationPreferences },
      sessionTypes: sessionTypesResult.success ? sortSessionTypes(sessionTypesResult.types) : [],
      sessionTypesLoading: false,
      sessionTypesIncludeArchived: false,
      galleries: sortedGalleries,
      galleriesLoading: false,
      galleryFilters: {},
      galleryTotals:
        galleriesResult.success && galleriesResult.totals
          ? galleriesResult.totals
          : computeGalleryTotals(sortedGalleries),
      galleryGrouping: "status",
      galleryUploadStates: {},
      selectedGallery: undefined
    });
    return {
      success: true,
      reactivated: false,
      requiresPasswordChange: !!loggedUser.forcePasswordReset
    };
  },
  createAccount: async (data) => {
    const response = await authService.createUser(data);
    if (!response.success) {
      set({ lastError: response.error });
      return response;
    }
    const [auditLog, clients] = await Promise.all([authService.getAuditLog(), authService.getClients()]);
    set({ auditLog, clients, lastError: undefined });
    return response;
  },
  logout: async () => {
    await authService.logout();
    set({
      user: null,
      token: null,
      auditLog: [],
      clients: [],
      clientsLoading: false,
      clientSearch: "",
      clientStatusFilter: "all",
      sessions: [],
      sessionsLoading: false,
      sessionFilters: {},
      availability: [],
      availabilityLoading: false,
      notifications: [],
      notificationsLoading: false,
      notificationsUnread: 0,
      notificationPreferences: { ...defaultNotificationPreferences },
      galleries: [],
      galleriesLoading: false,
      galleryFilters: {},
      galleryTotals: createEmptyGalleryTotals(),
      galleryGrouping: "status",
      galleryUploadStates: {},
      selectedGallery: undefined,
      lastError: undefined
    });
  },
  updateProfile: async (updates) => {
    const result = await authService.updateProfile(updates);
    if (!result.success) {
      return result;
    }
    const auditLog = await authService.getAuditLog();
    set({
      user: result.user,
      auditLog,
      notificationPreferences: result.user.notificationPreferences ?? { ...defaultNotificationPreferences }
    });
    return result;
  },
  disableAccount: async () => {
    const result = await authService.disableAccount();
    if (result.success) {
      set({
        user: null,
        token: null,
        auditLog: [],
        clients: [],
        clientsLoading: false,
        clientSearch: "",
        clientStatusFilter: "all",
        sessions: [],
        sessionsLoading: false,
        sessionFilters: {},
        availability: [],
        availabilityLoading: false,
        notifications: [],
        notificationsLoading: false,
        notificationsUnread: 0,
        notificationPreferences: { ...defaultNotificationPreferences }
      });
    }
    return result;
  },
  requestPasswordReset: async (email) => {
    const result = await authService.requestPasswordReset(email);
    if (!result.success) {
      return result;
    }
    const currentUser = get().user;
    if (currentUser && currentUser.email.toLowerCase() === email.trim().toLowerCase()) {
      set({ user: { ...currentUser, forcePasswordReset: true } });
    }
    const auditLog = await authService.getAuditLog();
    set({ auditLog });
    return result;
  },
  completePasswordChange: async (newPassword) => {
    const result = await authService.completePasswordChange(newPassword);
    if (!result.success) {
      return result;
    }
    const session = await authService.getStoredSession();
    const auditLog = await authService.getAuditLog();
    set({
      user: session?.user ?? null,
      token: session?.token ?? null,
      auditLog,
      notificationPreferences: session?.user?.notificationPreferences ?? { ...defaultNotificationPreferences }
    });
    return { success: true };
  },
  changePassword: async (currentPassword, newPassword) => {
    const result = await authService.changePassword(currentPassword, newPassword);
    if (!result.success) {
      return result;
    }
    const session = await authService.getStoredSession();
    const currentState = get();
    set({
      user: session?.user ?? currentState.user,
      token: session?.token ?? currentState.token,
      notificationPreferences:
        session?.user?.notificationPreferences ?? currentState.notificationPreferences
    });
    return { success: true };
  },
  loadClients: async () => {
    const currentUser = get().user;
    if (!currentUser) {
      set({ clients: [], clientsLoading: false });
      return;
    }
    set({ clientsLoading: true });
    const clients = await authService.getClients();
    set({ clients, clientsLoading: false });
  },
  setClientSearch: (value) => set({ clientSearch: value }),
  setClientStatusFilter: (value) => set({ clientStatusFilter: value }),
  registerClient: async (payload) => {
    const result = await authService.createManagedClient(payload);
    if (!result.success) {
      set({ lastError: result.error });
      return result;
    }
    const [clients, auditLog] = await Promise.all([authService.getClients(), authService.getAuditLog()]);
    set({ clients, auditLog, lastError: undefined });
    return result;
  },
  updateClientEntry: async (clientId, updates) => {
    const result = await authService.updateClient(clientId, updates);
    if (!result.success) {
      return result;
    }
    const [clients, auditLog] = await Promise.all([authService.getClients(), authService.getAuditLog()]);
    set({ clients, auditLog });
    return { success: true };
  },
  disableClientEntry: async (clientId) => {
    const result = await authService.disableClient(clientId);
    if (result.success) {
      const [clients, auditLog] = await Promise.all([authService.getClients(), authService.getAuditLog()]);
      set({ clients, auditLog });
    }
    return result;
  },
  loadSessions: async (filters) => {
    const user = get().user;
    if (!user) {
      set({ sessions: [], sessionsLoading: false });
      return;
    }
    const baseFilters = get().sessionFilters;
    const nextFilters: SessionFilters = filters ? { ...baseFilters, ...filters } : { ...baseFilters };
    set({ sessionsLoading: true, sessionFilters: nextFilters });
    const result = await authService.getSessions(nextFilters);
    if (!result.success) {
      set({ sessionsLoading: false, lastError: result.error });
      return;
    }
    const { sessions } = result;
    set({
      sessions: sortSessions(sessions),
      sessionsLoading: false,
      lastError: undefined
    });
  },
  setSessionFilters: (filters) =>
    set((state) => {
      const next: SessionFilters = { ...state.sessionFilters };
      (Object.entries(filters) as [keyof SessionFilters, SessionFilters[keyof SessionFilters]][]).forEach(
        ([key, value]) => {
          if (value === undefined || value === null || value === "") {
            delete next[key];
          } else {
            if (key === "status") {
              next.status = value as SessionFilters["status"];
            } else {
              next[key] = value as SessionFilters[typeof key];
            }
          }
        }
      );
      return { sessionFilters: next };
    }),
  createSession: async (payload) => {
    const result = await authService.createSession(payload);
    if (!result.success) {
      set({ lastError: result.error });
      return result;
    }
    const { session } = result;
    set((state) => {
      const filters = state.sessionFilters;
      const include = !hasActiveFilters(filters) || sessionMatchesFilters(session, filters);
      const base = state.sessions.filter((item) => item.id !== session.id);
      return {
        sessions: include ? sortSessions([...base, session]) : base,
        lastError: undefined
      };
    });
    return result;
  },
  updateSessionEntry: async (sessionId, updates) => {
    const result = await authService.updateSession(sessionId, updates);
    if (!result.success) {
      set({ lastError: result.error });
      return result;
    }
    const { session } = result;
    set((state) => {
      const filters = state.sessionFilters;
      const base = state.sessions.filter((item) => item.id !== session.id);
      const include = !hasActiveFilters(filters) || sessionMatchesFilters(session, filters);
      return {
        sessions: include ? sortSessions([...base, session]) : base,
        lastError: undefined
      };
    });
    return result;
  },
  cancelSessionEntry: async (sessionId, reason) => {
    const result = await authService.cancelSession(sessionId, reason);
    if (!result.success) {
      set({ lastError: result.error });
      return result;
    }
    const { session } = result;
    set((state) => {
      const filters = state.sessionFilters;
      const base = state.sessions.filter((item) => item.id !== session.id);
      const include = !hasActiveFilters(filters) || sessionMatchesFilters(session, filters);
      return {
        sessions: include ? sortSessions([...base, session]) : base,
        lastError: undefined
      };
    });
    return result;
  },
  loadAvailability: async () => {
    const user = get().user;
    if (!user || (user.role !== "photographer" && user.role !== "photographer-admin")) {
      set({ availability: [], availabilityLoading: false });
      return;
    }
    set({ availabilityLoading: true });
    const result = await authService.getAvailability();
    if (!result.success) {
      set({ availabilityLoading: false, lastError: result.error });
      return;
    }
    set({
      availability: result.availability,
      availabilityLoading: false,
      lastError: undefined
    });
  },
  saveAvailability: async (slots) => {
    set({ availabilityLoading: true });
    const result = await authService.updateAvailability(slots);
    if (!result.success) {
      set((state) => ({
        availability: state.availability,
        availabilityLoading: false,
        lastError: result.error
      }));
      return { success: false, error: result.error };
    }
    set({
      availability: result.availability,
      availabilityLoading: false,
      lastError: undefined
    });
    return { success: true };
  },
  loadNotifications: async (unreadOnly) => {
    const currentUser = get().user;
    if (!currentUser) {
      set({ notifications: [], notificationsLoading: false, notificationsUnread: 0 });
      return;
    }
    set({ notificationsLoading: true });
    const result = await authService.getNotifications(unreadOnly ?? false);
    if (!result.success) {
      set({ notificationsLoading: false, lastError: result.error });
      return;
    }
    set({
      notifications: result.notifications,
      notificationsLoading: false,
      notificationsUnread: result.notifications.filter((notification) => !notification.readAt).length,
      lastError: undefined
    });
  },
  markNotificationsRead: async (ids, readAll = false) => {
    const currentUser = get().user;
    if (!currentUser) {
      return;
    }
    if (!readAll && (!ids || ids.length === 0)) {
      return;
    }
    const result = await authService.markNotificationsRead(ids, readAll);
    if (!result.success) {
      set({ lastError: result.error });
      return;
    }
    const nowIso = new Date().toISOString();
    set((state) => {
      const targetIds = readAll ? state.notifications.map((notification) => notification.id) : ids ?? [];
      const notifications = state.notifications.map((notification) =>
        targetIds.includes(notification.id) && !notification.readAt
          ? { ...notification, readAt: nowIso }
          : notification
      );
      return {
        notifications,
        notificationsUnread: notifications.filter((notification) => !notification.readAt).length
      };
    });
  },
  updateNotificationPreferences: async (updates) => {
    const currentUser = get().user;
    if (!currentUser) {
      return { success: false, error: 'Usuario no autenticado.' };
    }
    const result = await authService.updateNotificationPreferences(updates);
    if (!result.success) {
      set({ lastError: result.error });
      return { success: false, error: result.error };
    }
    set((state) => {
      const currentUser = state.user;
      const nextUser = currentUser
        ? { ...currentUser, notificationPreferences: result.preferences }
        : currentUser;
      return {
        user: nextUser,
        notificationPreferences: result.preferences,
        lastError: undefined
      };
    });
    return { success: true };
  },
  loadSessionTypes: async (includeArchived = false) => {
    set({ sessionTypesLoading: true });
    const result = await authService.getSessionTypes(includeArchived);
    if (!result.success) {
      set({ sessionTypesLoading: false, lastError: result.error });
      return;
    }
    set({
      sessionTypes: sortSessionTypes(result.types),
      sessionTypesLoading: false,
      sessionTypesIncludeArchived: includeArchived,
      lastError: undefined
    });
  },
  createSessionTypeEntry: async (name, description) => {
    const result = await authService.createSessionType({ name, description });
    if (!result.success) {
      set({ lastError: result.error });
      return { success: false, error: result.error };
    }
    await get().loadSessionTypes(get().sessionTypesIncludeArchived);
    return { success: true };
  },
  updateSessionTypeEntryDetails: async (sessionTypeId, payload) => {
    const result = await authService.updateSessionType(sessionTypeId, payload);
    if (!result.success) {
      set({ lastError: result.error });
      return { success: false, error: result.error };
    }
    set((state) => {
      const nextTypes = sortSessionTypes(
        state.sessionTypes.map((entry) => (entry.id === sessionTypeId ? result.sessionType : entry))
      );
      return {
        sessionTypes: state.sessionTypesIncludeArchived
          ? nextTypes
          : nextTypes.filter((entry) => !entry.archived),
        lastError: undefined
      };
    });
    return { success: true };
  },
  archiveSessionTypeEntry: async (sessionTypeId) => {
    const result = await authService.archiveSessionType(sessionTypeId);
    if (!result.success) {
      set({ lastError: result.error });
      return { success: false, error: result.error };
    }
    set((state) => {
      const nextTypes = sortSessionTypes(
        state.sessionTypes.map((entry) => (entry.id === sessionTypeId ? result.sessionType : entry))
      );
      return {
        sessionTypes: state.sessionTypesIncludeArchived
          ? nextTypes
          : nextTypes.filter((entry) => !entry.archived),
        lastError: undefined
      };
    });
    return { success: true };
  },
  restoreSessionTypeEntry: async (sessionTypeId) => {
    const result = await authService.restoreSessionType(sessionTypeId);
    if (!result.success) {
      set({ lastError: result.error });
      return { success: false, error: result.error };
    }
    set((state) => {
      const nextTypes = sortSessionTypes(
        state.sessionTypes.some((entry) => entry.id === sessionTypeId)
          ? state.sessionTypes.map((entry) => (entry.id === sessionTypeId ? result.sessionType : entry))
          : [...state.sessionTypes, result.sessionType]
      );
      return {
        sessionTypes: state.sessionTypesIncludeArchived
          ? nextTypes
          : nextTypes.filter((entry) => !entry.archived),
        lastError: undefined
      };
    });
    return { success: true };
  },
  loadNotificationTemplates: async () => {
    set({ notificationTemplatesLoading: true });
    const result = await authService.getNotificationTemplates();
    if (!result.success) {
      set({ notificationTemplatesLoading: false, lastError: result.error });
      return;
    }
    set({
      notificationTemplates: result.templates,
      notificationTemplatesLoading: false,
      lastError: undefined
    });
  },
  saveNotificationTemplate: async (key, body) => {
    const result = await authService.updateNotificationTemplate(key, body);
    if (!result.success) {
      set({ lastError: result.error });
      return { success: false, error: result.error };
    }
    set((state) => ({
      notificationTemplates: state.notificationTemplates.some((template) => template.key === key)
        ? state.notificationTemplates.map((template) => (template.key === key ? result.template : template))
        : [...state.notificationTemplates, result.template],
      lastError: undefined
    }));
    return { success: true, template: result.template };
  },
  resetNotificationTemplate: async (key) => {
    const result = await authService.resetNotificationTemplate(key);
    if (!result.success) {
      set({ lastError: result.error });
      return { success: false, error: result.error };
    }
    set((state) => ({
      notificationTemplates: state.notificationTemplates.some((template) => template.key === key)
        ? state.notificationTemplates.map((template) => (template.key === key ? result.template : template))
        : [...state.notificationTemplates, result.template],
      lastError: undefined
    }));
    return { success: true, template: result.template };
  },
  loadCancellationPolicy: async () => {
    set({ cancellationPolicyLoading: true });
    const result = await authService.getCancellationPolicy();
    if (!result.success) {
      set({ cancellationPolicyLoading: false, lastError: result.error });
      return;
    }
    set({
      cancellationPolicy: result.policy,
      cancellationPolicyLoading: false,
      lastError: undefined
    });
  },
  saveCancellationPolicy: async (settings) => {
    const result = await authService.updateCancellationPolicy(settings);
    if (!result.success) {
      set({ lastError: result.error });
      return { success: false, error: result.error };
    }
    set({
      cancellationPolicy: result.policy,
      lastError: undefined
    });
    return { success: true };
  },
  loadClientTimeline: async (clientId) => {
    set({ clientTimelineLoading: true });
    const result = await authService.getClientTimeline(clientId);
    if (!result.success) {
      set({ clientTimelineLoading: false, lastError: result.error });
      return;
    }
    set({
      clientTimeline: result.events,
      clientTimelineLoading: false,
      clientTimelineFor: clientId,
      lastError: undefined
    });
  },
  loadSessionTimeline: async (sessionId) => {
    set({ sessionTimelineLoading: true });
    const result = await authService.getSessionTimeline(sessionId);
    if (!result.success) {
      set({ sessionTimelineLoading: false, lastError: result.error });
      return;
    }
    set({
      sessionTimeline: result.events,
      sessionTimelineLoading: false,
      sessionTimelineFor: sessionId,
      lastError: undefined
    });
  },
  addSessionNote: async (sessionId, note) => {
    const result = await authService.addSessionNote(sessionId, note);
    if (!result.success) {
      set({ lastError: result.error });
      return { success: false, error: result.error };
    }
    set((state) => {
      const nextSessionTimeline =
        state.sessionTimelineFor === sessionId ? [result.event, ...state.sessionTimeline] : state.sessionTimeline;
      const nextClientTimeline =
        state.clientTimelineFor && result.event.clientId === state.clientTimelineFor
          ? [result.event, ...state.clientTimeline]
          : state.clientTimeline;
      return {
        sessionTimeline: nextSessionTimeline,
        clientTimeline: nextClientTimeline,
        lastError: undefined
      };
    });
    return { success: true };
  },
  confirmSession: async (sessionId) => {
    const result = await authService.confirmSession(sessionId);
    if (!result.success) {
      set({ lastError: result.error });
      return result;
    }
    const { session } = result;
    set((state) => {
      const filters = state.sessionFilters;
      const base = state.sessions.filter((item) => item.id !== session.id);
      const include = !hasActiveFilters(filters) || sessionMatchesFilters(session, filters);
      return {
        sessions: include ? sortSessions([...base, session]) : base,
        lastError: undefined
      };
    });
    return result;
  },
  confirmSessionAttendance: async (sessionId) => {
    const result = await authService.confirmSessionAttendance(sessionId);
    if (!result.success) {
      set({ lastError: result.error });
      return result;
    }
    const { session } = result;
    set((state) => {
      const filters = state.sessionFilters;
      const base = state.sessions.filter((item) => item.id !== session.id);
      const include = !hasActiveFilters(filters) || sessionMatchesFilters(session, filters);
      return {
        sessions: include ? sortSessions([...base, session]) : base,
        lastError: undefined
      };
    });
    return result;
  },
  loadGalleries: async (filters) => {
    const currentFilters = get().galleryFilters;
    const mergedFilters = { ...currentFilters, ...(filters ?? {}) };
    set({ galleriesLoading: true });
    const result = await authService.getGalleries(mergedFilters);
    if (!result.success) {
      set({ galleriesLoading: false, lastError: result.error });
      return;
    }
    const sorted = sortGalleries(result.galleries);
    const selected = get().selectedGallery;
    const selectedUpdated = selected ? sorted.find((gallery) => gallery.id === selected.id) ?? selected : undefined;
    set({
      galleries: sorted,
      galleriesLoading: false,
      galleryFilters: mergedFilters,
      galleryTotals: result.totals ?? computeGalleryTotals(sorted),
      selectedGallery: selectedUpdated,
      lastError: undefined
    });
  },
  setGalleryFilters: (filters) =>
    set((state) => ({
      galleryFilters: { ...state.galleryFilters, ...filters }
    })),
  setGalleryGrouping: (grouping) => set({ galleryGrouping: grouping }),
  createGalleryEntry: async (payload) => {
    const result = await authService.createGallery(payload);
    if (!result.success) {
      set({ lastError: result.error });
      return { success: false, error: result.error };
    }
    set((state) => {
      const base = state.galleries.filter((gallery) => gallery.id !== result.gallery.id);
      const galleries = sortGalleries([result.gallery, ...base]);
      return {
        galleries,
        galleryTotals: computeGalleryTotals(galleries),
        lastError: undefined,
        selectedGallery: state.selectedGallery?.id === result.gallery.id ? result.gallery : state.selectedGallery
      };
    });
    return { success: true, gallery: result.gallery };
  },
  updateGalleryEntry: async (galleryId, updates) => {
    const result = await authService.updateGallery(galleryId, updates);
    if (!result.success) {
      set({ lastError: result.error });
      return { success: false, error: result.error };
    }
    set((state) => {
      const galleries = sortGalleries(
        state.galleries.map((gallery) => (gallery.id === galleryId ? result.gallery : gallery))
      );
      return {
        galleries,
        galleryTotals: computeGalleryTotals(galleries),
        lastError: undefined,
        selectedGallery: state.selectedGallery?.id === galleryId ? result.gallery : state.selectedGallery
      };
    });
    return { success: true, gallery: result.gallery };
  },
  uploadGalleryAssets: async (galleryId, assets, onProgress) => {
    set((state) => ({
      galleryUploadStates: {
        ...state.galleryUploadStates,
        [galleryId]: { progress: 0, uploading: true }
      }
    }));
    const result = await authService.uploadGalleryPhotos(galleryId, assets, (progress) => {
      set((state) => ({
        galleryUploadStates: {
          ...state.galleryUploadStates,
          [galleryId]: { progress, uploading: true }
        }
      }));
      if (onProgress) {
        onProgress(progress);
      }
    });
    if (!result.success) {
      set((state) => ({
        galleryUploadStates: {
          ...state.galleryUploadStates,
          [galleryId]: { progress: 0, uploading: false, error: result.error }
        },
        lastError: result.error
      }));
      return { success: false, error: result.error };
    }
    set((state) => {
      const galleries = sortGalleries(
        state.galleries.map((gallery) => (gallery.id === galleryId ? result.gallery : gallery))
      );
      return {
        galleries,
        galleryTotals: computeGalleryTotals(galleries),
        galleryUploadStates: {
          ...state.galleryUploadStates,
          [galleryId]: { progress: 1, uploading: false }
        },
        lastError: undefined,
        selectedGallery: state.selectedGallery?.id === galleryId ? result.gallery : state.selectedGallery
      };
    });
    if (onProgress) {
      onProgress(1);
    }
    return { success: true, gallery: result.gallery };
  },
  updateGalleryStatus: async (galleryId, status) => {
    const result = await authService.updateGalleryStatus(galleryId, status);
    if (!result.success) {
      set({ lastError: result.error });
      return { success: false, error: result.error };
    }
    set((state) => {
      const galleries = sortGalleries(
        state.galleries.map((gallery) => (gallery.id === galleryId ? result.gallery : gallery))
      );
      return {
        galleries,
        galleryTotals: computeGalleryTotals(galleries),
        lastError: undefined,
        selectedGallery: state.selectedGallery?.id === galleryId ? result.gallery : state.selectedGallery
      };
    });
    return {
      success: true,
      gallery: result.gallery,
      notificationSent: result.notificationSent,
      notificationError: result.notificationError
    };
  },
  confirmGalleryDelivery: async (galleryId) => {
    const result = await authService.confirmGalleryDelivery(galleryId);
    if (!result.success) {
      set({ lastError: result.error });
      return { success: false, error: result.error };
    }
    set((state) => {
      const galleries = sortGalleries(
        state.galleries.map((gallery) => (gallery.id === galleryId ? result.gallery : gallery))
      );
      return {
        galleries,
        galleryTotals: computeGalleryTotals(galleries),
        lastError: undefined,
        selectedGallery: state.selectedGallery?.id === galleryId ? result.gallery : state.selectedGallery
      };
    });
    return {
      success: true,
      gallery: result.gallery,
      notificationSent: result.notificationSent,
      notificationError: result.notificationError
    };
  },
  fetchGallery: async (galleryId) => {
    const result = await authService.getGallery(galleryId);
    if (!result.success) {
      set({ lastError: result.error });
      return { success: false, error: result.error };
    }
    set((state) => {
      const exists = state.galleries.some((gallery) => gallery.id === galleryId);
      const galleries = exists
        ? sortGalleries(state.galleries.map((gallery) => (gallery.id === galleryId ? result.gallery : gallery)))
        : sortGalleries([...state.galleries, result.gallery]);
      return {
        galleries,
        galleryTotals: computeGalleryTotals(galleries),
        selectedGallery: result.gallery,
        lastError: undefined
      };
    });
    return { success: true, gallery: result.gallery };
  },
  setSelectedGallery: (gallery) => set({ selectedGallery: gallery ?? undefined }),
  clearGalleryUploadState: (galleryId) => {
    const currentStates = get().galleryUploadStates;
    if (!currentStates[galleryId]) {
      return;
    }
    const nextStates = { ...currentStates };
    delete nextStates[galleryId];
    set({ galleryUploadStates: nextStates });
  },
  refreshAuditLog: async () => {
    const auditLog = await authService.getAuditLog();
    set({ auditLog });
  },
  hasPermission: (permission) => {
    const currentUser = get().user;
    return authService.hasPermission(currentUser?.role, permission);
  },
  recordAccessDenied: async (action, message, metadata) => {
    await authService.recordAccessDenied(action, message, metadata);
    const auditLog = await authService.getAuditLog();
    set({ auditLog });
  },
  clearError: () => set({ lastError: undefined })
}));
