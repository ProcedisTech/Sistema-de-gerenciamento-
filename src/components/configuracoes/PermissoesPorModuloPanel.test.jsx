import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PermissoesPorModuloPanel } from './PermissoesPorModuloPanel';
import { MODULO_LABEL_CURTO } from './gestaoUsuariosUtils';

describe('PermissoesPorModuloPanel', () => {
  const mockPermissoes = [
    // Agenda
    { permissaoId: 'p-agenda-ver', codigo: 'AGENDA_VER', nome: 'Visualizar Agenda', modulo: 'Agenda', descricao: 'Permite visualizar os horários' },
    { permissaoId: 'p-agenda-propria', codigo: 'AGENDA_PROPRIA_VER', nome: 'Visualizar Agenda Própria', modulo: 'Agenda', descricao: 'Permite ao profissional clínico visualizar sua própria grade' },
    { permissaoId: 'p-agenda-excluir', codigo: 'AGENDA_EXCLUIR', nome: 'Cancelamento de Agendamento do Paciente', modulo: 'Agenda', descricao: 'Permite cancelar agendamentos' },
    { permissaoId: 'p-agenda-multi', codigo: 'AGENDA_MULTI_VER', nome: 'Visualizar Grade de Todos os Profissionais', modulo: 'Agenda', descricao: 'Permite ver todas as colunas' },
    
    // Prontuário
    { permissaoId: 'p-prontuario-ver', codigo: 'PRONTUARIO_VER', nome: 'Ver Prontuário Clínico', modulo: 'Prontuário', descricao: 'Permite acessar prontuário' },
    { permissaoId: 'p-prontuario-criar', codigo: 'PRONTUARIO_CRIAR', nome: 'Lançar Procedimento', modulo: 'Prontuário', descricao: 'Permite lançar procedimentos' },
    { permissaoId: 'p-galeria-ver', codigo: 'PACIENTE_GALERIA_VER', nome: 'Ver Fotos em Anexo do Paciente', modulo: 'Prontuário', descricao: 'Permite acessar fotos em anexo' },
    { permissaoId: 'p-anamnese-ver', codigo: 'ANAMNESE_PREENCHIMENTO_VER', nome: 'Ver Anamnese do Paciente', modulo: 'Prontuário', descricao: 'Permite ver fichas preenchidas' },

    // Atendimento
    { permissaoId: 'p-atend-criar', codigo: 'ANAMNESE_PREENCHIMENTO_CRIAR', nome: 'Realizar Atendimento', modulo: 'Atendimento', descricao: 'Permite iniciar e realizar atendimento' },
    { permissaoId: 'p-hub-aval', codigo: 'HUB_AVALIACAO_VER', nome: 'Acessar Avaliação e Fotos Iniciais', modulo: 'Atendimento', descricao: 'Permite acessar avaliação' },
    { permissaoId: 'p-hub-anamnese', codigo: 'HUB_ANAMNESE_VER', nome: 'Acessar Anamnese no Atendimento', modulo: 'Atendimento', descricao: 'Permite acessar anamnese' },
    { permissaoId: 'p-hub-termos', codigo: 'HUB_TERMOS_VER', nome: 'Acessar Termos de Consentimento', modulo: 'Atendimento', descricao: 'Permite acessar termos' },
    { permissaoId: 'p-hub-proc', codigo: 'HUB_PROCEDIMENTO_EXECUTAR', nome: 'Executar e Registrar Procedimento Clínico', modulo: 'Atendimento', descricao: 'Permite executar procedimentos' },
    { permissaoId: 'p-hub-orient', codigo: 'HUB_ORIENTACAO_VER', nome: 'Acessar Orientações Pós-Procedimento', modulo: 'Atendimento', descricao: 'Permite acessar orientações' },
  ];

  it('no módulo Prontuário, oculta apenas PRONTUARIO_VER e mantém visíveis Ver Fotos em Anexo e Ver Anamnese do Paciente', () => {
    const handleChange = vi.fn();

    render(
      <PermissoesPorModuloPanel
        permissoes={mockPermissoes}
        selecionadas={[]}
        onChange={handleChange}
      />
    );

    // Abre o módulo Prontuário
    const botoesVer = screen.getAllByRole('button', { name: /ver/i });
    // O segundo botão "Ver" corresponde ao Prontuário
    fireEvent.click(botoesVer[1]);

    // PRONTUARIO_VER foi auto-marcado ao abrir o módulo
    expect(handleChange).toHaveBeenCalledWith('p-prontuario-ver', true);

    // PRONTUARIO_VER não aparece como checkbox visível
    expect(screen.queryByText('Ver Prontuário Clínico')).not.toBeInTheDocument();

    // PACIENTE_GALERIA_VER e ANAMNESE_PREENCHIMENTO_VER aparecem como checkboxes visíveis
    expect(screen.getByText('Ver Fotos em Anexo do Paciente')).toBeInTheDocument();
    expect(screen.getByText('Ver Anamnese do Paciente')).toBeInTheDocument();
    expect(screen.getByText('Lançar Procedimento')).toBeInTheDocument();
  });

  it('no módulo Atendimento, todas as 6 permissões ficam visíveis e nenhuma é ocultada', () => {
    const handleChange = vi.fn();

    render(
      <PermissoesPorModuloPanel
        permissoes={mockPermissoes}
        selecionadas={[]}
        onChange={handleChange}
      />
    );

    // Abre o módulo Atendimento (terceiro botão Ver)
    const botoesVer = screen.getAllByRole('button', { name: /ver/i });
    fireEvent.click(botoesVer[2]);

    // Nenhuma permissão de atendimento é auto-marcada como raiz oculta
    expect(handleChange).not.toHaveBeenCalled();

    // Todas as 6 etapas aparecem visíveis
    expect(screen.getByText('Realizar Atendimento')).toBeInTheDocument();
    expect(screen.getByText('Acessar Avaliação e Fotos Iniciais')).toBeInTheDocument();
    expect(screen.getByText('Acessar Anamnese no Atendimento')).toBeInTheDocument();
    expect(screen.getByText('Acessar Termos de Consentimento')).toBeInTheDocument();
    expect(screen.getByText('Executar e Registrar Procedimento Clínico')).toBeInTheDocument();
    expect(screen.getByText('Acessar Orientações Pós-Procedimento')).toBeInTheDocument();
  });

  it('no módulo Agenda, exibe Cancelamento de Agendamento do Paciente para AGENDA_EXCLUIR e auto-marca AGENDA_VER e AGENDA_PROPRIA_VER de forma invisível ao abrir', () => {
    const handleChange = vi.fn();

    render(
      <PermissoesPorModuloPanel
        permissoes={mockPermissoes}
        selecionadas={[]}
        onChange={handleChange}
      />
    );

    // Abre o módulo Agenda (primeiro botão Ver)
    const botoesVer = screen.getAllByRole('button', { name: /ver/i });
    fireEvent.click(botoesVer[0]);

    // AGENDA_VER e AGENDA_PROPRIA_VER foram auto-marcados
    expect(handleChange).toHaveBeenCalledWith('p-agenda-ver', true);
    expect(handleChange).toHaveBeenCalledWith('p-agenda-propria', true);

    // AGENDA_VER e AGENDA_PROPRIA_VER não aparecem como checkboxes (raízes invisíveis para evitar erro do usuário)
    expect(screen.queryByText('Visualizar Agenda')).not.toBeInTheDocument();
    expect(screen.queryByText('Visualizar Agenda Própria')).not.toBeInTheDocument();

    // AGENDA_EXCLUIR renomeado para Cancelamento de Agendamento do Paciente aparece visível
    expect(screen.getByText('Cancelamento de Agendamento do Paciente')).toBeInTheDocument();

    // AGENDA_MULTI_VER também fica visível
    expect(screen.getByText('Visualizar Grade de Todos os Profissionais')).toBeInTheDocument();
  });

  it('ao abrir o módulo Agenda com onToggleModulo, passa idsRaiz (AGENDA_VER e AGENDA_PROPRIA_VER) juntos em lote', () => {
    const handleToggleModulo = vi.fn();

    render(
      <PermissoesPorModuloPanel
        permissoes={mockPermissoes}
        selecionadas={[]}
        onChange={vi.fn()}
        onToggleModulo={handleToggleModulo}
      />
    );

    const botoesVer = screen.getAllByRole('button', { name: /ver/i });
    fireEvent.click(botoesVer[0]);

    expect(handleToggleModulo).toHaveBeenCalledWith(['p-agenda-ver', 'p-agenda-propria'], true);
  });

  it('ao recolher e reabrir o módulo Agenda, mantém as permissões raízes invisíveis seguras', () => {
    const handleToggleModulo = vi.fn();

    render(
      <PermissoesPorModuloPanel
        permissoes={mockPermissoes}
        selecionadas={['p-agenda-ver', 'p-agenda-propria']}
        onChange={vi.fn()}
        onToggleModulo={handleToggleModulo}
      />
    );

    // Primeiro clique abre o módulo Agenda
    const btnVer = screen.getAllByRole('button', { name: /ver/i })[0];
    fireEvent.click(btnVer);
    expect(handleToggleModulo).toHaveBeenCalledWith(['p-agenda-ver', 'p-agenda-propria'], true);
    handleToggleModulo.mockClear();

    // Segundo clique oculta o módulo Agenda
    const btnOcultar = screen.getByRole('button', { name: /ocultar/i });
    fireEvent.click(btnOcultar);
    expect(handleToggleModulo).not.toHaveBeenCalled();

    // Terceiro clique reabre o módulo Agenda
    const btnReabrir = screen.getAllByRole('button', { name: /ver/i })[0];
    fireEvent.click(btnReabrir);
    expect(handleToggleModulo).toHaveBeenCalledWith(['p-agenda-ver', 'p-agenda-propria'], true);
  });

  it('em modo disabled (somente leitura), exibe todas as permissões incluindo as raízes', () => {
    render(
      <PermissoesPorModuloPanel
        permissoes={mockPermissoes}
        selecionadas={['p-agenda-ver', 'p-prontuario-ver']}
        onChange={vi.fn()}
        disabled={true}
      />
    );

    // Todas as raízes e funcionais são visíveis em modo preview
    expect(screen.getByText('Visualizar Agenda')).toBeInTheDocument();
    expect(screen.getByText('Ver Prontuário Clínico')).toBeInTheDocument();
    expect(screen.getByText('Ver Fotos em Anexo do Paciente')).toBeInTheDocument();
    expect(screen.getByText('Realizar Atendimento')).toBeInTheDocument();
  });

  it('MODULO_LABEL_CURTO mapeia corretamente Atendimento e módulos acentuados', () => {
    expect(MODULO_LABEL_CURTO.ATENDIMENTO).toBe('Atendimento');
    expect(MODULO_LABEL_CURTO['PRONTUÁRIO']).toBe('Pront.');
    expect(MODULO_LABEL_CURTO['CATÁLOGO']).toBe('Catál.');
    expect(MODULO_LABEL_CURTO['CLÍNICA']).toBe('Clínica');
    expect(MODULO_LABEL_CURTO['EQUIPE']).toBe('Equipe');
    expect(MODULO_LABEL_CURTO['SISTEMA']).toBe('Sistema');
  });
});
