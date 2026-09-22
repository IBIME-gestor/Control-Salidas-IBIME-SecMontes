// Roles del sistema.
// Un usuario puede tener uno o VARIOS roles a la vez (perfil.roles = []).
// Cada rol trae un paquete de privilegios por defecto (PERMISOS_POR_ROL),
// pero el administrador puede después prender o apagar cada privilegio de
// forma individual para una persona en particular, sin importar su rol
// (ver perfil.permisos, que siempre se guarda ya "expandido").
//
//   - Colaborador     → solo CONSULTA alumnos y grupos (rol por defecto
//                       para cualquiera que entre por primera vez)
//   - Tutoría         → además, pasa lista (asistencia de sus alumnos)
//   - Recepción       → además, registra retardos y salidas anticipadas
//   - Supervisión     → además, registra retardos y salidas anticipadas
//   - Dirección       → consulta ampliada (estado, alertas, historial...)
//   - Contraloría     → consulta ampliada (estado, alertas, historial...)
//   - Docente         → registra la salida normal de su propio grupo
//                       (panel aparte, no usa el sistema de permisos)
//   - Administrador   → acceso total, siempre, sin excepción
export const ROLES = {
  ADMIN: 'administrador',
  DIRECCION: 'direccion',
  SUPERVISION: 'supervision',
  RECEPCION: 'recepcion',
  TUTORIA: 'tutoria',
  CONTRALORIA: 'contraloria',
  DOCENTE: 'docente',
  ESTANCIA: 'estancia',
  TRANSPORTE: 'transporte',
  COLABORADOR: 'colaborador'
}

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.DIRECCION]: 'Dirección',
  [ROLES.SUPERVISION]: 'Supervisión',
  [ROLES.RECEPCION]: 'Recepción',
  [ROLES.TUTORIA]: 'Tutoría',
  [ROLES.CONTRALORIA]: 'Contraloría',
  [ROLES.DOCENTE]: 'Docente',
  [ROLES.ESTANCIA]: 'Estancia',
  [ROLES.TRANSPORTE]: 'Coordinador de transporte',
  [ROLES.COLABORADOR]: 'Colaborador'
}

// Rol que recibe cualquier cuenta @dominio la PRIMERA vez que entra con
// Google, sin que nadie la haya dado de alta a mano (ver AuthContext.jsx).
// La mayoría del personal que entra por primera vez es docente operando
// la salida de su grupo, así que ese es el rol por defecto (antes era
// "colaborador"); el administrador puede cambiarlo después sin problema.
export const ROL_AUTOAPROVISIONAMIENTO = ROLES.DOCENTE

// Roles que se asignan y combinan con el sistema de permisos (todo menos
// admin y docente, que tienen su propio panel dedicado y su propia
// lógica de acceso).
export const ROLES_PANEL_PRIVILEGIOS = [
  ROLES.COLABORADOR,
  ROLES.DIRECCION,
  ROLES.SUPERVISION,
  ROLES.RECEPCION,
  ROLES.TUTORIA,
  ROLES.CONTRALORIA
]

// Catálogo de privilegios individuales. Cada uno se puede prender/apagar
// por usuario desde "Usuarios" en el panel de administrador.
export const PERMISOS = {
  VER_ALUMNOS: 'verAlumnos',
  VER_ESTADO: 'verEstado',
  VER_ALERTAS: 'verAlertas',
  VER_DISPONIBILIDAD: 'verDisponibilidad',
  VER_HISTORIAL: 'verHistorial',
  VER_FALTAS: 'verFaltas',
  TOMAR_ASISTENCIA: 'tomarAsistencia',
  CAPTURAR_RETARDOS: 'capturarRetardos',
  SALIDA_ANTICIPADA: 'salidaAnticipada',
  EDITAR_ALUMNOS: 'editarAlumnos',
  GESTIONAR_TIPOS_SALIDA: 'gestionarTiposSalida',
  GESTIONAR_SUPERVISORES: 'gestionarSupervisores',
  CARGAR_LISTADO: 'cargarListado',
  CARGAR_HORARIO: 'cargarHorario',
  ADMINISTRAR_USUARIOS: 'administrarUsuarios'
}

export const PERMISO_LABELS = {
  [PERMISOS.VER_ALUMNOS]: 'Ver alumnos y grupos',
  [PERMISOS.VER_ESTADO]: 'Ver estado de hoy',
  [PERMISOS.VER_ALERTAS]: 'Ver alertas de asistencia',
  [PERMISOS.VER_DISPONIBILIDAD]: 'Ver disponibilidad de horario',
  [PERMISOS.VER_HISTORIAL]: 'Ver historial de eventos',
  [PERMISOS.VER_FALTAS]: 'Ver faltas',
  [PERMISOS.TOMAR_ASISTENCIA]: 'Tomar pase de lista',
  [PERMISOS.CAPTURAR_RETARDOS]: 'Capturar llegadas tarde',
  [PERMISOS.SALIDA_ANTICIPADA]: 'Otorgar salida anticipada',
  [PERMISOS.EDITAR_ALUMNOS]: 'Editar ficha de alumnos',
  [PERMISOS.GESTIONAR_TIPOS_SALIDA]: 'Administrar tipos de salida',
  [PERMISOS.GESTIONAR_SUPERVISORES]: 'Administrar supervisores',
  [PERMISOS.CARGAR_LISTADO]: 'Cargar listado de alumnos',
  [PERMISOS.CARGAR_HORARIO]: 'Cargar horario',
  [PERMISOS.ADMINISTRAR_USUARIOS]: 'Administrar usuarios'
}


