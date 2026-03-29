import { useState } from 'react';

export const usePatientState = () => {
  const [patients, setPatients] = useState(() => {
    return [
      {
        id: 'patient_seed_1',
        nome: 'Ana Carolina Silva',
        dataNascimento: '1991-03-27',
        idade: 35,
        sexo: 'f',
        estadoCivil: 'solteiro',
        profissao: 'Advogada',
        alergias: 'Penicilina, Látex',
        cpf: '123.456.789-00',
        rg: '12.345.678-9',
        telefone: '(11) 98765-4321',
        email: 'ana.silva@email.com',
        endereco: 'Rua das Flores, 123 - Jardins, São Paulo - SP',
        instagram: '@anacarolina',
        status: 'ativo',
        ultimaVisita: '15/02/2026',
        proximoRetorno: '15/03/2026',
        saldoDevedor: 1200,
        lgpdAssinado: true,
        lgpdRenovacao: '15/05/2027',
        medicamentos: ['Anticoncepcional Oral', 'Vitamina D'],
        condicoesSaude: 'Enxaqueca ocasional',
        queixasEsteticas: ['Linhas de expressão', 'Volume labial'],
        cirurgiasAnteriores: 'Rinoplastia (2018)',
        observacoesImportantes: 'Paciente sensível a agulhas - usar anestésico tópico sempre',
        procedures: [
          { data: '15/02/2026', hora: '14:30', nome: 'Botox + Preenchimento Labial', profissional: 'Dr. Roberto Silva', valor: 2450 },
          { data: '10/11/2025', hora: '10:00', nome: 'Avaliação para Harmonização Facial', profissional: 'Dr. Roberto Silva', valor: 0 },
          { data: '05/08/2025', hora: '09:30', nome: 'Bioestimulador', profissional: 'Dra. Mariana Costa', valor: 1800 },
        ],
        notas: [
          { texto: 'Paciente sensível a agulhas - usar anestésico tópico sempre', autor: 'Dr. Roberto Silva', data: '05/08/2025' },
          { texto: 'Preferência por atendimentos no período da tarde', autor: 'Recepção', data: '10/11/2025' },
        ],
        documentos: [
          { nome: 'Termo de Consentimento LGPD', data: '05/08/2025', hora: '10:45', tipo: 'Assinatura digital', status: 'vigente' },
          { nome: 'Contrato de Tratamento', data: '05/08/2025', hora: '10:50', tipo: 'Assinatura digital', status: 'vigente' },
          { nome: 'Termo de Responsabilidade - Botox', data: '15/02/2026', hora: '14:15', tipo: 'Assinatura digital', status: 'vigente' },
        ],
        galeria: [
          { sessao: 'Sessão 3 - Fev/2026', procedimento: 'Botox + Preenchimento', data: '15/02/2026', fotos: [{ label: 'Antes', url: null }, { label: 'Planejamento', url: null }, { label: 'Depois', url: null }] },
          { sessao: 'Sessão 2 - Nov/2025', procedimento: 'Avaliação Inicial', data: '10/11/2025', fotos: [{ label: 'Antes', url: null }] },
          { sessao: 'Sessão 1 - Ago/2025', procedimento: 'Bioestimulador', data: '05/08/2025', fotos: [{ label: 'Antes', url: null }] },
        ],
      },
      {
        id: 'patient_seed_2',
        nome: 'Mariana Costa',
        dataNascimento: '1998-07-14',
        idade: 28,
        sexo: 'f',
        estadoCivil: 'solteiro',
        profissao: 'Designer',
        alergias: 'Nenhuma',
        cpf: '234.567.890-11',
        rg: '23.456.789-0',
        telefone: '(11) 91234-5678',
        email: 'mariana.costa@email.com',
        endereco: 'Av. Paulista, 456 - Bela Vista, São Paulo - SP',
        instagram: '@marianacosta',
        status: 'ativo',
        ultimaVisita: '22/02/2026',
        proximoRetorno: '22/03/2026',
        saldoDevedor: 0,
        lgpdAssinado: true,
        lgpdRenovacao: '22/02/2027',
        medicamentos: [],
        condicoesSaude: '',
        queixasEsteticas: ['Sobrancelha assimétrica', 'Pele opaca'],
        cirurgiasAnteriores: '',
        observacoesImportantes: '',
        procedures: [
          { data: '22/02/2026', hora: '10:00', nome: 'Skinbooster', profissional: 'Dra. Mariana Costa', valor: 1200 },
          { data: '10/12/2025', hora: '11:00', nome: 'Design de Sobrancelha', profissional: 'Dra. Mariana Costa', valor: 800 },
        ],
        notas: [],
        documentos: [
          { nome: 'Termo de Consentimento LGPD', data: '10/12/2025', hora: '11:05', tipo: 'Assinatura digital', status: 'vigente' },
        ],
        galeria: [
          { sessao: 'Sessão 2 - Fev/2026', procedimento: 'Skinbooster', data: '22/02/2026', fotos: [{ label: 'Antes', url: null }, { label: 'Depois', url: null }] },
        ],
      },
      {
        id: 'patient_seed_3',
        nome: 'Patricia Oliveira',
        dataNascimento: '1984-09-02',
        idade: 42,
        sexo: 'f',
        estadoCivil: 'casado',
        profissao: 'Empresária',
        alergias: 'Nenhuma',
        cpf: '345.678.901-22',
        rg: '34.567.890-1',
        telefone: '(11) 99876-5432',
        email: 'patricia.oli@email.com',
        endereco: 'Rua Augusta, 789 - Consolação, São Paulo - SP',
        instagram: '@patriciaoli',
        status: 'ativo',
        ultimaVisita: '01/03/2026',
        proximoRetorno: '01/04/2026',
        saldoDevedor: 0,
        lgpdAssinado: true,
        lgpdRenovacao: '01/03/2027',
        medicamentos: ['Vitamina C'],
        condicoesSaude: 'Hipertensão controlada',
        queixasEsteticas: ['Flacidez facial', 'Manchas'],
        cirurgiasAnteriores: 'Blefaroplastia (2020)',
        observacoesImportantes: '',
        procedures: [
          { data: '01/03/2026', hora: '09:00', nome: 'Botox Preventivo', profissional: 'Dr. Roberto Silva', valor: 1500 },
          { data: '10/12/2025', hora: '14:00', nome: 'Skinbooster', profissional: 'Dra. Mariana Costa', valor: 1200 },
          { data: '15/09/2025', hora: '10:00', nome: 'Harmonização Facial', profissional: 'Dr. Roberto Silva', valor: 3200 },
        ],
        notas: [],
        documentos: [
          { nome: 'Termo de Consentimento LGPD', data: '15/09/2025', hora: '09:50', tipo: 'Assinatura digital', status: 'vigente' },
          { nome: 'Contrato de Tratamento', data: '15/09/2025', hora: '09:55', tipo: 'Assinatura digital', status: 'vigente' },
        ],
        galeria: [
          { sessao: 'Sessão 3 - Mar/2026', procedimento: 'Botox Preventivo', data: '01/03/2026', fotos: [{ label: 'Antes', url: null }, { label: 'Depois', url: null }] },
          { sessao: 'Sessão 2 - Dez/2025', procedimento: 'Skinbooster', data: '10/12/2025', fotos: [{ label: 'Antes', url: null }] },
        ],
      },
    ]
  });

  const [selectedPatientCpf, setSelectedPatientCpf] = useState(null);
  const [patientView, setPatientView] = useState('list');
  const [patientDetailTab, setPatientDetailTab] = useState('timeline');
  const [patientSearchQuery, setPatientSearchQuery] = useState('');

  return {
    patients,
    setPatients,
    selectedPatientCpf,
    setSelectedPatientCpf,
    patientView,
    setPatientView,
    patientDetailTab,
    setPatientDetailTab,
    patientSearchQuery,
    setPatientSearchQuery,
  };
};

