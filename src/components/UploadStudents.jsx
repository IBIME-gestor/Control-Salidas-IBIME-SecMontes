import React, { useState } from 'react'
import * as XLSX from 'xlsx'
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase.js'
import { actualizarMetaFiltros } from '../utils/meta.js'

// Columnas esperadas en el Excel (insensible a mayúsculas/acentos básicos):
// matricula | nombre | correo | grupoEspanol | grupoIngles | tutor |
// correoPadre (opcional) | telefonoPadre (opcional)
// correoPadre/telefonoPadre son opcionales HOY, pero se necesitan para que
// las notificaciones automáticas de retardos le lleguen al papá — si no
// vienen en el Excel, esos alumnos simplemente no recibirán ese correo
// hasta que se agregue el dato.
const MAPEO_ENCABEZADOS = {
  matricula: ['matricula', 'matrícula', 'matriculas', 'no. matricula', 'no matricula'],
  nombre: ['nombre', 'nombre del alumno', 'alumno'],
  correo: ['correo', 'email', 'correo electronico', 'correo electrónico'],
  grupoEspanol: ['grupo español', 'grupo espanol', 'grupoespanol', 'grupo esp'],
  grupoIngles: ['grupo ingles', 'grupo inglés', 'grupoingles', 'grupo ing'],
  tutor: ['tutor', 'nombre del tutor', 'tutor(a)'],
  correoPadre: ['correo padre', 'correo del padre', 'correo tutor', 'correo padre/tutor', 'correo papa'],
  telefonoPadre: ['telefono padre', 'teléfono padre', 'telefono tutor', 'celular padre', 'telefono padre/tutor']
}

