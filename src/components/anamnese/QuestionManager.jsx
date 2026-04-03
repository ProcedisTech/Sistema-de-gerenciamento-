import React, { useState, useEffect, useMemo } from 'react';
import { Plus, HelpCircle, Loader2, ChevronDown, ChevronUp, X, ListChecks } from 'lucide-react';
import { anamneseApi, dimensoesApi } from '../../services/api';

const TIPOS_COM_ALTERNATIVAS = ['escolha_unica', 'multipla_escolha'];

export function QuestionManager() {
  const [perguntas, setPerguntas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [tiposResposta, setTiposResposta] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState('');

  const [formAberto, setFormAberto] = useState(false);
  const [categoriaId, setCategoriaId] = useState('');
  const [tipoRespostaId, setTipoRespostaId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [alternativas, setAlternativas] = useState([]);
  const [novaAlternativa, setNovaAlternativa] = useState('');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState('');

  const tipoSelecionado = useMemo(() => {
    const t = tiposResposta.find((tr) => String(tr.tipo_resposta_id || tr.id) === String(tipoRespostaId));
    return t?.tipo || '';
  }, [tiposResposta, tipoRespostaId]);

  const precisaAlternativas = TIPOS_COM_ALTERNATIVAS.includes(tipoSelecionado);

  const fetchDados = async () => {
    setLoading(true);
    const [cats, tipos, pergs] = await Promise.all([
      anamneseApi.listCategorias().catch((e) => { console.warn('Categorias:', e.message); return []; }),
      dimensoesApi.tiposResposta().catch((e) => { console.warn('Tipos resposta:', e.message); return []; }),
      anamneseApi.listAllHabitos().catch((e) => { console.warn('Hábitos:', e.message); return []; }),
    ]);
    setCategorias(Array.isArray(cats) ? cats : []);
    setTiposResposta(Array.isArray(tipos) ? tipos : []);
    setPerguntas(Array.isArray(pergs) ? pergs : []);
    setLoading(false);
  };

  useEffect(() => { fetchDados(); }, []);

  const perguntasFiltradas = useMemo(() => {
    if (!filtroCategoria) return perguntas;
    return perguntas.filter((p) => String(p.categoriaId) === String(filtroCategoria));
  }, [perguntas, filtroCategoria]);

  const handleAdicionarAlternativa = () => {
    const texto = novaAlternativa.trim();
    if (!texto) return;
    setAlternativas((prev) => [...prev, { alternativa: texto, ordem: prev.length + 1 }]);
    setNovaAlternativa('');
  };

  const handleRemoverAlternativa = (idx) => {
    setAlternativas((prev) => prev.filter((_, i) => i !== idx).map((a, i) => ({ ...a, ordem: i + 1 })));
  };

  const resetForm = () => {
    setCategoriaId('');
    setTipoRespostaId('');
    setDescricao('');
    setAlternativas([]);
    setNovaAlternativa('');
    setErro('');
  };

  const handleCriar = async (e) => {
    e.preventDefault();
    if (!categoriaId || !tipoRespostaId || !descricao.trim()) {
      setErro('Preencha categoria, tipo de resposta e descrição.');
      return;
    }
    if (precisaAlternativas && alternativas.length < 2) {
      setErro('Adicione pelo menos 2 alternativas para perguntas de escolha.');
      return;
    }
    setErro('');
    setCriando(true);
    try {
      const habito = await anamneseApi.createHabito({
        categoriaId,
        tipoRespostaId,
        descricao: descricao.trim(),
      });

      if (precisaAlternativas && alternativas.length > 0) {
        await anamneseApi.addAlternativas(habito.id, alternativas);
      }

      resetForm();
      setFormAberto(false);
      await fetchDados();
    } catch (err) {
      setErro(err.message || 'Erro ao criar pergunta.');
    } finally {
      setCriando(false);
    }
  };

  const tipoLabel = (tipo) => {
    const map = { texto: 'Texto', escolha_unica: 'Escolha Única', multipla_escolha: 'Múltipla Escolha', booleano: 'Sim/Não', numero: 'Número' };
    return map[tipo] || tipo;
  };

  const tipoBadgeColor = (tipo) => {
    const map = {
      texto: 'bg-blue-50 text-blue-700 border-blue-200',
      escolha_unica: 'bg-purple-50 text-purple-700 border-purple-200',
      multipla_escolha: 'bg-amber-50 text-amber-700 border-amber-200',
      booleano: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      numero: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    };
    return map[tipo] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="text-[13px] font-bold text-[#64748b]">Filtrar por categoria:</label>
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="px-3 py-2 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[13px] font-medium focus:outline-none focus:border-[#00a88e] appearance-none"
          >
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => { setFormAberto(!formAberto); if (!formAberto) resetForm(); }}
          className="px-5 py-3 rounded-xl font-bold text-[14px] transition-all shadow-md bg-[#00a88e] hover:bg-[#00967f] text-white border-[3px] border-transparent flex items-center gap-2"
        >
          {formAberto ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" strokeWidth={2.5} />}
          {formAberto ? 'Fechar' : 'Nova Pergunta'}
        </button>
      </div>

      {formAberto && (
        <form onSubmit={handleCriar} className="bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-2xl p-6 space-y-4">
          <h4 className="text-[16px] font-bold text-[#0f172a]">Criar Pergunta</h4>

          {erro && (
            <div className="bg-red-50 text-red-600 border-[3px] border-red-200 rounded-xl p-3 text-[13px] font-bold">{erro}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#00a88e] ml-1">Categoria *</label>
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="w-full px-4 py-3 bg-white border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e] appearance-none"
              >
                <option value="">Selecione...</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-[#00a88e] ml-1">Tipo de Resposta *</label>
              <select
                value={tipoRespostaId}
                onChange={(e) => { setTipoRespostaId(e.target.value); setAlternativas([]); }}
                className="w-full px-4 py-3 bg-white border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e] appearance-none"
              >
                <option value="">Selecione...</option>
                {tiposResposta.filter((t) => t.ativo !== false).map((t) => (
                  <option key={t.tipo_resposta_id || t.id} value={t.tipo_resposta_id || t.id}>{tipoLabel(t.tipo)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-[#00a88e] ml-1">Pergunta / Descrição *</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              placeholder="Ex: O paciente faz uso de medicamentos controlados?"
              className="w-full px-4 py-3 bg-white border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e]"
            />
          </div>

          {precisaAlternativas && (
            <div className="space-y-3 p-4 bg-white border-[3px] border-[#a855f7]/20 rounded-xl">
              <label className="text-[13px] font-bold text-[#a855f7] ml-1">Alternativas *</label>

              {alternativas.map((alt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#a855f7]/10 text-[#a855f7] text-[11px] font-bold flex items-center justify-center flex-shrink-0">{alt.ordem}</span>
                  <span className="flex-1 text-[14px] font-medium text-[#0f172a]">{alt.alternativa}</span>
                  <button type="button" onClick={() => handleRemoverAlternativa(idx)} className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 flex items-center justify-center">
                    <X className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                </div>
              ))}

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={novaAlternativa}
                  onChange={(e) => setNovaAlternativa(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdicionarAlternativa(); } }}
                  placeholder="Digitar alternativa e pressionar Enter..."
                  className="flex-1 px-3 py-2 bg-[#f8fbfb] border-[2px] border-[#a855f7]/20 rounded-lg text-[13px] font-medium focus:outline-none focus:border-[#a855f7]"
                />
                <button type="button" onClick={handleAdicionarAlternativa} className="px-3 py-2 rounded-lg bg-[#a855f7] text-white text-[12px] font-bold">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={criando}
              className="px-5 py-3 rounded-xl font-bold text-[14px] bg-[#00a88e] hover:bg-[#00967f] text-white border-[3px] border-transparent shadow-md disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {criando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Salvar Pergunta
            </button>
            <button type="button" onClick={() => { setFormAberto(false); resetForm(); }} className="px-5 py-3 rounded-xl font-bold text-[14px] bg-white text-[#64748b] border-[3px] border-[#e2e8f0] hover:border-[#00a88e]/20">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#00a88e]" />
          <span className="ml-2 text-[#64748b] text-[13px] font-medium">Carregando perguntas...</span>
        </div>
      ) : perguntasFiltradas.length === 0 ? (
        <div className="text-center py-12 text-[#94a3b8]">
          <HelpCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-[14px] font-medium">Nenhuma pergunta cadastrada</p>
          <p className="text-[12px] mt-1">Crie perguntas para montar fichas de anamnese</p>
        </div>
      ) : (
        <div className="space-y-3">
          {perguntasFiltradas.map((p) => (
            <div key={p.id} className="p-4 rounded-xl border-[3px] border-[#00a88e]/15 bg-white hover:border-[#00a88e]/30 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-[14px] font-bold text-[#0f172a]">{p.descricao}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#e6f7f5] text-[#0f766e] border-[2px] border-[#00a88e]/15">
                      {p.categoriaNome || 'Sem categoria'}
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border-[2px] ${tipoBadgeColor(p.tipoResposta)}`}>
                      {tipoLabel(p.tipoResposta)}
                    </span>
                  </div>
                </div>
              </div>

              {Array.isArray(p.alternativas) && p.alternativas.length > 0 && (
                <div className="mt-3 pl-3 border-l-[3px] border-[#a855f7]/20 space-y-1">
                  {p.alternativas.map((alt) => (
                    <div key={alt.id} className="flex items-center gap-2 text-[13px] text-[#475569]">
                      <ListChecks className="w-3.5 h-3.5 text-[#a855f7]" />
                      <span>{alt.alternativa}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
