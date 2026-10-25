import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Lock, Trash2 } from 'lucide-react';
import { notificacoesApi } from '../../services/api.js';
import { useToast } from '../../contexts/useToast.js';
import {
  CHIP_FILTERS,
  GRUPO_LABELS,
  GRUPO_ORDER,
  getTipoMeta,
  motivoTexto,
  countByChip,
  formatarMensagemNotificacao,
  formatarTempoRelativo,
  groupNotificacoes,
} from '../../utils/notificacaoFormat.js';
import { ConfigCardStackSkeleton } from '../shared/ConfigPanelSkeletons';
import { ViewportDialog } from '../shared/ViewportDialog.jsx';
import { useFusoClinica } from '../hooks/useFusoClinica.js';

function NotificacaoCard({ notificacao, fuso, agora, onAction, onDelete, deletando }) {
  const { Icon, iconClass } = getTipoMeta(notificacao.tipo);
  const unread = !notificacao.lida && notificacao.acendeSino;
  const motivo = motivoTexto(notificacao);

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
          {notificacao.nivel === 'URGENTE' ? (
            <span className="ml-1 inline-flex translate-y-[-1px] items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">
              Urgente
            </span>
          ) : null}
        </p>
        <p className="mt-1 text-[12px] text-[#64748b]">
          {formatarTempoRelativo(notificacao.criadoEm, agora, fuso)}
          {notificacao.autorNome ? ` · por ${notificacao.autorNome}` : ''}
        </p>
        {motivo ? <p className="mt-1 text-[12px] text-[#94a3b8]">{motivo}</p> : null}
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

// Sem a permissão "Ver notificações": cartão de cadeado, e a API nem é chamada (o conteúdo nem monta).
export default function NotificacoesView({ semAcesso = false, ...props }) {
  if (!semAcesso) return <NotificacoesConteudo {...props} />;
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-5 flex items-center gap-2.5">
        <button
          type="button"
          onClick={props.onVoltar}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-app-border bg-white px-3 text-[13px] font-semibold text-[#64748b] transition-colors hover:bg-app-nav-hover sm:px-4"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden /> Voltar
        </button>
        <h1 className="text-[20px] font-bold text-[#0f172a]">Notificações</h1>
      </div>
      <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-10 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#64748b] ring-1 ring-[#e2e8f0]">
          <Lock className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </span>
        <p className="text-[15px] font-semibold text-[#0f172a]">Você não tem acesso às notificações</p>
        <p className="mt-1 text-[14px] text-[#64748b]">
          Peça a quem cuida da equipe para liberar a permissão "Ver notificações" no seu perfil.
        </p>
      </div>
    </div>
  );
}

function NotificacoesConteudo({ onVoltar, onNavigateToAgenda, onNotificacoesChanged }) {
  const { error: toastError } = useToast();
  const { fuso } = useFusoClinica();
  const [items, setItems] = useState([]);
  const [agora, setAgora] = useState(() => Date.now()); // renovado a cada carga; Date.now() não pode ir no render
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chipAtivo, setChipAtivo] = useState('todas');
  const [naoLidasCount, setNaoLidasCount] = useState(0);
  const [marcandoTodas, setMarcandoTodas] = useState(false);
  const [deletandoIds, setDeletandoIds] = useState(() => new Set());
  const [limpandoLidas, setLimpandoLidas] = useState(false);
  const [confirmandoLimpar, setConfirmandoLimpar] = useState(false);

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
      setAgora(Date.now());
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

  const groups = useMemo(() => groupNotificacoes(items, chipAtivo, fuso), [items, chipAtivo, fuso]);

  const filteredCount = chipCounts[chipAtivo] ?? 0;

  // O servidor só conta não lidas que acendem o sino; a contagem local segue a mesma regra.
  const acende = (n) => !n.lida && n.acendeSino;
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
        if (n.acendeSino) setNaoLidasCount((c) => Math.max(0, c - 1));
        onNotificacoesChanged?.();
      } catch {
        toastError('Erro ao marcar como lida');
        return;
      }
    }

    onNavigateToAgenda?.();
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
    if (acende(n)) setNaoLidasCount((c) => Math.max(0, c - 1));
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
    setConfirmandoLimpar(false);
    if (limpandoLidas || !items.some((it) => it.lida)) return;
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
              onClick={() => setConfirmandoLimpar(true)}
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
                      fuso={fuso}
                      agora={agora}
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

      <ViewportDialog
        open={confirmandoLimpar}
        onDismiss={() => setConfirmandoLimpar(false)}
        titleId="limpar-lidas-title"
      >
        <div className="px-5 py-4">
          <h2 id="limpar-lidas-title" className="mb-2 text-[16px] font-bold text-[#0f172a]">
            Limpar lidas
          </h2>
          <p className="mb-6 text-[14px] leading-relaxed text-[#475569]">
            Remover todas as notificações lidas? Esta ação não pode ser desfeita.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              data-dialog-initial-focus
              onClick={() => setConfirmandoLimpar(false)}
              className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-[13px] font-semibold text-[#475569] transition-colors hover:bg-[#f8fafc]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleLimparLidas}
              className="rounded-lg bg-red-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-red-700"
            >
              Remover lidas
            </button>
          </div>
        </div>
      </ViewportDialog>
    </div>
  );
}
