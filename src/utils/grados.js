// Secundaria tiene 3 grados. Los alumnos no traían un campo "grado", así
// que se deriva del nombre del grupo (ej. "1A", "2° B", "Tercero C") o,
// si el Excel de carga trae una columna "grado", se usa esa directamente
// (ver UploadStudents.jsx, que además lo guarda en la ficha del alumno).
export const GRADOS = ['1', '2', '3']

export const GRADO_LABELS = {
  1: '1°',
  2: '2°',
  3: '3°'
}

export function etiquetaGrado(grado) {
  return GRADO_LABELS[grado] || (grado ? `${grado}°` : 'Sin grado')
}

function normalizar(texto) {
  return String(texto || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// Devuelve '1' | '2' | '3' | '' (si no se pudo detectar).
export function obtenerGradoDeTexto(texto) {
  const t = normalizar(texto)
  if (!t) return ''
  if (/\bprimer[oa]?\b/.test(t)) return '1'
  if (/\bsegund[oa]\b/.test(t)) return '2'
  if (/\btercer[oa]?\b/.test(t)) return '3'
  // Un dígito 1-3 que no esté pegado a otro dígito ("1A", "2° B", "SEC 3 C").
  const m = t.match(/(?:^|\D)([1-3])(?:\D|$)/)
  return m ? m[1] : ''
}

export function obtenerGrado(alumno) {
  if (!alumno) return ''
  return (
    obtenerGradoDeTexto(alumno.grado) ||
    obtenerGradoDeTexto(alumno.grupoEspanol) ||
    obtenerGradoDeTexto(alumno.grupoIngles)
  )
}
