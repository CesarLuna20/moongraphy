import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { v4 as uuid } from "uuid";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_ROOT = path.join(__dirname, "..", "uploads");
const ensureDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};
ensureDirExists(UPLOADS_ROOT);

const {
  PORT = 4000,
  MONGODB_URI = "mongodb://localhost:27017/moongraphy",
  JWT_SECRET = "moongraphy-secret",
  SMTP_HOST,
  SMTP_PORT = "465",
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM
} = process.env;

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(UPLOADS_ROOT));

mongoose
  .connect(MONGODB_URI, { autoIndex: true })
  .then(() => console.log("[server] MongoDB conectado"))
  .catch((err) => {
    console.error("[server] Error conectando a MongoDB", err);
    process.exit(1);
  });

const HistoryEntrySchema = new mongoose.Schema(
  {
    timestamp: { type: Date, required: true },
    type: { type: String, required: true },
    summary: { type: String, required: true }
  },
  { _id: false }
);

const ServiceSummarySchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    status: { type: String, enum: ["pending", "active", "completed"], default: "pending" },
    createdAt: { type: Date, default: Date.now },
    notes: { type: String }
  },
  { _id: false }
);

const AvailabilitySlotSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true }
  },
  { _id: false }
);

const NotificationPreferencesSchema = new mongoose.Schema(
  {
    pushEnabled: { type: Boolean, default: true },
    inAppEnabled: { type: Boolean, default: true },
    confirmation: { type: Boolean, default: true },
    reminder48h: { type: Boolean, default: true },
    reminder24h: { type: Boolean, default: true },
    changes: { type: Boolean, default: true }
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["photographer-admin", "photographer", "client"],
      required: true
    },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    specialty: { type: String },
    location: { type: String },
    portfolioUrl: { type: String },
    avatarUrl: { type: String },
    bio: { type: String },
    phone: { type: String },
    ownerId: { type: String },
    lastLoginAt: { type: Date },
    forcePasswordReset: { type: Boolean, default: false },
    history: { type: [HistoryEntrySchema], default: [] },
    services: { type: [ServiceSummarySchema], default: [] },
    availability: { type: [AvailabilitySlotSchema], default: [] },
    notificationPreferences: { type: NotificationPreferencesSchema, default: () => ({}) },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

const AuditSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    actorId: { type: String },
    actorEmail: { type: String },
    action: { type: String, required: true },
    status: { type: String, enum: ["success", "denied", "error"], required: true },
    message: { type: String, required: true },
    targetId: { type: String },
    targetEmail: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

const NotificationSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    userId: { type: String, required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    sessionId: { type: String },
    channels: { type: [String], default: ["in-app"] },
    readAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

NotificationSchema.index({ userId: 1, createdAt: -1 });

const NotificationModel = mongoose.model("Notification", NotificationSchema);

const PhotoSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storagePath: { type: String, required: true },
    url: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const GallerySchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    sessionId: { type: String, required: true },
    photographerId: { type: String, required: true },
    clientId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ["pending", "review", "delivered", "received"],
      default: "pending"
    },
    photos: { type: [PhotoSchema], default: [] },
    deliveredAt: { type: Date },
    receivedAt: { type: Date },
    history: { type: [HistoryEntrySchema], default: [] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

GallerySchema.index({ photographerId: 1, createdAt: -1 });
GallerySchema.index({ clientId: 1, createdAt: -1 });
GallerySchema.index({ sessionId: 1 });
GallerySchema.index({ status: 1 });

const GalleryModel = mongoose.model("Gallery", GallerySchema);

const SessionPolicySnapshotSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    minHoursCancel: { type: Number, default: 24 },
    minHoursReschedule: { type: Number, default: 24 },
    toleranceMinutes: { type: Number, default: 0 }
  },
  { _id: false }
);

const SessionSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    photographerId: { type: String, required: true },
    clientId: { type: String, required: true },
    type: { type: String, required: true },
    sessionTypeId: { type: String },
    location: { type: String, required: true },
    notes: { type: String },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    status: {
      type: String,
      enum: ["scheduled", "confirmed", "client-confirmed", "completed", "cancelled"],
      default: "scheduled"
    },
    cancellationReason: { type: String },
    cancelledAt: { type: Date },
    photographerConfirmedAt: { type: Date },
    clientConfirmedAt: { type: Date },
    reminder48Sent: { type: Boolean, default: false },
    reminder24Sent: { type: Boolean, default: false },
    policySnapshot: { type: SessionPolicySnapshotSchema },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

SessionSchema.index({ photographerId: 1, start: 1 });
SessionSchema.index({ clientId: 1, start: 1 });

const TimelineEventSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    type: { type: String, required: true },
    sessionId: { type: String },
    clientId: { type: String },
    photographerId: { type: String },
    galleryId: { type: String },
    actorId: { type: String },
    actorEmail: { type: String },
    actorName: { type: String },
    title: { type: String, required: true },
    description: { type: String },
    payload: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

TimelineEventSchema.index({ clientId: 1, createdAt: -1 });
TimelineEventSchema.index({ sessionId: 1, createdAt: -1 });
TimelineEventSchema.index({ photographerId: 1, createdAt: -1 });

const PolicySchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    type: { type: String, required: true },
    version: { type: Number, required: true },
    settings: { type: mongoose.Schema.Types.Mixed, required: true },
    createdBy: { type: String },
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

const SessionTypeSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    normalizedName: { type: String, required: true },
    description: { type: String },
    archived: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);
SessionTypeSchema.index({ normalizedName: 1 }, { unique: true });

const NotificationTemplateSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    defaultBody: { type: String, required: true },
    body: { type: String, required: true },
    placeholders: { type: [String], default: [] },
    updatedAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

const UserModel = mongoose.model("User", UserSchema);
const AuditModel = mongoose.model("Audit", AuditSchema);
const SessionModel = mongoose.model("Session", SessionSchema);
const TimelineEventModel = mongoose.model("TimelineEvent", TimelineEventSchema);
const PolicyModel = mongoose.model("Policy", PolicySchema);
const SessionTypeModel = mongoose.model("SessionType", SessionTypeSchema);
const NotificationTemplateModel = mongoose.model("NotificationTemplate", NotificationTemplateSchema);

const ACCEPTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
const ACCEPTED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);
const MAX_UPLOAD_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
const MAX_UPLOAD_FILES_PER_BATCH = 50;

const galleryStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const galleryId = req.params?.id;
    if (!galleryId) {
      cb(new Error("Galeria no especificada."));
      return;
    }
    const galleryDir = path.join(UPLOADS_ROOT, galleryId);
    ensureDirExists(galleryDir);
    cb(null, galleryDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname ?? "").toLowerCase();
    const safeExt = ACCEPTED_IMAGE_EXTENSIONS.has(ext) ? ext : ".jpg";
    cb(null, `${uuid()}${safeExt}`);
  }
});

const galleryUpload = multer({
  storage: galleryStorage,
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype ?? "").toLowerCase();
    const ext = path.extname(file.originalname ?? "").toLowerCase();
    if (!ACCEPTED_IMAGE_MIME_TYPES.has(mime) || !ACCEPTED_IMAGE_EXTENSIONS.has(ext)) {
      const error = new Error("Formato de archivo no soportado. Usa JPG o PNG.");
      error.code = "INVALID_FILE_TYPE";
      cb(error);
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: MAX_UPLOAD_FILE_SIZE_BYTES }
});

const ROLE_PERMISSIONS = {
  "photographer-admin": ["panel:photographer", "panel:client", "accounts:create", "actions:critical"],
  photographer: ["panel:photographer"],
  client: ["panel:client"]
};

const isPhotographerRole = (role) => role === "photographer" || role === "photographer-admin";

const getRolePermissions = (role) => ROLE_PERMISSIONS[role] ?? [];

const userHasPermission = (user, permission) =>
  !!user && getRolePermissions(user.role).includes(permission);

const isEmailValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

let mailer = null;

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  const smtpPort = Number(SMTP_PORT ?? 465);
  mailer = nodemailer.createTransport({
    host: SMTP_HOST,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  mailer
    .verify()
    .then(() => console.log("[server] SMTP listo para enviar correos"))
    .catch((error) => {
      console.error("[server] No se pudo verificar la configuracion SMTP", error);
      mailer = null;
    });
} else {
  console.warn("[server] SMTP no configurado. Los correos de recuperacion no se enviaran.");
}

const sendEmail = async ({ to, subject, text, html }) => {
  if (!mailer || !SMTP_FROM) {
    return { success: false, error: "SMTP no configurado." };
  }
  try {
    await mailer.sendMail({ from: SMTP_FROM, to, subject, text, html });
    return { success: true };
  } catch (error) {
    console.error("[server] Error enviando correo", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido al enviar correo"
    };
  }
};

const addHistoryEntry = (user, type, summary) => {
  const entry = { timestamp: new Date(), type, summary };
  user.history = [entry, ...(user.history ?? [])].slice(0, 50);
  user.updatedAt = entry.timestamp;
  return entry;
};

const DEFAULT_NOTIFICATION_PREFERENCES = {
  pushEnabled: true,
  inAppEnabled: true,
  confirmation: true,
  reminder48h: true,
  reminder24h: true,
  changes: true
};

const mergeNotificationPreferences = (prefs) => ({
  ...DEFAULT_NOTIFICATION_PREFERENCES,
  ...(prefs ?? {})
});

const toPublicNotification = (notification) => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  sessionId: notification.sessionId,
  channels: notification.channels,
  metadata: notification.metadata ?? {},
  readAt: notification.readAt,
  createdAt: notification.createdAt
});

const toPublicUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  status: user.status,
  specialty: user.specialty,
  location: user.location,
  portfolioUrl: user.portfolioUrl,
  avatarUrl: user.avatarUrl,
  bio: user.bio,
  phone: user.phone,
  ownerId: user.ownerId,
  lastLoginAt: user.lastLoginAt,
  forcePasswordReset: user.forcePasswordReset,
  services: user.services ?? [],
  availability: user.availability ?? [],
  notificationPreferences: mergeNotificationPreferences(user.notificationPreferences),
  createdAt: user.createdAt
});

const toPublicSession = (session, extras = {}) => ({
  id: session.id,
  photographerId: session.photographerId,
  clientId: session.clientId,
  type: session.type,
  sessionTypeId: session.sessionTypeId,
  location: session.location,
  notes: session.notes,
  start: session.start,
  end: session.end,
  status: session.status,
  cancellationReason: session.cancellationReason,
  cancelledAt: session.cancelledAt,
  photographerConfirmedAt: session.photographerConfirmedAt,
  clientConfirmedAt: session.clientConfirmedAt,
  reminder48Sent: session.reminder48Sent,
  reminder24Sent: session.reminder24Sent,
  policySnapshot: session.policySnapshot,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
  ...extras
});

const toPublicSessionSummary = (session) => ({
  id: session.id,
  photographerId: session.photographerId,
  clientId: session.clientId,
  type: session.type,
  sessionTypeId: session.sessionTypeId,
  location: session.location,
  start: session.start,
  end: session.end,
  status: session.status
});

const toPublicPhoto = (photo) => ({
  id: photo.id,
  filename: photo.filename,
  originalName: photo.originalName,
  mimeType: photo.mimeType,
  size: photo.size,
  url: photo.url,
  uploadedAt: photo.uploadedAt
});

const galleryStatusLabels = {
  pending: "Pendiente",
  review: "En revision",
  delivered: "Entregado",
  received: "Recibido"
};

const GALLERY_STATUS_VALUES = Object.keys(galleryStatusLabels);
const GALLERY_STATUS_SET = new Set(GALLERY_STATUS_VALUES);

const TIMELINE_EVENT_TYPES = {
  SESSION_CREATED: "session-created",
  SESSION_RESCHEDULED: "session-rescheduled",
  SESSION_CANCELLED: "session-cancelled",
  SESSION_CONFIRMED: "session-confirmed",
  SESSION_CLIENT_CONFIRMED: "session-client-confirmed",
  SESSION_UPDATED: "session-updated",
  SESSION_NOTE: "session-note",
  GALLERY_CREATED: "gallery-created",
  GALLERY_PHOTOS_UPLOADED: "gallery-photos-uploaded",
  GALLERY_DELIVERED: "gallery-delivered",
  GALLERY_REVIEW: "gallery-review",
  GALLERY_PENDING: "gallery-pending",
  GALLERY_CONFIRMED: "gallery-confirmed"
};

const NOTIFICATION_TEMPLATE_KEYS = {
  REMINDER_48H: "session-reminder-48h",
  REMINDER_24H: "session-reminder-24h",
  CONFIRMATION: "session-confirmation",
  CHANGE_CANCEL: "session-change"
};

const ALLOWED_TEMPLATE_PLACEHOLDERS = [
  "{{photographerName}}",
  "{{clientName}}",
  "{{sessionDate}}",
  "{{sessionLocation}}",
  "{{sessionType}}",
  "{{sessionNotes}}"
];

const TEMPLATE_PLACEHOLDER_MAP = {
  "{{photographerName}}": "photographerName",
  "{{clientName}}": "clientName",
  "{{sessionDate}}": "sessionDate",
  "{{sessionLocation}}": "sessionLocation",
  "{{sessionType}}": "sessionType",
  "{{sessionNotes}}": "sessionNotes"
};

const DEFAULT_NOTIFICATION_TEMPLATES = [
  {
    key: NOTIFICATION_TEMPLATE_KEYS.REMINDER_48H,
    name: "Recordatorio 48h",
    description: "Mensaje para recordatorio de sesion 48 horas antes.",
    body:
      "Hola {{clientName}},\n\nTe recordamos tu sesion de {{sessionType}} con {{photographerName}} el {{sessionDate}} en {{sessionLocation}}.\n\nSi necesitas reprogramar, contacta cuanto antes.",
    placeholders: ALLOWED_TEMPLATE_PLACEHOLDERS
  },
  {
    key: NOTIFICATION_TEMPLATE_KEYS.REMINDER_24H,
    name: "Recordatorio 24h",
    description: "Mensaje para recordatorio de sesion 24 horas antes.",
    body:
      "Hola {{clientName}},\n\nManana es tu sesion de {{sessionType}} con {{photographerName}} el {{sessionDate}} en {{sessionLocation}}.\n\nConfirma tu asistencia o avisa si surge algun cambio.",
    placeholders: ALLOWED_TEMPLATE_PLACEHOLDERS
  },
  {
    key: NOTIFICATION_TEMPLATE_KEYS.CONFIRMATION,
    name: "Confirmacion de sesion",
    description: "Mensaje cuando se confirma la sesion.",
    body:
      "Hola {{clientName}},\n\nTu sesion de {{sessionType}} ha sido confirmada para el {{sessionDate}} en {{sessionLocation}}.\n\nNotas: {{sessionNotes}}",
    placeholders: ALLOWED_TEMPLATE_PLACEHOLDERS
  },
  {
    key: NOTIFICATION_TEMPLATE_KEYS.CHANGE_CANCEL,
    name: "Cambios o cancelaciones",
    description: "Mensaje general para cambios o cancelaciones.",
    body:
      "Hola {{clientName}},\n\nHubo cambios en tu sesion de {{sessionType}} programada para el {{sessionDate}} en {{sessionLocation}}.\n\nNotas: {{sessionNotes}}",
    placeholders: ALLOWED_TEMPLATE_PLACEHOLDERS
  }
];

const DEFAULT_CANCELLATION_POLICY = {
  minHoursCancel: 24,
  minHoursReschedule: 24,
  toleranceMinutes: 30
};

