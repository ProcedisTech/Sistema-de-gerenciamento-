import { Link } from 'react-router';
import { Search } from 'lucide-react';
import { caminhos } from './caminhos';

export default function PaginaNaoEncontrada() {
  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-12 text-center text-[14px] font-medium text-[#64748b] shadow-sm">
      <Search className="mx-auto mb-2 h-8 w-8 opacity-40" />
      <p>Página não encontrada</p>
      <Link to={caminhos.pacientes()} className="mt-2 inline-block font-semibold text-[#00a88e] hover:underline">
        Ir para Pacientes
      </Link>
    </div>
  );
}
