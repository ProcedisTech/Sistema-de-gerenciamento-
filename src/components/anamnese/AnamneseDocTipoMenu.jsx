import React from 'react';
import { Check } from 'lucide-react';
import { getTipoMeta, TIPO_MENU_GROUPS } from './editorTipoMeta.js';
import { PopoverBody, PopoverHead, PopoverItem, PopoverLabel, PopoverSep } from './AnamneseDocPopover.jsx';

function TipoIcon({ codigo }) {
  const icons = {
    sim_nao_naosei: '✓',
    booleano: '✓',
    texto: 'T',
    numero: '#',
    escolha_unica: '☰',
    multipla_escolha: '☰',
    catalogo_medicamento: '💊',
    catalogo_principio_ativo: '⚗',
    catalogo_alergia: '⚠',
    catalogo_antecedente: '+',
  };
  return (
    <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md bg-[#f1f5f9] text-[11px] font-bold text-[#475569]">
      {icons[codigo] || '?'}
    </span>
  );
}

export function AnamneseDocTipoMenu({ current, onSelect }) {
  return (
    <>
      <PopoverHead
        title="Como a paciente responde?"
        subtitle="Escolha o formato. Os quatro últimos gravam a resposta no prontuário dela."
      />
      <PopoverBody>
        {TIPO_MENU_GROUPS.map((group, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 ? <PopoverSep /> : null}
            {group.label ? <PopoverLabel>{group.label}</PopoverLabel> : null}
            {group.keys.map((key) => {
              const meta = getTipoMeta(key);
              const active = current === key;
              return (
                <PopoverItem key={key} active={active} onClick={() => onSelect(key)}>
                  <TipoIcon codigo={key} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] font-semibold text-[#0f172a]">{meta.n}</span>
                      {meta.rec ? (
                        <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-teal-700">
                          mais usado
                        </span>
                      ) : null}
                      {active ? <Check className="ml-auto h-3.5 w-3.5 text-teal-600" /> : null}
                    </div>
                    <span className="mt-0.5 block text-[11px] text-[#64748b]">{meta.d}</span>
                    {meta.vira ? (
                      <span
                        className="mt-1 inline-block rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700"
                        dangerouslySetInnerHTML={{ __html: meta.vira }}
                      />
                    ) : null}
                  </div>
                </PopoverItem>
              );
            })}
          </React.Fragment>
        ))}
      </PopoverBody>
    </>
  );
}
