import React, { useState, useEffect, useMemo } from 'react';
import { Plus, FileText, Loader2, ChevronUp, ChevronDown, Trash2, GripVertical, Save, X, Pencil } from 'lucide-react';
import { anamneseApi, dimensoesApi } from '../../services/api';
import { EditModal } from './QuestionManager';

export function FichaBuilder() {
  const [fichas, setFichas] = useState([]);
  const [perguntas, setPerguntas] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [tiposResposta, setTiposResposta] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editando, setEditando] = useState(null);
  const [fichaNome, setFichaNome] = useState('');
  const [fichaEspecialidadeId, setFichaEspecialidadeId] = useState('');
  const [fichaItens, setFichaItens] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [categorias, setCategorias] = useState([]);

  // delete confirmation modal
  const [fichaParaExcluir, setFichaParaExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

  // edit question from within the ficha builder
  const [editingPerguntaInBuilder, setEditingPerguntaInBuilder] = useState(null);

  const fetchDados = async () => {
    setLoading(true);
    const [fs, ps, es, cats, tipos] = await Promise.all([
      anamneseApi.listFichas().catch((e) => { console.warn('Fichas:', e.message); return []; }),
      anamneseApi.listAllHabitos().catch((e) => { console.warn('Hábitos:', e.message); return []; }),
      dimensoesApi.especialidades().catch((e) => { console.warn('Especialidades:', e.message); return []; }),
      anamneseApi.listCategorias().catch((e) => { console.warn('Categorias:', e.message); return []; }),
      dimensoesApi.tiposResposta().catch((e) => { console.warn('Tipos resposta:', e.message); return []; }),
    ]);
    setFichas(Array.isArray(fs) ? fs : []);
    setPerguntas(Array.isArray(ps) ? ps : []);
    setEspecialidades(Array.isArray(es) ? es : []);
    setCategorias(Array.isArray(cats) ? cats : []);
    setTiposResposta(Array.isArray(tipos) ? tipos : []);
    setLoading(false);
  };

  useEffect(() => { fetchDados(); }, []);

  const perguntasDisponiveis = useMemo(() => {
    const idsNaFicha = new Set(fichaItens.map((i) => i.perguntaId));
    let lista = perguntas.filter((p) => !idsNaFicha.has(p.id));
    if (filtroCategoria) lista = lista.filter((p) => String(p.categoriaId) === String(filtroCategoria));
    return lista;
  }, [perguntas, fichaItens, filtroCategoria]);

  const abrirNova = () => {
    setEditando('nova');
    setFichaNome('');
    setFichaEspecialidadeId('');
    setFichaItens([]);
    setErro('');
  };

  const abrirEdicao = (ficha) => {
    setEditando(ficha.id);
    setFichaNome(ficha.nome || '');
    setFichaEspecialidadeId(ficha.especialidadeId || '');
    setFichaItens(
      (ficha.itens || []).map((item) => ({
        perguntaId: item.pergunta?.id || item.perguntaId,
        descricao: item.pergunta?.descricao || '',
        categoriaNome: item.pergunta?.categoriaNome || '',
        tipoResposta: item.pergunta?.tipoResposta || item.pergunta?.tipo_resposta || '',
        ordem: item.ordem,
        obrigatorio: item.obrigatorio ?? false,
        prioridade: item.pergunta?.prioridade === 'ALERTA' ? 'ALERTA' : 'NORMAL',
      }))
    );
    setErro('');
  };

  const fecharEditor = () => {
    setEditando(null);
    setErro('');
  };

  const adicionarPergunta = (pergunta) => {
    setFichaItens((prev) => [
      ...prev,
      {
        perguntaId: pergunta.id,
        descricao: pergunta.descricao,
        categoriaNome: pergunta.categoriaNome || '',
        tipoResposta: pergunta.tipoResposta || '',
        ordem: prev.length + 1,
        obrigatorio: false,
        prioridade: pergunta.prioridade === 'ALERTA' ? 'ALERTA' : 'NORMAL',
      },
    ]);
  };

  const removerItem = (idx) => {
    setFichaItens((prev) => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, ordem: i + 1 })));
  };

  const moverItem = (idx, direcao) => {
    setFichaItens((prev) => {
      const copy = [...prev];
      const targetIdx = idx + direcao;
      if (targetIdx < 0 || targetIdx >= copy.length) return prev;
      [copy[idx], copy[targetIdx]] = [copy[targetIdx], copy[idx]];
      return copy.map((item, i) => ({ ...item, ordem: i + 1 }));
    });
  };

  const toggleObrigatorio = (idx) => {
    setFichaItens((prev) => prev.map((item, i) => i === idx ? { ...item, obrigatorio: !item.obrigatorio } : item));
  };

  const handleSalvar = async () => {
    if (!fichaNome.trim()) { setErro('Preencha o nome da ficha.'); return; }
    if (fichaItens.length === 0) { setErro('Adicione pelo menos uma pergunta.'); return; }
    setErro('');
    setSalvando(true);
    try {
      const payload = {
        nome: fichaNome.trim(),
        especialidadeId: fichaEspecialidadeId || undefined,
        itens: fichaItens.map((item) => ({
          perguntaId: item.perguntaId,
          ordem: item.ordem,
          obrigatorio: item.obrigatorio,
        })),
      };

      if (editando === 'nova') {
        await anamneseApi.createFicha(payload);
      } else {
        await anamneseApi.updateFicha(editando, payload);
      }

      fecharEditor();
      await fetchDados();
    } catch (err) {
      setErro(err.message || 'Erro ao salvar ficha.');
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExcluir = async () => {
    if (!fichaParaExcluir) return;
    setExcluindo(true);
    try {
      await anamneseApi.removeFicha(fichaParaExcluir);
      setFichaParaExcluir(null);
      await fetchDados();
    } catch (err) {
      console.warn('Erro ao excluir ficha:', err.message);
    } finally {
      setExcluindo(false);
    }
  };

  const tipoLabel = (tipo) => {
    const map = { texto: 'Texto', escolha_unica: 'Escolha Única', multipla_escolha: 'Múltipla Escolha', booleano: 'Sim/Não', numero: 'Número' };
    return map[tipo] || tipo;
  };

  // When a question is saved via EditModal inside the builder, update perguntas list and reflect in fichaItens
  const handleEditSavedInBuilder = async (updated) => {
    setEditingPerguntaInBuilder(null);
    if (updated === null) {
      await fetchDados();
    } else {
      setPerguntas((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setFichaItens((prev) =>
        prev.map((item) =>
          String(item.perguntaId) === String(updated.id)
            ? {
              ...item,
              descricao: updated.descricao || item.descricao,
              categoriaNome: updated.categoriaNome || item.categoriaNome,
              prioridade: updated.prioridade === 'ALERTA' ? 'ALERTA' : 'NORMAL',
            }
            : item
        )
      );
    }
  };

  // Find the full pergunta object for a ficha item to open EditModal
  const getPerguntaById = (id) => perguntas.find((p) => String(p.id) === String(id)) || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#00a88e]" />
        <span className="ml-2 text-[#64748b] text-[13px] font-medium">Carregando fichas...</span>
      </div>
    );
  }

  return (
    <>
      {/* Custom delete confirmation modal */}
      {fichaParaExcluir != null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-2xl border-[3px] border-[#00a88e]/20 shadow-2xl w-full max-w-md flex flex-col"
          >
            <div className="px-6 py-4 border-b border-[#e2e8f0]">
              <h3 className="text-[16px] font-bold text-[#0f172a]">Desativar ficha</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-[14px] font-medium text-[#475569] leading-relaxed">
                Deseja desativar esta ficha? Ela não estará mais disponível para novas consultas.
              </p>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setFichaParaExcluir(null)}
                disabled={excluindo}
                className="px-5 py-3 rounded-xl font-bold text-[14px] bg-white text-[#64748b] border-[3px] border-[#e2e8f0] hover:border-[#00a88e]/20 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarExcluir}
                disabled={excluindo}
                className="px-5 py-3 rounded-xl font-bold text-[14px] bg-red-500 hover:bg-red-600 text-white border-[3px] border-transparent shadow-md disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {excluindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Desativar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit question from inside the ficha builder */}
      {editingPerguntaInBuilder && (
        <EditModal
          key={editingPerguntaInBuilder.id}
          pergunta={editingPerguntaInBuilder}
          categorias={categorias}
          tiposResposta={tiposResposta}
          tipoLabel={tipoLabel}
          onClose={() => setEditingPerguntaInBuilder(null)}
          onSaved={handleEditSavedInBuilder}
        />
      )}

      {editando !== null ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-[16px] font-bold text-[#0f172a]">
              {editando === 'nova' ? 'Nova Ficha' : 'Editar Ficha'}
            </h4>
            <button type="button" onClick={fecharEditor} className="px-4 py-2 rounded-xl font-bold text-[13px] bg-white text-[#64748b] border-[3px] border-[#e2e8f0] hover:border-[#00a88e]/20 flex items-center gap-1.5">
              <X className="w-4 h-4" /> Cancelar
            </button>
          </div>

          {erro && (
            <div className="bg-red-50 text-red-600 border-[3px] border-red-200 rounded-xl p-3 text-[13px] font-bold">{erro}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#00a88e] ml-1">Nome da Ficha *</label>
              <input
                type="text"
                value={fichaNome}
                onChange={(e) => setFichaNome(e.target.value)}
                placeholder="Ex: Anamnese Cardiológica Padrão"
                className="w-full px-4 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#00a88e] ml-1">Especialidade (opcional)</label>
              <select
                value={fichaEspecialidadeId}
                onChange={(e) => setFichaEspecialidadeId(e.target.value)}
                className="w-full px-4 py-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e] appearance-none"
              >
                <option value="">Nenhuma</option>
                {especialidades.map((e) => (
                  <option key={e.especialidade_id || e.id} value={e.especialidade_id || e.id}>{e.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 xl:gap-8 xl:grid-cols-[1fr_1fr] min-h-0">
            {/* Perguntas na ficha */}
            <div className="space-y-3 min-h-0 min-w-0 flex flex-col">
              <h5 className="text-[14px] font-bold text-[#0f172a]">Perguntas na ficha ({fichaItens.length})</h5>
              {fichaItens.length === 0 ? (
                <div className="text-center py-8 text-[#94a3b8] bg-[#f8fbfb] border-[3px] border-dashed border-[#00a88e]/20 rounded-xl">
                  <p className="text-[13px]">Selecione perguntas do banco ao lado</p>
                </div>
              ) : (
                <div className="space-y-2 lg:max-h-[min(520px,calc(100vh-22rem))] overflow-y-auto pr-1 custom-scrollbar">
                  {fichaItens.map((item, idx) => {
                    const itemAlerta = item.prioridade === 'ALERTA';
                    return (
                    <div
                      key={item.perguntaId}
                      className={`flex flex-col gap-2 p-3 rounded-xl border-[3px] cursor-pointer transition-all sm:flex-row sm:items-center sm:gap-2 ${
                        itemAlerta
                          ? 'border-red-300 border-l-[4px] border-l-red-500 bg-[#fff5f5] hover:border-red-400'
                          : 'border-[#00a88e]/15 bg-white hover:border-[#00a88e]/30'
                      }`}
                      onClick={() => {
                        const pergunta = getPerguntaById(item.perguntaId);
                        if (pergunta) setEditingPerguntaInBuilder(pergunta);
                      }}
                    >
                      {/* Row 1: reorder arrows + order badge + text */}
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <div className="flex flex-col gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button type="button" onClick={() => moverItem(idx, -1)} disabled={idx === 0} className="text-[#94a3b8] hover:text-[#00a88e] disabled:opacity-30">
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => moverItem(idx, 1)} disabled={idx === fichaItens.length - 1} className="text-[#94a3b8] hover:text-[#00a88e] disabled:opacity-30">
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                        <span className="w-6 h-6 rounded-full bg-[#00a88e] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{item.ordem}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-[#0f172a] break-words leading-snug">{item.descricao}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            <span className="text-[11px] text-[#64748b]">{item.categoriaNome}</span>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border-[2px] bg-blue-50 text-blue-700 border-blue-200">
                              {tipoLabel(item.tipoResposta)}
                            </span>
                            {itemAlerta ? (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border-[2px] border-red-600 bg-red-700 text-white">
                                ⚠️ Alerta
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border-[2px] border-slate-200 bg-slate-100 text-slate-700">
                                Normal
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Row 2 (stacks below on mobile, inline on sm+): action buttons */}
                      <div className="flex items-center gap-1.5 flex-shrink-0 pl-8 sm:pl-0" onClick={(e) => e.stopPropagation()}>
                        {/* Toggle obrigatório */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleObrigatorio(idx); }}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors flex-shrink-0 ${
                            item.obrigatorio
                              ? 'bg-red-500 text-white'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                          title={item.obrigatorio ? 'Obrigatória — clique para tornar opcional' : 'Opcional — clique para tornar obrigatória'}
                        >
                          <span className={`w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center ${
                            item.obrigatorio ? 'border-white/60 bg-white/20' : 'border-slate-400'
                          }`}>
                            {item.obrigatorio && (
                              <svg className="w-2 h-2" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                          Obrigatório
                        </button>

                        {/* Edit question button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const pergunta = getPerguntaById(item.perguntaId);
                            if (pergunta) setEditingPerguntaInBuilder(pergunta);
                          }}
                          title="Editar pergunta"
                          aria-label="Editar pergunta"
                          className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#00a88e] transition-colors flex-shrink-0"
                        >
                          <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removerItem(idx); }}
                          title="Remover da ficha"
                          aria-label="Remover da ficha"
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Banco de perguntas */}
            <div className="space-y-3 min-h-0 flex flex-col">
              <div className="flex items-center justify-between gap-2 flex-shrink-0">
                <h5 className="text-[14px] font-bold text-[#0f172a]">Banco de Perguntas</h5>
                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  className="px-2 py-1 bg-[#f8fbfb] border-[2px] border-[#00a88e]/15 rounded-lg text-[12px] font-medium focus:outline-none appearance-none"
                >
                  <option value="">Todas</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              <div className="max-h-[400px] lg:max-h-[min(520px,calc(100vh-22rem))] flex-1 min-h-[200px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {perguntasDisponiveis.length === 0 ? (
                  <p className="text-center py-6 text-[#94a3b8] text-[13px]">Nenhuma pergunta disponível</p>
                ) : (
                  perguntasDisponiveis.map((p) => {
                    const bankAlerta = p.prioridade === 'ALERTA';
                    return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => adicionarPergunta(p)}
                      className={`w-full text-left p-3 rounded-xl border-[2px] transition-all ${
                        bankAlerta
                          ? 'border-red-300 border-l-[4px] border-l-red-500 bg-[#fff5f5] hover:border-red-400'
                          : 'border-[#e2e8f0] bg-white hover:border-[#00a88e]/30 hover:bg-[#f0fdfa]'
                      }`}
                    >
                      <p className="text-[13px] font-bold text-[#0f766e]">{p.descricao}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className="text-[11px] text-[#64748b]">{p.categoriaNome}</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border-[2px] bg-blue-50 text-blue-700 border-blue-200">
                          {tipoLabel(p.tipoResposta)}
                        </span>
                        {bankAlerta ? (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border-[2px] border-red-600 bg-red-700 text-white">
                            ⚠️ Alerta
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md border-[2px] border-slate-200 bg-slate-100 text-slate-700">
                            Normal
                          </span>
                        )}
                      </div>
                    </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t-[3px] border-[#00a88e]/15">
            <button
              type="button"
              onClick={handleSalvar}
              disabled={salvando}
              className="px-6 py-3 rounded-xl font-bold text-[14px] bg-[#00a88e] hover:bg-[#00967f] text-white border-[3px] border-transparent shadow-md disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Ficha
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div />
            <button type="button" onClick={abrirNova} className="px-5 py-3 rounded-xl font-bold text-[14px] bg-[#00a88e] hover:bg-[#00967f] text-white border-[3px] border-transparent shadow-md flex items-center gap-2">
              <Plus className="w-4 h-4" strokeWidth={2.5} /> Nova Ficha
            </button>
          </div>

          {fichas.length === 0 ? (
            <div className="text-center py-12 text-[#94a3b8]">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-[14px] font-medium">Nenhuma ficha cadastrada</p>
              <p className="text-[12px] mt-1">Crie fichas para reutilizar em consultas</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {fichas.map((ficha) => (
                <div
                  key={ficha.id}
                  onClick={() => abrirEdicao(ficha)}
                  className="p-4 rounded-xl border-[3px] border-[#00a88e]/15 bg-white hover:border-[#00a88e]/40 hover:bg-[#f0fdfa] transition-all shadow-sm flex flex-col cursor-pointer"
                >
                  <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between xl:gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1">
                        <FileText className="w-5 h-5 text-[#00a88e] flex-shrink-0 mt-0.5" strokeWidth={2} />
                        <h5 className="text-[15px] font-bold text-[#0f172a] break-words [overflow-wrap:anywhere] leading-snug">{ficha.nome}</h5>
                      </div>
                      {ficha.especialidadeNome && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#e6f7f5] text-[#0f766e] border-[2px] border-[#00a88e]/15">
                          {ficha.especialidadeNome}
                        </span>
                      )}
                      <p className="text-[12px] text-[#64748b] mt-1">
                        {ficha.itens?.length || 0} pergunta{(ficha.itens?.length || 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); abrirEdicao(ficha); }}
                        title="Editar ficha"
                        aria-label="Editar ficha"
                        className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#f0fdfa] hover:text-[#00a88e] transition-colors"
                      >
                        <Pencil className="w-4 h-4" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFichaParaExcluir(ficha.id); }}
                        title="Excluir ficha"
                        aria-label="Excluir ficha"
                        className="p-1.5 rounded-lg text-[#64748b] hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