function normalizar(texto) {
  return String(texto || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function detectarColumna(encabezados, claves) {
  const clavesNorm = claves.map(normalizar)
  return encabezados.find((h) => clavesNorm.includes(normalizar(h)))
}

export default function UploadStudents() {
  const [preview, setPreview] = useState([])
  const [estado, setEstado] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [tieneContactoPadre, setTieneContactoPadre] = useState(false)

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setEstado('')
    const reader = new FileReader()
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' })
      const hoja = wb.Sheets[wb.SheetNames[0]]
      const filas = XLSX.utils.sheet_to_json(hoja, { defval: '' })
      if (!filas.length) {
        setEstado('El archivo no tiene filas de datos.')
        return
      }
      const encabezados = Object.keys(filas[0])
      const colMatricula = detectarColumna(encabezados, MAPEO_ENCABEZADOS.matricula)
      const colNombre = detectarColumna(encabezados, MAPEO_ENCABEZADOS.nombre)
      const colCorreo = detectarColumna(encabezados, MAPEO_ENCABEZADOS.correo)
      const colGrupoEsp = detectarColumna(encabezados, MAPEO_ENCABEZADOS.grupoEspanol)
      const colGrupoIng = detectarColumna(encabezados, MAPEO_ENCABEZADOS.grupoIngles)
      const colTutor = detectarColumna(encabezados, MAPEO_ENCABEZADOS.tutor)
      const colCorreoPadre = detectarColumna(encabezados, MAPEO_ENCABEZADOS.correoPadre)
      const colTelefonoPadre = detectarColumna(encabezados, MAPEO_ENCABEZADOS.telefonoPadre)

      if (!colMatricula || !colNombre) {
        setEstado(
          'No se encontraron las columnas de "matrícula" y/o "nombre". Revisa los encabezados del Excel.'
        )
        return
      }

      const alumnos = filas
        .map((f) => ({
          matricula: String(f[colMatricula]).trim(),
          nombre: String(f[colNombre]).trim(),
          correo: colCorreo ? String(f[colCorreo]).trim() : '',
          grupoEspanol: colGrupoEsp ? String(f[colGrupoEsp]).trim() : '',
          grupoIngles: colGrupoIng ? String(f[colGrupoIng]).trim() : '',
          tutor: colTutor ? String(f[colTutor]).trim() : '',
          correoPadre: colCorreoPadre ? String(f[colCorreoPadre]).trim() : '',
          telefonoPadre: colTelefonoPadre ? String(f[colTelefonoPadre]).trim() : ''
        }))
        .filter((a) => a.matricula)

      setTieneContactoPadre(Boolean(colCorreoPadre || colTelefonoPadre))
      setPreview(alumnos)
      setEstado(`Se detectaron ${alumnos.length} alumnos. Revisa la vista previa y confirma la carga.`)
    }
    reader.readAsBinaryString(file)
  }

  async function confirmarCarga() {
    if (!preview.length) return
    setGuardando(true)
    setEstado('Guardando en Firestore...')
    try {
      // Firestore permite máximo 500 operaciones por batch
      const LOTE = 450
      for (let i = 0; i < preview.length; i += LOTE) {
        const batch = writeBatch(db)
        const trozo = preview.slice(i, i + LOTE)
        trozo.forEach((alumno) => {
          const ref = doc(db, 'alumnos', alumno.matricula)
          batch.set(
            ref,
            {
              ...alumno,
              tipoSalidaId: null,
              diasSalida: [],
              activo: true,
              // Contadores acumulados para notificaciones e "Alertas" —
              // solo se inicializan si no existen (merge no los pisa si ya
              // traían un valor de una carga anterior).
              contadorRetardos: 0,
              contadorFaltas: 0,
              actualizadoEn: serverTimestamp()
            },
            { merge: true }
          )
        })
        await batch.commit()
      }

      // Un solo write adicional (con arrayUnion) para que los filtros de
      // tutor/grupo se puedan mostrar en toda la app sin leer los 650+
      // documentos de alumnos.
      await actualizarMetaFiltros({
        tutores: [...new Set(preview.map((a) => a.tutor).filter(Boolean))],
        gruposEspanol: [...new Set(preview.map((a) => a.grupoEspanol).filter(Boolean))],
        gruposIngles: [...new Set(preview.map((a) => a.grupoIngles).filter(Boolean))]
      })

      setEstado(`Carga completada: ${preview.length} alumnos guardados/actualizados.`)
      setPreview([])
    } catch (err) {
      console.error(err)
      setEstado('Ocurrió un error al guardar. Revisa la consola.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <h2 className="font-semibold text-gray-800 mb-2">Cargar listado de alumnos (Excel)</h2>
      <p className="text-sm text-gray-500 mb-4">
        Columnas esperadas: matrícula, nombre, correo, grupo español, grupo inglés, tutor. Si el
        archivo también trae "correo del padre" o "teléfono del padre", se guardan para las
        notificaciones automáticas de retardos (ambas son opcionales). El archivo puede incluir
        alumnos de toda secundaria; se identifican por matrícula, así que volver a subirlo
        actualiza sin duplicar.
      </p>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="mb-3" />
      {estado && <p className="text-sm text-blue-700 mb-3">{estado}</p>}
      {preview.length > 0 && !tieneContactoPadre && (
        <p className="text-xs text-amber-600 mb-3">
          Este archivo no trae correo ni teléfono del padre/tutor — esos alumnos no recibirán la
          notificación automática de retardos hasta que se agregue ese dato en una carga futura.
        </p>
      )}

      {preview.length > 0 && (
        <>
          <div className="max-h-64 overflow-auto border rounded-lg mb-3">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="p-2 text-left">Matrícula</th>
                  <th className="p-2 text-left">Nombre</th>
                  <th className="p-2 text-left">Correo</th>
                  <th className="p-2 text-left">Grupo Esp.</th>
                  <th className="p-2 text-left">Grupo Ing.</th>
                  <th className="p-2 text-left">Tutor</th>
                  <th className="p-2 text-left">Correo padre</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 50).map((a) => (
                  <tr key={a.matricula} className="border-t">
                    <td className="p-2">{a.matricula}</td>
                    <td className="p-2">{a.nombre}</td>
                    <td className="p-2">{a.correo}</td>
                    <td className="p-2">{a.grupoEspanol}</td>
                    <td className="p-2">{a.grupoIngles}</td>
                    <td className="p-2">{a.tutor}</td>
                    <td className="p-2">{a.correoPadre || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.length > 50 && (
            <p className="text-xs text-gray-400 mb-3">Mostrando 50 de {preview.length} filas.</p>
          )}
          <button
            onClick={confirmarCarga}
            disabled={guardando}
            className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : `Confirmar carga de ${preview.length} alumnos`}
          </button>
        </>
      )}
    </div>
  )
}
