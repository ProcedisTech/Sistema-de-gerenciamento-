import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Stethoscope,
  Loader2,
  Search,
  Power,
  PowerOff,
  EyeOff,
  Trash2,
} from 'lucide-react';
import { catalogosApi, getApiErrorDetail } from '../../services/api';

function normalizeList(raw) {
  const arr = Array.isArray(raw) ? raw : raw?.content || [];
  return Array.isArray(arr) ? arr : [];
}

function nomeProc(p) {
  return String(p.nomeProcedimento || p.nome || '').trim();
}

function isAtivo(p) {
  if (p.ativo === false) return false;
  if (p.ativo === true) return true;
  if (p.inativadoEm != null && p.inativadoEm !== '') return false;
  return true;
}

export function ProcedimentosManager() {
  const [procedimentos, setProcedimentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState('');
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [inativandoId, setInativandoId] = useState(null);
  const [ativandoId, setAtivandoId] = useState(null);
  const [erroInline, setErroInline] = useState(null);
  const [countInativos, setCountInativos] = useState(0);

  const fetchProcedimentos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await catalogosApi.list(mostrarInativos);
      const list = normalizeList(data);
      setProcedimentos(list);

      if (!mostrarInativos && list.length === 0) {
        try {
          const allData = await catalogosApi.list(true);
          const allList = normalizeList(allData);
          const n = allList.filter((p) => !isAtivo(p)).length;
          setCountInativos(n);
        } catch (e) {
          console.warn('survey catalogos:', e);
          setCountInativos(0);
        }
      } else {
        setCountInativos(0);
      }
    } catch (err) {
      console.warn('Erro ao buscar procedimentos:', err?.message || err);
      setProcedimentos([]);
      setCountInativos(0);
    } finally {
      setLoading(false);
    }
  }, [mostrarInativos]);

  useEffect(() => {
    fetchProcedimentos();
  }, [fetchProcedimentos]);

  const procedimentosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return procedimentos;
    return procedimentos.filter((p) => nomeProc(p).toLowerCase().includes(q));
  }, [procedimentos, busca]);

  const handleCriar = async (e) => {
    e.preventDefault();
    const nome = novoNome.trim();
    if (!nome) {
      setErro('Você precisa digitar o nome do procedimento.');
      return;
    }
    setErro('');
    setCriando(true);
    try {
      await catalogosApi.criar({ nomeProcedimento: nome });
      setNovoNome('');
      await fetchProcedimentos();
    } catch (err) {
      if (err.status === 409) {
        setErro(getApiErrorDetail(err) || 'Já existe um procedimento com esse nome.');
      } else {
        setErro(getApiErrorDetail(err) || err.message || 'Erro ao criar procedimento.');
      }
    } finally {
      setCriando(false);
    }
  };

  const handleSolicitarInativacao = (id) => {
    setErroInline(null);
    setTogglingId(id);
  };

  const handleCancelarInativacao = () => {
    setTogglingId(null);
    setErroInline(null);
  };

  const handleConfirmarInativacao = async (id) => {
    setErroInline(null);
    setInativandoId(id);
    try {
      await catalogosApi.inativar(id);
      setTogglingId(null);
      await fetchProcedimentos();
    } catch (err) {
      setErroInline({
        id,
        msg: getApiErrorDetail(err) || err.message || 'Erro ao inativar.',
      });
    } finally {
      setInativandoId(null);
    }
  };

  const handleAtivar = async (id) => {
    setErroInline(null);
    setAtivandoId(id);
    try {
      await catalogosApi.ativar(id);
      await fetchProcedimentos();
    } catch (err) {
      setErroInline({
        id,
        msg: getApiErrorDetail(err) || err.message || 'Erro ao ativar.',
      });
    } finally {
      setAtivandoId(null);
    }
  };

  const showOnlyInactivesHint =
    !loading && procedimentos.length === 0 && !mostrarInativos && countInativos > 0;

  const showEmptyNoData =
    !loading && procedimentos.length === 0 && !showOnlyInactivesHint;

  const showEmptySearch =
    !loading &&
    procedimentos.length > 0 &&
    procedimentosFiltrados.length === 0 &&
    busca.trim() !== '';

  return (
    <div className="flex flex-col gap-4 xl:gap-5">
      {/* Barra superior: buscar + mostrar inativos + criar */}
      <div className="shrink-0 rounded-2xl border border-app-border bg-white p-3 sm:p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <label htmlFor="procedimento-search" className="ml-1 text-[13px] font-bold text-[#00a88e]">
              Buscar procedimento
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00a88e]/60"
                strokeWidth={2.5}
              />
              <input
                id="procedimento-search"
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Digite para filtrar a lista..."
                className="w-full rounded-xl border border-slate-200 bg-[#f8fbfb] py-2.5 pl-11 pr-4 text-[14px] font-medium outline-none focus:border-[#00a88e] focus:ring-4 focus:ring-[#00a88e]/20 sm:py-3"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 lg:pb-1">
            <input
              id="mostrar-inativos"
              type="checkbox"
              className="h-4 w-4 shrink-0 rounded border-[#cbd5e1] text-[#00a88e] focus:ring-[#00a88e]/30"
              checked={mostrarInativos}
              onChange={(e) => setMostrarInativos(e.target.checked)}
            />
            <label
              htmlFor="mostrar-inativos"
              className="cursor-pointer select-none text-[12px] font-bold text-[#64748b]"
            >
              Mostrar inativos
            </label>
          </div>

          <form
            onSubmit={handleCriar}
            className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end lg:max-w-xl xl:max-w-2xl"
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <label htmlFor="procedimento-new-name" className="ml-1 text-[13px] font-bold text-[#00a88e]">
                Novo procedimento
              </label>
              <input
                id="procedimento-new-name"
                type="text"
                value={novoNome}
                onChange={(e) => {
                  setNovoNome(e.target.value);
                  if (erro) setErro('');
                }}
                placeholder="Ex.: Botox, Preenchimento..."
                className={`w-full rounded-xl border bg-[#f8fbfb] px-4 py-2.5 text-[14px] font-medium outline-none focus:ring-4 sm:py-3 ${
                  erro
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                    : 'border-[#00a88e]/25 focus:border-[#00a88e] focus:ring-[#00a88e]/20'
                }`}
              />
            </div>
            <button
              type="submit"
              disabled={criando}
              className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-transparent bg-[#00a88e] px-5 py-2.5 text-[14px] font-bold text-white shadow-md transition-all hover:bg-[#00967f] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:py-3"
            >
              {criando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" strokeWidth={2.5} />
              )}
              Criar
            </button>
          </form>
        </div>

        {erro && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] font-bold text-red-600">
            {erro}
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="flex min-h-0 w-full min-w-0 flex-col rounded-2xl border border-app-border bg-[#f8fbfb]/80 p-4 sm:p-5 xl:p-6">
        {loading ? (
          <div className="flex min-h-[12rem] flex-1 flex-col items-center justify-center gap-2 px-2 py-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-[#00a88e]" />
            <span className="text-[13px] font-medium text-[#64748b]">Carregando procedimentos...</span>
          </div>
        ) : showOnlyInactivesHint ? (
          <div className="flex min-h-[12rem] flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-center text-[#94a3b8]">
            <EyeOff className="h-10 w-10 shrink-0 opacity-30" strokeWidth={2} />
            <p className="max-w-[320px] text-[14px] font-medium leading-snug text-[#475569]">
              Nenhum procedimento ativo. Existem{' '}
              <span className="font-bold text-[#0f172a]">
                {countInativos} inativo{countInativos !== 1 ? 's' : ''}
              </span>{' '}
              — habilite &ldquo;Mostrar inativos&rdquo; acima para vê-los.
            </p>
            <button
              type="button"
              onClick={() => setMostrarInativos(true)}
              className="mt-1 text-[13px] font-bold text-[#00a88e] hover:underline"
            >
              Mostrar inativos
            </button>
          </div>
        ) : showEmptyNoData ? (
          <div className="flex min-h-[12rem] flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center text-[#94a3b8]">
            <Stethoscope className="h-10 w-10 shrink-0 opacity-30" />
            <p className="max-w-[320px] text-[14px] font-medium">
              Nenhum procedimento cadastrado. Cadastre o primeiro acima.
            </p>
          </div>
        ) : showEmptySearch ? (
          <div className="flex min-h-[12rem] flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center text-[#94a3b8]">
            <Search className="h-10 w-10 shrink-0 opacity-30" strokeWidth={2} />
            <p className="max-w-[280px] text-[14px] font-medium">Nenhum procedimento coincide com a busca</p>
            <button
              type="button"
              onClick={() => setBusca('')}
              className="mt-1 text-[13px] font-bold text-[#00a88e] hover:underline"
            >
              Limpar filtro
            </button>
          </div>
        ) : (
          <div className="grid w-full min-w-0 grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] content-start gap-3">
            {procedimentosFiltrados.map((p) => {
              const id = p.id;
              const nome = nomeProc(p);
              const ativo = isAtivo(p);
              const isConfirmInativar = togglingId === id;
              const cardErro = erroInline?.id === id ? erroInline.msg : null;

              return (
                <div
                  key={id}
                  className="flex min-w-[min(100%,14rem)] flex-col gap-2 rounded-xl border border-app-border bg-white p-3.5 shadow-sm transition-all hover:border-[#00a88e]/30 sm:p-4"
                >
                  {isConfirmInativar ? (
                    <div className="flex w-full min-w-0 flex-col gap-2.5 xl:flex-row xl:flex-wrap xl:items-center xl:gap-2">
                      <span className="w-full min-w-0 break-words text-[13px] font-bold leading-snug text-[#0f172a] xl:flex-1">
                        Inativar &ldquo;{nome}&rdquo;?
                      </span>
                      <div className="flex w-full flex-row flex-wrap gap-2 xl:w-auto xl:flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleConfirmarInativacao(id)}
                          disabled={inativandoId === id}
                          className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {inativandoId === id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" strokeWidth={2.5} />
                          )}
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelarInativacao}
                          className="flex-shrink-0 rounded-lg bg-[#f1f5f9] px-3 py-1.5 text-[12px] font-bold text-[#64748b] transition-colors hover:bg-[#e2e8f0]"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex w-full min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between xl:gap-2">
                      <div className="flex min-w-0 flex-1 items-start gap-2.5 xl:items-center xl:gap-3">
                        <Stethoscope className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#00a88e] md:mt-0" strokeWidth={2} />
                        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <span
                            title={nome}
                            className="min-w-0 break-words text-[15px] font-bold leading-snug text-[#0f172a] md:text-[14px]"
                          >
                            {nome || '(sem nome)'}
                          </span>
                          {!ativo ? (
                            <span className="shrink-0 rounded-md bg-[#f1f5f9] px-1.5 py-0.5 text-[10px] font-bold text-[#64748b]">
                              Inativo
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div className="flex w-full flex-shrink-0 items-center justify-end gap-1.5 border-t border-[#00a88e]/10 pt-0.5 xl:ml-2 xl:w-auto xl:border-0 xl:pt-0">
                        {ativo ? (
                          <button
                            type="button"
                            onClick={() => handleSolicitarInativacao(id)}
                            title="Inativar"
                            className="rounded-lg p-1.5 text-[#64748b] transition-colors hover:bg-red-50 hover:text-red-500"
                          >
                            <PowerOff className="h-3.5 w-3.5" strokeWidth={2} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAtivar(id)}
                            disabled={ativandoId === id}
                            title="Ativar"
                            className="rounded-lg p-1.5 text-[#64748b] transition-colors hover:bg-[#f0fdfa] hover:text-[#00a88e] disabled:opacity-50"
                          >
                            {ativandoId === id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Power className="h-3.5 w-3.5" strokeWidth={2} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {cardErro && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600">
                      {cardErro}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
