import { v4 as uuid } from "uuid";

import { ModeloUsuario } from "../modelos/index.js";
import { convertirHoraAMinutos } from "./tiempo.js";
import { generarHashContrasena } from "./seguridad.js";
import { agregarEntradaHistorial } from "./historial.js";

export const aUsuarioPublico = (usuario) => ({
  id: usuario.id,
  email: usuario.email,
  name: usuario.name,
  role: usuario.role,
  status: usuario.status,
  specialty: usuario.specialty,
  location: usuario.location,
  portfolioUrl: usuario.portfolioUrl,
  avatarUrl: usuario.avatarUrl,
  bio: usuario.bio,
  phone: usuario.phone,
  ownerId: usuario.ownerId,
  lastLoginAt: usuario.lastLoginAt,
  services: usuario.services ?? [],
  availability: usuario.availability ?? [],
  notificationPreferences: usuario.notificationPreferences ?? {},
  history: usuario.history ?? [],
  createdAt: usuario.createdAt,
  updatedAt: usuario.updatedAt
});

export const aUsuarioCompacto = (usuario) =>
  usuario
    ? {
        id: usuario.id,
        name: usuario.name,
        email: usuario.email
      }
    : undefined;

export const construirDisponibilidadBase = () =>
  [1, 2, 3, 4, 5].map((dia) => ({
    id: uuid(),
    dayOfWeek: dia,
    startTime: "09:00",
    endTime: "18:00"
  }));

export const normalizarDisponibilidad = (slots) => {
  if (!Array.isArray(slots) || slots.length === 0) {
    return { ok: true, slots: [] };
  }
  const normalizados = [];
  for (const slot of slots) {
    const dayOfWeek = Number.parseInt(slot.dayOfWeek, 10);
    const startTime = typeof slot.startTime === "string" ? slot.startTime.trim() : "";
    const endTime = typeof slot.endTime === "string" ? slot.endTime.trim() : "";
    if (Number.isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return { ok: false, error: "Dia de la semana invalido." };
    }
    const inicioMin = convertirHoraAMinutos(startTime);
    const finMin = convertirHoraAMinutos(endTime);
    if (inicioMin === null || finMin === null) {
      return { ok: false, error: "Horario invalido. Usa formato HH:MM de 24 horas." };
    }
    if (inicioMin >= finMin) {
      return { ok: false, error: "El horario de fin debe ser posterior al de inicio." };
    }
    normalizados.push({
      id: slot.id ?? uuid(),
      dayOfWeek,
      startTime,
      endTime
    });
  }
  return { ok: true, slots: normalizados };
};

export const asegurarAdministradorInicial = async () => {
  const total = await ModeloUsuario.countDocuments();
  if (total > 0) {
    return;
  }
  const contrasenaTemporal = "Demo#123";
  const hash = await generarHashContrasena(contrasenaTemporal);
  const ahora = new Date();
  await ModeloUsuario.create({
    id: "user-1",
    email: "demo@moongraphy.dev",
    name: "Demo Photographer",
    passwordHash: hash,
    role: "photographer-admin",
    status: "active",
    specialty: "Fotografia de eventos",
    location: "CDMX, MX",
    portfolioUrl: "https://moongraphy.dev/demo",
    bio: "Capturando momentos unicos para inspirar.",
    phone: "+52 55 0000 0000",
    history: [
      {
        timestamp: ahora,
        type: "register",
        summary: "Usuario demo creado automaticamente"
      }
    ],
    services: [
      {
        id: uuid(),
        title: "Sesion de ejemplo",
        status: "completed",
        createdAt: ahora,
        notes: "Evento demo generado automaticamente."
      }
    ],
    availability: construirDisponibilidadBase(),
    forcePasswordReset: true,
    createdAt: ahora,
    updatedAt: ahora
  });
  console.log("[servidor] Usuario administrador demo creado (demo@moongraphy.dev / Demo#123)");
};
