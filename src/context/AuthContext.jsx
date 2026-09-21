import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { auth, db, DOMINIO_PERMITIDO, CORREOS_ADMIN_INICIALES } from '../firebase.js'
import { ROLES, permisosPorDefecto } from '../utils/roles.js'

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
        let intentoDeAlta = false

        unsubPerfil = onSnapshot(
          ref,
          async (snap) => {
            if (snap.exists()) {
              setPerfil({ id: snap.id, ...snap.data() })
              setCargando(false)
              return
            }

            // No existe todavía: se autoaprovisiona una sola vez. Si el
            // create falla (por ejemplo, sin conexión), no se reintenta en
            // bucle; el listener seguirá esperando a que exista.
            if (intentoDeAlta) return
            intentoDeAlta = true
            const esAdminInicial = CORREOS_ADMIN_INICIALES.map((c) => c.toLowerCase()).includes(correoId)
            const rolesIniciales = esAdminInicial ? [ROLES.ADMIN] : [ROLES.COLABORADOR]
            try {
              await setDoc(ref, {
                nombre: u.displayName || correoId,
                correo: correoId,
                roles: rolesIniciales,
                permisos: permisosPorDefecto(rolesIniciales),
                grupoAsignado: '',
                tipoGrupoAsignado: '',
                tutorAsignado: ''
              })
              // onSnapshot se vuelve a disparar solo con el documento nuevo.
            } catch (e) {
              console.error('No se pudo autoaprovisionar el perfil:', e)
              setPerfil(null)
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
