import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { htmlEstavel, limparAmbienteSnapshot, prepararAmbienteSnapshot } from '../../test/snapshotConsulta.jsx';
import { ProcedureCameraWidget } from '../canvas/ProcedureCameraWidget.jsx';

const noop = () => {};

function props(extra) {
  return {
    visible: true,
    photoThumbUrl: null,
    photoModalOpen: false,
    openPhotoModal: noop,
    closePhotoModal: noop,
    videoRef: { current: null },
    videoReady: false,
    isCameraStarting: false,
    photoPreviewUrl: null,
    photoPreviewBlob: null,
    cameraError: null,
    capturePhoto: noop,
    retakePhoto: noop,
    confirmPhoto: noop,
    uploadPhotoFiles: noop,
    uploadDocumentFiles: noop,
    cameraFacing: 'environment',
    onToggleCameraFacing: noop,
    ...extra,
  };
}

describe('snapshot — ProcedureCameraWidget', () => {
  beforeEach(prepararAmbienteSnapshot);
  afterEach(limparAmbienteSnapshot);

  it('botão flutuante, modal fechado', async () => {
    await htmlEstavel(<ProcedureCameraWidget {...props()} />);
    expect(document.body.innerHTML).toMatchSnapshot();
  });

  it('modal aberto com prévia da foto', async () => {
    await htmlEstavel(
      <ProcedureCameraWidget
        {...props({ photoModalOpen: true, videoReady: true, photoPreviewUrl: 'https://fotos.teste/previa.jpg' })}
      />,
    );
    expect(document.body.innerHTML).toMatchSnapshot();
  });
});
