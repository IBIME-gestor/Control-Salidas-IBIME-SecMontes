import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { auth, db, DOMINIO_PERMITIDO, CORREOS_ADMIN_INICIALES } from '../firebase.js'
import { ROLES, ROL_AUTOAPROVISIONAMIENTO, permisosPorDefecto } from '../utils/roles.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null) // documento en /usuarios/{correo}
  const [cargando, setCargando] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    // Se escucha el perfil en vivo (onSnapshot) porque, si es la primera
    // vez que esta persona entra, el documento en /usuarios todavía no
    // existe: lo crea el propio navegador aquí abajo (autoaprovisionar),
    // sin Cloud Functions ni plan Blaze — con las reglas de Firestore
    // (firestore.rules) validando que solo pueda crear SU PROPIO
    // documento y solo con rol "colaborador" (o "administrador" si su
    // correo está en CORREOS_ADMIN_INICIALES), nunca con otro rol o con
    // privilegios de más.
    let unsubPerfil = null

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setAuthError('')
      if (unsubPerfil) {
        unsubPerfil()
        unsubPerfil = null
      }

      // Solo se admite el dominio de Google Workspace del colegio. Esta es
      // la validación real (la del selector de Google con "hd" es solo
      // una ayuda visual, no una garantía).
      if (u && !(u.email || '').toLowerCase().endsWith('@' + DOMINIO_PERMITIDO)) {
        fbSignOut(auth)
        setAuthError(`Solo se permiten cuentas de Google de ${DOMINIO_PERMITIDO}.`)
        setUser(null)
        setPerfil(null)
        setCargando(false)
        return
      }

      setUser(u)
      if (u) {
        const correoId = u.email.toLowerCase()
        const ref = doc(db, 'usuarios', correoId)
        const esAdminInicial = CORREOS_ADMIN_INICIALES.map((c) => c.toLowerCase()).includes(correoId)
        // Evita reintentar en bucle: cuando un intento de autoaprovisionar/
        // autosanar se rechaza por permisos, Firestore hace "rollback" del
        // escritura optimista local y eso dispara este mismo listener otra
        // vez con los datos de antes — sin esta bandera, ese rollback se
        // interpretaba como "hay que volver a intentar" y se entraba en un
        // bucle infinito de escrituras rechazadas.
        let intentoRealizado = false

        unsubPerfil = onSnapshot(
          ref,
          async (snap) => {
            const datosActuales = snap.exists() ? snap.data() : null
            const yaEsAdminCorrecto =
              !!datosActuales &&
              Array.isArray(datosActuales.roles) &&
              datosActuales.roles.length === 1 &&
              datosActuales.roles[0] === ROLES.ADMIN

            // Caso normal: ya existe y (si aplica) ya es admin correcto ->
            // se muestra tal cual, sin tocar nada.
            if (datosActuales && (!esAdminInicial || yaEsAdminCorrecto)) {
              setPerfil({ id: snap.id, ...datosActuales })
              setCargando(false)
              return
            }

            if (intentoRealizado) {
              // Ya se intentó una vez en esta sesión y no se pudo (casi
              // siempre porque firestore.rules todavía no tiene desplegada
              // la versión que permite este autosanado). Se muestra lo que
              // haya en vez de seguir reintentando.
              setPerfil(datosActuales ? { id: snap.id, ...datosActuales } : null)
              setCargando(false)
              return
            }
            intentoRealizado = true

            // Rol con el que cae automáticamente cualquier cuenta nueva:
            // administrador si su correo está en CORREOS_ADMIN_INICIALES,
            // o el rol de autoaprovisionamiento (Docente) en cualquier
            // otro caso. Sus privilegios se calculan igual que en
            // ManageUsers (permisosPorDefecto), así queda consistente
            // sin importar quién dio de alta la cuenta.
            const rolesFinales = esAdminInicial ? [ROLES.ADMIN] : [ROL_AUTOAPROVISIONAMIENTO]
            try {
              await setDoc(
                ref,
                {
                  nombre: u.displayName || correoId,
                  correo: correoId,
                  roles: rolesFinales,
                  permisos: permisosPorDefecto(rolesFinales),
                  // Docente/estancia empiezan sin grupo ni salón: el
                  // administrador los configura desde "Usuarios" (o
                  // "Estancia") en cuanto vea entrar a la persona.
                  grupoAsignado: '',
                  tipoGrupoAsignado: '',
                  gruposAsignados: [],
                  tutorAsignado: ''
                },
                { merge: true }
              )
              // onSnapshot se vuelve a disparar solo con el documento correcto.
            } catch (e) {
              console.error(
                'No se pudo autoaprovisionar/autosanar el perfil (revisa que firestore.rules esté desplegado con la última versión):',
                e
              )
              setPerfil(datosActuales ? { id: snap.id, ...datosActuales } : null)
              setCargando(false)
            }
          },
          (e) => {
            console.error('No se pudo cargar el perfil del usuario:', e)
            setPerfil(null)
            setCargando(false)
          }
        )
      } else {
        setPerfil(null)
        setCargando(false)
      }
    })

    return () => {
      unsubAuth()
      if (unsubPerfil) unsubPerfil()
    }
  }, [])

  async function signOut() {
    await fbSignOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, perfil, cargando, authError, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