const normalizeSessionTypeName = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");

const ensureDefaultNotificationTemplates = async () => {
  for (const template of DEFAULT_NOTIFICATION_TEMPLATES) {
    const existing = await NotificationTemplateModel.findOne({ key: template.key });
    if (!existing) {
      await NotificationTemplateModel.create({
        id: uuid(),
        key: template.key,
        name: template.name,
        description: template.description,
        defaultBody: template.body,
        body: template.body,
        placeholders: template.placeholders,
        updatedAt: new Date()
      });
      continue;
    }
    const shouldUpdateDefaults =
      existing.defaultBody !== template.body ||
      !Array.isArray(existing.placeholders) ||
      existing.placeholders.length !== template.placeholders.length;
    if (shouldUpdateDefaults) {
      existing.defaultBody = template.body;
      existing.placeholders = template.placeholders;
      if (!existing.body || existing.body.trim().length === 0) {
        existing.body = template.body;
      }
      existing.updatedAt = new Date();
      await existing.save();
    }
  }
};

const ensureDefaultCancellationPolicy = async () => {
  const latest = await PolicyModel.findOne({ type: "cancellation" }).sort({ version: -1 });
  if (!latest) {
    await PolicyModel.create({
      id: uuid(),
      type: "cancellation",
      version: 1,
      settings: DEFAULT_CANCELLATION_POLICY,
      createdAt: new Date()
    });
  }
};

const getActiveCancellationPolicy = async () => {
  const policy = await PolicyModel.findOne({ type: "cancellation" }).sort({ version: -1 });
  if (policy) {
    return policy;
  }
  await ensureDefaultCancellationPolicy();
  return PolicyModel.findOne({ type: "cancellation" }).sort({ version: -1 });
};

const buildPolicySnapshot = (policyDoc) => ({
  version: policyDoc.version,
  minHoursCancel: Number(policyDoc.settings?.minHoursCancel ?? DEFAULT_CANCELLATION_POLICY.minHoursCancel),
  minHoursReschedule: Number(
    policyDoc.settings?.minHoursReschedule ?? DEFAULT_CANCELLATION_POLICY.minHoursReschedule
  ),
  toleranceMinutes: Number(policyDoc.settings?.toleranceMinutes ?? DEFAULT_CANCELLATION_POLICY.toleranceMinutes)
});

const formatMinutesDiff = (minutes) => {
  if (minutes < 60) {
    return `${Math.round(minutes)} minutos`;
  }
  const hours = minutes / 60;
  if (hours < 24) {
    return `${hours.toFixed(1)} horas`;
  }
  return `${(hours / 24).toFixed(1)} dias`;
};

const evaluatePolicyWindow = (policySnapshot, sessionStart, type) => {
  const now = new Date();
  const startDate = new Date(sessionStart);
  const diffMinutes = (startDate.getTime() - now.getTime()) / (1000 * 60);
  if (type === "cancel") {
    const limitMinutes = policySnapshot.minHoursCancel * 60 - policySnapshot.toleranceMinutes;
    if (diffMinutes < limitMinutes) {
      return {
        allowed: false,
        message: `La politica de cancelacion requiere al menos ${formatMinutesDiff(
          policySnapshot.minHoursCancel * 60
        )} de anticipacion.`
      };
    }
  } else if (type === "reschedule") {
    const limitMinutes = policySnapshot.minHoursReschedule * 60 - policySnapshot.toleranceMinutes;
    if (diffMinutes < limitMinutes) {
      return {
        allowed: false,
        message: `La politica de reprogramacion requiere al menos ${formatMinutesDiff(
          policySnapshot.minHoursReschedule * 60
        )} de anticipacion.`
      };
    }
  }
  return { allowed: true };
};

const validateTemplatePlaceholders = (body) => {
  const matches = body.match(/\{\{[^}]+\}\}/g) ?? [];
  for (const placeholder of matches) {
    if (!ALLOWED_TEMPLATE_PLACEHOLDERS.includes(placeholder)) {
      return {
        ok: false,
        error: `Placeholder no permitido: ${placeholder}. Usa solo ${ALLOWED_TEMPLATE_PLACEHOLDERS.join(", ")}`
      };
    }
  }
  if (body.trim().length === 0) {
    return { ok: false, error: "El contenido no puede quedar vacio." };
  }
  return { ok: true };
};

const renderNotificationTemplate = async (key, context) => {
  const template =
    (await NotificationTemplateModel.findOne({ key })) ??
    DEFAULT_NOTIFICATION_TEMPLATES.find((item) => item.key === key);
  const body = template?.body ?? context.fallback;
  if (!body) {
    return context.fallback ?? "";
  }
  return body.replace(/\{\{[^}]+\}\}/g, (match) => {
    const mappedKey = TEMPLATE_PLACEHOLDER_MAP[match];
    if (!mappedKey) {
      return match;
    }
    const value = context[mappedKey];
    return value !== undefined && value !== null ? String(value) : match;
  });
};

const toPublicTimelineEvent = (event, extras = {}) => ({
  id: event.id,
  type: event.type,
  sessionId: event.sessionId,
  clientId: event.clientId,
  photographerId: event.photographerId,
  galleryId: event.galleryId,
  actorId: event.actorId,
  actorEmail: event.actorEmail,
  actorName: event.actorName,
  title: event.title,
  description: event.description,
  payload: event.payload,
  createdAt: event.createdAt,
  ...extras
});

const buildTimelineEventsPayload = async (events) => {
  if (!events || events.length === 0) {
    return [];
  }
  const sessionIds = [...new Set(events.map((event) => event.sessionId).filter(Boolean))];
  const clientIds = [...new Set(events.map((event) => event.clientId).filter(Boolean))];
  const photographerIds = [...new Set(events.map((event) => event.photographerId).filter(Boolean))];
  const [sessions, clients, photographers] = await Promise.all([
    sessionIds.length ? SessionModel.find({ id: { $in: sessionIds } }) : [],
    clientIds.length ? UserModel.find({ id: { $in: clientIds } }) : [],
    photographerIds.length ? UserModel.find({ id: { $in: photographerIds } }) : []
  ]);
  const sessionMap = new Map(sessions.map((session) => [session.id, session]));
  const clientMap = new Map(clients.map((client) => [client.id, client]));
  const photographerMap = new Map(photographers.map((photographer) => [photographer.id, photographer]));

  return events.map((event) =>
    toPublicTimelineEvent(event, {
      session: sessionMap.has(event.sessionId) ? toPublicSession(sessionMap.get(event.sessionId)) : undefined,
      client: clientMap.has(event.clientId) ? toPublicUser(clientMap.get(event.clientId)) : undefined,
      photographer: photographerMap.has(event.photographerId)
        ? toCompactUser(photographerMap.get(event.photographerId))
        : undefined
    })
  );
};

const recordTimelineEvent = async (params) => {
  const {
    type,
    session,
    sessionId,
    clientId,
    photographerId,
    galleryId,
    actor,
    title,
    description,
    payload
  } = params;
  return TimelineEventModel.create({
    id: uuid(),
    type,
    sessionId: session?.id ?? sessionId,
    clientId: clientId ?? session?.clientId,
    photographerId: photographerId ?? session?.photographerId,
    galleryId,
    actorId: actor?.id,
    actorEmail: actor?.email,
    actorName: actor?.name,
    title,
    description,
    payload,
    createdAt: new Date()
  });
};

const toPublicSessionType = (entry) => ({
  id: entry.id,
  name: entry.name,
  description: entry.description,
  archived: entry.archived,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt
});

const toPublicGallery = (gallery, extras = {}) => ({
  id: gallery.id,
  sessionId: gallery.sessionId,
  photographerId: gallery.photographerId,
  clientId: gallery.clientId,
  name: gallery.name,
  description: gallery.description,
  status: gallery.status,
  statusLabel: galleryStatusLabels[gallery.status] ?? gallery.status,
  photos: (gallery.photos ?? []).map((photo) => toPublicPhoto(photo)),
  photoCount: gallery.photos?.length ?? 0,
  deliveredAt: gallery.deliveredAt,
  receivedAt: gallery.receivedAt,
  history: (gallery.history ?? []).map((entry) => ({
    timestamp: entry.timestamp,
    type: entry.type,
    summary: entry.summary
  })),
  createdAt: gallery.createdAt,
  updatedAt: gallery.updatedAt,
  ...extras
});

const addGalleryHistoryEntry = (gallery, type, summary) => {
  if (!gallery.history) {
    gallery.history = [];
  }
  gallery.history.push({
    timestamp: new Date(),
    type,
    summary
  });
  if (gallery.history.length > 200) {
    gallery.history = gallery.history.slice(-200);
  }
};

const clientCanAccessGallery = (gallery) => gallery.status === "delivered" || gallery.status === "received";

const toCompactUser = (user) =>
  user
    ? {
        id: user.id,
        name: user.name,
        email: user.email
      }
    : undefined;

const buildGalleryResponseList = async (galleries) => {
  if (!Array.isArray(galleries) || galleries.length === 0) {
    return [];
  }
  const sessionIds = [...new Set(galleries.map((gallery) => gallery.sessionId))];
  const userIds = [
    ...new Set(
      galleries.flatMap((gallery) => [gallery.photographerId, gallery.clientId]).filter((id) => !!id)
    )
  ];
  const [sessions, users] = await Promise.all([
    SessionModel.find({ id: { $in: sessionIds } }),
    userIds.length > 0 ? UserModel.find({ id: { $in: userIds } }) : []
  ]);
  const sessionMap = new Map(sessions.map((session) => [session.id, session]));
  const userMap = new Map(users.map((user) => [user.id, user]));

  return galleries.map((gallery) =>
    toPublicGallery(gallery, {
      session: sessionMap.has(gallery.sessionId)
        ? toPublicSessionSummary(sessionMap.get(gallery.sessionId))
        : undefined,
      photographer: userMap.has(gallery.photographerId)
        ? toCompactUser(userMap.get(gallery.photographerId))
        : undefined,
      client: userMap.has(gallery.clientId) ? toCompactUser(userMap.get(gallery.clientId)) : undefined
    })
  );
};

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const notificationTypeEnabled = (prefs, type) => {
  switch (type) {
    case "session-confirmed":
    case "session-client-confirmed":
    case "session-created":
      return prefs.confirmation;
    case "session-reminder-48h":
      return prefs.reminder48h;
    case "session-reminder-24h":
      return prefs.reminder24h;
    case "session-updated":
    case "session-cancelled":
    case "gallery-delivered":
    case "gallery-received":
      return prefs.changes;
    default:
      return true;
  }
};

const sendUserNotification = async ({ user, userId, type, title, message, sessionId, metadata }) => {
  const targetUser =
    user ??
    (await UserModel.findOne({
      id: userId
    }));
  if (!targetUser) {
    return { delivered: false, reason: "user-not-found" };
  }
  const prefs = mergeNotificationPreferences(targetUser.notificationPreferences);
  if (!notificationTypeEnabled(prefs, type)) {
    return { delivered: false, reason: "type-disabled" };
  }
  const channels = [];
  if (prefs.inAppEnabled) {
    channels.push("in-app");
  }
  if (prefs.pushEnabled) {
    channels.push("push");
  }
  if (channels.length === 0) {
    return { delivered: false, reason: "channels-disabled" };
  }

  const notification = await NotificationModel.create({
    id: uuid(),
    userId: targetUser.id,
    type,
    title,
    message,
    sessionId,
    channels,
    metadata,
    createdAt: new Date()
  });

  if (channels.includes("push")) {
    console.log(`[notify][push] ${targetUser.email} -> ${title}`);
  }

  return { delivered: true, notification: toPublicNotification(notification) };
};

const parseDateTime = (value) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const parseTimeToMinutes = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!TIME_REGEX.test(trimmed)) {
    return null;
  }
  const [hours, minutes] = trimmed.split(":").map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
};

const minutesFromDate = (date) => date.getHours() * 60 + date.getMinutes();

const formatDateTime = (date) =>
  date.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

const sanitizeText = (value) => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const isPasswordStrong = (password) =>
  typeof password === "string" &&
  password.length >= 8 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /\d/.test(password);

const coerceBoolean = (value, fallback) =>
  typeof value === "boolean" ? value : fallback;

const buildDefaultAvailability = () =>
  [1, 2, 3, 4, 5].map((day) => ({
    id: uuid(),
    dayOfWeek: day,
    startTime: "09:00",
    endTime: "18:00"
  }));

const normalizeAvailabilitySlots = (slots) => {
  if (!Array.isArray(slots)) {
    return { ok: false, error: "Formato de disponibilidad invalido." };
  }
  const normalized = [];
  for (const slot of slots) {
    const dayOfWeek = Number(slot?.dayOfWeek);
    const startTime = typeof slot?.startTime === "string" ? slot.startTime.trim() : "";
    const endTime = typeof slot?.endTime === "string" ? slot.endTime.trim() : "";
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return { ok: false, error: "El dia de la semana debe estar entre 0 y 6." };
    }
    const startMinutes = parseTimeToMinutes(startTime);
    const endMinutes = parseTimeToMinutes(endTime);
    if (startMinutes === null || endMinutes === null) {
      return { ok: false, error: "Formato de hora invalido. Usa HH:mm en 24 horas." };
    }
    if (startMinutes >= endMinutes) {
      return { ok: false, error: "El horario debe tener inicio antes del fin." };
    }
    normalized.push({
      id: typeof slot?.id === "string" && slot.id ? slot.id : uuid(),
      dayOfWeek,
      startTime,
      endTime
    });
  }
  return { ok: true, slots: normalized };
};

const ensureWithinAvailability = (user, start, end) => {
  if (!user?.availability || user.availability.length === 0) {
    return { ok: true };
  }
  const sameDay = start.toDateString() === end.toDateString();
  if (!sameDay) {
    return { ok: false, error: "Las sesiones deben iniciar y terminar el mismo dia." };
  }
  const day = start.getDay();
  const startMinutes = minutesFromDate(start);
  const endMinutes = minutesFromDate(end);
  const slots = user.availability.filter((slot) => slot.dayOfWeek === day);
  if (slots.length === 0) {
    return { ok: false, error: "No hay disponibilidad configurada para ese dia." };
  }
  for (const slot of slots) {
    const slotStart = parseTimeToMinutes(slot.startTime);
    const slotEnd = parseTimeToMinutes(slot.endTime);
    if (slotStart === null || slotEnd === null) {
      continue;
    }
    if (startMinutes >= slotStart && endMinutes <= slotEnd) {
      return { ok: true };
    }
  }
  return { ok: false, error: "La sesion esta fuera del horario disponible configurado." };
};

const findConflictingSession = async ({ photographerId, start, end, excludeId }) => {
  const query = {
    photographerId,
    status: { $ne: "cancelled" },
    start: { $lt: end },
    end: { $gt: start }
  };
  if (excludeId) {
    query.id = { $ne: excludeId };
  }
  return SessionModel.findOne(query);
};

const recordAudit = async ({ actor, action, status, message, target, metadata }) => {
  await AuditModel.create({
    id: uuid(),
    actorId: actor?.id,
    actorEmail: actor?.email,
    action,
    status,
    message,
    targetId: target?.id,
    targetEmail: target?.email,
    metadata
  });
};

const recordPermissionDenied = async (actor, action, message, metadata) =>
  recordAudit({ actor, action, status: "denied", message, metadata });

