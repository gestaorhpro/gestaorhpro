-- GESTÃO RH PRO - SCHEMA DO BANCO DE DADOS (SUPABASE / POSTGRESQL)
-- Execute este script no SQL Editor do Supabase para criar todas as tabelas necessárias de uma só vez.

-- -------------------------------------------------------------
-- 1. TABELA DE EMPRESAS/CONFIGURAÇÃO GERAL
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    cnpj VARCHAR(20),
    phone VARCHAR(20),
    email VARCHAR(255),
    address_zip VARCHAR(10),
    address_street VARCHAR(255),
    address_number VARCHAR(10),
    address_complement VARCHAR(100),
    address_neighborhood VARCHAR(100),
    address_city VARCHAR(100),
    address_state VARCHAR(2),
    address TEXT, -- campo legado/fallback
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------
-- 2. TABELA DE DEPARTAMENTOS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------
-- 3. TABELA DE CARGOS/FUNÇÕES
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------
-- 4. TABELA DE COLABORADORES (FUNCIONÁRIOS)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    department VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo', 'Férias', 'Atestado / Afastamento')),
    admission_date DATE NOT NULL,
    birth_date DATE,
    phone VARCHAR(20),
    cpf VARCHAR(14),
    rg VARCHAR(20),
    ctps VARCHAR(50),
    cnh VARCHAR(50),
    cnh_category VARCHAR(10),
    certifications JSONB,
    address_zip VARCHAR(10),
    address_street VARCHAR(255),
    address_number VARCHAR(10),
    address_complement VARCHAR(100),
    address_neighborhood VARCHAR(100),
    address_city VARCHAR(100),
    address_state VARCHAR(2),
    address TEXT, -- campo legado/fallback
    vacation_start_date DATE,
    vacation_end_date DATE,
    vacation_notify BOOLEAN DEFAULT FALSE,
    shoe_size VARCHAR(10),
    shoe_type VARCHAR(100),
    shirt_size VARCHAR(10),
    dress_shirt_size VARCHAR(10),
    pants_size VARCHAR(10),
    jacket_size VARCHAR(10),
    salary NUMERIC(10,2) DEFAULT 0.00,
    advances JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------
-- 5. TABELA DE TAREFAS/CALENDÁRIO
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    description TEXT,
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------
-- 6. TABELA DE DOCUMENTOS DIGITAIS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    upload_date DATE DEFAULT CURRENT_DATE,
    file_size VARCHAR(50),
    employee_id VARCHAR(255) REFERENCES employees(id) ON DELETE SET NULL,
    url TEXT NOT NULL DEFAULT '#',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------
-- 7. TABELA DE VAGAS DE EMPREGO (JOBS)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    department VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    location VARCHAR(255) NOT NULL,
    salary VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Pausado', 'Encerrado')),
    description TEXT,
    requirements TEXT,
    benefits TEXT,
    user_id VARCHAR(255) DEFAULT 'demo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------
-- 8. TABELA DE CANDIDATOS E CURRÍCULOS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    linkedin VARCHAR(255),
    job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
    job_title VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Inscrito' CHECK (status IN ('Inscrito', 'Triagem', 'Entrevista', 'Proposta', 'Aprovado', 'Reprovado')),
    experience TEXT,
    education VARCHAR(255),
    resume_url TEXT NOT NULL DEFAULT '#',
    match_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------
