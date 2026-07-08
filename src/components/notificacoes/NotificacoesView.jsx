import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Stethoscope,
  Trash2,
  XCircle,
} from 'lucide-react';
import { notificacoesApi } from '../../services/api.js';
import { useToast } from '../../contexts/useToast.js';
import {
  CHIP_FILTERS,
  GRUPO_LABELS,
  countByChip,
  formatarMensagemNotificacao,
  formatarTempoRelativo,
  groupNotificacoes,
} from '../../utils/notificacaoFormat.js';
import { ConfigCardStackSkeleton } from '../shared/ConfigPanelSkeletons';

const GRUPO_ORDER = ['hoje', 'semana', 'anteriores'];

const TIPO_META = {
  SUGESTAO_PROCEDIMENTO: {
    Icon: Stethoscope,
    iconClass: 'text-[#00a88e] bg-teal-50',
  },
  paciente_confirmou: {
    Icon: CheckCircle2,
    iconClass: 'text-emerald-600 bg-emerald-50',
  },
  paciente_recusou: {
    Icon: XCircle,
    iconClass: 'text-red-600 bg-red-50',
  },
  paciente_sem_resposta: {
    Icon: HelpCircle,
    iconClass: 'text-amber-600 bg-amber-50',
  },
  agenda_cancelada: {
    Icon: CalendarX2,
    iconClass: 'text-red-600 bg-red-50',
  },
  agenda_reagendada: {
    Icon: CalendarClock,
    iconClass: 'text-blue-600 bg-blue-50',
  },
};

function getTipoMeta(tipo) {
  return (
    TIPO_META[tipo] ?? {
      Icon: HelpCircle,
      iconClass: 'text-[#64748b] bg-[#f1f5f9]',
    }
  );
}

function NotificacaoCard({ notificacao, onAction, onDelete, deletando }) {
  const { Icon, iconClass } = getTipoMeta(notificacao.tipo);
  const unread = !notificacao.lida;

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (deletando) return;
    onDelete(notificacao);
  };

  const handleDeleteKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (!deletando) onDelete(notificacao);
    }
  };

  return (
    <button
      type="button"
      onClick={() => onAction(notificacao)}
      className={`flex w-full items-start gap-3 rounded-xl border border-[#e2e8f0] bg-white p-4 text-left transition-colors hover:bg-[#f8fafc] ${
        unread ? 'border-l-4 border-l-[#00a88e]' : ''
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
        aria-hidden
      >
        <Icon className="h-5 w-5" strokeWidth={2.25} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium leading-snug text-[#0f172a]">
          {formatarMensagemNotificacao(notificacao)}
        </p>
        <p className="mt-1 text-[12px] text-[#64748b]">{formatarTempoRelativo(notificacao.criadoEm)}</p>
      </div>
      <span
        role="button"
        tabIndex={0}
        aria-label="Excluir notificação"
        aria-disabled={deletando}
        onClick={handleDeleteClick}
        onKeyDown={handleDeleteKeyDown}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#94a3b8] transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 ${
          deletando ? 'cursor-default opacity-60' : 'cursor-pointer'
        }`}
      >
        {deletando ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
        ) : (
          <Trash2 className="h-4 w-4" strokeWidth={2.25} />
        )}
      </span>
    </button>
  );
}

