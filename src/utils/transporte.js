import { collection, doc, onSnapshot, setDoc, deleteDoc, getDoc } from 'firebase/firestore'
import { db } from '../firebase.js'

// rutasTransporte/{id}       → { nombre, operador }
// transporteAlumnos/{alumnoId} → { alumnoId, matricula, nombreAlumno, rutaId, rutaNombre, operador }
//
// Separado de "tiposSalida": un alumno puede salir "con transporte" como
// tipo de salida, y además (independientemente) tener una ruta y operador
// de transporte asignados, que es lo que necesita ver el coordinador de
// transporte y, de pasada, el docente al momento de la salida.
export const COLECCION_RUTAS = 'rutasTransporte'
export const COLECCION_TRANSPORTE_ALUMNOS = 'transporteAlumnos'

export function suscribirRutas(callback) {
  return onSnapshot(collection(db, COLECCION_RUTAS), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function guardarRuta({ id, nombre, operador }) {
  const ref = id ? doc(db, COLECCION_RUTAS, id) : doc(collection(db, COLECCION_RUTAS))
  await setDoc(ref, { nombre: nombre.trim(), operador: operador.trim() }, { merge: true })
  return ref.id
}

export async function eliminarRuta(id) {
  await deleteDoc(doc(db, COLECCION_RUTAS, id))
}

// Todas las asignaciones alumno→transporte (colección pequeña, se
// suscribe completa igual que tiposSalida/rutasTransporte).
export function suscribirTransporteAlumnos(callback) {
  return onSnapshot(collection(db, COLECCION_TRANSPORTE_ALUMNOS), (snap) => {
    const mapa = {}
    snap.docs.forEach((d) => (mapa[d.id] = { id: d.id, ...d.data() }))
    callback(mapa)
  })
}

export async function asignarTransporte({ alumno, ruta }) {
  await setDoc(doc(db, COLECCION_TRANSPORTE_ALUMNOS, alumno.id), {
    alumnoId: alumno.id,
    matricula: alumno.matricula,
    nombreAlumno: alumno.nombre,
    grupoEspanol: alumno.grupoEspanol || '',
    grupoIngles: alumno.grupoIngles || '',
    rutaId: ruta.id,
    rutaNombre: ruta.nombre,
    operador: ruta.operador
  })
}

export async function quitarTransporte(alumnoId) {
  await deleteDoc(doc(db, COLECCION_TRANSPORTE_ALUMNOS, alumnoId))
}

export async function buscarTransportePorAlumnoId(alumnoId) {
  const snap = await getDoc(doc(db, COLECCION_TRANSPORTE_ALUMNOS, alumnoId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}
