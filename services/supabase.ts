// Mock de Banco de Dados local simulando a API cliente do Supabase
// Salva todo o estado localmente no localStorage, permitindo funcionamento offline sem um servidor do Supabase.

const DEFAULT_DATA: Record<string, any[]> = {
  company_roles: [
    { id: 'role-1', name: 'Diretor' },
    { id: 'role-2', name: 'Gerente de RH' },
    { id: 'role-3', name: 'Analista de RH' },
    { id: 'role-4', name: 'Assistente Administrativo' },
    { id: 'role-5', name: 'Desenvolvedor' },
    { id: 'role-6', name: 'Analista de Sistemas' },
    { id: 'role-7', name: 'Designer' },
    { id: 'role-8', name: 'Suporte' }
  ],
  company_departments: [
    { id: 'dept-1', name: 'Recursos Humanos' },
    { id: 'dept-2', name: 'Administrativo' },
    { id: 'dept-3', name: 'Financeiro' },
    { id: 'dept-4', name: 'Tecnologia' },
    { id: 'dept-5', name: 'Operações' },
    { id: 'dept-6', name: 'Marketing' },
    { id: 'dept-7', name: 'Vendas' }
  ],
  companies: [
    {
      id: 1,
      name: 'Minha Empresa S/A',
      trade_name: 'Minha Empresa',
      cnpj: '12.345.678/0001-99',
      phone: '(11) 99999-9999',
      email: 'contato@minhaempresa.com',
      address_zip: '01310-100',
      address_street: 'Avenida Paulista',
      address_number: '1000',
      address_complement: 'Cj 12',
      address_neighborhood: 'Bela Vista',
      address_city: 'São Paulo',
      address_state: 'SP',
      address: 'Avenida Paulista, 1000'
    }
  ],
  employees: [
    {
      id: 'emp-1',
      name: 'Ana Silva',
      role: 'Gerente de RH',
      department: 'Recursos Humanos',
      status: 'Ativo',
      admissionDate: '2023-01-15',
      birthDate: '1985-04-12',
      phone: '(11) 98765-4321',
      cpf: '123.456.789-00',
      rg: '12.345.678-9',
      addressZip: '01310-100',
      addressStreet: 'Avenida Paulista',
      addressNumber: '1000',
      addressComplement: 'Apto 15',
      addressNeighborhood: 'Bela Vista',
      addressCity: 'São Paulo',
      addressState: 'SP',
      address: 'Avenida Paulista, 1000'
    },
    {
      id: 'emp-2',
      name: 'Lucas Santos',
      role: 'Desenvolvedor',
      department: 'Tecnologia',
      status: 'Ativo',
      admissionDate: '2023-06-10',
      birthDate: '1992-08-25',
      phone: '(11) 91234-5678',
      cpf: '234.567.890-11',
      rg: '23.456.789-0',
      addressZip: '01310-100',
      addressStreet: 'Avenida Paulista',
      addressNumber: '1000',
      addressComplement: 'Apto 15',
      addressNeighborhood: 'Bela Vista',
      addressCity: 'São Paulo',
      addressState: 'SP',
      address: 'Avenida Paulista, 1000'
    },
    {
      id: 'emp-3',
      name: 'Mariana Oliveira',
      role: 'Analista de RH',
      department: 'Recursos Humanos',
      status: 'Ativo',
      admissionDate: '2024-02-01',
      birthDate: '1990-11-05',
      phone: '(11) 95555-4444',
      cpf: '345.678.901-22',
      rg: '34.567.890-1',
      addressZip: '01310-100',
      addressStreet: 'Avenida Paulista',
      addressNumber: '1000',
      addressComplement: 'Apto 15',
      addressNeighborhood: 'Bela Vista',
      addressCity: 'São Paulo',
      addressState: 'SP',
      address: 'Avenida Paulista, 1000',
      vacationStartDate: '2026-06-10',
      vacationEndDate: '2026-06-30',
      vacationNotify: true
    },
    {
      id: 'emp-4',
      name: 'Pedro Costa',
      role: 'Designer',
      department: 'Tecnologia',
      status: 'Férias',
      admissionDate: '2022-11-20',
      birthDate: '1988-01-30',
      phone: '(11) 94444-3333',
      cpf: '456.789.012-33',
      rg: '45.678.901-2',
      addressZip: '01310-100',
      addressStreet: 'Avenida Paulista',
      addressNumber: '1000',
      addressComplement: 'Apto 15',
      addressNeighborhood: 'Bela Vista',
      addressCity: 'São Paulo',
      addressState: 'SP',
      address: 'Avenida Paulista, 1000',
      vacationStartDate: '2026-06-01',
      vacationEndDate: '2026-06-30',
      vacationNotify: true
    }
  ],
  tasks: [
    { id: 'task-1', title: 'Integração de Novo Funcionário', date: '2026-06-08', completed: false, description: 'Efetuar onboarding de novos desenvolvedores de tecnologia', category: 'Onboarding' },
    { id: 'task-2', title: 'Revisão Geral do Payroll', date: '2026-06-12', completed: false, description: 'Conferir adiantamentos e contra-cheques', category: 'Financeiro' },
    { id: 'task-3', title: 'Renovação de CAs de EPI', date: '2026-06-15', completed: true, description: 'Verificar validade dos CAs dos óculos de proteção', category: 'EPI' }
  ],
  documents: [
    { id: 'doc-1', name: 'Contrato de Trabalho - Ana Silva.pdf', category: 'Contratos', upload_date: '2023-01-15', file_size: '1.2 MB', employee_id: 'emp-1', url: '#' },
    { id: 'doc-2', name: 'Atestado de Entrega de EPI - Lucas.pdf', category: 'EPI', upload_date: '2023-06-11', file_size: '450 KB', employee_id: 'emp-2', url: '#' },
    { id: 'doc-3', name: 'Política de Home Office 2026.pdf', category: 'Políticas', upload_date: '2026-01-05', file_size: '820 KB', url: '#' }
  ],
  jobs: [
    {
      id: 1,
      title: 'Desenvolvedor React Sênior',
      department: 'Tecnologia',
      type: 'Tempo Integral',
      location: 'Híbrido - SP',
      salary: 'R$ 12.000,00',
      status: 'Ativo',
      description: 'Procuramos desenvolvedor com sólida experiência em React, Vite, Tailwind CSS.',
      requirements: 'Conhecimento em React, TypeScript, APIs REST, Git.',
      benefits: 'VR, VT, Plano de Saúde, Seguro de Vida.',
      user_id: 'demo'
    },
    {
      id: 2,
      title: 'Analista de Recursos Humanos Sênior',
      department: 'Recursos Humanos',
      type: 'Tempo Integral',
      location: 'Presencial - SP',
      salary: 'R$ 7.500,00',
      status: 'Ativo',
      description: 'Responsável pelo recrutamento e seleção de tecnologia e treinamento interno.',
      requirements: 'Experiência em recrutamento de tecnologia (tech recruiting).',
      benefits: 'VR, VT, Assistência Médica, Auxílio Home Office.',
      user_id: 'demo'
    }
  ],
  candidates: [
    {
      id: 'cand-1',
      name: 'Carlos Eduardo',
      email: 'carlos.edu@gmail.com',
      phone: '(11) 98888-7777',
      linkedin: 'linkedin.com/in/carlosedu',
      job_id: 1,
      job_title: 'Desenvolvedor React Sênior',
      status: 'Inscrito',
      experience: '5 anos de experiência com React e Node.js.',
      education: 'Ciência da Computação',
      resume_url: '#',
      match_score: 85,
      created_at: '2026-06-05T12:00:00Z'
    },
    {
      id: 'cand-2',
      name: 'Gabriela Mendes',
      email: 'gabi.mendes@hotmail.com',
      phone: '(11) 97777-6666',
      linkedin: 'linkedin.com/in/gabimendes',
      job_id: 2,
      job_title: 'Analista de Recursos Humanos Sênior',
      status: 'Entrevista',
      experience: '3 anos em cargos de Tech Recruiter.',
      education: 'Psicologia',
      resume_url: '#',
      match_score: 92,
      created_at: '2026-06-04T10:30:00Z'
    }
  ],
  messages: [
    {
      id: 'msg-1',
      sender: 'Mariana Oliveira',
      subject: 'Ajuste na data de Férias',
      content: 'Olá! Gostaria de confirmar se é possível ajustar o início das minhas férias para o dia 12 de junho ao invés de dia 10.',
      date: '2026-06-06T15:30:00Z',
      read: false,
      is_starred: true,
      folder: 'inbox'
    },
    {
      id: 'msg-2',
      sender: 'Lucas Santos',
      subject: 'Dúvida sobre Entrega de EPI',
      content: 'Preciso renovar meus óculos de proteção. Como faço para solicitar no painel de EPI?',
      date: '2026-06-05T09:12:00Z',
      read: true,
      is_starred: false,
      folder: 'inbox'
    }
  ],
  referrals: [
    {
      id: 'ref-1',
      candidate_name: 'Guilherme Santos',
      job_title: 'Desenvolvedor React Sênior',
      referrer_name: 'Lucas Santos',
      email: 'gui.santos@outlook.com',
      phone: '(11) 96666-5555',
      status: 'Em Processo',
      bonus_status: 'Pendente',
      bonus_amount: 1000.00,
      created_at: '2026-06-05T08:00:00Z'
    }
  ],
  vacation_requests: [
    {
      id: 'vac-1',
      employee_name: 'Mariana Oliveira',
      department: 'Recursos Humanos',
      startDate: '2026-06-10',
      endDate: '2026-06-30',
      status: 'Pendente',
      days: 20
    },
    {
      id: 'vac-2',
      employee_name: 'Pedro Costa',
      department: 'Tecnologia',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      status: 'Aprovado',
      days: 30
    }
  ],
  ppe_items: [
    { id: 'ppe-i1', name: 'Óculos de Proteção', stock: 25, expiry_days: 120, alert_days: 30, category: 'Facial', unit: 'Unidade' },
    { id: 'ppe-i2', name: 'Protetor Auricular C-20', stock: 14, expiry_days: 90, alert_days: 15, category: 'Auditivo', unit: 'Par' },
    { id: 'ppe-i3', name: 'Luva Nitrílica Térmica', stock: 35, expiry_days: 180, alert_days: 45, category: 'Mãos', unit: 'Par' }
  ],
  ppe_suppliers: [
    { id: 'ppe-s1', trade_name: 'EPI Segura S/A', cnpj: '11.222.333/0001-44', phone: '(11) 3333-4444', email: 'vendas@episegura.com.br', contact_name: 'Marcos Antonio' }
  ],
  ppe_deliveries: [
    { id: 'ppe-d1', item_id: 'ppe-i1', item_name: 'Óculos de Proteção', employee_id: 'emp-2', employee_name: 'Lucas Santos', delivery_date: '2026-05-10', qty: 1, expiry_date: '2026-09-07', ca_number: 'CA-123456', status: 'Entregue', notes: 'Onboarding' }
  ],
  ppe_returns: [
    { id: 'ppe-r1', item_id: 'ppe-i1', item_name: 'Óculos de Proteção', employee_id: 'emp-4', employee_name: 'Pedro Costa', return_date: '2026-05-30', qty: 1, notes: 'Desgaste' }
  ],
  payroll_records: [
    { id: 'pay-1', employee_id: 'emp-1', employee_name: 'Ana Silva', period: '05/2026', salary_base: 8500.00, allowances: 1500.00, deductions: 800.00, salary_net: 9200.00, status: 'Pago', payment_date: '2026-05-30' },
    { id: 'pay-2', employee_id: 'emp-2', employee_name: 'Lucas Santos', period: '05/2026', salary_base: 12000.00, allowances: 2000.00, deductions: 1200.00, salary_net: 12800.00, status: 'Pago', payment_date: '2026-05-30' }
  ],
  holidays: [
    { id: 'hol-1', name: 'Independência do Brasil', date: '2026-09-07', type: 'Nacional' },
    { id: 'hol-2', name: 'Natal', date: '2026-12-25', type: 'Nacional' }
  ],
  properties: [
    {
      id: 'prop-1',
      name: 'Casa Jardim das Flores - Porto Alegre',
      addressZip: '90050-001',
      addressStreet: 'Rua da República',
      addressNumber: '120',
      addressComplement: 'Apto 302',
      addressNeighborhood: 'Cidade Baixa',
      addressCity: 'Porto Alegre',
      addressState: 'RS',
      notes: 'Acomodação principal do pessoal da Pavimentação de Vias.',
      furniture: [
        { id: 'f-1', name: 'Fogão de 4 bocas', quantity: 1, condition: 'Regular' },
        { id: 'f-2', name: 'Cama de Solteiro (com colchão)', quantity: 2, condition: 'Bom' },
        { id: 'f-3', name: 'Geladeira Duplex', quantity: 1, condition: 'Novo' },
        { id: 'f-4', name: 'Armário de Cozinha de Parede', quantity: 1, condition: 'Bom' }
      ],
      residentIds: ['emp-1', 'emp-2'] // Ana Silva & Lucas Santos
    },
    {
      id: 'prop-2',
      name: 'Alojamento Executivo - Curitiba',
      addressZip: '80230-010',
      addressStreet: 'Avenida Sete de Setembro',
      addressNumber: '2500',
      addressComplement: 'Casa 2',
      addressNeighborhood: 'Rebouças',
      addressCity: 'Curitiba',
      addressState: 'PR',
      notes: 'Fica próximo à Linha Verde.',
      furniture: [
        { id: 'f-5', name: 'Geladeira Frost-Free', quantity: 1, condition: 'Bom' },
        { id: 'f-6', name: 'Cama de Solteiro', quantity: 4, condition: 'Regular' },
        { id: 'f-7', name: 'Fogão de 4 bocas a Gás', quantity: 1, condition: 'Bom' },
        { id: 'f-8', name: 'Mesa de Jantar com 4 Cadeiras', quantity: 1, condition: 'Regular' },
        { id: 'f-9', name: 'Máquina de Lavar Roupas 12kg', quantity: 1, condition: 'Novo' }
      ],
      residentIds: ['emp-4'] // Pedro Costa
    }
  ],
  tools: [
    {
      id: 'tool-1',
      name: 'Furadeira de Impacto Bosch GSB 13 RE',
      serialNumber: 'FE-BSH-901',
      category: 'Ferramenta Elétrica',
      quantity: 1,
      condition: 'Bom',
      responsibleEmployeeIds: ['emp-1'], // Ana Silva
      associatedWorkName: 'Pavimentação de Vias RS-118',
      assignmentDate: '2026-05-12',
      notes: 'Entregue com maleta plástica e jogo completo de brocas de vídea.'
    },
    {
      id: 'tool-2',
      name: 'Rompedor Pneumático Chicago Pneumatic CP 1230',
      serialNumber: 'RP-CP-445',
      category: 'Ferramenta Elétrica',
      quantity: 1,
      condition: 'Regular',
      responsibleEmployeeIds: ['emp-2'], // Lucas Santos
      associatedWorkName: 'Edifício Residencial Curitiba',
      assignmentDate: '2026-04-18',
      notes: 'Sempre manter lubrificado com óleo pneumático correto.'
    },
    {
      id: 'tool-3',
      name: 'Andaime Metálico 1.5m Tubular (Jogo com 4 painéis)',
      serialNumber: 'AD-MET-003',
      category: 'Equipamento de Acesso',
      quantity: 3,
      condition: 'Bom',
      responsibleEmployeeIds: ['emp-4'], // Pedro Costa
      associatedWorkName: 'Edifício Residencial Curitiba',
      assignmentDate: '2026-05-20',
      notes: 'Apanhado diretamente no almoxarifado de Curitiba.'
    },
    {
      id: 'tool-4',
      name: 'Escada Telescópica de Alumínio 3.8m Alupat',
      serialNumber: 'EC-ALU-108',
      category: 'Equipamento de Acesso',
      quantity: 1,
      condition: 'Novo',
      responsibleEmployeeIds: ['emp-1'], // Ana Silva
      assignmentDate: '2026-06-01',
      notes: 'Equipamento super leve, sob a guarda permanente na caminhonete administrativa.'
    }
  ],
  works: [
    {
      id: 'work-1',
      name: 'Duplicação do Viaduto Principal - Porto Alegre',
      contactName: 'Eng. Ricardo Rezende',
      contactPhone: '(51) 98888-7711',
      addressZip: '90050-001',
      addressStreet: 'Avenida Farrapos',
      addressNumber: '1500',
      addressComplement: 'Canteiro Central',
      addressNeighborhood: 'Floresta',
      addressCity: 'Porto Alegre',
      addressState: 'RS',
      type: 'Instalação',
      employeeIds: ['emp-1', 'emp-2'],
      propertyId: 'prop-1',
      toolIds: ['tool-1', 'tool-4'],
      startDate: '2026-06-01',
      estimatedEndDate: '2026-08-30',
      status: 'Em Andamento',
      notes: 'Obra de alta visibilidade e prioridade máxima do consórcio municipal.'
    },
    {
      id: 'work-2',
      name: 'Adequação Elétrica de Galpão - Curitiba',
      contactName: 'Mestre Gilberto Souza',
      contactPhone: '(41) 97777-6622',
      addressZip: '80230-010',
      addressStreet: 'Rua do Hauer',
      addressNumber: '440',
      addressComplement: 'Bloco B',
      addressNeighborhood: 'Hauer',
      addressCity: 'Curitiba',
      addressState: 'PR',
      type: 'Adequação',
      employeeIds: ['emp-4'],
      propertyId: 'prop-2',
      toolIds: ['tool-2', 'tool-3'],
      startDate: '2026-05-15',
      estimatedEndDate: '2026-06-25',
      status: 'Em Andamento',
      notes: 'Alojamento próximo ao local facilita o trâmite logístico diário da equipe.'
    }
  ],
  work_photos: [
    {
      id: "photo-1",
      workId: "work-1",
      workName: "Duplicação do Viaduto Principal - Porto Alegre",
      photoUrl: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&q=80&w=600",
      observation: "Início da terraplanagem e escavação do pilar central.",
      uploadedBy: "Ana Silva",
      uploadedByRole: "Mestre de Obras",
      createdAt: "2026-06-03T14:30:11.000Z"
    },
    {
      id: "photo-2",
      workId: "work-2",
      workName: "Adequação Elétrica de Galpão - Curitiba",
      photoUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=600",
      observation: "Passagem de cabos de força nas eletrocalhas do bloco superior.",
      uploadedBy: "Pedro Costa",
      uploadedByRole: "Eletricista Sênior",
      createdAt: "2026-06-12T10:15:00.000Z"
    }
  ]
};

