import { useState, useEffect, useCallback } from 'react';
import { catalogoApi, clinicaProcedimentoApi, getApiErrorToastMessage } from '../services/api';
import { useToast } from '../contexts/useToast';
import { useOrg } from '../contexts/OrgContext';

export function useBancoProcedimentos() {
  const toast = useToast();
  const { orgId } = useOrg();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [catalogo, setCatalogo] = useState([]); // Todos os procedimentos canônicos
  const [vinculos, setVinculos] = useState([]); // Procedimentos vinculados à clínica

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      // Busca em paralelo
      const [catalogoRes, vinculosRes] = await Promise.all([
        catalogoApi.listar(),
        clinicaProcedimentoApi.listar(),
      ]);
      setCatalogo(catalogoRes);
      setVinculos(vinculosRes);
    } catch (e) {
      setError(getApiErrorToastMessage(e, 'Erro ao carregar dados do banco de procedimentos.'));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const vincular = useCallback(async (catalogoProcedimentoId) => {
    // Busca o procedimento no catálogo para fazer o update otimista
    const proc = catalogo.find(p => p.id === catalogoProcedimentoId);
    if (!proc) return;

    const mockVinculo = {
      id: `temp-${Math.random()}`,
      catalogoProcedimentoId: proc.id,
      nome: proc.nome,
      tipoCodigo: proc.tipoCodigo,
      descricao: proc.descricao,
    };

    // Update otimista
    setVinculos(prev => [...prev, mockVinculo]);

    try {
      const res = await clinicaProcedimentoApi.vincular(catalogoProcedimentoId);
      // Substitui o mock pelo dado real retornado (que contém o ID real do vínculo)
      setVinculos(prev => prev.map(v => v.id === mockVinculo.id ? res : v));
      toast.success('Procedimento vinculado com sucesso.');
    } catch (e) {
      // Rollback em caso de erro
      setVinculos(prev => prev.filter(v => v.id !== mockVinculo.id));
      toast.error(getApiErrorToastMessage(e, 'Erro ao vincular procedimento.'));
    }
  }, [catalogo, toast]);

  const desvincular = useCallback(async (vinculoId) => {
    const previousVinculos = vinculos;
    // Update otimista
    setVinculos(prev => prev.filter(v => v.id !== vinculoId));

    try {
      await clinicaProcedimentoApi.desvincular(vinculoId);
      toast.success('Procedimento removido com sucesso.');
    } catch (e) {
      // Rollback em caso de erro
      setVinculos(previousVinculos);
      toast.error(getApiErrorToastMessage(e, 'Erro ao remover procedimento.'));
    }
  }, [vinculos, toast]);

  return {
    loading,
    error,
    catalogo,
    vinculos,
    vincular,
    desvincular,
    refetch: fetchData,
  };
}
