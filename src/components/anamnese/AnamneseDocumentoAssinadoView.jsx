import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  ShieldCheck,
  Star,
  XCircle,
} from 'lucide-react';
import { anamneseApi } from '../../services/api';
import { useToast } from '../../contexts/useToast';

const TRIVALENTE = { SIM: 'Sim', NAO: 'Não' , NAO_SEI: 'Não sei' };
const METODO = {
  DISPOSITIVO_CLINICA: 'Aparelho da clínica',
  DISPOSITIVO_PROPRIO_LOCAL: 'Aparelho da paciente, presencial',
  DISPOSITIVO_PROPRIO_REMOTO: 'Aparelho da paciente, remoto',
};

function envelopeItens(conteudo) {
  if (!conteudo) return [];
  const raw = conteudo.itens ?? conteudo.envelope?.itens ?? [];
  return Array.isArray(raw) ? raw : [];
}

function maskCpf(cpf) {
  const d = String(cpf || '').replace(/\D/g, '');
  if (d.length !== 11) return cpf || '—';
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  const a = parts[0][0] || '';
  const b = parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] || '';
  return `${a}${b}`.toUpperCase();
}

function asDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatStamp(value) {
  const d = asDate(value);
  if (!d) return null;
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  return `Assinada em ${dia} às ${hora}`;
}

