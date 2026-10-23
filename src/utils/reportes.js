import { collection, getDocs, query, where } from 'firebase/firestore'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { db } from '../firebase.js'
import { ACCIONES, CATEGORIA_LABELS } from './eventos.js'
import { ESTADOS_ASISTENCIA } from './asistencia.js'
import { COLECCION_SALIDA, DOC_SALIDA } from './salidas.js'

export const TIPOS_REPORTE = {
  retardos: { label: 'Retardos', descripcion: 'Alumnos que llegaron tarde' },
  inasistencias: { label: 'Inasistencias', descripcion: 'Faltas registradas (pase de lista y docentes)' },
  asistencias: { label: 'Asistencias', descripcion: 'Resumen de asistencia por alumno' },
  salidasPase: { label: 'Salidas con pase', descripcion: 'Salidas cuyo tipo requiere pase' }
}

// Tope de días por consulta: protege las lecturas de Firestore.
export const MAX_DIAS_RANGO = 93

// ---------------------------------------------------------------------
// Fechas (siempre en hora local, formato ISO yyyy-mm-dd, igual que el
// resto de la app)
// ---------------------------------------------------------------------
function aFecha(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function aISO(f) {
  const y = f.getFullYear()
  const m = String(f.getMonth() + 1).padStart(2, '0')
  const d = String(f.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatearFecha(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function diasDelRango(desde, hasta) {
  const dias = []
  const fin = aFecha(hasta)
  for (let f = aFecha(desde); f <= fin; f.setDate(f.getDate() + 1)) dias.push(aISO(f))
  return dias
}

export function diasHabiles(desde, hasta, diasSinClases = []) {
  const excluidos = new Set(diasSinClases)
  return diasDelRango(desde, hasta).filter((iso) => {
    const dow = aFecha(iso).getDay()
    return dow !== 0 && dow !== 6 && !excluidos.has(iso)
  })
}

export function validarRango(desde, hasta) {
  if (!desde || !hasta) return 'Elige la fecha inicial y la final.'
  if (desde > hasta) return 'La fecha inicial no puede ser posterior a la final.'
  if (diasDelRango(desde, hasta).length > MAX_DIAS_RANGO) {
    return `El rango máximo es de ${MAX_DIAS_RANGO} días. Divide la consulta en periodos más cortos.`
  }
  return ''
}

// ---------------------------------------------------------------------
// Filtros comunes (se aplican en el navegador sobre lo ya traído, así no
// hacen falta índices compuestos nuevos para cada combinación)
// ---------------------------------------------------------------------
function pasaFiltros(r, { tutor, grupoEspanol, grupoIngles, texto }) {
  if (tutor && r.tutor !== tutor) return false
  if (grupoEspanol && r.grupoEspanol !== grupoEspanol) return false
  if (grupoIngles && r.grupoIngles !== grupoIngles) return false
  if (texto) {
    const t = texto.trim().toLowerCase()
    if (
      !String(r.nombreAlumno || '').toLowerCase().includes(t) &&
      !String(r.matricula || '').toLowerCase().includes(t)
    ) {
      return false
    }
  }
  return true
}

function ordenar(filas) {
  return filas.sort(
    (a, b) =>
      String(a.fecha || '').localeCompare(String(b.fecha || '')) ||
      String(a.hora || '').localeCompare(String(b.hora || '')) ||
      String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')
  )
}

async function asistenciaDelRango(desde, hasta) {
  // Un solo campo con rango → usa el índice automático, sin índice nuevo.
  const q = query(collection(db, 'asistencia'), where('fecha', '>=', desde), where('fecha', '<=', hasta))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// ---------------------------------------------------------------------
// Definición de columnas por reporte (key → campo de la fila, label →
// encabezado en pantalla / Excel / PDF)
// ---------------------------------------------------------------------
export const COLUMNAS = {
  retardos: [
    { key: 'fechaTxt', label: 'Fecha' },
    { key: 'hora', label: 'Hora de llegada' },
    { key: 'matricula', label: 'Matrícula' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'grupoEspanol', label: 'Grupo español' },
    { key: 'grupoIngles', label: 'Grupo inglés' },
    { key: 'tutor', label: 'Tutor' },
    { key: 'registro', label: 'Registró' }
  ],
  inasistencias: [
    { key: 'fechaTxt', label: 'Fecha' },
    { key: 'matricula', label: 'Matrícula' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'grupoEspanol', label: 'Grupo español' },
    { key: 'grupoIngles', label: 'Grupo inglés' },
    { key: 'tutor', label: 'Tutor' },
    { key: 'motivo', label: 'Motivo' },
    { key: 'registro', label: 'Registró' }
  ],
  asistencias: [
    { key: 'matricula', label: 'Matrícula' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'grupoEspanol', label: 'Grupo español' },
    { key: 'grupoIngles', label: 'Grupo inglés' },
    { key: 'tutor', label: 'Tutor' },
    { key: 'diasHabiles', label: 'Días hábiles' },
    { key: 'asistencias', label: 'Asistencias' },
    { key: 'retardos', label: 'Retardos' },
    { key: 'faltas', label: 'Faltas' },
    { key: 'porcentaje', label: '% asistencia' }
  ],
  salidasPase: [
    { key: 'fechaTxt', label: 'Fecha' },
    { key: 'hora', label: 'Hora' },
    { key: 'matricula', label: 'Matrícula' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'grupoEspanol', label: 'Grupo español' },
    { key: 'grupoIngles', label: 'Grupo inglés' },
    { key: 'tipoSalida', label: 'Tipo de salida' },
    { key: 'categoria', label: 'Categoría' },
    { key: 'programada', label: 'Programada ese día' },
    { key: 'registro', label: 'Registró (docente)' }
  ]
}

// ---------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------
async function consultarRetardos({ desde, hasta, filtros }) {
  const docs = await asistenciaDelRango(desde, hasta)
  const filas = docs
    .filter((a) => a.estado === ESTADOS_ASISTENCIA.RETARDO)
    .map((a) => ({
      fecha: a.fecha,
      fechaTxt: formatearFecha(a.fecha),
      hora: a.horaLlegada || '',
      alumnoId: a.alumnoId,
      matricula: a.matricula,
      nombreAlumno: a.nombreAlumno,
      nombre: a.nombreAlumno,
      grupoEspanol: a.grupoEspanol || '',
      grupoIngles: a.grupoIngles || '',
      tutor: a.tutor || '',
      registro: a.registradoPorNombre || ''
    }))
    .filter((r) => pasaFiltros(r, filtros))
  return { filas: ordenar(filas), avisos: [] }
}

async function consultarInasistencias({ desde, hasta, filtros }) {
  const avisos = []
  const docs = await asistenciaDelRango(desde, hasta)

  // clave fecha_alumno → fila. La asistencia manda: si ahí el alumno quedó
  // como presente/retardo (corrección posterior), NO cuenta como falta.
  const mapa = new Map()
  const corregidos = new Set()
  docs.forEach((a) => {
    const clave = `${a.fecha}_${a.alumnoId}`
    if (a.estado === ESTADOS_ASISTENCIA.AUSENTE) {
      mapa.set(clave, {
        fecha: a.fecha,
        fechaTxt: formatearFecha(a.fecha),
        alumnoId: a.alumnoId,
        matricula: a.matricula,
        nombre: a.nombreAlumno,
        nombreAlumno: a.nombreAlumno,
        grupoEspanol: a.grupoEspanol || '',
        grupoIngles: a.grupoIngles || '',
        tutor: a.tutor || '',
        motivo: 'Registrada en el pase de lista',
        registro: a.registradoPorNombre || ''
      })
    } else {
      corregidos.add(clave)
    }
  })

  // Faltas que algún docente capturó solo como evento (no pasan por la
  // colección "asistencia"). Requiere el índice eventos(accion, fecha).
  try {
    const qe = query(
      collection(db, 'eventos'),
      where('accion', '==', ACCIONES.FALTA),
      where('fecha', '>=', desde),
      where('fecha', '<=', hasta)
    )
    const snap = await getDocs(qe)
    snap.docs.forEach((d) => {
      const e = d.data()
      const clave = `${e.fecha}_${e.alumnoId}`
      if (corregidos.has(clave)) return
      if (mapa.has(clave)) {
        // Ya viene del pase de lista: solo enriquecer el motivo si trae uno propio.
        if (e.motivo && !/pase de lista/i.test(e.motivo)) mapa.get(clave).motivo = e.motivo
        return
      }
      mapa.set(clave, {
        fecha: e.fecha,
        fechaTxt: formatearFecha(e.fecha),
        hora: e.hora || '',
        alumnoId: e.alumnoId,
        matricula: e.matricula,
        nombre: e.nombreAlumno,
        nombreAlumno: e.nombreAlumno,
        grupoEspanol: e.grupoEspanol || '',
        grupoIngles: e.grupoIngles || '',
        tutor: e.tutor || '',
        motivo: e.motivo || '',
        registro: e.autorNombre || ''
      })
    })
  } catch (err) {
    console.error(err)
    avisos.push(
      'No se pudieron leer las faltas capturadas por docentes (falta desplegar el índice nuevo de Firestore: firebase deploy --only firestore:indexes). Se muestran solo las del pase de lista.'
    )
  }

  const filas = [...mapa.values()].filter((r) => pasaFiltros(r, filtros))
  return { filas: ordenar(filas), avisos }
}

async function consultarAsistencias({ desde, hasta, filtros, diasSinClases }) {
  const habiles = diasHabiles(desde, hasta, diasSinClases)
  const setHabiles = new Set(habiles)
  const avisos = []
  if (habiles.length === 0) {
    return { filas: [], avisos: ['El rango elegido no incluye ningún día hábil (lunes a viernes).'] }
  }

  // Universo de alumnos. Si hay filtro de tutor/grupo se trae solo ese
  // subconjunto (consulta por igualdad, índice automático).
  const base = collection(db, 'alumnos')
  let qa = base
  if (filtros.tutor) qa = query(base, where('tutor', '==', filtros.tutor))
  else if (filtros.grupoEspanol) qa = query(base, where('grupoEspanol', '==', filtros.grupoEspanol))
  else if (filtros.grupoIngles) qa = query(base, where('grupoIngles', '==', filtros.grupoIngles))
  const [alumnosSnap, asistencia] = await Promise.all([getDocs(qa), asistenciaDelRango(desde, hasta)])

  const porAlumno = {}
  asistencia.forEach((a) => {
    if (!setHabiles.has(a.fecha)) return
    const r = (porAlumno[a.alumnoId] ||= { faltas: 0, retardos: 0 })
    if (a.estado === ESTADOS_ASISTENCIA.AUSENTE) r.faltas += 1
    else if (a.estado === ESTADOS_ASISTENCIA.RETARDO) r.retardos += 1
  })

  const filas = alumnosSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .map((al) => {
      const r = porAlumno[al.id] || { faltas: 0, retardos: 0 }
      const asist = habiles.length - r.faltas
      return {
        matricula: al.matricula || al.id,
        nombreAlumno: al.nombre,
        nombre: al.nombre,
        grupoEspanol: al.grupoEspanol || '',
        grupoIngles: al.grupoIngles || '',
        tutor: al.tutor || '',
        diasHabiles: habiles.length,
        asistencias: asist,
        retardos: r.retardos,
        faltas: r.faltas,
        porcentaje: `${Math.round((asist / habiles.length) * 1000) / 10}%`
      }
    })
    .filter((r) => pasaFiltros(r, filtros))
    .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'))

  avisos.push(
    `Se consideraron ${habiles.length} días hábiles (lunes a viernes${diasSinClases.length ? ', sin los días marcados como sin clases' : ''}). Un alumno sin registro de ausencia cuenta como asistente; los retardos cuentan como asistencia.`
  )
  return { filas, avisos }
}

async function consultarSalidasPase({ desde, hasta, filtros, incluirTodas }) {
  // salida/registro/{fecha}/{alumno}: una subcolección por día, así que se
  // lee día por día (solo días hábiles; en lotes para no saturar).
  const dias = diasDelRango(desde, hasta).filter((iso) => {
    const dow = aFecha(iso).getDay()
    return dow !== 0 && dow !== 6
  })
  const registros = []
  for (let i = 0; i < dias.length; i += 8) {
    const lote = dias.slice(i, i + 8)
    const snaps = await Promise.all(
      lote.map((fecha) => getDocs(collection(db, COLECCION_SALIDA, DOC_SALIDA, fecha)))
    )
    snaps.forEach((snap) => snap.docs.forEach((d) => registros.push({ id: d.id, ...d.data() })))
  }

  const filas = registros
    .filter((s) => incluirTodas || s.requierePase)
    .map((s) => ({
      fecha: s.fecha,
      fechaTxt: formatearFecha(s.fecha),
      hora: s.hora || '',
      alumnoId: s.alumnoId,
      matricula: s.matricula,
      nombre: s.nombreAlumno,
      nombreAlumno: s.nombreAlumno,
      grupoEspanol: s.grupoEspanol || '',
      grupoIngles: s.grupoIngles || '',
      tutor: s.tutor || '',
      tipoSalida: s.tipoSalidaNombre || 'Sin tipo asignado',
      categoria: CATEGORIA_LABELS[s.categoria] || s.categoria || '',
      programada: s.programadaHoy ? 'Sí' : 'No',
      registro: s.docenteNombre || s.docenteCorreo || ''
    }))
    .filter((r) => pasaFiltros(r, filtros))
  return { filas: ordenar(filas), avisos: [] }
}

export async function ejecutarConsulta(tipo, opciones) {
  switch (tipo) {
    case 'retardos':
      return consultarRetardos(opciones)
    case 'inasistencias':
      return consultarInasistencias(opciones)
    case 'asistencias':
      return consultarAsistencias(opciones)
    case 'salidasPase':
      return consultarSalidasPase(opciones)
    default:
      return { filas: [], avisos: [] }
  }
}

// Resumen por alumno (hoja extra del Excel y tarjeta en pantalla) para los
// reportes que son una lista de eventos.
export function resumenPorAlumno(filas) {
  const mapa = {}
  filas.forEach((f) => {
    const k = f.alumnoId || f.matricula
    const r = (mapa[k] ||= {
      matricula: f.matricula,
      nombre: f.nombre,
      grupoEspanol: f.grupoEspanol,
      grupoIngles: f.grupoIngles,
      tutor: f.tutor,
      total: 0
    })
    r.total += 1
  })
  return Object.values(mapa).sort((a, b) => b.total - a.total || String(a.nombre).localeCompare(String(b.nombre), 'es'))
}

// ---------------------------------------------------------------------
// Exportación
// ---------------------------------------------------------------------
function nombreArchivo(tipo, desde, hasta, ext) {
  return `reporte_${tipo}_${desde}_a_${hasta}.${ext}`
}

function matrizDesdeFilas(tipo, filas) {
  const cols = COLUMNAS[tipo]
  return { cabecera: cols.map((c) => c.label), cuerpo: filas.map((f) => cols.map((c) => f[c.key] ?? '')) }
}

export function descripcionFiltros({ desde, hasta, filtros, tipo, diasSinClases = [], incluirTodas }) {
  const partes = [`Periodo: ${formatearFecha(desde)} al ${formatearFecha(hasta)}`]
  if (filtros.tutor) partes.push(`Tutor: ${filtros.tutor}`)
  if (filtros.grupoEspanol) partes.push(`Grupo español: ${filtros.grupoEspanol}`)
  if (filtros.grupoIngles) partes.push(`Grupo inglés: ${filtros.grupoIngles}`)
  if (filtros.texto) partes.push(`Búsqueda: ${filtros.texto}`)
  if (tipo === 'asistencias' && diasSinClases.length) {
    partes.push(`Días sin clases: ${diasSinClases.map(formatearFecha).join(', ')}`)
  }
  if (tipo === 'salidasPase' && incluirTodas) partes.push('Incluye salidas sin pase')
  return partes
}

export function exportarExcel({ tipo, filas, desde, hasta, descripcion }) {
  const { cabecera, cuerpo } = matrizDesdeFilas(tipo, filas)
  const titulo = `Reporte de ${TIPOS_REPORTE[tipo].label.toLowerCase()} — IBIME`
  const hoja = XLSX.utils.aoa_to_sheet([
    [titulo],
    ...descripcion.map((d) => [d]),
    [`Generado: ${new Date().toLocaleString('es-MX')}`],
    [`Total de registros: ${filas.length}`],
    [],
    cabecera,
    ...cuerpo
  ])
  hoja['!cols'] = cabecera.map((c, i) => ({
    wch: Math.min(40, Math.max(c.length, ...cuerpo.map((r) => String(r[i] ?? '').length)) + 2)
  }))

  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, 'Detalle')

  if (tipo !== 'asistencias' && filas.length) {
    const resumen = resumenPorAlumno(filas)
    const h2 = XLSX.utils.aoa_to_sheet([
      ['Matrícula', 'Nombre', 'Grupo español', 'Grupo inglés', 'Tutor', 'Total'],
      ...resumen.map((r) => [r.matricula, r.nombre, r.grupoEspanol, r.grupoIngles, r.tutor, r.total])
    ])
    h2['!cols'] = [{ wch: 14 }, { wch: 36 }, { wch: 14 }, { wch: 14 }, { wch: 28 }, { wch: 8 }]
    XLSX.utils.book_append_sheet(libro, h2, 'Resumen por alumno')
  }

  XLSX.writeFile(libro, nombreArchivo(tipo, desde, hasta, 'xlsx'))
}

export function exportarPDF({ tipo, filas, desde, hasta, descripcion }) {
  const { cabecera, cuerpo } = matrizDesdeFilas(tipo, filas)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' })
  const ancho = doc.internal.pageSize.getWidth()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(16, 57, 90)
  doc.text(`Reporte de ${TIPOS_REPORTE[tipo].label.toLowerCase()} — IBIME`, 40, 40)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90)
  const lineas = [...descripcion, `Generado: ${new Date().toLocaleString('es-MX')}   ·   Total de registros: ${filas.length}`]
  lineas.forEach((l, i) => doc.text(l, 40, 58 + i * 12))

  autoTable(doc, {
    head: [cabecera],
    body: cuerpo.length ? cuerpo : [[{ content: 'Sin registros para los filtros elegidos.', colSpan: cabecera.length, styles: { halign: 'center' } }]],
    startY: 58 + lineas.length * 12 + 6,
    margin: { left: 40, right: 40, bottom: 40 },
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [16, 57, 90], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    didDrawPage: () => {
      doc.setFontSize(8)
      doc.setTextColor(120)
      const pagina = doc.internal.getCurrentPageInfo().pageNumber
      doc.text(`Página ${pagina}`, ancho - 40, doc.internal.pageSize.getHeight() - 20, { align: 'right' })
    }
  })

  doc.save(nombreArchivo(tipo, desde, hasta, 'pdf'))
}
