import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase.js'

// seleccionDiaria/{fecha}_{correo}
//   { correo, fecha, tipo: 'grupo' | 'administrativa', grupoTipo, grupoValor }
//
// Cada docente, la primera vez que entra en el día, debe elegir con qué
// grupo termina (o "Hora administrativa" si ese día no le toca grupo). Se
// guarda una vez al día por persona para no tener que volver a preguntar
// cada vez que recarga la página.
export const COLECCION_SELECCION_DIARIA = 'seleccionDiaria'

export function idSeleccionDiaria(correo, fecha) {
  return `${fecha}_${correo}`
}

export function suscribirSeleccionDiaria(correo, fecha, callback) {
  if (!correo || !fecha) {
    callback(null)
    return () => {}
  }
  return onSnapshot(doc(db, COLECCION_SELECCION_DIARIA, idSeleccionDiaria(correo, fecha)), (snap) => {
    callback(snap.exists() ? snap.data() : null)
  })
}

export async function guardarSeleccionGrupo({ correo, fecha, grupoTipo, grupoValor }) {
  await setDoc(doc(db, COLECCION_SELECCION_DIARIA, idSeleccionDiaria(correo, fecha)), {
    correo,
    fecha,
    tipo: 'grupo',
    grupoTipo,
    grupoValor,
    timestampISO: new Date().toISOString()
  })
}

export async function guardarHoraAdministrativa({ correo, fecha }) {
  await setDoc(doc(db, COLECCION_SELECCION_DIARIA, idSeleccionDiaria(correo, fecha)), {
    correo,
    fecha,
    tipo: 'administrativa',
    grupoTipo: '',
    grupoValor: '',
    timestampISO: new Date().toISOString()
  })
}
