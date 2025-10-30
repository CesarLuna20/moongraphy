import { secureStorage, STORAGE_KEYS } from "../storage/secureStorage";

export type UserRole = "photographer-admin" | "photographer" | "client";
export type UserStatus = "active" | "inactive";

export type Permission = "panel:photographer" | "panel:client" | "accounts:create" | "actions:critical";

export type ServiceSummary = {
  id: string;
  title: string;
  status: "pending" | "active" | "completed";
  createdAt: string;
  notes?: string;
};

export type AvailabilitySlot = {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type SessionStatus = "scheduled" | "confirmed" | "client-confirmed" | "completed" | "cancelled";

export type SessionParticipant = {
  id: string;
  name: string;
  email: string;
};

export type Session = {
  id: string;
  photographerId: string;
  clientId: string;
  type: string;
  sessionTypeId?: string;
  location: string;
  notes?: string;
  start: string;
  end: string;
  status: SessionStatus;
  cancellationReason?: string;
  cancelledAt?: string;
  photographerConfirmedAt?: string;
  clientConfirmedAt?: string;
  reminder48Sent?: boolean;
  reminder24Sent?: boolean;
  policySnapshot?: SessionPolicySnapshot;
  createdAt: string;
  updatedAt: string;
  photographer?: SessionParticipant;
  client?: SessionParticipant;
};

export type NotificationPreferences = {
  pushEnabled: boolean;
  inAppEnabled: boolean;
  confirmation: boolean;
  reminder48h: boolean;
  reminder24h: boolean;
  changes: boolean;
};

export type UserNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  sessionId?: string;
  channels: string[];
  metadata?: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
};

export type HistoryEntry = {
  timestamp: string;
  type: string;
  summary: string;
};

export type GalleryStatus = "pending" | "review" | "delivered" | "received";

export type GalleryPhoto = {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: string;
};

export type GallerySessionInfo = {
  id: string;
  photographerId: string;
  clientId: string;
  type: string;
  location: string;
  start: string;
  end: string;
  status: SessionStatus;
};

export type GalleryPerson = {
  id: string;
  name: string;
  email: string;
};

export type Gallery = {
  id: string;
  sessionId: string;
  photographerId: string;
  clientId: string;
  name: string;
  description?: string;
  status: GalleryStatus;
  statusLabel: string;
  photos: GalleryPhoto[];
  photoCount: number;
  deliveredAt?: string;
  receivedAt?: string;
  createdAt: string;
  updatedAt: string;
  history: HistoryEntry[];
  session?: GallerySessionInfo;
  photographer?: GalleryPerson;
  client?: GalleryPerson;
};

export type GalleryTotals = {
  total: number;
} & Record<GalleryStatus, number>;

export type GalleryFilters = {
  status?: GalleryStatus;
  clientId?: string;
  sessionId?: string;
  photographerId?: string;
};

export type UploadableGalleryAsset = {
  uri: string;
  name: string;
  type: string;
  size?: number;
};

export type SessionPolicySnapshot = {
  version: number;
  minHoursCancel: number;
  minHoursReschedule: number;
  toleranceMinutes: number;
};

export type TimelineEvent = {
  id: string;
  type: string;
  sessionId?: string;
  clientId?: string;
  photographerId?: string;
  galleryId?: string;
  actorId?: string;
  actorEmail?: string;
  actorName?: string;
  title: string;
  description?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
  session?: Session;
  client?: PublicUser;
  photographer?: GalleryPerson;
  gallery?: Gallery;
};