// Listeners de Autenticação para reatividade de Login/Logout
const authListeners: Array<(event: string, session: any) => void> = [];

const getLoggedUserEmail = (): string => {
  return localStorage.getItem('gestaorh_logged_user') || 'ana.silva@gestaorh.pro';
};

class SupabaseQueryBuilder {
  private _table: string;
  private _filters: Array<(item: any) => boolean> = [];
  private _orderCol: string | null = null;
  private _orderAsc: boolean = true;
  private _single: boolean = false;
  private _countOnly: boolean = false;
  private _limit: number | null = null;
  private _action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private _payload: any = null;

  constructor(table: string) {
    this._table = table;
  }

  select(fields = '*', options?: any) {
    if (options?.count) {
      if (options.count === 'exact') {
        this._countOnly = true;
      }
    }
    return this;
  }

  eq(column: string, value: any) {
    this._filters.push(item => {
      if (item[column] === undefined) return false;
      return String(item[column]) == String(value);
    });
    return this;
  }

  neq(column: string, value: any) {
    this._filters.push(item => {
      if (item[column] === undefined) return true;
      return String(item[column]) != String(value);
    });
    return this;
  }

  gt(column: string, value: any) {
    this._filters.push(item => Number(item[column]) > Number(value));
    return this;
  }

