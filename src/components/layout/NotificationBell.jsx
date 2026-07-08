import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { notificacoesApi } from '../../services/api.js';
import { useToast } from '../../contexts/useToast.js';
import { formatarMensagemNotificacao, formatarTempoRelativo } from '../../utils/notificacaoFormat.js';

const POLL_INTERVAL_MS = 60_000;

export default function NotificationBell({
  variant = 'default',
  onVerTodas,
  notificacoesRefreshKey = 0,
}) {
  const isAgenda = variant === 'agenda';
  const isHeader = variant === 'header';
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(false);
  const { error: toastError } = useToast();
  const containerRef = useRef(null);

  const refreshCount = useCallback(async () => {
    try {
      const res = await notificacoesApi.contarNaoLidas();
      setCount(typeof res?.count === 'number' ? res.count : 0);
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refreshCount]);

  useEffect(() => {
    refreshCount();
  }, [notificacoesRefreshKey, refreshCount]);

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const carregarLista = useCallback(async () => {
    setLoading(true);
    try {
      const page = await notificacoesApi.listar({ page: 0, size: 20 });
      setItems(Array.isArray(page?.content) ? page.content : []);
      setTotalElements(typeof page?.totalElements === 'number' ? page.totalElements : 0);
    } catch {
      toastError('Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  const handleToggle = async () => {
    if (!open) {
      await carregarLista();
    }
    setOpen((v) => !v);
  };

  const handleMarcarLida = async (id) => {
    try {
      await notificacoesApi.marcarLida(id);
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, lida: true } : it)));
      refreshCount();
    } catch {
      toastError('Erro ao marcar como lida');
    }
  };

  const handleMarcarTodasLidas = async () => {
    try {
      await notificacoesApi.marcarTodasLidas();
      setItems((prev) => prev.map((it) => ({ ...it, lida: true })));
      setCount(0);
    } catch {
      toastError('Erro ao marcar todas');
    }
  };

  const Icon = count > 0 ? BellRing : Bell;
  const previewItems = items.slice(0, 2);
  const totalCount = totalElements > 0 ? totalElements : items.length;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className={
          isHeader
            ? 'relative flex h-10 w-10 items-center justify-center rounded-xl border-[1.5px] border-[#00a88e] bg-white text-[#00a88e] transition-colors hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500/40'
            : isAgenda
              ? 'relative flex h-10 w-10 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700 shadow-agenda-sm transition-colors hover:bg-ink-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500/40'
              : 'relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-app-surface-soft'
        }
        title="Notificações"
        aria-label="Notificações"
      >
        <Icon
          className={`h-5 w-5 ${
            isHeader ? 'text-[#00a88e]' : isAgenda ? 'text-ink-700' : 'text-gray-700'
          }`}
        />
        {count > 0 ? (
          <span
            className={
              isHeader
                ? 'absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-white bg-[#00a88e] px-1 text-xs font-bold text-white'
                : isAgenda
                  ? 'absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-white bg-status-danger px-1 text-xs font-bold text-white'
                  : 'absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white'
            }
          >
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className={`absolute right-0 top-12 w-80 rounded-xl bg-white shadow-2xl ring-1 ring-gray-200 ${
            isHeader ? 'z-50' : 'z-40'
          }`}
        >
          <div className="flex items-center justify-between border-b border-gray-100 p-3">
            <h3 className="text-sm font-bold text-gray-900">Notificações</h3>
            {count > 0 ? (
              <button
                type="button"
                onClick={handleMarcarTodasLidas}
                className="text-xs text-emerald-600 hover:underline"
              >
                Marcar todas como lidas
              </button>
            ) : null}
          </div>

          {loading ? <div className="p-4 text-center text-xs text-gray-500">Carregando...</div> : null}

          {!loading && items.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">Nenhuma notificação</div>
          ) : null}

          {!loading && previewItems.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {previewItems.map((n) => (
                <li
                  key={n.id}
                  onClick={() => !n.lida && handleMarcarLida(n.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (!n.lida) handleMarcarLida(n.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`cursor-pointer p-3 hover:bg-gray-50 ${!n.lida ? 'bg-emerald-50' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.lida ? (
                      <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{formatarMensagemNotificacao(n)}</p>
                      <p className="text-xs text-gray-500">{formatarTempoRelativo(n.criadoEm)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {typeof onVerTodas === 'function' ? (
            <div className="border-t border-gray-100 p-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onVerTodas();
                }}
                className="w-full rounded-lg py-2 text-sm font-medium text-[#00a88e] hover:bg-teal-50"
              >
                {totalCount > 2 ? `Ver todas (${totalCount})` : 'Ver todas'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
