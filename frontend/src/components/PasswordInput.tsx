import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** Color del ojito (ej. en login oscuro: text-zinc-400) */
  eyeClassName?: string
}

export default function PasswordInput({
  className = '',
  eyeClassName = 'text-slate-500 hover:text-slate-800',
  ...props
}: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`pr-10 ${className}`} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded focus:outline-none ${eyeClassName}`}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}
