import { Search } from 'lucide-react';

export default function NaoEncontrado() {
  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-12 text-center text-[14px] font-medium text-[#64748b] shadow-sm">
      <Search className="mx-auto mb-2 h-8 w-8 opacity-40" />
      <p>Não encontrado</p>
    </div>
  );
}
