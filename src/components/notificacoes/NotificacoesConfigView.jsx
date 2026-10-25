import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, CalendarDays, Check, CheckCircle, ClipboardList, FileText, Loader2, Lock, Plus, RotateCcw, Search, Shield, Stethoscope, Users, X } from 'lucide-react';

const ICONE_MODULO = { AGENDA: CalendarDays, CONFIRMACAO: CheckCircle, ANAMNESE: ClipboardList, TERMOS: FileText, ATENDIMENTO: Stethoscope, ACESSO: Users, RETORNO: RotateCcw };
import { notificacoesConfigApi as api } from '../../services/api.js';
import { useToast } from '../../contexts/useToast.js';
import { usePapel } from '../../hooks/usePapel';
import { getTipoMeta } from '../../utils/notificacaoFormat.js';

const NIVEIS = {
  URGENTE: { nome: 'Urgente', ajuda: 'Aparece na hora e acende o sino', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  NORMAL: { nome: 'Normal', ajuda: 'Acende o sino', cls: 'bg-teal-50 text-[#0f766e] ring-teal-200' },
  SILENCIOSA: { nome: 'Silenciosa', ajuda: 'Só aparece na lista', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

const lista = (r) => (Array.isArray(r) ? r : r?.content ?? []);
const TXT_PAPEL = {
  QUEM_ENVIOU_O_LINK: 'Sempre que você enviar o link',
  PROFISSIONAL_DA_CONSULTA: 'Sempre que a consulta for sua',
  PROFISSIONAL_DO_HORARIO: 'Sempre que o horário for seu',
};
const AVISO_SEM_VER = "ninguém deste perfil recebe: o perfil não tem 'Ver notificações'";
const rotuloPessoas = (n) => `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`;

function CartaoDesligado({ tipo }) {
  const meta = getTipoMeta(tipo.codigo);
  return (
    <div data-testid={`cfg-${tipo.codigo}`} className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4 opacity-80">
      <div className="flex flex-wrap items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.iconClass}`}>
          <meta.Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold text-[#0f172a]">{tipo.nome}</h3>
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[12px] font-semibold text-slate-600">Desligado</span>
          </div>
          <p className="text-[13px] text-[#64748b]">Liga sozinho quando o lembrete de retorno existir no sistema.</p>
        </div>
      </div>
    </div>
  );
}

function NivelPill({ nivel }) {
  const n = NIVEIS[nivel?.codigo] || NIVEIS.NORMAL;
  return (
    <span title={n.ajuda} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1 ${n.cls}`}>
      {n.nome}
    </span>
  );
}

function Avatar({ nome, tam = 'h-7 w-7 text-[11px]' }) {
  const ini = String(nome || '?').replace(/^(Dra?\.)\s*/, '').split(' ').map((x) => x[0]).slice(0, 2).join('');
  return (
    <span className={`flex ${tam} shrink-0 items-center justify-center rounded-full bg-[#00a88e] font-bold text-white`}>{ini}</span>
  );
}

function Switch({ on, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className="relative inline-flex h-11 w-[60px] shrink-0 cursor-pointer items-center justify-center"
    >
      <span className={`relative block h-7 w-12 rounded-full transition-colors ${on ? 'bg-[#00a88e]' : 'bg-[#cbd5e1]'}`}>
        <span className={`absolute top-1 block h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  );
}

function SalvoIndicador({ estado }) {
  if (estado === 'salvando') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#64748b]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Salvando…
      </span>
    );
  }
  if (estado === 'salvo') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#0f766e]">
        <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden /> Tudo salvo
      </span>
    );
  }
  if (estado === 'erro') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-red-600">
        <AlertTriangle className="h-4 w-4" aria-hidden /> Não salvou
      </span>
    );
  }
  return null;
}

function Picker({ perfis, pessoas, onPick, onClose }) {
  const [busca, setBusca] = useState('');
  const q = busca.trim().toLowerCase();
  const fp = perfis.filter((p) => p.nome.toLowerCase().includes(q));
  const fe = pessoas.filter((p) => p.nome.toLowerCase().includes(q));
  const opc = (key, rotulo, sub, av, onClick) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-[#f0fdfa]"
    >
      {av}
      <span className="block min-w-0 flex-1 truncate text-[14px] font-semibold text-[#0f172a]">{rotulo}{sub}</span>
      <Plus className="h-4 w-4 text-[#00a88e]" aria-hidden />
    </button>
  );
  const apoio = (t) => <span className="block truncate text-[13px] font-normal text-[#64748b]">{t}</span>;
  const vazio = (t) => <p className="px-3 py-2 text-[13px] text-[#94a3b8]">{t}</p>;
  return (
    <div className="mt-3 rounded-xl border border-[#99f6e4] bg-white p-3 shadow-lg">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" aria-hidden />
          <input
            autoFocus
            autoComplete="off"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar perfil ou pessoa"
            aria-label="Buscar perfil ou pessoa"
            className="h-11 w-full rounded-xl border border-[#e2e8f0] pl-9 pr-3 text-[14px] outline-none focus:border-[#00a88e] focus:ring-2 focus:ring-[#00a88e]/20"
          />
        </div>
        <button type="button" onClick={onClose} className="h-11 rounded-xl px-3 text-[13px] font-semibold text-[#64748b] hover:bg-slate-100">
          Fechar
        </button>
      </div>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <div>
          <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-[#64748b]">Perfis de acesso</p>
          {fp.map((p) =>
            opc(`perfil-${p.id}`, p.nome, <>{apoio(rotuloPessoas(p.pessoas ?? 0))}{p.temVer === false && <span className="block text-[12px] font-normal text-amber-800">{AVISO_SEM_VER}</span>}</>,
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e6f7f5] text-[#0f766e]"><Shield className="h-4 w-4" aria-hidden /></span>,
              () => onPick('perfil', p)))}
          {fp.length === 0 && vazio('Nenhum perfil encontrado')}
        </div>
        <div>
          <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-[#64748b]">Pessoas</p>
          {fe.map((p) => opc(`pessoa-${p.roleUserId}`, p.nome, p.perfilNome ? apoio(p.perfilNome) : null, <Avatar nome={p.nome} tam="h-8 w-8 text-[11px]" />, () => onPick('pessoa', p)))}
          {fe.length === 0 && vazio('Nenhuma pessoa encontrada')}
        </div>
      </div>
    </div>
  );
}

function TipoConfigCard({ tipo, extras, pode, opcoes, onSalvar }) {
  const [aberto, setAberto] = useState(false);
  const meta = getTipoMeta(tipo.codigo);
  const perfis = extras?.perfis ?? [];
  const pessoas = extras?.pessoas ?? [];
  const ninguem = !tipo.papel && extras && !perfis.length && !pessoas.length;
  const rm = (rotulo, onClick) => (
    <button type="button" onClick={onClick} aria-label={`Remover ${rotulo}`} className="-mr-1 flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/5">
      <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
    </button>
  );
  const qtdPerfil = (id) => opcoes?.perfis.find((x) => x.id === id)?.pessoas;
  const semVer = perfis.filter((p) => opcoes?.perfis.find((x) => x.id === p.id)?.temVer === false);
  const pick = (kind, item) => {
    setAberto(false);
    if (kind === 'perfil') onSalvar(tipo.codigo, { perfis: [...perfis, item], pessoas });
    else onSalvar(tipo.codigo, { perfis, pessoas: [...pessoas, item] });
  };
  return (
    <div data-testid={`cfg-${tipo.codigo}`} className="rounded-xl border border-[#e2e8f0] bg-white p-4">
      <div className="flex flex-wrap items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.iconClass}`}>
          <meta.Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold text-[#0f172a]">{tipo.nome}</h3>
            <NivelPill nivel={tipo.nivel} />
          </div>
          <p className="text-[13px] text-[#64748b]">{tipo.descricao}</p>
        </div>
      </div>
      <div className="mt-3 grid items-start gap-x-4 gap-y-2 text-[13px] sm:grid-cols-[150px_1fr]">
        <span className="pt-2 font-semibold text-[#64748b]">Sempre recebe</span>
        <div>
          {tipo.papel ? (
            <span title="O dono do fato sempre recebe e não dá para tirar" className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-slate-100 px-3 text-[13px] font-semibold text-slate-700">
              <Lock className="h-3.5 w-3.5" aria-hidden />{tipo.papel.nome}
            </span>
          ) : (
            <span className="inline-flex min-h-[36px] items-center text-[13px] text-[#94a3b8]">Ninguém fixo: só quem estiver abaixo</span>
          )}
        </div>
        {extras ? (
          <>
            <span className="pt-2 font-semibold text-[#64748b]">Também recebem</span>
            <div className="flex flex-wrap items-center gap-2">
              {perfis.map((p) => (
                <span key={p.id} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-[#e6f7f5] py-1 pl-3 pr-2 text-[13px] font-semibold text-[#0f766e]">
                  <Shield className="h-4 w-4" aria-hidden />{p.nome}
                  {qtdPerfil(p.id) != null && <span className="font-medium text-[#0f766e]/70">· {rotuloPessoas(qtdPerfil(p.id))}</span>}
                  {pode && rm(p.nome, () => onSalvar(tipo.codigo, { perfis: perfis.filter((x) => x.id !== p.id), pessoas }))}
                </span>
              ))}
              {pessoas.map((p) => (
                <span key={p.roleUserId} className="inline-flex min-h-[36px] items-center gap-2 rounded-full border border-[#e2e8f0] bg-white py-1 pl-1 pr-2 text-[13px] font-semibold text-[#0f172a]">
                  <Avatar nome={p.nome} />{p.nome}
                  {pode && rm(p.nome, () => onSalvar(tipo.codigo, { perfis, pessoas: pessoas.filter((x) => x.roleUserId !== p.roleUserId) }))}
                </span>
              ))}
              {!pode && !perfis.length && !pessoas.length && <span className="inline-flex min-h-[36px] items-center text-[#94a3b8]">Ninguém</span>}
              {pode && (
                <button type="button" onClick={() => setAberto((v) => !v)} aria-label={`Adicionar a ${tipo.nome}`} className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-dashed border-[#00a88e] px-3 text-[13px] font-semibold text-[#00a88e] hover:bg-teal-50">
                  <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden /> Adicionar
                </button>
              )}
            </div>
          </>
        ) : null}
      </div>
      {ninguem && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[13px] text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Ninguém vai receber este aviso. Adicione um perfil ou uma pessoa.
        </div>
      )}
      {semVer.map((p) => (
        <div key={p.id} className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[13px] text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {p.nome}: {AVISO_SEM_VER}
        </div>
      ))}
      {aberto && pode && opcoes && (
        <Picker
          perfis={opcoes.perfis.filter((p) => !perfis.some((x) => x.id === p.id))}
          pessoas={opcoes.pessoas.filter((p) => !pessoas.some((x) => x.roleUserId === p.roleUserId))}
          onPick={pick}
          onClose={() => setAberto(false)}
        />
      )}
    </div>
  );
}

/**
 * Configurações › Notificações.
 * @param {{ aba?: 'clinica'|'prefs', abaInicial?: 'clinica'|'prefs', embutido?: boolean, onVoltar?: () => void }} props
 *  `aba` fixa a aba (usado dentro do hub de configurações); sem ela a tela mostra cabeçalho e abas próprios.
 */
export default function NotificacoesConfigView({ aba: abaFixa, abaInicial = 'prefs', embutido = false, onVoltar }) {
  const toast = useToast();
  const { canConfigurarNotificacoes: pode } = usePapel();
  const [abaState, setAba] = useState(abaInicial);
  const aba = abaFixa || abaState;

  const [tipos, setTipos] = useState(null);
  const [extras, setExtras] = useState({});
  const [opcoes, setOpcoes] = useState(null);
  const [profissionais, setProfissionais] = useState([]);
  const [erroOpcoes, setErroOpcoes] = useState(false);
  const [erroProfissionais, setErroProfissionais] = useState(false);
  const [prefs, setPrefs] = useState(null);
  const [estado, setEstado] = useState('');
  const pendentes = useRef(0);

  const falhar = useCallback((msg) => {
    toast.error(msg);
    setEstado('erro');
  }, [toast]);

  // Roda uma gravação: "Salvando…" → "Tudo salvo"; em erro devolve o estado anterior e avisa.
  const gravar = useCallback(async (fazer, desfazer, msgErro) => {
    pendentes.current += 1;
    setEstado('salvando');
    try {
      await fazer();
      pendentes.current -= 1;
      if (pendentes.current === 0) setEstado('salvo');
    } catch {
      pendentes.current -= 1;
      desfazer();
      falhar(msgErro);
    }
  }, [falhar]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [t, p, profs] = await Promise.all([
          api.tipos(true),
          api.preferencias(),
          api.profissionais().catch(() => null),
        ]);
        if (!vivo) return;
        setTipos(lista(t));
        setPrefs({ tipos: p?.tipos ?? [], acompanhando: p?.acompanhando ?? [] });
        setErroProfissionais(profs === null);
        setProfissionais(lista(profs));
        // Extras: leitura com NOTIFICACAO_VER; as opções do seletor só existem para quem edita (CONFIGURAR).
        const [op, ...ex] = await Promise.all([
          pode ? api.opcoes().catch(() => null) : undefined,
          ...lista(t).filter((x) => x.ativo !== false).map((x) => api.extras(x.codigo).then((r) => [x.codigo, r]).catch(() => null)),
        ]);
        if (!vivo) return;
        setErroOpcoes(pode && op === null);
        setOpcoes(op ? { perfis: op.perfis ?? [], pessoas: op.pessoas ?? [] } : null);
        setExtras(Object.fromEntries(ex.filter(Boolean)));
      } catch {
        if (vivo) toast.error('Não foi possível carregar as notificações.');
      }
    })();
    return () => { vivo = false; };
  }, [pode, toast]);

  const salvarExtras = (codigo, novo) => {
    const antes = extras[codigo];
    setExtras((e) => ({ ...e, [codigo]: novo }));
    gravar(
      async () => {
        const r = await api.salvarExtras(codigo, novo.perfis.map((p) => p.id), novo.pessoas.map((p) => p.roleUserId));
        if (r) setExtras((e) => ({ ...e, [codigo]: r }));
      },
      () => setExtras((e) => ({ ...e, [codigo]: antes })),
      'Não foi possível salvar. A alteração foi desfeita.',
    );
  };

  const alternarSilencio = (codigo) => {
    const silenciado = prefs.tipos.find((t) => t.codigo === codigo)?.silenciado === true;
    const set = (v) => setPrefs((p) => ({ ...p, tipos: p.tipos.map((t) => (t.codigo === codigo ? { ...t, silenciado: v } : t)) }));
    set(!silenciado);
    gravar(
      () => (silenciado ? api.deixarDeSilenciar(codigo) : api.silenciar(codigo)),
      () => set(silenciado),
      'Não foi possível salvar. A alteração foi desfeita.',
    );
  };

  const alternarAcompanhar = (pessoa) => {
    const segue = prefs.acompanhando.some((a) => a.roleUserId === pessoa.roleUserId);
    const set = (v) => setPrefs((p) => ({
      ...p,
      acompanhando: v
        ? [...p.acompanhando.filter((a) => a.roleUserId !== pessoa.roleUserId), { roleUserId: pessoa.roleUserId, nome: pessoa.nome }]
        : p.acompanhando.filter((a) => a.roleUserId !== pessoa.roleUserId),
    }));
    set(!segue);
    gravar(
      () => (segue ? api.deixarDeAcompanhar(pessoa.roleUserId) : api.acompanhar(pessoa.roleUserId)),
      () => set(segue),
      'Não foi possível salvar. A alteração foi desfeita.',
    );
  };

  const modulos = [];
  (tipos || []).forEach((t) => {
    let m = modulos.find((x) => x.codigo === t.modulo?.codigo);
    if (!m) { m = { codigo: t.modulo?.codigo, nome: t.modulo?.nome || 'Outros', tipos: [] }; modulos.push(m); }
    m.tipos.push(t);
  });

  const abaClinica = (
    <>
      {pode ? (
        <p className="mb-4 text-[14px] text-[#475569]">Quem é dono do fato sempre recebe. Aqui você escolhe quem <b>também</b> recebe: um perfil inteiro ou uma pessoa.</p>
      ) : (
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-[#f8fafc] p-3 text-[14px] text-[#475569] ring-1 ring-[#e2e8f0]">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Só quem tem a permissão "Configurar notificações" muda esta tela. Você pode ver como está.
        </div>
      )}
      {erroOpcoes && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-[14px] text-red-700 ring-1 ring-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Não foi possível carregar perfis e pessoas. Recarregue a página para adicionar quem recebe.
        </div>
      )}
      <div className="space-y-6">
        {modulos.map((m) => {
          const IconeModulo = ICONE_MODULO[m.codigo];
          return (
          <section key={m.codigo}>
            <h2 className="mb-3 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-[#64748b]">
              {IconeModulo && <IconeModulo data-testid="icone-modulo" className="h-4 w-4" aria-hidden />} {m.nome}
            </h2>
            <div className="space-y-3">
              {m.tipos.map((t) => (
                t.ativo === false
                  ? <CartaoDesligado key={t.codigo} tipo={t} />
                  : <TipoConfigCard key={t.codigo} tipo={t} extras={extras[t.codigo]} pode={pode} opcoes={opcoes} onSalvar={salvarExtras} />
              ))}
            </div>
          </section>
          );
        })}
      </div>
    </>
  );

  const abaPrefs = prefs && (
    <>
      <section className="mb-8">
        <h2 className="mb-1 text-[16px] font-bold text-[#0f172a]">O que chega para você</h2>
        <p className="mb-3 text-[14px] text-[#64748b]">O que é seu (o horário, a consulta, o link que você enviou) sempre chega. O resto você pode desligar.</p>
        <p className="mb-3 text-[14px] font-medium text-[#0f172a]">Você nunca recebe aviso do que você mesmo fez.</p>
        <div className="divide-y divide-[#eef2f6] overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">
          {prefs.tipos.map((t) => {
            const meta = getTipoMeta(t.codigo);
            const on = !t.silenciado;
            const papel = (tipos || []).find((x) => x.codigo === t.codigo)?.papel?.codigo;
            const fixo = t.motivos.includes('PAPEL_NO_FATO') ? TXT_PAPEL[papel] : null;
            const textos = [
              fixo,
              t.motivos.includes('PESSOA_EXTRA') && 'A clínica incluiu você',
              t.motivos.includes('PERFIL_EXTRA') && (t.perfilNome ? `Pelo perfil ${t.perfilNome}` : 'Pelo seu perfil'),
              t.motivos.includes('ACOMPANHAMENTO') && `Porque acompanha ${prefs.acompanhando.map((a) => a.nome).join(', ')}`,
            ].filter(Boolean);
            const silenciavel = t.motivos.some((m) => m !== 'PAPEL_NO_FATO');
            return (
              <div key={t.codigo} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.iconClass}`}>
                  <meta.Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0" style={{ flex: '1 1 200px' }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-semibold text-[#0f172a]">{t.nome}</p>
                    <NivelPill nivel={t.nivel} />
                  </div>
                  <p className="text-[13px] text-[#64748b]">{textos.join(' · ')}</p>
                </div>
                {silenciavel ? (
                  <div className="flex items-center gap-1">
                    <span className="text-[12px] font-medium text-[#64748b]">{on ? 'Recebendo' : 'Silenciado'}</span>
                    <Switch on={on} onChange={() => alternarSilencio(t.codigo)} label={`Receber ${t.nome}`} />
                  </div>
                ) : (
                  <span title="O fato é seu: não dá para desligar" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#64748b]">
                    <Lock className="h-3.5 w-3.5" aria-hidden /> Sempre
                  </span>
                )}
                {fixo && silenciavel && !on && (
                  <p className="w-full pl-[52px] text-[12px] text-[#94a3b8]">Quando {fixo.replace('Sempre que ', '')}, chega mesmo silenciado.</p>
                )}
              </div>
            );
          })}
          {prefs.tipos.length === 0 && <p className="p-6 text-center text-[14px] text-[#64748b]">Nenhum aviso chega para você hoje.</p>}
        </div>
      </section>
      <section>
        <h2 className="mb-1 text-[16px] font-bold text-[#0f172a]">Acompanhar profissionais</h2>
        <p className="mb-3 text-[14px] text-[#64748b]">Para quem auxilia: você recebe o que chega para eles da agenda, das confirmações, da ficha vencida e da consulta encerrada.</p>
        <div className="divide-y divide-[#eef2f6] overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">
          {profissionais.map((p) => (
            <div key={p.roleUserId} className="flex items-center gap-3 px-4 py-2">
              <Avatar nome={p.nome} tam="h-10 w-10 text-[13px]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-[#0f172a]">{p.nome}</p>
                {p.perfilNome && <p className="text-[13px] text-[#64748b]">{p.perfilNome}</p>}
              </div>
              <Switch on={prefs.acompanhando.some((a) => a.roleUserId === p.roleUserId)} onChange={() => alternarAcompanhar(p)} label={`Acompanhar ${p.nome}`} />
            </div>
          ))}
          {erroProfissionais && <p role="alert" className="p-4 text-[14px] text-red-600">Não foi possível carregar a lista de profissionais.</p>}
          {!erroProfissionais && profissionais.length === 0 && <p className="p-4 text-[14px] text-[#64748b]">Nenhum profissional para acompanhar.</p>}
        </div>
      </section>
    </>
  );

  const abas = [['clinica', 'Quem recebe cada aviso'], ['prefs', 'Minhas preferências']];
  return (
    <div className={`mx-auto w-full ${embutido ? '' : 'max-w-4xl'}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
          {!embutido && typeof onVoltar === 'function' && (
            <button type="button" onClick={onVoltar} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-app-border bg-white px-3 text-[13px] font-semibold text-[#64748b] hover:bg-app-nav-hover sm:px-4">
              <ArrowLeft className="h-4 w-4" strokeWidth={2.5} aria-hidden /> Voltar
            </button>
          )}
          {!embutido && <h1 className="text-[20px] font-bold text-[#0f172a]">Notificações</h1>}
        </div>
        <div role="status" aria-live="polite" className="min-h-[20px]"><SalvoIndicador estado={estado} /></div>
      </div>
      {!embutido && <p className="mb-4 text-[14px] text-[#64748b]">Configurações › Notificações</p>}
      {!abaFixa && (
        <div role="tablist" className="mb-5 mt-3 inline-flex rounded-xl border border-[#e2e8f0] bg-white p-1">
          {abas.map(([v, l]) => (
            <button key={v} type="button" role="tab" aria-selected={aba === v} onClick={() => setAba(v)}
              className={`min-h-[40px] rounded-lg px-4 text-[14px] font-semibold transition-colors ${aba === v ? 'bg-[#00a88e] text-white' : 'text-[#475569] hover:bg-[#f8fafc]'}`}>
              {l}
            </button>
          ))}
        </div>
      )}
      {tipos === null ? (
        <p className="p-6 text-center text-[14px] text-[#64748b]">Carregando…</p>
      ) : aba === 'clinica' ? abaClinica : abaPrefs}
    </div>
  );
}
