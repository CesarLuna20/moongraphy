import mongoose from "mongoose";

const EsquemaAuditoria = new mongoose.Schema(
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

export const ModeloAuditoria = mongoose.model("Audit", EsquemaAuditoria);
