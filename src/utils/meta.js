import { doc, setDoc, arrayUnion, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase.js'

// Un único documento con los valores distintos de tutor / grupo español /
// grupo inglés. Se actualiza SOLO al cargar el listado de alumnos (con
// arrayUnion, sin duplicados), así los filtros de la interfaz no requieren
// jamás leer la colección completa de "alumnos" (que puede tener ~650+
// documentos por plantel).
const REF_META_FILTROS = doc(db, 'meta', 'filtros')

export async function actualizarMetaFiltros({ tutores, gruposEspanol, gruposIngles }) {
  await setDoc(
    REF_META_FILTROS,
    {
      tutores: arrayUnion(...tutores),
      gruposEspanol: arrayUnion(...gruposEspanol),
      gruposIngles: arrayUnion(...gruposIngles)
    },
    { merge: true }
  )
}

// 1 sola lectura (documento único), con actualizaciones en vivo si cambia.
export function suscribirMetaFiltros(callback) {
  return onSnapshot(REF_META_FILTROS, (snap) => {
    const data = snap.data() || {}
    callback({
      tutores: (data.tutores || []).sort(),
      gruposEspanol: (data.gruposEspanol || []).sort(),
      gruposIngles: (data.gruposIngles || []).sort()
    })
  })
}

// Mismo principio, para el universo de docentes/salones del horario: se
// actualiza solo al cargar el horario (arrayUnion), así "quién está libre"
// nunca necesita escanear toda la colección "horarios".
const REF_META_HORARIO = doc(db, 'meta', 'horario')

export async function actualizarMetaHorario({ docentes, salones, dias, horas }) {
  await setDoc(
    REF_META_HORARIO,
    {
      docentes: arrayUnion(...docentes),
      salones: arrayUnion(...salones),
      dias: arrayUnion(...dias),
      horas: arrayUnion(...horas)
    },
    { merge: true }
  )
}

export function suscribirMetaHorario(callback) {
  return onSnapshot(REF_META_HORARIO, (snap) => {
    const data = snap.data() || {}
    callback({
      docentes: (data.docentes || []).sort(),
      salones: (data.salones || []).sort(),
      dias: data.dias || [],
      horas: (data.horas || []).sort()
    })
  })
}

