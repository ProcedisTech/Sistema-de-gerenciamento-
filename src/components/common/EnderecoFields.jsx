import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { ESTADOS_BRASIL } from '../../data/estadosBrasil.js';
import { PACIENTE_FIELD_MAX } from '../../utils/patientFieldMaxLength';
import { maskCep, onlyDigitsCep } from '../../utils/cepUtils.js';
import { useCepLookup } from '../hooks/useCepLookup.js';

/**
 * Bloco de endereço estruturado + auto-fill de CEP (BrasilAPI).
 * Controlado: estado no pai (ex.: PatientCreateView / PatientProfileView).
 */
export function EnderecoFields({
  variant = 'page',
  readOnly = false,
  cep = '',
  onCepChange,
  rua = '',
  onRuaChange,
  numero = '',
  onNumeroChange,
  complemento = '',
  onComplementoChange,
  bairro = '',
  onBairroChange,
  cidade = '',
  onCidadeChange,
  estado = '',
  onEstadoChange,
  pageColorClass = 'text-[#f59e0b]',
  errors = {},
  clearError,
}) {
  const isDense = variant === 'modal' || variant === 'profile';
  const gridGapClass = isDense ? 'gap-x-5 gap-y-4' : 'gap-x-6 gap-y-5';

  const labelCls = isDense ? 'text-[13px] font-medium text-slate-800' : `text-[13px] font-bold ${pageColorClass}`;

  const inputClass = (field) => {
    if (isDense) {
      const err = field != null && errors[field];
      return `w-full rounded-lg border px-3 py-2.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#00a88e] focus:ring-1 focus:ring-[#00a88e]/20 ${
        err ? 'border-red-300 bg-red-50/60' : 'border-slate-200 bg-white'
      }`;
    }
    return `w-full px-4 py-3 bg-[#fffbeb] border border-amber-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#f59e0b]/20 transition-all ${
      errors[field] ? 'border-red-400 bg-red-50' : 'focus:border-[#f59e0b]'
    }`;
  };

  const selectClass = (field) => {
    if (isDense) {
      const err = errors[field];
      return `w-full appearance-none rounded-lg border px-3 py-2.5 text-[14px] text-slate-900 outline-none transition focus:border-[#00a88e] focus:ring-1 focus:ring-[#00a88e]/20 ${
        err ? 'border-red-300 bg-red-50/60' : 'border-slate-200 bg-white'
      }`;
    }
    return `w-full px-4 py-3 bg-[#fffbeb] border border-amber-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#f59e0b]/20 appearance-none transition-all ${
      errors[field] ? 'border-red-400 bg-red-50' : 'focus:border-[#f59e0b]'
    }`;
  };

  const { lookup, status, reset } = useCepLookup();

  const handlersRef = useRef({ onRuaChange, onBairroChange, onCidadeChange, onEstadoChange });

  useLayoutEffect(() => {
    handlersRef.current = { onRuaChange, onBairroChange, onCidadeChange, onEstadoChange };
  }, [onRuaChange, onBairroChange, onCidadeChange, onEstadoChange]);

  useEffect(() => {
    const d = onlyDigitsCep(cep);
    if (d.length < 8) {
      reset();
      return undefined;
    }

    let cancelled = false;
    const expected = d;

    const t = setTimeout(() => {
      void (async () => {
        const out = await lookup(cep);
        if (cancelled || !out.ok) return;
        if (onlyDigitsCep(cep) !== expected) return;
        if (!out.data) return;

        const h = handlersRef.current;
        const r = out.data;
        h.onRuaChange(r.rua || '');
        h.onBairroChange(r.bairro || '');
        h.onCidadeChange(r.cidade || '');
        h.onEstadoChange(r.estado || '');
      })();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [cep, lookup, reset]);

  const showCepFallbackMsg =
    (status === 'not_found' || status === 'error') && onlyDigitsCep(cep).length === 8;

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 ${gridGapClass}`}>
      <div className="space-y-1.5">
        <label className={labelCls} htmlFor="patient-endereco-cep">
          CEP
        </label>
        <div className="relative">
          <input
            id="patient-endereco-cep"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            value={cep}
            disabled={readOnly}
            maxLength={PACIENTE_FIELD_MAX.cep}
            onChange={(e) => {
              const masked = maskCep(e.target.value);
              onCepChange(masked);
              clearError?.('cep');
            }}
            placeholder="00000-000"
            className={`${inputClass('cep')} ${status === 'loading' ? 'pr-10' : ''}`}
            aria-busy={status === 'loading' || undefined}
          />
          {status === 'loading' ? (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={labelCls} htmlFor="patient-endereco-numero">
          Número
        </label>
        <input
          id="patient-endereco-numero"
          type="text"
          value={numero}
          disabled={readOnly}
          maxLength={PACIENTE_FIELD_MAX.enderecoNumero}
          onChange={(e) => {
            onNumeroChange(e.target.value.slice(0, PACIENTE_FIELD_MAX.enderecoNumero));
            clearError?.('enderecoNumero');
          }}
          placeholder="Nº"
          className={inputClass('enderecoNumero')}
        />
      </div>

      <div className="md:col-span-2 space-y-1.5">
        <label className={labelCls} htmlFor="patient-endereco-logradouro">
          Logradouro
        </label>
        <input
          id="patient-endereco-logradouro"
          type="text"
          value={rua}
          disabled={readOnly}
          maxLength={PACIENTE_FIELD_MAX.enderecoRua}
          onChange={(e) => {
            onRuaChange(e.target.value.slice(0, PACIENTE_FIELD_MAX.enderecoRua));
            clearError?.('enderecoRua');
          }}
          placeholder="Rua, avenida…"
          className={inputClass('enderecoRua')}
        />
      </div>

      <div className="space-y-1.5">
        <label className={labelCls} htmlFor="patient-endereco-complemento">
          Complemento
        </label>
        <input
          id="patient-endereco-complemento"
          type="text"
          value={complemento}
          disabled={readOnly}
          maxLength={PACIENTE_FIELD_MAX.enderecoComplemento}
          onChange={(e) => {
            onComplementoChange(e.target.value.slice(0, PACIENTE_FIELD_MAX.enderecoComplemento));
            clearError?.('enderecoComplemento');
          }}
          placeholder="Apto, bloco…"
          className={inputClass('enderecoComplemento')}
        />
      </div>

      <div className="space-y-1.5">
        <label className={labelCls} htmlFor="patient-endereco-bairro">
          Bairro
        </label>
        <input
          id="patient-endereco-bairro"
          type="text"
          value={bairro}
          disabled={readOnly}
          maxLength={PACIENTE_FIELD_MAX.enderecoBairro}
          onChange={(e) => {
            onBairroChange(e.target.value.slice(0, PACIENTE_FIELD_MAX.enderecoBairro));
            clearError?.('enderecoBairro');
          }}
          placeholder="Bairro"
          className={inputClass('enderecoBairro')}
        />
      </div>

      <div className="space-y-1.5">
        <label className={labelCls} htmlFor="patient-endereco-cidade">
          Cidade
        </label>
        <input
          id="patient-endereco-cidade"
          type="text"
          value={cidade}
          disabled={readOnly}
          maxLength={PACIENTE_FIELD_MAX.enderecoCidade}
          onChange={(e) => {
            onCidadeChange(e.target.value.slice(0, PACIENTE_FIELD_MAX.enderecoCidade));
            clearError?.('enderecoCidade');
          }}
          placeholder="Cidade"
          className={inputClass('enderecoCidade')}
        />
      </div>

      <div className="space-y-1.5">
        <label className={labelCls} htmlFor="patient-endereco-uf">
          Estado (UF)
        </label>
        <select
          id="patient-endereco-uf"
          value={estado}
          disabled={readOnly}
          onChange={(e) => {
            onEstadoChange(e.target.value.slice(0, 2).toUpperCase());
            clearError?.('enderecoEstado');
          }}
          className={selectClass('enderecoEstado')}
        >
          <option value="">Selecione…</option>
          {ESTADOS_BRASIL.map(({ sigla, nome }) => (
            <option key={sigla} value={sigla}>
              {sigla} — {nome}
            </option>
          ))}
        </select>
      </div>

      {showCepFallbackMsg ? (
        <div className="md:col-span-2" role="status">
          <p className={`text-[12px] font-semibold ${isDense ? 'text-amber-800' : 'text-amber-700'}`}>
            CEP não localizado — preencha manualmente.
          </p>
        </div>
      ) : null}
    </div>
  );
}
