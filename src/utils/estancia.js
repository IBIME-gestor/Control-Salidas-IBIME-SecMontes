import { doc, onSnapshot } from 'firebase/firestore'
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