export type SessionType = {
  id: string;
  name: string;
  description?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NotificationTemplate = {
  key: string;
  name: string;
  description?: string;
  body: string;
  defaultBody: string;
  placeholders: string[];
  updatedAt: string | null;
};

export type CancellationPolicy = {
  version: number;
  settings: SessionPolicySnapshot;
  createdAt: string;
  createdBy?: string;
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  specialty?: string;
  location?: string;
  portfolioUrl?: string;
  avatarUrl?: string;
  bio?: string;
  phone?: string;
  ownerId?: string;
  lastLoginAt?: string;
  forcePasswordReset?: boolean;
  services: ServiceSummary[];
  availability: AvailabilitySlot[];
  notificationPreferences: NotificationPreferences;
  createdAt: string;
};

export type AuditEvent = {
  id: string;
  actorId?: string;
  actorEmail?: string;
  action: string;
  status: "success" | "denied" | "error";
  message: string;
  targetId?: string;
  targetEmail?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type CreateUserPayload = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  specialty?: string;
  location?: string;
  portfolioUrl?: string;
  phone?: string;
  bio?: string;
};

export type CreateClientPayload = {
  name: string;
  email: string;
  phone: string;
  bio?: string;
};

export type UpdateClientPayload = {
  name?: string;
  email?: string;
  phone?: string;
  bio?: string;
};

export type UpdateProfilePayload = {
  name?: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
  phone?: string;
  specialty?: string;
  location?: string;
  portfolioUrl?: string;
};

export type CreateSessionPayload = {
  clientId: string;
  type: string;
  sessionTypeId?: string;
  location: string;
  start: string;
  end: string;
  notes?: string;
};

export type UpdateSessionPayload = {
  type?: string;
  sessionTypeId?: string;
  location?: string;
  start?: string;
  end?: string;
  notes?: string;
};

export type SessionFilters = {
  from?: string;
  to?: string;
  clientId?: string;
  type?: string;
  status?: SessionStatus;
  photographerId?: string;
};

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  "photographer-admin": ["panel:photographer", "panel:client", "accounts:create", "actions:critical"],
  photographer: ["panel:photographer"],
  client: ["panel:client"]
};

const getPermissionsForRole = (role: UserRole): Permission[] => ROLE_PERMISSIONS[role] ?? [];

const hasPermissionByRole = (role: UserRole | undefined, permission: Permission) =>
  !!role && getPermissionsForRole(role as UserRole).includes(permission);

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
};

type ApiSuccess<T> = { success: true } & T;
type ApiError = { success: false; error?: string; message?: string };

const getStoredToken = () => secureStorage.getString(STORAGE_KEYS.AUTH_TOKEN);

const persistSession = (token: string, user: PublicUser) => {
  secureStorage.setString(STORAGE_KEYS.AUTH_TOKEN, token);
  secureStorage.setString(STORAGE_KEYS.AUTH_SESSION, token);
  secureStorage.setJson(STORAGE_KEYS.AUTH_USER, user);
};

const clearSession = () => {
  secureStorage.remove(STORAGE_KEYS.AUTH_TOKEN);
  secureStorage.remove(STORAGE_KEYS.AUTH_USER);
  secureStorage.remove(STORAGE_KEYS.AUTH_SESSION);
};

const buildQueryString = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && String(value).length > 0) {
      search.append(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : "";
};

const request = async <T = unknown>(path: string, options: RequestOptions = {}): Promise<ApiSuccess<T> | ApiError> => {
  const { method = "GET", body, auth = false, headers: extraHeaders } = options;
  const headers: Record<string, string> = {};
  const token = getStoredToken();
  if (auth) {
    if (!token) {
      return { success: false, error: "Sesion expirada." };
    }
    headers.Authorization = `Bearer ${token}`;
  }
  if (extraHeaders) {
    Object.assign(headers, extraHeaders);
  }

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  let payload: BodyInit | undefined;

  if (isFormData) {
    payload = body as FormData;
  } else if (body !== undefined) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
    payload = JSON.stringify(body);
  }

  if (!headers["Content-Type"] && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: payload
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok || data.success === false) {
      return {
        success: false,
        error:
          (typeof data.error === "string" && data.error.trim().length > 0
            ? data.error
            : undefined) ?? (response.ok ? "Operacion no completada." : response.statusText),
        message: typeof data.message === "string" ? data.message : undefined
      };
    }

    return (data as unknown) as ApiSuccess<T>;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo conectar con el servidor."
    };
  }
};

