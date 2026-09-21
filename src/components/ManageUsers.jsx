import React, { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc } from 'firebase/firestore'
import { db, DOMINIO_PERMITIDO } from '../firebase.js'
import {
  ROLES,
  ROLE_LABELS,
  ROLES_PANEL_PRIVILEGIOS,
  PERMISOS,
  PERMISO_LABELS,
  permisosPorDefecto,
  getRoles
} from '../utils/roles.js'

// Con login de Google no hace falta crear una cuenta de acceso: cualquier
// persona con correo @ibime.edu.mx puede entrar, y en cuanto lo hace por
// primera vez el propio navegador le crea aquí mismo un registro con el
// rol "Colaborador" (solo consulta de alumnos y grupos) — sin Cloud
// Functions ni plan de pago; firestore.rules valida que nadie pueda
// autoasignarse otro rol. Desde esta pantalla el administrador:
//   1) le cambia el/los ROL(ES) a esa persona (puede tener varios a la
//      vez, por ejemplo Tutoría + Recepción), y
//   2) dentro de esos roles, prende o apaga cada PRIVILEGIO puntual
//      (qué puede ver y qué puede hacer), sin quedar atado a lo que ese
//      rol trae "de fábrica".
const ROLES_ASIGNABLES = [ROLES.ADMIN, ROLES.DOCENTE, ...ROLES_PANEL_PRIVILEGIOS]

function ChecklistRoles({ rolesSeleccionados, onChange }) {
  function toggle(r) {
    const set = new Set(rolesSeleccionados)
    set.has(r) ? set.delete(r) : set.add(r)
    onChange(Array.from(set))
  }
  return (
    <div className="flex flex-wrap gap-3">
      {ROLES_ASIGNABLES.map((r) => (
        <label key={r} className="flex items-center gap-1.5 text-sm bg-gray-50 border rounded-lg px-2.5 py-1.5">
          <input type="checkbox" checked={rolesSeleccionados.includes(r)} onChange={() => toggle(r)} />
          {ROLE_LABELS[r]}
        </label>
      ))}
    </div>
  )
}

function ChecklistPermisos({ permisos, onChange, disabled }) {
  function toggle(p) {
    onChange({ ...permisos, [p]: !permisos[p] })
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5">
      {Object.values(PERMISOS).map((p) => (
        <label key={p} className={`flex items-center gap-1.5 text-sm ${disabled ? 'opacity-50' : ''}`}>
          <input type="checkbox" checked={!!permisos[p]} disabled={disabled} onChange={() => toggle(p)} />
          {PERMISO_LABELS[p]}
        </label>
      ))}
    </div>
  )
}

