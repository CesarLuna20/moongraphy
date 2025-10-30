import { v4 as uuid } from "uuid";

import { ModeloAuditoria } from "../modelos/index.js";

export const registrarAuditoria = async ({ actor, action, status, message, target, metadata }) => {
  await ModeloAuditoria.create({
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

export const registrarPermisoDenegado = async (actor, action, message, metadata) =>
  registrarAuditoria({ actor, action, status: "denied", message, metadata });
