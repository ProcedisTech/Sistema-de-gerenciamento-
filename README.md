💉 Procedi - Sistema de Harmonização Facial Premium

O Procedi é uma aplicação web moderna desenvolvida em React para otimizar e digitalizar a jornada de atendimento de pacientes em clínicas de estética avançada e harmonização facial. O sistema guia o profissional através de um fluxo estruturado de 5 etapas, garantindo segurança clínica, conformidade legal (LGPD) e precisão técnica.

✨ Funcionalidades Principais

🔒 Autenticação Segura: Ecrã de login para controlo de acesso profissional.

🛣️ Jornada Otimizada de 5 Etapas: Um stepper interativo que impede o avanço sem o preenchimento de dados obrigatórios.

👤 Gestão de Pacientes (Check-in):

Formulário completo com validações e formatação automática (Máscaras de CPF, RG e Telefone).

Cálculo automático de idade baseado na data de nascimento.

Alertas visuais para histórico médico crítico (ex: Alergias).

📋 Anamnese Digital: Registo de queixas, expectativas e contraindicações (gestação, anticoagulantes, etc.).

🎨 Mapeamento Facial Avançado (Canvas API):

Upload de fotografias do paciente.

Ferramenta de Desenho: Marcações livres com várias cores.

Ferramenta de Ponto: Inserção de pontos de injeção enumerados automaticamente, com tamanho configurável e numeração inteligente (dentro ou fora do ponto).

Ferramenta de Borracha: Apagar zonas específicas com tamanho ajustável.

Pré-visualização (Cursor): O cursor do rato adapta-se em tempo real à cor e tamanho da ferramenta selecionada (ponto ou borracha).

Histórico de ações (Desfazer) e Limpar tudo.

⚖️ Conformidade LGPD: Termos de consentimento digitais integrados antes do procedimento.

✅ Finalização e Orientações: Lista de verificações pós-procedimento e confirmação de satisfação.

🛠️ Tecnologias Utilizadas

React - Biblioteca JavaScript para construção da interface de utilizador.

Vite - Ferramenta de build super rápida para projetos web modernos.

Tailwind CSS - Framework CSS utility-first para um design responsivo e premium.

Lucide React - Biblioteca de ícones elegantes e consistentes.

HTML5 Canvas API - Utilizada para o motor de desenho e mapeamento facial interativo.

🚀 Como Executar o Projeto Localmente

Pré-requisitos

Certifique-se de que tem o Node.js instalado na sua máquina.

Passos para instalação

Clone o repositório:

git clone [https://github.com/SEU_USUARIO/procedi.git](https://github.com/SEU_USUARIO/procedi.git)


Entre na pasta do projeto:

cd procedi


Instale as dependências:

npm install


Inicie o servidor de desenvolvimento:

npm run dev


Abra o navegador no link indicado no terminal (geralmente http://localhost:5173/).

🔐 Acesso ao Sistema

Para testar a interface em ambiente de desenvolvimento, utilize as seguintes credenciais padrão:

Usuário: Rafael

Senha: PROcedi

📁 Estrutura da Jornada (Passo a Passo)

Check-in: Dados pessoais, documentos e contactos.

Anamnese: Queixas e histórico médico.

Avaliação: Upload de foto e desenho de mapeamento na face do paciente.

Execução: Assinatura digital do Termo de Consentimento (LGPD).

Finalização: Confirmação de orientações pós-procedimento.

Desenvolvido com 🩵 para a área de Estética e Harmonização Facial.
