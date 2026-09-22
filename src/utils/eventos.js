import { obtenerGrado } from './grados.js'

// Acciones del flujo operativo diario (equivalente a lo que ya operaba
// en el Portal de Salidas en Apps Script), más las acciones nuevas.
export const ACCIONES = {
  SALIDA: 'SALIDA',
  SALIDA_ANTICIPADA: 'SALIDA_ANTICIPADA',
  TRASLADO_ESTANCIA: 'TRASLADO_ESTANCIA',
  ENTREGADO_ESTANCIA: 'ENTREGADO_ESTANCIA',
  TRASLADO_SUPERVISION: 'TRASLADO_SUPERVISION',
  ENTREGADO_SUPERVISION: 'ENTREGADO_SUPERVISION',
  FALTA: 'FALTA',
  RETARDO: 'RETARDO'
}

export const ACCION_LABELS = {
  [ACCIONES.SALIDA]: 'Salida',
  [ACCIONES.SALIDA_ANTICIPADA]: 'Salida anticipada',
  [ACCIONES.TRASLADO_ESTANCIA]: 'Traslado a estancia',
  [ACCIONES.ENTREGADO_ESTANCIA]: 'Entregado en estancia',
  [ACCIONES.TRASLADO_SUPERVISION]: 'Traslado a supervisión',
  [ACCIONES.ENTREGADO_SUPERVISION]: 'Entregado en supervisión',
  [ACCIONES.FALTA]: 'Falta',
  [ACCIONES.RETARDO]: 'Retardo'
}

// Acciones que, si ya ocurrieron hoy, significan que el alumno YA NO está
// en el plantel para cuando llegue la salida normal con el docente.
export const ACCIONES_YA_SALIO = [ACCIONES.SALIDA, ACCIONES.SALIDA_ANTICIPADA]

// Acciones que describen DÓNDE está el alumno durante la salida (excluye
// FALTA y RETARDO, que son de la mañana y no de la salida). El último
// evento de este tipo en el día es el "estado actual" del alumno; si no
// hay ninguno (y no está ausente), se considera automáticamente "En aula".
export const ACCIONES_MOVIMIENTO = [
  ACCIONES.SALIDA,
  ACCIONES.SALIDA_ANTICIPADA,
  ACCIONES.TRASLADO_ESTANCIA,
  ACCIONES.ENTREGADO_ESTANCIA,
  ACCIONES.TRASLADO_SUPERVISION,
  ACCIONES.ENTREGADO_SUPERVISION
]

// Acciones que se muestran como botones rápidos en el panel de docente.
// FALTA se maneja aparte porque pide un motivo; SALIDA_ANTICIPADA no la
// otorga el docente, sino recepción/supervisión/tutoría/contraloría/dirección.
export const ACCIONES_RAPIDAS = [
  ACCIONES.SALIDA,
  ACCIONES.TRASLADO_ESTANCIA,
  ACCIONES.ENTREGADO_ESTANCIA,
  ACCIONES.TRASLADO_SUPERVISION,
  ACCIONES.ENTREGADO_SUPERVISION
]

// Categorías fijas de tipo de salida (mismas que el sistema anterior),
// usadas para ordenar el tablero de "estado de hoy" de forma consistente.
export const CATEGORIAS_SALIDA = [
  'TRANSPORTE',
  'COMEDOR',
  'TALLER',
  'NIVELACION',
  'GYM',
  'CASO',
  'EN_AULA',
  'SIN_REGISTRO'
]

export const CATEGORIA_LABELS = {
  TRANSPORTE: 'Transporte',
  COMEDOR: 'Comedor',
  TALLER: 'Taller',
  NIVELACION: 'Nivelación',
  GYM: 'Gimnasio',
  CASO: 'Caso especial',
  EN_AULA: 'En aula',
  SIN_REGISTRO: 'Sin registro'
}

export function fechaHoyISO(hoy = new Date()) {
  const y = hoy.getFullYear()
  const m = String(hoy.getMonth() + 1).padStart(2, '0')
  const d = String(hoy.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Mismos nombres que DIAS_SEMANA en roles.js (con acento en Miércoles), para
// poder comparar contra alumno.diasSalida y las asignaciones de estancia.
export function nombreDiaHoy(fecha = new Date()) {
  return ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][fecha.getDay()]
}

// Crea un evento inmutable en la colección "eventos" (bitácora diaria).
// Se reutiliza desde los botones de acción del docente, el pase de lista,
// llegadas tarde y salidas anticipadas, para que todos los flujos
// alimenten la misma bitácora y el mismo "estado de hoy".
// "extra" permite agregar campos propios de un tipo de evento en
// particular (por ejemplo, personaRecoge en una salida anticipada) sin
// tener que tocar la forma general de la función.
// Arma el documento de un evento sin escribirlo. Así se puede usar tanto
// con addDoc (un evento suelto) como dentro de un writeBatch (varios
// alumnos a la vez, ver utils/salidas.js), garantizando la misma forma.
export function armarEvento({ alumno, accion, motivo = '', autorUid, autorNombre, extra = {}, ahora = new Date() }) {
  return {
    alumnoId: alumno.id,
    matricula: alumno.matricula,
    nombreAlumno: alumno.nombre,
    grado: obtenerGrado(alumno),
    grupoEspanol: alumno.grupoEspanol || '',
    grupoIngles: alumno.grupoIngles || '',
    tutor: alumno.tutor || '',
    tipoSalidaId: alumno.tipoSalidaId || null,
    accion,
    motivo,
    fecha: fechaHoyISO(ahora),
    hora: ahora.toTimeString().slice(0, 8),
    timestampISO: ahora.toISOString(),
    autorUid: autorUid || null,
    autorNombre: autorNombre || '',
    ...extra
  }
}

export async function crearEvento({ db, addDoc, collection, alumno, accion, motivo = '', autorUid, autorNombre, extra = {} }) {
  return addDoc(
    collection(db, 'eventos'),
    armarEvento({ alumno, accion, motivo, autorUid, autorNombre, extra })
  )
}

// Reconstruye un "alumno" mínimo a partir de un evento ya guardado (lo usa
// la vista de estancia, que trabaja con eventos y no con la ficha completa).
export function alumnoDesdeEvento(e) {
  return {
    id: e.alumnoId,
    matricula: e.matricula,
    nombre: e.nombreAlumno,
    grado: e.grado || '',
    grupoEspanol: e.grupoEspanol || '',
    grupoIngles: e.grupoIngles || '',
    tutor: e.tutor || '',
    tipoSalidaId: e.tipoSalidaId || null
  }
}

// De una lista de eventos ordenada ASC por timestampISO devuelve, por
// alumno, su último evento de movimiento del día (ver ACCIONES_MOVIMIENTO).
export function ultimoMovimientoPorAlumno(eventos) {
  const mapa = {}
  eventos.forEach((e) => {
    if (ACCIONES_MOVIMIENTO.includes(e.accion)) mapa[e.alumnoId] = e
  })
  return mapa
}

export function ordenarPorCategoria(lista, obtenerCategoria) {
  return [...lista].sort((a, b) => {
    const ia = CATEGORIAS_SALIDA.indexOf(obtenerCategoria(a))
    const ib = CATEGORIAS_SALIDA.indexOf(obtenerCategoria(b))
    const oa = ia === -1 ? 99 : ia
    const ob = ib === -1 ? 99 : ib
    return oa - ob
  })
}
