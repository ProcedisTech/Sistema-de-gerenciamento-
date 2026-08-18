import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { AlertasClinicosPanel } from './AlertasClinicosPanel.jsx';

const resumoCritico = {
  temVigente: true,
  vigenteEm: '2026-08-18T12:00:00Z',
  vigenteAssinada: true,
  alergiasAlimentares: [
    { id: '1', nome: 'Camarão' },
    { id: '2', nome: 'Iogurte, natural' },
    { id: '3', nome: 'Peixe (genérico)' },
    { id: '4', nome: 'Mel, de abelha' },
  ],
  alergiasPrincipioAtivo: [
    { id: '5', nome: 'bupropiona' },
    { id: '6', nome: 'dipirona' },
    { id: '7', nome: 'prednisolona' },
  ],
  medicamentosEmUso: [
    { id: '8', nome: 'Losartana' },
    { id: '9', nome: 'Dipirona (Novalgina)' },
    { id: '10', nome: 'Fluoxetina (Prozac)' },
  ],
  condicoesSaude: [
    { id: '11', nome: 'Asma predominantemente alérgica' },
    { id: '12', nome: 'Hipertensão essencial (primária)' },
  ],
  declaracoesCriticas: [
    'Tem dificuldade em abrir a boca',
    'Possui prótese cardíaca ou marca-passo',
  ],
  declaracoesDemais: [
    'Sente dores no ouvido, cabeça, face, nuca ou pescoço',
    'Frequentemente sente a boca seca',
    'Tem dor de dente',
  ],
  historicoFamiliar: ['Infarto'],
  historico: [
    { natureza: 'Alergia alimentar', texto: 'Ovo' },
    { natureza: 'Medicamento em uso', texto: 'Omeprazol' },
    { natureza: 'Anamnese', texto: 'Range os dentes à noite' },
  ],
};

const resumoSemCriticos = {
  temVigente: true,
  vigenteEm: '2026-08-18T12:00:00Z',
  vigenteAssinada: false,
  alergiasAlimentares: [],
  alergiasPrincipioAtivo: [],
  medicamentosEmUso: [{ id: '8', nome: 'Losartana' }],
  condicoesSaude: [{ id: '11', nome: 'Asma predominantemente alérgica' }],
  declaracoesCriticas: [],
  declaracoesDemais: [],
  historicoFamiliar: [],
  historico: [],
};

function renderHub(props = {}) {
  return render(<AlertasClinicosPanel variant="hub" {...props} />);
}

