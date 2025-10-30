const PERMISOS_POR_ROL = {
  "photographer-admin": ["panel:photographer", "panel:client", "accounts:create", "actions:critical"],
  photographer: ["panel:photographer"],
  client: ["panel:client"]
};

export const esRolFotografo = (rol) => rol === "photographer" || rol === "photographer-admin";

export const obtenerPermisosDeRol = (rol) => PERMISOS_POR_ROL[rol] ?? [];

export const usuarioTienePermiso = (usuario, permiso) =>
  !!usuario && obtenerPermisosDeRol(usuario.role).includes(permiso);