-- 9. TABELA DE CAIXA DE ENTRADA / MENSAGENS INTERNAS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sender VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    read BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    folder VARCHAR(50) DEFAULT 'inbox',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------
-- 11. TABELA DE INDICAÇÕES (REFERRALS)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    candidate_name VARCHAR(255) NOT NULL,
    job_title VARCHAR(255) NOT NULL,
    referrer_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    status VARCHAR(50) DEFAULT 'Em Processo',
    bonus_status VARCHAR(50) DEFAULT 'Pendente' CHECK (bonus_status IN ('Pendente', 'Aprovado', 'Pago', 'Cancelado')),
    bonus_amount NUMERIC(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------
-- 12. TABELA DE SOLICITAÇÃO DE FÉRIAS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vacation_requests (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    employee_name VARCHAR(255) NOT NULL,
    department VARCHAR(255),
    startDate DATE NOT NULL,
    endDate DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Aprovado', 'Reprovado')),
    days INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------
-- 13. TABELA DE ITENS DE EPI (CONTROLE DE ESTOQUE)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ppe_items (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(255) NOT NULL,
    stock INTEGER DEFAULT 0,
    expiry_days INTEGER DEFAULT 365,
    alert_days INTEGER DEFAULT 30,
    category VARCHAR(100),
    unit VARCHAR(50) DEFAULT 'Unidade',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------
-- 14. TABELA DE FORNECEDORES DE EPI
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ppe_suppliers (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    trade_name VARCHAR(255) NOT NULL,
    cnpj VARCHAR(20),
    phone VARCHAR(20),
    email VARCHAR(255),
    contact_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------
-- 15. TABELA DE ENTREGAS DE EPI (HISTÓRICO)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ppe_deliveries (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    item_id VARCHAR(255) NOT NULL REFERENCES ppe_items(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    employee_id VARCHAR(255) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_name VARCHAR(255) NOT NULL,
    delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
    qty INTEGER DEFAULT 1,
    expiry_date DATE NOT NULL,
    ca_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Entregue',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------
-- 16. TABELA DE DEVOLUÇÕES DE EPI
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ppe_returns (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    item_id VARCHAR(255) NOT NULL REFERENCES ppe_items(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    employee_id VARCHAR(255) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_name VARCHAR(255) NOT NULL,
    return_date DATE NOT NULL DEFAULT CURRENT_DATE,
    qty INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------
-- 17. TABELA DE FOLHA DE PAGAMENTO (HISTÓRICO FINANCEIRO)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_records (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    employee_id VARCHAR(255) REFERENCES employees(id) ON DELETE SET NULL,
    employee_name VARCHAR(255) NOT NULL,
    period VARCHAR(10) NOT NULL, -- Exemplo: "05/2026"
    salary_base NUMERIC(10,2) DEFAULT 0.00,
    allowances NUMERIC(10,2) DEFAULT 0.00,
    deductions NUMERIC(10,2) DEFAULT 0.00,
    salary_net NUMERIC(10,2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Pendente' CHECK (status IN ('Pago', 'Pendente', 'Processando')),
    payment_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------
-- 18. TABELA DE FERIADOS CONFIGURADOS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS holidays (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    type VARCHAR(50) DEFAULT 'Nacional',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------
-- 19. TABELA DE PROPRIEDADES (ALOJAMENTOS / IMÓVEIS)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS properties (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    "addressZip" VARCHAR(10) NOT NULL,
    "addressStreet" VARCHAR(255) NOT NULL,
    "addressNumber" VARCHAR(20) NOT NULL,
    "addressComplement" VARCHAR(255),
    "addressNeighborhood" VARCHAR(100) NOT NULL,
    "addressCity" VARCHAR(100) NOT NULL,
    "addressState" VARCHAR(2) NOT NULL,
    furniture JSONB DEFAULT '[]'::jsonb,
    "residentIds" JSONB DEFAULT '[]'::jsonb,
    "associatedWorkId" VARCHAR(255),
    "associatedWorkName" VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------
-- 20. TABELA DE FERRAMENTAS E EQUIPAMENTOS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tools (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    "serialNumber" VARCHAR(255),
    category VARCHAR(100),
    quantity INTEGER DEFAULT 1,
    condition VARCHAR(50),
    "responsibleEmployeeIds" JSONB DEFAULT '[]'::jsonb,
    "associatedWorkName" VARCHAR(255),
    "assignmentDate" VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------
-- 21. TABELA DE OBRAS E CRONOGRAMAS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS works (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    "contactName" VARCHAR(255),
    "contactPhone" VARCHAR(50),
    "addressZip" VARCHAR(10),
    "addressStreet" VARCHAR(255),
    "addressNumber" VARCHAR(20),
    "addressComplement" VARCHAR(255),
    "addressNeighborhood" VARCHAR(100),
    "addressCity" VARCHAR(100),
    "addressState" VARCHAR(2),
    type VARCHAR(100),
    "employeeIds" JSONB DEFAULT '[]'::jsonb,
    "propertyId" VARCHAR(255),
    "toolIds" JSONB DEFAULT '[]'::jsonb,
    "startDate" DATE,
    "estimatedEndDate" DATE,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'Planejado',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------
-- 22. TABELA DE AUDITORIA (LOGS)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    action_type VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    performed_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    details JSONB DEFAULT '{}'::jsonb
);

-- -------------------------------------------------------------
-- 23. TABELA DE TREINAMENTOS (LOOKUP / FALLBACK)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trainings (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------
-- 24. TABELA DE FOTOS DAS OBRAS (WORK_PHOTOS)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_photos (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "workId" VARCHAR(255) NOT NULL,
    "workName" VARCHAR(255) NOT NULL,
    "photoUrl" TEXT NOT NULL,
    observation TEXT,
    "uploadedBy" VARCHAR(255) NOT NULL,
    "uploadedByRole" VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- -------------------------------------------------------------
-- INSERT SEEDS DE CONFIGURAÇÃO E DEMONSTRAÇÃO COMPATIVEL
-- -------------------------------------------------------------
INSERT INTO company_departments (name) VALUES 
('Recursos Humanos'), ('Administrativo'), ('Financeiro'), ('Tecnologia'), ('Operações'), ('Marketing'), ('Vendas')
ON CONFLICT (name) DO NOTHING;

INSERT INTO company_roles (name) VALUES 
('Diretor'), ('Gerente de RH'), ('Analista de RH'), ('Assistente Administrativo'), ('Desenvolvedor'), ('Analista de Sistemas'), ('Designer'), ('Suporte')
ON CONFLICT (name) DO NOTHING;

INSERT INTO companies (id, name, trade_name, cnpj, phone, email, address_zip, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address) VALUES
(1, 'Minha Empresa S/A', 'Minha Empresa', '12.345.678/0001-99', '(11) 99999-9999', 'contato@minhaempresa.com', '01310-100', 'Avenida Paulista', '1000', 'Cj 12', 'Bela Vista', 'São Paulo', 'SP', 'Avenida Paulista, 1000')
ON CONFLICT (id) DO NOTHING;

-- SEEDS DE PROPRIEDADES DE COMPATIBILIDADE (AMOSTRA)
INSERT INTO properties (id, name, "addressZip", "addressStreet", "addressNumber", "addressComplement", "addressNeighborhood", "addressCity", "addressState", furniture, "residentIds", notes)
VALUES 
('prop-1', 'Casa Jardim das Flores - Porto Alegre', '90050-001', 'Rua da República', '120', 'Apto 302', 'Cidade Baixa', 'Porto Alegre', 'RS', 
 '[{"id": "f-1", "name": "Fogão de 4 bocas", "quantity": 1, "condition": "Regular"}, {"id": "f-2", "name": "Cama de Solteiro (com colchão)", "quantity": 2, "condition": "Bom"}, {"id": "f-3", "name": "Geladeira Duplex", "quantity": 1, "condition": "Novo"}, {"id": "f-4", "name": "Armário de Cozinha de Parede", "quantity": 1, "condition": "Bom"}]'::jsonb, 
 '["emp-1", "emp-2"]'::jsonb, 
 'Acomodação principal do pessoal da Pavimentação de Vias.'),
('prop-2', 'Alojamento Executivo - Curitiba', '80230-010', 'Avenida Sete de Setembro', '2500', 'Casa 2', 'Rebouças', 'Curitiba', 'PR', 
 '[{"id": "f-5", "name": "Geladeira Frost-Free", "quantity": 1, "condition": "Bom"}, {"id": "f-6", "name": "Cama de Solteiro", "quantity": 4, "condition": "Regular"}, {"id": "f-7", "name": "Fogão de 4 bocas a Gás", "quantity": 1, "condition": "Bom"}, {"id": "f-8", "name": "Mesa de Jantar com 4 Cadeiras", "quantity": 1, "condition": "Regular"}, {"id": "f-9", "name": "Máquina de Lavar Roupas 12kg", "quantity": 1, "condition": "Novo"}]'::jsonb, 
 '["emp-4"]'::jsonb, 
 'Fica próximo à Linha Verde.')
ON CONFLICT (id) DO NOTHING;

-- SEEDS DE FERRAMENTAS E EQUIPAMENTOS 
INSERT INTO tools (id, name, "serialNumber", category, quantity, condition, "responsibleEmployeeIds", "associatedWorkName", "assignmentDate", notes)
VALUES
('tool-1', 'Furadeira de Impacto Bosch GSB 13 RE', 'FE-BSH-901', 'Ferramenta Elétrica', 1, 'Bom', '["emp-1"]'::jsonb, 'Pavimentação de Vias RS-118', '2026-05-12', 'Entregue com maleta plástica e jogo completo de brocas de vídea.'),
('tool-2', 'Rompedor Pneumático Chicago Pneumatic CP 1230', 'RP-CP-445', 'Ferramenta Elétrica', 1, 'Regular', '["emp-2"]'::jsonb, 'Edifício Residencial Curitiba', '2026-04-18', 'Sempre manter lubrificado com óleo pneumático correto.'),
('tool-3', 'Andaime Metálico 1.5m Tubular (Jogo com 4 painéis)', 'AD-MET-003', 'Equipamento de Acesso', 3, 'Bom', '["emp-4"]'::jsonb, 'Edifício Residencial Curitiba', '2026-05-20', 'Apanhado diretamente no almoxarifado de Curitiba.'),
('tool-4', 'Escada Telescópica de Alumínio 3.8m Alupat', 'EC-ALU-108', 'Equipamento de Acesso', 1, 'Novo', '["emp-1"]'::jsonb, NULL, '2026-06-01', 'Equipamento super leve, sob a guarda permanente na caminhonete administrativa.')
ON CONFLICT (id) DO NOTHING;

-- SEEDS DE OBRAS E CRONOGRAMAS
INSERT INTO works (id, name, "contactName", "contactPhone", "addressZip", "addressStreet", "addressNumber", "addressComplement", "addressNeighborhood", "addressCity", "addressState", type, "employeeIds", "propertyId", "toolIds", "startDate", "estimatedEndDate", status, notes)
VALUES
('work-1', 'Duplicação do Viaduto Principal - Porto Alegre', 'Eng. Ricardo Rezende', '(51) 98888-7711', '90050-001', 'Avenida Farrapos', '1500', 'Canteiro Central', 'Floresta', 'Porto Alegre', 'RS', 'Instalação', '["emp-1", "emp-2"]'::jsonb, 'prop-1', '["tool-1", "tool-4"]'::jsonb, '2026-06-01', '2026-08-30', 'Em Andamento', 'Obra de alta visibilidade e prioridade máxima do consórcio municipal.'),
('work-2', 'Adequação Elétrica de Galpão - Curitiba', 'Mestre Gilberto Souza', '(41) 97777-6622', '80230-010', 'Rua do Hauer', '440', 'Bloco B', 'Hauer', 'Curitiba', 'PR', 'Adequação', '["emp-4"]'::jsonb, 'prop-2', '["tool-2", "tool-3"]'::jsonb, '2026-05-15', '2026-06-25', 'Em Andamento', 'Alojamento próximo ao local facilita o trâmite logístico diário da equipe.')
ON CONFLICT (id) DO NOTHING;
