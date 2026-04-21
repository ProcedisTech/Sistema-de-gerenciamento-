import React from 'react';
import { PatientProfileView } from './PatientProfileView';
import { PatientsListView } from './PatientsListView';
import { PatientCreateView } from './PatientCreateView';

export function PatientsView(props) {
  const {
    patients,
    patientView,
    selectedPatientCpf,
    patientDetailTab,
    setPatientDetailTab,
    setPatientView,
    getPatientInitials,
    onStartAttendance,
    onUpdatePatient,
    onAddGalleryFiles,
    onDeleteGalleryPhoto,
    onPatientCreated,
    mergePatientById,
    refreshPatients,
    roleUserId,
  } = props;

  const selectedPatient = patients.find((p) => p.cpf === selectedPatientCpf) || null;

  if (patientView === 'profile' && selectedPatient) {
    return (
      <PatientProfileView
        selectedPatient={selectedPatient}
        patientDetailTab={patientDetailTab}
        setPatientDetailTab={setPatientDetailTab}
        setPatientView={setPatientView}
        getPatientInitials={getPatientInitials}
        onStartAttendance={onStartAttendance}
        onUpdatePatient={onUpdatePatient}
        onAddGalleryFiles={onAddGalleryFiles}
        onDeleteGalleryPhoto={onDeleteGalleryPhoto}
        mergePatientById={mergePatientById}
        refreshPatients={refreshPatients}
        roleUserId={roleUserId}
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
