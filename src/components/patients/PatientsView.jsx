import React from 'react';
import { PatientProfileView } from './PatientProfileView';
import { PatientsListView } from './PatientsListView';

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
  } = props;

  const selectedPatient = patients.find((p) => p.cpf === selectedPatientCpf) || null;

  if (patientView === 'list') {
    return <PatientsListView {...props} />;
  }

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
      />
    );
  }

  return null;
}

