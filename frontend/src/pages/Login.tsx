import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { login, token, ready } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  if (ready && token) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
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
        onSubmit={onSubmit}
        className="relative w-full max-w-md bg-brand-charcoal border border-brand-lime/40 rounded-2xl shadow-lime p-8 space-y-5"
      >
        <div className="flex flex-col items-center text-center gap-3">
          <img
            src="/logo.png"
            alt="NORDEPO"
            className="h-24 w-24 rounded-full object-cover shadow-lime"
          />
          <div>
            <p className="font-display text-4xl text-white tracking-wide">NORDEPO</p>
            <p className="text-brand-mute mt-1 text-sm">Ingresá para gestionar ventas y stock</p>
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
        <label className="block text-sm">
          <span className="text-zinc-300">Contraseña</span>
          <input
            type="password"
            className="mt-1 w-full rounded-lg border border-white/15 bg-brand-ink text-white px-3 py-2 focus:outline-none focus:border-brand-lime"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary py-2.5"
        >
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
