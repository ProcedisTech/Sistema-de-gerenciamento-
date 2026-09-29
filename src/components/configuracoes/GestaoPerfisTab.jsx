import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings2, Plus, Edit2, Trash2, Shield, Crown, Loader2, X } from 'lucide-react';
import { resolveApiUrl } from '../../config/apiEnv';
import { getApiErrorDetail } from '../../services/api';
import { useToast } from '../../contexts/useToast.js';
import { CODIGO_ORDER, MODULO_LABEL_CURTO } from './gestaoUsuariosUtils';
import { PermissoesPorModuloPanel } from './PermissoesPorModuloPanel';
import { PermissoesCustomizadasModal } from './PermissoesCustomizadasModal';

const isPerfilGlobal = (perfil) => !perfil.organizacaoSaudeDona && !perfil.organizacaoSaudeDonaId;

export function GestaoPerfisTab({ perfisAcesso, permissoes, usuarios, onReload, fetchHeaders, perfilParaAbrir, onPerfilParaAbrirConsumido }) {
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [editingPerfil, setEditingPerfil] = useState(null);
  const [perfilBaseCriacao, setPerfilBaseCriacao] = useState(null);

  const [formData, setFormData] = useState({ nome: '', descricao: '' });
  const [saving, setSaving] = useState(false);

  const [selectedPermissoes, setSelectedPermissoes] = useState([]);
  const [loadingPermissoes, setLoadingPermissoes] = useState(false);

  // Pop-up de escolha (criar novo vs editar existente), só pra perfis já customizados.
  const [perfilEscolha, setPerfilEscolha] = useState(null);
  const [carregandoEscolha, setCarregandoEscolha] = useState(false);

  // Permissões atuais de cada perfil, só pra montar as barrinhas de cobertura e o
  // total nos cards da listagem — carregado em paralelo, um perfil por vez.
  const [permissoesPorPerfil, setPermissoesPorPerfil] = useState({});

  const fecharModal = () => {
    setShowModal(false);
    setPerfilBaseCriacao(null);
    setWizardStep(1);
  };

  const openNew = () => {
    setEditingPerfil(null);
    setPerfilBaseCriacao(null);
    setFormData({ nome: '', descricao: '' });
    setSelectedPermissoes([]);
    setWizardStep(1);
    setShowModal(true);
  };

  const openEdit = async (perfil) => {
    setEditingPerfil(perfil);
    setPerfilBaseCriacao(null);
    setFormData({
      nome: perfil.nome || '',
      descricao: perfil.descricao || '',
    });
    setSelectedPermissoes([]);
    setWizardStep(1);
    setShowModal(true);

    try {
      setLoadingPermissoes(true);
      const res = await fetch(resolveApiUrl(`/api/v1/perfis-acesso/${perfil.id}/permissoes`), {
        headers: await fetchHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        setSelectedPermissoes(await res.json());
      }
    } catch {
      toast.error('Erro ao buscar permissões do perfil.');
    } finally {
      setLoadingPermissoes(false);
    }
  };

  const buscarPermissoesAtuais = async (perfilId) => {
    try {
      const res = await fetch(resolveApiUrl(`/api/v1/perfis-acesso/${perfilId}/permissoes`), {
        headers: await fetchHeaders(),
        credentials: 'include'
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      toast.error('Erro ao buscar permissões atuais.');
      return [];
    }
  };

  useEffect(() => {
    if (!perfisAcesso?.length) return;
    let cancelado = false;
    Promise.all(perfisAcesso.map(async (perfil) => {
      const permissoesAtuais = await buscarPermissoesAtuais(perfil.id);
      return [perfil.id, permissoesAtuais];
    })).then((entries) => {
      if (cancelado) return;
      setPermissoesPorPerfil(Object.fromEntries(entries));
    });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfisAcesso]);

  const modulosCatalogo = (permissoes || []).reduce((acc, perm) => {
    const mod = perm.modulo || 'Geral';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(perm);
    return acc;
  }, {});

  const getResumoPerfil = (perfil) => {
    const permsDoPerfil = permissoesPorPerfil[perfil.id];
    const carregado = !!permsDoPerfil;
    const porModulo = Object.entries(modulosCatalogo).map(([modulo, perms]) => ({
      modulo,
      label: MODULO_LABEL_CURTO[(modulo || '').toUpperCase()] || modulo,
      ativos: carregado ? perms.filter(p => permsDoPerfil.includes(p.permissaoId)).length : 0,
      total: perms.length,
    }));
    const agendaPerm = (permissoes || []).find(p => p.codigo === 'AGENDA_APARECER');
    const atendeNaAgenda = carregado
      ? Boolean(agendaPerm && permsDoPerfil.includes(agendaPerm.permissaoId))
      : ((perfil.codigo || '').toUpperCase() === 'PROFISSIONAL_CLINICO' || (perfil.codigo || '').toUpperCase() === 'DONO');
    return {
      carregado,
      total: carregado ? permsDoPerfil.length : null,
      porModulo,
      membros: (usuarios || []).filter(u => String(u.perfilAcessoId) === String(perfil.id)).length,
      atendeNaAgenda,
    };
  };

  // Clique em "Editar"/"Criar perfil a partir deste": Níveis globais vão direto pro fluxo de
  // criação (não são editáveis diretamente); perfis já customizados mostram a escolha.
  const handleEditarClick = async (perfil) => {
    if (isPerfilGlobal(perfil)) {
      setCarregandoEscolha(true);
      try {
        const permissoesAtuais = await buscarPermissoesAtuais(perfil.id);
        setEditingPerfil(null);
                setFormData({
          nome: perfil.nome || '',
          descricao: perfil.descricao || '',
        });
        setSelectedPermissoes(permissoesAtuais);
        setPerfilBaseCriacao(perfil.nome);
        setWizardStep(1);
        setShowModal(true);
      } finally {
        setCarregandoEscolha(false);
      }
      return;
    }
    setPerfilEscolha(perfil);
  };

  const handleEscolherCriarNovo = async (nomeNovo) => {
    const perfilOrigem = perfilEscolha;
    setCarregandoEscolha(true);
    try {
      const permissoesAtuais = await buscarPermissoesAtuais(perfilOrigem.id);
      setPerfilEscolha(null);
      setEditingPerfil(null);
          setFormData({
        nome: nomeNovo,
        descricao: perfilOrigem.descricao || '',
      });
      setSelectedPermissoes(permissoesAtuais);
      setPerfilBaseCriacao(perfilOrigem.nome);
      setWizardStep(1);
      setShowModal(true);
    } finally {
      setCarregandoEscolha(false);
    }
  };

  const handleEscolherEditarExistente = () => {
    const perfil = perfilEscolha;
    setPerfilEscolha(null);
    openEdit(perfil);
  };

  useEffect(() => {
    if (!perfilParaAbrir) return;
    const perfil = (perfisAcesso || []).find(p => String(p.id) === String(perfilParaAbrir));
    if (perfil) handleEditarClick(perfil);
    onPerfilParaAbrirConsumido?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfilParaAbrir]);

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
        headers: await fetchHeaders(),
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
    } catch {
      toast.error('Falha de rede ao excluir perfil.');
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!formData.nome.trim()) return toast.error('O nome do perfil é obrigatório.');
    if (wizardStep === 1) {
      setWizardStep(2);
      return;
    }
    salvarPerfil();
  };

  const handleToggleModulo = (permissaoIds, marcar) => {
    setSelectedPermissoes(prev => marcar
      ? Array.from(new Set([...prev, ...permissaoIds]))
      : prev.filter(id => !permissaoIds.includes(id)));
  };

  const salvarPerfil = async () => {
    setSaving(true);
    try {
      const url = editingPerfil 
        ? resolveApiUrl(`/api/v1/perfis-acesso/${editingPerfil.id}`)
        : resolveApiUrl('/api/v1/perfis-acesso');
        
      const method = editingPerfil ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { ...(await fetchHeaders()), 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        const savedPerfil = await res.json();
        const perfilId = savedPerfil.id;

        const putRes = await fetch(resolveApiUrl(`/api/v1/perfis-acesso/${perfilId}/permissoes`), {
          method: 'PUT',
          headers: { ...(await fetchHeaders()), 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(selectedPermissoes)
        });

        if (!putRes.ok) {
           toast.error('Perfil salvo, mas houve erro ao atribuir permissões.');
        } else {
           toast.success(`Perfil ${editingPerfil ? 'atualizado' : 'criado'} com sucesso!`);
        }

        fecharModal();
        onReload();
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(getApiErrorDetail({ body }) || 'Erro ao salvar perfil.');
      }
    } catch {
      toast.error('Falha de rede ao salvar perfil.');
    } finally {
      setSaving(false);
    }
  };

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
              {customizados.map(p => {
                const resumo = getResumoPerfil(p);
                return (
                <div key={p.id} className="flex flex-col bg-white border border-teal-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <h6 className="font-bold text-slate-900 text-base">{p.nome}</h6>
                    <span className="shrink-0 bg-slate-50 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-100 tabular-nums">
                      {resumo.carregado ? `${resumo.total}/${permissoes.length}` : '…'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3 min-h-[2.4em] line-clamp-2">{p.descricao || 'Sem descrição.'}</p>

                  <div className="mb-4 flex flex-wrap gap-1.5 items-center">
                    <span className="inline-flex items-center gap-1.5 bg-teal-50 text-teal-700 text-xs font-semibold px-2.5 py-1 rounded-md">
                      {resumo.carregado ? `${resumo.total} funções habilitadas` : 'Carregando...'}
                    </span>
                    {resumo.atendeNaAgenda ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2 py-0.5 rounded border border-emerald-200">
                        📅 Atende na Agenda
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-[11px] font-bold px-2 py-0.5 rounded border border-slate-200">
                        🚫 Sem Agenda
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-50 pt-3 mt-auto mb-3">
                    <span className={`text-[11px] ${resumo.membros === 0 ? 'font-semibold text-slate-400' : 'text-slate-500'}`}>
                      {resumo.membros === 0 ? 'Sem membros' : `${resumo.membros} membro${resumo.membros > 1 ? 's' : ''}`}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => handleEditarClick(p)} className="flex-1 flex justify-center items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 py-2 rounded-lg transition-colors">
                      <Edit2 className="h-3.5 w-3.5" /> Editar
                    </button>
                    <button onClick={() => confirmDelete(p)} className="flex-none flex justify-center items-center gap-1.5 text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Perfis Globais */}
        <div className="pt-4">
          <h5 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 ml-1">Templates Globais do Sistema</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...globais].sort((a,b) => {
              const orderA = CODIGO_ORDER[(a.codigo||'').toUpperCase()] || 99;
              const orderB = CODIGO_ORDER[(b.codigo||'').toUpperCase()] || 99;
              return orderA - orderB;
            }).map(p => {
              const isDono = (p.codigo || '').toUpperCase() === 'DONO';
              const resumo = getResumoPerfil(p);
              return (
                <div key={p.id} className="flex flex-col bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <h6 className="font-bold text-slate-700 text-base flex items-center gap-1.5">
                      {isDono ? <Crown className="h-4 w-4 text-amber-500" /> : <Shield className="h-4 w-4 text-slate-400" />}
                      {p.nome}
                    </h6>
                    <span className="shrink-0 bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded tabular-nums">
                      {resumo.carregado ? `${resumo.total}/${permissoes.length}` : '…'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-3 min-h-[2.4em]">{p.descricao || 'Nível de acesso nativo do sistema.'}</p>

                  <div className="mb-4 flex flex-wrap gap-1.5 items-center">
                    <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-1 rounded-md">
                      {resumo.carregado ? `${resumo.total} funções habilitadas` : 'Carregando...'}
                    </span>
                    {resumo.atendeNaAgenda ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2 py-0.5 rounded border border-emerald-200">
                        📅 Atende na Agenda
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-[11px] font-bold px-2 py-0.5 rounded border border-slate-200">
                        🚫 Sem Agenda
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/70 pt-3 mt-auto mb-3">
                    <span className={`text-[11px] ${resumo.membros === 0 ? 'font-semibold text-slate-400' : 'text-slate-500'}`}>
                      {resumo.membros === 0 ? 'Sem membros' : `${resumo.membros} membro${resumo.membros > 1 ? 's' : ''}`}
                    </span>
                  </div>

                  {!isDono && (
                    <button
                      onClick={() => handleEditarClick(p)}
                      disabled={carregandoEscolha}
                      className="flex justify-center items-center gap-1.5 text-xs font-semibold text-teal-700 bg-white border border-teal-200 hover:bg-teal-50 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Edit2 className="h-3.5 w-3.5" /> Criar perfil a partir deste
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showModal && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-4xl bg-white rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-4 shrink-0">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {editingPerfil ? 'Editar Perfil' : 'Novo Perfil'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Passo {wizardStep} de 2</p>
                {perfilBaseCriacao && (
                  <p className="text-xs text-slate-500 mt-0.5">Criando a partir de "{perfilBaseCriacao}" — as permissões já vêm marcadas, ajuste como quiser.</p>
                )}
              </div>
              <button onClick={fecharModal} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Indicador de passos */}
            <div className="flex items-center gap-3 mb-6 shrink-0">
              <div className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${wizardStep === 1 ? 'bg-gradient-to-r from-[#00a88e] to-teal-500 text-white' : 'bg-teal-50 text-teal-700 border border-teal-200'}`}>1</span>
                <span className={`text-xs font-semibold ${wizardStep === 1 ? 'text-slate-900' : 'text-slate-500'}`}>Dados do perfil</span>
              </div>
              <div className="h-px flex-1 max-w-16 bg-slate-200 relative overflow-hidden rounded-full">
                <div className={`absolute inset-0 bg-teal-500 origin-left transition-transform duration-300 ${wizardStep === 2 ? 'scale-x-100' : 'scale-x-0'}`} />
              </div>
              <div className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${wizardStep === 2 ? 'bg-gradient-to-r from-[#00a88e] to-teal-500 text-white' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>2</span>
                <span className={`text-xs font-semibold ${wizardStep === 2 ? 'text-slate-900' : 'text-slate-500'}`}>Permissões</span>
              </div>
            </div>

            <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0">
              {wizardStep === 1 ? (
                <div className="w-full max-w-md mx-auto space-y-4 py-2 flex-1 min-h-0 overflow-y-auto">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-teal-700 mb-1.5 ml-1">Nome do Perfil</label>
                    <input
                      required
                      maxLength={50}
                      autoFocus
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

                  <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3.5 text-xs text-teal-900 flex items-start gap-2.5">
                    <span className="text-base leading-none">💡</span>
                    <div>
                      <p className="font-semibold text-slate-800">Atendimento na Agenda</p>
                      <p className="text-slate-600 mt-0.5">
                        A permissão para atender e aparecer na agenda (<code className="font-mono font-bold text-teal-800">AGENDA_APARECER</code>) agora é configurada no <strong>Passo 2</strong>, dentro do módulo <strong>Agenda</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col flex-1 min-h-0">
                  <div className="flex justify-between items-end mb-4 shrink-0">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Permissões de Acesso</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Clique em "Ver" em cada módulo para configurar suas funções — a visualização daquele módulo já é liberada automaticamente.</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar pb-4">
                    <PermissoesPorModuloPanel
                      permissoes={permissoes}
                      selecionadas={selectedPermissoes}
                      loading={loadingPermissoes}
                      columns={3}
                      showModuloActions
                      onToggleModulo={handleToggleModulo}
                      onChange={(permissaoId, checked) => {
                        setSelectedPermissoes(prev => checked ? [...prev, permissaoId] : prev.filter(id => id !== permissaoId));
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="pt-5 mt-4 flex justify-between items-center border-t border-slate-100 shrink-0">
                <div>
                  {wizardStep === 2 && (
                    <button type="button" onClick={() => setWizardStep(1)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                      ← Voltar
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={fecharModal} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#00a88e] to-teal-500 text-white text-sm font-bold shadow-lg shadow-teal-500/30 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center gap-2"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {wizardStep === 1 ? 'Continuar →' : (saving ? 'Salvando...' : 'Salvar Alterações')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showDeleteModal && perfilToDelete && createPortal(
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
        </div>,
        document.body
      )}

      {perfilEscolha && (
        <PermissoesCustomizadasModal
          perfilNome={perfilEscolha.nome}
          saving={carregandoEscolha}
          onClose={() => setPerfilEscolha(null)}
          onCriarNovo={handleEscolherCriarNovo}
          onEditarExistente={handleEscolherEditarExistente}
        />
      )}
    </div>
  );
}
