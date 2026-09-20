import React, { useState } from 'react'
import * as XLSX from 'xlsx'
import { doc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase.js'
import { actualizarMetaHorario } from '../utils/meta.js'

/**
 * Carga el horario consolidado: una fila = una clase que ocurre
 * (día, hora/periodo, grupo, materia, docente, salón).
 *
 * IMPORTANTE: se sube UNA sola tabla consolidada, no las tres hojas del
 * colegio por separado (horario de grupos / de profes / de salones) — así
 * nunca se desincronizan entre sí. Si hoy esa info vive en tres hojas de
 * Google Sheets distintas, lo más simple es armar una hoja nueva que las
 * cruce (una fila por clase, con las 6 columnas de abajo) y subir esa.
 *
 * Columnas esperadas: dia, hora (o periodo), grupo, materia, docente
 * (correo @ibime.edu.mx), salon.
 */
const MAPEO_ENCABEZADOS = {
  dia: ['dia', 'día'],
  hora: ['hora', 'periodo', 'hora/periodo', 'bloque'],
  grupo: ['grupo', 'grupo español', 'grupo espanol'],
  materia: ['materia', 'asignatura'],
  docente: ['docente', 'profesor', 'maestro', 'correo docente', 'correo profesor'],
  salon: ['salon', 'salón', 'aula']
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

export default function UploadHorarios() {
  const [preview, setPreview] = useState([])
  const [estado, setEstado] = useState('')
  const [guardando, setGuardando] = useState(false)

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
      const cols = Object.fromEntries(
        Object.entries(MAPEO_ENCABEZADOS).map(([campo, claves]) => [campo, detectarColumna(encabezados, claves)])
      )

      if (!cols.dia || !cols.hora || !cols.grupo || !cols.docente) {
        setEstado(
          'Faltan columnas obligatorias (día, hora, grupo, docente). Revisa los encabezados del Excel.'
        )
        return
      }

      const filasHorario = filas
        .map((f) => ({
          dia: String(f[cols.dia]).trim(),
          hora: String(f[cols.hora]).trim(),
          grupo: String(f[cols.grupo]).trim(),
          materia: cols.materia ? String(f[cols.materia]).trim() : '',
          docente: cols.docente ? String(f[cols.docente]).trim().toLowerCase() : '',
          salon: cols.salon ? String(f[cols.salon]).trim() : ''
        }))
        .filter((r) => r.dia && r.hora && r.docente)

      setPreview(filasHorario)
      setEstado(`Se detectaron ${filasHorario.length} clases. Revisa la vista previa y confirma la carga.`)
    }
    reader.readAsBinaryString(file)
  }

  async function confirmarCarga() {
    if (!preview.length) return
    setGuardando(true)
    setEstado('Guardando en Firestore...')
    try {
      const LOTE = 450
      for (let i = 0; i < preview.length; i += LOTE) {
        const batch = writeBatch(db)
        const trozo = preview.slice(i, i + LOTE)
        trozo.forEach((fila, idx) => {
          // ID determinístico: día+hora+grupo. Si dos filas del Excel
          // coinciden en día/hora/grupo (no debería pasar), la segunda
          // sobrescribe a la primera — evita duplicados en cargas repetidas.
          const id = `${fila.dia}_${fila.hora}_${fila.grupo}`.replace(/\s+/g, '-').toLowerCase()
          const ref = doc(db, 'horarios', id)
          batch.set(ref, fila, { merge: true })
        })
        await batch.commit()
      }

      await actualizarMetaHorario({
        docentes: [...new Set(preview.map((r) => r.docente).filter(Boolean))],
        salones: [...new Set(preview.map((r) => r.salon).filter(Boolean))],
        dias: [...new Set(preview.map((r) => r.dia).filter(Boolean))],
        horas: [...new Set(preview.map((r) => r.hora).filter(Boolean))]
      })

      setEstado(`Carga completada: ${preview.length} clases guardadas/actualizadas.`)
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
      <h2 className="font-semibold text-gray-800 mb-2">Cargar horario (grupos, docentes y salones)</h2>
      <p className="text-sm text-gray-500 mb-4">
        Sube UNA tabla consolidada con una fila por clase: día, hora/periodo, grupo, materia,
        docente (su correo) y salón. Si hoy tienes tres hojas separadas, arma primero esta tabla
        cruzándolas — así nunca queda un profesor en un lugar y el salón diciendo otra cosa.
      </p>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="mb-3" />
      {estado && <p className="text-sm text-blue-700 mb-3">{estado}</p>}

      {preview.length > 0 && (
        <>
          <div className="max-h-64 overflow-auto border rounded-lg mb-3">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="p-2 text-left">Día</th>
                  <th className="p-2 text-left">Hora</th>
                  <th className="p-2 text-left">Grupo</th>
                  <th className="p-2 text-left">Materia</th>
                  <th className="p-2 text-left">Docente</th>
                  <th className="p-2 text-left">Salón</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{r.dia}</td>
                    <td className="p-2">{r.hora}</td>
                    <td className="p-2">{r.grupo}</td>
                    <td className="p-2">{r.materia}</td>
                    <td className="p-2">{r.docente}</td>
                    <td className="p-2">{r.salon}</td>
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
            {guardando ? 'Guardando...' : `Confirmar carga de ${preview.length} clases`}
          </button>
        </>
      )}
    </div>
  )
}
