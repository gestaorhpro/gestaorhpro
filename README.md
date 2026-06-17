
# GestãoRH Pro

O **GestãoRH Pro** é um painel administrativo completo para Recursos Humanos, desenvolvido com **React**, **TypeScript** e **Tailwind CSS**. O sistema oferece uma interface moderna e responsiva para gerenciar colaboradores, folhas de pagamento, recrutamento e ativos corporativos.

![GestãoRH Pro Dashboard](./public/preview.png)

## 🚀 Funcionalidades

O sistema inclui os seguintes módulos:

- **Dashboard Geral**: Visão macro de KPIs, aniversariantes e métricas de RH.
- **Gestão de Colaboradores**: CRUD completo de funcionários com gestão de documentos e dependentes.
- **Recrutamento (ATS)**: Kanban de vagas e candidatos.
- **Folha de Pagamento**: Simulação de cálculos, geração de holerites e controle de status de pagamento.
- **Controle de EPIs**: Gestão de estoque, entregas e validade de Certificados de Aprovação (CA).
- **Documentos Digitais**: Gerenciamento de arquivos e pastas com upload simulado.
- **Relatórios**: Dashboards analíticos financeiros e de recrutamento usando `recharts`.
- **Indicações**: Sistema de referência de candidatos internos.
- **Agenda e Tarefas**: Calendário interativo e gestão de tarefas diárias.

## 📅 Changelog

### v1.1.1 (Patch)
- **Correção de Build**: Ajuste nas dependências do React para evitar conflitos de versão na Vercel.
- **Configuração**: Remoção de dependências de Node.js no arquivo `vite.config.ts`.

### v1.1.0
- **Recrutamento (ATS)**: Implementação de visualização Kanban (Pipeline) para gestão de candidatos e funcionalidade de agendamento de entrevistas.
- **Documentos Digitais**: Habilitado upload múltiplo de arquivos, criação de pastas e visualização de arquivos (PDF/Imagem).
- **Relatórios**: Dashboard completo com gráficos de Turnover, Custos por Departamento e Funil de Recrutamento.
- **Colaboradores**: Adicionada validação matemática e máscara automática para o campo de CPF no formulário de cadastro.
- **Folha de Pagamento**: Correção crítica na função `Pagar Selecionados` e `Pagar Pendentes`, garantindo atualização correta do status financeiro.
- **Performance**: Melhoria na estabilidade dos IDs para operações em lote.
- **Configuração**: Adição de arquivos essenciais (`.gitignore`, `tsconfig.json`) para versionamento no GitHub.

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 18
- **Linguagem**: TypeScript
- **Estilização**: Tailwind CSS
- **Ícones**: Material Icons
- **Gráficos**: Recharts
- **Build Tool**: Vite (Recomendado para execução local)

## 📦 Instalação e Execução

Para rodar o projeto localmente, siga os passos abaixo:

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/seu-usuario/gestaorh-pro.git
   cd gestaorh-pro
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

4. Acesse `http://localhost:5173` no seu navegador.

## 📁 Estrutura do Projeto

```
/src
  /components   # Componentes globais (Sidebar, Header, etc.)
  /pages        # Páginas principais da aplicação
  /types        # Definições de tipos TypeScript
  App.tsx       # Componente raiz e roteamento
  index.tsx     # Ponto de entrada
```

## 🤝 Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou enviar pull requests.

1. Faça um Fork do projeto
2. Crie sua Feature Branch (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a Branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

---

## 🗄️ Modo de Banco de Dados Offline (LocalStorage)

Para prevenir falhas de conexão devido à desativação da conta do Supabase e permitir a operação ininterrupta do sistema, a aplicação está configurada no **Modo Offline Autônomo**:

- **Onde está configurado?**: No arquivo `/services/supabase.ts`.
- **Como funciona?**: Todas as chamadas de banco de dados (`select`, `insert`, `update`, `delete`, `auth`) foram roteadas para um simulador local integrado. O sistema armazena automaticamente as tabelas diretamente no `localStorage` do seu navegador.
- **Semente de Dados**: No primeiro carregamento, o simulador preenche automaticamente tabelas de funcionários, tarefas, EPIs, faturamento, currículos e contratos para demonstração impecável.

### Redirecionando para um Novo Banco Supabase Live:
Quando você criar seu novo banco no Supabase futuramente, basta:
1. Reverter o `/services/supabase.ts` para sua versão original de cliente `@supabase/supabase-js`.
2. Adicionar as novas chaves `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no seu ambiente.

---

© 2025 GestãoRH Pro. Desenvolvido para modernizar o RH.