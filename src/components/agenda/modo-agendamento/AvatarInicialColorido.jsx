import { useState } from 'react';
import { gerarCorAvatar, iniciaisDoNome } from '../../../utils/gerarCorAvatar.js';

const SIZE_CLASS = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-12 w-12 text-sm',
};

export default function AvatarInicialColorido({ nome = '', fotoUrl, size = 'md', className = '' }) {
  // Tracks which URL failed — auto-resets when fotoUrl changes to a new value
  const [errorFor, setErrorFor] = useState(null);

  const sizeClass = SIZE_CLASS[size] || SIZE_CLASS.md;
  const label = iniciaisDoNome(nome);
  const { bg, fg } = gerarCorAvatar(nome);

  if (fotoUrl && errorFor !== fotoUrl) {
    return (
      <img
        src={fotoUrl}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full object-cover ${className}`}
        onError={() => setErrorFor(fotoUrl)}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} ${bg} ${fg} inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${className}`}
      aria-hidden
    >
      {label}
    </span>
  );
}
