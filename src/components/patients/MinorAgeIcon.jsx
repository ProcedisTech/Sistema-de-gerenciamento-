/**
 * Ícone "Menor de idade" — círculo com "18" e linha diagonal,
 * padrão internacional de restrição etária.
 * Usa currentColor: cor definida pelo contexto (className ou inline style).
 */
export function MinorAgeIcon({ className = '', size = 24, strokeWidth = 1.5, title, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      {...props}
    >
      <title>{title || 'Menor de idade'}</title>
      {/* Círculo */}
      <circle cx="12" cy="12" r="9.5" strokeWidth={strokeWidth} />
      {/* Linha diagonal "/" — de baixo-esquerda a cima-direita */}
      <line x1="5.3" y1="18.7" x2="18.7" y2="5.3" strokeWidth={strokeWidth} />
      {/* "18" centralizado */}
      <text
        x="12"
        y="12"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="8"
        fontWeight="700"
        stroke="none"
        fill="currentColor"
        style={{ userSelect: 'none', fontFamily: 'system-ui, sans-serif' }}
      >
        18
      </text>
    </svg>
  );
}
