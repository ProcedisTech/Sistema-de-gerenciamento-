import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { RetornoOrigemSelect } from '../agenda/RetornoOrigemSelect.jsx';
import { pacientesApi, planejamentosApi, procedimentosApi } from '../../services/api.js';
import { normalizeApiList } from '../../utils/agendaDashboardMapping.js';
import { normalizeListaPlanos } from '../../utils/planejamentoNormalize.js';
import { nomeProcedimentoRaiz } from '../agenda/retornoOrigemUtils.js';

export function ConsultaRetornoOrigemModal({
  open,
  pacienteId,
  onClose,
  onConfirm,
}) {
  const [selectedId, setSelectedId] = useState('');
  const [optionsPlano, setOptionsPlano] = useState([]);
  const [optionsHistorico, setOptionsHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');

  useEffect(() => {
    if (!open || !pacienteId) return undefined;
    let cancelled = false;

    Promise.allSettled([
      pacientesApi.listarProcedimentosFeitosRaiz(pacienteId),
      planejamentosApi.listarPorPaciente(pacienteId),
      procedimentosApi.byPaciente(pacienteId),
    ])
      .then(([resHistorico, resPlanos, resProcs]) => {
        if (cancelled) return;

        if (resHistorico.status === 'rejected') {
          setError(resHistorico.reason?.message || 'Erro ao carregar procedimentos.');
          setLoading(false);
          return;
        }

        const raizesRaw = normalizeApiList(resHistorico.value);

        // Mapa de planos por item ID
        const planosMap = new Map();
        if (resPlanos.status === 'fulfilled') {
          const planos = normalizeListaPlanos(resPlanos.value);
          (planos || []).forEach((plano) => {
            const st = String(plano.statusCodigo || '').toLowerCase();
            if (st === 'cancelado') return;
            const planoTitulo = plano.titulo || plano.nome || 'Plano de Tratamento';
            const itens = Array.isArray(plano.itens) ? plano.itens : [];
            itens.forEach((it) => {
              const itemId = String(it.id || it.planejamentoItemId || '').trim();
              if (itemId) {
                planosMap.set(itemId, {
                  planoId: String(plano.id),
                  planoTitulo,
                  planoStatus: st,
                });
              }
            });
          });
        }

        // Todos os atendimentos do paciente para mapear contagem de retornos
        const allProcs =
          resProcs.status === 'fulfilled'
            ? Array.isArray(resProcs.value)
              ? resProcs.value
              : resProcs.value?.content ?? []
            : [];

        const listPlano = [];
        const listHistorico = [];

        raizesRaw.forEach((r) => {
          const rId = String(r.id);
          const retornosCount = allProcs.filter(
            (p) => String(p.procedimentoFeitoOrigemId || '') === rId
          ).length;

          const planItemId = r.planejamentoItemId ? String(r.planejamentoItemId).trim() : null;
          const planInfo = planItemId ? planosMap.get(planItemId) : null;

          const baseItem = {
            id: rId,
            procedimentoFeitoOrigemId: rId,
            nome: nomeProcedimentoRaiz(r),
            catalogoNome: r.catalogoProcedimentoNome || r.nomeCatalogo || r.nome,
            data: r.data,
            planejamentoItemId: planItemId,
            jaRealizado: true,
            retornosCount,
          };

          if (planInfo) {
            listPlano.push({
              ...baseItem,
              tipoOrigem: 'plano',
              planoId: planInfo.planoId,
              planoTitulo: planInfo.planoTitulo,
              planoStatus: planInfo.planoStatus,
            });
          } else {
            listHistorico.push({
              ...baseItem,
              tipoOrigem: 'historico',
            });
          }
        });

        setOptionsPlano(listPlano);
        setOptionsHistorico(listHistorico);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Erro ao carregar procedimentos.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, pacienteId]);

  if (!open) return null;

  const handleConfirm = () => {
    const id = String(selectedId || '').trim();
    if (!id) {
      setFieldError('Selecione o procedimento de origem do retorno.');
      return;
    }
    onConfirm?.(id);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consulta-retorno-origem-title"
    >
      <div className="w-full max-w-md sm:max-w-xl md:max-w-2xl animate-in fade-in zoom-in-95 duration-150 rounded-2xl border border-app-border bg-white p-5 sm:p-7 shadow-2xl transition-all">
        <div className="mb-5 flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3
              id="consulta-retorno-origem-title"
              className="text-[17px] sm:text-[19px] font-extrabold text-[#0f172a] tracking-tight"
            >
              Iniciar retorno
            </h3>
            <p className="mt-1 text-[13px] sm:text-[14px] text-[#64748b] leading-relaxed">
              Escolha o procedimento anterior que será avaliado neste retorno.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[#64748b] hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <RetornoOrigemSelect
          value={selectedId}
          onChange={(val) => {
            setSelectedId(val);
            setFieldError('');
          }}
          optionsPlano={optionsPlano}
          optionsHistorico={optionsHistorico}
          planoSectionTitle="📌 Procedimentos do Plano de Tratamento"
          planoSectionBadge="Concluídos no plano"
          historicoSectionTitle="✅ Procedimentos Avulsos (Histórico)"
          historicoSectionBadge="Atendimentos concluídos"
          loading={loading}
          error={error}
          fieldError={fieldError}
        />

        <div className="mt-6 flex flex-wrap justify-end gap-2.5 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-app-border px-5 py-2.5 text-[13px] sm:text-[14px] font-semibold text-[#64748b] hover:bg-app-nav-hover transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !selectedId}
            className="rounded-xl bg-[#00a88e] px-6 py-2.5 text-[13px] sm:text-[14px] font-semibold text-white shadow-sm hover:bg-[#00967f] disabled:opacity-50 transition-all"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
