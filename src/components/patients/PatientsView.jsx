import React from 'react';
import { PatientProfileView } from './PatientProfileView';
import { PatientsListView } from './PatientsListView';
import { PatientCreateView } from './PatientCreateView';

export function PatientsView(props) {
  const {
    patients,
    patientListItems,
    patientView,
    selectedPatientCpf,
    setSelectedPatientCpf,
    patientDetailTab,
    setPatientDetailTab,
    setPatientView,
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
    clinicSlug,
    clinicaInfo,
    perfilInfo,
  } = props;

  const selectedPatient =
    patients.find((p) => p.cpf === selectedPatientCpf) ||
    (Array.isArray(patientListItems)
      ? patientListItems.find((p) => p.cpf === selectedPatientCpf)
      : null) ||
    null;

  if (patientView === 'profile' && selectedPatient) {
    return (
      <PatientProfileView
        selectedPatient={selectedPatient}
        patientDetailTab={patientDetailTab}
        setPatientDetailTab={setPatientDetailTab}
        setPatientView={setPatientView}
        getPatientInitials={getPatientInitials}
        onStartAttendance={onStartAttendance}
        onAgendarPaciente={onAgendarPaciente}
        onReagendarPlanoItem={props.onReagendarPlanoItem}
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
        clinicSlug={clinicSlug || clinicaInfo?.slug}
        clinicaInfo={clinicaInfo}
        perfilInfo={perfilInfo}
      />
    );
  }

  if (patientView === 'create') {
    return (
      <>
        <PatientsListView {...props} />
        <PatientCreateView
          variant="modal"
          setPatientView={setPatientView}
          onPatientCreated={onPatientCreated}
        />
      </>
    );
  }

  return <PatientsListView {...props} />;
}