describe('AlertasClinicosPanel (hub)', () => {
  it('estado com críticos: contadores por natureza, selo textual e data da anamnese', () => {
    const { container } = renderHub({ resumo: resumoCritico });

    expect(screen.getByRole('group', { name: 'Resumo clínico do paciente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /4 Alergia alimentar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3 Alergia a princípio ativo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3 Medicamento em uso/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2 Condição de saúde/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /5 Declarado na anamnese/i })).toBeInTheDocument();
    expect(screen.getByText('9 críticos')).toBeInTheDocument();
    expect(screen.getByText(/18\/08/)).toBeInTheDocument();
    expect(screen.getByText(/assinada/)).toBeInTheDocument();
    expect(container.firstChild.className).toContain('border-[#fecdd3]');
    expect(screen.queryByText(/não confirmado pela clínica/)).not.toBeInTheDocument();
  });

  it('teclado abre e fecha uma natureza; uma de cada vez', async () => {
    const user = userEvent.setup();
    renderHub({ resumo: resumoCritico });

    const alimentar = screen.getByRole('button', { name: /4 Alergia alimentar/i });
    expect(alimentar).toHaveAttribute('aria-expanded', 'false');

    await user.click(alimentar);
    expect(alimentar).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Camarão')).toBeInTheDocument();
    expect(screen.getByText('confira antes do procedimento')).toBeInTheDocument();

    const pa = screen.getByRole('button', { name: /3 Alergia a princípio ativo/i });
    await user.click(pa);
    expect(pa).toHaveAttribute('aria-expanded', 'true');
    expect(alimentar).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Camarão')).not.toBeInTheDocument();
    expect(screen.getByText('dipirona')).toBeInTheDocument();

    await user.click(pa);
    expect(pa).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('dipirona')).not.toBeInTheDocument();
  });

  it('Ver tudo agrega as naturezas e desliga ao clicar um contador', async () => {
    const user = userEvent.setup();
    renderHub({ resumo: resumoCritico });

    const verTudo = screen.getByRole('button', { name: /Ver tudo/i });
    expect(verTudo).toHaveAttribute('aria-expanded', 'false');

    await user.click(verTudo);
    expect(verTudo).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Alergia alimentar')).toBeInTheDocument();
    expect(screen.getByText('Alergia a princípio ativo')).toBeInTheDocument();
    expect(screen.getByText('Medicamento em uso')).toBeInTheDocument();
    expect(screen.getByText('Condição de saúde')).toBeInTheDocument();
    expect(screen.getByText('Declarado na anamnese')).toBeInTheDocument();
    expect(screen.getByText('Tem dificuldade em abrir a boca')).toBeInTheDocument();
    expect(screen.getByText('demais declarações')).toBeInTheDocument();
    expect(screen.getByText('Histórico familiar:')).toBeInTheDocument();
    expect(screen.getByText(/Infarto/)).toBeInTheDocument();

    const med = screen.getByRole('button', { name: /3 Medicamento em uso/i });
    await user.click(med);
    expect(verTudo).toHaveAttribute('aria-expanded', 'false');
    expect(med).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText('Alergia alimentar')).not.toBeInTheDocument();
    expect(screen.getByText('Losartana')).toBeInTheDocument();
  });

  it('histórico colapsado traz o não repetido com o texto canônico', async () => {
    const user = userEvent.setup();
    renderHub({ resumo: resumoCritico });

    await user.click(screen.getByRole('button', { name: /Ver tudo/i }));
    const hist = screen.getByRole('button', { name: /Histórico — não consta na anamnese vigente/i });
    expect(hist).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Ovo')).not.toBeInTheDocument();

    await user.click(hist);
    expect(hist).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Ovo')).toBeInTheDocument();
    expect(screen.getByText('Omeprazol')).toBeInTheDocument();
    expect(
      screen.getByText('Continuam registrados no prontuário. Não constam na anamnese vigente.')
    ).toBeInTheDocument();
  });

  it('zerado permanece visível (apagado) — 0 alergias é informação clínica', () => {
    const { container } = renderHub({ resumo: resumoSemCriticos });

    const zero = screen.getByRole('button', { name: /0 Alergia alimentar/i });
    expect(zero).toBeInTheDocument();
    expect(zero.className).toContain('opacity-50');
    expect(screen.getByText('sem críticos')).toBeInTheDocument();
    expect(container.firstChild.className).toContain('border-[#99f6e4]');
    expect(screen.getByText(/finalizada/)).toBeInTheDocument();
  });

  it('sem anamnese: estado neutro, copy literal e CTA', async () => {
    const user = userEvent.setup();
    const onSolicitar = vi.fn();
    const { container } = renderHub({
      resumo: { temVigente: false },
      onSolicitarAnamnese: onSolicitar,
    });

    expect(
      screen.getByText('Nenhuma anamnese preenchida.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Solicite o preenchimento antes de qualquer procedimento/)
    ).toBeInTheDocument();
    expect(container.firstChild.className).toContain('border-[#e2e8f0]');
    expect(container.firstChild.className).not.toContain('border-[#99f6e4]');
    expect(screen.queryByText(/sem críticos/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Solicitar anamnese' }));
    expect(onSolicitar).toHaveBeenCalledTimes(1);
  });
});
