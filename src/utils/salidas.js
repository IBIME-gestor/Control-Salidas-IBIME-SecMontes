import { collection, doc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase.js'
import { ACCIONES, armarEvento, fechaHoyISO, nombreDiaHoy } from './eventos.js'
import { obtenerGrado } from './grados.js'

// ---------------------------------------------------------------------
// Estructura en Firestore de los registros de salida (para consultarlos
// otro día):
//
//   salida (colección)
//     └─ registro (documento fijo)
//          └─ 2026-09-21 (subcolección = la fecha del día)
//               └─ {matrícula} (documento, uno por alumno que salió)
//
// El ID es la matrícula, así que si por error se registra dos veces el
// mismo día se sobrescribe en vez de duplicarse. Cada registro también
// genera su evento SALIDA en la bitácora "eventos", para que "Estado de
// hoy", "Historial" y la lógica de "ya salió" sigan funcionando igual.
// ---------------------------------------------------------------------
export const COLECCION_SALIDA = 'salida'
export const DOC_SALIDA = 'registro'

// Máx. 500 operaciones por batch en Firestore; cada alumno de salida
// escribe 2 documentos (evento + registro de salida).
const ALUMNOS_POR_LOTE = 200

export function coleccionSalidaDelDia(fecha) {
  return collection(db, COLECCION_SALIDA, DOC_SALIDA, fecha)
}

// ¿Le toca salir hoy con el tipo de salida que le asignó el rol
// correspondiente en "Alumnos"?
//   'si'        tiene tipo y hoy está entre sus días
//   'no_aplica' tiene tipo pero hoy no es uno de sus días
//   'sin_dias'  tiene tipo pero no se le marcó ningún día
//   'sin_tipo'  no tiene tipo de salida asignado
export function estadoSalidaProgramada(alumno, tipo, dia = nombreDiaHoy()) {
  if (!tipo) return 'sin_tipo'
  const dias = alumno.diasSalida || []
  if (dias.length === 0) return 'sin_dias'
  return dias.includes(dia) ? 'si' : 'no_aplica'
}

export function motivoTrasladoEstancia(tipo, estadoProgramacion) {
  if (tipo && estadoProgramacion === 'si') {
    return `Pase pendiente: aún no llega (${tipo.nombre})`
  }
  return 'Sin pase de salida hoy'
}

async function escribirPorLotes(items, agregar) {
  for (let i = 0; i < items.length; i += ALUMNOS_POR_LOTE) {
    const batch = writeBatch(db)
    items.slice(i, i + ALUMNOS_POR_LOTE).forEach((item) => agregar(batch, item))
    await batch.commit()
  }
}

// autor = { uid, nombre, correo }
// grupoDocente = { tipo: 'grupoEspanol'|'grupoIngles', valor } (el grupo con
// el que el docente termina su día; sirve para saber quién lo registró).

export async function registrarSalidas({ alumnos, tiposSalida = [], grupoDocente = null, autor }) {
  const ahora = new Date()
  const fecha = fechaHoyISO(ahora)
  const dia = nombreDiaHoy(ahora)

  await escribirPorLotes(alumnos, (batch, alumno) => {
    const tipo = tiposSalida.find((t) => t.id === alumno.tipoSalidaId) || null
    const programacion = estadoSalidaProgramada(alumno, tipo, dia)

    batch.set(
      doc(collection(db, 'eventos')),
      armarEvento({
        alumno,
        accion: ACCIONES.SALIDA,
        motivo: tipo ? `Salida: ${tipo.nombre}` : 'Salida sin tipo asignado',
        autorUid: autor.uid,
        autorNombre: autor.nombre,
        ahora,
        extra: { origen: 'docente', grupoDocente: grupoDocente?.valor || '' }
      })
    )

    batch.set(doc(db, COLECCION_SALIDA, DOC_SALIDA, fecha, alumno.id), {
      alumnoId: alumno.id,
      matricula: alumno.matricula,
      nombreAlumno: alumno.nombre,
      grado: obtenerGrado(alumno),
      grupoEspanol: alumno.grupoEspanol || '',
      grupoIngles: alumno.grupoIngles || '',
      tutor: alumno.tutor || '',
      // Se guarda el nombre/categoría del tipo tal como estaban HOY, para
      // que la consulta de mañana no cambie si luego renombran o borran
      // el tipo de salida.
      tipoSalidaId: alumno.tipoSalidaId || null,
      tipoSalidaNombre: tipo?.nombre || '',
      categoria: tipo?.categoria || 'SIN_REGISTRO',
      requierePase: tipo ? !!tipo.requierePase : false,
      programadaHoy: programacion === 'si',
      estadoProgramacion: programacion,
      diaSemana: dia,
      fecha,
      hora: ahora.toTimeString().slice(0, 8),
      timestampISO: ahora.toISOString(),
      grupoDocente: grupoDocente?.valor || '',
      tipoGrupoDocente: grupoDocente?.tipo || '',
      docenteUid: autor.uid || null,
      docenteNombre: autor.nombre || '',
      docenteCorreo: autor.correo || ''
    })
  })
}

// items = [{ alumno, motivo }]
export async function trasladarAEstancia({ items, grupoDocente = null, autor }) {
  const ahora = new Date()
  await escribirPorLotes(items, (batch, { alumno, motivo }) => {
    batch.set(
      doc(collection(db, 'eventos')),
      armarEvento({
        alumno,
        accion: ACCIONES.TRASLADO_ESTANCIA,
        motivo,
        autorUid: autor.uid,
        autorNombre: autor.nombre,
        ahora,
        extra: { origen: 'docente', grupoDocente: grupoDocente?.valor || '' }
      })
    )
  })
}

// items = [{ alumno, salon }]  (lo usa el profe de estancia al recibir)
export async function recibirEnEstancia({ items, autor }) {
  const ahora = new Date()
  await escribirPorLotes(items, (batch, { alumno, salon }) => {
    batch.set(
      doc(collection(db, 'eventos')),
      armarEvento({
        alumno,
        accion: ACCIONES.ENTREGADO_ESTANCIA,
        motivo: '',
        autorUid: autor.uid,
        autorNombre: autor.nombre,
        ahora,
        extra: { origen: 'estancia', salonEstancia: salon || '' }
      })
    )
  })
}