  gte(column: string, value: any) {
    this._filters.push(item => Number(item[column]) >= Number(value));
    return this;
  }

  lt(column: string, value: any) {
    this._filters.push(item => {
      if (typeof item[column] === 'string' && typeof value === 'string') {
        return item[column] < value;
      }
      return Number(item[column]) < Number(value);
    });
    return this;
  }

  lte(column: string, value: any) {
    this._filters.push(item => {
      if (typeof item[column] === 'string' && typeof value === 'string') {
        return item[column] <= value;
      }
      return Number(item[column]) <= Number(value);
    });
    return this;
  }

  in(column: string, values: any[]) {
    this._filters.push(item => {
      const collection = values.map(v => String(v));
      return collection.includes(String(item[column]));
    });
    return this;
  }

  ilike(column: string, pattern: string) {
    this._filters.push(item => {
      if (item[column] === undefined || item[column] === null) return false;
      const val = String(item[column]).toLowerCase();
      const searchPattern = pattern.replace(/%/g, '').toLowerCase();
      return val.includes(searchPattern);
    });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this._orderCol = column;
    this._orderAsc = options?.ascending !== false;
    return this;
  }

  limit(n: number) {
    this._limit = n;
    return this;
  }

  single() {
    this._single = true;
    return this;
  }