export default function NotificacoesView({
  onVoltar,
  onNavigateToCatalogo,
  onNavigateToAgenda,
  onNotificacoesChanged,
}) {
  const { error: toastError } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chipAtivo, setChipAtivo] = useState('todas');
  const [naoLidasCount, setNaoLidasCount] = useState(0);
  const [marcandoTodas, setMarcandoTodas] = useState(false);
  const [deletandoIds, setDeletandoIds] = useState(() => new Set());
  const [limpandoLidas, setLimpandoLidas] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [countRes, page] = await Promise.all([
        notificacoesApi.contarNaoLidas(),
        notificacoesApi.listar({ page: 0, size: 100 }),
      ]);
      setNaoLidasCount(typeof countRes?.count === 'number' ? countRes.count : 0);
      setItems(Array.isArray(page?.content) ? page.content : []);
    } catch {
      setError('Não foi possível carregar as notificações.');
      toastError('Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const chipCounts = useMemo(() => countByChip(items), [items]);

  const groups = useMemo(() => groupNotificacoes(items, chipAtivo), [items, chipAtivo]);

  const filteredCount = chipCounts[chipAtivo] ?? 0;

  const temLidas = useMemo(() => items.some((it) => it.lida), [items]);

  const handleMarcarTodasLidas = async () => {
    if (naoLidasCount <= 0 || marcandoTodas) return;
    setMarcandoTodas(true);
    try {
      await notificacoesApi.marcarTodasLidas();
      setItems((prev) => prev.map((it) => ({ ...it, lida: true })));
      setNaoLidasCount(0);
      onNotificacoesChanged?.();
    } catch {
      toastError('Erro ao marcar todas como lidas');
    } finally {
      setMarcandoTodas(false);
    }
  };

  const handleCardAction = async (n) => {
    if (!n.lida) {
      try {
        await notificacoesApi.marcarLida(n.id);
        setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, lida: true } : it)));
        setNaoLidasCount((c) => Math.max(0, c - 1));
        onNotificacoesChanged?.();
      } catch {
        toastError('Erro ao marcar como lida');
        return;
      }
    }

    if (n.tipo === 'SUGESTAO_PROCEDIMENTO') {
      onNavigateToCatalogo?.();
    } else {
      onNavigateToAgenda?.();
    }
  };

  const handleDeletar = async (n) => {
    if (deletandoIds.has(n.id)) return;
    setDeletandoIds((prev) => {
      const next = new Set(prev);
      next.add(n.id);
      return next;
    });
    const prevItems = items;
    const prevCount = naoLidasCount;
    setItems((prev) => prev.filter((it) => it.id !== n.id));
    if (!n.lida) setNaoLidasCount((c) => Math.max(0, c - 1));
    try {
      await notificacoesApi.deletar(n.id);
      onNotificacoesChanged?.();
    } catch {
      setItems(prevItems);
      setNaoLidasCount(prevCount);
      toastError('Erro ao excluir notificação');
    } finally {
      setDeletandoIds((prev) => {
        const next = new Set(prev);
        next.delete(n.id);
        return next;
      });
    }
  };

  const handleLimparLidas = async () => {
    if (limpandoLidas || !items.some((it) => it.lida)) return;
    if (!window.confirm('Remover todas as notificações lidas? Esta ação não pode ser desfeita.')) {
      return;
    }
    setLimpandoLidas(true);
    const prevItems = items;
    setItems((prev) => prev.filter((it) => !it.lida));
    try {
      await notificacoesApi.limparLidas();
      onNotificacoesChanged?.();
    } catch {
      setItems(prevItems);
      toastError('Erro ao limpar notificações lidas');
    } finally {
      setLimpandoLidas(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
          {typeof onVoltar === 'function' ? (
            <button
              type="button"
              onClick={onVoltar}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-app-border bg-white px-3 text-[13px] font-semibold text-[#64748b] transition-colors hover:bg-app-nav-hover active:bg-app-nav-active sm:px-4"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
              Voltar
            </button>
          ) : null}
          <h1 className="text-[20px] font-bold text-[#0f172a]">Notificações</h1>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {naoLidasCount > 0 ? (
            <button
              type="button"
              onClick={handleMarcarTodasLidas}
              disabled={marcandoTodas}
              className="text-[13px] font-medium text-[#00a88e] hover:underline disabled:opacity-50"
            >
              {marcandoTodas ? 'Marcando…' : 'Marcar todas como lidas'}
            </button>
          ) : null}
          {temLidas ? (
            <button
              type="button"
              onClick={handleLimparLidas}
              disabled={limpandoLidas}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-[#64748b] transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              {limpandoLidas ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} aria-hidden />
              ) : (
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              )}
              {limpandoLidas ? 'Limpando…' : 'Limpar lidas'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {CHIP_FILTERS.map((chip) => {
          const active = chipAtivo === chip.id;
          const count = chipCounts[chip.id] ?? 0;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setChipAtivo(chip.id)}
              className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                active
                  ? 'bg-[#00a88e] text-white'
                  : 'border border-[#e2e8f0] bg-white text-[#475569] hover:bg-[#f8fafc]'
              }`}
            >
              {chip.label} ({count})
            </button>
          );
        })}
      </div>

      {loading ? <ConfigCardStackSkeleton count={5} className="h-[72px]" /> : null}

      {!loading && error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-[14px] font-medium text-red-800">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="mt-3 text-[13px] font-medium text-[#00a88e] hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      ) : null}

      {!loading && !error && filteredCount === 0 ? (
        <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-10 text-center">
          <p className="text-[14px] font-medium text-[#64748b]">Nenhuma notificação neste filtro</p>
        </div>
      ) : null}

      {!loading && !error && filteredCount > 0 ? (
        <div className="space-y-6">
          {GRUPO_ORDER.map((grupoId) => {
            const list = groups[grupoId];
            if (!list?.length) return null;
            return (
              <section key={grupoId}>
                <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-[#64748b]">
                  {GRUPO_LABELS[grupoId]}
                </h2>
                <div className="space-y-2">
                  {list.map((n) => (
                    <NotificacaoCard
                      key={n.id}
                      notificacao={n}
                      onAction={handleCardAction}
                      onDelete={handleDeletar}
                      deletando={deletandoIds.has(n.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
