import { hashAvatarGradient, initialsFromName } from '../../utils/agendaAvatarUtils.js';

export function AgendaAvatarInitials({ name, size = 44, className = '' }) {
  const grad = hashAvatarGradient(name);
  const px = typeof size === 'number' ? size : 44;
  const fontSize = px >= 40 ? 'text-sm' : 'text-[10px]';

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${fontSize} ${className}`}
      style={{
        width: px,
        height: px,
        background: `linear-gradient(135deg, ${grad.from}, ${grad.to})`,
      }}
      aria-hidden
    >
      {initialsFromName(name)}
    </div>
  );
}
