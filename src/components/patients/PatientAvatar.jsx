import React from 'react';
import { Loader2 } from 'lucide-react';
import { usePatientProfilePhotoSrc } from '../../hooks/usePatientProfilePhotoSrc.js';

export function PatientAvatar({
  patient,
  getPatientInitials,
  className = '',
  initialsClassName = 'text-[12px] font-bold',
  spinnerClassName = 'w-5 h-5',
}) {
  const { src, loading } = usePatientProfilePhotoSrc(patient);

  return (
    <div className={className}>
      {loading && !src ? (
        <Loader2
          className={`${spinnerClassName} animate-spin text-[#00a88e]`}
          strokeWidth={2.5}
          aria-label="Carregando foto"
        />
      ) : src ? (
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className={`w-full h-full flex items-center justify-center bg-[#00a88e] ${initialsClassName}`}>
          {getPatientInitials(patient?.nome)}
        </span>
      )}
    </div>
  );
}
