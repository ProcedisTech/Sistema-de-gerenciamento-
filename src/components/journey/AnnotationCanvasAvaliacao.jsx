import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  X,
  Loader2,
  Sparkles,
  Layers,
  Calendar,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { useToast } from '../../contexts/useToast.js';
import { FotoVistaCanvasCore } from './mapeamento/FotoVistaCanvas.jsx';
import { MapeamentoFullscreenToolbar } from './mapeamento/MapeamentoFullscreenToolbar.jsx';
import { AssistiveTouchToolbar } from './mapeamento/AssistiveTouchToolbar.jsx';
import { PontoMarcadorPopover } from './mapeamento/PontoMarcadorPopover.jsx';
import { useMapeamentoFullscreenKeyboardShortcuts } from './mapeamento/useMapeamentoFullscreenKeyboardShortcuts.js';
import { marcacoesApiToOverlayPontos } from './mapeamento/mapaMarcacoesOverlayUtils.js';
import { resolveAnguloCanonico } from './mapeamento/MapeamentoFullscreenOverlay.jsx';
import {
  corParaProcedimento,
  getCorLivreParaProcedimento,
} from '../../constants/mapeamentoPaletaCores.js';
import { mapasApi, planejamentosApi, catalogosApi, pacientesGaleriaApi } from '../../services/api.js';
import { isRealUuid } from '../../utils/planejamentoDraftUtils.js';
import { garantirProcedimentosNoPlano } from '../../utils/sincronizarProcedimentosPlanoAgenda.js';
import { ehRotuloDeTela } from '../consulta/consultaServidor.js';

const COR_PADRAO_AVALIACAO = '#0ea5e9';

let localIdSeq = 0;
function nextLocalId() {
  localIdSeq += 1;
  return `pt_aval_${Date.now()}_${localIdSeq}`;
}

/**
 * AnnotationCanvasAvaliacao: Editor unificado de avaliação facial.
 * Conectado diretamente ao ecossistema consolidado de Procedimento e Retorno:
 * - FotoVistaCanvasCore com zoom/pan suave (react-zoom-pan-pinch)
 * - MapeamentoFullscreenToolbar e AssistiveTouchToolbar ergonômica
 * - Borracha cirúrgica idêntica ao Procedimento (apaga o marcador selecionado/clicado)
 * - Autosave debounced de 700ms (in-place update no backend tb_mapa)
 * - Pop-up Inteligente de Destino Clínico (Plano vs Avulso)
 */
