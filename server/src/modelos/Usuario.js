import mongoose from "mongoose";

import {
  EsquemaEntradaHistorial,
  EsquemaServicioResumen,
  EsquemaDisponibilidad,
  EsquemaPreferenciasNotificacion
} from "./esquemasCompartidos.js";

const EsquemaUsuario = new mongoose.Schema(
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
    history: { type: [EsquemaEntradaHistorial], default: [] },
    services: { type: [EsquemaServicioResumen], default: [] },
    availability: { type: [EsquemaDisponibilidad], default: [] },
    notificationPreferences: {
      type: EsquemaPreferenciasNotificacion,
      default: () => ({})
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

export const ModeloUsuario = mongoose.model("User", EsquemaUsuario);
