import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, RotateCcw, X } from 'lucide-react';
import { pacientesApi, getApiErrorDetail } from '../../services/api';
import { maskCPF } from '../utils/formatters';
import { useToast } from '../../contexts/useToast.js';
import { usePapel } from '../../hooks/usePapel';

function mapInativoRow(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id ?? raw.pacienteId;
  if (id == null || String(id).trim() === '') return null;
  return {
    id: String(id),
    nome: String(raw.nomeCompleto ?? raw.nome ?? '').trim() || '—',
    cpfDigits: String(raw.cpf ?? '').replace(/\D/g, ''),
    dataInativacao: raw.dataInativacao ?? raw.inativadoEm ?? raw.updatedAt ?? null,
    motivo: String(raw.motivoInativacao ?? raw.motivo ?? '').trim(),
    quem: String(raw.inativadoPorNome ?? '').trim(),
  };
}

function maskCpfDigits(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (!d) return '—';
  return maskCPF(d);
}

function formatDataPt(isoOrRaw) {
  if (!isoOrRaw) return '—';
  const t = new Date(isoOrRaw);
  if (!Number.isNaN(t.getTime())) {
    return t.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }
  return String(isoOrRaw);
}

/**
 * @param {{ onPacientesCatalogRefresh?: () => void }} props
 */
export function PacientesInativadosPanel({ onPacientesCatalogRefresh }) {
  const toast = useToast();
  const { canReativarPacientes } = usePapel();
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({
    first: true,
    last: true,
    totalPages: 0,
    number: 0,
  });
  const [rows, setRows] = useState([]);
  const [reativarId, setReativarId] = useState(null);
  const [reativarSenha, setReativarSenha] = useState('');
  const [reativarSenhaErro, setReativarSenhaErro] = useState('');
  const [reativarSaving, setReativarSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pageData = await pacientesApi.listInativos({ page, size: 20 });
      const mapped = (pageData.content || []).map(mapInativoRow).filter(Boolean);
      setRows(mapped);
      setMeta({
        first: Boolean(pageData.first),
        last: Boolean(pageData.last),
        totalPages: typeof pageData.totalPages === 'number' ? pageData.totalPages : 0,
        number: typeof pageData.number === 'number' ? pageData.number : 0,
      });
    } catch (e) {
      setRows([]);
      toast.error(getApiErrorDetail(e) || 'Não foi possível carregar pacientes inativados.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPagesUi = Math.max(meta.totalPages, 1);
  const pageLabelNum = meta.number + 1;

  const closeReativarModal = () => {
    setReativarId(null);
    setReativarSenha('');
    setReativarSenhaErro('');
  };

  const handleConfirmReativar = async () => {
    if (!reativarId) return;
    setReativarSenhaErro('');
    if (!String(reativarSenha || '').trim()) {
      setReativarSenhaErro('Informe sua senha para confirmar.');
      return;
    }
    setReativarSaving(true);
    try {
      await pacientesApi.reativar(reativarId, { senha: String(reativarSenha).trim() });
      toast.success('Paciente reativado.');
      closeReativarModal();
      onPacientesCatalogRefresh?.();
      await load();
    } catch (e) {
      const st = e?.status;
      const detail = getApiErrorDetail(e);
      const pwdWrong =
        st === 401 ||
        st === 403 ||
        /senha|password|credencial|inválid|invalid/i.test(String(detail || ''));
      if (pwdWrong) {
        setReativarSenhaErro(detail || 'Senha incorreta.');
      } else {
        toast.error(detail || e.message || 'Não foi possível reativar.');
      }
    } finally {
      setReativarSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-[#0f172a]">Pacientes inativados</h3>
        <p className="mt-1 text-sm font-medium text-[#64748b]">
          Histórico preservado. Reative quando o paciente voltar a ser atendido.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">
        {loading ? (
          <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center bg-white/60">
            <Loader2 className="h-8 w-8 animate-spin text-[#00a88e]" aria-hidden />
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[11px] font-bold uppercase tracking-wide text-[#64748b]">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">CPF</th>
                <th className="px-4 py-3">Inativação</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3">Quem inativou</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[13px] font-medium text-[#64748b]">
                    Nenhum paciente inativado.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="bg-white">
                    <td className="max-w-[200px] truncate px-4 py-3 font-semibold text-[#0f172a]" title={r.nome}>
                      {r.nome}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] text-[#475569]">
                      {maskCpfDigits(r.cpfDigits)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#475569]">{formatDataPt(r.dataInativacao)}</td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-[#64748b]" title={r.motivo || undefined}>
                      {r.motivo || '—'}
                    </td>
                    <td className="max-w-[160px] truncate px-4 py-3 text-[#64748b]" title={r.quem || undefined}>
                      {r.quem || '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={!canReativarPacientes}
                        onClick={() => {
                          setReativarId(r.id);
                          setReativarSenha('');
                          setReativarSenhaErro('');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1.5 text-[12px] font-semibold text-[#0f766e] hover:bg-[#f0fdf9] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                        Reativar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e2e8f0] px-3 py-2.5 sm:px-4">
          <button
            type="button"
            disabled={meta.first || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#475569] transition-colors hover:bg-[#f8fafc] disabled:opacity-40"
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
          <p className="text-[13px] font-semibold text-[#64748b]">
            Página {pageLabelNum} de {totalPagesUi}
          </p>
          <button
            type="button"
            disabled={meta.last || loading}
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#475569] transition-colors hover:bg-[#f8fafc] disabled:opacity-40"
            aria-label="Próxima página"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>

      {reativarId ? (
        <div
          className="fixed inset-0 z-[240] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reativar-paciente-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !reativarSaving) closeReativarModal();
          }}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 id="reativar-paciente-title" className="text-[17px] font-bold text-[#0f172a]">
                Reativar paciente?
              </h3>
              <button
                type="button"
                onClick={closeReativarModal}
                disabled={reativarSaving}
                className="rounded-lg border border-[#e2e8f0] p-1.5 text-[#64748b]"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-[#64748b]">
              Informe sua senha para confirmar a reativação. O paciente voltará a aparecer na listagem principal.
            </p>
            <div className="mt-4">
              <label htmlFor="reativar-senha" className="mb-1 block text-[12px] font-semibold text-[#475569]">
                Senha <span className="text-red-600">*</span>
              </label>
              <input
                id="reativar-senha"
                type="password"
                autoComplete="current-password"
                value={reativarSenha}
                onChange={(e) => {
                  setReativarSenha(e.target.value);
                  if (reativarSenhaErro) setReativarSenhaErro('');
                }}
                className={`w-full rounded-lg border px-3 py-2 text-[14px] outline-none focus:border-[#00a88e]/40 ${
                  reativarSenhaErro ? 'border-red-400 bg-red-50/40' : 'border-[#e2e8f0]'
                }`}
                disabled={reativarSaving}
              />
              {reativarSenhaErro ? (
                <p className="mt-1 text-[12px] font-medium text-red-600">{reativarSenhaErro}</p>
              ) : null}
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={reativarSaving}
                onClick={closeReativarModal}
                className="rounded-lg border border-[#e2e8f0] px-4 py-2.5 text-[14px] font-semibold text-[#64748b]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={reativarSaving}
                onClick={handleConfirmReativar}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#00a88e] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#00967f] disabled:opacity-60"
              >
                {reativarSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
