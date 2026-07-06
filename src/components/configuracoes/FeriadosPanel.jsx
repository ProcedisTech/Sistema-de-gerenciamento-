import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus, Sparkles, Trash2 } from 'lucide-react';
import { feriadosApi, getApiErrorToastMessage } from '../../services/api.js';
import { useToast } from '../../contexts/useToast.js';
import { ConfigCardStackSkeleton } from '../shared/ConfigPanelSkeletons';

function formatarData(iso) {
  if (!iso || typeof iso !== 'string' || !iso.includes('-')) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function ModalAdicionar({ data, setData, nome, setNome, onClose, onConfirm, saving, hojeIso }) {
  const dataPassada = Boolean(data) && data < hojeIso;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6">
        <h2 className="mb-4 text-lg font-bold text-[#0f172a]">Adicionar feriado</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[#0f172a]">Data</label>
            <input
              type="date"
              value={data}
              min={hojeIso}
              onChange={(e) => setData(e.target.value)}
              className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm"
            />
            {dataPassada ? (
              <p className="mt-1 text-xs text-red-500">
                Feriados devem ser em data atual ou futura
              </p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[#0f172a]">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value.slice(0, 100))}
              maxLength={100}
              placeholder="Ex.: Natal - clinica fechada"
              className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-gray-400">{nome.length}/100</span>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-lg border border-[#e2e8f0] px-4 py-2 text-sm font-medium text-[#64748b]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!data || !nome.trim() || saving || dataPassada}
            className="flex-1 rounded-lg bg-[#00a88e] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalSugestoes({ sugestoes, feriados, onAdicionar, onClose, hojeIso }) {
  const datasJaCadastradas = useMemo(
    () => new Set((feriados || []).map((f) => f.data)),
    [feriados],
  );

  const sugestoesFuturas = useMemo(
    () => (Array.isArray(sugestoes) ? sugestoes.filter((s) => s?.data && s.data >= hojeIso) : []),
    [sugestoes, hojeIso],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6">
        <h2 className="mb-2 text-lg font-bold text-[#0f172a]">Feriados nacionais</h2>
        <p className="mb-4 text-[13px] text-[#64748b]">Clique para adicionar individualmente</p>
        {sugestoesFuturas.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[#e2e8f0] bg-[#f8fafc] p-4 text-center text-[13px] text-[#64748b]">
            Nao ha mais sugestoes nacionais para o restante do ano. Adicione manualmente se precisar.
          </p>
        ) : (
          <ul className="space-y-2">
            {sugestoesFuturas.map((s, idx) => {
              const jaCadastrado = datasJaCadastradas.has(s.data);
              return (
                <li key={`${s.data}-${idx}`}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!jaCadastrado) onAdicionar(s);
                    }}
                    disabled={jaCadastrado}
                    className={`flex w-full items-center justify-between rounded-lg border p-3 text-left ${
                      jaCadastrado
                        ? 'cursor-not-allowed border-[#e2e8f0] bg-[#f8fafc] opacity-50'
                        : 'border-[#e2e8f0] bg-white hover:border-[#00a88e]'
                    }`}
                  >
                    <div>
                      <p className="text-[14px] font-medium text-[#0f172a]">{s.nome}</p>
                      <p className="text-[12px] text-[#64748b]">{formatarData(s.data)}</p>
                    </div>
                    {jaCadastrado && (
                      <span className="text-[11px] font-bold text-[#00a88e]">JA ADICIONADO</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-[#e2e8f0] px-4 py-2 text-sm font-medium text-[#64748b]"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

export function FeriadosPanel() {
  const [feriados, setFeriados] = useState([]);
  const [sugestoes, setSugestoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [feriadoParaRemover, setFeriadoParaRemover] = useState(null);
  const [novaData, setNovaData] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [saving, setSaving] = useState(false);
  const { success, error: toastError } = useToast();

  const ano = new Date().getFullYear();
  // BUG #8: bloqueia cadastrar feriado em data passada. Calcula no client tz local pra
  // bater com o que o <input type="date"> exibe.
  const hojeIso = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const lista = await feriadosApi.listar(`${ano}-01-01`, `${ano}-12-31`);
      setFeriados(Array.isArray(lista) ? lista : []);
    } catch (e) {
      toastError(getApiErrorToastMessage(e, 'Erro ao carregar feriados'));
    } finally {
      setLoading(false);
    }
  }, [ano, toastError]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleAdicionar = async () => {
    if (!novaData || !novoNome.trim()) return;
    if (novaData < hojeIso) {
      toastError('Feriados devem ser em data atual ou futura');
      return;
    }
    setSaving(true);
    try {
      await feriadosApi.criar({ data: novaData, nome: novoNome.trim() });
      success('Feriado adicionado');
      setShowAddModal(false);
      setNovaData('');
      setNovoNome('');
      await carregar();
    } catch (e) {
      toastError(getApiErrorToastMessage(e, 'Erro ao adicionar'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeletar = async (id) => {
    try {
      await feriadosApi.desativar(id);
      success('Feriado removido');
      await carregar();
    } catch (e) {
      toastError(getApiErrorToastMessage(e, 'Erro ao remover'));
    }
  };

  const handleAbrirSugestoes = async () => {
    setShowSugestoes(true);
    try {
      const lista = await feriadosApi.sugestoesNacionais(ano);
      setSugestoes(Array.isArray(lista) ? lista : []);
    } catch (e) {
      toastError(getApiErrorToastMessage(e, 'Erro ao carregar sugestoes'));
    }
  };

  const handleAdicionarSugestao = async (sugestao) => {
    try {
      await feriadosApi.criar({ data: sugestao.data, nome: sugestao.nome });
      success(`${sugestao.nome} adicionado`);
      await carregar();
    } catch (e) {
      if (e?.status === 409) {
        toastError('Esse feriado ja esta cadastrado');
      } else {
        toastError(getApiErrorToastMessage(e, 'Erro ao adicionar'));
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-[#0f172a]">Feriados de {ano}</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAbrirSugestoes}
            className="inline-flex items-center gap-1 rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#64748b] hover:bg-[#f8fafc]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Sugestões nacionais
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-[#00a88e] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#008f78]"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </button>
        </div>
      </div>

      {loading ? (
        <ConfigCardStackSkeleton count={4} className="h-14" />
      ) : null}

      {!loading && feriados.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#e2e8f0] bg-[#f8fafc] p-6 text-center">
          <CalendarDays className="mx-auto mb-2 h-8 w-8 text-[#94a3b8]" />
          <p className="text-[13px] text-[#64748b]">Nenhum feriado cadastrado</p>
          <p className="text-[12px] text-[#94a3b8]">Use &quot;Sugestões nacionais&quot; para começar</p>
        </div>
      )}

      {!loading && feriados.length > 0 && (
        <ul className="divide-y divide-[#e2e8f0] rounded-xl border border-[#e2e8f0] bg-white">
          {feriados.map((f) => (
            <li key={f.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-[14px] font-medium text-[#0f172a]">{f.nome}</p>
                <p className="text-[12px] text-[#64748b]">{formatarData(f.data)}</p>
              </div>
              <button
                type="button"
                onClick={() => setFeriadoParaRemover(f)}
                className="rounded-md p-2 text-[#ef4444] hover:bg-[#fef2f2]"
                title="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {showAddModal && (
        <ModalAdicionar
          data={novaData}
          setData={setNovaData}
          nome={novoNome}
          setNome={setNovoNome}
          onClose={() => {
            setShowAddModal(false);
            setNovaData('');
            setNovoNome('');
          }}
          onConfirm={handleAdicionar}
          saving={saving}
          hojeIso={hojeIso}
        />
      )}

      {showSugestoes && (
        <ModalSugestoes
          sugestoes={sugestoes}
          feriados={feriados}
          onAdicionar={handleAdicionarSugestao}
          onClose={() => setShowSugestoes(false)}
          hojeIso={hojeIso}
        />
      )}

      {feriadoParaRemover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="mb-2 text-lg font-bold text-[#0f172a]">Remover feriado</h2>
            <p className="text-sm text-[#64748b]">
              Deseja remover <strong>{feriadoParaRemover.nome}</strong>?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setFeriadoParaRemover(null)}
                className="flex-1 rounded-lg border border-[#e2e8f0] px-4 py-2 text-sm font-medium text-[#64748b]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = feriadoParaRemover.id;
                  setFeriadoParaRemover(null);
                  await handleDeletar(id);
                }}
                className="flex-1 rounded-lg bg-[#ef4444] px-4 py-2 text-sm font-medium text-white hover:bg-[#dc2626]"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
