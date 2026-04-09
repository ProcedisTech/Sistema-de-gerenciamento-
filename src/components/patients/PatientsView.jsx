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
    onUploadDocumentFiles,
    onSyncPendingDocuments,
    onPatientCreated,
    mergePatientById,
    refreshPatients,
    roleUserId,
  } = props;

  const selectedPatient = patients.find((p) => p.cpf === selectedPatientCpf) || null;

  if (patientView === 'create') {
    return <PatientCreateView setPatientView={setPatientView} onPatientCreated={onPatientCreated} />;
  }

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
        onUploadDocumentFiles={onUploadDocumentFiles}
        onSyncPendingDocuments={onSyncPendingDocuments}
        mergePatientById={mergePatientById}
        refreshPatients={refreshPatients}
        roleUserId={roleUserId}
      />
    );
  }

  return <PatientsListView {...props} />;
}

