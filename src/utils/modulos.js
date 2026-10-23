// Catálogo de módulos del panel y su agrupación en categorías.
// Es el ÚNICO lugar donde se decide qué módulo vive en qué categoría:
// AdminPanel y GestionPanel solo dicen "estos módulos están disponibles"
// y armarCategorias() los acomoda (omitiendo categorías que queden vacías).

export const MODULOS = {
  estado: 'Estado de hoy',
  alertas: 'Alertas',
  disponibilidad: 'Disponibilidad',
  llegadas: 'Llegadas tarde',
  anticipada: 'Salida anticipada',
  asistencia: 'Pase de lista',
  consultar: 'Consultar',
  historial: 'Historial',
  faltas: 'Faltas',
  alumnos: 'Alumnos',
  carga: 'Cargar listado',
  horario: 'Cargar horario',
  tipos: 'Tipos de salida',
  supervisores: 'Supervisores',
  estancia: 'Estancia',
  transporte: 'Transporte',
  usuarios: 'Usuarios'
}

export const CATEGORIAS = [
  {
    id: 'hoy',
    label: 'Operación de hoy',
    descripcion: 'Lo que está pasando en el plantel en este momento.',
    modulos: ['estado', 'alertas', 'disponibilidad']
  },
  {
    id: 'registro',
    label: 'Registro diario',
    descripcion: 'Captura de retardos, salidas anticipadas y pase de lista.',
    modulos: ['llegadas', 'anticipada', 'asistencia']
  },
  {
    id: 'consultas',
    label: 'Consultas y reportes',
    descripcion: 'Busca información por fechas y descárgala en Excel o PDF.',
    modulos: ['consultar', 'historial', 'faltas']
  },
  {
    id: 'alumnos',
    label: 'Alumnos y horarios',
    descripcion: 'Fichas de alumnos y carga de listados y horarios.',
    modulos: ['alumnos', 'carga', 'horario']
  },
  {
    id: 'logistica',
    label: 'Salidas y logística',
    descripcion: 'Tipos de salida, supervisores, estancia y transporte.',
    modulos: ['tipos', 'supervisores', 'estancia', 'transporte']
  },
  {
    id: 'admin',
    label: 'Administración',
    descripcion: 'Cuentas, roles y privilegios.',
    modulos: ['usuarios']
  }
]

// idsDisponibles: arreglo de ids de módulo a los que la persona tiene acceso.
// Devuelve solo las categorías con al menos un módulo disponible.
export function armarCategorias(idsDisponibles) {
  const disponibles = new Set(idsDisponibles)
  return CATEGORIAS.map((c) => ({
    ...c,
    modulos: c.modulos.filter((m) => disponibles.has(m)).map((m) => ({ id: m, label: MODULOS[m] }))
  })).filter((c) => c.modulos.length > 0)
}
