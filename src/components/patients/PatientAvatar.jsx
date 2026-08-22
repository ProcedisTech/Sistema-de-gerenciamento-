import React from 'react';
import { Loader2 } from 'lucide-react';
import { usePatientProfilePhotoSrc } from '../../hooks/usePatientProfilePhotoSrc.js';
import { ProtectedPatientMedia } from '../ui/ProtectedPatientMedia.jsx';

export function PatientAvatar({
  patient,
  getPatientInitials,
  className = '',
  initialsClassName = 'text-[12px] font-bold',
  spinnerClassName = 'w-5 h-5',
}) {
  const { src, loading } = usePatientProfilePhotoSrc(patient);

  return (
    <div className={`relative shrink-0 overflow-hidden ${className}`}>
      {loading && !src ? (
        <div className="flex h-full w-full items-center justify-center bg-slate-50">
          <Loader2
            className={`${spinnerClassName} animate-spin text-[#00a88e]`}
            strokeWidth={2.5}
            aria-label="Carregando foto"
          />
        </div>
      ) : src ? (
        <ProtectedPatientMedia
          src={src}
          alt={patient?.nome ? `Foto de ${patient.nome}` : 'Foto do paciente'}
          className="!h-full !w-full !max-h-full !max-w-full"
          imgClassName="!h-full !w-full !max-h-full !max-w-full !object-cover !object-center"
        />
      ) : (
        <span
          className={`flex h-full w-full items-center justify-center bg-[#00a88e] text-white select-none ${initialsClassName}`}
        >
          {getPatientInitials ? getPatientInitials(patient?.nome) : (patient?.nome || '').slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}