function formatDateTime(value) {
  const d = asDate(value);
  if (!d) return '—';
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function formatDate(value) {
  const d = asDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function diasRestantes(validadeAte) {
  const d = asDate(validadeAte);
  if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

function isSim(item) {
  const t = item?.resposta?.trivalente;
  if (typeof t === 'string') return t.toUpperCase() === 'SIM';
  if (item?.resposta?.boolean === true) return true;
  return false;
}

function chipNome(item) {
  const nome = item?.resposta?.catalogo?.nome;
  return nome && String(nome).trim() ? String(nome).trim() : null;
}

function hasChip(item) {
  return Boolean(chipNome(item));
}

function prioridade(item) {
  return String(item?.prioridade || '').toUpperCase();
}

function perguntaId(item) {
  return item?.pergunta_id || item?.perguntaId || null;
}

function highlightKind(item) {
  const prio = prioridade(item);
  const flagged = isSim(item) || hasChip(item);
  if (!flagged) return '';
  if (prio === 'CRITICA') return 'cr';
  if (prio === 'ALERTA') return 'at';
  return '';
}

function formatResposta(item) {
  const r = item?.resposta;
  if (!r) return 'não respondeu';
  if (r.texto != null && String(r.texto).trim()) return r.texto;
  if (r.numero != null) return String(r.numero);
  if (r.boolean != null) return r.boolean ? 'Sim' : 'Não';
  if (r.trivalente) return TRIVALENTE[String(r.trivalente).toUpperCase()] || r.trivalente;
  if (r.opcao?.texto) return r.opcao.texto;
  if (r.catalogo?.nome) return r.catalogo.nome;
  return 'não respondeu';
}

function groupByCategoria(itens) {
  const groups = [];
  const index = new Map();
  for (const item of itens) {
    const nome = item.categoria || 'Geral';
    if (!index.has(nome)) {
      index.set(nome, groups.length);
      groups.push({ categoria: nome, itens: [] });
    }
    groups[index.get(nome)].itens.push(item);
  }
  return groups;
}

/**
 * Documento assinado (layout renderDoc do protótipo v6.4).
 */
export function AnamneseDocumentoAssinadoView({
  pacienteId,
  preenchimentoId,
  onVoltar,
  voltarLabel = 'Voltar à ficha',
  className = '',
}) {
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

  const allItens = useMemo(
    () => envelopeItens(gravada?.conteudoJsonb).slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    [gravada]
  );

  const prontuarioIds = useMemo(() => {
    const ids = gravada?.prontuarioPerguntaIds ?? [];
    return new Set(ids.map((id) => String(id)));
  }, [gravada]);

  const isProntuario = useCallback(
    (item) => {
      const id = perguntaId(item);
      if (id && prontuarioIds.has(String(id))) return true;
      const tipo = String(item?.tipo_resposta || '');
      return tipo.startsWith('catalogo_') && hasChip(item);
    },
    [prontuarioIds]
  );

  const counts = useMemo(() => ({
    completa: allItens.length,
    criticas: allItens.filter((i) => prioridade(i) === 'CRITICA' && (isSim(i) || hasChip(i))).length,
    confirmou: allItens.filter((i) => isSim(i)).length,
    prontuario: allItens.filter((i) => isProntuario(i)).length,
  }), [allItens, isProntuario]);

  const itens = useMemo(() => {
    if (filter === 'criticas') {
      return allItens.filter((i) => prioridade(i) === 'CRITICA' && (isSim(i) || hasChip(i)));
    }
    if (filter === 'confirmou') return allItens.filter((i) => isSim(i));
    if (filter === 'prontuario') return allItens.filter((i) => isProntuario(i));
    return allItens;
  }, [allItens, filter, isProntuario]);

  const secoes = useMemo(() => groupByCategoria(itens), [itens]);
  const fatosCriticos = gravada?.fatosCriticos ?? [];

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
        {typeof onVoltar === 'function' ? (
          <button
            type="button"
            onClick={onVoltar}
            className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-[#64748b] hover:text-[#00a88e]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {voltarLabel}
          </button>
        ) : null}
        <p>Documento gravado não disponível para este preenchimento.</p>
      </div>
    );
  }

  const conteudo = gravada.conteudoJsonb || {};
  const fichaNome = gravada.anamneseNome || conteudo.anamnese_nome || 'Anamnese';
  const assinadoEm = gravada.pacienteAssinouEm || gravada.gravadoEm;
  const dias = diasRestantes(gravada.validadeAte);
  const hashOk = integridade?.valido === true;

  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-[#f8fafa] ${className}`}>
      {typeof onVoltar === 'function' ? (
        <div className="border-b border-slate-100 bg-white px-5 pt-4 sm:px-6">
          <button
            type="button"
            onClick={onVoltar}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-[#64748b] hover:text-[#00a88e]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {voltarLabel}
          </button>
        </div>
      ) : null}

      <div className="border-b border-slate-200 bg-white px-5 pb-0 pt-5 sm:px-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] border border-[#99f6e4] bg-[#f0fdfa] text-[17px] font-bold text-[#0f766e]">
              {initials(gravada.pacienteNome)}
            </div>
            <div className="min-w-0">
              <h2 className="text-[18px] font-bold leading-tight tracking-tight text-[#0f172a]">
                {gravada.pacienteNome || 'Paciente'}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[#64748b]">
                {gravada.pacienteIdade != null ? <span>{gravada.pacienteIdade} anos</span> : null}
                {gravada.pacienteIdade != null ? <span>·</span> : null}
                <span>CPF {maskCpf(gravada.pacienteCpf)}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {fichaNome}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
            {formatStamp(assinadoEm) ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#99f6e4] bg-[#f0fdfa] px-3 py-1.5 text-[11px] font-bold tracking-wide text-[#0f766e]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {formatStamp(assinadoEm)}
              </span>
            ) : null}
            <p className="text-right text-[10.5px] leading-snug text-[#64748b]">
              {gravada.validadeAte ? (
                <>
                  Válida até <b className="font-semibold text-[#475569]">{formatDate(gravada.validadeAte)}</b>
                  {dias != null ? (
                    <>
                      {' '}
                      · faltam <b className="font-semibold text-[#475569]">{Math.max(0, dias)} dias</b>
                    </>
                  ) : null}
                </>
              ) : null}
              {gravada.preenchidoPorNome ? (
                <>
                  {gravada.validadeAte ? <br /> : null}
                  Preenchida por {gravada.preenchidoPorNome}
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div
          className={`-mx-5 px-5 py-3.5 sm:-mx-6 sm:px-6 ${
            fatosCriticos.length > 0
              ? 'border-y border-red-200 bg-gradient-to-r from-[#fff5f6] via-[#fff8f9] to-white'
              : 'border-y border-emerald-100 bg-[#f0fdfa]'
          }`}
        >
          <div className={`flex items-center gap-2 text-[11.5px] font-extrabold tracking-wide ${
            fatosCriticos.length > 0 ? 'text-red-800' : 'text-[#0f766e]'
          }`}>
            {fatosCriticos.length > 0 ? (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            )}
            {fatosCriticos.length > 0
              ? `${fatosCriticos.length} ${fatosCriticos.length > 1 ? 'pontos críticos declarados' : 'ponto crítico declarado'} — confira antes de qualquer procedimento`
              : 'Nenhum ponto crítico declarado nesta ficha'}
          </div>
          {fatosCriticos.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {fatosCriticos.map((fato) => (
                <span
                  key={fato.texto}
                  className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-red-800"
                >
                  {fato.icone === 'pron' ? <Star className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {fato.texto}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 py-3">
          {[
            { id: 'completa', label: 'Ficha completa', n: counts.completa },
            { id: 'criticas', label: 'Só as críticas', n: counts.criticas, icon: AlertTriangle },
            { id: 'confirmou', label: 'Só o que ela confirmou', n: counts.confirmou },
            { id: 'prontuario', label: 'Foi pro prontuário', n: counts.prontuario, icon: Star },
          ].map((f) => {
            const Icon = f.icon;
            const on = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold ${
                  on ? 'bg-[#00a88e] text-white' : 'bg-slate-100 text-[#64748b] hover:bg-slate-200'
                }`}
              >
                {Icon ? <Icon className="h-3 w-3" /> : null}
                {f.label}
                <span className={`rounded-full px-1.5 text-[10px] ${on ? 'bg-white/20' : 'bg-white text-[#94a3b8]'}`}>
                  {f.n}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        {secoes.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-[#94a3b8]">Nenhuma pergunta neste filtro.</p>
        ) : (
          secoes.map((secao) => (
            <section key={secao.categoria}>
              <h4 className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {secao.categoria}
                <span className="font-semibold normal-case tracking-normal text-slate-400">
                  {secao.itens.length}
                </span>
              </h4>
              <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {secao.itens.map((item) => {
                  const kind = highlightKind(item);
                  const chip = chipNome(item);
                  const noProntuario = isProntuario(item);
                  return (
                    <div
                      key={item.pergunta_id || `${item.ordem}-${item.pergunta}`}
                      className={`px-4 py-3 ${
                        kind === 'cr'
                          ? 'border-l-[3px] border-l-red-500 bg-red-50/40'
                          : kind === 'at'
                            ? 'border-l-[3px] border-l-amber-400 bg-amber-50/40'
                            : ''
                      }`}
                    >
                      <p className="text-[13px] font-semibold text-[#0f172a]">{item.pergunta}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {chip ? (
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[12px] font-semibold text-[#334155]">
                            {chip}
                          </span>
                        ) : (
                          <span className="text-[13px] text-[#334155]">{formatResposta(item)}</span>
                        )}
                        {noProntuario ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7c3aed]">
                            <Star className="h-3 w-3" />
                            Foi pro prontuário
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}

        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3 text-[13px] font-bold text-[#0f172a]">
            Declaração assinada
          </div>
          {(conteudo.texto_declaracao || gravada.textoDeclaracao) ? (
            <blockquote className="px-4 py-3 text-[13px] italic leading-relaxed text-[#475569]">
              “{conteudo.texto_declaracao || gravada.textoDeclaracao}”
            </blockquote>
          ) : null}
          <div className="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              {gravada.assinaturaPaciente ? (
                <img src={gravada.assinaturaPaciente} alt="Assinatura" className="mx-auto max-h-20 object-contain" />
              ) : (
                <p className="py-6 text-center text-[12px] text-[#94a3b8]">Sem imagem de assinatura</p>
              )}
              <p className="mt-2 text-center text-[12px] font-bold text-[#0f172a]">{gravada.pacienteNome}</p>
              <p className="text-center text-[11px] text-[#64748b]">CPF {maskCpf(gravada.pacienteCpf)}</p>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[12px]">
              <dt className="text-[#94a3b8]">Assinado em</dt>
              <dd className="font-semibold text-[#334155]">{formatDateTime(assinadoEm)}</dd>
              {gravada.metodoAssinaturaCodigo ? (
                <>
                  <dt className="text-[#94a3b8]">Como</dt>
                  <dd className="font-semibold text-[#334155]">
                    {METODO[gravada.metodoAssinaturaCodigo] || gravada.metodoAssinaturaCodigo}
                  </dd>
                </>
              ) : null}
              {gravada.ip ? (
                <>
                  <dt className="text-[#94a3b8]">Endereço IP</dt>
                  <dd className="font-semibold text-[#334155]">{gravada.ip}</dd>
                </>
              ) : null}
              {gravada.userAgent ? (
                <>
                  <dt className="text-[#94a3b8]">Aparelho</dt>
                  <dd className="break-all font-semibold text-[#334155]">{gravada.userAgent}</dd>
                </>
              ) : null}
              {gravada.geolocalizacao ? (
                <>
                  <dt className="text-[#94a3b8]">Local</dt>
                  <dd className="font-semibold text-[#334155]">{gravada.geolocalizacao}</dd>
                </>
              ) : null}
            </dl>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center">
            <ShieldCheck className={`h-5 w-5 shrink-0 ${hashOk ? 'text-emerald-600' : 'text-[#00a88e]'}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-[#0f172a]">
                {integridade
                  ? integridade.valido
                    ? 'Documento íntegro — nada foi alterado desde a assinatura'
                    : 'Hash divergente — o conteúdo não confere com a assinatura'
                  : 'SHA-256 do conteúdo gravado'}
              </p>
              {gravada.conteudoHash ? (
                <code className="mt-0.5 block break-all font-mono text-[10px] text-[#64748b]">
                  SHA-256 · {gravada.conteudoHash}
                </code>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleVerificar}
              disabled={verificando}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#00a88e] px-3 py-2 text-[12px] font-bold text-white hover:bg-[#00967f] disabled:opacity-60"
            >
              {verificando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              Conferir
            </button>
          </div>
          {integridade && !integridade.valido ? (
            <div className="flex items-center gap-2 px-4 pb-3 text-[12px] font-bold text-red-600">
              <XCircle className="h-4 w-4" />
              Hash divergente
            </div>
          ) : null}
        </div>

        <p className="text-center text-[11px] text-[#94a3b8]">
          Documento imutável. Correções entram como nova anamnese, preservando esta.
        </p>
      </div>
    </div>
  );
}
