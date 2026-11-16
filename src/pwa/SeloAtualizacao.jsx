import { useSyncExternalStore } from 'react'
import { RefreshCw } from 'lucide-react'
import { aoMudarSelo, lerSelo } from './seloAtualizacao'

export default function SeloAtualizacao() {
  const aplicar = useSyncExternalStore(aoMudarSelo, lerSelo)
  if (!aplicar) return null
  return (
    <button
      type="button"
      aria-label="Atualização pendente"
      onClick={aplicar}
      style={{ fontFamily: 'Inter, sans-serif' }}
      className="relative inline-flex h-10 min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-3 text-[13px] font-medium text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]/60"
    >
      <RefreshCw className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
      <span className="hidden sm:inline">Atualização pendente</span>
      <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#14B8A6] sm:hidden" />
    </button>
  )
}
