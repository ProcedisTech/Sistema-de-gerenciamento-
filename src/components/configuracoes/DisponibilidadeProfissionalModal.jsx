import { useState, useEffect, useCallback } from 'react';
import { X, Save, RefreshCw, Loader2 } from 'lucide-react';
import { disponibilidadeApi, dimensoesApi, getApiErrorToastMessage } from '../../services/api.js';
import { useToast } from '../../contexts/useToast.js';

const DIAS = [
  { key: 'seg', label: 'Segunda' },
  { key: 'ter', label: 'Terça' },
  { key: 'qua', label: 'Quarta' },
  { key: 'qui', label: 'Quinta' },
  { key: 'sex', label: 'Sexta' },
  { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
];

function sufixoPeriodo(p) {
  const cod = String(p?.codigo || '').toLowerCase();
  const nome = String(p?.nome || '').toLowerCase();
  if (cod.includes('matut') || nome.includes('matut') || nome.includes('manh')) return 'Man';
  if (cod.includes('vesper') || nome.includes('vesper') || nome.includes('tarde')) return 'Tar';
  if (cod.includes('notur') || nome.includes('notur') || nome.includes('noite')) return 'Noi';
  return null;
}

function rotuloPeriodo(p) {
  const inicio = String(p?.horaInicio || '').slice(0, 5);
  const fim = String(p?.horaFim || '').slice(0, 5);
  return { titulo: p?.nome || p?.codigo || '-', faixa: `${inicio} - ${fim}` };
}

export default function DisponibilidadeProfissionalModal({
  roleUserId,
  nome,
  tipoOrg,
  onClose,
  onSaved,
}) {
  const [disp, setDisp] = useState(null);
  const [periodos, setPeriodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const { success, error: toastError } = useToast();

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [d, p] = await Promise.all([
        disponibilidadeApi.buscar(roleUserId),
        dimensoesApi.periodosDia(),
      ]);
      setDisp(d);
      const ordenados = (Array.isArray(p) ? p : []).sort((a, b) =>
        String(a?.horaInicio || '').localeCompare(String(b?.horaInicio || ''))
      );
      setPeriodos(ordenados);
    } catch (e) {
      toastError(getApiErrorToastMessage(e, 'Erro ao carregar disponibilidade'));
    } finally {
      setLoading(false);
    }
  }, [roleUserId, toastError]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const toggle = (diaKey, sufixo) => {
    const chave = `${diaKey}${sufixo}`;
    setDisp((prev) => ({ ...prev, [chave]: !prev?.[chave] }));
  };

  const handleSalvar = async () => {
    if (!disp) return;
    setSaving(true);
    try {
      const atualizado = await disponibilidadeApi.atualizar(roleUserId, disp);
      setDisp(atualizado);
      success('Disponibilidade salva');
      onSaved?.();
    } catch (e) {
      toastError(getApiErrorToastMessage(e, 'Erro ao salvar'));
    } finally {
      setSaving(false);
    }
  };

  const handleSincronizar = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Resetar disponibilidade pro horario da clinica? Mudancas nao salvas serao perdidas.')) return;
    setSincronizando(true);
    try {
      const resultado = await disponibilidadeApi.sincronizarComClinica(roleUserId);
      setDisp(resultado);
      success('Sincronizado com horario da clinica');
    } catch (e) {
      toastError(getApiErrorToastMessage(e, 'Erro ao sincronizar'));
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Disponibilidade do profissional</h2>
            {nome ? <p className="text-sm text-slate-500">{nome}</p> : null}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#00a88e]" />
          </div>
        ) : null}

        {!loading && disp ? (
          <>
            <p className="mb-4 text-sm text-slate-600">Marque os periodos em que o profissional atende.</p>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Dia</th>
                    {periodos.map((p) => {
                      const r = rotuloPeriodo(p);
                      return (
                        <th
                          key={p?.id || p?.codigo}
                          className="px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500"
                        >
                          <div>{r.titulo}</div>
                          <div className="text-[10px] font-medium text-slate-400">{r.faixa}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {DIAS.map((d) => (
                    <tr key={d.key}>
                      <td className="px-3 py-2 font-medium text-slate-900">{d.label}</td>
                      {periodos.map((p) => {
                        const sufixo = sufixoPeriodo(p);
                        const key = p?.id || p?.codigo;
                        if (!sufixo) {
                          return (
                            <td key={key} className="px-3 py-2 text-center text-slate-300">
                              -
                            </td>
                          );
                        }
                        const chave = `${d.key}${sufixo}`;
                        return (
                          <td key={key} className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={Boolean(disp[chave])}
                              onChange={() => toggle(d.key, sufixo)}
                              className="h-4 w-4 rounded border-slate-300 text-[#00a88e] focus:ring-[#00a88e]"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              {tipoOrg === 'clinica' ? (
                <button
                  onClick={handleSincronizar}
                  disabled={saving || sincronizando}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  title="Substitui pelos periodos derivados do horario da clinica"
                >
                  {sincronizando ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Resetar pro horario da clinica
                </button>
              ) : (
                <div />
              )}

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Fechar
                </button>
                <button
                  onClick={handleSalvar}
                  disabled={saving || sincronizando}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#00a88e] px-4 py-2 text-sm font-bold text-white hover:bg-[#008f78] disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
