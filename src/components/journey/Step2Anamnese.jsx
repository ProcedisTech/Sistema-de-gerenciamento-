import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { ClipboardList, Square, CheckSquare, Loader2, FileText } from 'lucide-react';
import { anamneseApi } from '../../services/api';

function DynamicQuestion({ pergunta, resposta, onChange }) {
  const tipo = pergunta.tipoResposta;

  if (tipo === 'texto') {
    return (
      <div className="space-y-1.5">
        <label className="text-[13px] font-bold text-[#0f766e] ml-1">{pergunta.descricao}</label>
        <textarea
          value={resposta?.respostaTexto || ''}
          onChange={(e) => onChange({ perguntaId: pergunta.id, respostaTexto: e.target.value })}
          rows={2}
          className="w-full p-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e]"
          placeholder="Digite a resposta..."
        />
      </div>
    );
  }

  if (tipo === 'numero') {
    return (
      <div className="space-y-1.5">
        <label className="text-[13px] font-bold text-[#0f766e] ml-1">{pergunta.descricao}</label>
        <input
          type="number"
          value={resposta?.respostaNumero ?? ''}
          onChange={(e) => onChange({ perguntaId: pergunta.id, respostaNumero: e.target.value === '' ? null : Number(e.target.value) })}
          className="w-full p-3 bg-[#f8fbfb] border-[3px] border-[#00a88e]/20 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e]"
          placeholder="0"
        />
      </div>
    );
  }

  if (tipo === 'booleano') {
    const valor = resposta?.respostaBoolean || false;
    return (
      <div
        onClick={() => onChange({ perguntaId: pergunta.id, respostaBoolean: !valor })}
        className={`flex items-center gap-4 p-4 border-[3px] rounded-xl cursor-pointer transition-all shadow-sm ${
          valor ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/25 bg-white hover:bg-[#f8fbfb]'
        }`}
      >
        {valor
          ? <CheckSquare className="w-6 h-6 text-[#00a88e]" strokeWidth={2.5} />
          : <Square className="w-6 h-6 text-[#00a88e]/40" strokeWidth={2.5} />
        }
        <span className={`text-[14px] font-bold ${valor ? 'text-[#0f766e]' : 'text-[#475569]'}`}>
          {pergunta.descricao}
        </span>
      </div>
    );
  }

  if (tipo === 'escolha_unica') {
    const selecionada = resposta?.perguntaOpcaoId || null;
    return (
      <div className="space-y-2">
        <label className="text-[13px] font-bold text-[#0f766e] ml-1">{pergunta.descricao}</label>
        <div className="space-y-2">
          {(pergunta.alternativas || []).map((alt) => {
            const ativa = String(selecionada) === String(alt.id);
            return (
              <div
                key={alt.id}
                onClick={() => onChange({ perguntaId: pergunta.id, perguntaOpcaoId: alt.id })}
                className={`flex items-center gap-3 p-3 border-[3px] rounded-xl cursor-pointer transition-all ${
                  ativa ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/15 bg-white hover:bg-[#f8fbfb]'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-[3px] flex items-center justify-center flex-shrink-0 ${ativa ? 'border-[#00a88e]' : 'border-[#94a3b8]'}`}>
                  {ativa && <div className="w-2.5 h-2.5 rounded-full bg-[#00a88e]" />}
                </div>
                <span className={`text-[14px] font-medium ${ativa ? 'text-[#0f766e]' : 'text-[#475569]'}`}>{alt.alternativa}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (tipo === 'multipla_escolha') {
    const selecionadas = resposta?.opcoesSelecionadas || [];
    return (
      <div className="space-y-2">
        <label className="text-[13px] font-bold text-[#0f766e] ml-1">{pergunta.descricao}</label>
        <div className="space-y-2">
          {(pergunta.alternativas || []).map((alt) => {
            const ativa = selecionadas.includes(alt.id);
            const toggle = () => {
              const next = ativa ? selecionadas.filter((id) => id !== alt.id) : [...selecionadas, alt.id];
              onChange({ perguntaId: pergunta.id, opcoesSelecionadas: next });
            };
            return (
              <div
                key={alt.id}
                onClick={toggle}
                className={`flex items-center gap-3 p-3 border-[3px] rounded-xl cursor-pointer transition-all ${
                  ativa ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/15 bg-white hover:bg-[#f8fbfb]'
                }`}
              >
                {ativa
                  ? <CheckSquare className="w-5 h-5 text-[#00a88e]" strokeWidth={2.5} />
                  : <Square className="w-5 h-5 text-[#94a3b8]" strokeWidth={2} />
                }
                <span className={`text-[14px] font-medium ${ativa ? 'text-[#0f766e]' : 'text-[#475569]'}`}>{alt.alternativa}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-[#f8fbfb] border-[3px] border-[#e2e8f0] rounded-xl text-[13px] text-[#64748b]">
      Tipo de resposta não suportado: {tipo}
    </div>
  );
}

export const Step2Anamnese = forwardRef(function Step2Anamnese({
  queixa, setQueixa,
  expectativas, setExpectativas,
  gestante, setGestante,
  amamentando, setAmamentando,
  anticoagulantes, setAnticoagulantes,
  queloides, setQueloides,
}, ref) {
  const [fichas, setFichas] = useState([]);
  const [fichaSelecionadaId, setFichaSelecionadaId] = useState('');
  const [fichaSelecionada, setFichaSelecionada] = useState(null);
  const [respostas, setRespostas] = useState({});

  useImperativeHandle(ref, () => ({
    getAnamneseData: () => {
      if (!fichaSelecionadaId || !fichaSelecionada) return null;
      return {
        anamneseId: fichaSelecionadaId,
        respostas: Object.values(respostas).map((r) => ({
          perguntaId: r.perguntaId,
          perguntaOpcaoId: r.perguntaOpcaoId || undefined,
          respostaTexto: r.respostaTexto || undefined,
          respostaNumero: r.respostaNumero ?? undefined,
          respostaBoolean: r.respostaBoolean ?? undefined,
        })),
      };
    },
  }), [fichaSelecionadaId, fichaSelecionada, respostas]);
  const [loadingFichas, setLoadingFichas] = useState(true);
  const [loadingFicha, setLoadingFicha] = useState(false);

  useEffect(() => {
    anamneseApi.listFichas()
      .then((data) => setFichas(Array.isArray(data) ? data : []))
      .catch(() => setFichas([]))
      .finally(() => setLoadingFichas(false));
  }, []);

  const handleSelecionarFicha = useCallback(async (id) => {
    setFichaSelecionadaId(id);
    if (!id) { setFichaSelecionada(null); return; }
    setLoadingFicha(true);
    try {
      const ficha = await anamneseApi.getFicha(id);
      setFichaSelecionada(ficha);
      setRespostas({});
    } catch {
      setFichaSelecionada(null);
    } finally {
      setLoadingFicha(false);
    }
  }, []);

  const handleRespostaChange = useCallback((resposta) => {
    setRespostas((prev) => ({ ...prev, [resposta.perguntaId]: resposta }));
  }, []);

  const legacyItems = [
    { state: gestante, setter: setGestante, label: 'Gestante' },
    { state: amamentando, setter: setAmamentando, label: 'Amamentando' },
    { state: anticoagulantes, setter: setAnticoagulantes, label: 'Uso de Anticoagulantes' },
    { state: queloides, setter: setQueloides, label: 'Histórico de Queloides' },
  ];

  const itensOrdenados = fichaSelecionada?.itens
    ? [...fichaSelecionada.itens].sort((a, b) => a.ordem - b.ordem)
    : [];

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-[#f3e8ff] p-3 rounded-2xl text-[#a855f7] border-[3px] border-[#a855f7]/25">
          <ClipboardList className="w-7 h-7" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-[20px] font-bold text-[#0f172a]">Anamnese Completa</h3>
          <p className="text-[#64748b] text-[14px] font-medium">Histórico médico e contraindicações</p>
        </div>
      </div>

      {/* Seletor de ficha */}
      <div className="mb-6 p-4 bg-[#f0fdfa] border-[3px] border-[#00a88e]/20 rounded-2xl">
        <div className="flex items-center gap-3 mb-3">
          <FileText className="w-5 h-5 text-[#00a88e]" strokeWidth={2} />
          <label className="text-[14px] font-bold text-[#0f766e]">Ficha de Anamnese</label>
        </div>
        {loadingFichas ? (
          <div className="flex items-center gap-2 text-[#64748b] text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando fichas...
          </div>
        ) : fichas.length === 0 ? (
          <p className="text-[13px] text-[#94a3b8]">Nenhuma ficha disponível. Crie fichas na aba Anamnese do menu.</p>
        ) : (
          <select
            value={fichaSelecionadaId}
            onChange={(e) => handleSelecionarFicha(e.target.value)}
            className="w-full px-4 py-3 bg-white border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e] appearance-none"
          >
            <option value="">Selecione uma ficha...</option>
            {fichas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome} {f.especialidadeNome ? `(${f.especialidadeNome})` : ''} — {f.itens?.length || 0} perguntas
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Perguntas dinâmicas da ficha */}
      {loadingFicha && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[#00a88e]" />
          <span className="ml-2 text-[#64748b] text-[13px]">Carregando perguntas...</span>
        </div>
      )}

      {fichaSelecionada && itensOrdenados.length > 0 && (
        <div className="space-y-4 mb-6 p-6 bg-white border-[3px] border-[#a855f7]/20 rounded-2xl">
          <h4 className="text-[16px] font-bold text-[#0f172a] mb-2">{fichaSelecionada.nome}</h4>
          {itensOrdenados.map((item) => (
            <div key={item.id} className="relative">
              {item.obrigatorio && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" title="Obrigatória" />
              )}
              <DynamicQuestion
                pergunta={item.pergunta}
                resposta={respostas[item.pergunta?.id]}
                onChange={handleRespostaChange}
              />
            </div>
          ))}
        </div>
      )}

      {/* Campos fixos originais */}
      <form className="space-y-6 bg-white border-[3px] border-[#00a88e]/25 rounded-2xl p-6">
        <div className="space-y-2">
          <label className="text-[13px] font-bold text-[#00a88e] ml-1">Queixa Principal <span className="text-red-500">*</span></label>
          <textarea
            value={queixa}
            onChange={(e) => setQueixa(e.target.value)}
            rows={3}
            className="w-full p-4 bg-[#f8fbfb] border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e]"
            placeholder="Descreva o motivo da consulta..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-[13px] font-bold text-[#00a88e] ml-1">Expectativas do Paciente <span className="text-red-500">*</span></label>
          <textarea
            value={expectativas}
            onChange={(e) => setExpectativas(e.target.value)}
            rows={3}
            className="w-full p-4 bg-[#f8fbfb] border-[3px] border-[#00a88e]/25 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/20 focus:border-[#00a88e]"
            placeholder="O que o paciente espera do procedimento..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t-[3px] border-[#00a88e]/15">
          {legacyItems.map((item, idx) => (
            <div
              key={idx}
              onClick={() => item.setter(!item.state)}
              className={`flex items-center gap-4 p-4 border-[3px] rounded-xl cursor-pointer transition-all shadow-sm ${
                item.state ? 'border-[#00a88e] bg-[#e6f7f5]' : 'border-[#00a88e]/25 bg-white hover:bg-[#f8fbfb]'
              }`}
            >
              {item.state ? (
                <CheckSquare className="w-6 h-6 text-[#00a88e]" strokeWidth={2.5} />
              ) : (
                <Square className="w-6 h-6 text-[#00a88e]/40" strokeWidth={2.5} />
              )}
              <span className={`text-[14px] font-bold ${item.state ? 'text-[#0f766e]' : 'text-[#475569]'}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </form>
    </div>
  );
});
