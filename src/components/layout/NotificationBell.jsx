import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { notificacoesApi } from '../../services/api.js';
import { useToast } from '../../contexts/useToast.js';

const POLL_INTERVAL_MS = 60_000;

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-app-surface-soft"
        title="Notificações"
      >
        <Icon className="h-5 w-5 text-gray-700" />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-40 max-h-96 w-80 overflow-y-auto rounded-xl bg-white shadow-2xl ring-1 ring-gray-200">
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

          {!loading && items.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {items.map((n) => (
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
        </div>
      ) : null}
    </div>
  );
}

const TIPO_VERBO = {
  paciente_confirmou: 'confirmou presença',
  paciente_recusou: 'recusou',
  paciente_sem_resposta: 'não respondeu',
  agenda_cancelada: 'Agendamento cancelado',
  agenda_reagendada: 'Agendamento reagendado',
};

function formatarQuando(data, hora) {
  if (!data) return null;
  let dataBr;
  if (/^\d{4}-\d{2}-\d{2}/.test(data)) {
    const [, m, d] = data.split('-');
    dataBr = `${d}/${m}`;
  } else if (/^\d{2}\/\d{2}/.test(data)) {
    dataBr = data.substring(0, 5);
  } else {
    return null;
  }
  return hora ? `${dataBr} às ${hora}` : dataBr;
}

function formatarMensagemNotificacao(n) {
  const payload = n?.payload ?? {};
  const nome = payload.pacienteNome;
  const quando = formatarQuando(payload.dataAgendamento, payload.horaInicio);
  const procStr = payload.procedimentoNome ? ` (${payload.procedimentoNome})` : '';

  switch (n?.tipo) {
    case 'paciente_confirmou':
    case 'paciente_recusou':
    case 'paciente_sem_resposta': {
      const verbo = TIPO_VERBO[n.tipo];
      if (nome && quando) return `${nome} ${verbo} em ${quando}${procStr}`;
      if (nome) return `${nome} ${verbo}`;
      return `Paciente ${verbo}`;
    }
    case 'agenda_cancelada': {
      if (nome && quando) return `Agendamento de ${nome} em ${quando}${procStr} cancelado`;
      if (nome) return `Agendamento de ${nome} cancelado`;
      return 'Agendamento cancelado';
    }
    case 'agenda_reagendada': {
      // TODO: confirmar campos dataAntiga/dataNova quando o PR backend mergear
      if (nome && quando) return `Agendamento de ${nome} reagendado (era ${quando}${procStr})`;
      return 'Agendamento reagendado';
    }
    default:
      return TIPO_VERBO[n?.tipo] || n?.tipo || '';
  }
}

function formatarTempoRelativo(iso) {
  if (!iso) return '';
  try {
    const diff = (new Date() - new Date(iso)) / 1000;
    if (diff < 60) return 'agora há pouco';
    if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
    return `há ${Math.floor(diff / 86400)} dias`;
  } catch {
    return '';
  }
}