  maybeSingle() {
    this._single = true;
    return this;
  }

  insert(values: any) {
    this._action = 'insert';
    this._payload = values;
    return this;
  }

  update(values: any) {
    this._action = 'update';
    this._payload = values;
    return this;
  }

  delete() {
    this._action = 'delete';
    return this;
  }

  // Permite que o construtor de consulta seja resolvido nativamente por requisições await
  async then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    try {
      const res = await this.execute();
      if (onfulfilled) return onfulfilled(res);
      return res;
    } catch (err) {
      if (onrejected) return onrejected(err);
      throw err;
    }
  }

  private async execute() {
    const storageKey = `gestaorh_db_${this._table}`;
    let items: any[] = [];
    const stored = localStorage.getItem(storageKey);

    if (stored !== null) {
      try {
        items = JSON.parse(stored);
      } catch (e) {
        items = [];
      }
    } else {
      // Carrega dados iniciais do seed
      items = DEFAULT_DATA[this._table] ? [...DEFAULT_DATA[this._table]] : [];
      localStorage.setItem(storageKey, JSON.stringify(items));
    }

    if (this._action === 'select') {
      let result = [...items];
      for (const filter of this._filters) {
        result = result.filter(filter);
      }

      if (this._orderCol) {
        const col = this._orderCol;
        const asc = this._orderAsc;
        result.sort((a, b) => {
          let valA = a[col];
          let valB = b[col];
          if (valA === undefined || valA === null) return asc ? 1 : -1;
          if (valB === undefined || valB === null) return asc ? -1 : 1;
          if (typeof valA === 'string') valA = valA.toLowerCase();
          if (typeof valB === 'string') valB = valB.toLowerCase();
          if (valA < valB) return asc ? -1 : 1;
          if (valA > valB) return asc ? 1 : -1;
          return 0;
        });
      }

      if (this._limit !== null) {
        result = result.slice(0, this._limit);
      }

      if (this._single) {
        return { data: result[0] || null, error: null, count: result.length ? 1 : 0 };
      }

      if (this._countOnly) {
        return { data: null, error: null, count: result.length };
      }

      return { data: result, error: null, count: result.length };

    } else if (this._action === 'insert') {
      const payloadArray = Array.isArray(this._payload) ? this._payload : [this._payload];
      const insertedItems: any[] = [];

      for (const rawPayload of payloadArray) {
        // Decide se cria ID numérico ou string
        const useNumericId = (items.length > 0 && typeof items[0].id === 'number') || this._table === 'jobs' || this._table === 'candidates';
        let generatedId: any = rawPayload.id;

        if (generatedId === undefined || generatedId === null) {
          if (useNumericId) {
            generatedId = items.reduce((max, x) => Math.max(max, Number(x.id || 0)), 0) + 1;
          } else {
            generatedId = 'mock-' + Math.random().toString(36).substring(2, 9);
          }
        }

        const newItem = {
          ...rawPayload,
          id: generatedId,
          created_at: rawPayload.created_at || new Date().toISOString()
        };
        items.push(newItem);
        insertedItems.push(newItem);
      }

      localStorage.setItem(storageKey, JSON.stringify(items));
      return { data: insertedItems, error: null };

    } else if (this._action === 'update') {
      const updatedItems: any[] = [];
      const updatedList = items.map(item => {
        let isMatch = true;
        for (const filter of this._filters) {
          if (!filter(item)) {
            isMatch = false;
            break;
          }
        }

        if (isMatch) {
          const updatedItem = { ...item, ...this._payload };
          updatedItems.push(updatedItem);
          return updatedItem;
        }
        return item;
      });

      localStorage.setItem(storageKey, JSON.stringify(updatedList));
      return { data: updatedItems, error: null };

    } else if (this._action === 'delete') {
      const remainingItems: any[] = [];
      const deletedItems: any[] = [];

      for (const item of items) {
        let isMatch = true;
        for (const filter of this._filters) {
          if (!filter(item)) {
            isMatch = false;
            break;
          }
        }

        if (isMatch) {
          deletedItems.push(item);
        } else {
          remainingItems.push(item);
        }
      }

      localStorage.setItem(storageKey, JSON.stringify(remainingItems));
      return { data: deletedItems, error: null };
    }

    return { data: null, error: null };
  }
}

