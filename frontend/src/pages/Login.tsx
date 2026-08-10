import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import PasswordInput from '../components/PasswordInput'

type Mode = 'login' | 'recover'

export default function Login() {
  const { login, token, ready } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  if (ready && token) return <Navigate to="/" replace />

  async function onLogin(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await login(username, password)
      toast.success('Bienvenido')
    } catch {
      toast.error('Usuario o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  async function onRecover(e: FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas nuevas no coinciden')
      return
    }
    if (newPassword.length < 4) {
      toast.error('La nueva contraseña debe tener al menos 4 caracteres')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/reset-with-code', {
        username: username.trim(),
        reset_code: resetCode,
        new_password: newPassword,
      })
      toast.success('Contraseña restablecida. Ingresá con la nueva clave.')
      setMode('login')
      setPassword('')
      setResetCode('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'No se pudo restablecer'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 relative overflow-hidden bg-brand-black">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, #C8FF00 0 18px, transparent 18px 42px), repeating-linear-gradient(45deg, #161616 0 28px, transparent 28px 56px)',
          backgroundBlendMode: 'overlay',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-brand-black/80 to-brand-black" />

      <form
        onSubmit={mode === 'login' ? onLogin : onRecover}
        className="relative w-full max-w-md bg-brand-charcoal border border-brand-lime/40 rounded-2xl shadow-lime p-8 space-y-5"
      >
        <div className="flex flex-col items-center text-center gap-3">
          <img
            src="/nordepo-logo.png"
            alt="NORDEPO"
            className="h-24 w-24 rounded-full object-cover shadow-lime"
          />
          <div>
            <p className="font-display text-4xl text-white tracking-wide">NORDEPO</p>
            <p className="text-brand-mute mt-1 text-sm">
              {mode === 'login'
                ? 'Ingresá para gestionar ventas y stock'
                : 'Restablecé tu contraseña con el código de recuperación'}
            </p>
          </div>
        </div>

        <label className="block text-sm">
          <span className="text-zinc-300">Usuario</span>
          <input
            className="mt-1 w-full rounded-lg border border-white/15 bg-brand-ink text-white px-3 py-2 focus:outline-none focus:border-brand-lime"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>

        {mode === 'login' ? (
          <label className="block text-sm">
            <span className="text-zinc-300">Contraseña</span>
            <PasswordInput
              className="mt-1 w-full rounded-lg border border-white/15 bg-brand-ink text-white px-3 py-2 focus:outline-none focus:border-brand-lime"
              eyeClassName="text-zinc-400 hover:text-brand-lime"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
        ) : (
          <>
            <label className="block text-sm">
              <span className="text-zinc-300">Código de recuperación</span>
              <PasswordInput
                className="mt-1 w-full rounded-lg border border-white/15 bg-brand-ink text-white px-3 py-2 focus:outline-none focus:border-brand-lime"
                eyeClassName="text-zinc-400 hover:text-brand-lime"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                autoComplete="off"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-300">Nueva contraseña</span>
              <PasswordInput
                className="mt-1 w-full rounded-lg border border-white/15 bg-brand-ink text-white px-3 py-2 focus:outline-none focus:border-brand-lime"
                eyeClassName="text-zinc-400 hover:text-brand-lime"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-300">Repetir nueva contraseña</span>
              <PasswordInput
                className="mt-1 w-full rounded-lg border border-white/15 bg-brand-ink text-white px-3 py-2 focus:outline-none focus:border-brand-lime"
                eyeClassName="text-zinc-400 hover:text-brand-lime"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
          </>
        )}

        <button type="submit" disabled={loading} className="w-full btn-primary py-2.5">
          {loading
            ? mode === 'login'
              ? 'Ingresando…'
              : 'Restableciendo…'
            : mode === 'login'
              ? 'Ingresar'
              : 'Restablecer contraseña'}
        </button>

        <button
          type="button"
          className="w-full text-sm text-brand-lime/90 hover:text-brand-lime underline-offset-2 hover:underline"
          onClick={() => setMode(mode === 'login' ? 'recover' : 'login')}
        >
          {mode === 'login' ? '¿Olvidaste tu contraseña?' : 'Volver al ingreso'}
        </button>
      </form>
    </div>
  )
}
