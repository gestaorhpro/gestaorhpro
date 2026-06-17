# Fluxo de Implantação e Estrutura de Informação

Este arquivo documenta as regras de negócio, dependências lógicas e o fluxo de dados unificado do sistema para guiar cadastros de forma eficiente e de alta performance.

---

## 🗺️ O Fluxo de Implantação Recomendado (Passos 1 a 7)

Para que o canteiro de obras tenha integridade operacional completa, os recursos devem ser cadastrados de forma hierárquica e gradual. O sistema monitora a existência de registros em cada tabela para computar a barra de progresso no Dashboard principal.

```
┌─────────────────────────────────┐
│  1. Perfil da Empresa (Settings)│ ── Configura dados cadastrais e departamentos pioneiros
└─────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  2. Equipe & Acessos (Employees)│ ── Associa cargos e departamentos
└─────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  3. Treinamentos & NRs          │ ── Vincula certificados de validade aos colaboradores
└─────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  4. Controle de EPIs (PPE)      │ ── Organiza estoque de segurança
└─────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  5. Imóveis & Mobília (Props)   │ ── Define os alojamentos de suporte técnico
└─────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  6. Ferramental & Equipamentos  │ ── Registra ferramentas e define custódia individual
└─────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  7. Cadastrar Obras (Works)     │ ── Consolida todos os ativos anteriores em canteiros ativos
└─────────────────────────────────┘
```

---

## ⚙️ Arquitetura de Dados e Relacionamentos Cruzados

O principal nó agregador do sistema é a entidade **Obra/Projeto** (`Work`). Ela conecta as outras tabelas através de identificadores únicos (chaves estrangeiras simuladas de alta reatividade).

### 1. Entidade: Obra (`Work`)
*   **Chave Primária**: `id` (Ex: `work-172355..`)
*   **Campos de Identificação**: `name`, `type`, `contactName`, `contactPhone`
*   **Cronograma**: `startDate`, `estimatedEndDate` (usado para calcular a contagem dinâmica de dias e sinalização crítica de prazos no painel visual)
*   **Vetores de Relacionamento**:
    *   `employeeIds: string[]`: Array de chaves estrangeiras vinculando colaboradores ativos (`Employee.id`) alocados na equipe de frente de trabalho.
    *   `toolIds: string[]`: Array de chaves de ferramentas ou rompedores (`ToolEquipment.id`) alocados sob guarda permanente neste canteiro.
    *   `propertyId: string`: Chave opcional ligada a um alojamento cadastrado (`Property.id`) para hospedar a equipe.

---

## 📈 Lógica do Motor de Cálculo de Prazos (Sincronização)

Quando uma Obra é criada, os seguintes cálculos ocorrem em tempo real na interface principal:

1.  **Diferença de Dias Totais**:
    $$\text{Prazo Total} = \text{Data de Fim} - \text{Data de Início}$$
2.  **Dias Restantes**:
    $$\text{Prazo Restante} = \text{Data de Fim} - \text{Data de Hoje}$$
3.  **Percentual de Avanço do Cronograma**:
    $$\text{Percentual} = \max\left(0, \min\left(100, \frac{\text{Hoje} - \text{Início}}{\text{Prazo Total}} \times 100\right)\right)$$
4.  **Gradiente Visual de Gravidade**:
    *   Se `Status === 'Concluído'` $\rightarrow$ **Verde** / Sucesso (Obra entregue com sucesso)
    *   Se `Prazo Restante < 0` $\rightarrow$ **Vermelho** / Crítico (Obra em atraso)
    *   Se `Prazo Restante <= 10 dias` $\rightarrow$ **Amarelo** / Atenção (Prazo final se aproximando rápida-fase)
    *   Outros casos $\rightarrow$ **Azul** / Operação Normal

---

## 🛡️ Propagação Bidirecional de Atualizações

Para garantir consistência e evitar "ativos fantasmas", o sistema de persistência implementa propagação reversa automática:

*   **Vínculo Reverso de Ferramentas**: Ao escolher as ferramentas `toolIds` no formulário da obra, o sistema atualiza o registro no almoxarifado setando `associatedWorkId` e `associatedWorkName` da ferramenta respectiva. Assim, na aba de Ferramental, o usuário vê exatamente qual canteiro detém o item.
*   **Limpeza Automática ao Excluir**: Ao remover uma obra do sistema, o motor reconfigura automaticamente todas as ferramentas e propriedades que estavam vinculadas a ela para `null`/vazio. Isso previne ferramentas presas em canteiros desativados, retornando-as automaticamente ao almoxarifado central.
