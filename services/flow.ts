import { Page } from '../types';
import { supabase } from './supabase';

export interface FlowStep {
  stepNumber: number;
  id: string;
  title: string;
  description: string;
  page: Page;
  icon: string;
  requiredAction: string;
}

export const IMPLANTATION_STEPS: FlowStep[] = [
  {
    stepNumber: 1,
    id: 'company',
    title: 'Perfil da Empresa',
    description: 'Configure os dados institucionais, departamentos e cargos.',
    page: Page.SETTINGS,
    icon: 'business',
    requiredAction: 'Configurar dados da empresa'
  },
  {
    stepNumber: 2,
    id: 'employees',
    title: 'Colaboradores & Acessos',
    description: 'Cadastre a equipe com funções, CPFs e dados trabalhistas.',
    page: Page.EMPLOYEES,
    icon: 'groups',
    requiredAction: 'Cadastrar colaboradores ativos'
  },
  {
    stepNumber: 3,
    id: 'trainings',
    title: 'Treinamentos & NRs',
    description: 'Vincule cursos técnicos e conformidades nas Normas Regulamentadoras.',
    page: Page.TRAININGS,
    icon: 'school',
    requiredAction: 'Registrar capacitações técnicas'
  },
  {
    stepNumber: 4,
    id: 'ppe',
    title: 'Controle de EPIs',
    description: 'Catalogue o almoxarifado de proteção para a entrega de fardamento/EPIs.',
    page: Page.PPE_CONTROL,
    icon: 'health_and_safety',
    requiredAction: 'Cadastrar EPIs e fornecedores'
  },
  {
    stepNumber: 5,
    id: 'properties',
    title: 'Imóveis & Mobília',
    description: 'Cadastre alojamentos ou imóveis de apoio técnico e suas mobílias.',
    page: Page.PROPERTIES,
    icon: 'holiday_village',
    requiredAction: 'Cadastrar imóveis ou alojamentos'
  },
  {
    stepNumber: 6,
    id: 'tools',
    title: 'Ferramental & Equipamentos',
    description: 'Crie termos de guarda de ferramentas elétricas/manuais alocadas.',
    page: Page.TOOLS,
    icon: 'handyman',
    requiredAction: 'Cadastrar ferramentas e termos'
  },
  {
    stepNumber: 7,
    id: 'works',
    title: 'Obras e Projetos',
    description: 'Vincule alojamentos, colaboradores e caixas de ferramentas ao canteiro ativo.',
    page: Page.WORKS,
    icon: 'construction',
    requiredAction: 'Criar uma obra ativa e vincular recursos'
  }
];

export interface FlowStatus {
  stepId: string;
  isCompleted: boolean;
  count: number;
}

/**
 * Consulta o banco de dados simulado e retorna o status em tempo real de cada passo
 */
export async function getImplantationStatus(): Promise<Record<string, FlowStatus>> {
  const status: Record<string, FlowStatus> = {
    company: { stepId: 'company', isCompleted: false, count: 0 },
    employees: { stepId: 'employees', isCompleted: false, count: 0 },
    trainings: { stepId: 'trainings', isCompleted: false, count: 0 },
    ppe: { stepId: 'ppe', isCompleted: false, count: 0 },
    properties: { stepId: 'properties', isCompleted: false, count: 0 },
    tools: { stepId: 'tools', isCompleted: false, count: 0 },
    works: { stepId: 'works', isCompleted: false, count: 0 }
  };

  try {
    // 1. Company Profiling (has departments configured or custom trade name)
    const { data: cpData } = await supabase.from('companies').select('*');
    if (cpData && cpData.length > 0) {
      status.company.count = cpData.length;
      status.company.isCompleted = true;
    }

    // 2. Headcount
    const { data: empData } = await supabase.from('employees').select('*');
    if (empData && empData.length > 0) {
      status.employees.count = empData.length;
      // Let's assume it is complete if at least 1 employee is registered
      status.employees.isCompleted = empData.length > 0;
    }

    // 3. Training/NR certification completion (We check if at least one employee has certifications)
    let certCount = 0;
    if (empData) {
      empData.forEach((e: any) => {
        if (e.certifications && e.certifications.length > 0) {
          certCount += e.certifications.length;
        }
      });
    }
    // Also let's check external trainings table if any
    const { data: trainData } = await supabase.from('trainings').select('*');
    if (trainData) {
      certCount += trainData.length;
    }
    status.trainings.count = certCount;
    status.trainings.isCompleted = certCount > 0;

    // 4. PPE stocks
    const { data: ppeData } = await supabase.from('ppe_items').select('*');
    if (ppeData && ppeData.length > 0) {
      status.ppe.count = ppeData.length;
      status.ppe.isCompleted = ppeData.length > 0;
    }

    // 5. Lodgings
    const { data: propData } = await supabase.from('properties').select('*');
    if (propData && propData.length > 0) {
      status.properties.count = propData.length;
      status.properties.isCompleted = propData.length > 0;
    }

    // 6. Tools custody
    const { data: toolData } = await supabase.from('tools').select('*');
    if (toolData && toolData.length > 0) {
      status.tools.count = toolData.length;
      status.tools.isCompleted = toolData.length > 0;
    }

    // 7. Works
    const { data: workData } = await supabase.from('works').select('*');
    if (workData && workData.length > 0) {
      status.works.count = workData.length;
      status.works.isCompleted = workData.length > 0;
    }
  } catch (error) {
    console.error('Falha ao consultar status de implantacao:', error);
  }

  return status;
}