const generateTemporaryPassword = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789#!$@";
  return Array.from({ length: 12 })
    .map(() => alphabet[Math.floor(Math.random() * alphabet.length)])
    .join("");
};

const ensureDefaultAdmin = async () => {
  const count = await UserModel.countDocuments();
  if (count > 0) {
    return;
  }
  const password = "Demo#123";
  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();
  await UserModel.create({
    id: "user-1",
    email: "demo@moongraphy.dev",
    name: "Demo Photographer",
    passwordHash,
    role: "photographer-admin",
    status: "active",
    specialty: "Fotografia de eventos",
    location: "CDMX, MX",
    portfolioUrl: "https://moongraphy.dev/demo",
    bio: "Capturando momentos unicos para inspirar.",
    phone: "+52 55 0000 0000",
    history: [
      {
        timestamp: now,
        type: "register",
        summary: "Usuario demo creado automaticamente"
      }
    ],
    services: [
      {
        id: uuid(),
        title: "Sesion de ejemplo",
        status: "completed",
        createdAt: now,
        notes: "Evento demo generado automaticamente."
      }
    ],
    availability: buildDefaultAvailability(),
    forcePasswordReset: true,
    createdAt: now,
    updatedAt: now
  });
  console.log("[server] Usuario administrador demo creado (demo@moongraphy.dev / Demo#123)");
};

await ensureDefaultAdmin();
await ensureDefaultNotificationTemplates();
await ensureDefaultCancellationPolicy();
const reminderUserCacheLoader = async (id, cache) => {
  if (!id) {
    return null;
  }
  if (cache.has(id)) {
    return cache.get(id);
  }
  const user = await UserModel.findOne({ id });
  cache.set(id, user ?? null);
  return user ?? null;
};

const REMINDER_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const ACTIVE_REMINDER_STATUSES = ["scheduled", "confirmed", "client-confirmed"];

const runSessionReminderSweep = async () => {
  const now = new Date();
  const sessions = await SessionModel.find({
    status: { $in: ACTIVE_REMINDER_STATUSES },
    start: { $gt: now }
  });

  const photographerCache = new Map();
  const clientCache = new Map();

  for (const session of sessions) {
    const diffMs = session.start.getTime() - now.getTime();
    if (diffMs <= 0) {
      continue;
    }
    const diffHours = diffMs / (1000 * 60 * 60);
    let updated = false;

    const photographer = await reminderUserCacheLoader(session.photographerId, photographerCache);
    const client = await reminderUserCacheLoader(session.clientId, clientCache);
    if (!photographer || !client) {
      continue;
    }
    const photographerPrefs = mergeNotificationPreferences(photographer.notificationPreferences);

    // 48h reminder
    if (!session.reminder48Sent && diffHours <= 48 && diffHours > 24) {
      if (photographerPrefs.reminder48h) {
        const reminderContext48 = {
          clientName: client.name,
          photographerName: photographer.name,
          sessionDate: formatDateTime(session.start),
          sessionLocation: session.location,
          sessionType: session.type,
          sessionNotes: session.notes ?? "-",
          fallback: `Recordatorio: tu sesion con ${photographer.name} es el ${formatDateTime(
            session.start
          )} en ${session.location}.`
        };
        const reminderMessage48 = await renderNotificationTemplate(
          NOTIFICATION_TEMPLATE_KEYS.REMINDER_48H,
          reminderContext48
        );
        const notifyResult = await sendUserNotification({
          user: client,
          type: "session-reminder-48h",
          title: "Recordatorio de sesion (48h)",
          message: reminderMessage48,
          sessionId: session.id,
          metadata: { reminderHours: 48 }
        });
        await recordAudit({
          actor: photographer,
          action: "sessions:reminder-48h",
          status: notifyResult.delivered ? "success" : "error",
          message: notifyResult.delivered
            ? `Recordatorio 48h enviado para la sesion ${session.id}.`
            : `Recordatorio 48h no entregado (${notifyResult.reason ?? "motivo desconocido"}).`,
          target: { id: session.id },
          metadata: { reminderHours: 48 }
        });
        session.reminder48Sent = true;
        updated = true;
      }
    }

    // 24h reminder
    if (!session.reminder24Sent && diffHours <= 24) {
      if (photographerPrefs.reminder24h) {
        const reminderContext24 = {
          clientName: client.name,
          photographerName: photographer.name,
          sessionDate: formatDateTime(session.start),
          sessionLocation: session.location,
          sessionType: session.type,
          sessionNotes: session.notes ?? "-",
          fallback: `Tu sesion con ${photographer.name} es el ${formatDateTime(
            session.start
          )}. Confirma tu asistencia desde esta alerta.`
        };
        const reminderMessage24 = await renderNotificationTemplate(
          NOTIFICATION_TEMPLATE_KEYS.REMINDER_24H,
          reminderContext24
        );
        const notifyResult = await sendUserNotification({
          user: client,
          type: "session-reminder-24h",
          title: "Recordatorio de sesion (24h)",
          message: reminderMessage24,
          sessionId: session.id,
          metadata: { reminderHours: 24 }
        });
        await recordAudit({
          actor: photographer,
          action: "sessions:reminder-24h",
          status: notifyResult.delivered ? "success" : "error",
          message: notifyResult.delivered
            ? `Recordatorio 24h enviado para la sesion ${session.id}.`
            : `Recordatorio 24h no entregado (${notifyResult.reason ?? "motivo desconocido"}).`,
          target: { id: session.id },
          metadata: { reminderHours: 24 }
        });
        session.reminder24Sent = true;
        updated = true;
      }
    }

    if (updated) {
      session.updatedAt = new Date();
      await session.save();
    }
  }
};

const startSessionReminderScheduler = () => {
  const execute = () =>
    runSessionReminderSweep().catch((error) => {
      console.error("[reminders] Error ejecutando recordatorios", error);
    });
  execute();
  setInterval(execute, REMINDER_CHECK_INTERVAL_MS);
};

startSessionReminderScheduler();

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Sesion expirada." });
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
    const user = await UserModel.findOne({ id: payload.id });
    if (!user) {
      return res.status(401).json({ success: false, error: "Sesion expirada." });
    }
    req.authUser = user;
    next();
  } catch {
    res.status(401).json({ success: false, error: "Sesion expirada." });
  }
};

app.get("/audit", authenticate, async (req, res) => {
  if (!userHasPermission(req.authUser, "actions:critical")) {
    await recordPermissionDenied(req.authUser, "audit:list", "Intento de consultar auditoria sin permisos.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const events = await AuditModel.find().sort({ createdAt: -1 }).limit(50);
  res.json({ success: true, events });
});

app.post("/audit/record", authenticate, async (req, res) => {
  const { action, message, status = "denied", metadata } = req.body ?? {};
  if (!action || !message) {
    return res.status(400).json({ success: false, error: "Datos incompletos para auditoria." });
  }
  await recordAudit({ actor: req.authUser, action, status, message, metadata });
  res.json({ success: true });
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ success: false, error: "Credenciales invalidas." });
  }
  const user = await UserModel.findOne({ email: email.trim().toLowerCase() });
  if (!user) {
    return res.status(401).json({ success: false, error: "Credenciales invalidas." });
  }
  if (user.status !== "active") {
    return res.status(403).json({
      success: false,
      error: "Tu cuenta ha sido suspendida de forma indefinida. Contacta al administrador para mas informacion."
    });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ success: false, error: "Credenciales invalidas." });
  }

  user.lastLoginAt = new Date();
  addHistoryEntry(user, "login", "Inicio de sesion exitoso");
  await user.save();

  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
  await recordAudit({
    actor: user,
    action: "auth:login",
    status: "success",
    message: "Inicio de sesion correcto"
  });
  res.json({ success: true, token, user: toPublicUser(user) });
});

app.get("/auth/session", authenticate, (req, res) => {
  const user = req.authUser;
  if (user.status !== "active") {
    return res.status(403).json({
      success: false,
      error: "Tu cuenta ha sido suspendida de forma indefinida. Contacta al administrador para mas informacion."
    });
  }
  res.json({ success: true, user: toPublicUser(user) });
});

app.post("/auth/logout", (_req, res) => {
  res.json({ success: true });
});

app.post("/auth/password-reset", async (req, res) => {
  const { email } = req.body ?? {};
  if (!email) {
    return res.status(400).json({ success: false, error: "Correo electronico requerido." });
  }
  const user = await UserModel.findOne({ email: email.trim().toLowerCase() });
  if (!user) {
    return res.status(404).json({ success: false, error: "No existe una cuenta con ese correo." });
  }
  const temporaryPassword = generateTemporaryPassword();
  user.passwordHash = await bcrypt.hash(temporaryPassword, 10);
  user.forcePasswordReset = true;
  addHistoryEntry(user, "password-reset", "Contrasena temporal generada");
  if (user.status === "active") {
    addHistoryEntry(user, "logout", "Sesiones activas invalidadas tras recuperacion");
  }
  await user.save();

  let emailSent = false;
  let emailError;

  const emailSubject = "Recuperacion de contrasena";
  const emailText = `Hola ${user.name ?? ""},\n\nSe genero una contrasena temporal para tu cuenta Moongraphy.\n\nContrasena temporal: ${temporaryPassword}\n\nInicia sesion con ella y cambiala de inmediato desde la aplicacion.\n\nSi no solicitaste este cambio, ignora este mensaje.`;
  const emailHtml = `<p>Hola ${user.name ?? ""},</p><p>Se genero una contrasena temporal para tu cuenta <strong>Moongraphy</strong>.</p><p><strong>Contrasena temporal:</strong> ${temporaryPassword}</p><p>Inicia sesion con ella y cambiala de inmediato desde la aplicacion.</p><p>Si no solicitaste este cambio, ignora este mensaje.</p>`;

  if (mailer && SMTP_FROM) {
    const result = await sendEmail({
      to: user.email,
      subject: emailSubject,
      text: emailText,
      html: emailHtml
    });
    if (result.success) {
      emailSent = true;
    } else {
      emailError = result.error;
    }
  }

  await recordAudit({
    actor: user,
    action: "auth:password-reset",
    status: emailSent ? "success" : mailer ? "error" : "success",
    message: emailSent
      ? "Se genero una contrasena temporal y se envio por correo."
      : mailer
      ? `Se genero una contrasena temporal pero el correo fallo: ${emailError ?? "Error desconocido"}.`
      : "Se genero una contrasena temporal (SMTP no configurado)."
  });

  if (emailSent) {
    return res.json({
      success: true,
      message: "Hemos enviado una contrasena temporal a tu correo electronico."
    });
  }

  res.json({
    success: true,
    message: emailError
      ? "No se pudo enviar el correo automaticamente. Usa la contrasena temporal mostrada y actualizala de inmediato."
      : "Se ha generado una contrasena temporal. Usa el codigo para iniciar sesion y actualizala de inmediato.",
    temporaryPassword
  });
});

app.post("/auth/complete-password-change", authenticate, async (req, res) => {
  const { newPassword } = req.body ?? {};
  if (!isPasswordStrong(newPassword)) {
    return res.status(400).json({
      success: false,
      error: "La nueva contrasena debe tener al menos 8 caracteres, incluir mayusculas, minusculas y numeros."
    });
  }
  const user = req.authUser;
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.forcePasswordReset = false;
  addHistoryEntry(user, "password-change", "Contrasena actualizada por el usuario");
  await user.save();
  await recordAudit({
    actor: user,
    action: "auth:password-change",
    status: "success",
    message: "Contrasena actualizada por el usuario"
  });
  res.json({ success: true });
});

app.post("/auth/change-password", authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof currentPassword !== "string" || currentPassword.length === 0) {
    return res.status(400).json({ success: false, error: "Debes indicar tu contrasena actual." });
  }
  if (!isPasswordStrong(newPassword)) {
    return res.status(400).json({
      success: false,
      error: "La nueva contrasena debe tener al menos 8 caracteres, incluir mayusculas, minusculas y numeros."
    });
  }
  const user = req.authUser;
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return res.status(400).json({ success: false, error: "La contrasena actual no es correcta." });
  }
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.forcePasswordReset = false;
  addHistoryEntry(user, "password-change", "Contrasena actualizada manualmente por el usuario");
  await user.save();
  await recordAudit({
    actor: user,
    action: "auth:password-change",
    status: "success",
    message: "Contrasena actualizada manualmente por el usuario"
  });
  res.json({ success: true });
});

app.get("/availability", authenticate, async (req, res) => {
  const user = req.authUser;
  if (!isPhotographerRole(user.role)) {
    await recordPermissionDenied(user, "availability:list", "Rol sin permisos para consultar disponibilidad.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  res.json({ success: true, availability: user.availability ?? [] });
});

app.put("/availability", authenticate, async (req, res) => {
  const user = req.authUser;
  if (!isPhotographerRole(user.role)) {
    await recordPermissionDenied(user, "availability:update", "Rol sin permisos para actualizar disponibilidad.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const { slots } = req.body ?? {};
  const normalized = normalizeAvailabilitySlots(slots);
  if (!normalized.ok) {
    return res.status(400).json({ success: false, error: normalized.error });
  }
  user.availability = normalized.slots;
  addHistoryEntry(user, "availability-update", "Disponibilidad laboral actualizada");
  await user.save();
  await recordAudit({
    actor: user,
    action: "availability:update",
    status: "success",
    message: "Disponibilidad actualizada",
    metadata: { slots: normalized.slots.length }
  });
  res.json({ success: true, availability: user.availability });
});

app.get("/notifications", authenticate, async (req, res) => {
  const user = req.authUser;
  const { unreadOnly } = req.query ?? {};
  const filter = { userId: user.id };
  if (unreadOnly === "true") {
    filter.readAt = { $exists: false };
  }
  const notifications = await NotificationModel.find(filter).sort({ createdAt: -1 }).limit(100);
  res.json({
    success: true,
    notifications: notifications.map(toPublicNotification)
  });
});

app.post("/notifications/read", authenticate, async (req, res) => {
  const user = req.authUser;
  const { ids, readAll } = req.body ?? {};
  const filter = { userId: user.id };
  if (!readAll) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: "Proporciona los IDs a marcar como leidos." });
    }
    filter.id = { $in: ids };
  }
  await NotificationModel.updateMany(filter, { readAt: new Date() });
  res.json({ success: true });
});

app.put("/notifications/preferences", authenticate, async (req, res) => {
  const user = req.authUser;
  const incoming = req.body ?? {};
  const current = mergeNotificationPreferences(user.notificationPreferences);
  const nextPrefs = {
    pushEnabled: coerceBoolean(incoming.pushEnabled, current.pushEnabled),
    inAppEnabled: coerceBoolean(incoming.inAppEnabled, current.inAppEnabled),
    confirmation: coerceBoolean(incoming.confirmation, current.confirmation),
    reminder48h: coerceBoolean(incoming.reminder48h, current.reminder48h),
    reminder24h: coerceBoolean(incoming.reminder24h, current.reminder24h),
    changes: coerceBoolean(incoming.changes, current.changes)
  };
  user.notificationPreferences = nextPrefs;
  await user.save();
  res.json({
    success: true,
    preferences: mergeNotificationPreferences(user.notificationPreferences)
  });
});

