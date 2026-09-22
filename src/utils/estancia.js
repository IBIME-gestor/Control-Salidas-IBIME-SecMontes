import { collection, doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase.js'

// asignacionesEstancia/{correo}
//   { correo, nombre, turnos: [{ id, dias: ['Lunes',...], salon, grados: ['1','2','3'] }] }
//
// Un mismo profe de estancia puede tener varios turnos (por ejemplo,
// distinto salón o grado según el día), así que se guarda como arreglo.
export const COLECCION_ASIGNACIONES_ESTANCIA = 'asignacionesEstancia'

export function refAsignacionEstancia(correo) {
  return doc(db, COLECCION_ASIGNACIONES_ESTANCIA, correo)
}

export function suscribirAsignacionEstancia(correo, callback) {
  if (!correo) {
    callback(null)
    return () => {}
  }
  return onSnapshot(refAsignacionEstancia(correo), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  })
}

// Turno(s) de un profe que aplican HOY (coincide el día de la semana).
export function turnosDeHoy(asignacion, dia) {
  if (!asignacion) return []
  return (asignacion.turnos || []).filter((t) => (t.dias || []).includes(dia))
}

// Todos los grados que ese profe recibe hoy, entre todos sus turnos de hoy.
export function gradosDeHoy(asignacion, dia) {
  const turnos = turnosDeHoy(asignacion, dia)
  return [...new Set(turnos.flatMap((t) => t.grados || []))]
}

// Dado un grado, encuentra en qué salón le toca hoy (el primer turno de
// hoy que incluya ese grado). Si el profe tiene dos turnos hoy con el
// mismo grado en salones distintos (caso raro), se usa el primero.
export function salonParaGradoHoy(asignacion, dia, grado) {
  const turno = turnosDeHoy(asignacion, dia).find((t) => (t.grados || []).includes(grado))
  return turno?.salon || ''
}

// Todas las asignaciones de estancia (colección pequeña: un puñado de
// profes con sus turnos), usada por el docente para saber a qué salón le
// toca trasladar a cada grado hoy, sin saber de antemano a quién.
export function suscribirTodasAsignacionesEstancia(callback) {
  return onSnapshot(collection(db, COLECCION_ASIGNACIONES_ESTANCIA), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

// Busca, entre TODAS las asignaciones de estancia, el salón que hoy
// recibe un grado dado. Devuelve '' si nadie tiene ese grado hoy.
export function salonParaGradoHoyEntreTodas(asignaciones, dia, grado) {
  for (const a of asignaciones || []) {
    const salon = salonParaGradoHoy(a, dia, grado)
    if (salon) return salon
  }
  return ''
}
