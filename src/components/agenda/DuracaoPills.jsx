import React from 'react';
import { DURACOES_PILL } from '../../utils/agendaDuracaoPills.js';
import { PILL_BASE, PILL_IDLE, PILL_SELECTED } from './agendaPillStyles.js';

const LABELS = { 30: '30m', 60: '60m', 90: '90m', 120: '2h' };

export function DuracaoPills({ value, onChange }) {
  const selected = Number(value) || 60;

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Duração">
      {DURACOES_PILL.map((min) => {
        const isSelected = selected === min;
        return (
          <button
            key={min}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(min)}
            className={`${PILL_BASE} ${isSelected ? PILL_SELECTED : PILL_IDLE}`}
          >
            {LABELS[min] || `${min}m`}
          </button>
        );
      })}
    </div>
  );
}