export default function ManageUsers() {
  const [usuarios, setUsuarios] = useState([])
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [rolesNuevo, setRolesNuevo] = useState([ROLES.COLABORADOR])
  const [permisosNuevo, setPermisosNuevo] = useState(permisosPorDefecto([ROLES.COLABORADOR]))
  const [grupoAsignado, setGrupoAsignado] = useState('')
  const [tipoGrupoAsignado, setTipoGrupoAsignado] = useState('grupoEspanol')
  const [tutorAsignado, setTutorAsignado] = useState('')
  const [estado, setEstado] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [edicion, setEdicion] = useState(null) // { roles, permisos, grupoAsignado, tipoGrupoAsignado, tutorAsignado }

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'usuarios'), (snap) => {
      setUsuarios(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  function cambiarRolesNuevo(roles) {
    setRolesNuevo(roles)
    setPermisosNuevo(permisosPorDefecto(roles))
  }

  const esAdminNuevo = rolesNuevo.includes(ROLES.ADMIN)
  const esDocenteNuevo = rolesNuevo.includes(ROLES.DOCENTE)
  const esTutoriaNuevo = rolesNuevo.includes(ROLES.TUTORIA)

  async function darDeAlta(e) {
    e.preventDefault()
    const correoNormalizado = correo.trim().toLowerCase()
    if (!correoNormalizado.endsWith('@' + DOMINIO_PERMITIDO)) {
      setEstado(`El correo debe ser de dominio @${DOMINIO_PERMITIDO}.`)
      return
    }
    if (!rolesNuevo.length) {
      setEstado('Selecciona al menos un rol.')
      return
    }
    setEstado('Guardando...')
    try {
      await setDoc(doc(db, 'usuarios', correoNormalizado), {
        nombre: nombre.trim(),
        correo: correoNormalizado,
        roles: rolesNuevo,
        permisos: esAdminNuevo ? permisosPorDefecto([ROLES.ADMIN]) : permisosNuevo,
        grupoAsignado: esDocenteNuevo ? grupoAsignado.trim() : '',
        tipoGrupoAsignado: esDocenteNuevo ? tipoGrupoAsignado : '',
        tutorAsignado: esTutoriaNuevo ? tutorAsignado.trim() : ''
      })
      setEstado(`${correoNormalizado} dado de alta. Ya puede entrar con su cuenta de Google.`)
      setNombre('')
      setCorreo('')
      setGrupoAsignado('')
      setTutorAsignado('')
      cambiarRolesNuevo([ROLES.COLABORADOR])
    } catch (err) {
      console.error(err)
      setEstado('Error al guardar: ' + (err.code || err.message))
    }
  }

  function empezarEdicion(u) {
    const roles = getRoles(u)
    setEditandoId(u.id)
    setEdicion({
      roles,
      permisos: u.permisos && Object.keys(u.permisos).length ? { ...u.permisos } : permisosPorDefecto(roles),
      grupoAsignado: u.grupoAsignado || '',
      tipoGrupoAsignado: u.tipoGrupoAsignado || 'grupoEspanol',
      tutorAsignado: u.tutorAsignado || ''
    })
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setEdicion(null)
  }

  function cambiarRolesEdicion(roles) {
    setEdicion((prev) => ({ ...prev, roles, permisos: permisosPorDefecto(roles) }))
  }

  async function guardarEdicion(id) {
    const esAdminEdit = edicion.roles.includes(ROLES.ADMIN)
    const esDocenteEdit = edicion.roles.includes(ROLES.DOCENTE)
    const esTutoriaEdit = edicion.roles.includes(ROLES.TUTORIA)
    try {
      await updateDoc(doc(db, 'usuarios', id), {
        roles: edicion.roles,
        permisos: esAdminEdit ? permisosPorDefecto([ROLES.ADMIN]) : edicion.permisos,
        grupoAsignado: esDocenteEdit ? edicion.grupoAsignado.trim() : '',
        tipoGrupoAsignado: esDocenteEdit ? edicion.tipoGrupoAsignado : '',
        tutorAsignado: esTutoriaEdit ? edicion.tutorAsignado.trim() : ''
      })
      cancelarEdicion()
    } catch (err) {
      console.error(err)
      alert('Error al guardar: ' + (err.code || err.message))
    }
  }

  async function eliminarUsuario(id) {
    if (!confirm('¿Quitar el acceso de esta persona a la plataforma?')) return
    await deleteDoc(doc(db, 'usuarios', id))
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <h2 className="font-semibold text-gray-800 mb-4">Usuarios del sistema</h2>
      <p className="text-xs text-gray-500 mb-4">
        No hay contraseñas: cualquiera con correo @{DOMINIO_PERMITIDO} entra con su cuenta de
        Google. La primera vez que alguien entra queda dado de alta automáticamente como
        "Colaborador" (solo puede ver alumnos y grupos). Aquí puedes darle de alta manualmente
        de una vez con otro rol, o después ajustarle el rol y los privilegios exactos.
      </p>

      <form onSubmit={darDeAlta} className="border rounded-xl p-4 mb-6 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            required
            placeholder="Nombre completo"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            required
            type="email"
            placeholder={`correo@${DOMINIO_PERMITIDO}`}
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-600 mb-1.5">Rol o roles</p>
          <ChecklistRoles rolesSeleccionados={rolesNuevo} onChange={cambiarRolesNuevo} />
        </div>

        {esDocenteNuevo && (
          <div className="flex gap-2">
            <select
              value={tipoGrupoAsignado}
              onChange={(e) => setTipoGrupoAsignado(e.target.value)}
              className="border rounded-lg px-2 py-2 text-sm"
            >
              <option value="grupoEspanol">Grupo español</option>
              <option value="grupoIngles">Grupo inglés</option>
            </select>
            <input
              placeholder="Nombre exacto del grupo"
              value={grupoAsignado}
              onChange={(e) => setGrupoAsignado(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm flex-1"
            />
          </div>
        )}
        {esTutoriaNuevo && (
          <input
            placeholder="Nombre exacto del tutor (como en el listado)"
            value={tutorAsignado}
            onChange={(e) => setTutorAsignado(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm w-full"
          />
        )}

        {!esAdminNuevo && (
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1.5">
              Privilegios activos (precargados según el rol; puedes ajustarlos)
            </p>
            <ChecklistPermisos permisos={permisosNuevo} onChange={setPermisosNuevo} />
          </div>
        )}
        {esAdminNuevo && (
          <p className="text-xs text-gray-500">El rol Administrador siempre tiene todos los privilegios.</p>
        )}

        <button className="bg-[#10395a] text-white rounded-lg py-2 px-4 text-sm font-medium hover:bg-[#0c2c47]">
          Dar de alta
        </button>
      </form>

      {estado && <p className="text-sm text-blue-700 mb-4">{estado}</p>}

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Nombre</th>
              <th className="p-2 text-left">Correo</th>
              <th className="p-2 text-left">Rol(es)</th>
              <th className="p-2 text-left">Grupo / tutoría</th>
              <th className="p-2 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <React.Fragment key={u.id}>
                <tr className="border-t">
                  <td className="p-2">{u.nombre}</td>
                  <td className="p-2">{u.correo || u.id}</td>
                  <td className="p-2">{getRoles(u).map((r) => ROLE_LABELS[r] || r).join(' / ') || '—'}</td>
                  <td className="p-2">
                    {u.grupoAsignado
                      ? `${u.grupoAsignado} (${u.tipoGrupoAsignado === 'grupoIngles' ? 'inglés' : 'español'})`
                      : u.tutorAsignado
                      ? `Tutoría: ${u.tutorAsignado}`
                      : '—'}
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    {editandoId === u.id ? (
                      <button onClick={cancelarEdicion} className="text-gray-500 text-xs hover:underline mr-3">
                        Cerrar
                      </button>
                    ) : (
                      <button
                        onClick={() => empezarEdicion(u)}
                        className="text-[#10395a] text-xs hover:underline mr-3"
                      >
                        Editar rol / privilegios
                      </button>
                    )}
                    <button onClick={() => eliminarUsuario(u.id)} className="text-red-600 text-xs hover:underline">
                      Quitar acceso
                    </button>
                  </td>
                </tr>
                {editandoId === u.id && (
                  <tr className="border-t bg-gray-50">
                    <td colSpan={5} className="p-4 space-y-3">
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1.5">Rol o roles</p>
                        <ChecklistRoles rolesSeleccionados={edicion.roles} onChange={cambiarRolesEdicion} />
                      </div>

                      {edicion.roles.includes(ROLES.DOCENTE) && (
                        <div className="flex gap-2">
                          <select
                            value={edicion.tipoGrupoAsignado}
                            onChange={(e) => setEdicion((p) => ({ ...p, tipoGrupoAsignado: e.target.value }))}
                            className="border rounded-lg px-2 py-2 text-sm"
                          >
                            <option value="grupoEspanol">Grupo español</option>
                            <option value="grupoIngles">Grupo inglés</option>
                          </select>
                          <input
                            placeholder="Nombre exacto del grupo"
                            value={edicion.grupoAsignado}
                            onChange={(e) => setEdicion((p) => ({ ...p, grupoAsignado: e.target.value }))}
                            className="border rounded-lg px-3 py-2 text-sm flex-1"
                          />
                        </div>
                      )}
                      {edicion.roles.includes(ROLES.TUTORIA) && (
                        <input
                          placeholder="Nombre exacto del tutor (como en el listado)"
                          value={edicion.tutorAsignado}
                          onChange={(e) => setEdicion((p) => ({ ...p, tutorAsignado: e.target.value }))}
                          className="border rounded-lg px-3 py-2 text-sm w-full"
                        />
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs font-medium text-gray-600">Privilegios activos</p>
                          {!edicion.roles.includes(ROLES.ADMIN) && (
                            <button
                              type="button"
                              onClick={() =>
                                setEdicion((p) => ({ ...p, permisos: permisosPorDefecto(p.roles) }))
                              }
                              className="text-xs text-[#10395a] hover:underline"
                            >
                              Restablecer según el rol
                            </button>
                          )}
                        </div>
                        <ChecklistPermisos
                          permisos={edicion.roles.includes(ROLES.ADMIN) ? permisosPorDefecto([ROLES.ADMIN]) : edicion.permisos}
                          disabled={edicion.roles.includes(ROLES.ADMIN)}
                          onChange={(permisos) => setEdicion((p) => ({ ...p, permisos }))}
                        />
                        {edicion.roles.includes(ROLES.ADMIN) && (
                          <p className="text-xs text-gray-500 mt-1">
                            El rol Administrador siempre tiene todos los privilegios.
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => guardarEdicion(u.id)}
                          className="bg-[#10395a] text-white rounded-lg py-1.5 px-4 text-xs font-medium hover:bg-[#0c2c47]"
                        >
                          Guardar cambios
                        </button>
                        <button onClick={cancelarEdicion} className="text-xs text-gray-500 hover:underline px-2">
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
