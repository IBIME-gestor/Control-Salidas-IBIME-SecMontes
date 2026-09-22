import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase.js'

// configuracion/estancia → { horaTraslado: "13:30" }
// Hora (formato HH:MM, 24h, hora de México) a partir de la cual el panel
// del docente avisa que ya deben trasladarse a estancia los alumnos que
// no tienen pase o no salieron.
export const REF_CONFIG_ESTANCIA = () => doc(db, 'configuracion', 'estancia')

export function suscribirConfigEstancia(callback) {
  return onSnapshot(REF_CONFIG_ESTANCIA(), (snap) => {
    callback(snap.exists() ? snap.data() : { horaTraslado: '' })
  })
}

export async function guardarHoraTrasladoEstancia(horaTraslado) {
  await setDoc(REF_CONFIG_ESTANCIA(), { horaTraslado }, { merge: true })
}
