import React, { useEffect, useMemo, useState } from 'react'
import { suscribirMetaFiltros } from '../utils/meta.js'
import { fechaHoyISO } from '../utils/eventos.js'
import {
  TIPOS_REPORTE,
  COLUMNAS,
  MAX_DIAS_RANGO,
  validarRango,
  ejecutarConsulta,
  resumenPorAlumno,
  descripcionFiltros,
  exportarExcel,
  exportarPDF,
  formatearFecha
} from '../utils/reportes.js'

function primerDiaDelMes() {
  const h = new Date()
  return fechaHoyISO(new Date(h.getFullYear(), h.getMonth(), 1))
}

const MAX_FILAS_PANTALLA = 500

/**
 * Módulo "Consultar": elige el tipo de información (retardos, salidas con
 * pase, inasistencias, asistencias), un rango de fechas y filtros opcionales,
 * revisa el resultado en pantalla y descárgalo en Excel o PDF.
 *
 * Las lecturas solo ocurren al presionar "Consultar" (no en vivo), y el
 * rango está limitado a MAX_DIAS_RANGO días para cuidar el uso de Firestore.
 */
export default function ConsultarReportes() {
  const [tipo, setTipo] = useState('retardos')
  const [desde, setDesde] = useState(primerDiaDelMes())
  const [hasta, setHasta] = useState(fechaHoyISO())
  const [tutor, setTutor] = useState('')
  const [grupoEspanol, setGrupoEspanol] = useState('')
  const [grupoIngles, setGrupoIngles] = useState('')
  const [texto, setTexto] = useState('')
  const [incluirTodas, setIncluirTodas] = useState(false)
  const [diasSinClases, setDiasSinClases] = useState([])
  const [diaNuevo, setDiaNuevo] = useState('')

  const [meta, setMeta] = useState({ tutores: [], gruposEspanol: [], gruposIngles: [] })
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState(null) // { tipo, filas, avisos, descripcion, desde, hasta }

  useEffect(() => suscribirMetaFiltros(setMeta), [])

  // Al cambiar de tipo se limpia el resultado para no mezclar columnas.
  function cambiarTipo(nuevo) {
    setTipo(nuevo)
    setResultado(null)
    setError('')
  }

  async function consultar(e) {
    e?.preventDefault()
    const problema = validarRango(desde, hasta)
    if (problema) {
      setError(problema)
      return
    }
    setError('')
    setCargando(true)
    setResultado(null)
    const filtros = { tutor, grupoEspanol, grupoIngles, texto }
    try {
      const { filas, avisos } = await ejecutarConsulta(tipo, {
        desde,
        hasta,
        filtros,
        diasSinClases,
        incluirTodas
      })
      setResultado({
        tipo,
        filas,
        avisos,
        desde,
        hasta,
        descripcion: descripcionFiltros({ desde, hasta, filtros, tipo, diasSinClases, incluirTodas })
      })
    } catch (err) {
      console.error(err)
      setError('No se pudo completar la consulta. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  function agregarDiaSinClases() {
    if (!diaNuevo || diasSinClases.includes(diaNuevo)) return
    setDiasSinClases((prev) => [...prev, diaNuevo].sort())
    setDiaNuevo('')
  }

  const columnas = resultado ? COLUMNAS[resultado.tipo] : []
  const resumen = useMemo(
    () => (resultado && resultado.tipo !== 'asistencias' ? resumenPorAlumno(resultado.filas) : []),
    [resultado]
  )

  const totalAsistenciaPromedio = useMemo(() => {
    if (!resultado || resultado.tipo !== 'asistencias' || !resultado.filas.length) return null
    const dias = resultado.filas.reduce((s, f) => s + f.diasHabiles, 0)
    const asist = resultado.filas.reduce((s, f) => s + f.asistencias, 0)
    return `${Math.round((asist / dias) * 1000) / 10}%`
  }, [resultado])

  const filasVisibles = resultado ? resultado.filas.slice(0, MAX_FILAS_PANTALLA) : []

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="font-semibold text-gray-800 mb-1">Consultar información</h2>
      <p className="text-sm text-gray-500 mb-4">
        Elige qué quieres revisar, el periodo y, si lo necesitas, filtra por tutor o grupo. Después
        descarga el resultado en Excel o PDF.
      </p>

      {/* Tipo de consulta */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-5">
        {Object.entries(TIPOS_REPORTE).map(([id, t]) => (
          <button
            key={id}
            type="button"
            onClick={() => cambiarTipo(id)}
            className={`text-left rounded-lg border px-3 py-2 transition ${
              tipo === id ? 'border-[#10395a] bg-[#10395a] text-white' : 'border-gray-200 hover:border-[#10395a]'
            }`}
          >
            <span className="block text-sm font-semibold">{t.label}</span>
            <span className={`block text-xs ${tipo === id ? 'text-blue-100' : 'text-gray-400'}`}>{t.descripcion}</span>
          </button>
        ))}
      </div>

      <form onSubmit={consultar}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <label className="text-xs text-gray-500">
            Desde
            <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm text-gray-800" />
          </label>
          <label className="text-xs text-gray-500">
            Hasta
            <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm text-gray-800" />
          </label>
          <label className="text-xs text-gray-500">
            Tutor
            <select value={tutor} onChange={(e) => setTutor(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm text-gray-800">
              <option value="">Todos</option>
              {meta.tutores.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-500">
            Buscar alumno (nombre o matrícula)
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Opcional" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm text-gray-800" />
          </label>
          <label className="text-xs text-gray-500">
            Grupo español
            <select value={grupoEspanol} onChange={(e) => setGrupoEspanol(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm text-gray-800">
              <option value="">Todos</option>
              {meta.gruposEspanol.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-500">
            Grupo inglés
            <select value={grupoIngles} onChange={(e) => setGrupoIngles(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm text-gray-800">
              <option value="">Todos</option>
              {meta.gruposIngles.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
        </div>

        {tipo === 'salidasPase' && (
          <label className="flex items-center gap-2 text-sm text-gray-600 mb-3">
            <input type="checkbox" checked={incluirTodas} onChange={(e) => setIncluirTodas(e.target.checked)} />
            Incluir también salidas cuyo tipo no requiere pase
          </label>
        )}

        {tipo === 'asistencias' && (
          <div className="mb-3 rounded-lg bg-gray-50 border border-gray-200 p-3">
            <p className="text-xs text-gray-500 mb-2">
              Días sin clases dentro del periodo (festivos, suspensiones). Los fines de semana ya se
              excluyen automáticamente.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={diaNuevo} onChange={(e) => setDiaNuevo(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm" />
              <button type="button" onClick={agregarDiaSinClases} className="text-sm px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-100">
                Agregar día
              </button>
              {diasSinClases.map((d) => (
                <span key={d} className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 rounded-full px-2 py-1">
                  {formatearFecha(d)}
                  <button type="button" onClick={() => setDiasSinClases((prev) => prev.filter((x) => x !== d))} aria-label="Quitar" className="hover:text-red-600">×</button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            disabled={cargando}
            className="bg-[#10395a] text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-[#0c2c47] disabled:opacity-50"
          >
            {cargando ? 'Consultando...' : 'Consultar'}
          </button>
          <span className="text-xs text-gray-400">Rango máximo: {MAX_DIAS_RANGO} días por consulta.</span>
        </div>
      </form>

      {error && <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {resultado && (
        <div className="mt-6">
          {resultado.avisos.map((a, i) => (
            <p key={i} className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">{a}</p>
          ))}

          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className="text-sm text-gray-700">
              <strong>{resultado.filas.length}</strong> {resultado.tipo === 'asistencias' ? 'alumnos' : 'registros'}
              {resultado.tipo !== 'asistencias' && (
                <> · <strong>{resumen.length}</strong> alumnos distintos</>
              )}
              {totalAsistenciaPromedio && <> · asistencia general <strong>{totalAsistenciaPromedio}</strong></>}
              <span className="text-gray-400"> · {formatearFecha(resultado.desde)} al {formatearFecha(resultado.hasta)}</span>
            </div>
            <div className="flex gap-2 md:ml-auto">
              <button
                onClick={() => exportarExcel(resultado)}
                disabled={!resultado.filas.length}
                className="text-sm px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-40"
              >
                Descargar Excel
              </button>
              <button
                onClick={() => exportarPDF(resultado)}
                disabled={!resultado.filas.length}
                className="text-sm px-4 py-2 rounded-lg bg-[#e31e24] text-white hover:bg-[#c3181d] disabled:opacity-40"
              >
                Generar PDF
              </button>
            </div>
          </div>

          <div className="overflow-auto max-h-[60vh] border rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  {columnas.map((c) => <th key={c.key} className="p-2 text-left whitespace-nowrap">{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {filasVisibles.map((f, i) => (
                  <tr key={i} className="border-t">
                    {columnas.map((c) => (
                      <td key={c.key} className={`p-2 ${c.key === 'nombre' ? 'font-medium' : 'text-gray-600'}`}>{f[c.key]}</td>
                    ))}
                  </tr>
                ))}
                {resultado.filas.length === 0 && (
                  <tr>
                    <td colSpan={columnas.length} className="p-6 text-center text-gray-400">
                      Sin registros para los filtros elegidos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {resultado.filas.length > MAX_FILAS_PANTALLA && (
            <p className="text-xs text-gray-400 mt-2">
              En pantalla se muestran los primeros {MAX_FILAS_PANTALLA} registros; el Excel y el PDF
              incluyen los {resultado.filas.length}.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
