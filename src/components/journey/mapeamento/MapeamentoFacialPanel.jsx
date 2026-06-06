import React, { useCallback, useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';

import { useToast } from '../../../contexts/useToast.js';

import { pacientesGaleriaApi } from '../../../services/api.js';

import { normalizePacienteGaleriaResponse } from '../../../utils/pacienteGaleria.js';

import { persistirPlanejamento } from '../../../utils/persistirPlanejamento.js';

import { useMapeamentoFacialState } from '../../hooks/useMapeamentoFacialState.js';

import { VistaChipsBar, VistaAtivaHeader } from './VistaChipsBar.jsx';

import { FotoVistaCanvas, GaleriaVistaPickerModal } from './FotoVistaCanvas.jsx';

import { MapeamentoProcedimentoPicker } from './MapeamentoProcedimentoPicker.jsx';

import { PontosResumoPanel } from './PontosResumoPanel.jsx';

import { EscolherGrupoFotoModal } from './EscolherGrupoFotoModal.jsx';

import { EscolherVistaModal } from './EscolherVistaModal.jsx';

import { MapeamentoFullscreenOverlay } from './MapeamentoFullscreenOverlay.jsx';



export function MapeamentoFacialPanel({

  pacienteId,

  roleUserId,

  observacao = '',

  onObservacaoChange,

  sidebarInsetPx = 0,

  onGerarPlanoSuccess,

  pendingCapture,

  onCaptureConsumed,

  onPrepareCapture,

}) {

  const toast = useToast();

  const state = useMapeamentoFacialState();

  const [galeriaOpen, setGaleriaOpen] = useState(false);

  const [galeriaItems, setGaleriaItems] = useState([]);

  const [galeriaLoading, setGaleriaLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [fullscreenOpen, setFullscreenOpen] = useState(false);



  /** @type {null | { source: 'capture'|'upload'|'galeria', grupo?: string, pendingFile?: File, pendingGaleriaItem?: object }} */

  const [photoFlow, setPhotoFlow] = useState(null);

  const [grupoModalOpen, setGrupoModalOpen] = useState(false);

  const [vistaModalOpen, setVistaModalOpen] = useState(false);



  const vistasPreenchidas = state.getVistasPreenchidas();

  useEffect(() => {
    if (!state.vistaAtual && vistasPreenchidas.length > 0) {
      state.setVistaAtual(vistasPreenchidas[0]);
    }
  }, [state.vistaAtual, vistasPreenchidas, state]);



  useEffect(() => {

    if (!pendingCapture?.blob || !pendingCapture?.vista) return;

    const url = URL.createObjectURL(pendingCapture.blob);

    state.setFotoVista(pendingCapture.vista, {

      displayUrl: url,

      blob: pendingCapture.blob,

      source: 'capture',

    });

    state.setVistaAtual(pendingCapture.vista);

    onCaptureConsumed?.();

  }, [pendingCapture, onCaptureConsumed, state]);



  const startPhotoFlow = useCallback((source, extra = {}) => {

    setPhotoFlow({ source, ...extra });

    setGrupoModalOpen(true);

    setVistaModalOpen(false);

  }, []);



  const cancelPhotoFlow = useCallback(() => {

    setPhotoFlow(null);

    setGrupoModalOpen(false);

    setVistaModalOpen(false);

  }, []);



  const handleSelectGrupo = (grupo) => {

    setPhotoFlow((prev) => (prev ? { ...prev, grupo } : null));

    setGrupoModalOpen(false);

    setVistaModalOpen(true);

  };



  const applyFotoToVista = useCallback(

    async (vistaCodigo) => {

      const flow = photoFlow;

      if (!flow || !vistaCodigo) {

        cancelPhotoFlow();

        return;

      }



      const vista = String(vistaCodigo).trim();



      if (flow.source === 'add-vista') {
        state.setVistaAtual(vista);
        cancelPhotoFlow();
        return;
      }

      if (flow.source === 'capture') {

        state.setVistaAtual(vista);

        onPrepareCapture?.(vista);

        toast.info('Use o botão da câmera flutuante para capturar a foto desta vista.');

        cancelPhotoFlow();

        return;

      }



      if (flow.source === 'upload' && flow.pendingFile) {

        const displayUrl = URL.createObjectURL(flow.pendingFile);

        state.setFotoVista(vista, {

          displayUrl,

          blob: flow.pendingFile,

          source: 'upload',

        });

        state.setVistaAtual(vista);

        cancelPhotoFlow();

        return;

      }



      if (flow.source === 'galeria' && flow.pendingGaleriaItem?.serverId) {

        try {

          const blob = await pacientesGaleriaApi.fetchArquivoBlob(flow.pendingGaleriaItem.url);

          const displayUrl = URL.createObjectURL(blob);

          state.setFotoVista(vista, {

            displayUrl,

            fotoGaleriaId: flow.pendingGaleriaItem.serverId,

            source: 'galeria',

          });

          state.setVistaAtual(vista);

          setGaleriaOpen(false);

        } catch (e) {

          toast.error(e?.message || 'Não foi possível carregar a foto.');

        }

        cancelPhotoFlow();

        return;

      }



      cancelPhotoFlow();

    },

    [photoFlow, cancelPhotoFlow, state, onPrepareCapture, toast],

  );



  const loadGaleria = useCallback(async () => {

    if (!pacienteId) {

      toast.warning('Paciente sem ID no servidor — não é possível abrir a galeria.');

      return;

    }

    setGaleriaLoading(true);

    try {

      const raw = await pacientesGaleriaApi.list(pacienteId);

      const normalized = normalizePacienteGaleriaResponse(raw);

      const withThumbs = await Promise.all(

        normalized.slice(0, 60).map(async (item) => {

          try {

            const blob = await pacientesGaleriaApi.fetchArquivoBlob(item.url);

            const thumbSrc = URL.createObjectURL(blob);

            return { ...item, thumbSrc };

          } catch {

            return { ...item, thumbSrc: null };

          }

        }),

      );

      setGaleriaItems(withThumbs);

    } catch (e) {

      toast.error(e?.message || 'Erro ao carregar galeria.');

      setGaleriaItems([]);

    } finally {

      setGaleriaLoading(false);

    }

  }, [pacienteId, toast]);



  const openGaleria = () => {

    setGaleriaOpen(true);

    loadGaleria();

  };



  const handleGaleriaSelect = (item) => {

    if (!item?.serverId) return;

    startPhotoFlow('galeria', { pendingGaleriaItem: item });

  };



  const handleRequestCapture = () => {

    startPhotoFlow('capture');

  };



  const handleRequestUpload = (file) => {

    if (!file) return;

    startPhotoFlow('upload', { pendingFile: file });

  };



  const handleTrocarFoto = () => {

    openGaleria();

  };



  const handleGerarPlano = async () => {

    if (!pacienteId) {

      toast.error('Paciente sem ID no servidor. Cadastre ou sincronize o paciente antes de gerar o plano.');

      return;

    }

    if (state.totalPontos() < 1) {

      toast.warning('Marque pelo menos um ponto antes de gerar o plano.');

      return;

    }



    setSaving(true);

    try {

      const result = await persistirPlanejamento({

        pacienteId,

        roleUserId,

        observacao,

        procedimentosComPontos: state.getProcedimentosComPontos(),

        fotosPorVista: state.fotosPorVista,

      });



      const payload = {
        ...result,
        procedimentosComPontos: state.getProcedimentosComPontos(),
      };

      if (result.conflitoAtivo) {

        toast.warning(

          'Plano criado, mas não foi possível ativá-lo: este paciente já possui um plano ativo.',

        );

        onGerarPlanoSuccess?.({ ...payload, partial: true });

        return;

      }



      if (!result.ok) {

        const msg = result.errosParciais?.join(' ') || 'Falha ao salvar o plano.';

        toast.error(msg);

        if (result.planejamentoId) {

          toast.info('Parte do plano pode ter sido salva no servidor.');

        }

        return;

      }



      toast.success('Plano de mapeamento gerado e ativado com sucesso.');

      onGerarPlanoSuccess?.(payload);

    } catch (e) {

      toast.error(e?.message || 'Erro ao gerar plano.');

    } finally {

      setSaving(false);

    }

  };



  const vistaAtual = state.vistaAtual;

  const fotoAtual = vistaAtual ? state.getFotoVista(vistaAtual) : null;

  const grupos = vistaAtual ? state.getPontosVista(vistaAtual) : [];

  const temVistas = vistasPreenchidas.length > 0;



  const emptyGlobal = !temVistas && !vistaAtual;



  return (

    <div className="mt-4 space-y-5">

      {temVistas ? (

        <VistaChipsBar

          vistasPreenchidas={vistasPreenchidas}

          vistaAtual={vistaAtual}

          onSelectVista={state.setVistaAtual}

          onAdicionarVista={() => startPhotoFlow('add-vista')}

          countPontosVista={state.countPontosVista}

        />

      ) : null}



      <div className="grid min-h-[420px] grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">

        <div className="flex min-h-0 flex-col gap-3">

          {!emptyGlobal && vistaAtual ? <VistaAtivaHeader vistaAtual={vistaAtual} /> : null}



          <div
            className={fullscreenOpen ? 'pointer-events-none' : undefined}
            aria-hidden={fullscreenOpen || undefined}
            inert={fullscreenOpen ? '' : undefined}
          >
            {emptyGlobal ? (

              <FotoVistaCanvas

                vistaAtual={null}

                foto={null}

                procedimentoArmado={state.procedimentoArmado}

                pontosVista={[]}

                onOpenGaleria={openGaleria}

                onRequestCapture={handleRequestCapture}

                onRequestUpload={handleRequestUpload}

                emptyTitle="Comece adicionando uma foto"

                emptySubtitle="Escolha da galeria, capture ou faça upload do dispositivo."

              />

            ) : (

              <FotoVistaCanvas

                vistaAtual={vistaAtual}

                foto={fotoAtual}

                procedimentoArmado={state.procedimentoArmado}

                pontosVista={grupos}

                onOpenGaleria={handleTrocarFoto}

                onRequestCapture={handleRequestCapture}

                onRequestUpload={handleRequestUpload}

                onRequestFullscreen={() => setFullscreenOpen(true)}

                onAddPonto={state.adicionarPonto}

                onEditarPonto={state.editarPonto}

                onRemovePonto={state.removerPonto}

              />

            )}
          </div>

        </div>



        <div className="flex flex-col gap-5 lg:sticky lg:top-4 lg:self-start">

          <MapeamentoProcedimentoPicker

            procedimentoArmado={state.procedimentoArmado}

            onArmar={(proc) => state.armarProcedimento(proc)}

            procedimentosUsados={state.procedimentosUsados()}

          />

          <PontosResumoPanel vistaAtual={vistaAtual} gruposPontos={grupos} />

        </div>

      </div>



      <div className="border-t border-app-border pt-5">
        <div className="mb-4">
          <label htmlFor="observacao-plano" className="mb-1.5 block text-[13px] font-bold text-[#475569]">
            Observação do plano
          </label>
          <p className="mb-2 text-[12px] font-medium text-[#94a3b8]">
            Enviada junto ao plano ao clicar em Gerar plano.
          </p>
          <textarea
            id="observacao-plano"
            rows={4}
            value={observacao}
            onChange={(e) => typeof onObservacaoChange === 'function' && onObservacaoChange(e.target.value)}
            placeholder="Expectativas do paciente, procedimentos planejados, observações clínicas relevantes..."
            className="w-full resize-y rounded-xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-[14px] font-medium text-app-ink outline-none transition-all focus:border-app-accent focus:ring-4 focus:ring-[#00a88e]/10"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            disabled={saving || state.totalPontos() < 1 || !pacienteId}
            onClick={handleGerarPlano}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-app-accent px-6 py-3 text-[14px] font-semibold text-white shadow-sm hover:bg-[#00967f] disabled:cursor-not-allowed disabled:bg-[#e2e8f0] disabled:text-[#94a3b8]"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando plano…
              </>
            ) : (
              'Gerar plano'
            )}
          </button>
        </div>
      </div>



      <GaleriaVistaPickerModal

        open={galeriaOpen}

        items={galeriaItems}

        loading={galeriaLoading}

        onSelect={handleGaleriaSelect}

        onClose={() => setGaleriaOpen(false)}

      />



      <EscolherGrupoFotoModal

        open={grupoModalOpen}

        onSelectGrupo={handleSelectGrupo}

        onClose={cancelPhotoFlow}

      />



      <EscolherVistaModal

        open={vistaModalOpen}

        grupo={photoFlow?.grupo}

        onSelectVista={applyFotoToVista}

        onBack={() => {

          setVistaModalOpen(false);

          setGrupoModalOpen(true);

        }}

        onClose={cancelPhotoFlow}

        hasFoto={(codigo) => Boolean(state.getFotoVista(codigo)?.displayUrl)}

        countPontosVista={state.countPontosVista}

      />



      <MapeamentoFullscreenOverlay

        open={fullscreenOpen}

        toolbarWidthPx={sidebarInsetPx}

        vistaAtual={vistaAtual}

        foto={fotoAtual}

        procedimentoArmado={state.procedimentoArmado}

        onArmar={(proc) => state.armarProcedimento(proc)}

        procedimentosUsados={state.procedimentosUsados()}

        pontosVista={grupos}

        countPontosVista={vistaAtual ? state.countPontosVista(vistaAtual) : 0}

        onAddPonto={state.adicionarPonto}

        onEditarPonto={state.editarPonto}

        onRemovePonto={state.removerPonto}

        onDesfazerUltimo={() => state.desfazerUltimoPontoVista(vistaAtual)}

        onClose={() => setFullscreenOpen(false)}

      />

    </div>

  );

}


