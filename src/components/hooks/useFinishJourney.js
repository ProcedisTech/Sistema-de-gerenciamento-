import React, { useCallback, useRef, useState } from 'react';
import {
  catalogosApi,
  getApiErrorDetail,
  orientacoesApi,
  pacientesGaleriaApi,
  perfilApi,
  procedimentosApi,
  termoAssinaturaApi,
} from '../../services/api';
import { formatGaleriaLegendaForUpload, GALERIA_CATEGORIA } from '../../utils/pacienteGaleria.js';
import { toLocalISODate } from '../../utils/dateLimits.js';
import { convertToWebP } from '../../utils/imageUtils.js';
import {
  normalizeOrientacoesTemplateResponse,
  orientacoesTemplateSignature,
} from '../../utils/orientacoesJourney.js';

export function useFinishJourney({
  toast,
  journeyState,
  patientState,
  cameraState,
  roleUserId,
  pacienteAtual,
  selectedPatientCpf,
  refreshPatients,
  setSelectedPatientCpf,
  setActiveView,
  setJourneyProcedureDateIso,
  setQueixaVisivel,
  setPhotoAnnotationScope,
  setPhotoAnnotationIndex,
  askFinishJourneyConfirm,
}) {
  const [ultimoProcedimentoId, setUltimoProcedimentoId] = useState(null);
  const [ultimaAssinaturaId, setUltimaAssinaturaId] = useState(null);

  const pendingAnnotatedGalleryBlobsRef = useRef([]);
  const finishJourneyLockRef = useRef(false);
  const anamnesePreenchimentoIdRef = useRef(null);

  const handleTermoAssinaturaSalva = useCallback((assinaturaObj) => {
    if (assinaturaObj?.id) {
      setUltimaAssinaturaId(assinaturaObj.id);
    }
  }, []);

  const finishJourney = async () => {
    if (finishJourneyLockRef.current) return;
    finishJourneyLockRef.current = true;
    journeyState.setIsFinishing(true);
    try {
      const sCpf = String(selectedPatientCpf || pacienteAtual?.cpf || '').trim();
      const paciente = sCpf
        ? patientState.patients.find((p) => String(p?.cpf || '').trim() === sCpf)
        : null;
      let procedimentoFeitoIdParaVinculo = null;
      if (journeyState.nomeProcedimento.trim() && paciente?.id && roleUserId) {
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const agendaIdValido =
          journeyState.agendaId && UUID_REGEX.test(journeyState.agendaId)
            ? journeyState.agendaId
            : null;
        const resultado = await procedimentosApi.registrarManual(paciente.id, {
          nome: journeyState.nomeProcedimento.trim(),
          roleUserId,
          observacao: String(journeyState.observacoesExecucao || '').trim() || null,
          agendaId: agendaIdValido,
        });
        const pid = resultado?.id ?? resultado?.procedimentoId ?? resultado?.procedimentoFeitoId;
        if (pid != null && pid !== '') {
          procedimentoFeitoIdParaVinculo = String(pid);
          setUltimoProcedimentoId(String(pid));
        }
      }
      if (ultimaAssinaturaId && procedimentoFeitoIdParaVinculo) {
        try {
          await termoAssinaturaApi.vincularProcedimento(ultimaAssinaturaId, procedimentoFeitoIdParaVinculo);
        } catch (e) {
          console.warn('Não foi possível vincular assinatura ao procedimento:', e);
        }
      }

      const snapshotNome = String(journeyState.nomeProcedimento || '').trim();
      const snapshotCatalogoId =
        journeyState.nomeProcedimentoCatalogoId != null &&
        String(journeyState.nomeProcedimentoCatalogoId).trim() !== ''
          ? String(journeyState.nomeProcedimentoCatalogoId).trim()
          : null;
      const snapshotItens = Array.isArray(journeyState.orientacoesItens)
        ? journeyState.orientacoesItens.map((i) => ({ ...i }))
        : [];

      const orientacoesPayload = snapshotItens
        .map((i, idx) => ({
          descricao: String(i.descricao || '').trim(),
          checado: Boolean(i.checado),
          ordem: Number.isFinite(Number(i.ordem)) ? Number(i.ordem) : idx,
        }))
        .filter((x) => x.descricao);

      if (procedimentoFeitoIdParaVinculo && orientacoesPayload.length > 0) {
        await orientacoesApi.salvar(procedimentoFeitoIdParaVinculo, orientacoesPayload);
      }

      let tplSig = '';
      if (snapshotNome) {
        try {
          const tplRaw = await perfilApi.getOrientacoesTemplate(snapshotNome);
          const tplList = normalizeOrientacoesTemplateResponse(tplRaw);
          tplSig = orientacoesTemplateSignature(
            tplList.map((x) => ({ descricao: x.descricao, ordem: x.ordem })),
          );
        } catch (e) {
          if (e?.status !== 404 && e?.status !== 400) {
            console.warn('getOrientacoesTemplate:', e);
          }
          tplSig = '';
        }
      }
      const curSig = orientacoesTemplateSignature(orientacoesPayload);
      const shouldOfferTemplate = Boolean(
        snapshotNome && orientacoesPayload.length > 0 && (tplSig === '' || tplSig !== curSig),
      );
      if (shouldOfferTemplate) {
        const saveTpl = await askFinishJourneyConfirm({
          title: 'Salvar como padrão?',
          message: `Salvar estas orientações como padrão para "${snapshotNome}"?`,
        });
        if (saveTpl) {
          try {
            await perfilApi.salvarOrientacoesTemplate(snapshotNome, orientacoesPayload);
          } catch (e) {
            toast.error(getApiErrorDetail(e) || 'Não foi possível salvar o template de orientações.');
          }
        }
      }

      if (snapshotNome && !snapshotCatalogoId) {
        let catalogNames = [];
        try {
          const cats = await catalogosApi.list();
          const arr = Array.isArray(cats) ? cats : cats?.content || [];
          catalogNames = (Array.isArray(arr) ? arr : [])
            .map((c) => String(c.nomeProcedimento || c.nome || '').trim())
            .filter(Boolean);
        } catch (e) {
          console.warn('catalogos list:', e);
        }
        const hit = catalogNames.some((n) => n.toLowerCase() === snapshotNome.toLowerCase());
        if (!hit) {
          const add = await askFinishJourneyConfirm({
            title: 'Catálogo',
            message: `Procedimento não cadastrado no catálogo. Deseja cadastrá-lo como "${snapshotNome}"?`,
          });
          if (add) {
            try {
              await catalogosApi.criar({ nomeProcedimento: snapshotNome });
              toast.success('Procedimento adicionado ao catálogo.');
            } catch (e) {
              toast.error(getApiErrorDetail(e) || 'Não foi possível cadastrar no catálogo.');
            }
          }
        }
      }

      const dataRefSessao = new Date().toISOString().slice(0, 10);
      const procIdOpt = procedimentoFeitoIdParaVinculo ?? undefined;
      const ridUpload = roleUserId;
      const ridOk = ridUpload && /^[0-9a-f-]{36}$/i.test(String(ridUpload));

      const fotosProcedimento = cameraState.procedureCapturedPhotos || [];
      const queuedAnnotated = ridOk && paciente?.id ? pendingAnnotatedGalleryBlobsRef.current.splice(0) : [];

      if (queuedAnnotated.length > 0 && paciente?.id && ridOk) {
        const uploadsAval = queuedAnnotated.map(async (blob, idx) => {
          try {
            const file = new File([blob], `avaliacao_${Date.now()}_${idx}.jpg`, { type: 'image/jpeg' });
            await pacientesGaleriaApi.upload(paciente.id, file, {
              roleUserId: ridUpload,
              procedimentoFeitoId: procIdOpt,
              legenda: formatGaleriaLegendaForUpload(
                GALERIA_CATEGORIA.PLANEJAMENTO,
                journeyState.nomeProcedimento.trim() || 'Mapeamento'
              ),
              dataReferencia: dataRefSessao,
            });
          } catch (e) {
            console.warn('Erro ao salvar foto de avaliação na galeria:', e);
          }
        });
        await Promise.allSettled(uploadsAval);
      }

      if (
        fotosProcedimento.length > 0 &&
        paciente?.id &&
        ridOk
      ) {
        const uploads = fotosProcedimento.map(async (foto) => {
          try {
            let fileToUpload = foto.blob;
            if (!fileToUpload && foto.url) {
              const resp = await fetch(foto.url);
              const blob = await resp.blob();
              fileToUpload = new File([blob], 'foto-procedimento.jpg', {
                type: blob.type || 'image/jpeg',
              });
            }
            if (!fileToUpload) return;
            const webp = await convertToWebP(fileToUpload, 0.85, 1920);
            await pacientesGaleriaApi.upload(paciente.id, webp, {
              roleUserId: ridUpload,
              procedimentoFeitoId: procIdOpt,
              legenda: formatGaleriaLegendaForUpload(
                foto.meta?.categoria || GALERIA_CATEGORIA.DEPOIS,
                journeyState.nomeProcedimento.trim() || 'Foto do procedimento'
              ),
              dataReferencia: dataRefSessao,
            });
          } catch (e) {
            console.warn('Erro ao salvar foto do procedimento:', e);
          }
        });
        await Promise.allSettled(uploads);
      } else if (fotosProcedimento.length > 0 && paciente?.id && !ridOk) {
        console.warn('Fotos do procedimento não enviadas: selecione o profissional (roleUserId) na barra de contexto.');
      }

      refreshPatients();
      toast.success('Jornada finalizada com sucesso.');
      const cpfParaPerfil = sCpf;
      setActiveView('pacientes');
      resetJourney();
      if (cpfParaPerfil) {
        setSelectedPatientCpf(cpfParaPerfil);
      }
      patientState.setPatientView('profile');
      patientState.setPatientDetailTab('timeline');
    } catch (error) {
      console.error('Erro ao finalizar jornada:', error);
      toast.error(error.message || 'Erro ao finalizar jornada.');
    } finally {
      finishJourneyLockRef.current = false;
      journeyState.setIsFinishing(false);
    }
  };

  const resetJourney = () => {
    setPhotoAnnotationScope(null);
    setPhotoAnnotationIndex(null);
    journeyState.setCurrentStep(1);
    journeyState.setQueixa('');
    journeyState.setExpectativas('');
    journeyState.setObservacoes('');
    journeyState.setStep2AnamneseDraft({
      fichaSelecionadaId: '',
      fichaDropdownNovo: '',
      respostas: {},
      preenchimentoAnterior: null,
      modoVisualizacao: false,
    });
    journeyState.setRespostasAnamnese({});
    journeyState.setImageSrc(null);
    journeyState.setPaths([]);
    journeyState.setTermoLido(false);
    journeyState.setTermoAssinado(false);
    journeyState.setTermoAssinaturaDataUrl('');
    journeyState.setProfissionalAssinaturaDataUrl('');
    journeyState.setOrientacoesItens([]);
    journeyState.setOrientacoesCarregadas(false);
    journeyState.setProximoRetornoDisplay('');
    journeyState.setObservacoesExecucao('');
    journeyState.setNomeProcedimento('');
    journeyState.setNomeProcedimentoCatalogoId(null);
    journeyState.setAgendaId(null);
    journeyState.setStep2Errors({});
    journeyState.setStep4Errors({});
    journeyState.setStep5Errors({});
    anamnesePreenchimentoIdRef.current = null;
    pendingAnnotatedGalleryBlobsRef.current = [];
    journeyState.setTermoSelecionadoId(null);
    setUltimoProcedimentoId(null);
    setUltimaAssinaturaId(null);
    patientState.setSelectedPatientCpf(null);
    patientState.setPatientView('list');
    setJourneyProcedureDateIso(toLocalISODate());
    setQueixaVisivel(true);
    cameraState.resetProcedureCapturedPhotos();
    cameraState.resetEvaluationPhotos();
  };

  const persistAnnotatedPhotoToGallery = useCallback(
    async (blob) => {
      if (!blob || !(blob instanceof Blob)) return { ok: false, skipped: true };
      const pid = pacienteAtual?.id;
      if (!pid) return { ok: false, skipped: true, reason: 'no_server_id' };
      const rid = roleUserId;
      if (!rid || !/^[0-9a-f-]{36}$/i.test(String(rid))) {
        toast.warning(
          'Selecione o profissional na barra de contexto para enviar a foto desenhada à galeria no servidor.'
        );
        return { ok: false, skipped: true };
      }
      pendingAnnotatedGalleryBlobsRef.current.push(blob);
      return { ok: true };
    },
    [pacienteAtual?.id, roleUserId, toast]
  );

  return {
    ultimoProcedimentoId,
    ultimaAssinaturaId,
    handleTermoAssinaturaSalva,
    persistAnnotatedPhotoToGallery,
    finishJourney,
    resetJourney,
    anamnesePreenchimentoIdRef,
  };
}

