import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db, DOMINIO_PERMITIDO } from '../firebase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null) // documento en /usuarios/{correo}
  const [cargando, setCargando] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    // Se escucha el perfil en vivo (onSnapshot) y no con una sola lectura,
    // porque al iniciar sesión por primera vez el documento en /usuarios
    // todavía no existe: lo crea automáticamente una Cloud Function
    // (ver functions/index.js) uno o dos segundos después del alta de la
    // cuenta en Firebase Auth. Con onSnapshot, en cuanto ese documento
    // aparece (o cambia el rol/permisos más adelante), la app se actualiza
    // sola sin que la persona tenga que recargar ni volver a entrar.
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
        unsubPerfil = onSnapshot(
          ref,
          (snap) => {
            setPerfil(snap.exists() ? { id: snap.id, ...snap.data() } : null)
            setCargando(false)
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