// Exporta o cliente mockado com a mesma interface usada pela aplicação
export const supabase = {
  auth: {
    async getSession() {
      const loggedUser = getLoggedUserEmail();
      const hasSession = localStorage.getItem('gestaorh_logged_in') !== 'false';
      
      if (!hasSession) {
        return { data: { session: null }, error: null };
      }

      return {
        data: {
          session: {
            user: {
              id: 'demo-user-id',
              email: loggedUser
            }
          }
        },
        error: null
      };
    },

    async getUser() {
      const loggedUser = getLoggedUserEmail();
      const hasSession = localStorage.getItem('gestaorh_logged_in') !== 'false';

      if (!hasSession) {
        return { data: { user: null }, error: null };
      }

      return {
        data: {
          user: {
            id: 'demo-user-id',
            email: loggedUser
          }
        },
        error: null
      };
    },

    onAuthStateChange(callback: (event: string, session: any) => void) {
      authListeners.push(callback);
      
      const loggedUser = getLoggedUserEmail();
      const hasSession = localStorage.getItem('gestaorh_logged_in') !== 'false';
      const session = hasSession ? {
        user: {
          id: 'demo-user-id',
          email: loggedUser
        }
      } : null;

      // Chama assincronamente para não prender no render do React
      setTimeout(() => {
        callback(hasSession ? 'SIGNED_IN' : 'SIGNED_OUT', session);
      }, 0);

      return {
        data: {
          subscription: {
            unsubscribe() {
              const idx = authListeners.indexOf(callback);
              if (idx !== -1) authListeners.splice(idx, 1);
            }
          }
        }
      };
    },

    async signInWithPassword({ email, password }: any) {
      localStorage.setItem('gestaorh_logged_in', 'true');
      localStorage.setItem('gestaorh_logged_user', email);
      
      const session = {
        user: {
          id: 'demo-user-id',
          email: email
        }
      };

      authListeners.forEach(listener => listener('SIGNED_IN', session));
      return { data: { user: session.user }, error: null };
    },

    async resetPasswordForEmail(email: string, options?: any) {
      console.log('Solicitação de reset de senha simulada para:', email);
      return { data: {}, error: null };
    },

    async signOut() {
      localStorage.setItem('gestaorh_logged_in', 'false');
      authListeners.forEach(listener => listener('SIGNED_OUT', null));
      return { error: null };
    }
  },

  from(table: string) {
    return new SupabaseQueryBuilder(table);
  }
};
