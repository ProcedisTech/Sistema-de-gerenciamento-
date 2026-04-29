import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  User,
  XCircle,
} from 'lucide-react';
import { confirmacaoPublicaApi } from '../../services/api.js';

function formatarData(iso) {
  if (!iso || typeof iso !== 'string' || !iso.includes('-')) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function InfoRow({ icon, label, value }) {
  const Icon = icon;
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-[#94a3b8]" />
      <div className="flex-1">
        <p className="text-[11px] uppercase tracking-wider text-[#94a3b8]">{label}</p>
        <p className="text-[14px] font-medium text-[#0f172a]">{value}</p>
      </div>
    </div>
  );
}

export function ConfirmacaoPublicaPage() {
  const [estado, setEstado] = useState('carregando');
  const [info, setInfo] = useState(null);
  const [respondendo, setRespondendo] = useState(false);
  const [erroMsg, setErroMsg] = useState('');

  const token = useMemo(() => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  }, []);

  useEffect(() => {
    if (!token) {
      setEstado('erro');
      setErroMsg('Link invalido');
      return;
    }

    let alive = true;
    confirmacaoPublicaApi
      .buscar(token)
      .then((data) => {
        if (!alive) return;
        setInfo(data);
        if (data?.status === 'aguardando') {
          setEstado('aguardando');
        } else if (data?.status === 'sem_resposta') {
          setEstado('expirado');
        } else {
          setEstado('respondido');
        }
      })
      .catch((e) => {
        if (!alive) return;
        setEstado('erro');
        setErroMsg(e?.status === 404 ? 'Link invalido ou expirado' : 'Erro ao carregar');
      });

    return () => {
      alive = false;
    };
  }, [token]);

  const handleResponder = async (resposta) => {
    setRespondendo(true);
    setErroMsg('');
    try {
      const atualizado = await confirmacaoPublicaApi.responder(token, resposta);
      setInfo(atualizado);
      setEstado('respondido');
    } catch {
      setErroMsg('Erro ao registrar resposta. Tente novamente.');
    } finally {
      setRespondendo(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f0fdfa] to-[#f8fbfb] p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {estado === 'carregando' && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-10 w-10 animate-spin text-[#00a88e]" />
            <p className="text-sm text-[#64748b]">Carregando...</p>
          </div>
        )}

        {estado === 'erro' && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="h-12 w-12 text-[#ef4444]" />
            <h1 className="text-lg font-bold text-[#0f172a]">Ops!</h1>
            <p className="text-sm text-[#64748b]">{erroMsg}</p>
          </div>
        )}

        {estado === 'aguardando' && info && (
          <>
            <h1 className="mb-2 text-center text-xl font-bold text-[#0f172a]">Confirme sua presenca</h1>
            <p className="mb-6 text-center text-sm text-[#64748b]">
              Ola {info.pacienteNome || 'paciente'}!
            </p>

            <div className="mb-6 space-y-3 rounded-xl bg-[#f8fafc] p-4">
              <InfoRow icon={Calendar} label="Data" value={formatarData(info.dataAgendamento)} />
              <InfoRow icon={Clock} label="Horario" value={info.horaInicio?.slice(0, 5) || '—'} />
              <InfoRow icon={User} label="Profissional" value={info.profissionalNome || '—'} />
              {info.procedimentoNome ? (
                <InfoRow icon={CheckCircle2} label="Procedimento" value={info.procedimentoNome} />
              ) : null}
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleResponder('confirmado')}
                disabled={respondendo}
                className="w-full rounded-xl bg-[#00a88e] py-3 text-sm font-bold text-white hover:bg-[#008f78] disabled:opacity-50"
              >
                {respondendo ? 'Enviando...' : 'Sim, vou comparecer'}
              </button>
              <button
                type="button"
                onClick={() => handleResponder('recusado')}
                disabled={respondendo}
                className="w-full rounded-xl border-2 border-[#e2e8f0] py-3 text-sm font-bold text-[#64748b] hover:bg-[#f8fafc] disabled:opacity-50"
              >
                Nao vou conseguir
              </button>
            </div>

            {erroMsg ? <p className="mt-3 text-center text-xs text-[#ef4444]">{erroMsg}</p> : null}
          </>
        )}

        {estado === 'respondido' && info && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div
              className={`rounded-full p-4 ${
                info.status === 'confirmado' ? 'bg-[#f0fdf9]' : 'bg-[#fef2f2]'
              }`}
            >
              {info.status === 'confirmado' ? (
                <CheckCircle2 className="h-12 w-12 text-[#00a88e]" />
              ) : (
                <XCircle className="h-12 w-12 text-[#ef4444]" />
              )}
            </div>
            <h1 className="text-lg font-bold text-[#0f172a]">Resposta registrada!</h1>
            <p className="text-sm text-[#64748b]">
              {info.status === 'confirmado'
                ? 'Te esperamos no horario combinado.'
                : 'Sem problemas. Entraremos em contato para reagendar.'}
            </p>
          </div>
        )}

        {estado === 'expirado' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle className="h-12 w-12 text-[#f59e0b]" />
            <h1 className="text-lg font-bold text-[#0f172a]">Esse link expirou</h1>
            <p className="text-sm text-[#64748b]">
              O prazo para confirmar terminou. Entre em contato com a clinica.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
