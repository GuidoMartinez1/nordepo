import type { ReactNode } from 'react'
import {
  Backpack,
  Bike,
  CircleDot,
  Dumbbell,
  Footprints,
  Package,
  Shirt,
  Trophy,
  Watch,
  Waves,
  Zap,
} from 'lucide-react'

export function getCategoryIcon(nombre: string, className = 'h-6 w-6'): ReactNode {
  const n = nombre.toLowerCase()
  if (
    n.includes('indumentaria') ||
    n.includes('ropa') ||
    n.includes('remera') ||
    n.includes('pantal') ||
    n.includes('campera')
  ) {
    return <Shirt className={className} />
  }
  if (n.includes('calzado') || n.includes('zapatilla') || n.includes('zapato')) {
    return <Footprints className={className} />
  }
  if (
    n.includes('pesa') ||
    n.includes('gym') ||
    n.includes('fitness') ||
    n.includes('muscul') ||
    n.includes('accesorio')
  ) {
    return <Dumbbell className={className} />
  }
  if (
    n.includes('pelota') ||
    n.includes('fútbol') ||
    n.includes('futbol') ||
    n.includes('basket') ||
    n.includes('vóley') ||
    n.includes('voley')
  ) {
    return <CircleDot className={className} />
  }
  if (n.includes('natación') || n.includes('natacion') || n.includes('pileta')) {
    return <Waves className={className} />
  }
  if (n.includes('cicl') || n.includes('bici')) {
    return <Bike className={className} />
  }
  if (n.includes('running') || n.includes('correr') || n.includes('atletismo')) {
    return <Zap className={className} />
  }
  if (n.includes('mochila') || n.includes('bolso') || n.includes('riñonera')) {
    return <Backpack className={className} />
  }
  if (n.includes('reloj') || n.includes('wearable')) {
    return <Watch className={className} />
  }
  if (n.includes('sin categoría') || n.includes('sin categoria')) {
    return <Package className={className} />
  }
  return <Trophy className={className} />
}
