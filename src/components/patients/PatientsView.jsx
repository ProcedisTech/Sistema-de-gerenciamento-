import React from 'react';
import { PatientProfileView } from './PatientProfileView';
import { PatientsListView } from './PatientsListView';
import { PatientCreateView } from './PatientCreateView';
import NaoEncontrado from '../../rotas/NaoEncontrado.jsx';
import { caminhos } from '../../rotas/caminhos.js';

export function PatientsView(props) {
  const {
    patients,
    patientListItems,
    patientView,
    selectedPatientCpf,
    setSelectedPatientCpf,
    patientDetailTab,
    rota,
    pacienteNaoEncontrado,
    irPara,
    getPatientInitials,
    onStartAttendance,
    onAgendarPaciente,
    onUpdatePatient,
    onAddGalleryFiles,
    onDeleteGalleryPhoto,
    onPatientCreated,
    mergePatientById,
    refreshPatients,
    roleUserId,
    clinicaInfo,
    perfilInfo,
  } = props;

  // No perfil o endereço manda (id da rota); sem id na rota, cai no CPF guardado.
  const idRota = patientView === 'profile' && rota?.pacienteId != null ? String(rota.pacienteId) : null;
  const acha = idRota != null ? (p) => String(p.id) === idRota : (p) => p.cpf === selectedPatientCpf;
  const selectedPatient =
    patients.find(acha) ||
    (Array.isArray(patientListItems) ? patientListItems.find(acha) : null) ||
    null;

  // Valores da lista guardados pelo hook mesmo fora de /pacientes;.
  const voltarParaLista = (opcoes) =>
    irPara(
      caminhos.pacientes({
        quickFilter: props.patientQuickFilter === 'todos' ? null : props.patientQuickFilter,
        statusPlano: props.statusPlanoFilter || null,
        ordem: props.patientListSortBy,
        pagina: props.patientListPage,
        anamneseDesatualizada: props.anamneseDesatualizadaFilter,
        semAgendamentoFuturo: props.semAgendamentoFuturoFilter,
        semRetorno: props.semRetornoFilter,
        ehNovo: props.ehNovoFilter,
        ehAniversariante: props.ehAniversarianteFilter,
      }),
      opcoes,
    );

  if (patientView === 'profile' && pacienteNaoEncontrado) return <NaoEncontrado />;

  if (patientView === 'profile' && selectedPatient) {
    return (
      <PatientProfileView
        selectedPatient={selectedPatient}
        patientDetailTab={patientDetailTab}
        rota={rota}
        irPara={irPara}
        voltarParaLista={voltarParaLista}
        getPatientInitials={getPatientInitials}
        onStartAttendance={onStartAttendance}
        onAgendarPaciente={onAgendarPaciente}
        onAgendarPlanoItem={props.onAgendarPlanoItem}
        onAgendarRetornoPlanoItem={props.onAgendarRetornoPlanoItem}
        onReagendarPlanoItem={props.onReagendarPlanoItem}
        onPlanoConcluido={props.onPlanoConcluido}
        onUpdatePatient={onUpdatePatient}
        onAddGalleryFiles={onAddGalleryFiles}
        onDeleteGalleryPhoto={onDeleteGalleryPhoto}
        mergePatientById={mergePatientById}
        refreshPatients={refreshPatients}
        setSelectedPatientCpf={setSelectedPatientCpf}
        roleUserId={roleUserId}
        isRecepcionista={props.isRecepcionista}
        profileNav={props.profileNav}
        onProfileNavigatePrev={() => props.navigateProfilePatient?.(-1)}
        onProfileNavigateNext={() => props.navigateProfilePatient?.(1)}
        clinicaInfo={clinicaInfo}
        perfilInfo={perfilInfo}
        patientListBump={props.patientListBump}
      />
    );
  }

  if (idRota != null) {
    if (props.pacienteCarregando === false) {
      return (
        <div role="alert">
          <p>Não foi possível carregar o paciente</p>
          <button type="button" onClick={() => voltarParaLista()}>Voltar</button>
        </div>
      );
    }
    return <p role="status">Carregando paciente...</p>;
  }

  if (patientView === 'create') {
    return (
      <>
        <PatientsListView {...props} />
        <PatientCreateView
          variant="modal"
          rota={rota}
          irPara={irPara}
          voltarParaLista={voltarParaLista}
          onPatientCreated={onPatientCreated}
        />
      </>
    );
  }

  return <PatientsListView {...props} />;
}
