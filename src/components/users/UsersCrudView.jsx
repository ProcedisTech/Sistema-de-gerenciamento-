import React, { useCallback, useEffect, useState } from 'react';
import { UserCog, Plus, Pencil, Trash2, Loader2, X } from 'lucide-react';
import { equipeApi, usuariosApi } from '../../services/api';

function profissionalRoleUserId(p) {
  if (!p) return '';
  return p.roleUserId || p.role_user_id || p.id || '';
}

function profissionalLabel(p) {
  const nome = p.nomeCompleto || p.nome || p.name || p.username || 'Profissional';
  const rid = profissionalRoleUserId(p);
  return rid ? `${nome} (${rid.slice(0, 8)}…)` : nome;
}

function normalizeList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw?.content && Array.isArray(raw.content)) return raw.content;
  if (raw?.data && Array.isArray(raw.data)) return raw.data;
  return [];
}

function rowUsername(row) {
  return row.username || row.nomeCompleto || row.nome || '—';
}

function rowRole(row) {
  return row.role || row.papel || '—';
}

function rowRoleUserId(row) {
  return row.roleUserId || row.role_user_id || '—';
}

function rowAtivo(row) {
  if (row.ativo === false || row.active === false) return false;
  return true;
}

export function UsersCrudView() {
  const [rows, setRows] = useState([]);
  const [equipe, setEquipe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRoleUserId, setFormRoleUserId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [u, e] = await Promise.all([usuariosApi.list(), equipeApi.list().catch(() => [])]);
      setRows(normalizeList(u));
      setEquipe(Array.isArray(e) ? e : []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar usuários.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditRow(null);
    setFormUsername('');
    setFormPassword('');
    setFormRoleUserId(equipe[0] ? profissionalRoleUserId(equipe[0]) : '');
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditRow(row);
    setFormUsername(rowUsername(row));
    setFormPassword('');
    setFormRoleUserId(String(rowRoleUserId(row) === '—' ? '' : rowRoleUserId(row)));
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditRow(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editRow) {
        const body = {};
        const u = formUsername.trim();
        if (u) body.username = u;
        if (formPassword.trim()) body.password = formPassword;
        if (Object.keys(body).length === 0) {
          setError('Informe um novo nome ou senha.');
          return;
        }
        await usuariosApi.update(editRow.id, body);
      } else {
        if (!formUsername.trim() || !formPassword.trim() || !formRoleUserId.trim()) {
          setError('Preencha nome completo, senha e profissional (RoleUser).');
          return;
        }
        await usuariosApi.create({
          username: formUsername.trim(),
          password: formPassword,
          roleUserId: formRoleUserId.trim(),
        });
      }
      setModalOpen(false);
      setEditRow(null);
      await load();
    } catch (err) {
      setError(err.message || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    const name = rowUsername(row);
    if (!window.confirm(`Desativar o usuário "${name}"?`)) return;
    setError('');
    try {
      await usuariosApi.remove(row.id);
      await load();
    } catch (err) {
      setError(err.message || 'Falha ao desativar usuário.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 text-[#0f766e]">
          <UserCog className="w-6 h-6" strokeWidth={2} />
          <span className="text-[15px] font-bold">Gestão de contas</span>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[14px] text-white bg-[#00a88e] border border-app-border hover:bg-[#00967f] shadow-sm"
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} />
          Novo usuário
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-[13px] font-bold">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-[#64748b] text-[14px] py-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          Carregando…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-[#f8fbfb]">
          <table className="w-full text-left text-[13px] sm:text-[14px]">
            <thead>
              <tr className="border-b border-app-border bg-white">
                <th className="p-3 font-bold text-[#0f766e]">Nome (login)</th>
                <th className="p-3 font-bold text-[#0f766e] hidden sm:table-cell">Papel</th>
                <th className="p-3 font-bold text-[#0f766e] hidden md:table-cell">roleUserId</th>
                <th className="p-3 font-bold text-[#0f766e]">Ativo</th>
                <th className="p-3 font-bold text-[#0f766e] text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-[#64748b] font-medium">
                    Nenhum usuário retornado pela API.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-[#00a88e]/10 bg-white hover:bg-[#f0fdfa]/80">
                    <td className="p-3 font-medium text-[#0f172a]">{rowUsername(row)}</td>
                    <td className="p-3 text-[#475569] hidden sm:table-cell">{rowRole(row)}</td>
                    <td className="p-3 text-[#64748b] font-mono text-[12px] hidden md:table-cell truncate max-w-[200px]">
                      {rowRoleUserId(row)}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-lg font-bold text-[12px] border-[2px] ${
                          rowAtivo(row)
                            ? 'bg-[#dcfce7] text-[#166534] border-[#22c55e]/30'
                            : 'bg-[#fee2e2] text-[#991b1b] border-red-200'
                        }`}
                      >
                        {rowAtivo(row) ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="inline-flex items-center justify-center p-2 rounded-xl border border-slate-200 text-[#00a88e] hover:bg-[#e6f7f5] mr-1"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        className="inline-flex items-center justify-center p-2 rounded-xl border border-red-100 text-[#ef4444] hover:bg-red-50"
                        title="Desativar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fechar"
            onClick={closeModal}
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl border border-app-border shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[17px] font-bold text-[#0f172a]">
                {editRow ? 'Editar usuário' : 'Novo usuário'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 rounded-xl border border-slate-200 text-[#64748b] hover:bg-[#f8fbfb]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[12px] text-[#64748b] mb-4 font-medium">
              O login usa o <strong>nome completo</strong> cadastrado no sistema (campo username na API).
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[12px] font-bold text-[#0f766e] block mb-1">Nome completo (login)</label>
                <input
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-[#f8fbfb] text-[14px] font-medium"
                  placeholder="Ex.: Maria Silva"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="text-[12px] font-bold text-[#0f766e] block mb-1">
                  Senha {editRow ? '(deixe em branco para manter)' : ''}
                </label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-[#f8fbfb] text-[14px] font-medium"
                  placeholder="••••••••"
                  disabled={saving}
                  autoComplete="new-password"
                />
              </div>

              {!editRow && (
                <div>
                  <label className="text-[12px] font-bold text-[#0f766e] block mb-1">
                    Profissional (RoleUser na organização)
                  </label>
                  {equipe.length > 0 ? (
                    <select
                      value={formRoleUserId}
                      onChange={(e) => setFormRoleUserId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-[#f8fbfb] text-[14px] font-medium"
                      disabled={saving}
                    >
                      <option value="">Selecione…</option>
                      {equipe
                        .map((p) => ({ p, rid: profissionalRoleUserId(p) }))
                        .filter((x) => x.rid)
                        .map(({ p, rid }) => (
                          <option key={rid} value={rid}>
                            {profissionalLabel(p)}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <input
                      value={formRoleUserId}
                      onChange={(e) => setFormRoleUserId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-[#f8fbfb] text-[14px] font-mono"
                      placeholder="UUID do RoleUser"
                      disabled={saving}
                    />
                  )}
                  <p className="text-[11px] text-[#94a3b8] mt-1">
                    O backend associa o login ao RoleUser informado (header X-Org-Id).
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl font-bold text-[14px] border border-slate-200 text-[#64748b] hover:bg-[#f8fbfb]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl font-bold text-[14px] text-white bg-[#00a88e] border border-app-border disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
