import mongoose from "mongoose";

const EsquemaInstantaneaPolitica = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    minHoursCancel: { type: Number, default: 24 },
    minHoursReschedule: { type: Number, default: 24 },
    toleranceMinutes: { type: Number, default: 0 }
  },
  { _id: false }
);

const EsquemaSesion = new mongoose.Schema(
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
    policySnapshot: { type: EsquemaInstantaneaPolitica },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

EsquemaSesion.index({ photographerId: 1, start: 1 });
EsquemaSesion.index({ clientId: 1, start: 1 });

export const ModeloSesion = mongoose.model("Session", EsquemaSesion);
export const EsquemaPoliticaSesion = EsquemaInstantaneaPolitica;
