import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { anamneseApi } from '../../services/api';
import { useToast } from '../../contexts/useToast';

const FILTERS = [
  { id: 'completa', label: 'Completa' },
  { id: 'criticas', label: 'Críticas' },
  { id: 'confirmou', label: 'Confirmou' },
  { id: 'prontuario', label: 'Prontuário' },
];

function formatResposta(item) {
  const r = item.resposta;
  if (!r) return '—';
  if (r.texto != null) return r.texto;
  if (r.numero != null) return String(r.numero);
  if (r.boolean != null) return r.boolean ? 'Sim' : 'Não';
  if (r.trivalente) return r.trivalente;
  if (r.opcao?.texto) return r.opcao.texto;
  if (r.catalogo?.nome) return r.catalogo.nome;
  return '—';
}

function envelopeItens(conteudo) {
  if (!conteudo) return [];
  const raw = conteudo.itens ?? conteudo.envelope?.itens ?? [];
  return Array.isArray(raw) ? raw : [];
}

/**
 * Visualização do documento assinado/gravado (envelope imutável).
 */
export function AnamneseDocumentoAssinadoView({ pacienteId, preenchimentoId, className = '' }) {
  const toast = useToast();
  const [gravada, setGravada] = useState(null);
  const [integridade, setIntegridade] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verificando, setVerificando] = useState(false);
  const [filter, setFilter] = useState('completa');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pacienteId || !preenchimentoId) return;
    setLoading(true);
    setError(null);
    anamneseApi
      .getGravada(pacienteId, preenchimentoId)
      .then(setGravada)
      .catch((err) => {
        setError(err);
        setGravada(null);
      })
      .finally(() => setLoading(false));
  }, [pacienteId, preenchimentoId]);

  const itens = useMemo(() => {
    const list = envelopeItens(gravada?.conteudoJsonb).slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    if (filter === 'criticas') {
      return list.filter((i) => String(i.prioridade || '').toUpperCase() === 'CRITICA');
    }
    if (filter === 'confirmou') {
      return list.filter((i) => {
        const t = i.resposta?.trivalente ?? i.resposta?.boolean;
        return t === 'SIM' || t === true;
      });
    }
    if (filter === 'prontuario') {
      return list.filter((i) => String(i.tipo_resposta || '').startsWith('catalogo_'));
    }
    return list;
  }, [gravada, filter]);

  const criticas = useMemo(
    () => envelopeItens(gravada?.conteudoJsonb).filter((i) => String(i.prioridade || '').toUpperCase() === 'CRITICA'),
    [gravada]
  );

  const handleVerificar = useCallback(async () => {
    setVerificando(true);
    try {
      const result = await anamneseApi.verificarGravada(pacienteId, preenchimentoId);
      setIntegridade(result);
      if (result.valido) toast.success('Integridade verificada com sucesso.');
      else toast.error('Hash não confere — documento pode ter sido alterado.');
    } catch (err) {
      toast.error(err.message || 'Erro ao verificar integridade.');
    } finally {
      setVerificando(false);
    }
  }, [pacienteId, preenchimentoId, toast]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <Loader2 className="h-5 w-5 animate-spin text-[#00a88e]" />
        <span className="ml-2 text-[13px] text-[#64748b]">Carregando documento assinado...</span>
      </div>
    );
  }

  if (error || !gravada) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-[13px] text-[#64748b] ${className}`}>
        Documento gravado não disponível para este preenchimento.
      </div>
    );
  }

  const conteudo = gravada.conteudoJsonb || {};

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-start gap-3">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#00a88e]" />
          <div className="min-w-0">
            <h4 className="text-[15px] font-bold text-[#0f172a]">
              {gravada.anamneseNome || conteudo.anamnese_nome || 'Anamnese assinada'}
            </h4>
            <p className="text-[12px] text-[#64748b]">
              Gravado em{' '}
              {gravada.gravadoEm
                ? new Date(gravada.gravadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                : '—'}
            </p>
            {gravada.pacienteNome && (
              <p className="text-[12px] text-[#64748b]">Paciente: {gravada.pacienteNome}</p>
            )}
          </div>
        </div>

        {(conteudo.texto_declaracao || gravada.textoDeclaracao) && (
          <blockquote className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[12px] italic text-[#475569]">
            {conteudo.texto_declaracao || gravada.textoDeclaracao}
          </blockquote>
        )}
      </div>

      {criticas.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-[13px] font-bold text-red-800">
              {criticas.length} resposta(s) crítica(s)
            </span>
          </div>
          <ul className="space-y-1">
            {criticas.map((item) => (
              <li key={item.pergunta_id || item.pergunta} className="text-[12px] text-red-700">
                <strong>{item.pergunta}</strong>: {formatResposta(item)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-bold ${
              filter === f.id ? 'bg-[#00a88e] text-white' : 'bg-slate-100 text-[#64748b]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {itens.length === 0 ? (
          <p className="p-4 text-center text-[13px] text-[#94a3b8]">Nenhum item neste filtro.</p>
        ) : (
          itens.map((item) => (
            <div key={item.pergunta_id || `${item.ordem}-${item.pergunta}`} className="px-4 py-3">
              <div className="flex items-start gap-2">
                <span className="shrink-0 font-bold tabular-nums text-[#64748b]">{item.ordem}.</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#0f172a]">{item.pergunta}</p>
                  {item.categoria && (
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{item.categoria}</p>
                  )}
                  <p className="mt-1 text-[13px] text-[#334155]">{formatResposta(item)}</p>
                </div>
                {String(item.prioridade || '').toUpperCase() === 'CRITICA' && (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {(gravada.assinaturaPaciente || gravada.pacienteAssinouEm) && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <h4 className="text-[14px] font-bold text-[#0f172a]">Assinatura do paciente</h4>
          </div>
          {gravada.assinaturaPaciente && (
            <div className="mb-2 flex justify-center rounded-lg border border-white bg-white p-2">
              <img src={gravada.assinaturaPaciente} alt="Assinatura" className="max-h-20 object-contain" />
            </div>
          )}
          {gravada.pacienteAssinouEm && (
            <p className="text-center text-[11px] text-[#64748b]">
              Assinado em {new Date(gravada.pacienteAssinouEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
            </p>
          )}
          {gravada.metodoAssinaturaCodigo && (
            <p className="mt-1 text-center text-[11px] text-[#64748b]">
              Método: {gravada.metodoAssinaturaCodigo}
            </p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#00a88e]" />
          <span className="text-[13px] font-bold text-[#0f172a]">Integridade do documento</span>
        </div>
        {gravada.conteudoHash && (
          <p className="mb-3 break-all font-mono text-[10px] text-[#64748b]">{gravada.conteudoHash}</p>
        )}
        <button
          type="button"
          onClick={handleVerificar}
          disabled={verificando}
          className="inline-flex items-center gap-2 rounded-lg bg-[#00a88e] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#00967f] disabled:opacity-60"
        >
          {verificando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          Verificar hash
        </button>
        {integridade && (
          <div className={`mt-3 flex items-center gap-2 text-[12px] font-bold ${integridade.valido ? 'text-emerald-700' : 'text-red-600'}`}>
            {integridade.valido ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {integridade.valido ? 'Documento íntegro' : 'Hash divergente'}
          </div>
        )}
      </div>
    </div>
  );
}
