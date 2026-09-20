export const ESTADOS_ASISTENCIA = {
  PRESENTE: 'presente',
  AUSENTE: 'ausente',
  RETARDO: 'retardo'
}

export const ESTADO_LABELS = {
  [ESTADOS_ASISTENCIA.PRESENTE]: 'Presente',
  [ESTADOS_ASISTENCIA.AUSENTE]: 'Ausente',
  [ESTADOS_ASISTENCIA.RETARDO]: 'Retardo'
}

export const ESTADO_COLORES = {
  [ESTADOS_ASISTENCIA.PRESENTE]: 'bg-green-100 text-green-700',
  [ESTADOS_ASISTENCIA.AUSENTE]: 'bg-red-100 text-red-700',
  [ESTADOS_ASISTENCIA.RETARDO]: 'bg-amber-100 text-amber-700'
}

// El id de cada documento de asistencia es determinístico: fecha + alumno,
// así el pase de lista se puede tomar y corregir el mismo día sin duplicar
// registros (upsert con setDoc/merge).
export function idAsistencia(fecha, alumnoId) {
  return `${fecha}_${alumnoId}`
}