app.patch("/profile", authenticate, async (req, res) => {
  const user = req.authUser;
  const { name, email, avatarUrl, bio, phone, specialty, location, portfolioUrl } = req.body ?? {};

  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ success: false, error: "El nombre no puede estar vacio." });
  }
  if (email !== undefined) {
    const normalized = email.trim().toLowerCase();
    if (!isEmailValid(normalized)) {
      return res.status(400).json({ success: false, error: "Ingresa un correo electronico valido." });
    }
    if (normalized !== user.email) {
      const exists = await UserModel.exists({ email: normalized });
      if (exists) {
        return res
          .status(400)
          .json({ success: false, error: "Ese correo ya esta registrado en otra cuenta." });
      }
      user.email = normalized;
    }
  }
  if (name !== undefined) {
    user.name = name.trim();
  }
  if (avatarUrl !== undefined) {
    user.avatarUrl = avatarUrl.trim() || undefined;
  }
  if (bio !== undefined) {
    user.bio = bio.trim() || undefined;
  }
  if (phone !== undefined) {
    user.phone = phone.trim() || undefined;
  }
  if (isPhotographerRole(user.role)) {
    if (specialty !== undefined) {
      user.specialty = specialty.trim() || undefined;
    }
    if (location !== undefined) {
      user.location = location.trim() || undefined;
    }
    if (portfolioUrl !== undefined) {
      user.portfolioUrl = portfolioUrl.trim() || undefined;
    }
  }

  addHistoryEntry(user, "profile-update", "Perfil actualizado por el usuario");
  await user.save();
  await recordAudit({
    actor: user,
    action: "profile:update",
    status: "success",
    message: "Perfil actualizado correctamente"
  });

  res.json({ success: true, user: toPublicUser(user) });
});

app.post("/users/disable", authenticate, async (req, res) => {
  const user = req.authUser;
  if (!isPhotographerRole(user.role)) {
    return res
      .status(403)
      .json({ success: false, error: "Solo los fotografos pueden deshabilitar temporalmente su cuenta." });
  }
  if (user.status === "inactive") {
    return res.json({ success: true, message: "La cuenta ya se encuentra deshabilitada." });
  }

  user.status = "inactive";
  addHistoryEntry(user, "disable", "Cuenta deshabilitada por el usuario");
  await user.save();
  await recordAudit({
    actor: user,
    action: "accounts:disable",
    status: "success",
    message: "Cuenta deshabilitada por el usuario"
  });
  res.json({ success: true, message: "Tu cuenta ha sido deshabilitada. Un administrador debera reactivarla." });
});