export function AnnotationCanvasAvaliacao({
  photos = [],
  editingIndex = 0,
  setEditingIndex,
  onSelectCapturedPhoto,
  imageSrc,
  onAnnotatedCaptureSaved,
  persistAnnotatedPhotoToGallery,
  aguardarFotosPendentes,
  obterFotoId,
  onClose,
  onCancel,
  onSave,
  pacienteId,
  roleUserId = null,
  procedimentosIniciais = [],
  planoContexto = null,
}) {
  const toast = useToast();
  const fechar = onClose || onCancel;
  const onSalvarCallback = onAnnotatedCaptureSaved || onSave;

  const [localIndex, setLocalIndex] = useState(editingIndex || 0);
  const activeIndex = typeof editingIndex === 'number' ? editingIndex : localIndex;
  const activePhoto = (photos || [])[activeIndex] || {};

  // URL e Blob da foto
  const displayUrl = activePhoto?.cleanUrl || activePhoto?.url || imageSrc || null;
  const [resolvedDisplayUrl, setResolvedDisplayUrl] = useState(displayUrl);

  // Ferramentas: 'traco' | 'ponto' | 'borracha'
  const [modo, setModo] = useState('ponto');
  const [tamanhoMarcador, setTamanhoMarcador] = useState(1.0);
  const [mostrarDoses, setMostrarDoses] = useState(true);

  // Popovers e controles
  const [configPopoverOpen, setConfigPopoverOpen] = useState(false);
  const [pontoSelecionado, setPontoSelecionado] = useState(null);
  const [configMarcacao, setConfigMarcacao] = useState({
    dosePadrao: 1,
    profundidade: '',
    confirmarDose: false,
  });

  // Múltiplos procedimentos selecionados para este mapa
  const [procedimentos, setProcedimentos] = useState(() => {
    if (Array.isArray(procedimentosIniciais) && procedimentosIniciais.length > 0) {
      const validos = procedimentosIniciais.filter((proc) => {
        if (proc?.nomeSoDeTela === true) return false;
        const cid = proc?.catalogoProcedimentoSaudeId || proc?.id;
        const nome = String(proc?.catalogoNome || proc?.nome || '').trim();
        if (!cid && ehRotuloDeTela(nome)) return false;
        return nome && nome.toLowerCase() !== 'procedimento';
      });

      if (validos.length > 0) {
        const coresOcupadas = new Set();
        validos.forEach((p) => {
          const cor = p?.corHex || p?.cor;
          if (cor && typeof cor === 'string' && cor.startsWith('#')) {
            coresOcupadas.add(cor.toLowerCase());
          }
        });

        return validos.map((proc, idx) => {
          const catId = proc.catalogoProcedimentoSaudeId || proc.id;
          let cor = proc.corHex || proc.cor;
          if (!cor || typeof cor !== 'string' || !cor.startsWith('#')) {
            cor = getCorLivreParaProcedimento(catId, coresOcupadas);
          }
          coresOcupadas.add(cor.toLowerCase());
          return {
            id: proc.id || proc.catalogoProcedimentoSaudeId || `proc_${idx}`,
            catalogoProcedimentoSaudeId: catId,
            nome: proc.catalogoNome || proc.nome,
            unidadeMedida: proc.unidadeMedida || proc.unidade || 'un',
            corHex: cor,
            planejamentoItemId: proc.planejamentoItemId || null,
          };
        });
      }
    }
    return [];
  });

  const [activeProcedimentoId, setActiveProcedimentoId] = useState(() => {
    if (Array.isArray(procedimentosIniciais) && procedimentosIniciais.length > 0) {
      const primeiro = procedimentosIniciais.find((p) => p && !p.nomeSoDeTela);
      return primeiro?.id || primeiro?.catalogoProcedimentoSaudeId || null;
    }
    return null;
  });

  const [corLivre, setCorLivre] = useState(COR_PADRAO_AVALIACAO);
  const [procedimentosDoPlano, setProcedimentosDoPlano] = useState([]);
  const [carregandoPlano, setCarregandoPlano] = useState(false);

  // Marcações / Pontos
  const [pontos, setPontos] = useState([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Modal Inteligente de Destino Clínico
  const [modalDestinoOpen, setModalDestinoOpen] = useState(false);
  const [modalDestinoModo, setModalDestinoModo] = useState('novo_plano'); // 'novo_plano' | 'novo_procedimento'

  const containerRef = useRef(null);
  const transformWrapperRef = useRef(null);

  // Procedimento ativo
  const activeProc = useMemo(() => {
    return procedimentos.find((p) => p.id === activeProcedimentoId) || procedimentos[0] || null;
  }, [procedimentos, activeProcedimentoId]);

  const activeCor = activeProc?.corHex || corLivre || COR_PADRAO_AVALIACAO;
  const activeUnidade = activeProc?.unidadeMedida || 'un';

  // Carrega foto remota autenticada se displayUrl for endpoint de API
  useEffect(() => {
    if (!displayUrl) {
      setResolvedDisplayUrl(null);
      return;
    }
    let cancelled = false;
    let localBlobUrl = null;

    async function prepararImagem() {
      let finalSrc = displayUrl;
      if (typeof displayUrl === 'string' && (displayUrl.startsWith('/api/') || displayUrl.includes('/pacientes/'))) {
        try {
          const blob = await pacientesGaleriaApi.fetchArquivoBlob(displayUrl);
          if (cancelled) return;
          localBlobUrl = URL.createObjectURL(blob);
          finalSrc = localBlobUrl;
        } catch (err) {
          console.warn('[AnnotationCanvasAvaliacao] Falha ao baixar blob autenticado:', err);
        }
      }
      if (!cancelled) {
        setResolvedDisplayUrl(finalSrc);
      }
    }

    prepararImagem();

    return () => {
      cancelled = true;
      if (localBlobUrl) URL.revokeObjectURL(localBlobUrl);
    };
  }, [displayUrl]);

  // Restaura marcações existentes da foto ativa
  useEffect(() => {
    let existingPontos = Array.isArray(activePhoto?.pontos) ? activePhoto.pontos : [];
    const procs =
      activePhoto?.procedimentosMapeados ||
      activePhoto?.mapaOverlay?.procedimentos ||
      activePhoto?.mapaOverlay?.procedimentosMapeados ||
      [];
    if (existingPontos.length === 0 && activePhoto?.mapaOverlay) {
      const rawMarcacoes = activePhoto.mapaOverlay.marcacoes || activePhoto.mapaOverlay.pontos || [];
      existingPontos = marcacoesApiToOverlayPontos(rawMarcacoes, procs);
    }
    setPontos(existingPontos);

    if (Array.isArray(procs) && procs.length > 0) {
      setProcedimentos((prev) => {
        // Preserva cores já existentes sem sobrescrever
        const jaExistem = new Map(prev.map((p) => [String(p.id || p.catalogoProcedimentoSaudeId), p]));
        return procs.map((p) => {
          const key = String(p.id || p.catalogoProcedimentoSaudeId);
          const anterior = jaExistem.get(key);
          return {
            id: p.catalogoProcedimentoSaudeId || p.id,
            catalogoProcedimentoSaudeId: p.catalogoProcedimentoSaudeId || p.id,
            nome: p.nomeProcedimento || p.catalogoNome || p.nome || 'Procedimento',
            corHex: anterior?.corHex || p.corHex || p.cor || null,
            unidadeMedida: p.unidadeMedida || 'un',
            planejamentoItemId: p.planejamentoItemId || null,
          };
        });
      });
    }

    setIsDirty(false);
  }, [activeIndex, activePhoto]);

  // Carrega procedimentos do Plano de Tratamento Ativo do paciente
  useEffect(() => {
    if (!pacienteId) {
      setProcedimentosDoPlano([]);
      return;
    }
    let isMounted = true;
    setCarregandoPlano(true);

    Promise.all([
      planejamentosApi.listarPorPaciente(pacienteId).catch(() => []),
      catalogosApi.list(false).catch(() => []),
    ])
      .then(([planosRes, catRes]) => {
        if (!isMounted) return;
        const planos = Array.isArray(planosRes) ? planosRes : planosRes?.content || [];
        const planoAtivo =
          planoContexto ||
          planos.find(
            (p) =>
              p.statusCodigo === 'ativo' ||
              p.status === 'ativo' ||
              p.status === 'em_andamento'
          );

        if (!planoAtivo || !Array.isArray(planoAtivo.itens) || planoAtivo.itens.length === 0) {
          setProcedimentosDoPlano([]);
          return;
        }

        const rawCat = Array.isArray(catRes) ? catRes : catRes?.content || [];
        const catMap = new Map();
        rawCat.forEach((c) => {
          const cid = String(c.id || '').trim();
          if (cid) {
            catMap.set(cid, {
              nome: c.nome || c.catalogoNome,
              unidadeMedida: c.unidadeMedida || 'un',
            });
          }
        });

        const itensDoPlano = planoAtivo.itens
          .map((item, idx) => {
            const catId = item.catalogoProcedimentoSaudeId || item.catalogoId;
            const catInfo = catMap.get(String(catId || '')) || {};
            const nome = item.nome || item.catalogoNome || catInfo.nome || 'Procedimento';
            return {
              id: catId || item.id || `plano_proc_${idx}`,
              catalogoProcedimentoSaudeId: catId,
              planejamentoItemId: item.id || null,
              nome,
              unidadeMedida: item.unidadeMedida || catInfo.unidadeMedida || 'un',
              corHex: item.corHex || null,
            };
          })
          .filter((it) => Boolean(it.catalogoProcedimentoSaudeId));

        setProcedimentosDoPlano(itensDoPlano);
      })
      .finally(() => {
        if (isMounted) setCarregandoPlano(false);
      });

    return () => {
      isMounted = false;
    };
  }, [pacienteId, planoContexto]);

  // Agrupa marcações no formato consumido por FotoVistaCanvasCore
  const gruposPontos = useMemo(() => {
    const map = new Map();
    // Garante que cada procedimento armado/usado tenha seu grupo
    (procedimentos || []).forEach((proc) => {
      const pid = String(proc.id || proc.catalogoProcedimentoSaudeId);
      map.set(pid, {
        catalogoProcedimentoSaudeId: proc.catalogoProcedimentoSaudeId || proc.id,
        catalogoId: proc.catalogoProcedimentoSaudeId || proc.id,
        nomeProcedimento: proc.nome,
        corHex: proc.corHex || corParaProcedimento(proc.id),
        pontos: [],
      });
    });

    (pontos || []).forEach((pt) => {
      const pCatId = String(pt.catalogoProcedimentoSaudeId || pt.catalogoId || activeProc?.id || 'avaliacao');
      if (!map.has(pCatId)) {
        map.set(pCatId, {
          catalogoProcedimentoSaudeId: pCatId,
          catalogoId: pCatId,
          nomeProcedimento: pt.nomeProcedimento || 'Procedimento',
          corHex: pt.cor || corParaProcedimento(pCatId),
          pontos: [],
        });
      }
      map.get(pCatId).pontos.push({
        ...pt,
        catalogoId: pCatId,
        catalogoProcedimentoSaudeId: pCatId,
        nomeProcedimento: pt.nomeProcedimento || map.get(pCatId).nomeProcedimento,
        cor: pt.cor || map.get(pCatId).corHex,
      });
    });

    return Array.from(map.values());
  }, [procedimentos, pontos, activeProc]);

  // Ações de manipulação de pontos
  const handleAddPonto = useCallback(
    (_vista, pontoData) => {
      const catId = activeProc?.id || pontoData.catalogoProcedimentoSaudeId || pontoData.catalogoId;
      const novoPonto = {
        ...pontoData,
        localId: nextLocalId(),
        id: pontoData.id || nextLocalId(),
        catalogoProcedimentoSaudeId: catId,
        catalogoId: catId,
        nomeProcedimento: activeProc?.nome || pontoData.nomeProcedimento || 'Avaliação',
        cor: pontoData?.cor || activeCor || (catId ? corParaProcedimento(catId) : COR_PADRAO_AVALIACAO),
        tamanho: pontoData.tamanho || tamanhoMarcador,
      };
      setPontos((prev) => [...prev, novoPonto]);
      setIsDirty(true);
    },
    [activeProc, activeCor, tamanhoMarcador]
  );

  const handleRemovePonto = useCallback((_catId, _vista, localId) => {
    setPontos((prev) => prev.filter((p) => p.localId !== localId && p.id !== localId));
    setIsDirty(true);
  }, []);

  const handleEditarPonto = useCallback((_catId, _vista, localId, patch) => {
    setPontos((prev) =>
      prev.map((p) => (p.localId === localId || p.id === localId ? { ...p, ...patch } : p))
    );
    setIsDirty(true);
  }, []);

  const handleUndo = useCallback(() => {
    setPontos((prev) => prev.slice(0, -1));
    setIsDirty(true);
  }, []);

  const handleClearAll = useCallback(() => {
    setPontos([]);
    setIsDirty(true);
  }, []);

  // Adição e troca de procedimentos
  const handleAdicionarProcedimento = (proc) => {
    const catId = proc.catalogoProcedimentoSaudeId || proc.id;
    setProcedimentos((prev) => {
      if (prev.some((p) => String(p.id) === String(proc.id) || String(p.catalogoProcedimentoSaudeId) === String(catId))) {
        return prev;
      }
      const coresOcupadas = new Set(prev.map((p) => (p.corHex || '').toLowerCase()));
      const cor = proc.corHex || getCorLivreParaProcedimento(catId, coresOcupadas);
      return [
        ...prev,
        {
          id: proc.id || catId,
          catalogoProcedimentoSaudeId: catId,
          nome: proc.nome || proc.catalogoNome,
          unidadeMedida: proc.unidadeMedida || 'un',
          corHex: cor,
          planejamentoItemId: proc.planejamentoItemId || null,
        },
      ];
    });
    setActiveProcedimentoId(proc.id || catId);
  };

  const handleRemoverProcedimento = (procId) => {
    setProcedimentos((prev) => prev.filter((p) => String(p.id) !== String(procId)));
    setPontos((prev) =>
      prev.filter((p) => String(p.catalogoProcedimentoSaudeId || p.catalogoId) !== String(procId))
    );
    if (String(activeProcedimentoId) === String(procId)) {
      setActiveProcedimentoId(null);
    }
    setIsDirty(true);
  };

  const matchProcId = (p, targetId) => {
    if (!targetId || !p) return false;
    const t = String(targetId).trim();
    return [p.id, p.catalogoProcedimentoSaudeId, p.catalogoId, p.nomeProcedimentoCatalogoId, p._uid]
      .filter(Boolean)
      .some((id) => String(id).trim() === t);
  };

  const handleMudarCorProcedimento = (procId, novaCor) => {
    const alvo = procedimentos.find((p) => matchProcId(p, procId));
    const corAntigaAlvo = alvo?.corHex;
    const outroAfetado = procedimentos.find(
      (p) => !matchProcId(p, procId) && (p.corHex || corParaProcedimento(p.id)).toLowerCase() === novaCor?.toLowerCase()
    );

    setProcedimentos((prev) =>
      prev.map((p) => {
        if (matchProcId(p, procId)) return { ...p, corHex: novaCor };
        if (outroAfetado && matchProcId(p, outroAfetado.id)) return { ...p, corHex: corAntigaAlvo };
        return p;
      })
    );

    setPontos((prev) =>
      prev.map((p) => {
        if (matchProcId(p, procId)) return { ...p, cor: novaCor };
        if (outroAfetado && matchProcId(p, outroAfetado.id)) return { ...p, cor: corAntigaAlvo };
        return p;
      })
    );

    setIsDirty(true);
  };

  const getProcedimentoStats = useCallback(
    (procId) => {
      let count = 0;
      let doseTotal = 0;
      const targetId = String(procId || '');
      (pontos || []).forEach((pt) => {
        const ptId = String(pt.catalogoProcedimentoSaudeId || pt.catalogoId || '');
        if (ptId === targetId) {
          count++;
          doseTotal += Number(pt.quantidade || pt.dose || 1);
        }
      });
      return { pontosCount: count, doseTotal: Number(doseTotal.toFixed(2)) };
    },
    [pontos]
  );

  // Execução de persistência no servidor (Autosave e Manual)
  const executarSalvar = useCallback(
    async (destino = 'plano', { fecharApos = true } = {}) => {
      setIsSaving(true);
      try {
        if (typeof aguardarFotosPendentes === 'function') {
          try {
            await aguardarFotosPendentes();
          } catch (errWait) {
            console.warn('[AnnotationCanvasAvaliacao] Falha ao aguardar fotos pendentes:', errWait);
          }
        }

        let resolvedFotoId =
          (typeof obterFotoId === 'function' ? (obterFotoId(activePhoto) || obterFotoId(activeIndex)) : null) ||
          activePhoto?.fotoId ||
          activePhoto?.id ||
          activePhoto?.meta?.fotoId ||
          null;

        const procedimentosUsados = new Set(
          pontos.map((p) => String(p.catalogoProcedimentoSaudeId || p.catalogoId)).filter(Boolean)
        );

        if (destino === 'plano' && pacienteId && planoContexto?.id) {
          try {
            await garantirProcedimentosNoPlano({
              pacienteId,
              planejamentoId: planoContexto.id,
              procedimentos: procedimentos.filter((p) => procedimentosUsados.has(String(p.id))),
              roleUserId,
            });
          } catch (errGarantir) {
            console.warn('[AnnotationCanvasAvaliacao] Falha ao garantir procedimentos no plano:', errGarantir);
          }
        }

        const pontosEnriquecidos = pontos.map((p) => {
          const proc = procedimentos.find(
            (pr) => String(pr.id) === String(p.catalogoProcedimentoSaudeId || p.catalogoId || p.procedimentoId)
          );
          const cor = proc?.corHex || p.corHex || p.cor || activeCor || '#3b82f6';
          return {
            ...p,
            cor,
            corHex: cor,
            nomeProcedimento: p.nomeProcedimento || proc?.nome || (procedimentos.length === 0 ? 'Avaliação' : 'Procedimento'),
          };
        });

        const procedimentosPayload = procedimentos.map((proc, idx) => ({
          catalogoProcedimentoSaudeId: isRealUuid(proc.catalogoProcedimentoSaudeId || proc.id)
            ? proc.catalogoProcedimentoSaudeId || proc.id
            : null,
          catalogoNome: proc.nome,
          ordem: (idx + 1),
          corHex: proc.corHex || corParaProcedimento(proc.id),
          planejamentoItemId: proc.planejamentoItemId || null,
        }));

        const anguloCanonico = resolveAnguloCanonico(activePhoto, null);

        const marcacoesPayload = pontosEnriquecidos.map((pt) => ({
          anguloFotoCodigo: anguloCanonico,
          tipoGeometria: pt.tipoGeometria || (pt.vertices?.length > 1 ? 'traco' : 'ponto'),
          quantidade: pt.quantidade != null ? Number(pt.quantidade) : 1,
          tamanho: pt.tamanho != null ? Number(pt.tamanho) : 1,
          catalogoProcedimentoSaudeId: pt.catalogoProcedimentoSaudeId || pt.catalogoId || null,
          corHex: pt.corHex || pt.cor || (pt.catalogoId ? corParaProcedimento(pt.catalogoId) : COR_PADRAO_AVALIACAO),
          vertices: pt.vertices?.length
            ? pt.vertices.map((v, i) => ({ ordem: i + 1, posX: v.posX ?? v.x, posY: v.posY ?? v.y }))
            : [{ ordem: 1, posX: pt.posX, posY: pt.posY }],
        }));

        const effectivePlanItemId =
          procedimentosPayload.find((p) => isRealUuid(p.planejamentoItemId))?.planejamentoItemId ||
          procedimentos.find((p) => isRealUuid(p.planejamentoItemId))?.planejamentoItemId ||
          null;

        const effectivePlanId = planoContexto?.id || null;

        const mapaPayload = {
          pacienteId: pacienteId || null,
          tipoMapaCodigo: 'avaliacao',
          planejamentoId: effectivePlanId,
          planejamentoItemId: effectivePlanItemId,
          ...(effectivePlanItemId ? { origemTipo: 'planejamento', origemId: effectivePlanItemId } : {}),
          fotoGaleriaIdPorVista: resolvedFotoId ? { [anguloCanonico]: resolvedFotoId } : {},
          procedimentos: procedimentosPayload,
          marcacoes: marcacoesPayload,
        };

        const savedMapa = await mapasApi.salvar(mapaPayload);

        const cleanBlob = activePhoto?.cleanBlob || activePhoto?.blob || null;
        const cleanUrl = activePhoto?.cleanUrl || activePhoto?.url || resolvedDisplayUrl;

        if (typeof onSalvarCallback === 'function') {
          onSalvarCallback({
            index: activeIndex,
            newUrl: cleanUrl,
            blob: cleanBlob,
            cleanBlob,
            cleanUrl,
            procedimentosMapeados: procedimentos,
            pontos: pontosEnriquecidos,
            isAnnotated: true,
            destinoAvaliacao: destino,
            isAvulso: destino === 'avulso',
            mapaId: savedMapa?.id || null,
            planejamentoId: effectivePlanId,
            planejamentoItemId: effectivePlanItemId,
            mapaOverlay: {
              mapaId: savedMapa?.id || null,
              tipoMapaCodigo: 'avaliacao',
              tipoMapaNome: 'Avaliação',
              pontos: pontosEnriquecidos,
              marcacoes: pontosEnriquecidos,
              procedimentos,
              planejamentoId: effectivePlanId,
              planejamentoItemId: effectivePlanItemId,
            },
          });
        }

        if (!resolvedFotoId && typeof persistAnnotatedPhotoToGallery === 'function') {
          try {
            let blobParaUpload = cleanBlob;
            if (!blobParaUpload && cleanUrl) {
              try {
                const resp = await fetch(cleanUrl);
                blobParaUpload = await resp.blob();
              } catch (errBlob) {
                console.warn('[AnnotationCanvasAvaliacao] Falha ao converter cleanUrl para blob:', errBlob);
              }
            }
            if (blobParaUpload) {
              await persistAnnotatedPhotoToGallery(blobParaUpload, {
                index: activeIndex,
                mapaId: savedMapa?.id || null,
                isAvulso: destino === 'avulso',
                destinoAvaliacao: destino,
              });
            }
          } catch (errPersist) {
            console.warn('[AnnotationCanvasAvaliacao] Falha ao persistir foto anotada na galeria:', errPersist);
          }
        }

        setIsDirty(false);
        if (fecharApos) {
          fechar?.();
        }
      } catch (err) {
        console.error('[AnnotationCanvasAvaliacao] Erro ao salvar:', err);
        toast?.error?.('Falha ao salvar anotações da avaliação');
      } finally {
        setIsSaving(false);
      }
    },
    [
      aguardarFotosPendentes,
      obterFotoId,
      activeIndex,
      activePhoto,
      pontos,
      pacienteId,
      planoContexto,
      procedimentos,
      roleUserId,
      resolvedDisplayUrl,
      onSalvarCallback,
      fechar,
      toast,
    ]
  );

  // Autosave 700ms debounced
  useEffect(() => {
    if (!isDirty) return undefined;
    const timer = setTimeout(() => {
      executarSalvar(planoContexto?.id ? 'plano' : 'avulso', { fecharApos: false });
    }, 700);
    return () => clearTimeout(timer);
  }, [isDirty, planoContexto?.id, executarSalvar]);

  // Gatilho de conclusão / fechamento com Pop-up Inteligente de Destino
  const handleIniciarSalvar = () => {
    // Se não há procedimentos ou pontos desenhados, salva direto como avulso
    if (procedimentos.length === 0 || pontos.length === 0) {
      executarSalvar('avulso', { fecharApos: true });
      return;
    }

    if (planoContexto?.id) {
      const itensPlanoIds = new Set(
        (planoContexto.itens || [])
          .map((it) => it.catalogoProcedimentoSaudeId || it.catalogoId || it.id)
          .filter(Boolean)
          .map(String)
      );
      const procedimentosUsados = new Set(
        pontos.map((p) => p.catalogoProcedimentoSaudeId || p.catalogoId).filter(Boolean).map(String)
      );
      const temProcedimentoInedito = Array.from(procedimentosUsados).some((id) => !itensPlanoIds.has(id));

      if (temProcedimentoInedito) {
        setModalDestinoModo('novo_procedimento');
        setModalDestinoOpen(true);
        return;
      }
      executarSalvar('plano', { fecharApos: true });
      return;
    }

    setModalDestinoModo('novo_plano');
    setModalDestinoOpen(true);
  };

  // Atalhos de teclado ergonômicos
  useMapeamentoFullscreenKeyboardShortcuts({
    enabled: true,
    blocked: Boolean(modalDestinoOpen),
    onSetModo: setModo,
    onDesfazer: handleUndo,
    onResetZoom: () => transformWrapperRef.current?.resetTransform?.(),
    onToggleDoses: () => setMostrarDoses((v) => !v),
    onEscape: fechar,
  });

  return createPortal(
    <div className="fixed inset-0 z-[140] flex min-w-0 flex-row overflow-hidden bg-slate-300 text-slate-800 select-none">
      {/* ── BARRA LATERAL UNIFICADA (Idêntica ao Procedimento) ── */}
      <MapeamentoFullscreenToolbar
        vistaAtual="avaliacao"
        toolbarWidthPx={240}
        procedimentoArmado={activeProc}
        procedimentos={procedimentos}
        procedimentosDoPlano={procedimentosDoPlano}
        carregandoPlano={carregandoPlano}
        activeProcedimentoId={activeProcedimentoId}
        onSelectProcedimento={(proc) => {
          setActiveProcedimentoId(proc.id);
        }}
        onAdicionarProcedimento={handleAdicionarProcedimento}
        onRemoverProcedimento={handleRemoverProcedimento}
        onMudarCorProcedimento={handleMudarCorProcedimento}
        corLivre={corLivre}
        onMudarCorLivre={setCorLivre}
        getProcedimentoStats={getProcedimentoStats}
        countPontosVista={pontos.length}
        onClose={fechar}
        configMarcacao={configMarcacao}
        setConfigMarcacao={setConfigMarcacao}
        unidadeMedida={activeUnidade}
        onClearVista={handleClearAll}
        modo={modo}
        setModo={setModo}
        tamanho={tamanhoMarcador}
        setTamanho={setTamanhoMarcador}
        mostrarValores={mostrarDoses}
        onToggleMostrarValores={() => setMostrarDoses((prev) => !prev)}
        onDesfazerUltimo={handleUndo}
        configPopoverOpen={configPopoverOpen}
        onConfigPopoverOpenChange={setConfigPopoverOpen}
        onSaveAction={handleIniciarSalvar}
        tituloAcaoPrimaria="Salvar Avaliação"
        isSaving={isSaving}
      />

      {/* ── PAINEL PRINCIPAL COM FOTOVISTACANVAS E ASSISTIVETOUCH (Mesa de Luz bg-slate-300) ── */}
      <main ref={containerRef} className="relative flex min-h-0 min-w-0 flex-1 flex-col p-0 overflow-hidden bg-slate-300">
        {/* Barra Superior Discreta Flutuante */}
        <div className="absolute top-3.5 left-4 right-4 z-40 pointer-events-none flex items-center justify-between">
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-white/95 px-3 py-1.5 backdrop-blur-xl border border-slate-200/90 shadow-md text-slate-800">
            <span className="text-xs font-bold text-slate-800">Avaliação Facial</span>
            {photos.length > 1 && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                Foto {activeIndex + 1} de {photos.length}
              </span>
            )}
            {activeProc?.nome && (
              <span
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold border shadow-2xs"
                style={{
                  backgroundColor: `${activeCor}15`,
                  borderColor: `${activeCor}40`,
                  color: activeCor,
                }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: activeCor }} />
                <span className="truncate max-w-[140px]">{activeProc.nome}</span>
              </span>
            )}
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handleIniciarSalvar}
              disabled={isSaving}
              aria-label="Salvar anotação"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold shadow-xl shadow-teal-500/25 disabled:opacity-60 transition-all scale-100 active:scale-95 cursor-pointer"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 stroke-[2.5]" />}
              <span>Salvar Foto</span>
            </button>

            <button
              type="button"
              onClick={fechar}
              title="Fechar tela cheia (Esc)"
              aria-label="Fechar editor"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/95 hover:bg-white text-slate-700 hover:text-slate-950 border border-slate-300 text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <X className="h-4 w-4 stroke-[2.5] text-slate-600" />
              <span className="hidden sm:inline">Fechar</span>
            </button>
          </div>
        </div>

        {/* BOLINHA FLUTUANTE ASSISTIVETOUCH (Idêntica ao Procedimento) */}
        <AssistiveTouchToolbar
          modo={modo}
          setModo={setModo}
          mostrarDoses={mostrarDoses}
          setMostrarDoses={setMostrarDoses}
          onUndo={handleUndo}
          canUndo={pontos.length > 0}
          activeCor={activeCor}
          activeProc={activeProc}
          procedimentos={procedimentos}
          onArmar={(proc) => setActiveProcedimentoId(proc.id)}
          onMudarCor={(novaCor) => {
            if (activeProc) {
              handleMudarCorProcedimento(activeProc.id, novaCor);
            } else {
              setCorLivre(novaCor);
            }
          }}
          containerRef={containerRef}
        />

        {/* CANVÁS NATIVO CONSOLIDADO (FotoVistaCanvasCore — DOM + react-zoom-pan-pinch) */}
        <FotoVistaCanvasCore
          transformWrapperRef={transformWrapperRef}
          vistaAtual="avaliacao"
          foto={{
            displayUrl: resolvedDisplayUrl,
            url: resolvedDisplayUrl,
            fotoGaleriaId: activePhoto?.fotoId || activePhoto?.id || null,
          }}
          procedimentoArmado={activeProc}
          pontosVista={gruposPontos}
          onAddPonto={handleAddPonto}
          onEditarPonto={handleEditarPonto}
          onRemovePonto={handleRemovePonto}
          tamanhoGlobalPonto={tamanhoMarcador}
          modo={modo}
          setModo={setModo}
          showToolbar={false}
          fillViewport
          className="h-full min-h-0 w-full flex-1"
          unidadeMedida={activeUnidade}
          onUnidadeMedidaChange={(u) => {
            if (activeProc) {
              setProcedimentos((prev) =>
                prev.map((p) => (p.id === activeProc.id ? { ...p, unidadeMedida: u } : p))
              );
            }
          }}
          externalModo={modo}
          onModoChange={setModo}
          configMarcacao={configMarcacao}
          mostrarValores={mostrarDoses}
        />

        {/* Popover de Resumo e Edição do Ponto / Traço */}
        {pontoSelecionado ? (
          <PontoMarcadorPopover
            open={Boolean(pontoSelecionado)}
            ponto={pontoSelecionado?.ponto}
            nomeProcedimento={pontoSelecionado?.nomeProcedimento}
            catalogoId={pontoSelecionado?.catalogoId}
            cor={pontoSelecionado?.cor}
            onSave={(patch) => {
              handleEditarPonto(null, null, pontoSelecionado.localId, patch);
              setPontoSelecionado(null);
            }}
            onRemove={() => {
              handleRemovePonto(null, null, pontoSelecionado.localId);
              setPontoSelecionado(null);
            }}
            onCancel={() => setPontoSelecionado(null)}
            unidadeMedida={activeUnidade}
          />
        ) : null}

        {/* Carrossel de Fotos da Avaliação (se houver múltiplas fotos capturadas) */}
        {photos.length > 1 && (
          <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2 p-1.5 rounded-2xl bg-white/95 backdrop-blur-md shadow-lg border border-slate-200">
            {photos.map((ph, idx) => (
              <button
                key={ph.id || idx}
                type="button"
                onClick={() => {
                  if (typeof onSelectCapturedPhoto === 'function') onSelectCapturedPhoto(idx);
                  if (typeof setEditingIndex === 'function') setEditingIndex(idx);
                  setLocalIndex(idx);
                }}
                className={`relative h-12 w-12 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                  idx === activeIndex
                    ? 'border-teal-500 scale-105 shadow-md'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
                title={`Foto ${idx + 1}`}
              >
                <img
                  src={ph.cleanUrl || ph.url}
                  alt={`Foto ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </main>

      {/* ── MODAL CLÍNICO INTELIGENTE DE DESTINO (Plano vs Avulso) ── */}
      {modalDestinoOpen && (
        <div
          className="fixed inset-0 z-[170] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-[#00a88e] mb-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 border border-teal-100">
                <Sparkles className="h-5 w-5 text-[#00a88e]" />
              </div>
              <div>
                <h4 className="text-[16px] font-bold text-slate-900 leading-tight">
                  {modalDestinoModo === 'novo_procedimento'
                    ? 'Novo Procedimento na Avaliação'
                    : 'Destino da Avaliação Clínica'}
                </h4>
                <p className="text-[12px] text-slate-500">
                  {modalDestinoModo === 'novo_procedimento'
                    ? 'Foram identificados procedimentos que ainda não constam no Plano'
                    : 'Defina como estes procedimentos devem ser organizados'}
                </p>
              </div>
            </div>

            <p className="text-[13px] text-slate-600 leading-relaxed mb-4">
              {modalDestinoModo === 'novo_procedimento' ? (
                <>
                  Você mapeou{' '}
                  <strong className="text-slate-900 font-semibold">
                    procedimentos novos
                  </strong>{' '}
                  durante esta avaliação clínica. Deseja incluí-los no Plano de Tratamento do paciente?
                </>
              ) : (
                <>
                  Você mapeou{' '}
                  <strong className="text-slate-900 font-semibold">
                    {procedimentos.length} procedimento{procedimentos.length > 1 ? 's' : ''}
                  </strong>{' '}
                  nesta avaliação. Deseja transformar essas anotações em um planejamento do paciente?
                </>
              )}
            </p>

            <div className="space-y-2.5 mb-6">
              <button
                type="button"
                onClick={() => {
                  setModalDestinoOpen(false);
                  executarSalvar('plano', { fecharApos: true });
                }}
                className="w-full flex items-start gap-3 p-3.5 rounded-xl border-2 border-teal-200 bg-teal-50/50 hover:bg-teal-50 hover:border-[#00a88e] text-left transition-all cursor-pointer group"
              >
                <div className="p-2 rounded-lg bg-white border border-teal-200 text-[#00a88e] group-hover:scale-105 transition-transform">
                  <Layers className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-xs font-bold text-slate-900 group-hover:text-[#00a88e]">
                    {modalDestinoModo === 'novo_procedimento'
                      ? 'Sim, incluir no Plano de Tratamento'
                      : 'Sim, gerar Plano de Tratamento'}
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    {modalDestinoModo === 'novo_procedimento'
                      ? 'Adiciona os novos procedimentos ao protocolo e atualiza o mapa clínico.'
                      : 'Cria ou atualiza o protocolo de tratamento do paciente com os procedimentos e o mapa clínico vinculados.'}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModalDestinoOpen(false);
                  executarSalvar('avulso', { fecharApos: true });
                }}
                aria-label="Apenas Salvar Avulso"
                className="w-full flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-left transition-all cursor-pointer group"
              >
                <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 group-hover:scale-105 transition-transform">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-xs font-bold text-slate-800">
                    Apenas Salvar Avulso
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    Preserva as marcações e fotos no prontuário e histórico clínico da consulta, sem alterar o plano formal.
                  </span>
                </div>
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setModalDestinoOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