const CONSULTA_BASICA = [PERMISOS.VER_ALUMNOS]
const CONSULTA_AMPLIADA = [
  PERMISOS.VER_ALUMNOS,
  PERMISOS.VER_ESTADO,
  PERMISOS.VER_ALERTAS,
  PERMISOS.VER_DISPONIBILIDAD,
  PERMISOS.VER_HISTORIAL,
  PERMISOS.VER_FALTAS
]

// Privilegios por DEFECTO al asignar cada rol. Son solo el punto de
// partida: el administrador puede editar cada casilla después para una
// persona en particular (perfil.permisos siempre se guarda ya resuelto).
export const PERMISOS_POR_ROL = {
  [ROLES.COLABORADOR]: CONSULTA_BASICA,
  [ROLES.DIRECCION]: CONSULTA_AMPLIADA,
  [ROLES.CONTRALORIA]: CONSULTA_AMPLIADA,
  [ROLES.SUPERVISION]: [...CONSULTA_AMPLIADA, PERMISOS.CAPTURAR_RETARDOS, PERMISOS.SALIDA_ANTICIPADA],
  [ROLES.RECEPCION]: [...CONSULTA_AMPLIADA, PERMISOS.CAPTURAR_RETARDOS, PERMISOS.SALIDA_ANTICIPADA],
  [ROLES.TUTORIA]: [...CONSULTA_AMPLIADA, PERMISOS.TOMAR_ASISTENCIA],
  [ROLES.DOCENTE]: [],
  // Estancia, igual que Docente, es un panel aparte con su propia lógica
  // de acceso (ver EstanciaPanel.jsx): no usa el sistema de privilegios.
  [ROLES.ESTANCIA]: [],
  // Transporte, igual que Docente/Estancia, es un panel aparte (ver
  // TransportePanel.jsx): no usa el sistema de privilegios.
  [ROLES.TRANSPORTE]: [],
  [ROLES.ADMIN]: Object.values(PERMISOS)
}

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

// Normaliza perfil.roles: soporta el campo nuevo (arreglo) y, para no
// romper datos viejos, el campo antiguo singular `rol`.
export function getRoles(perfil) {
  if (!perfil) return []
  if (Array.isArray(perfil.roles) && perfil.roles.length) return perfil.roles
  if (perfil.rol) return [perfil.rol]
  return []
}

// Calcula el paquete de permisos por defecto para un conjunto de roles
// (la unión de lo que trae cada uno). Se usa como punto de partida al
// asignar roles nuevos en el panel de Usuarios.
export function permisosPorDefecto(roles = []) {
  const set = new Set()
  roles.forEach((r) => (PERMISOS_POR_ROL[r] || []).forEach((p) => set.add(p)))
  const resultado = {}
  Object.values(PERMISOS).forEach((p) => {
    resultado[p] = set.has(p)
  })
  return resultado
}

export function esAdmin(perfil) {
  return getRoles(perfil).includes(ROLES.ADMIN)
}

export function esDocente(perfil) {
  return getRoles(perfil).includes(ROLES.DOCENTE)
}

export function esEstancia(perfil) {
  return getRoles(perfil).includes(ROLES.ESTANCIA)
}

export function esTransporte(perfil) {
  return getRoles(perfil).includes(ROLES.TRANSPORTE)
}

// Un docente puede tener asignado más de un grupo (por ejemplo, si da
// clase a varios grupos y necesita elegir con cuál termina el día antes
// de registrar la salida). Se guarda como perfil.gruposAsignados = [{
// tipo: 'grupoEspanol'|'grupoIngles', valor }]. Por compatibilidad con
// cuentas dadas de alta antes de este cambio, si no existe ese arreglo se
// arma uno de un solo elemento a partir de los campos viejos
// grupoAsignado/tipoGrupoAsignado.
export function getGruposAsignados(perfil) {
  if (!perfil) return []
  if (Array.isArray(perfil.gruposAsignados) && perfil.gruposAsignados.length) {
    return perfil.gruposAsignados
  }
  if (perfil.grupoAsignado) {
    return [{ tipo: perfil.tipoGrupoAsignado || 'grupoEspanol', valor: perfil.grupoAsignado }]
  }
  return []
}

// Único punto de verdad del lado del cliente: ¿esta persona tiene
// prendido este privilegio? El administrador siempre tiene todos.
// perfil.permisos ya viene "expandido" (todas las llaves, true/false)
// desde ManageUsers, así que aquí solo se lee tal cual.
export function tienePermiso(perfil, permiso) {
  if (!perfil) return false
  if (esAdmin(perfil)) return true
  return !!(perfil.permisos && perfil.permisos[permiso])
}

export function puedeEditarAlumnos(perfil) {
  return tienePermiso(perfil, PERMISOS.EDITAR_ALUMNOS)
}

export function puedeGestionarTiposSalida(perfil) {
  return tienePermiso(perfil, PERMISOS.GESTIONAR_TIPOS_SALIDA)
}

export function puedeTomarAsistencia(perfil) {
  return tienePermiso(perfil, PERMISOS.TOMAR_ASISTENCIA)
}

export function puedeCapturarRetardos(perfil) {
  return tienePermiso(perfil, PERMISOS.CAPTURAR_RETARDOS)
}

export function puedeOtorgarSalidaAnticipada(perfil) {
  return tienePermiso(perfil, PERMISOS.SALIDA_ANTICIPADA)
}