app.get("/users/:id/history", authenticate, async (req, res) => {
  const actor = req.authUser;
  const { id } = req.params;
  if (actor.id !== id && !userHasPermission(actor, "actions:critical")) {
    await recordPermissionDenied(actor, "users:history", "Intento de leer historial ajeno.", { targetId: id });
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const user = await UserModel.findOne({ id });
  if (!user) {
    return res.status(404).json({ success: false, error: "Usuario no encontrado." });
  }
  res.json({ success: true, history: user.history ?? [] });
});

app.get("/sessions", authenticate, async (req, res) => {
  const actor = req.authUser;
  const { from, to, clientId, type, status, photographerId } = req.query ?? {};

  const filter = {};
  if (isPhotographerRole(actor.role)) {
    let scopePhotographerId = actor.id;
    if (actor.role === "photographer-admin" && typeof photographerId === "string" && photographerId.trim()) {
      scopePhotographerId = photographerId.trim();
    }
    if (actor.role !== "photographer-admin" && scopePhotographerId !== actor.id) {
      await recordPermissionDenied(actor, "sessions:list", "Intento de consultar sesiones de otro fotografo.", {
        requestedPhotographerId: scopePhotographerId
      });
      return res.status(403).json({ success: false, error: "Permisos insuficientes." });
    }
    filter.photographerId = scopePhotographerId;
  } else if (actor.role === "client") {
    filter.clientId = actor.id;
  } else {
    await recordPermissionDenied(actor, "sessions:list", "Rol sin permisos para consultar sesiones.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  if (typeof clientId === "string" && clientId.trim()) {
    filter.clientId = clientId.trim();
  }
  if (
    typeof status === "string" &&
    ["scheduled", "confirmed", "client-confirmed", "completed", "cancelled"].includes(status.trim())
  ) {
    filter.status = status.trim();
  }
  if (typeof type === "string" && type.trim()) {
    filter.type = { $regex: new RegExp(type.trim(), "i") };
  }

  const dateRange = {};
  if (typeof from === "string" && from.trim()) {
    const fromDate = parseDateTime(from);
    if (!fromDate) {
      return res.status(400).json({ success: false, error: "Parametro 'from' invalido." });
    }
    dateRange.$gte = fromDate;
  }
  if (typeof to === "string" && to.trim()) {
    const toDate = parseDateTime(to);
    if (!toDate) {
      return res.status(400).json({ success: false, error: "Parametro 'to' invalido." });
    }
    toDate.setHours(23, 59, 59, 999);
    dateRange.$lte = toDate;
  }
  if (Object.keys(dateRange).length > 0) {
    filter.start = dateRange;
  }

  const sessions = await SessionModel.find(filter).sort({ start: 1 });
  const relatedIds = new Set();
  for (const session of sessions) {
    relatedIds.add(session.photographerId);
    relatedIds.add(session.clientId);
  }
  const relatedUsers = await UserModel.find({ id: { $in: Array.from(relatedIds) } }).select({
    id: 1,
    name: 1,
    email: 1,
    role: 1
  });
  const userMap = new Map(relatedUsers.map((user) => [user.id, user]));

  const payload = sessions.map((session) =>
    toPublicSession(session, {
      photographer: userMap.has(session.photographerId)
        ? {
            id: session.photographerId,
            name: userMap.get(session.photographerId).name,
            email: userMap.get(session.photographerId).email
          }
        : undefined,
      client: userMap.has(session.clientId)
        ? {
            id: session.clientId,
            name: userMap.get(session.clientId).name,
            email: userMap.get(session.clientId).email
          }
        : undefined
    })
  );

  res.json({ success: true, sessions: payload });
});

app.post("/sessions", authenticate, async (req, res) => {
  const actor = req.authUser;
  if (!isPhotographerRole(actor.role)) {
    await recordPermissionDenied(actor, "sessions:create", "Rol sin permisos para crear sesiones.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const { clientId, type, sessionTypeId, location, start, end, notes } = req.body ?? {};
  if (!clientId?.trim() || (!type?.trim() && !sessionTypeId) || !location?.trim() || !start || !end) {
    return res.status(400).json({ success: false, error: "Datos incompletos para crear la sesion." });
  }

  const client = await UserModel.findOne({ id: clientId.trim(), role: "client" });
  if (!client) {
    return res.status(404).json({ success: false, error: "Cliente no encontrado." });
  }
  if (actor.role !== "photographer-admin" && client.ownerId && client.ownerId !== actor.id) {
    await recordPermissionDenied(actor, "sessions:create", "Intento de asignar cliente ajeno.", {
      clientId: client.id,
      ownerId: client.ownerId
    });
    return res.status(403).json({ success: false, error: "No puedes asignar sesiones a ese cliente." });
  }

  const startDate = parseDateTime(start);
  const endDate = parseDateTime(end);
  if (!startDate || !endDate) {
    return res.status(400).json({ success: false, error: "Las fechas proporcionadas no son validas." });
  }
  if (endDate <= startDate) {
    return res.status(400).json({ success: false, error: "La hora de fin debe ser posterior a la de inicio." });
  }

  const availabilityCheck = ensureWithinAvailability(actor, startDate, endDate);
  if (!availabilityCheck.ok) {
    return res.status(409).json({ success: false, error: availabilityCheck.error });
  }

  const conflict = await findConflictingSession({
    photographerId: actor.id,
    start: startDate,
    end: endDate
  });
  if (conflict) {
    return res.status(409).json({ success: false, error: "Ya existe una sesion programada en ese horario." });
  }

  let sessionTypeEntry;
  if (sessionTypeId) {
    sessionTypeEntry = await SessionTypeModel.findOne({ id: sessionTypeId, archived: false });
    if (!sessionTypeEntry) {
      return res.status(400).json({ success: false, error: "Tipo de sesion no encontrado o archivado." });
    }
  } else {
    const normalizedType = normalizeSessionTypeName(type);
    sessionTypeEntry = await SessionTypeModel.findOne({ normalizedName: normalizedType, archived: false });
    if (!sessionTypeEntry) {
      return res
        .status(400)
        .json({ success: false, error: "El tipo de sesion no existe en el catalogo. Actualiza el catalogo primero." });
    }
  }

  const activePolicy = await getActiveCancellationPolicy();
  const policySnapshot = activePolicy ? buildPolicySnapshot(activePolicy) : buildPolicySnapshot({
    version: 1,
    settings: DEFAULT_CANCELLATION_POLICY
  });

  const session = await SessionModel.create({
    id: uuid(),
    photographerId: actor.id,
    clientId: client.id,
    type: sessionTypeEntry.name,
    sessionTypeId: sessionTypeEntry.id,
    location: location.trim(),
    notes: sanitizeText(notes),
    start: startDate,
    end: endDate,
    status: "scheduled",
    policySnapshot,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  addHistoryEntry(actor, "session-create", `Sesion programada con ${client.name} para ${formatDateTime(startDate)}`);
  await actor.save();
  addHistoryEntry(client, "session-create", `Sesion programada con ${actor.name} para ${formatDateTime(startDate)}`);
  await client.save();

  let emailSent = false;
  let emailError;
  if (mailer && SMTP_FROM) {
    const subject = "Nueva sesion programada";
    const whenLabel = formatDateTime(startDate);
    const text = `Hola ${client.name},\n\nSe ha programado una nueva sesion con ${actor.name} para ${whenLabel} en ${location.trim()}.\n\nTipo de sesion: ${type.trim()}.\n\nPor favor confirma tu disponibilidad.`;
    const html = `<p>Hola ${client.name},</p><p>Se ha programado una nueva sesion con <strong>${actor.name}</strong>.</p><ul><li><strong>Fecha y hora:</strong> ${whenLabel}</li><li><strong>Tipo:</strong> ${type.trim()}</li><li><strong>Ubicacion:</strong> ${location.trim()}</li></ul><p>Por favor confirma tu disponibilidad.</p>`;
    const result = await sendEmail({ to: client.email, subject, text, html });
    emailSent = result.success;
    emailError = result.success ? undefined : result.error;
  }

  const reminderLabel = formatDateTime(startDate);
  const notifyResult = await sendUserNotification({
    user: client,
    type: "session-created",
    title: "Nueva sesion programada",
    message: `Se programo una sesion con ${actor.name} para ${reminderLabel} en ${location.trim()}.`,
    sessionId: session.id,
    metadata: { start: startDate, location: location.trim(), type: type.trim() }
  });

  const notificationSent = emailSent || notifyResult.delivered;
  const notificationError = notificationSent ? undefined : notifyResult.reason ?? emailError;

  await recordAudit({
    actor,
    action: "sessions:create",
    status: notificationSent ? "success" : mailer ? "error" : "success",
    message: notificationSent
      ? `Sesion ${session.id} programada y notificada al cliente.`
      : mailer
      ? `Sesion ${session.id} programada, pero el correo fallo: ${notificationError ?? "error desconocido"}.`
      : `Sesion ${session.id} programada (SMTP no disponible).`,
    target: { id: session.id },
    metadata: { clientId: client.id, start: startDate, end: endDate }
  });

  await recordTimelineEvent({
    type: TIMELINE_EVENT_TYPES.SESSION_CREATED,
    session,
    actor,
    title: "Sesion programada",
    description: `Sesion programada para ${formatDateTime(startDate)} en ${location.trim()}.`,
    payload: {
      start: startDate,
      end: endDate,
      type: session.type,
      location: location.trim()
    }
  });

  res.status(201).json({
    success: true,
    session: toPublicSession(session, {
      photographer: { id: actor.id, name: actor.name, email: actor.email },
      client: { id: client.id, name: client.name, email: client.email }
    }),
    notificationSent,
    notificationError: notificationSent ? undefined : notificationError
  });
});

app.patch("/sessions/:id", authenticate, async (req, res) => {
  const actor = req.authUser;
  if (!isPhotographerRole(actor.role)) {
    await recordPermissionDenied(actor, "sessions:update", "Rol sin permisos para editar sesiones.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const session = await SessionModel.findOne({ id: req.params.id });
  if (!session) {
    return res.status(404).json({ success: false, error: "Sesion no encontrada." });
  }

  if (session.photographerId !== actor.id && actor.role !== "photographer-admin") {
    await recordPermissionDenied(actor, "sessions:update", "Intento de editar sesion de otro fotografo.", {
      sessionId: session.id,
      ownerId: session.photographerId
    });
    return res.status(403).json({ success: false, error: "No puedes editar esa sesion." });
  }

  if (session.status === "cancelled") {
    return res.status(400).json({ success: false, error: "No se pueden editar sesiones canceladas." });
  }

  const updates = req.body ?? {};
  const client = await UserModel.findOne({ id: session.clientId });
  const photographer =
    session.photographerId === actor.id
      ? actor
      : (await UserModel.findOne({ id: session.photographerId })) ?? actor;

  const previousStart = session.start;
  const previousEnd = session.end;
  const previousTypeName = session.type;
  const previousSessionTypeId = session.sessionTypeId;
  const previousLocation = session.location;
  const previousNotes = session.notes;
  const policySnapshot =
    session.policySnapshot ?? buildPolicySnapshot({ version: 1, settings: DEFAULT_CANCELLATION_POLICY });

  let nextStart = session.start;
  let nextEnd = session.end;
  let scheduleChanged = false;

  if (updates.start) {
    const parsed = parseDateTime(updates.start);
    if (!parsed) {
      return res.status(400).json({ success: false, error: "La nueva fecha de inicio no es valida." });
    }
    if (parsed.getTime() !== session.start.getTime()) {
      nextStart = parsed;
      scheduleChanged = true;
    }
  }
  if (updates.end) {
    const parsed = parseDateTime(updates.end);
    if (!parsed) {
      return res.status(400).json({ success: false, error: "La nueva fecha de fin no es valida." });
    }
    if (parsed.getTime() !== session.end.getTime()) {
      nextEnd = parsed;
      scheduleChanged = true;
    }
  }

  if (nextEnd <= nextStart) {
    return res.status(400).json({ success: false, error: "La hora de fin debe ser posterior a la de inicio." });
  }

  if (scheduleChanged) {
    const policyCheck = evaluatePolicyWindow(policySnapshot, previousStart, "reschedule");
    if (!policyCheck.allowed) {
      return res.status(409).json({ success: false, error: policyCheck.message });
    }
    const availabilityCheck = ensureWithinAvailability(photographer, nextStart, nextEnd);
    if (!availabilityCheck.ok) {
      return res.status(409).json({ success: false, error: availabilityCheck.error });
    }
    const conflict = await findConflictingSession({
      photographerId: session.photographerId,
      start: nextStart,
      end: nextEnd,
      excludeId: session.id
    });
    if (conflict) {
      return res.status(409).json({ success: false, error: "El nuevo horario se traslapa con otra sesion." });
    }
  }

  let nextTypeName = session.type;
  let nextSessionTypeId = session.sessionTypeId;
  if (updates.sessionTypeId || updates.type) {
    let sessionTypeEntry;
    if (updates.sessionTypeId) {
      sessionTypeEntry = await SessionTypeModel.findOne({ id: updates.sessionTypeId, archived: false });
      if (!sessionTypeEntry) {
        return res.status(400).json({ success: false, error: "Tipo de sesion no encontrado o archivado." });
      }
    } else if (updates.type) {
      const normalizedType = normalizeSessionTypeName(updates.type);
      sessionTypeEntry = await SessionTypeModel.findOne({ normalizedName: normalizedType, archived: false });
      if (!sessionTypeEntry) {
        return res
          .status(400)
          .json({ success: false, error: "El tipo de sesion no existe en el catalogo. Actualiza el catalogo primero." });
      }
    }
    if (sessionTypeEntry) {
      nextTypeName = sessionTypeEntry.name;
      nextSessionTypeId = sessionTypeEntry.id;
    }
  }

  let nextLocation = session.location;
  if (updates.location !== undefined) {
    const sanitizedLocation = sanitizeText(updates.location);
    if (!sanitizedLocation) {
      return res.status(400).json({ success: false, error: "La ubicacion no puede quedar vacia." });
    }
    nextLocation = sanitizedLocation;
  }

  let nextNotes = session.notes;
  if (updates.notes !== undefined) {
    nextNotes = updates.notes === "" ? undefined : sanitizeText(updates.notes);
  }

  session.start = nextStart;
  session.end = nextEnd;
  session.type = nextTypeName;
  session.sessionTypeId = nextSessionTypeId;
  session.location = nextLocation;
  session.notes = nextNotes;
  if (scheduleChanged) {
    session.reminder48Sent = false;
    session.reminder24Sent = false;
  }
  session.updatedAt = new Date();
  await session.save();

  const changesPayload = {};
  if (scheduleChanged) {
    changesPayload.schedule = {
      from: { start: previousStart, end: previousEnd },
      to: { start: nextStart, end: nextEnd }
    };
  }
  if (nextTypeName !== previousTypeName || nextSessionTypeId !== previousSessionTypeId) {
    changesPayload.type = { from: previousTypeName, to: nextTypeName };
  }
  if (nextLocation !== previousLocation) {
    changesPayload.location = { from: previousLocation, to: nextLocation };
  }
  const previousNotesValue = previousNotes ?? null;
  const nextNotesValue = nextNotes ?? null;
  if (previousNotesValue !== nextNotesValue) {
    changesPayload.notes = { from: previousNotes, to: nextNotes };
  }

  const whenLabel = formatDateTime(nextStart);
  const historySummary = scheduleChanged
    ? `Sesion reprogramada para ${whenLabel}`
    : "Sesion actualizada";
  addHistoryEntry(photographer, "session-update", historySummary);
  await photographer.save();
  if (client) {
    addHistoryEntry(client, "session-update", `${historySummary} con ${photographer.name}`);
    await client.save();
  }

  let emailSent = false;
  let emailError;
  if (client && mailer && SMTP_FROM) {
    const subject = scheduleChanged ? "Sesion reprogramada" : "Actualizacion de sesion";
    const text = scheduleChanged
      ? `Hola ${client.name},\n\nLa sesion con ${photographer.name} ha sido reprogramada para ${whenLabel} en ${session.location}.\n\nTipo: ${session.type}.`
      : `Hola ${client.name},\n\nLa sesion con ${photographer.name} ha sido actualizada.\n\nTipo: ${session.type}\nUbicacion: ${session.location}\nFecha y hora: ${whenLabel}.`;
    const html = scheduleChanged
      ? `<p>Hola ${client.name},</p><p>La sesion con <strong>${photographer.name}</strong> ha sido reprogramada.</p><ul><li><strong>Nueva fecha:</strong> ${whenLabel}</li><li><strong>Tipo:</strong> ${session.type}</li><li><strong>Ubicacion:</strong> ${session.location}</li></ul>`
      : `<p>Hola ${client.name},</p><p>Se realizaron cambios en tu sesion con <strong>${photographer.name}</strong>.</p><ul><li><strong>Fecha:</strong> ${whenLabel}</li><li><strong>Tipo:</strong> ${session.type}</li><li><strong>Ubicacion:</strong> ${session.location}</li></ul>`;
    const result = await sendEmail({ to: client.email, subject, text, html });
    emailSent = result.success;
    emailError = result.error;
  }

  const fallbackMessage = scheduleChanged
    ? `La sesion con ${photographer.name} fue reprogramada para ${whenLabel} en ${session.location}.`
    : `Se actualizaron detalles de la sesion con ${photographer.name} para ${whenLabel}.`;

  const notificationContext = {
    clientName: client?.name ?? "",
    photographerName: photographer.name,
    sessionDate: whenLabel,
    sessionLocation: session.location,
    sessionType: session.type,
    sessionNotes: session.notes ?? "-",
    fallback: fallbackMessage
  };
  const notificationMessage = await renderNotificationTemplate(
    NOTIFICATION_TEMPLATE_KEYS.CHANGE_CANCEL,
    notificationContext
  );

  const notifyUpdateResult = client
    ? await sendUserNotification({
        user: client,
        type: "session-updated",
        title: scheduleChanged ? "Sesion reprogramada" : "Sesion actualizada",
        message: notificationMessage,
        sessionId: session.id,
        metadata: {
          start: session.start,
          end: session.end,
          scheduleChanged,
          changes: changesPayload
        }
      })
    : { delivered: false, reason: "client-not-found" };

  const notificationSent = emailSent || notifyUpdateResult.delivered;
  const notificationError = notificationSent ? undefined : notifyUpdateResult.reason ?? emailError;

  await recordAudit({
    actor,
    action: "sessions:update",
    status: notificationSent ? "success" : mailer ? "error" : "success",
    message: notificationSent
      ? `Sesion ${session.id} actualizada y notificada.`
      : mailer
      ? `Sesion ${session.id} actualizada; el correo fallo: ${notificationError ?? "error desconocido"}.`
      : `Sesion ${session.id} actualizada (SMTP no disponible).`,
    target: { id: session.id },
    metadata: {
      scheduleChanged,
      start: session.start,
      end: session.end,
      changes: changesPayload
    }
  });

  const timelineType = scheduleChanged
    ? TIMELINE_EVENT_TYPES.SESSION_RESCHEDULED
    : TIMELINE_EVENT_TYPES.SESSION_UPDATED;
  const timelineDescription = scheduleChanged
    ? `Nueva fecha: ${formatDateTime(session.start)} en ${session.location}.`
    : "Se actualizaron detalles de la sesion.";

  await recordTimelineEvent({
    type: timelineType,
    session,
    actor,
    title: scheduleChanged ? "Sesion reprogramada" : "Sesion actualizada",
    description: timelineDescription,
    payload: { changes: changesPayload }
  });

  res.json({
    success: true,
    session: toPublicSession(session, {
      photographer: { id: photographer.id, name: photographer.name, email: photographer.email },
      client: client
        ? { id: client.id, name: client.name, email: client.email }
        : undefined
    }),
    notificationSent,
    notificationError: notificationSent ? undefined : notificationError
  });
});

app.post("/sessions/:id/confirm", authenticate, async (req, res) => {
  const actor = req.authUser;
  if (!isPhotographerRole(actor.role)) {
    await recordPermissionDenied(actor, "sessions:confirm", "Rol sin permisos para confirmar sesiones.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const session = await SessionModel.findOne({ id: req.params.id });
  if (!session) {
    return res.status(404).json({ success: false, error: "Sesion no encontrada." });
  }
  if (session.photographerId !== actor.id && actor.role !== "photographer-admin") {
    await recordPermissionDenied(actor, "sessions:confirm", "Intento de confirmar sesion ajena.", {
      sessionId: session.id,
      ownerId: session.photographerId
    });
    return res.status(403).json({ success: false, error: "No puedes confirmar esa sesion." });
  }
  if (session.status === "cancelled") {
    return res.status(400).json({ success: false, error: "No se pueden confirmar sesiones canceladas." });
  }

  if (session.status === "confirmed" || session.status === "client-confirmed") {
    return res.json({
      success: true,
      session: toPublicSession(session),
      notificationSent: false,
      notificationError: undefined,
      message: "La sesion ya estaba confirmada."
    });
  }

  session.status = "confirmed";
  session.photographerConfirmedAt = new Date();
  session.updatedAt = new Date();
  await session.save();

  const client = await UserModel.findOne({ id: session.clientId });
  const notificationResult = client
    ? await sendUserNotification({
        user: client,
        type: "session-confirmed",
        title: "Sesion confirmada",
        message: await renderNotificationTemplate(NOTIFICATION_TEMPLATE_KEYS.CONFIRMATION, {
          clientName: client.name,
          photographerName: actor.name,
          sessionDate: formatDateTime(session.start),
          sessionLocation: session.location,
          sessionType: session.type,
          sessionNotes: session.notes ?? "-",
          fallback: `La sesion con ${actor.name} para ${formatDateTime(session.start)} en ${session.location} ha sido confirmada.`
        }),
        sessionId: session.id,
        metadata: { start: session.start, location: session.location }
      })
    : { delivered: false, reason: "client-not-found" };

  addHistoryEntry(actor, "session-confirm", "Sesion confirmada para notificar al cliente");
  await actor.save();
  if (client) {
    addHistoryEntry(client, "session-confirm", `Sesion confirmada por ${actor.name}`);
    await client.save();
  }

  await recordAudit({
    actor,
    action: "sessions:confirm",
    status: notificationResult.delivered ? "success" : "error",
    message: notificationResult.delivered
      ? `Sesion ${session.id} confirmada y notificada.`
      : `Sesion ${session.id} confirmada, pero no se pudo notificar: ${notificationResult.reason ?? "motivo desconocido"}.`,
    target: { id: session.id },
    metadata: {
      notified: notificationResult.delivered
    }
  });

  await recordTimelineEvent({
    type: TIMELINE_EVENT_TYPES.SESSION_CONFIRMED,
    session,
    actor,
    title: "Sesion confirmada",
    description: `La sesion fue confirmada para ${formatDateTime(session.start)}.`,
    payload: { notificationSent: notificationResult.delivered }
  });

  res.json({
    success: true,
    session: toPublicSession(session),
    notificationSent: notificationResult.delivered,
    notificationError: notificationResult.delivered ? undefined : notificationResult.reason
  });
});

app.post("/sessions/:id/client-confirm", authenticate, async (req, res) => {
  const actor = req.authUser;
  if (actor.role !== "client") {
    await recordPermissionDenied(actor, "sessions:client-confirm", "Solo clientes pueden confirmar asistencia.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const session = await SessionModel.findOne({ id: req.params.id, clientId: actor.id });
  if (!session) {
    return res.status(404).json({ success: false, error: "Sesion no encontrada para este cliente." });
  }
  if (session.status === "cancelled") {
    return res.status(400).json({ success: false, error: "La sesion fue cancelada y no puede confirmarse." });
  }

  session.status = "client-confirmed";
  session.clientConfirmedAt = new Date();
  session.updatedAt = new Date();
  await session.save();

  addHistoryEntry(actor, "session-client-confirm", "Cliente confirmo asistencia a la sesion");
  await actor.save();

  const photographer = await UserModel.findOne({ id: session.photographerId });
  const notifyPhotographer = photographer
    ? await sendUserNotification({
        user: photographer,
        type: "session-client-confirmed",
        title: "Cliente confirmo asistencia",
        message: `${actor.name} confirmo su asistencia a la sesion del ${formatDateTime(session.start)} en ${session.location}.`,
        sessionId: session.id,
        metadata: { clientId: actor.id }
      })
    : { delivered: false, reason: "photographer-not-found" };

  await recordAudit({
    actor,
    action: "sessions:client-confirm",
    status: notifyPhotographer.delivered ? "success" : "error",
    message: notifyPhotographer.delivered
      ? "Cliente confirmo asistencia y se notifico al fotografo."
      : "Cliente confirmo asistencia pero no se pudo notificar al fotografo.",
    target: { id: session.id },
    metadata: { photographerId: session.photographerId }
  });

  await recordTimelineEvent({
    type: TIMELINE_EVENT_TYPES.SESSION_CLIENT_CONFIRMED,
    session,
    actor,
    title: "Cliente confirmo asistencia",
    description: `${actor.name} confirmo su asistencia a la sesion.`,
    payload: { notificationSent: notifyPhotographer.delivered }
  });

  res.json({
    success: true,
    session: toPublicSession(session),
    notificationSent: notifyPhotographer.delivered,
    notificationError: notifyPhotographer.delivered ? undefined : notifyPhotographer.reason
  });
});

app.post("/sessions/:id/cancel", authenticate, async (req, res) => {
  const actor = req.authUser;
  if (!isPhotographerRole(actor.role)) {
    await recordPermissionDenied(actor, "sessions:cancel", "Rol sin permisos para cancelar sesiones.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const session = await SessionModel.findOne({ id: req.params.id });
  if (!session) {
    return res.status(404).json({ success: false, error: "Sesion no encontrada." });
  }

  if (session.photographerId !== actor.id && actor.role !== "photographer-admin") {
    await recordPermissionDenied(actor, "sessions:cancel", "Intento de cancelar sesion ajena.", {
      sessionId: session.id,
      ownerId: session.photographerId
    });
    return res.status(403).json({ success: false, error: "No puedes cancelar esa sesion." });
  }

  if (session.status === "cancelled") {
    return res.json({ success: true, session: toPublicSession(session) });
  }

  const reason = sanitizeText(req.body?.reason);
  const policySnapshot =
    session.policySnapshot ?? buildPolicySnapshot({ version: 1, settings: DEFAULT_CANCELLATION_POLICY });
  const cancelPolicyCheck = evaluatePolicyWindow(policySnapshot, session.start, "cancel");
  if (!cancelPolicyCheck.allowed) {
    return res.status(409).json({ success: false, error: cancelPolicyCheck.message });
  }
  const client = await UserModel.findOne({ id: session.clientId });
  const photographer =
    session.photographerId === actor.id
      ? actor
      : await UserModel.findOne({ id: session.photographerId }) ?? actor;

  session.status = "cancelled";
  session.cancellationReason = reason;
  session.cancelledAt = new Date();
  session.updatedAt = new Date();
  await session.save();

  const summary = `Sesion cancelada para ${formatDateTime(session.start)}`;
  addHistoryEntry(photographer, "session-cancel", summary);
  await photographer.save();
  if (client) {
    addHistoryEntry(client, "session-cancel", `${summary} con ${photographer.name}`);
    await client.save();
  }

  let emailSent = false;
  let emailError;
  if (client && mailer && SMTP_FROM) {
    const subject = "Sesion cancelada";
    const whenLabel = formatDateTime(session.start);
    const text = `Hola ${client.name},\n\nLa sesion con ${photographer.name} programada para ${whenLabel} ha sido cancelada${reason ? `.\n\nMotivo: ${reason}` : "."}\n\nSi deseas reprogramar, contacta al fotografo.`;
    const htmlReason = reason ? `<p><strong>Motivo:</strong> ${reason}</p>` : "";
    const html = `<p>Hola ${client.name},</p><p>La sesion con <strong>${photographer.name}</strong> programada para ${whenLabel} ha sido cancelada.</p>${htmlReason}<p>Si deseas reprogramar, contacta al fotografo.</p>`;
    const result = await sendEmail({ to: client.email, subject, text, html });
    emailSent = result.success;
    emailError = result.error;
  }

  const cancelFallbackMessage = `La sesion con ${photographer.name} para ${formatDateTime(
    session.start
  )} fue cancelada${reason ? ` (${reason})` : ""}.`;

  const cancelNotificationMessage = await renderNotificationTemplate(
    NOTIFICATION_TEMPLATE_KEYS.CHANGE_CANCEL,
    {
      clientName: client?.name ?? "",
      photographerName: photographer.name,
      sessionDate: formatDateTime(session.start),
      sessionLocation: session.location,
      sessionType: session.type,
      sessionNotes: session.notes ?? "-",
      fallback: cancelFallbackMessage
    }
  );

  const notifyCancelResult = client
    ? await sendUserNotification({
        user: client,
        type: "session-cancelled",
        title: "Sesion cancelada",
        message: cancelNotificationMessage,
        sessionId: session.id,
        metadata: { reason, policyVersion: policySnapshot.version }
      })
    : { delivered: false, reason: "client-not-found" };

  const notificationSent = emailSent || notifyCancelResult.delivered;
  const notificationError = notificationSent ? undefined : notifyCancelResult.reason ?? emailError;

  await recordAudit({
    actor,
    action: "sessions:cancel",
    status: notificationSent ? "success" : mailer ? "error" : "success",
    message: notificationSent
      ? `Sesion ${session.id} cancelada y notificada.`
      : mailer
      ? `Sesion ${session.id} cancelada; el correo fallo: ${notificationError ?? "error desconocido"}.`
      : `Sesion ${session.id} cancelada (SMTP no disponible).`,
    target: { id: session.id },
    metadata: { reason, policyVersion: policySnapshot.version }
  });

  await recordTimelineEvent({
    type: TIMELINE_EVENT_TYPES.SESSION_CANCELLED,
    session,
    actor,
    title: "Sesion cancelada",
    description: `Sesion cancelada para ${formatDateTime(session.start)}.`,
    payload: { reason }
  });

  res.json({
    success: true,
    session: toPublicSession(session, {
      photographer: { id: photographer.id, name: photographer.name, email: photographer.email },
      client: client ? { id: client.id, name: client.name, email: client.email } : undefined
    }),
    notificationSent,
    notificationError: notificationSent ? undefined : notificationError
  });
});

app.get("/galleries", authenticate, async (req, res) => {
  const actor = req.authUser;
  const { status, clientId, sessionId, photographerId } = req.query ?? {};

  const filter = {};
  if (actor.role === "photographer-admin") {
    if (typeof photographerId === "string" && photographerId.trim()) {
      filter.photographerId = photographerId.trim();
    }
  } else if (isPhotographerRole(actor.role)) {
    filter.photographerId = actor.id;
  } else if (actor.role === "client") {
    filter.clientId = actor.id;
  } else {
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  if (typeof clientId === "string" && clientId.trim()) {
    const targetClientId = clientId.trim();
    if (actor.role === "client" && targetClientId !== actor.id) {
      await recordPermissionDenied(actor, "galleries:list", "Cliente intento consultar galerias ajenas.", {
        clientId: targetClientId
      });
      return res.status(403).json({ success: false, error: "No puedes consultar esas galerias." });
    }
    filter.clientId = targetClientId;
  }

  if (typeof sessionId === "string" && sessionId.trim()) {
    filter.sessionId = sessionId.trim();
  }

  if (typeof status === "string" && status.trim()) {
    const normalized = status.trim().toLowerCase();
    if (!GALLERY_STATUS_SET.has(normalized)) {
      return res.status(400).json({ success: false, error: "Estado de galeria desconocido." });
    }
    filter.status = normalized;
  }

  const galleries = await GalleryModel.find(filter).sort({ updatedAt: -1, createdAt: -1 });
  const payload = await buildGalleryResponseList(galleries);

  const totals = { total: galleries.length };
  for (const value of GALLERY_STATUS_VALUES) {
    totals[value] = 0;
  }
  for (const gallery of galleries) {
    if (totals[gallery.status] !== undefined) {
      totals[gallery.status] += 1;
    }
  }

  res.json({ success: true, galleries: payload, totals });
});

app.get("/galleries/:id", authenticate, async (req, res) => {
  const actor = req.authUser;
  const gallery = await GalleryModel.findOne({ id: req.params.id });
  if (!gallery) {
    return res.status(404).json({ success: false, error: "Galeria no encontrada." });
  }

  const session = await SessionModel.findOne({ id: gallery.sessionId });

  if (isPhotographerRole(actor.role)) {
    if (actor.role !== "photographer-admin" && gallery.photographerId !== actor.id) {
      await recordPermissionDenied(actor, "galleries:view", "Intento de ver galeria ajena.", {
        galleryId: gallery.id,
        ownerId: gallery.photographerId
      });
      return res.status(403).json({ success: false, error: "No puedes ver esa galeria." });
    }
  } else if (actor.role === "client") {
    if (gallery.clientId !== actor.id) {
      await recordPermissionDenied(actor, "galleries:view", "Cliente intento acceder a galeria ajena.", {
        galleryId: gallery.id
      });
      return res.status(403).json({ success: false, error: "No puedes ver esa galeria." });
    }
    if (!clientCanAccessGallery(gallery)) {
      return res.status(403).json({ success: false, error: "El material aun esta en revision." });
    }
  } else {
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const [payload] = await buildGalleryResponseList([gallery]);
  res.json({ success: true, gallery: payload ?? toPublicGallery(gallery) });
});

app.get("/timeline/clients/:id", authenticate, async (req, res) => {
  const actor = req.authUser;
  const client = await UserModel.findOne({ id: req.params.id, role: "client" });
  if (!client) {
    return res.status(404).json({ success: false, error: "Cliente no encontrado." });
  }
  if (actor.role === "client" && actor.id !== client.id) {
    await recordPermissionDenied(actor, "timeline:client", "Cliente intento consultar historial ajeno.", {
      clientId: client.id
    });
    return res.status(403).json({ success: false, error: "No puedes consultar ese historial." });
  }
  if (isPhotographerRole(actor.role) && actor.role !== "photographer-admin") {
    if (client.ownerId && client.ownerId !== actor.id) {
      const hasRelationship = await SessionModel.exists({ clientId: client.id, photographerId: actor.id });
      if (!hasRelationship) {
        await recordPermissionDenied(actor, "timeline:client", "Intento de consultar historial de cliente ajeno.", {
          clientId: client.id,
          ownerId: client.ownerId
        });
        return res.status(403).json({ success: false, error: "No puedes consultar ese historial." });
      }
    }
  } else if (!isPhotographerRole(actor.role) && actor.role !== "client") {
    await recordPermissionDenied(actor, "timeline:client", "Rol sin permisos para consultar historial.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const events = await TimelineEventModel.find({ clientId: client.id })
    .sort({ createdAt: -1 })
    .limit(200);
  const payload = await buildTimelineEventsPayload(events);
  res.json({ success: true, events: payload });
});

app.get("/timeline/sessions/:id", authenticate, async (req, res) => {
  const actor = req.authUser;
  const session = await SessionModel.findOne({ id: req.params.id });
  if (!session) {
    return res.status(404).json({ success: false, error: "Sesion no encontrada." });
  }
  if (actor.role === "client" && session.clientId !== actor.id) {
    await recordPermissionDenied(actor, "timeline:session", "Cliente intento consultar historial de otra sesion.", {
      sessionId: session.id,
      clientId: session.clientId
    });
    return res.status(403).json({ success: false, error: "No puedes consultar ese historial." });
  }
  if (isPhotographerRole(actor.role) && actor.role !== "photographer-admin" && session.photographerId !== actor.id) {
    await recordPermissionDenied(actor, "timeline:session", "Fotografo intento consultar sesion ajena.", {
      sessionId: session.id,
      ownerId: session.photographerId
    });
    return res.status(403).json({ success: false, error: "No puedes consultar ese historial." });
  }
  if (!isPhotographerRole(actor.role) && actor.role !== "client") {
    await recordPermissionDenied(actor, "timeline:session", "Rol sin permisos para consultar historial.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const events = await TimelineEventModel.find({ sessionId: session.id })
    .sort({ createdAt: -1 })
    .limit(200);
  const payload = await buildTimelineEventsPayload(events);
  res.json({ success: true, events: payload });
});

app.post("/sessions/:id/notes", authenticate, async (req, res) => {
  const actor = req.authUser;
  if (!isPhotographerRole(actor.role)) {
    await recordPermissionDenied(actor, "sessions:note", "Rol sin permisos para agregar notas.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const session = await SessionModel.findOne({ id: req.params.id });
  if (!session) {
    return res.status(404).json({ success: false, error: "Sesion no encontrada." });
  }
  if (session.photographerId !== actor.id && actor.role !== "photographer-admin") {
    await recordPermissionDenied(actor, "sessions:note", "Intento de agregar nota a sesion ajena.", {
      sessionId: session.id,
      ownerId: session.photographerId
    });
    return res.status(403).json({ success: false, error: "No puedes agregar notas a esa sesion." });
  }
  const note = sanitizeText(req.body?.note);
  if (!note) {
    return res.status(400).json({ success: false, error: "La nota no puede quedar vacia." });
  }
  const createdEvent = await recordTimelineEvent({
    type: TIMELINE_EVENT_TYPES.SESSION_NOTE,
    session,
    actor,
    title: "Nota agregada",
    description: note,
    payload: { note }
  });

  const client = await UserModel.findOne({ id: session.clientId });
  const photographer =
    session.photographerId === actor.id
      ? actor
      : (await UserModel.findOne({ id: session.photographerId })) ?? actor;
  addHistoryEntry(photographer, "session-note", `Nota agregada a la sesion ${session.id}`);
  await photographer.save();
  if (client) {
    addHistoryEntry(client, "session-note", `Nota agregada por ${actor.name}`);
    await client.save();
  }

  const [eventPayload] = await buildTimelineEventsPayload([createdEvent]);
  res.status(201).json({ success: true, event: eventPayload ?? toPublicTimelineEvent(createdEvent) });
});

app.get("/session-types", authenticate, async (req, res) => {
  const includeArchived = req.query?.includeArchived === "true";
  const filter = includeArchived ? {} : { archived: false };
  const types = await SessionTypeModel.find(filter).sort({ name: 1 });
  res.json({
    success: true,
    types: types.map(toPublicSessionType)
  });
});

app.post("/session-types", authenticate, async (req, res) => {
  const actor = req.authUser;
  if (!userHasPermission(actor, "actions:critical")) {
    await recordPermissionDenied(actor, "session-types:create", "Rol sin permisos para crear tipos de sesion.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const name = sanitizeText(req.body?.name);
  if (!name) {
    return res.status(400).json({ success: false, error: "Ingresa el nombre del tipo de sesion." });
  }
  const description = sanitizeText(req.body?.description);
  const normalizedName = normalizeSessionTypeName(name);
  const exists = await SessionTypeModel.findOne({ normalizedName });
  if (exists) {
    return res.status(400).json({ success: false, error: "Ya existe un tipo de sesion con ese nombre." });
  }
  const entry = await SessionTypeModel.create({
    id: uuid(),
    name,
    normalizedName,
    description,
    archived: false,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  await recordAudit({
    actor,
    action: "session-types:create",
    status: "success",
    message: `Tipo de sesion "${name}" creado.`,
    metadata: { sessionTypeId: entry.id }
  });
  res.status(201).json({ success: true, sessionType: toPublicSessionType(entry) });
});

app.patch("/session-types/:id", authenticate, async (req, res) => {
  const actor = req.authUser;
  if (!userHasPermission(actor, "actions:critical")) {
    await recordPermissionDenied(actor, "session-types:update", "Rol sin permisos para editar tipos de sesion.", {
      sessionTypeId: req.params.id
    });
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const entry = await SessionTypeModel.findOne({ id: req.params.id });
  if (!entry) {
    return res.status(404).json({ success: false, error: "Tipo de sesion no encontrado." });
  }
  const { name, description } = req.body ?? {};
  if (name !== undefined) {
    const sanitizedName = sanitizeText(name);
    if (!sanitizedName) {
      return res.status(400).json({ success: false, error: "El nombre no puede quedar vacio." });
    }
    const normalizedName = normalizeSessionTypeName(sanitizedName);
    const exists = await SessionTypeModel.findOne({
      normalizedName,
      id: { $ne: entry.id }
    });
    if (exists) {
      return res.status(400).json({ success: false, error: "Ya existe otro tipo de sesion con ese nombre." });
    }
    entry.name = sanitizedName;
    entry.normalizedName = normalizedName;
  }
  if (description !== undefined) {
    entry.description = sanitizeText(description);
  }
  entry.updatedAt = new Date();
  await entry.save();
  await recordAudit({
    actor,
    action: "session-types:update",
    status: "success",
    message: `Tipo de sesion ${entry.id} actualizado.`,
    metadata: { sessionTypeId: entry.id }
  });
  res.json({ success: true, sessionType: toPublicSessionType(entry) });
});

app.delete("/session-types/:id", authenticate, async (req, res) => {
  const actor = req.authUser;
  if (!userHasPermission(actor, "actions:critical")) {
    await recordPermissionDenied(actor, "session-types:archive", "Rol sin permisos para eliminar tipos de sesion.", {
      sessionTypeId: req.params.id
    });
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const entry = await SessionTypeModel.findOne({ id: req.params.id });
  if (!entry) {
    return res.status(404).json({ success: false, error: "Tipo de sesion no encontrado." });
  }
  if (!entry.archived) {
    entry.archived = true;
    entry.updatedAt = new Date();
    await entry.save();
  }
  await recordAudit({
    actor,
    action: "session-types:archive",
    status: "success",
    message: `Tipo de sesion ${entry.id} archivado.`,
    metadata: { sessionTypeId: entry.id }
  });
  res.json({ success: true, sessionType: toPublicSessionType(entry) });
});

app.post("/session-types/:id/restore", authenticate, async (req, res) => {
  const actor = req.authUser;
  if (!userHasPermission(actor, "actions:critical")) {
    await recordPermissionDenied(actor, "session-types:restore", "Rol sin permisos para restaurar tipos de sesion.", {
      sessionTypeId: req.params.id
    });
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const entry = await SessionTypeModel.findOne({ id: req.params.id });
  if (!entry) {
    return res.status(404).json({ success: false, error: "Tipo de sesion no encontrado." });
  }
  if (entry.archived) {
    entry.archived = false;
    entry.updatedAt = new Date();
    await entry.save();
  }
  await recordAudit({
    actor,
    action: "session-types:restore",
    status: "success",
    message: `Tipo de sesion ${entry.id} restaurado.`,
    metadata: { sessionTypeId: entry.id }
  });
  res.json({ success: true, sessionType: toPublicSessionType(entry) });
});

app.get("/notification-templates", authenticate, async (req, res) => {
  if (!userHasPermission(req.authUser, "actions:critical")) {
    await recordPermissionDenied(req.authUser, "notification-templates:list", "Rol sin permisos para gestionar plantillas.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const templates = await NotificationTemplateModel.find().sort({ key: 1 });
  const defaultsMap = new Map(DEFAULT_NOTIFICATION_TEMPLATES.map((template) => [template.key, template]));
  const payload = DEFAULT_NOTIFICATION_TEMPLATES.map((template) => {
    const current = templates.find((entry) => entry.key === template.key);
    return {
      key: template.key,
      name: template.name,
      description: template.description,
      body: current?.body ?? template.body,
      defaultBody: template.body,
      placeholders: template.placeholders,
      updatedAt: current?.updatedAt ?? null
    };
  });
  res.json({ success: true, templates: payload });
});

app.put("/notification-templates/:key", authenticate, async (req, res) => {
  if (!userHasPermission(req.authUser, "actions:critical")) {
    await recordPermissionDenied(req.authUser, "notification-templates:update", "Rol sin permisos para editar plantillas.", {
      key: req.params.key
    });
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const key = req.params.key;
  const defaultTemplate = DEFAULT_NOTIFICATION_TEMPLATES.find((template) => template.key === key);
  if (!defaultTemplate) {
    return res.status(404).json({ success: false, error: "Plantilla no reconocida." });
  }
  const body = typeof req.body?.body === "string" ? req.body.body : "";
  const validation = validateTemplatePlaceholders(body);
  if (!validation.ok) {
    return res.status(400).json({ success: false, error: validation.error });
  }

  const existing =
    (await NotificationTemplateModel.findOne({ key })) ??
    (await NotificationTemplateModel.create({
      id: uuid(),
      key,
      name: defaultTemplate.name,
      description: defaultTemplate.description,
      defaultBody: defaultTemplate.body,
      body: defaultTemplate.body,
      placeholders: defaultTemplate.placeholders,
      updatedAt: new Date()
    }));

  existing.body = body;
  existing.updatedAt = new Date();
  existing.placeholders = defaultTemplate.placeholders;
  await existing.save();

  await recordAudit({
    actor: req.authUser,
    action: "notification-templates:update",
    status: "success",
    message: `Plantilla ${key} actualizada.`,
    metadata: { key }
  });

  res.json({
    success: true,
    template: {
      key,
      name: existing.name,
      description: existing.description,
      body: existing.body,
      defaultBody: defaultTemplate.body,
      placeholders: defaultTemplate.placeholders,
      updatedAt: existing.updatedAt
    }
  });
});

app.post("/notification-templates/:key/reset", authenticate, async (req, res) => {
  if (!userHasPermission(req.authUser, "actions:critical")) {
    await recordPermissionDenied(req.authUser, "notification-templates:reset", "Rol sin permisos para restaurar plantillas.", {
      key: req.params.key
    });
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const key = req.params.key;
  const defaultTemplate = DEFAULT_NOTIFICATION_TEMPLATES.find((template) => template.key === key);
  if (!defaultTemplate) {
    return res.status(404).json({ success: false, error: "Plantilla no reconocida." });
  }
  const existing = await NotificationTemplateModel.findOne({ key });
  if (existing) {
    existing.body = defaultTemplate.body;
    existing.placeholders = defaultTemplate.placeholders;
    existing.updatedAt = new Date();
    await existing.save();
  } else {
    await NotificationTemplateModel.create({
      id: uuid(),
      key,
      name: defaultTemplate.name,
      description: defaultTemplate.description,
      defaultBody: defaultTemplate.body,
      body: defaultTemplate.body,
      placeholders: defaultTemplate.placeholders,
      updatedAt: new Date()
    });
  }

  await recordAudit({
    actor: req.authUser,
    action: "notification-templates:reset",
    status: "success",
    message: `Plantilla ${key} restaurada a sus valores por defecto.`,
    metadata: { key }
  });

  res.json({
    success: true,
    template: {
      key,
      name: defaultTemplate.name,
      description: defaultTemplate.description,
      body: defaultTemplate.body,
      defaultBody: defaultTemplate.body,
      placeholders: defaultTemplate.placeholders,
      updatedAt: new Date()
    }
  });
});

app.get("/policies/cancellation", authenticate, async (_req, res) => {
  const policy = await getActiveCancellationPolicy();
  const snapshot = buildPolicySnapshot(policy);
  res.json({
    success: true,
    policy: {
      version: policy.version,
      settings: snapshot,
      createdAt: policy.createdAt,
      createdBy: policy.createdBy
    }
  });
});

app.put("/policies/cancellation", authenticate, async (req, res) => {
  const actor = req.authUser;
  if (!userHasPermission(actor, "actions:critical")) {
    await recordPermissionDenied(actor, "policies:update", "Rol sin permisos para actualizar politicas.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const { minHoursCancel, minHoursReschedule, toleranceMinutes } = req.body ?? {};
  const nextSettings = {
    minHoursCancel: Number.isFinite(minHoursCancel) ? Number(minHoursCancel) : DEFAULT_CANCELLATION_POLICY.minHoursCancel,
    minHoursReschedule: Number.isFinite(minHoursReschedule)
      ? Number(minHoursReschedule)
      : DEFAULT_CANCELLATION_POLICY.minHoursReschedule,
    toleranceMinutes: Number.isFinite(toleranceMinutes)
      ? Number(toleranceMinutes)
      : DEFAULT_CANCELLATION_POLICY.toleranceMinutes
  };
  if (nextSettings.minHoursCancel < 0 || nextSettings.minHoursReschedule < 0 || nextSettings.toleranceMinutes < 0) {
    return res.status(400).json({ success: false, error: "Los valores de la politica deben ser numeros positivos." });
  }

  const current = await getActiveCancellationPolicy();
  const nextVersion = current ? current.version + 1 : 1;
  const policy = await PolicyModel.create({
    id: uuid(),
    type: "cancellation",
    version: nextVersion,
    settings: nextSettings,
    createdBy: actor.id,
    createdAt: new Date()
  });

  await recordAudit({
    actor,
    action: "policies:update",
    status: "success",
    message: `Politica de cancelacion version ${nextVersion} guardada.`,
    metadata: nextSettings
  });

  res.json({
    success: true,
    policy: {
      version: policy.version,
      settings: buildPolicySnapshot(policy),
      createdAt: policy.createdAt,
      createdBy: policy.createdBy
    }
  });
});

app.post("/galleries", authenticate, async (req, res) => {
  const actor = req.authUser;
  if (!isPhotographerRole(actor.role)) {
    await recordPermissionDenied(actor, "galleries:create", "Rol sin permisos para crear galerias.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const sessionId =
    typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
  if (!sessionId) {
    return res.status(400).json({ success: false, error: "Selecciona la sesion a vincular." });
  }

  const session = await SessionModel.findOne({ id: sessionId });
  if (!session) {
    return res.status(404).json({ success: false, error: "Sesion no encontrada." });
  }

  if (actor.role !== "photographer-admin" && session.photographerId !== actor.id) {
    await recordPermissionDenied(actor, "galleries:create", "Intento de crear galeria para sesion ajena.", {
      sessionId: session.id,
      ownerId: session.photographerId
    });
    return res.status(403).json({ success: false, error: "No puedes crear una galeria para esa sesion." });
  }

  const name = sanitizeText(req.body?.name);
  if (!name) {
    return res.status(400).json({ success: false, error: "Ingresa el nombre de la galeria." });
  }

  const description = sanitizeText(req.body?.description);
  const now = new Date();

  const gallery = await GalleryModel.create({
    id: uuid(),
    sessionId: session.id,
    photographerId: session.photographerId,
    clientId: session.clientId,
    name,
    description,
    status: "pending",
    photos: [],
    history: [
      {
        timestamp: now,
        type: "create",
        summary: `Galeria creada por ${actor.name ?? "sistema"}.`
      }
    ],
    createdAt: now,
    updatedAt: now
  });

  await recordAudit({
    actor,
    action: "galleries:create",
    status: "success",
    message: `Galeria ${gallery.name} creada para la sesion ${session.id}.`,
    target: { id: gallery.id },
    metadata: { sessionId: session.id, clientId: session.clientId }
  });

  await recordTimelineEvent({
    type: TIMELINE_EVENT_TYPES.GALLERY_CREATED,
    session,
    actor,
    galleryId: gallery.id,
    clientId: gallery.clientId,
    photographerId: gallery.photographerId,
    title: "Galeria creada",
    description: `Se creo la galeria ${gallery.name}.`,
    payload: { galleryId: gallery.id }
  });

  const [payload] = await buildGalleryResponseList([gallery]);
  res.status(201).json({ success: true, gallery: payload ?? toPublicGallery(gallery) });
});

app.patch("/galleries/:id", authenticate, async (req, res) => {
  const actor = req.authUser;
  if (!isPhotographerRole(actor.role)) {
    await recordPermissionDenied(actor, "galleries:update", "Rol sin permisos para editar galerias.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const gallery = await GalleryModel.findOne({ id: req.params.id });
  if (!gallery) {
    return res.status(404).json({ success: false, error: "Galeria no encontrada." });
  }

  if (actor.role !== "photographer-admin" && gallery.photographerId !== actor.id) {
    await recordPermissionDenied(actor, "galleries:update", "Intento de editar galeria ajena.", {
      galleryId: gallery.id,
      ownerId: gallery.photographerId
    });
    return res.status(403).json({ success: false, error: "No puedes editar esa galeria." });
  }

  if ((gallery.photos?.length ?? 0) > 0) {
    return res
      .status(400)
      .json({ success: false, error: "No puedes editar el nombre o descripcion despues de subir fotos." });
  }

  const { name: rawName, description: rawDescription } = req.body ?? {};
  let changed = false;

  if (rawName !== undefined) {
    const nextName = sanitizeText(rawName);
    if (!nextName) {
      return res.status(400).json({ success: false, error: "El nombre de la galeria no puede quedar vacio." });
    }
    gallery.name = nextName;
    changed = true;
  }

  if (rawDescription !== undefined) {
    gallery.description = sanitizeText(rawDescription);
    changed = true;
  }

  if (!changed) {
    return res.status(400).json({ success: false, error: "No se recibieron cambios para actualizar." });
  }

  gallery.updatedAt = new Date();
  addGalleryHistoryEntry(gallery, "update", `Galeria editada por ${actor.name ?? "sistema"}.`);
  await gallery.save();

  await recordAudit({
    actor,
    action: "galleries:update",
    status: "success",
    message: `Galeria ${gallery.id} actualizada.`,
    target: { id: gallery.id }
  });

  const [payload] = await buildGalleryResponseList([gallery]);
  res.json({ success: true, gallery: payload ?? toPublicGallery(gallery) });
});

app.post("/galleries/:id/photos", authenticate, async (req, res) => {
  const actor = req.authUser;
  if (!isPhotographerRole(actor.role)) {
    await recordPermissionDenied(actor, "galleries:upload", "Rol sin permisos para subir fotos.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const gallery = await GalleryModel.findOne({ id: req.params.id });
  if (!gallery) {
    return res.status(404).json({ success: false, error: "Galeria no encontrada." });
  }

  const session = await SessionModel.findOne({ id: gallery.sessionId });

  if (actor.role !== "photographer-admin" && gallery.photographerId !== actor.id) {
    await recordPermissionDenied(actor, "galleries:upload", "Intento de subir fotos a galeria ajena.", {
      galleryId: gallery.id,
      ownerId: gallery.photographerId
    });
    return res.status(403).json({ success: false, error: "No puedes modificar esa galeria." });
  }

  if (gallery.status === "delivered" || gallery.status === "received") {
    return res
      .status(400)
      .json({ success: false, error: "Coloca la galeria en revision antes de subir nuevas fotos." });
  }

  const uploader = galleryUpload.array("files", MAX_UPLOAD_FILES_PER_BATCH);
  uploader(req, res, async (err) => {
    if (err) {
      console.error("[galleries][upload] Error procesando imagenes", err);
      let message = "No se pudieron subir las imagenes.";
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          message = "Una de las imagenes supera el limite de 25MB.";
        } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
          message = "Se intentaron subir demasiados archivos en una sola carga.";
        }
      } else if (err?.code === "INVALID_FILE_TYPE") {
        message = "Formato de archivo no soportado. Usa JPG o PNG.";
      }
      return res.status(400).json({ success: false, error: message });
    }

    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      return res.status(400).json({ success: false, error: "Selecciona al menos una imagen JPG o PNG." });
    }

    const newPhotos = files.map((file) => {
      const relativePath = path.relative(UPLOADS_ROOT, file.path).replace(/\\/g, "/");
      return {
        id: uuid(),
        filename: path.basename(file.path),
        originalName: file.originalname ?? path.basename(file.path),
        mimeType: file.mimetype,
        size: file.size,
        storagePath: relativePath,
        url: `/uploads/${relativePath}`,
        uploadedAt: new Date()
      };
    });

    gallery.photos.push(...newPhotos);
    gallery.updatedAt = new Date();
    addGalleryHistoryEntry(gallery, "upload", `Se cargaron ${newPhotos.length} fotos.`);
    await gallery.save();

    await recordAudit({
      actor,
      action: "galleries:upload",
      status: "success",
      message: `Se subieron ${newPhotos.length} fotos a la galeria ${gallery.id}.`,
      target: { id: gallery.id },
      metadata: { photoIds: newPhotos.map((photo) => photo.id) }
    });

    await recordTimelineEvent({
      type: TIMELINE_EVENT_TYPES.GALLERY_PHOTOS_UPLOADED,
      session,
      actor,
      galleryId: gallery.id,
      clientId: gallery.clientId,
      photographerId: gallery.photographerId,
      title: `${newPhotos.length} fotos cargadas`,
      description: `Se agregaron ${newPhotos.length} foto(s) a la galeria ${gallery.name}.`,
      payload: {
        count: newPhotos.length,
        photoIds: newPhotos.map((photo) => photo.id)
      }
    });

    const [payload] = await buildGalleryResponseList([gallery]);
    res.json({ success: true, gallery: payload ?? toPublicGallery(gallery) });
  });
});

app.patch("/galleries/:id/status", authenticate, async (req, res) => {
  const actor = req.authUser;
  if (!isPhotographerRole(actor.role)) {
    await recordPermissionDenied(actor, "galleries:status", "Rol sin permisos para actualizar estado de galerias.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const gallery = await GalleryModel.findOne({ id: req.params.id });
  if (!gallery) {
    return res.status(404).json({ success: false, error: "Galeria no encontrada." });
  }

  const session = await SessionModel.findOne({ id: gallery.sessionId });

  if (actor.role !== "photographer-admin" && gallery.photographerId !== actor.id) {
    await recordPermissionDenied(actor, "galleries:status", "Intento de actualizar galeria ajena.", {
      galleryId: gallery.id,
      ownerId: gallery.photographerId
    });
    return res.status(403).json({ success: false, error: "No puedes actualizar esa galeria." });
  }

  const nextStatus =
    typeof req.body?.status === "string" ? req.body.status.trim().toLowerCase() : "";
  if (!nextStatus) {
    return res.status(400).json({ success: false, error: "Indica el estado a establecer." });
  }
  if (!GALLERY_STATUS_SET.has(nextStatus)) {
    return res.status(400).json({ success: false, error: "Estado de galeria desconocido." });
  }
  if (nextStatus === "received") {
    return res.status(400).json({ success: false, error: "Solo el cliente puede confirmar la recepcion." });
  }
  if (nextStatus === "delivered" && (gallery.photos?.length ?? 0) === 0) {
    return res.status(400).json({ success: false, error: "Agrega al menos una foto antes de marcar como entregada." });
  }

  if (gallery.status === nextStatus) {
    const [payload] = await buildGalleryResponseList([gallery]);
    return res.json({ success: true, gallery: payload ?? toPublicGallery(gallery) });
  }

  gallery.status = nextStatus;
  const now = new Date();
  gallery.updatedAt = now;
  if (nextStatus === "delivered") {
    gallery.deliveredAt = now;
  } else {
    gallery.deliveredAt = undefined;
    gallery.receivedAt = undefined;
  }

  addGalleryHistoryEntry(
    gallery,
    "status",
    `Estado actualizado a ${galleryStatusLabels[nextStatus] ?? nextStatus} por ${actor.name ?? "sistema"}.`
  );
  await gallery.save();

  let notificationSent = false;
  let notificationError;
  if (nextStatus === "delivered") {
    const client = await UserModel.findOne({ id: gallery.clientId });
    const session = await SessionModel.findOne({ id: gallery.sessionId });
    if (!client) {
      notificationError = "client-not-found";
    } else {
      const notifyResult = await sendUserNotification({
        user: client,
        type: "gallery-delivered",
        title: "Tu galeria esta lista",
        message: session
          ? `Tus fotos de la sesion "${session.type}" estan listas para revisar.`
          : "Tus fotos estan listas para revisar.",
        metadata: { galleryId: gallery.id, sessionId: gallery.sessionId }
      });
      notificationSent = notifyResult.delivered;
      notificationError = notificationSent ? undefined : notifyResult.reason;
    }
  }

  const auditStatus =
    nextStatus === "delivered" && notificationError && notificationError !== "client-not-found"
      ? "error"
      : "success";

  await recordAudit({
    actor,
    action: "galleries:status",
    status: auditStatus,
    message: `Galeria ${gallery.id} actualizada a estado ${nextStatus}.`,
    target: { id: gallery.id },
    metadata: { status: nextStatus, notificationSent, notificationError }
  });

  let timelineType;
  let timelineTitle;
  let timelineDescription;
  switch (nextStatus) {
    case "delivered":
      timelineType = TIMELINE_EVENT_TYPES.GALLERY_DELIVERED;
      timelineTitle = "Galeria entregada";
      timelineDescription = "Galeria marcada como entregada.";
      break;
    case "review":
      timelineType = TIMELINE_EVENT_TYPES.GALLERY_REVIEW;
      timelineTitle = "Galeria en revision";
      timelineDescription = "Galeria disponible para revision interna.";
      break;
    default:
      timelineType = TIMELINE_EVENT_TYPES.GALLERY_PENDING;
      timelineTitle = "Galeria pendiente";
      timelineDescription = "Galeria marcada como pendiente.";
      break;
  }

  await recordTimelineEvent({
    type: timelineType,
    session,
    actor,
    galleryId: gallery.id,
    clientId: gallery.clientId,
    photographerId: gallery.photographerId,
    title: timelineTitle,
    description: timelineDescription,
    payload: {
      status: nextStatus,
      notificationSent,
      notificationError
    }
  });

  const [payload] = await buildGalleryResponseList([gallery]);
  res.json({
    success: true,
    gallery: payload ?? toPublicGallery(gallery),
    notificationSent,
    notificationError: notificationSent ? undefined : notificationError
  });
});

app.post("/galleries/:id/confirm", authenticate, async (req, res) => {
  const actor = req.authUser;
  if (actor.role !== "client") {
    await recordPermissionDenied(actor, "galleries:confirm", "Solo los clientes pueden confirmar entregas.", {
      galleryId: req.params.id
    });
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const gallery = await GalleryModel.findOne({ id: req.params.id });
  if (!gallery) {
    return res.status(404).json({ success: false, error: "Galeria no encontrada." });
  }

  if (gallery.clientId !== actor.id) {
    await recordPermissionDenied(actor, "galleries:confirm", "Cliente intento confirmar galeria ajena.", {
      galleryId: gallery.id
    });
    return res.status(403).json({ success: false, error: "No puedes confirmar esa galeria." });
  }

  if (gallery.status !== "delivered") {
    return res.status(400).json({ success: false, error: "Solo puedes confirmar galerias entregadas." });
  }

  if ((gallery.photos?.length ?? 0) === 0) {
    return res.status(400).json({ success: false, error: "La galeria aun no tiene fotos cargadas." });
  }

  gallery.status = "received";
  const now = new Date();
  gallery.receivedAt = now;
  gallery.updatedAt = now;
  addGalleryHistoryEntry(gallery, "confirm", `Confirmacion de recepcion por ${actor.name ?? "cliente"}.`);
  await gallery.save();

  const photographer = await UserModel.findOne({ id: gallery.photographerId });
  let notificationSent = false;
  let notificationError;
  if (photographer) {
    const notifyResult = await sendUserNotification({
      user: photographer,
      type: "gallery-received",
      title: "Entrega confirmada",
      message: `${actor.name} confirmo la recepcion de la galeria "${gallery.name}".`,
      metadata: { galleryId: gallery.id, clientId: actor.id }
    });
    notificationSent = notifyResult.delivered;
    notificationError = notificationSent ? undefined : notifyResult.reason;
  } else {
    notificationError = "photographer-not-found";
  }

  const auditStatus = notificationSent || notificationError === "photographer-not-found" ? "success" : "error";

  await recordAudit({
    actor,
    action: "galleries:confirm",
    status: auditStatus,
    message: `Cliente confirmo la recepcion de la galeria ${gallery.id}.`,
    target: { id: gallery.id, email: photographer?.email },
    metadata: { galleryId: gallery.id, notificationSent, notificationError }
  });

  await recordTimelineEvent({
    type: TIMELINE_EVENT_TYPES.GALLERY_CONFIRMED,
    session,
    actor,
    galleryId: gallery.id,
    clientId: gallery.clientId,
    photographerId: gallery.photographerId,
    title: "Entrega confirmada",
    description: `El cliente confirmo la recepcion de la galeria ${gallery.name}.`,
    payload: { galleryId: gallery.id, notificationSent, notificationError }
  });

  const [payload] = await buildGalleryResponseList([gallery]);
  res.json({
    success: true,
    gallery: payload ?? toPublicGallery(gallery),
    notificationSent,
    notificationError: notificationSent ? undefined : notificationError
  });
});

app.post("/accounts", authenticate, async (req, res) => {
  const actor = req.authUser;
  if (!userHasPermission(actor, "accounts:create")) {
    await recordPermissionDenied(actor, "accounts:create", "Intento de crear cuenta sin permisos.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }

  const { name, email, password, role, specialty, location, portfolioUrl, phone, bio } = req.body ?? {};

  if (!name?.trim() || !email?.trim() || !password?.trim() || !role) {
    return res.status(400).json({ success: false, error: "Datos incompletos." });
  }

  if (role === "photographer-admin" && actor.role !== "photographer-admin") {
    await recordPermissionDenied(actor, "accounts:create", "Intento de crear admin sin permisos.", {
      attemptedRole: role
    });
    return res.status(403).json({ success: false, error: "Solo un fotografo administrador puede crear otra cuenta administradora." });
  }

  if (!isEmailValid(email)) {
    return res.status(400).json({ success: false, error: "Ingresa un correo electronico valido." });
  }
  const exists = await UserModel.exists({ email: email.trim().toLowerCase() });
  if (exists) {
    return res.status(400).json({ success: false, error: "Ya existe una cuenta con ese correo electronico." });
  }
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      error: "La contrasena debe tener al menos 6 caracteres."
    });
  }

  if (role === "client" && !phone?.trim()) {
    return res.status(400).json({
      success: false,
      error: "El telefono es obligatorio para clientes."
    });
  }

  if (isPhotographerRole(role)) {
    if (!specialty?.trim()) {
      return res.status(400).json({ success: false, error: "Indica la especialidad fotografica." });
    }
    if (!location?.trim()) {
      return res.status(400).json({ success: false, error: "Indica la ubicacion principal." });
    }
  }

  const passwordHash = await bcrypt.hash(password.trim(), 10);
  const now = new Date();
  const newUser = await UserModel.create({
    id: uuid(),
    email: email.trim().toLowerCase(),
    name: name.trim(),
    passwordHash,
    role,
    status: "active",
    specialty: isPhotographerRole(role) ? specialty?.trim() : undefined,
    location: isPhotographerRole(role) ? location?.trim() : undefined,
    portfolioUrl: isPhotographerRole(role) ? portfolioUrl?.trim() : undefined,
    bio: bio?.trim(),
    phone: phone?.trim(),
    ownerId: role === "client" ? actor.id : undefined,
    availability: isPhotographerRole(role) ? buildDefaultAvailability() : [],
    forcePasswordReset: true,
    history: [
      {
        timestamp: now,
        type: "register",
        summary:
          role === "client"
            ? "Cuenta de cliente creada por administrador"
            : "Cuenta de usuario creada por administrador"
      }
    ],
    services: [],
    createdAt: now,
    updatedAt: now
  });

  await recordAudit({
    actor,
    action: "accounts:create",
    status: "success",
    message: `Se creo la cuenta ${newUser.email}`,
    target: { id: newUser.id, email: newUser.email }
  });

  res.status(201).json({ success: true, user: toPublicUser(newUser) });
});

app.get("/clients", authenticate, async (req, res) => {
  const actor = req.authUser;
  if (!userHasPermission(actor, "accounts:create")) {
    await recordPermissionDenied(actor, "clients:list", "Rol sin permisos para consultar clientes.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const query =
    actor.role === "photographer-admin" ? { role: "client" } : { role: "client", ownerId: actor.id };
  const clients = await UserModel.find(query);
  res.json({ success: true, clients: clients.map(toPublicUser) });
});

app.post("/clients", authenticate, async (req, res) => {
  const actor = req.authUser;
  if (!userHasPermission(actor, "accounts:create")) {
    await recordPermissionDenied(actor, "clients:create", "Rol sin permisos para crear clientes.");
    return res.status(403).json({ success: false, error: "Permisos insuficientes." });
  }
  const { name, email, phone, bio } = req.body ?? {};
  if (!name?.trim() || !email?.trim() || !phone?.trim()) {
    return res.status(400).json({ success: false, error: "Datos incompletos." });
  }
  if (!isEmailValid(email)) {
    return res.status(400).json({ success: false, error: "Ingresa un correo electronico valido." });
  }
  const exists = await UserModel.exists({ email: email.trim().toLowerCase() });
  if (exists) {
    return res
      .status(400)
      .json({ success: false, error: "Ya existe una cuenta con ese correo electronico." });
  }
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);
  const now = new Date();
  const client = await UserModel.create({
    id: uuid(),
    email: email.trim().toLowerCase(),
    name: name.trim(),
    passwordHash,
    role: "client",
    status: "active",
    phone: phone.trim(),
    bio: bio?.trim(),
    ownerId: actor.id,
    forcePasswordReset: true,
    history: [
      {
        timestamp: now,
        type: "register",
        summary: "Cuenta de cliente creada por administrador"
      }
    ],
    services: [],
    createdAt: now,
    updatedAt: now
  });

  let emailSent = false;
  let emailError;
  if (mailer && SMTP_FROM) {
    const subject = "Bienvenido a Moongraphy";
    const text = `Hola ${client.name},\n\nSe creo una cuenta de cliente en Moongraphy para ti.\n\nCorreo: ${client.email}\nContrasena temporal: ${temporaryPassword}\n\nInicia sesion y cambia la contrasena cuanto antes.`;
    const html = `<p>Hola ${client.name},</p><p>Se creo una cuenta de cliente en <strong>Moongraphy</strong> para ti.</p><p><strong>Correo:</strong> ${client.email}<br/><strong>Contrasena temporal:</strong> ${temporaryPassword}</p><p>Inicia sesion y cambia la contrasena cuanto antes.</p>`;
    const result = await sendEmail({ to: client.email, subject, text, html });
    if (result.success) {
      emailSent = true;
    } else {
      emailError = result.error;
    }
  }

  await recordAudit({
    actor,
    action: "clients:create",
    status: emailSent ? "success" : mailer ? "error" : "success",
    message: emailSent
      ? `Cliente ${client.email} registrado y correo enviado.`
      : mailer
      ? `Cliente ${client.email} registrado pero el correo fallo: ${emailError ?? "Error desconocido"}.`
      : `Cliente ${client.email} registrado (SMTP no configurado).`,
    target: { id: client.id, email: client.email }
  });

  res.status(201).json({
    success: true,
    client: toPublicUser(client),
    temporaryPassword: emailSent ? undefined : temporaryPassword,
    message: emailSent
      ? "Cliente registrado y credenciales enviadas por correo."
      : "Cliente registrado. Comparte la contrasena temporal manualmente."
  });
});

app.patch("/clients/:id", authenticate, async (req, res) => {
  const actor = req.authUser;
  if (!userHasPermission(actor, "accounts:create")) {
    await recordPermissionDenied(actor, "clients:update", "Rol sin permisos para editar clientes.", {
      clientId: req.params.id
    });
    return res.status(403).json({ success: false, error: "No tienes permisos para actualizar clientes." });
  }
  const client = await UserModel.findOne({ id: req.params.id, role: "client" });
  if (!client) {
    return res.status(404).json({ success: false, error: "Cliente no encontrado." });
  }
  if (client.ownerId && actor.role !== "photographer-admin" && client.ownerId !== actor.id) {
    await recordPermissionDenied(actor, "clients:update", "Intento de editar cliente ajeno.", {
      clientId: req.params.id,
      ownerId: client.ownerId
    });
    return res.status(403).json({ success: false, error: "No puedes editar clientes de otro fotografo." });
  }
  const { name, email, phone, bio } = req.body ?? {};
  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ success: false, error: "El nombre no puede quedar vacio." });
  }
  const nextEmail = email !== undefined ? email.trim().toLowerCase() : client.email;
  if (email !== undefined) {
    if (!isEmailValid(nextEmail)) {
      return res.status(400).json({ success: false, error: "Ingresa un correo electronico valido." });
    }
    if (nextEmail !== client.email) {
      const exists = await UserModel.exists({ email: nextEmail });
      if (exists) {
        return res
          .status(400)
          .json({ success: false, error: "Ese correo ya esta registrado en otra cuenta." });
      }
    }
  }
  if (phone !== undefined) {
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      return res.status(400).json({ success: false, error: "El telefono no puede quedar vacio." });
    }
    client.phone = trimmedPhone;
  }
  client.name = name !== undefined ? name.trim() : client.name;
  client.email = nextEmail;
  client.bio = bio !== undefined && bio.trim().length > 0 ? bio.trim() : bio === "" ? undefined : client.bio;

  addHistoryEntry(client, "profile-update", "Datos del cliente actualizados por administrador");
  await client.save();
  await recordAudit({
    actor,
    action: "clients:update",
    status: "success",
    message: `Cliente ${client.email} actualizado`,
    target: { id: client.id, email: client.email }
  });

  res.json({ success: true, client: toPublicUser(client) });
});

app.post("/clients/:id/disable", authenticate, async (req, res) => {
  const actor = req.authUser;
  if (!userHasPermission(actor, "accounts:create")) {
    await recordPermissionDenied(actor, "clients:disable", "Rol sin permisos para deshabilitar clientes.", {
      clientId: req.params.id
    });
    return res.status(403).json({ success: false, error: "No tienes permisos para deshabilitar clientes." });
  }
  const client = await UserModel.findOne({ id: req.params.id, role: "client" });
  if (!client) {
    return res.status(404).json({ success: false, error: "Cliente no encontrado." });
  }
  if (client.ownerId && actor.role !== "photographer-admin" && client.ownerId !== actor.id) {
    await recordPermissionDenied(actor, "clients:disable", "Intento de deshabilitar cliente ajeno.", {
      clientId: req.params.id,
      ownerId: client.ownerId
    });
    return res.status(403).json({ success: false, error: "No puedes deshabilitar clientes de otro fotografo." });
  }
  if (client.status === "inactive") {
    return res.json({ success: true, message: "El cliente ya estaba deshabilitado." });
  }
  client.status = "inactive";
  addHistoryEntry(client, "disable", "Cliente deshabilitado por administrador");
  await client.save();
  await recordAudit({
    actor,
    action: "clients:disable",
    status: "success",
    message: `Cliente ${client.email} deshabilitado`,
    target: { id: client.id, email: client.email }
  });
  res.json({ success: true, message: "Cliente deshabilitado correctamente." });
});

app.listen(PORT, () => {
  console.log(`[server] API escuchando en http://localhost:${PORT}`);
});

