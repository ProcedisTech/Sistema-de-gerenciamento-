import React from 'react';

/**
 * Wrapper de proteção para mídias (fotos) de pacientes visando mitigar
 * cópia/download indevido (Segurança/LGPD Fase 1).
 *
 * Bloqueia:
 * 1. Clique direito (onContextMenu)
 * 2. Arrastar para desktop (draggable={false} e WebkitUserDrag)
 * 3. Seleção de texto/imagem (select-none)
 * 4. (Se !interactive) Toque longo em mobile via Capa Invisível absoluta
 *
 * @param {Object} props
 * @param {boolean} [props.interactive=false] Se true, remove a capa invisível
 * para permitir cliques diretos na imagem (ex: Mapeamento Facial).
 */
export const ProtectedPatientMedia = React.forwardRef(({
  interactive = false,
  src,
  alt = '',
  className = '',
  imgClassName = '',
  onLoad,
  onError,
  ...imgProps
}, ref) => {
  const preventContext = (e) => e.preventDefault();

  return (
    <div
      className={`relative inline-block w-full h-full overflow-hidden ${className}`}
      onContextMenu={preventContext}
    >
      <img
        ref={ref}
        src={src}
        alt={alt}
        className={`w-full h-full select-none ${!interactive ? 'pointer-events-none' : ''} ${imgClassName}`}
        draggable={false}
        style={{ WebkitUserDrag: 'none' }}
        onLoad={onLoad}
        onError={onError}
        onContextMenu={preventContext}
        {...imgProps}
      />
      {!interactive && (
        <div
          className="absolute inset-0 z-10 bg-transparent"
          onContextMenu={preventContext}
          title={alt}
          aria-hidden="true"
        />
      )}
    </div>
  );
});