const authService = {
  async ensureSeedData() {
    await request("/health");
  },

  async login(
    email: string,
    password: string
  ): Promise<{ success: true; token: string; user: PublicUser } | { success: false; error?: string }> {
    const result = await request<{ token: string; user: PublicUser }>("/auth/login", {
      method: "POST",
      body: { email, password }
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    persistSession(result.token, result.user);
    return { success: true as const, token: result.token, user: result.user };
  },

  async logout() {
    await request("/auth/logout", { method: "POST", auth: true });
    clearSession();
  },

  async getStoredSession() {
    const token = getStoredToken();
    if (!token) {
      return null;
    }
    const cached = secureStorage.getJson<PublicUser>(STORAGE_KEYS.AUTH_USER);
    const session = await request<{ user: PublicUser }>("/auth/session", { auth: true });
    if (!session.success) {
      clearSession();
      return null;
    }
    persistSession(token, session.user);
    return { token, user: session.user ?? cached ?? null };
  },

  async getAuditLog() {
    const response = await request<{ events: AuditEvent[] }>("/audit", { auth: true });
    if (!response.success) {
      return [];
    }
    return response.events;
  },

  async recordAccessDenied(action: string, message: string, metadata?: Record<string, unknown>) {
    await request("/audit/record", {
      method: "POST",
      auth: true,
      body: { action, message, status: "denied", metadata }
    });
  },

  async createUser(payload: CreateUserPayload) {
    const result = await request<{ user: PublicUser }>("/accounts", {
      method: "POST",
      auth: true,
      body: payload
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true, user: result.user };
  },

  async createManagedClient(payload: CreateClientPayload) {
    const result = await request<{ client: PublicUser; temporaryPassword: string }>("/clients", {
      method: "POST",
      auth: true,
      body: payload
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return {
      success: true,
      client: result.client,
      temporaryPassword: result.temporaryPassword
    };
  },

  async getClients() {
    const result = await request<{ clients: PublicUser[] }>("/clients", { auth: true });
    if (!result.success) {
      return [];
    }
    return result.clients;
  },

  async updateClient(clientId: string, updates: UpdateClientPayload) {
    const result = await request<{ client: PublicUser }>(`/clients/${clientId}`, {
      method: "PATCH",
      auth: true,
      body: updates
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true, client: result.client };
  },

  async disableClient(clientId: string) {
    const result = await request<{ message?: string }>(`/clients/${clientId}/disable`, {
      method: "POST",
      auth: true
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true, message: result.message };
  },

  async updateProfile(updates: UpdateProfilePayload) {
    const result = await request<{ user: PublicUser }>("/profile", {
      method: "PATCH",
      auth: true,
      body: updates
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    const token = getStoredToken();
    if (token) {
      persistSession(token, result.user);
    }
    return { success: true, user: result.user };
  },

  async disableAccount() {
    const result = await request<{ message?: string }>("/users/disable", {
      method: "POST",
      auth: true
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    clearSession();
    return { success: true, message: result.message };
  },

  async requestPasswordReset(email: string) {
    const result = await request<{ message?: string; temporaryPassword?: string }>("/auth/password-reset", {
      method: "POST",
      body: { email }
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return {
      success: true,
      message: result.message,
      temporaryPassword: result.temporaryPassword
    };
  },

  async completePasswordChange(newPassword: string) {
    const result = await request("/auth/complete-password-change", {
      method: "POST",
      auth: true,
      body: { newPassword }
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const };
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: true } | { success: false; error?: string }> {
    const result = await request("/auth/change-password", {
      method: "POST",
      auth: true,
      body: { currentPassword, newPassword }
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const };
  },

  async getSessions(
    filters?: SessionFilters
  ): Promise<{ success: true; sessions: Session[] } | { success: false; error?: string }> {
    const query = buildQueryString({
      from: filters?.from,
      to: filters?.to,
      clientId: filters?.clientId,
      type: filters?.type,
      status: filters?.status,
      photographerId: filters?.photographerId
    });
    const result = await request<{ sessions: Session[] }>(`/sessions${query}`, { auth: true });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true, sessions: result.sessions };
  },

  async createSession(
    payload: CreateSessionPayload
  ): Promise<
    | {
        success: true;
        session: Session;
        notificationSent?: boolean;
        notificationError?: string;
      }
    | { success: false; error?: string }
  > {
    const result = await request<{
      session: Session;
      notificationSent?: boolean;
      notificationError?: string;
    }>("/sessions", {
      method: "POST",
      auth: true,
      body: payload
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return {
      success: true as const,
      session: result.session,
      notificationSent: result.notificationSent,
      notificationError: result.notificationError
    };
  },

  async updateSession(
    sessionId: string,
    updates: UpdateSessionPayload
  ): Promise<
    | {
        success: true;
        session: Session;
        notificationSent?: boolean;
        notificationError?: string;
      }
    | { success: false; error?: string }
  > {
    const result = await request<{
      session: Session;
      notificationSent?: boolean;
      notificationError?: string;
    }>(`/sessions/${sessionId}`, {
      method: "PATCH",
      auth: true,
      body: updates
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return {
      success: true as const,
      session: result.session,
      notificationSent: result.notificationSent,
      notificationError: result.notificationError
    };
  },

  async cancelSession(
    sessionId: string,
    reason?: string
  ): Promise<
    | {
        success: true;
        session: Session;
        notificationSent?: boolean;
        notificationError?: string;
      }
    | { success: false; error?: string }
  > {
    const result = await request<{
      session: Session;
      notificationSent?: boolean;
      notificationError?: string;
    }>(`/sessions/${sessionId}/cancel`, {
      method: "POST",
      auth: true,
      body: { reason }
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return {
      success: true as const,
      session: result.session,
      notificationSent: result.notificationSent,
      notificationError: result.notificationError
    };
  },

  async confirmSession(sessionId: string) {
    const result = await request<{
      session: Session;
      notificationSent?: boolean;
      notificationError?: string;
    }>(`/sessions/${sessionId}/confirm`, {
      method: "POST",
      auth: true
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return {
      success: true as const,
      session: result.session,
      notificationSent: result.notificationSent,
      notificationError: result.notificationError
    };
  },

  async confirmSessionAttendance(sessionId: string) {
    const result = await request<{
      session: Session;
      notificationSent?: boolean;
      notificationError?: string;
    }>(`/sessions/${sessionId}/client-confirm`, {
      method: "POST",
      auth: true
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return {
      success: true as const,
      session: result.session,
      notificationSent: result.notificationSent,
      notificationError: result.notificationError
    };
  },

  async getGalleries(
    filters?: GalleryFilters
  ): Promise<{ success: true; galleries: Gallery[]; totals: GalleryTotals } | { success: false; error?: string }> {
    const query = buildQueryString({
      status: filters?.status,
      clientId: filters?.clientId,
      sessionId: filters?.sessionId,
      photographerId: filters?.photographerId
    });
    const result = await request<{ galleries: Gallery[]; totals: GalleryTotals }>(`/galleries${query}`, {
      auth: true
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const, galleries: result.galleries, totals: result.totals };
  },

  async getGallery(
    galleryId: string
  ): Promise<{ success: true; gallery: Gallery } | { success: false; error?: string }> {
    const result = await request<{ gallery: Gallery }>(`/galleries/${galleryId}`, {
      auth: true
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const, gallery: result.gallery };
  },

  async createGallery(
    payload: { sessionId: string; name: string; description?: string }
  ): Promise<{ success: true; gallery: Gallery } | { success: false; error?: string }> {
    const result = await request<{ gallery: Gallery }>("/galleries", {
      method: "POST",
      auth: true,
      body: payload
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const, gallery: result.gallery };
  },

  async updateGallery(
    galleryId: string,
    updates: { name?: string; description?: string }
  ): Promise<{ success: true; gallery: Gallery } | { success: false; error?: string }> {
    const result = await request<{ gallery: Gallery }>(`/galleries/${galleryId}`, {
      method: "PATCH",
      auth: true,
      body: updates
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const, gallery: result.gallery };
  },

  async updateGalleryStatus(
    galleryId: string,
    status: Exclude<GalleryStatus, "received">
  ): Promise<
    | { success: true; gallery: Gallery; notificationSent?: boolean; notificationError?: string }
    | { success: false; error?: string }
  > {
    const result = await request<{
      gallery: Gallery;
      notificationSent?: boolean;
      notificationError?: string;
    }>(`/galleries/${galleryId}/status`, {
      method: "PATCH",
      auth: true,
      body: { status }
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return {
      success: true as const,
      gallery: result.gallery,
      notificationSent: result.notificationSent,
      notificationError: result.notificationError
    };
  },

  async confirmGalleryDelivery(
    galleryId: string
  ): Promise<
    | { success: true; gallery: Gallery; notificationSent?: boolean; notificationError?: string }
    | { success: false; error?: string }
  > {
    const result = await request<{
      gallery: Gallery;
      notificationSent?: boolean;
      notificationError?: string;
    }>(`/galleries/${galleryId}/confirm`, {
      method: "POST",
      auth: true
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return {
      success: true as const,
      gallery: result.gallery,
      notificationSent: result.notificationSent,
      notificationError: result.notificationError
    };
  },

  async uploadGalleryPhotos(
    galleryId: string,
    assets: UploadableGalleryAsset[],
    onProgress?: (progress: number) => void
  ): Promise<{ success: true; gallery: Gallery } | { success: false; error?: string }> {
    if (!assets || assets.length === 0) {
      return { success: false as const, error: "Selecciona al menos una imagen valida." };
    }
    const token = getStoredToken();
    if (!token) {
      return { success: false as const, error: "Sesion expirada." };
    }
    const formData = new FormData();
    assets.forEach((asset, index) => {
      const fileName = asset.name && asset.name.trim().length > 0 ? asset.name : `foto-${index + 1}.jpg`;
      const type = asset.type && asset.type.trim().length > 0 ? asset.type : "image/jpeg";
      formData.append("files", {
        uri: asset.uri,
        name: fileName,
        type
      } as any);
    });
    return new Promise((resolve) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_URL}/galleries/${galleryId}/photos`);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.timeout = 60000;
        if (onProgress) {
          onProgress(0);
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && event.total > 0) {
              onProgress(Math.min(event.loaded / event.total, 1));
            }
          };
        }
        xhr.onload = () => {
          const text = xhr.responseText ?? "";
          let data: Record<string, unknown> = {};
          try {
            data = text ? JSON.parse(text) : {};
          } catch {
            // ignore parse errors
          }
          if (xhr.status >= 200 && xhr.status < 300 && data.success !== false && data.gallery) {
            if (onProgress) {
              onProgress(1);
            }
            resolve({ success: true as const, gallery: data.gallery as Gallery });
            return;
          }
          const error =
            (typeof data.error === "string" && data.error.trim().length > 0 ? data.error : undefined) ??
            "No se pudieron subir las imagenes.";
          resolve({ success: false as const, error });
        };
        xhr.onerror = () => {
          resolve({ success: false as const, error: "No se pudieron subir las imagenes." });
        };
        xhr.ontimeout = () => {
          resolve({ success: false as const, error: "La subida tardo demasiado, intenta de nuevo." });
        };
        xhr.send(formData);
      } catch (error) {
        resolve({
          success: false as const,
          error: error instanceof Error ? error.message : "No se pudieron subir las imagenes."
        });
      }
    });
  },

  async getNotifications(unreadOnly = false) {
    const query = unreadOnly ? "?unreadOnly=true" : "";
    const result = await request<{ notifications: UserNotification[] }>(`/notifications${query}`, {
      auth: true
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const, notifications: result.notifications };
  },

  async markNotificationsRead(ids: string[] | undefined, readAll = false) {
    const body = readAll ? { readAll: true } : { ids: ids ?? [] };
    const result = await request("/notifications/read", {
      method: "POST",
      auth: true,
      body
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const };
  },

  async updateNotificationPreferences(preferences: Partial<NotificationPreferences>) {
    const result = await request<{ preferences: NotificationPreferences }>("/notifications/preferences", {
      method: "PUT",
      auth: true,
      body: preferences
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const, preferences: result.preferences };
  },

  async getClientTimeline(clientId: string) {
    const result = await request<{ events: TimelineEvent[] }>(`/timeline/clients/${clientId}`, {
      auth: true
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const, events: result.events };
  },

  async getSessionTimeline(sessionId: string) {
    const result = await request<{ events: TimelineEvent[] }>(`/timeline/sessions/${sessionId}`, {
      auth: true
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const, events: result.events };
  },

  async addSessionNote(sessionId: string, note: string) {
    const result = await request<{ event: TimelineEvent }>(`/sessions/${sessionId}/notes`, {
      method: "POST",
      auth: true,
      body: { note }
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const, event: result.event };
  },

  async getSessionTypes(includeArchived = false) {
    const query = includeArchived ? "?includeArchived=true" : "";
    const result = await request<{ types: SessionType[] }>(`/session-types${query}`, {
      auth: true
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const, types: result.types };
  },

  async createSessionType(payload: { name: string; description?: string }) {
    const result = await request<{ sessionType: SessionType }>("/session-types", {
      method: "POST",
      auth: true,
      body: payload
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const, sessionType: result.sessionType };
  },

  async updateSessionType(sessionTypeId: string, payload: { name?: string; description?: string }) {
    const result = await request<{ sessionType: SessionType }>(`/session-types/${sessionTypeId}`, {
      method: "PATCH",
      auth: true,
      body: payload
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const, sessionType: result.sessionType };
  },

  async archiveSessionType(sessionTypeId: string) {
    const result = await request<{ sessionType: SessionType }>(`/session-types/${sessionTypeId}`, {
      method: "DELETE",
      auth: true
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const, sessionType: result.sessionType };
  },

  async restoreSessionType(sessionTypeId: string) {
    const result = await request<{ sessionType: SessionType }>(`/session-types/${sessionTypeId}/restore`, {
      method: "POST",
      auth: true
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const, sessionType: result.sessionType };
  },

  async getNotificationTemplates() {
    const result = await request<{ templates: NotificationTemplate[] }>("/notification-templates", {
      auth: true
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const, templates: result.templates };
  },

  async updateNotificationTemplate(key: string, body: string) {
    const result = await request<{ template: NotificationTemplate }>(`/notification-templates/${key}`, {
      method: "PUT",
      auth: true,
      body: { body }
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const, template: result.template };
  },

  async resetNotificationTemplate(key: string) {
    const result = await request<{ template: NotificationTemplate }>(`/notification-templates/${key}/reset`, {
      method: "POST",
      auth: true
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const, template: result.template };
  },

  async getCancellationPolicy() {
    const result = await request<{ policy: CancellationPolicy }>("/policies/cancellation", {
      auth: true
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const, policy: result.policy };
  },

  async updateCancellationPolicy(settings: {
    minHoursCancel: number;
    minHoursReschedule: number;
    toleranceMinutes: number;
  }) {
    const result = await request<{ policy: CancellationPolicy }>("/policies/cancellation", {
      method: "PUT",
      auth: true,
      body: settings
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const, policy: result.policy };
  },

  async getAvailability(): Promise<
    { success: true; availability: AvailabilitySlot[] } | { success: false; error?: string }
  > {
    const result = await request<{ availability: AvailabilitySlot[] }>("/availability", {
      auth: true
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const, availability: result.availability };
  },

  async updateAvailability(
    slots: AvailabilitySlot[]
  ): Promise<{ success: true; availability: AvailabilitySlot[] } | { success: false; error?: string }> {
    const result = await request<{ availability: AvailabilitySlot[] }>("/availability", {
      method: "PUT",
      auth: true,
      body: { slots }
    });
    if (!result.success) {
      return { success: false as const, error: result.error };
    }
    return { success: true as const, availability: result.availability };
  },

  async getUserHistory(userId: string) {
    const result = await request<{ history: HistoryEntry[] }>(`/users/${userId}/history`, {
      auth: true
    });
    if (!result.success) {
      return [];
    }
    return result.history;
  },

  hasPermission(role: UserRole | undefined, permission: Permission) {
    return hasPermissionByRole(role, permission);
  },

  getRolePermissions(role: UserRole) {
    return getPermissionsForRole(role);
  }
};

export { authService };
