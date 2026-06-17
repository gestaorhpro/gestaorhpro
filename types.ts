
export enum Page {
  DASHBOARD = 'DASHBOARD',
  EMPLOYEES = 'EMPLOYEES',
  EMPLOYEE_FORM = 'EMPLOYEE_FORM',
  PPE_CONTROL = 'PPE_CONTROL',
  TIME_TRACKING = 'TIME_TRACKING',
  TRAININGS = 'TRAININGS',
  PROPERTIES = 'PROPERTIES',
  TOOLS = 'TOOLS',
  WORKS = 'WORKS',
  REPORTS = 'REPORTS',
  SETTINGS = 'SETTINGS',
  PROFILE = 'PROFILE',
  HELP = 'HELP',
  AUDIT = 'AUDIT',
  PHOTOS = 'PHOTOS'
}

export interface WorkPhoto {
  id: string;
  workId: string;
  workName: string;
  photoUrl: string; // Base64 data or mock stable url
  observation?: string;
  uploadedBy: string; // Who uploaded (Colaborador name/ID)
  uploadedByRole?: string; // Role of the uploader
  createdAt: string; // iso datetime
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  status: 'Ativo' | 'Inativo' | 'Férias' | 'Atestado / Afastamento';
  admissionDate: string;
  birthDate?: string;
  phone?: string;
  cpf?: string; 
  rg?: string; // Novo campo RG
  ctps?: string; // Carteira de trabalho
  cnh?: string; // Carteira de motorista
  cnhCategory?: string; // Categoria do CNH (A, B, C, D, E, etc.)
  certifications?: Certification[]; // Cursos e especializações (Ex: Operador de Munck, NR35, etc.)
  
  // Campos de Endereço Detalhados
  addressZip?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  address?: string; // Mantido para compatibilidade legado visual

  // Campos de Férias
  vacationStartDate?: string;
  vacationEndDate?: string;
  vacationNotify?: boolean;

  // Tamanhos de EPI / Uniforme / Calçados
  shoeSize?: string;       // Tamanho de calçado
  shoeType?: string;       // Tipo do Calçado (botina, bota, etc.)
  shirtSize?: string;      // Tamanho da camiseta
  dressShirtSize?: string; // Tamanho da camisa
  pantsSize?: string;      // Tamanho da calça
  jacketSize?: string;     // Tamanho da jaqueta
  salary?: number;         // Salário do colaborador
  advances?: SalaryAdvance[]; // Lista de adiantamentos e vales
}

export interface SalaryAdvance {
  id: string;
  type: 'Vale' | 'Adiantamento' | 'Outros';
  amount: number;
  date: string; // Data do adiantamento/vale (YYYY-MM-DD)
  notes?: string;
}

export interface PPEItem {
  id: string;
  name: string;
  stock: number;
  expiryAlert: boolean;
}

export interface Certification {
  id: string; // ID único para controle
  name: string; // Nome do curso (ex: NR-35 Trabalho em Altura, Operador de Munck, NR-11 Ponte Rolante, Camião Prancha, Empilhadeira, Retroescavadeira, etc.)
  type?: 'curso' | 'nr'; // Tipo diferenciador: curso de especialização ou norma regulamentadora (NR)
  institution?: string; // Instituição emissora (ex: SENAI, SESI, etc.)
  completionDate: string; // Data de conclusão do curso
  expirationDate?: string; // Data de validade/vencimento
  certificateNumber?: string; // Número do certificado/registro
}

export interface FurnitureItem {
  id: string;
  name: string; // e.g., Fogão, Cama de solteiro, Geladeira, Armário
  quantity: number;
  condition: 'Novo' | 'Bom' | 'Regular' | 'Ruim'; // Estado de conservação
  notes?: string;
}

export interface Property {
  id: string;
  name: string; // Nome descritivo, ex: Casa de Porto Alegre, Alojamento Curitiba
  addressZip: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement?: string;
  addressNeighborhood: string;
  addressCity: string;
  addressState: string;
  furniture: FurnitureItem[];
  residentIds: string[]; // List of employee IDs staying at this property
  associatedWorkId?: string; // ID da obra (para o próximo módulo)
  associatedWorkName?: string; // Nome da obra (para o próximo módulo)
  notes?: string;
}

export interface ToolEquipment {
  id: string;
  name: string; // e.g., Furadeira de Impacto Bosch, Rompedor Makita, Andaime de Metal
  serialNumber?: string; // Código de registro ou número de série
  category: 'Ferramenta Elétrica' | 'Ferramenta Manual' | 'Equipamento de Proteção' | 'Equipamento de Acesso' | 'Outros'; 
  quantity: number;
  condition: 'Novo' | 'Bom' | 'Regular' | 'Ruim';
  responsibleEmployeeIds: string[]; // IDs dos colaboradores responsáveis pela guarda/uso
  associatedWorkId?: string; // ID da obra
  associatedWorkName?: string; // Nome do canteiro/obra onde está alocado
  assignmentDate?: string; // Data de atribuição/entrega do termo de responsabilidade
  notes?: string;
}

export interface Work {
  id: string;
  name: string; // Nome da obra
  contactName?: string; // Contato responsável
  contactPhone?: string; // Telefone do contato
  addressZip?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  type: 'Instalação' | 'Manutenção' | 'Montagem' | 'Desmontagem' | 'Adequação' | 'Outros'; // Tipo de obra
  employeeIds: string[]; // IDs dos colaboradores alocados nesta obra
  propertyId?: string; // ID do imóvel/alojamento associado à obra
  toolIds: string[]; // IDs das ferramentas alocadas nesta obra
  startDate: string; // Data de início (YYYY-MM-DD)
  estimatedEndDate: string; // Data estimada de término (YYYY-MM-DD)
  notes?: string; // Observações gerais
  status: 'Planejado' | 'Em Andamento' | 'Pausado' | 'Concluído' | 'Atrasado'; // Status do projeto
}

