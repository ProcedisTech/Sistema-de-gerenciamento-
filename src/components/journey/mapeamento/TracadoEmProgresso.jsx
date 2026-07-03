import React from 'react';
import { percentToContainerPositionFromMetrics } from '../../../utils/mapeamentoCoords.js';

export function TracadoEmProgresso({ vertices, layoutMetrics }) {
  if (!vertices || vertices.length === 0) return null;

  const resolvePos = (x, y) => {
    const pos = percentToContainerPositionFromMetrics(x, y, layoutMetrics);
    return pos ? { x: pos.left, y: pos.top } : { x, y };
  };

  const points = vertices.map(v => resolvePos(v.x, v.y));

  return (
    <svg className="absolute inset-0 h-full w-full pointer-events-none z-[20]" style={{ overflow: 'visible' }}>
      {points.map((p, i) => {
        if (i === 0) return null;
        const prev = points[i - 1];
        return (
          <line
            key={`line-${i}`}
            x1={`${prev.x}%`}
            y1={`${prev.y}%`}
            x2={`${p.x}%`}
            y2={`${p.y}%`}
            stroke="#00a88e"
            strokeWidth="3"
            strokeDasharray="4 4"
          />
        );
      })}
      {points.length > 0 && (
        <circle cx={`${points[0].x}%`} cy={`${points[0].y}%`} r="4" fill="#00a88e" />
      )}
    </svg>
  );
}
