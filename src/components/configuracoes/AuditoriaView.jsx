import React, { useState, useEffect } from 'react';
import { 
  Search, 
  User, 
  Calendar, 
  FileText, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  History,
  Activity
} from 'lucide-react';
import { auditoriaApi, equipeApi } from '../../services/api';

const ENTIDADES = [
  { value: '', label: 'Todas as Entidades' },
  { value: 'Paciente', label: 'Paciente' },
  { value: 'Agenda', label: 'Agenda' },
  { value: 'Agendamento', label: 'Agendamento' },
  { value: 'Procedimento', label: 'Procedimento' },
];

export function AuditoriaView() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ content: [], totalPages: 0, number: 0 });
  const [page, setPage] = useState(0);
  const [roleUserId, setRoleUserId] = useState('');
  const [entidade, setEntidade] = useState('');
  const [equipe, setEquipe] = useState([]);

  useEffect(() => {
    fetchEquipe();
  }, []);

  useEffect(() => {
    fetchAuditoria();
  }, [page, roleUserId, entidade]);

  async function fetchEquipe() {
    try {
      const res = await equipeApi.list();
      setEquipe(res || []);
    } catch (err) {
      console.error('Erro ao buscar equipe:', err);
    }
  }

  async function fetchAuditoria() {
    setLoading(true);
    try {
      const res = await auditoriaApi.list({
        page,
        size: 15,
        roleUserId: roleUserId || undefined,
        entidade: entidade || undefined,
      });
      setData(res);
    } catch (err) {
      console.error('Erro ao buscar auditoria:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatData(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getIconForEntidade(ent) {
    switch (ent?.toLowerCase()) {
      case 'paciente': return <User className="h-4 w-4" />;
      case 'agenda': return <Calendar className="h-4 w-4" />;
      case 'agendamento': return <Calendar className="h-4 w-4" />;
      case 'procedimento': return <Activity className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4 border-b border-[#e2e8f0] pb-6">
        <div className="flex flex-1 min-w-[200px] flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
            Profissional
          </label>
          <select
            value={roleUserId}
            onChange={(e) => { setRoleUserId(e.target.value); setPage(0); }}
            className="h-10 rounded-lg border border-[#e2e8f0] bg-white px-3 text-[13px] font-medium text-[#0f172a] focus:border-[#00a88e] focus:ring-1 focus:ring-[#00a88e]"
          >
            <option value="">Todos os Profissionais</option>
            {equipe.map(u => (
              <option key={u.id} value={u.id}>
                {u.nomeCompleto} ({u.roleNome})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-1 min-w-[200px] flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
            Entidade
          </label>
          <select
            value={entidade}
            onChange={(e) => { setEntidade(e.target.value); setPage(0); }}
            className="h-10 rounded-lg border border-[#e2e8f0] bg-white px-3 text-[13px] font-medium text-[#0f172a] focus:border-[#00a88e] focus:ring-1 focus:ring-[#00a88e]"
          >
            {ENTIDADES.map(e => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-[#f8fafc] text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
            <tr>
              <th className="px-4 py-3">Data/Hora</th>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Ação</th>
              <th className="px-4 py-3">Entidade</th>
              <th className="px-4 py-3">Descrição</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {loading ? (
              <tr>
                <td colSpan="5" className="py-20 text-center">
                  <div className="flex flex-col items-center gap-2 text-[#64748b]">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#00a88e] border-t-transparent" />
                    <span className="font-medium">Carregando histórico...</span>
                  </div>
                </td>
              </tr>
            ) : data.content.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-20 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#94a3b8]">
                    <History className="h-10 w-10 opacity-20" />
                    <span className="font-medium text-[14px]">Nenhuma ação encontrada</span>
                  </div>
                </td>
              </tr>
            ) : (
              data.content.map((item) => (
                <tr key={item.id} className="hover:bg-[#fbfcfd]">
                  <td className="whitespace-nowrap px-4 py-3.5 font-medium text-[#0f172a]">
                    {formatData(item.criadoEm)}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col">
                      <span className="font-semibold text-[#0f172a]">{item.nomeUsuario}</span>
                      <span className="text-[11px] font-medium text-[#64748b]">{item.papel}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center rounded-md bg-[#f1f5f9] px-2 py-1 text-[11px] font-bold text-[#475569]">
                      {item.acao}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2 text-[#64748b]">
                      {getIconForEntidade(item.entidade)}
                      <span className="font-medium">{item.entidade}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-[#475569] leading-relaxed max-w-[300px]">
                    {item.descricao || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[#e2e8f0] pt-6">
          <p className="text-[12px] font-medium text-[#64748b]">
            Página <span className="text-[#0f172a] font-bold">{data.number + 1}</span> de <span className="text-[#0f172a] font-bold">{data.totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={data.number === 0 || loading}
              onClick={() => setPage(p => p - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#64748b] transition-colors hover:bg-[#f8fafc] disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={data.number >= data.totalPages - 1 || loading}
              onClick={() => setPage(p => p + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#64748b] transition-colors hover:bg-[#f8fafc] disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
