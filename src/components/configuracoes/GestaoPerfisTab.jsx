import React, { useState, useEffect } from 'react';
import { Settings2, Plus, Edit2, Trash2, Shield, Crown, Loader2, X, CheckSquare, Square } from 'lucide-react';
import { resolveApiUrl } from '../../config/apiEnv';
import { getApiErrorDetail } from '../../services/api';
import { useToast } from '../../contexts/useToast.js';

export function GestaoPerfisTab({ perfisAcesso, onReload, fetchHeaders, tipoOrg }) {
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingPerfil, setEditingPerfil] = useState(null);
  
  const [formData, setFormData] = useState({ nome: '', descricao: '' });
  const [saving, setSaving] = useState(false);

  const [todasPermissoes, setTodasPermissoes] = useState([]);
  const [selectedPermissoes, setSelectedPermissoes] = useState([]);
  const [loadingPermissoes, setLoadingPermissoes] = useState(false);

  useEffect(() => {
    fetchPermissoes();
  }, []);

  const fetchPermissoes = async () => {
    try {
      const res = await fetch(resolveApiUrl('/api/v1/permissoes'), {
        headers: fetchHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        setTodasPermissoes(await res.json());
      }
    } catch (e) {
      console.error('Falha ao carregar permissões', e);
    }
  };

  const openNew = () => {
    setEditingPerfil(null);
    setFormData({ nome: '', descricao: '' });
    setSelectedPermissoes([]);
    setShowModal(true);
  };

  const openEdit = async (perfil) => {
    setEditingPerfil(perfil);
    setFormData({ nome: perfil.nome || '', descricao: perfil.descricao || '' });
    setSelectedPermissoes([]);
    setShowModal(true);

    try {
      setLoadingPermissoes(true);
      const res = await fetch(resolveApiUrl(`/api/v1/perfis-acesso/${perfil.id}/permissoes`), {
        headers: fetchHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        setSelectedPermissoes(await res.json());
      }
    } catch (e) {
      toast.error('Erro ao buscar permissões do perfil.');
    } finally {
      setLoadingPermissoes(false);
    }
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [perfilToDelete, setPerfilToDelete] = useState(null);

  const confirmDelete = (perfil) => {
    setPerfilToDelete(perfil);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!perfilToDelete) return;
    try {
      const res = await fetch(resolveApiUrl(`/api/v1/perfis-acesso/${perfilToDelete.id}`), {
        method: 'DELETE',
        headers: fetchHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        toast.success('Perfil excluído com sucesso.');
        setShowDeleteModal(false);
        setPerfilToDelete(null);
        onReload();
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(getApiErrorDetail({ body }) || 'Erro ao excluir perfil.');
      }
    } catch (e) {
      toast.error('Falha de rede ao excluir perfil.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nome.trim()) return toast.error('O nome do perfil é obrigatório.');
    
    setSaving(true);
    try {
      const url = editingPerfil 
        ? resolveApiUrl(`/api/v1/perfis-acesso/${editingPerfil.id}`)
        : resolveApiUrl('/api/v1/perfis-acesso');
        
      const method = editingPerfil ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { ...fetchHeaders(), 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        const savedPerfil = await res.json();
        const perfilId = savedPerfil.id;

        const putRes = await fetch(resolveApiUrl(`/api/v1/perfis-acesso/${perfilId}/permissoes`), {
          method: 'PUT',
          headers: { ...fetchHeaders(), 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(selectedPermissoes)
        });

        if (!putRes.ok) {
           toast.error('Perfil salvo, mas houve erro ao atribuir permissões.');
        } else {
           toast.success(`Perfil ${editingPerfil ? 'atualizado' : 'criado'} com sucesso!`);
        }

        setShowModal(false);
        onReload();
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(getApiErrorDetail({ body }) || 'Erro ao salvar perfil.');
      }
    } catch (e) {
      toast.error('Falha de rede ao salvar perfil.');
    } finally {
      setSaving(false);
    }
  };

  const permissoesPorModulo = todasPermissoes.reduce((acc, perm) => {
    const mod = perm.modulo || 'Geral';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(perm);
    return acc;
  }, {});

  const globais = perfisAcesso.filter(p => !p.organizacaoSaudeDona && !p.organizacaoSaudeDonaId && (p.codigo || '').toUpperCase() !== 'DONO');
  const customizados = perfisAcesso.filter(p => p.organizacaoSaudeDona || p.organizacaoSaudeDonaId);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-teal-600" />
            Níveis de Acesso
          </h4>
          <p className="text-sm text-slate-500 mt-1">Gerencie os templates de permissão utilizados na sua clínica.</p>
        </div>
        <button
          onClick={openNew}
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00a88e] to-teal-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-teal-500/30 transition-all hover:-translate-y-0.5 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Novo Perfil Customizado
        </button>
      </div>

      <div className="space-y-4">
        {/* Perfis Customizados */}
        <div>
          <h5 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 ml-1">Perfis da Clínica</h5>
          {customizados.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center">
              <p className="text-slate-500 text-sm">Nenhum perfil customizado criado. Você está usando apenas os templates globais.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {customizados.map(p => (
                <div key={p.id} className="bg-white border border-teal-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <h6 className="font-bold text-slate-900 text-base">{p.nome}</h6>
                    <span className="bg-teal-50 text-teal-700 text-[10px] font-bold px-2 py-0.5 rounded border border-teal-100 uppercase">Customizado</span>
                  </div>
                  <p className="text-sm text-slate-500 mb-4 h-10 line-clamp-2">{p.descricao || 'Sem descrição.'}</p>
                  
                  <div className="flex gap-2 border-t border-slate-50 pt-4 mt-auto">
                    <button onClick={() => openEdit(p)} className="flex-1 flex justify-center items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 py-2 rounded-lg transition-colors">
                      <Edit2 className="h-3.5 w-3.5" /> Editar
                    </button>
                    <button onClick={() => confirmDelete(p)} className="flex-none flex justify-center items-center gap-1.5 text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Perfis Globais */}
        <div className="pt-4">
          <h5 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 ml-1">Templates Globais do Sistema</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 opacity-80">
            {globais.sort((a,b) => (a.codigo||'').localeCompare(b.codigo||'')).map(p => {
              const isDono = (p.codigo || '').toUpperCase() === 'DONO';
              return (
                <div key={p.id} className="bg-slate-50 border border-slate-200 rounded-xl p-5 cursor-not-allowed">
                  <div className="flex justify-between items-start mb-2">
                    <h6 className="font-bold text-slate-700 text-base flex items-center gap-1.5">
                      {isDono ? <Crown className="h-4 w-4 text-amber-500" /> : <Shield className="h-4 w-4 text-slate-400" />}
                      {p.nome}
                    </h6>
                    <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Padrão</span>
                  </div>
                  <p className="text-sm text-slate-500 line-clamp-2">{p.descricao || 'Nível de acesso nativo do sistema.'}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-4xl bg-white rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-4 shrink-0">
              <h3 className="text-xl font-bold text-slate-900">
                {editingPerfil ? 'Editar Perfil' : 'Novo Perfil'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="flex flex-col md:flex-row gap-8 flex-1 min-h-0">
                {/* Esquerda: Dados Básicos */}
                <div className="w-full md:w-1/3 space-y-4 shrink-0">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-teal-700 mb-1.5 ml-1">Nome do Perfil</label>
                    <input
                      required
                      maxLength={50}
                      value={formData.nome}
                      onChange={e => setFormData({...formData, nome: e.target.value})}
                      placeholder="Ex: Recepcionista Sênior"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-teal-700 mb-1.5 ml-1">Descrição</label>
                    <textarea
                      maxLength={200}
                      rows={3}
                      value={formData.descricao}
                      onChange={e => setFormData({...formData, descricao: e.target.value})}
                      placeholder="Ex: Acesso às rotinas de recepção e faturamento básico."
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 resize-none"
                    />
                  </div>
                </div>

                {/* Direita: Permissões */}
                <div className="w-full md:w-2/3 flex flex-col min-h-0 border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-8">
                  <div className="flex justify-between items-end mb-4 shrink-0">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Permissões de Acesso</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Selecione o que usuários com este perfil poderão fazer no sistema.</p>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar pb-4">
                    {loadingPermissoes ? (
                      <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-teal-500" /></div>
                    ) : (
                      Object.entries(permissoesPorModulo).map(([modulo, perms]) => (
                        <div key={modulo}>
                          <h5 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-3 bg-slate-50 py-2 px-3 rounded-xl border border-slate-100 shadow-sm">{modulo}</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-1">
                            {perms.map(p => {
                              const checked = selectedPermissoes.includes(p.permissaoId);
                              return (
                                <label key={p.permissaoId} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${checked ? 'border-teal-200 bg-teal-50/40 shadow-sm' : 'border-transparent hover:bg-slate-50'}`}>
                                  <div className="mt-0.5 text-teal-600 shrink-0">
                                    {checked ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-slate-300" />}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className={`text-[13px] font-bold ${checked ? 'text-teal-900' : 'text-slate-700'}`}>{p.nome}</span>
                                    {p.descricao && <span className="text-[11px] text-slate-500 leading-snug mt-1">{p.descricao}</span>}
                                  </div>
                                  <input 
                                    type="checkbox"
                                    className="hidden"
                                    checked={checked}
                                    onChange={(e) => {
                                      if (e.target.checked) setSelectedPermissoes([...selectedPermissoes, p.permissaoId]);
                                      else setSelectedPermissoes(selectedPermissoes.filter(id => id !== p.permissaoId));
                                    }}
                                  />
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-5 mt-4 flex justify-end gap-3 border-t border-slate-100 shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#00a88e] to-teal-500 text-white text-sm font-bold shadow-lg shadow-teal-500/30 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center gap-2"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && perfilToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="h-14 w-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
              <Trash2 className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Excluir Perfil?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Tem certeza que deseja excluir o perfil <span className="font-bold text-slate-700">"{perfilToDelete.nome}"</span>?
              <br/><br/>
              Usuários que estiverem usando este perfil perderão o acesso customizado e voltarão para as permissões nativas.
            </p>
            <div className="flex justify-center w-full gap-3">
              <button 
                type="button" 
                onClick={() => {
                  setShowDeleteModal(false);
                  setPerfilToDelete(null);
                }} 
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleDelete}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-500/30 hover:bg-red-600 transition-colors"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
