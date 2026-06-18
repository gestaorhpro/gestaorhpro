
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Page, Employee, Certification } from '../types';
import { logAction } from '../services/audit';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface EmployeesProps {
  setPage: (page: Page) => void;
  subView?: 'LIST' | 'FORM';
  initialOpenVales?: boolean;
  onValesClose?: () => void;
}

export const getCertType = (cert: Certification): 'curso' | 'nr' => {
  if (cert.type === 'nr' || cert.type === 'curso') return cert.type;
  if (/nr[- ]?\d+/i.test(cert.name)) {
    return 'nr';
  }
  return 'curso';
};

const Employees: React.FC<EmployeesProps> = ({ setPage, subView = 'LIST', initialOpenVales, onValesClose }) => {
  const [view, setView] = useState<'LIST' | 'FORM'>(subView);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Quick/Direct Vales State
  const [isDirectValesOpen, setIsDirectValesOpen] = useState(false);
  const [valesEmployee, setValesEmployee] = useState<Employee | null>(null);
  const [directValesType, setDirectValesType] = useState<'Vale' | 'Adiantamento' | 'Outros'>('Vale');
  const [directValesAmount, setDirectValesAmount] = useState('');
  const [directValesDate, setDirectValesDate] = useState(new Date().toISOString().split('T')[0]);
  const [directValesNotes, setDirectValesNotes] = useState('');
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('Todos');
  const [roleFilter, setRoleFilter] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // View & Print Modal State
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);

  // Form State
  const [formData, setFormData] = useState<Partial<Employee>>({
    name: '',
    role: '',
    department: '',
    phone: '',
    status: 'Ativo',
    admissionDate: new Date().toISOString().split('T')[0],
    birthDate: '',
    cpf: '',
    rg: '',
    ctps: '',
    cnh: '',
    cnhCategory: '',
    addressZip: '',
    addressStreet: '',
    addressNumber: '',
    addressComplement: '',
    addressNeighborhood: '',
    addressCity: '',
    addressState: '',
    vacationStartDate: '',
    vacationEndDate: '',
    vacationNotify: false,
    certifications: [],
    shoeSize: '',
    shoeType: '',
    shirtSize: '',
    dressShirtSize: '',
    pantsSize: '',
    jacketSize: '',
    salary: undefined,
    advances: []
  });
  const [isEditing, setIsEditing] = useState(false);

  // Helper lists for inline editing dropdowns (fetched from Settings tables)
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);

  // Inline Editing State
  const [editingCell, setEditingCell] = useState<{ id: string, field: 'department' | 'role' } | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [isSavingInline, setIsSavingInline] = useState(false);

  // Adiantamentos & Vales Form State
  const [newAdvanceType, setNewAdvanceType] = useState<'Vale' | 'Adiantamento' | 'Outros'>('Vale');
  const [newAdvanceAmount, setNewAdvanceAmount] = useState<string>('');
  const [newAdvanceDate, setNewAdvanceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newAdvanceNotes, setNewAdvanceNotes] = useState<string>('');

  const handleAddAdvance = () => {
    const amt = parseFloat(newAdvanceAmount);
    if (!amt || isNaN(amt)) {
      alert("Por favor, informe um valor válido para o vale/adiantamento.");
      return;
    }
    if (!newAdvanceDate) {
      alert("Por favor, selecione uma data.");
      return;
    }

    const newAdvance = {
      id: 'adv-' + Date.now(),
      type: newAdvanceType,
      amount: amt,
      date: newAdvanceDate,
      notes: newAdvanceNotes.trim() || undefined
    };

    const currentAdvances = formData.advances || [];
    setFormData(prev => ({
      ...prev,
      advances: [...currentAdvances, newAdvance]
    }));

    // Reset input fields
    setNewAdvanceAmount('');
    setNewAdvanceNotes('');
  };

  const handleRemoveAdvance = (id: string) => {
    const currentAdvances = formData.advances || [];
    setFormData(prev => ({
      ...prev,
      advances: currentAdvances.filter(item => item.id !== id)
    }));
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (subView === 'FORM') {
        handleNewEmployee();
    }
  }, [subView]);

  useEffect(() => {
    if (initialOpenVales && employees.length > 0) {
      setIsDirectValesOpen(true);
      if (!valesEmployee) {
        setValesEmployee(employees[0]);
      }
    }
  }, [initialOpenVales, employees]);

  const handleCloseDirectVales = () => {
    setIsDirectValesOpen(false);
    setValesEmployee(null);
    setDirectValesAmount('');
    setDirectValesNotes('');
    if (onValesClose) {
      onValesClose();
    }
  };

  const handleAddDirectAdvance = async () => {
    const amt = parseFloat(directValesAmount);
    if (!amt || isNaN(amt)) {
      alert("Por favor, informe um valor válido para o vale/adiantamento.");
      return;
    }
    if (!directValesDate) {
      alert("Por favor, selecione uma data.");
      return;
    }
    if (!valesEmployee) {
      alert("Por favor, selecione um colaborador.");
      return;
    }

    const newAdvance = {
      id: 'adv-' + Date.now(),
      type: directValesType,
      amount: amt,
      date: directValesDate,
      notes: directValesNotes.trim() || undefined
    };

    try {
      const currentAdvances = valesEmployee.advances || [];
      const updatedAdvances = [...currentAdvances, newAdvance];

      // Save to Supabase
      const { error } = await supabase
        .from('employees')
        .update({ advances: updatedAdvances })
        .eq('id', valesEmployee.id);

      if (error) throw error;

      // Log action
      await logAction(
        'FINANC_TRANSACTION',
        `Lançamento de ${directValesType} de R$ ${amt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para ${valesEmployee.name}`,
        { employee_id: valesEmployee.id, employee_name: valesEmployee.name, amount: amt, type: directValesType }
      );

      // Update local states
      const updatedEmployee = { ...valesEmployee, advances: updatedAdvances };
      setValesEmployee(updatedEmployee);
      setEmployees(prev => prev.map(e => e.id === valesEmployee.id ? updatedEmployee : e));
      
      // Clean form fields
      setDirectValesAmount('');
      setDirectValesNotes('');
      alert(`Lançamento realizado com sucesso para ${valesEmployee.name}!`);
    } catch (err) {
      console.error("Erro ao registrar vale diretamente:", err);
      alert("Erro ao salvar o vale no banco de dados.");
    }
  };

  const handleDeleteDirectAdvance = async (advanceId: string) => {
    if (!valesEmployee) return;
    if (!confirm("Tem certeza que deseja remover este lançamento?")) return;

    try {
      const currentAdvances = valesEmployee.advances || [];
      const updatedAdvances = currentAdvances.filter(item => item.id !== advanceId);

      const { error } = await supabase
        .from('employees')
        .update({ advances: updatedAdvances })
        .eq('id', valesEmployee.id);

      if (error) throw error;

      // Log action
      await logAction(
        'FINANC_TRANSACTION_REMOVE',
        `Remoção de lançamento de vale/adiantamento para ${valesEmployee.name}`,
        { employee_id: valesEmployee.id, employee_name: valesEmployee.name }
      );

      // Update local states
      const updatedEmployee = { ...valesEmployee, advances: updatedAdvances };
      setValesEmployee(updatedEmployee);
      setEmployees(prev => prev.map(e => e.id === valesEmployee.id ? updatedEmployee : e));
    } catch (err) {
      console.error("Erro ao remover vale diretamente:", err);
      alert("Erro ao remover o vale do banco de dados.");
    }
  };

  const fetchEmployees = async () => {
    setIsLoading(true);
    
    // 1. Fetch Employees
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('name');
    
    // 2. Fetch Configured Structure (Departments & Roles) from Settings
    const { data: deptData } = await supabase.from('company_departments').select('name').order('name');
    const { data: roleData } = await supabase.from('company_roles').select('name').order('name');
    const { data: propertiesData } = await supabase.from('properties').select('*');
    const { data: toolsData } = await supabase.from('tools').select('*');

    if (propertiesData) {
      setProperties(propertiesData);
    }

    if (toolsData) {
      setTools(toolsData);
    }

    if (error) {
      console.error('Error fetching employees:', error);
    } else if (data) {
      const mappedEmployees: Employee[] = data.map((e: any) => ({
        id: e.id,
        name: e.name,
        role: e.role,
        department: e.department,
        status: e.status,
        admissionDate: e.admission_date,
        birthDate: e.birth_date,
        phone: e.phone,
        cpf: e.cpf,
        rg: e.rg,
        ctps: e.ctps,
        cnh: e.cnh,
        cnhCategory: e.cnh_category,
        // Endereço
        addressZip: e.address_zip,
        addressStreet: e.address_street,
        addressNumber: e.address_number,
        addressComplement: e.address_complement,
        addressNeighborhood: e.address_neighborhood,
        addressCity: e.address_city,
        addressState: e.address_state,
        address: e.address_street ? `${e.address_street}, ${e.address_number} - ${e.address_city}/${e.address_state}` : e.address, // Fallback legacy
        // Férias
        vacationStartDate: e.vacation_start_date,
        vacationEndDate: e.vacation_end_date,
        vacationNotify: e.vacation_notify,
        certifications: Array.isArray(e.certifications) 
          ? e.certifications 
          : (typeof e.certifications === 'string' ? JSON.parse(e.certifications) : []),
        // Tamanhos
        shoeSize: e.shoe_size,
        shoeType: e.shoe_type,
        shirtSize: e.shirt_size,
        dressShirtSize: e.dress_shirt_size,
        pantsSize: e.pants_size,
        jacketSize: e.jacket_size,
        salary: e.salary,
        advances: Array.isArray(e.advances) 
          ? e.advances 
          : (typeof e.advances === 'string' ? JSON.parse(e.advances) : [])
      }));
      setEmployees(mappedEmployees);

      // Merge structure from employees (historical) and settings (configured)
      // This ensures even if a role was deleted from settings but exists in an employee, it appears in lists
      const empRoles = mappedEmployees.map(e => e.role).filter(Boolean);
      const configRoles = roleData?.map((r: any) => r.name) || [];
      const uniqueRoles = Array.from(new Set([...empRoles, ...configRoles])).sort();

      const empDepts = mappedEmployees.map(e => e.department).filter(Boolean);
      const configDepts = deptData?.map((d: any) => d.name) || [];
      const uniqueDepts = Array.from(new Set([...empDepts, ...configDepts])).sort();

      setAvailableRoles(uniqueRoles);
      setAvailableDepartments(uniqueDepts);
    }
    setIsLoading(false);
  };

  const handleNewEmployee = () => {
    setFormData({
        name: '',
        role: '',
        department: '',
        phone: '',
        status: 'Ativo',
        admissionDate: new Date().toISOString().split('T')[0],
        birthDate: '',
        cpf: '',
        rg: '',
        ctps: '',
        cnh: '',
        cnhCategory: '',
        addressZip: '',
        addressStreet: '',
        addressNumber: '',
        addressComplement: '',
        addressNeighborhood: '',
        addressCity: '',
        addressState: '',
        vacationStartDate: '',
        vacationEndDate: '',
        vacationNotify: false,
        certifications: [],
        shoeSize: '',
        shoeType: '',
        shirtSize: '',
        dressShirtSize: '',
        pantsSize: '',
        jacketSize: '',
        salary: undefined,
        advances: []
    });
    setIsEditing(false);
    setView('FORM');
  };

  const handleEditEmployee = (emp: Employee) => {
    setFormData({
      ...emp,
      certifications: emp.certifications || []
    });
    setIsEditing(true);
    setView('FORM');
  };

  const handleViewEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setShowViewModal(true);
  };

  // --- Address / ViaCEP Logic ---
  const handleCepBlur = async () => {
    const cep = formData.addressZip?.replace(/\D/g, '');
    if (cep?.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          addressStreet: data.logradouro,
          addressNeighborhood: data.bairro,
          addressCity: data.localidade,
          addressState: data.uf
        }));
      } else {
        alert("CEP não encontrado.");
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
    }
  };

  // --- CPF Validation Logic ---
  const validateCPF = (cpf: string) => {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf === '') return false;
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    
    let add = 0;
    for (let i = 0; i < 9; i++) add += parseInt(cpf.charAt(i)) * (10 - i);
    let rev = 11 - (add % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cpf.charAt(9))) return false;
    
    add = 0;
    for (let i = 0; i < 10; i++) add += parseInt(cpf.charAt(i)) * (11 - i);
    rev = 11 - (add % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cpf.charAt(10))) return false;
    
    return true;
  };

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const [cpfError, setCpfError] = useState('');

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatCPF(e.target.value);
      setFormData(prev => ({ ...prev, cpf: formatted }));
      
      if (formatted.length === 14) {
          if (!validateCPF(formatted)) {
              setCpfError('CPF Inválido');
          } else {
              setCpfError('');
          }
      } else {
          setCpfError('');
      }
  };
  // ---------------------------

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (cpfError) {
        alert("Corrija o CPF antes de salvar.");
        return;
    }

    const payload = {
        name: formData.name,
        role: formData.role,
        department: formData.department,
        phone: formData.phone,
        status: formData.status,
        admission_date: formData.admissionDate,
        birth_date: formData.birthDate || null,
        cpf: formData.cpf,
        rg: formData.rg,
        ctps: formData.ctps || null,
        cnh: formData.cnh || null,
        cnh_category: formData.cnhCategory || null,
        certifications: formData.certifications || [],
        // Endereço
        address_zip: formData.addressZip,
        address_street: formData.addressStreet,
        address_number: formData.addressNumber,
        address_complement: formData.addressComplement,
        address_neighborhood: formData.addressNeighborhood,
        address_city: formData.addressCity,
        address_state: formData.addressState,
        // Férias
        vacation_start_date: formData.status === 'Férias' ? formData.vacationStartDate || null : null,
        vacation_end_date: formData.status === 'Férias' ? formData.vacationEndDate || null : null,
        vacation_notify: formData.status === 'Férias' ? formData.vacationNotify : false,
        // Tamanhos de EPI
        shoe_size: formData.shoeSize || null,
        shoe_type: formData.shoeType || null,
        shirt_size: formData.shirtSize || null,
        dress_shirt_size: formData.dressShirtSize || null,
        pants_size: formData.pantsSize || null,
        jacket_size: formData.jacketSize || null,
        salary: formData.salary || null,
        advances: formData.advances || []
    };

    if (isEditing && formData.id) {
        const oldEmployee = employees.find(e => e.id === formData.id);
        await supabase.from('employees').update(payload).eq('id', formData.id);
        
        if (oldEmployee) {
          const oldSalary = oldEmployee.salary !== undefined && oldEmployee.salary !== null ? Number(oldEmployee.salary) : null;
          const newSalary = payload.salary !== undefined && payload.salary !== null ? Number(payload.salary) : null;
          
          if (oldSalary !== newSalary) {
            await logAction(
              'SALARY_UPDATE', 
              `Atualização de salário de ${formData.name}: de R$ ${oldSalary !== null ? oldSalary.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : 'não informado'} para R$ ${newSalary !== null ? newSalary.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : 'não informado'}`,
              { employee_id: formData.id, employee_name: formData.name, old_salary: oldSalary, new_salary: newSalary }
            );
          } else {
            await logAction(
              'EMPLOYEE_UPDATE',
              `Dados do colaborador ${formData.name} foram atualizados`,
              { employee_id: formData.id, employee_name: formData.name }
            );
          }
        }
    } else {
        await supabase.from('employees').insert([payload]);
        const initialSalary = payload.salary !== null ? Number(payload.salary) : null;
        await logAction(
          'EMPLOYEE_CREATE', 
          `Cadastro do colaborador ${formData.name} com cargo de ${formData.role} e salário de R$ ${initialSalary !== null ? initialSalary.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : 'não informado'}`,
          { employee_name: formData.name, role: formData.role, salary: initialSalary }
        );
    }

    await fetchEmployees();
    setView('LIST');
  };

  const handleDelete = async (id: string) => {
      if(confirm("Tem certeza que deseja remover este colaborador?")) {
          const deletedEmployee = employees.find(e => e.id === id);
          await supabase.from('employees').delete().eq('id', id);
          setEmployees(prev => prev.filter(e => e.id !== id));
          if (deletedEmployee) {
              await logAction(
                'EMPLOYEE_DELETE', 
                `Remoção do colaborador ${deletedEmployee.name}`, 
                { employee_name: deletedEmployee.name, role: deletedEmployee.role }
              );
          }
      }
  };

  // --- Inline Editing Handlers (Start -> Edit -> Save) ---
  
  const startEditing = (id: string, field: 'department' | 'role', currentValue: string) => {
    setEditingCell({ id, field });
    setTempValue(currentValue);
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setTempValue('');
  };

  const saveEditing = async () => {
    if (!editingCell) return;
    
    setIsSavingInline(true);
    const { id, field } = editingCell;

    try {
        // Optimistic update locally
        setEmployees(prev => prev.map(e => e.id === id ? { ...e, [field]: tempValue } : e));

        // DB Update
        const { error } = await supabase
            .from('employees')
            .update({ [field]: tempValue })
            .eq('id', id);

        if (error) throw error;
        
        // Success
        setEditingCell(null);
        setTempValue('');

    } catch (error: any) {
        alert("Erro ao salvar alteração: " + error.message);
        // Rollback on error
        await fetchEmployees();
    } finally {
        setIsSavingInline(false);
    }
  };

  // --- Printing Logic ---
  const handlePrint = () => {
    if (!selectedEmployee) return;

    // Get Company Data
    const company = JSON.parse(localStorage.getItem('gestaorh_company_data') || '{}');
    const companyName = company.companyName || 'GestãoRH Pro Ltda';
    const companyCNPJ = company.cnpj || '00.000.000/0001-00';

    const fullAddress = selectedEmployee.addressStreet 
        ? `${selectedEmployee.addressStreet}, ${selectedEmployee.addressNumber} ${selectedEmployee.addressComplement || ''} - ${selectedEmployee.addressNeighborhood}, ${selectedEmployee.addressCity}/${selectedEmployee.addressState} - CEP: ${selectedEmployee.addressZip}`
        : selectedEmployee.address || 'Não informado';

    const certSpecializations = (selectedEmployee.certifications || []).filter(c => getCertType(c) === 'curso');
    const certNRs = (selectedEmployee.certifications || []).filter(c => getCertType(c) === 'nr');

    const specRowsHtml = certSpecializations.length > 0
      ? certSpecializations.map(c => {
          const compDate = c.completionDate ? new Date(c.completionDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '-';
          return `
            <tr style="border-bottom: 1px dotted #ccc;">
              <td style="padding: 6px 8px; font-weight: bold;">${c.name}</td>
              <td style="padding: 6px 8px;">${c.institution || '-'}</td>
              <td style="padding: 6px 8px;">${compDate}</td>
              <td style="padding: 6px 8px;">${c.certificateNumber || '-'}</td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="4" style="padding: 10px; text-align: center; color: #777;">Nenhum curso de especialização registrado na ficha deste colaborador.</td></tr>';

    const nrRowsHtml = certNRs.length > 0
      ? certNRs.map(c => {
          const isExpired = c.expirationDate && new Date(c.expirationDate) < new Date();
          const compDate = c.completionDate ? new Date(c.completionDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '-';
          const expDate = c.expirationDate ? new Date(c.expirationDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'Sem Validade';
          const expiredLabel = isExpired ? ' <strong>(VENCIDO)</strong>' : '';
          const expiredStyle = isExpired ? 'color: red; font-weight: bold;' : '';
          return `
            <tr style="border-bottom: 1px dotted #ccc;">
              <td style="padding: 6px 8px; font-weight: bold;">${c.name}</td>
              <td style="padding: 6px 8px;">${c.institution || '-'}</td>
              <td style="padding: 6px 8px;">${compDate}</td>
              <td style="padding: 6px 8px; ${expiredStyle}">
                ${expDate}${expiredLabel}
              </td>
              <td style="padding: 6px 8px;">${c.certificateNumber || '-'}</td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="5" style="padding: 10px; text-align: center; color: #777;">Nenhuma Norma Regulamentadora (NR) registrada na ficha deste colaborador.</td></tr>';

    const printWindow = window.open('', '_blank', 'width=850,height=1100');
    if (printWindow) {
      const content = `
        <html>
          <head>
            <title>Ficha de Registro - ${selectedEmployee.name}</title>
            <style>
              body { font-family: 'Arial', sans-serif; padding: 40px; color: #333; line-height: 1.5; }
              .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
              .header h1 { font-size: 22px; margin: 0; text-transform: uppercase; }
              .header p { margin: 5px 0 0; font-size: 14px; color: #555; }
              
              .section-title { background-color: #f3f4f6; padding: 8px 12px; font-weight: bold; border-left: 4px solid #333; margin: 20px 0 15px 0; text-transform: uppercase; font-size: 14px; }
              
              .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
              .full-width { grid-column: span 2; }
              
              .field { margin-bottom: 10px; border-bottom: 1px dotted #ccc; padding-bottom: 2px; }
              .label { font-size: 11px; text-transform: uppercase; color: #666; display: block; margin-bottom: 2px; font-weight: bold; }
              .value { font-size: 15px; min-height: 20px; display: block; }

              .photo-placeholder { width: 100px; height: 130px; border: 1px solid #ccc; background: #f9f9f9; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #999; position: absolute; top: 40px; right: 40px; }

              .footer { margin-top: 60px; text-align: center; font-size: 12px; border-top: 1px solid #333; padding-top: 20px; }
              .signatures { display: flex; justify-content: space-between; margin-top: 80px; }
              .sig-box { width: 45%; border-top: 1px solid #333; text-align: center; padding-top: 10px; font-size: 12px; }

              @media print {
                body { padding: 0; }
                .section-title { -webkit-print-color-adjust: exact; }
              }
            </style>
          </head>
          <body>
            <div class="photo-placeholder">FOTO 3x4</div>
            
            <div class="header">
              <h1>Ficha de Registro de Empregado</h1>
              <p>${companyName} • CNPJ: ${companyCNPJ}</p>
            </div>

            <div class="section-title">Dados Pessoais</div>
            <div class="grid">
               <div class="field full-width">
                 <span class="label">Nome Completo</span>
                 <span class="value">${selectedEmployee.name}</span>
               </div>
               <div class="field">
                 <span class="label">CPF</span>
                 <span class="value">${selectedEmployee.cpf || 'Não informado'}</span>
               </div>
               <div class="field">
                 <span class="label">RG</span>
                 <span class="value">${selectedEmployee.rg || 'Não informado'}</span>
               </div>
               <div class="field">
                 <span class="label">Data de Nascimento</span>
                 <span class="value">${selectedEmployee.birthDate ? new Date(selectedEmployee.birthDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '---'}</span>
               </div>
               <div class="field">
                 <span class="label">Telefone</span>
                 <span class="value">${selectedEmployee.phone || '---'}</span>
               </div>
               <div class="field">
                 <span class="label">Carteira de Trabalho (CTPS)</span>
                 <span class="value">${selectedEmployee.ctps || '---'}</span>
               </div>
               <div class="field">
                 <span class="label">Carteira de Motorista (CNH)</span>
                 <span class="value">${selectedEmployee.cnh ? `${selectedEmployee.cnh}${selectedEmployee.cnhCategory ? ` (Cat. ${selectedEmployee.cnhCategory})` : ''}` : '---'}</span>
               </div>
               <div class="field full-width">
                 <span class="label">Endereço Completo</span>
                 <span class="value">${fullAddress}</span>
               </div>
            </div>

            <div class="section-title">Dados Contratuais</div>
            <div class="grid">
               <div class="field">
                 <span class="label">Cargo / Função</span>
                 <span class="value">${selectedEmployee.role}</span>
               </div>
               <div class="field">
                 <span class="label">Departamento</span>
                 <span class="value">${selectedEmployee.department}</span>
               </div>
               <div class="field">
                 <span class="label">Data de Admissão</span>
                 <span class="value">${new Date(selectedEmployee.admissionDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</span>
               </div>
               <div class="field">
                 <span class="label">Status Atual</span>
                 <span class="value">${selectedEmployee.status}</span>
               </div>
               <div class="field">
                 <span class="label">Salário Mensal</span>
                 <span class="value">${selectedEmployee.salary ? 'R$ ' + selectedEmployee.salary.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Não informado'}</span>
               </div>
            </div>

            <div class="section-title">Logística de EPI / Uniformes</div>
            <div class="grid" style="margin-bottom: 8px;">
               <div class="field" style="grid-column: span 2;">
                 <span class="label">Calçados & Botas</span>
                 <span class="value">${selectedEmployee.shoeType || 'Não informado'}${selectedEmployee.shoeSize ? ` (Tamanho: ${selectedEmployee.shoeSize})` : ''}</span>
               </div>
            </div>
            <div class="grid" style="margin-bottom: 8px;">
               <div class="field">
                 <span class="label">Tamanho da Camiseta</span>
                 <span class="value">${selectedEmployee.shirtSize || 'Não informado'}</span>
               </div>
               <div class="field">
                 <span class="label">Tamanho da Camisa</span>
                 <span class="value">${selectedEmployee.dressShirtSize || 'Não informado'}</span>
               </div>
               <div class="field">
                 <span class="label">Tamanho da Jaqueta / Blusa</span>
                 <span class="value">${selectedEmployee.jacketSize || 'Não informado'}</span>
               </div>
            </div>
            <div class="grid" style="margin-bottom: 15px;">
               <div class="field">
                 <span class="label">Tamanho da Calça</span>
                 <span class="value">${selectedEmployee.pantsSize || 'Não informado'}</span>
               </div>
            </div>

            <div class="section-title">Vales & Adiantamentos</div>
            <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:20px;">
              <thead>
                <tr style="border-bottom:2px solid #333; text-align:left; background-color:#f3f4f6;">
                  <th style="padding:6px 8px; font-size:10px; text-transform:uppercase; width:20%;">Tipo</th>
                  <th style="padding:6px 8px; font-size:10px; text-transform:uppercase; width:20%;">Data</th>
                  <th style="padding:6px 8px; font-size:10px; text-transform:uppercase; width:25%;">Valor</th>
                  <th style="padding:6px 8px; font-size:10px; text-transform:uppercase; width:35%;">Observação</th>
                </tr>
              </thead>
              <tbody>
                ${(!selectedEmployee.advances || selectedEmployee.advances.length === 0)
                  ? '<tr><td colspan="4" style="padding: 10px; text-align: center; color: #777;">Nenhum vale ou adiantamento lançado.</td></tr>'
                  : selectedEmployee.advances.map(item => `
                      <tr style="border-bottom: 1px dotted #ccc;">
                        <td style="padding: 6px 8px; font-weight: bold;">${item.type}</td>
                        <td style="padding: 6px 8px;">${new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                        <td style="padding: 6px 8px; font-weight: bold;">R$ ${item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style="padding: 6px 8px;">${item.notes || '-'}</td>
                      </tr>
                    `).join('')
                }
              </tbody>
            </table>

            <div class="section-title">Cursos de Especialização</div>
            <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:20px;">
              <thead>
                <tr style="border-bottom:2px solid #333; text-align:left; background-color:#f3f4f6;">
                  <th style="padding:6px 8px; font-size:10px; text-transform:uppercase;">Curso / Especialidade</th>
                  <th style="padding:6px 8px; font-size:10px; text-transform:uppercase;">Instituição</th>
                  <th style="padding:6px 8px; font-size:10px; text-transform:uppercase;">Conclusão</th>
                  <th style="padding:6px 8px; font-size:10px; text-transform:uppercase;">Certificado / Registro</th>
                </tr>
              </thead>
              <tbody>
                ${specRowsHtml}
              </tbody>
            </table>

            <div class="section-title">Normas Regulamentadoras (NRs)</div>
            <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:20px;">
              <thead>
                <tr style="border-bottom:2px solid #333; text-align:left; background-color:#f3f4f6;">
                  <th style="padding:6px 8px; font-size:10px; text-transform:uppercase;">Norma Regulamentadora (NR)</th>
                  <th style="padding:6px 8px; font-size:10px; text-transform:uppercase;">Instituição</th>
                  <th style="padding:6px 8px; font-size:10px; text-transform:uppercase;">Conclusão</th>
                  <th style="padding:6px 8px; font-size:10px; text-transform:uppercase;">Validade / Vencimento</th>
                  <th style="padding:6px 8px; font-size:10px; text-transform:uppercase;">Certificado / Registro</th>
                </tr>
              </thead>
              <tbody>
                ${nrRowsHtml}
              </tbody>
            </table>

            <div class="section-title">Observações</div>
            <div style="height: 100px; border: 1px solid #eee; padding: 10px; font-size: 12px; color: #666;">
               ${selectedEmployee.status === 'Férias' ? `Em gozo de férias de ${selectedEmployee.vacationStartDate ? new Date(selectedEmployee.vacationStartDate).toLocaleDateString('pt-BR') : '?'} a ${selectedEmployee.vacationEndDate ? new Date(selectedEmployee.vacationEndDate).toLocaleDateString('pt-BR') : '?'}` : ''}
            </div>

            <div class="signatures">
               <div class="sig-box">
                  Assinatura do Empregador
               </div>
               <div class="sig-box">
                  Assinatura do Empregado
               </div>
            </div>

            <div class="footer">
               Documento gerado eletronicamente pelo sistema GestãoRH Pro em ${new Date().toLocaleDateString('pt-BR')}.
            </div>
          </body>
        </html>
      `;
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  const handleExportPDFList = () => {
    const doc = new jsPDF() as any;
    
    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Relatório de Colaboradores", 14, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 26);
    doc.text(`Filtros - Cargo: ${roleFilter} | Depto: ${departmentFilter} | Status: ${statusFilter}`, 14, 32);
    
    const tableColumns = ["Nome", "Departamento", "Cargo", "Status", "Telefone", "CPF"];
    const tableRows = filteredEmployees.map(emp => [
      emp.name,
      emp.department || '-',
      emp.role || '-',
      emp.status || 'Ativo',
      emp.phone || '-',
      emp.cpf || '-'
    ]);
    
    doc.autoTable({
      head: [tableColumns],
      body: tableRows,
      startY: 38,
      theme: 'grid',
      styles: { fontSize: 8, font: "helvetica" },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' }
    });
    
    doc.save(`colaboradores_${new Date().toISOString().slice(0, 10)}.pdf`);
    logAction('REPORTS_GENERATE', 'Relatório de colaboradores exportado em PDF', { count: filteredEmployees.length });
  };

  // --- Filter Logic ---
  const uniqueDepartments = Array.from(new Set([
    ...availableDepartments,
    ...employees.map(e => e.department)
  ].filter(Boolean))).sort();

  const uniqueRoles = Array.from(new Set([
    ...availableRoles,
    ...employees.map(e => e.role)
  ].filter(Boolean))).sort();

  const filteredEmployees = employees.filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            emp.role.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDept = departmentFilter === 'Todos' || emp.department === departmentFilter;
      const matchesRole = roleFilter === 'Todos' || emp.role === roleFilter;
      const matchesStatus = statusFilter === 'Todos' || emp.status === statusFilter;
      
      return matchesSearch && matchesDept && matchesRole && matchesStatus;
  });

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'Ativo': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
          case 'Inativo': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
          case 'Férias': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
          case 'Atestado / Afastamento': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
          default: return 'bg-gray-100 text-gray-700';
      }
  };

  if (view === 'FORM') {
      return (
        <div className="p-4 md:p-8 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{isEditing ? 'Editar Colaborador' : 'Novo Colaborador'}</h2>
                <button onClick={() => setView('LIST')} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white flex items-center gap-1">
                    <span className="material-icons-outlined">arrow_back</span> Voltar
                </button>
            </div>
            
            <form onSubmit={handleSave} className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-200 dark:border-dark-border space-y-6">
                
                {/* Dados Pessoais */}
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 border-b border-gray-100 dark:border-white/5 pb-2">Dados Pessoais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome Completo</label>
                        <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone</label>
                        <input type="tel" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" placeholder="(00) 00000-0000" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CPF</label>
                        <input 
                            type="text" 
                            value={formData.cpf || ''} 
                            onChange={handleCpfChange}
                            maxLength={14}
                            placeholder="000.000.000-00"
                            className={`w-full px-3 py-2 rounded-lg border ${cpfError ? 'border-red-500 focus:ring-red-500/50' : 'border-gray-200 dark:border-gray-600 focus:ring-primary-500/50'} bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2`} 
                        />
                        {cpfError && <p className="text-red-500 text-xs mt-1">{cpfError}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">RG</label>
                        <input type="text" value={formData.rg || ''} onChange={e => setFormData({...formData, rg: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" placeholder="00.000.000-0" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data de Nascimento *</label>
                        <input required type="date" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Carteira de Trabalho (CTPS)</label>
                        <input type="text" value={formData.ctps || ''} onChange={e => setFormData({...formData, ctps: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" placeholder="Série / Número da CTPS" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CNH (Motorista)</label>
                            <input type="text" value={formData.cnh || ''} onChange={e => setFormData({...formData, cnh: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" placeholder="Número CNH" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cat.</label>
                            <select value={formData.cnhCategory || ''} onChange={e => setFormData({...formData, cnhCategory: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50">
                                <option value="">Nenhuma</option>
                                <option value="A">A</option>
                                <option value="B">B</option>
                                <option value="C">C</option>
                                <option value="D">D</option>
                                <option value="E">E</option>
                                <option value="AB">AB</option>
                                <option value="AC">AC</option>
                                <option value="AD">AD</option>
                                <option value="AE">AE</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Endereço Detalhado */}
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 border-b border-gray-100 dark:border-white/5 pb-2 pt-4">Endereço</h3>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CEP</label>
                        <input 
                            type="text" 
                            value={formData.addressZip || ''} 
                            onChange={e => setFormData({...formData, addressZip: e.target.value})}
                            onBlur={handleCepBlur}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                            placeholder="00000-000"
                        />
                    </div>
                    <div className="md:col-span-4">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Rua / Avenida</label>
                        <input type="text" value={formData.addressStreet || ''} onChange={e => setFormData({...formData, addressStreet: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Número</label>
                        <input type="text" value={formData.addressNumber || ''} onChange={e => setFormData({...formData, addressNumber: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" />
                    </div>
                    <div className="md:col-span-4">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Complemento</label>
                        <input type="text" value={formData.addressComplement || ''} onChange={e => setFormData({...formData, addressComplement: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" placeholder="Apto, Bloco, etc" />
                    </div>
                    <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Bairro</label>
                        <input type="text" value={formData.addressNeighborhood || ''} onChange={e => setFormData({...formData, addressNeighborhood: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cidade</label>
                        <input type="text" value={formData.addressCity || ''} onChange={e => setFormData({...formData, addressCity: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" />
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">UF</label>
                        <input type="text" value={formData.addressState || ''} onChange={e => setFormData({...formData, addressState: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" maxLength={2} />
                    </div>
                </div>

                {/* Dados Contratuais */}
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 border-b border-gray-100 dark:border-white/5 pb-2 pt-4">Contrato & Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cargo / Função</label>
                        <input required list="roles" type="text" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" />
                        <datalist id="roles">
                            {availableRoles.map(role => <option key={role} value={role} />)}
                        </datalist>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Departamento</label>
                        <input required list="departments" type="text" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" />
                        <datalist id="departments">
                            {availableDepartments.map(dept => <option key={dept} value={dept} />)}
                        </datalist>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data de Admissão</label>
                        <input required type="date" value={formData.admissionDate} onChange={e => setFormData({...formData, admissionDate: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                        <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50">
                            <option value="Ativo">Ativo</option>
                            <option value="Inativo">Inativo</option>
                            <option value="Férias">Férias</option>
                            <option value="Atestado / Afastamento">Atestado / Afastamento</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Salário Mensal (R$)</label>
                        <div className="relative max-w-md">
                            <span className="absolute left-3 top-2 text-slate-400 text-sm">R$</span>
                            <input 
                                type="number" 
                                step="0.01" 
                                value={formData.salary || ''} 
                                onChange={e => setFormData({...formData, salary: e.target.value ? parseFloat(e.target.value) : undefined})} 
                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-sm" 
                                placeholder="0,00"
                            />
                        </div>
                    </div>
                </div>

                {/* Seção de Adiantamentos & Vales */}
                <div className="mt-6 bg-slate-50 dark:bg-white/5 p-5 rounded-xl border border-gray-150 dark:border-white/5">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
                        <span className="material-icons-outlined text-primary-500 text-lg">payments</span> Histórico de Vales & Adiantamentos
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        Registre vales, adiantamentos de salário ou outros benefícios concedidos. Permite múltiplos lançamentos por colaborador.
                    </p>

                    {/* Formulário de Adição */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-4 items-end bg-white dark:bg-[#121212] p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className="sm:col-span-3">
                            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Tipo</label>
                            <select 
                                value={newAdvanceType} 
                                onChange={e => setNewAdvanceType(e.target.value as any)} 
                                className="w-full px-2.5 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-slate-50 dark:bg-[#121212] text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500/50"
                            >
                                <option value="Vale">Vale</option>
                                <option value="Adiantamento">Adiantamento</option>
                                <option value="Outros">Outras Deduções</option>
                            </select>
                        </div>
                        <div className="sm:col-span-3">
                            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Valor (R$)</label>
                            <div className="relative">
                                <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">R$</span>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    placeholder="0,00" 
                                    value={newAdvanceAmount} 
                                    onChange={e => setNewAdvanceAmount(e.target.value)} 
                                    className="w-full pl-7 pr-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-slate-50 dark:bg-[#121212] text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500/50"
                                />
                            </div>
                        </div>
                        <div className="sm:col-span-3">
                            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Data</label>
                            <input 
                                type="date" 
                                value={newAdvanceDate} 
                                onChange={e => setNewAdvanceDate(e.target.value)} 
                                className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-slate-50 dark:bg-[#121212] text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500/50"
                            />
                        </div>
                        <div className="sm:col-span-3 flex gap-2 items-end">
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Obs / Ref</label>
                                <input 
                                    type="text" 
                                    placeholder="Ex: ref dia 20" 
                                    value={newAdvanceNotes} 
                                    onChange={e => setNewAdvanceNotes(e.target.value)} 
                                    className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-slate-50 dark:bg-[#121212] text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500/50"
                                />
                            </div>
                            <button 
                                type="button" 
                                onClick={handleAddAdvance}
                                className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded text-xs font-medium flex items-center justify-center shadow-sm h-[32px]"
                                title="Adicionar Lançamento"
                            >
                                <span className="material-icons-outlined text-sm">add</span>
                            </button>
                        </div>
                    </div>

                    {/* Tabela dos Lançados */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-650 dark:text-slate-350">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-white/5 text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                                    <th className="py-2 px-3">Tipo</th>
                                    <th className="py-2 px-3">Data</th>
                                    <th className="py-2 px-3">Valor</th>
                                    <th className="py-2 px-3">Observação</th>
                                    <th className="py-2 px-3 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(!formData.advances || formData.advances.length === 0) ? (
                                    <tr>
                                        <td colSpan={5} className="py-4 text-center text-slate-400 dark:text-slate-500 italic">
                                            Nenhum vale ou adiantamento lançado para este colaborador.
                                        </td>
                                    </tr>
                                ) : (
                                    formData.advances.map((item) => (
                                        <tr key={item.id} className="border-b border-gray-150/50 dark:border-white/5 hover:bg-gray-150/30 dark:hover:bg-white/5 transition-colors">
                                            <td className="py-2.5 px-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                                    item.type === 'Vale' 
                                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400' 
                                                        : item.type === 'Adiantamento'
                                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400'
                                                        : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                                                }`}>
                                                    {item.type}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                {new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                                                R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="py-2.5 px-3 max-w-[200px] truncate" title={item.notes}>
                                                {item.notes || '-'}
                                            </td>
                                            <td className="py-2.5 px-3 text-right">
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleRemoveAdvance(item.id)}
                                                    className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 text-rose-500 rounded transition-colors"
                                                    title="Excluir Lançamento"
                                                >
                                                    <span className="material-icons-outlined text-sm">delete</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Campos Condicionais de Férias */}
                {formData.status === 'Férias' && (
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30 animate-in fade-in zoom-in duration-300">
                        <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                            <span className="material-icons-outlined text-base">beach_access</span> Controle de Férias
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-blue-700 dark:text-blue-200 mb-1">Data Início</label>
                                <input type="date" value={formData.vacationStartDate || ''} onChange={e => setFormData({...formData, vacationStartDate: e.target.value})} className="w-full px-3 py-2 rounded border border-blue-200 dark:border-blue-800 bg-white dark:bg-[#121212] text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-blue-700 dark:text-blue-200 mb-1">Data Fim</label>
                                <input type="date" value={formData.vacationEndDate || ''} onChange={e => setFormData({...formData, vacationEndDate: e.target.value})} className="w-full px-3 py-2 rounded border border-blue-200 dark:border-blue-800 bg-white dark:bg-[#121212] text-sm" />
                            </div>
                            <div className="flex items-end pb-2">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.vacationNotify || false} 
                                        onChange={e => setFormData({...formData, vacationNotify: e.target.checked})}
                                        className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500" 
                                    />
                                    <span className="text-sm text-blue-800 dark:text-blue-200">Notificar término</span>
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {/* Seção de Tamanhos para EPIs / Uniformes */}
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 border-b border-gray-100 dark:border-white/5 pb-2 pt-6 flex items-center gap-2">
                    <span className="material-icons-outlined text-primary-500 text-xl font-bold">checkroom</span> Uniformes & Tamanhos de EPI
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Registre os tamanhos de calçados e vestimentas do colaborador para otimizar os pedidos e a entrega de EPIs (Equipamentos de Proteção Individual) e uniformes.
                </p>

                <div className="space-y-6 bg-slate-50/50 dark:bg-white/5 p-5 rounded-xl border border-gray-150 dark:border-white/5">
                    {/* Linha 1: Calçados */}
                    <div className="border-b border-gray-150/60 dark:border-white/5 pb-5">
                        <h4 className="text-xs font-bold text-slate-400 dark:text-slate-350 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                            <span className="material-icons-outlined text-sm text-slate-400">construction</span> Calçados & Botas
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Calçado</label>
                                <select 
                                    value={formData.shoeType || ''} 
                                    onChange={e => setFormData({...formData, shoeType: e.target.value})} 
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#121212] text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                >
                                    <option value="">Não Especificado</option>
                                    <option value="Botina de Couro (Sem bico)">Botina de Couro (Sem bico)</option>
                                    <option value="Botina de Couro (Com bico de aço)">Botina de Couro (Com bico de aço)</option>
                                    <option value="Botina de Couro (Com bico de composite)">Botina de Couro (Com bico de composite)</option>
                                    <option value="Bota de PVC Cano Longo">Bota de PVC Cano Longo</option>
                                    <option value="Bota de PVC Cano Curto">Bota de PVC Cano Curto</option>
                                    <option value="Tênis Ocupacional">Tênis Ocupacional</option>
                                    <option value="Sapatilha de Proteção">Sapatilha de Proteção</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Tamanho do Calçado</label>
                                <select 
                                    value={formData.shoeSize || ''} 
                                    onChange={e => setFormData({...formData, shoeSize: e.target.value})} 
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#121212] text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                >
                                    <option value="">Selecione...</option>
                                    {Array.from({ length: 17 }, (_, i) => 33 + i).map(size => (
                                        <option key={size} value={size}>{size}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Linha 2: Vestuário Superior */}
                    <div className="border-b border-gray-150/60 dark:border-white/5 pb-5">
                        <h4 className="text-xs font-bold text-slate-400 dark:text-slate-350 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                            <span className="material-icons-outlined text-sm text-slate-400 font-bold">accessibility_new</span> Vestuário Superior (Camisetas, Camisas e Jaquetas)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Tamanho da Camiseta</label>
                                <select 
                                    value={formData.shirtSize || ''} 
                                    onChange={e => setFormData({...formData, shirtSize: e.target.value})} 
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#121212] text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                >
                                    <option value="">Selecione...</option>
                                    <option value="PP">PP</option>
                                    <option value="P">P</option>
                                    <option value="M">M</option>
                                    <option value="G">G</option>
                                    <option value="GG">GG</option>
                                    <option value="XG">XG (G3)</option>
                                    <option value="XXG">XXG (G4)</option>
                                    <option value="EXG">EXG (G5)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Tamanho da Camisa</label>
                                <select 
                                    value={formData.dressShirtSize || ''} 
                                    onChange={e => setFormData({...formData, dressShirtSize: e.target.value})} 
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#121212] text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                >
                                    <option value="">Selecione...</option>
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                    <option value="5">5</option>
                                    <option value="6">6</option>
                                    <option value="P">P</option>
                                    <option value="M">M</option>
                                    <option value="G">G</option>
                                    <option value="GG">GG</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Tamanho da Jaqueta / Blusa</label>
                                <select 
                                    value={formData.jacketSize || ''} 
                                    onChange={e => setFormData({...formData, jacketSize: e.target.value})} 
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#121212] text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                >
                                    <option value="">Selecione...</option>
                                    <option value="PP">PP</option>
                                    <option value="P">P</option>
                                    <option value="M">M</option>
                                    <option value="G">G</option>
                                    <option value="GG">GG</option>
                                    <option value="XG">XG</option>
                                    <option value="XXG">XXG</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Linha 3: Vestuário Inferior */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 dark:text-slate-350 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                            <span className="material-icons-outlined text-sm text-slate-400">person_outline</span> Vestuário Inferior (Calças)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Tamanho da Calça</label>
                                <select 
                                    value={formData.pantsSize || ''} 
                                    onChange={e => setFormData({...formData, pantsSize: e.target.value})} 
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#121212] text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                >
                                    <option value="">Selecione...</option>
                                    {['34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56', 'P', 'M', 'G', 'GG'].map(size => (
                                        <option key={size} value={size}>{size}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Seção 1: Cursos de Especialização */}
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 border-b border-gray-100 dark:border-white/5 pb-2 pt-6 flex items-center gap-2">
                    <span className="material-icons-outlined text-primary-500 text-xl">school</span> Cursos de Especialização
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Qualificações técnicas e especialidades operacionais (ex: operador de munck, guindaste, prancha, retro). Nota: os cursos de especialização não requerem validação ou renovação periódica.
                </p>

                {/* Sugestões de Cursos */}
                <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-gray-150 dark:border-white/5">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-350 mb-2 flex items-center gap-1">
                        <span className="material-icons-outlined text-xs">local_fire_department</span> Sugestões Rápidas de Especialidades (Clique para Adicionar):
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {[
                            'Operador de Munck (Guindaste)',
                            'Operador de Ponte Rolante',
                            'Caminhão Prancha',
                            'Operador de Empilhadeira',
                            'Operador de Retroescavadeira',
                            'Soldador Especializado (TIG/MIG)'
                        ].map(courseName => {
                            const alreadyAdded = formData.certifications?.some(c => c.name.toLowerCase() === courseName.toLowerCase());
                            return (
                                <button
                                    key={courseName}
                                    type="button"
                                    disabled={alreadyAdded}
                                    onClick={() => {
                                        const newCert: Certification = {
                                            id: 'cert-' + Math.random().toString(36).substring(2, 9),
                                            name: courseName,
                                            type: 'curso',
                                            institution: '',
                                            completionDate: new Date().toISOString().split('T')[0],
                                            expirationDate: '',
                                            certificateNumber: ''
                                        };
                                        setFormData(prev => ({
                                            ...prev,
                                            certifications: [...(prev.certifications || []), newCert]
                                        }));
                                    }}
                                    className={`text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1 ${
                                        alreadyAdded 
                                            ? 'bg-slate-200 text-slate-400 border-transparent dark:bg-white/5 dark:text-slate-600 cursor-not-allowed'
                                            : 'bg-primary-50 hover:bg-primary-100 text-primary-700 border-primary-200 dark:bg-primary-900/10 dark:hover:bg-primary-900/20 dark:text-primary-300 dark:border-primary-800'
                                    }`}
                                >
                                    <span className="material-icons-outlined text-xs">{alreadyAdded ? 'done' : 'add'}</span>
                                    {courseName}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Lista de Cursos Cadastrados */}
                <div className="space-y-3">
                    {(!formData.certifications || formData.certifications.filter(c => getCertType(c) === 'curso').length === 0) ? (
                        <div className="text-center p-6 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl bg-slate-50/50 dark:bg-transparent">
                            <span className="material-icons-outlined text-3xl text-slate-400 mb-2 block">school</span>
                            <p className="text-sm text-slate-500 max-w-sm mx-auto">Nenhum curso de especialização informado nesta ficha.</p>
                            <button
                                type="button"
                                onClick={() => {
                                    const newCert: Certification = {
                                        id: 'cert-' + Math.random().toString(36).substring(2, 9),
                                        name: '',
                                        type: 'curso',
                                        institution: '',
                                        completionDate: new Date().toISOString().split('T')[0],
                                        expirationDate: '',
                                        certificateNumber: ''
                                    };
                                    setFormData(prev => ({
                                        ...prev,
                                        certifications: [...(prev.certifications || []), newCert]
                                    }));
                                }}
                                className="mt-3 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-[#121212] rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-white/5 text-primary-600 dark:text-primary-400 transition-colors"
                            >
                                + Adicionar Curso Manual
                            </button>
                        </div>
                    ) : (
                        <div className="border border-gray-200 dark:border-white/5 rounded-xl overflow-hidden bg-slate-50/30">
                            <div className="p-3 bg-slate-100/60 dark:bg-white/5 border-b border-gray-200 dark:border-white/5 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-350 uppercase tracking-wider">Cursos de Especialização Cadastrados ({formData.certifications.filter(c => getCertType(c) === 'curso').length})</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newCert: Certification = {
                                            id: 'cert-' + Math.random().toString(36).substring(2, 9),
                                            name: '',
                                            type: 'curso',
                                            institution: '',
                                            completionDate: new Date().toISOString().split('T')[0],
                                            expirationDate: '',
                                            certificateNumber: ''
                                        };
                                        setFormData(prev => ({
                                            ...prev,
                                            certifications: [...(prev.certifications || []), newCert]
                                        }));
                                    }}
                                    className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-bold flex items-center gap-1"
                                >
                                    <span className="material-icons-outlined text-sm">add_circle_outline</span> Adicionar Curso Manual
                                </button>
                            </div>
                            <div className="divide-y divide-gray-150 dark:divide-white/5 bg-white dark:bg-[#1e1e1e]">
                                {formData.certifications.filter(c => getCertType(c) === 'curso').map((cert, idx) => {
                                    return (
                                        <div key={cert.id} className="p-4 space-y-3 relative">
                                            <div className="flex justify-between items-center border-b border-gray-100 dark:border-white/5 pb-1">
                                                <span className="text-xs font-bold text-primary-500 dark:text-primary-400 uppercase tracking-widest">Curso Especialidade #{idx + 1}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            certifications: (prev.certifications || []).filter(c => c.id !== cert.id)
                                                        }));
                                                    }}
                                                    className="text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 p-1 rounded-lg transition-colors flex items-center gap-0.5 text-xs font-medium"
                                                >
                                                    <span className="material-icons-outlined text-sm">delete</span> Excluir
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do Curso / Especialidade *</label>
                                                    <input
                                                        required
                                                        type="text"
                                                        value={cert.name}
                                                        onChange={e => {
                                                            const updated = (formData.certifications || []).map(c => c.id === cert.id ? { ...c, name: e.target.value } : c);
                                                            setFormData({ ...formData, certifications: updated });
                                                        }}
                                                        placeholder="Ex: Operador de Munck"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Instituição de Ensino / Emissor</label>
                                                    <input
                                                        type="text"
                                                        value={cert.institution || ''}
                                                        onChange={e => {
                                                            const updated = (formData.certifications || []).map(c => c.id === cert.id ? { ...c, institution: e.target.value } : c);
                                                            setFormData({ ...formData, certifications: updated });
                                                        }}
                                                        placeholder="Ex: SENAI, SESI, etc"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Data Conclusão *</label>
                                                    <input
                                                        required
                                                        type="date"
                                                        value={cert.completionDate}
                                                        onChange={e => {
                                                            const updated = (formData.certifications || []).map(c => c.id === cert.id ? { ...c, completionDate: e.target.value } : c);
                                                            setFormData({ ...formData, certifications: updated });
                                                        }}
                                                        className="w-full px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 text-xs focus:ring-1 focus:ring-primary-500 focus:outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Código de Registro / Certificado</label>
                                                    <input
                                                        type="text"
                                                        value={cert.certificateNumber || ''}
                                                        onChange={e => {
                                                            const updated = (formData.certifications || []).map(c => c.id === cert.id ? { ...c, certificateNumber: e.target.value } : c);
                                                            setFormData({ ...formData, certifications: updated });
                                                        }}
                                                        placeholder="Ex: Reg. SENAI nº 5532"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Seção 2: Normas Regulamentadoras (NRs) */}
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 border-b border-gray-100 dark:border-white/5 pb-2 pt-6 flex items-center gap-2">
                    <span className="material-icons-outlined text-primary-500 text-xl">shield</span> Normas Regulamentadoras (NRs)
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Treinamentos obrigatórios de Normas Regulamentadoras vigentes no Brasil. Estas exigem acompanhamento de vigência, controle e alertas periódicos de renovação.
                </p>

                {/* Sugestões de NRs */}
                <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-gray-150 dark:border-white/5">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-350 mb-2 flex items-center gap-1">
                        <span className="material-icons-outlined text-xs">local_fire_department</span> Sugestões Rápidas de NRs Comuns (Clique para Adicionar):
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {[
                            'NR-10 Segurança em Elétrica',
                            'NR-11 Movimentação de Materiais',
                            'NR-12 Segurança em Máquinas/Equipamentos',
                            'NR-18 Construção Civil',
                            'NR-33 Espaço Confinado',
                            'NR-35 Trabalho em Altura'
                        ].map(courseName => {
                            const alreadyAdded = formData.certifications?.some(c => c.name.toLowerCase() === courseName.toLowerCase());
                            return (
                                <button
                                    key={courseName}
                                    type="button"
                                    disabled={alreadyAdded}
                                    onClick={() => {
                                        const newCert: Certification = {
                                            id: 'cert-' + Math.random().toString(36).substring(2, 9),
                                            name: courseName,
                                            type: 'nr',
                                            institution: '',
                                            completionDate: new Date().toISOString().split('T')[0],
                                            expirationDate: new Date(Date.now() + 365 * 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 years val default
                                            certificateNumber: ''
                                        };
                                        setFormData(prev => ({
                                            ...prev,
                                            certifications: [...(prev.certifications || []), newCert]
                                        }));
                                    }}
                                    className={`text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1 ${
                                        alreadyAdded 
                                            ? 'bg-slate-200 text-slate-400 border-transparent dark:bg-white/5 dark:text-slate-600 cursor-not-allowed'
                                            : 'bg-primary-50 hover:bg-primary-100 text-primary-700 border-primary-200 dark:bg-primary-900/10 dark:hover:bg-primary-900/20 dark:text-primary-300 dark:border-primary-800'
                                    }`}
                                >
                                    <span className="material-icons-outlined text-xs">{alreadyAdded ? 'done' : 'add'}</span>
                                    {courseName}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Lista de NRs Cadastradas */}
                <div className="space-y-3">
                    {(!formData.certifications || formData.certifications.filter(c => getCertType(c) === 'nr').length === 0) ? (
                        <div className="text-center p-6 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl bg-slate-50/50 dark:bg-transparent">
                            <span className="material-icons-outlined text-3xl text-slate-400 mb-2 block">security</span>
                            <p className="text-sm text-slate-500 max-w-sm mx-auto">Nenhuma Norma Regulamentadora (NR) informada nesta ficha.</p>
                            <button
                                type="button"
                                onClick={() => {
                                    const newCert: Certification = {
                                        id: 'cert-' + Math.random().toString(36).substring(2, 9),
                                        name: '',
                                        type: 'nr',
                                        institution: '',
                                        completionDate: new Date().toISOString().split('T')[0],
                                        expirationDate: '',
                                        certificateNumber: ''
                                    };
                                    setFormData(prev => ({
                                        ...prev,
                                        certifications: [...(prev.certifications || []), newCert]
                                    }));
                                }}
                                className="mt-3 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-[#121212] rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-white/5 text-primary-600 dark:text-primary-400 transition-colors"
                            >
                                + Adicionar NR Manual
                            </button>
                        </div>
                    ) : (
                        <div className="border border-gray-200 dark:border-white/5 rounded-xl overflow-hidden bg-slate-50/30">
                            <div className="p-3 bg-slate-150/65 dark:bg-white/5 border-b border-gray-250 dark:border-white/5 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-350 uppercase tracking-wider">Normas Regulamentadoras Cadastradas ({formData.certifications.filter(c => getCertType(c) === 'nr').length})</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newCert: Certification = {
                                            id: 'cert-' + Math.random().toString(36).substring(2, 9),
                                            name: '',
                                            type: 'nr',
                                            institution: '',
                                            completionDate: new Date().toISOString().split('T')[0],
                                            expirationDate: '',
                                            certificateNumber: ''
                                        };
                                        setFormData(prev => ({
                                            ...prev,
                                            certifications: [...(prev.certifications || []), newCert]
                                        }));
                                    }}
                                    className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-bold flex items-center gap-1"
                                >
                                    <span className="material-icons-outlined text-sm">add_circle_outline</span> Adicionar NR
                                </button>
                            </div>
                            <div className="divide-y divide-gray-150 dark:divide-white/5 bg-white dark:bg-[#1e1e1e]">
                                {formData.certifications.filter(c => getCertType(c) === 'nr').map((cert, idx) => {
                                    const isExpired = cert.expirationDate && new Date(cert.expirationDate) < new Date();
                                    return (
                                        <div key={cert.id} className="p-4 space-y-3 relative">
                                            <div className="flex justify-between items-center border-b border-gray-100 dark:border-white/5 pb-1">
                                                <span className="text-xs font-bold text-primary-500 dark:text-primary-400 uppercase tracking-widest">Norma Regulamentadora #{idx + 1}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            certifications: (prev.certifications || []).filter(c => c.id !== cert.id)
                                                        }));
                                                    }}
                                                    className="text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 p-1 rounded-lg transition-colors flex items-center gap-0.5 text-xs font-medium"
                                                >
                                                    <span className="material-icons-outlined text-sm">delete</span> Excluir
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Nome da Norma / Regulamento *</label>
                                                    <input
                                                        required
                                                        type="text"
                                                        value={cert.name}
                                                        onChange={e => {
                                                            const updated = (formData.certifications || []).map(c => c.id === cert.id ? { ...c, name: e.target.value } : c);
                                                            setFormData({ ...formData, certifications: updated });
                                                        }}
                                                        placeholder="Ex: NR-35 Trabalho em Altura"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Instituição de Ensino / Emissor</label>
                                                    <input
                                                        type="text"
                                                        value={cert.institution || ''}
                                                        onChange={e => {
                                                            const updated = (formData.certifications || []).map(c => c.id === cert.id ? { ...c, institution: e.target.value } : c);
                                                            setFormData({ ...formData, certifications: updated });
                                                        }}
                                                        placeholder="Ex: SENAI, SESI, SESMT, etc"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Data Conclusão *</label>
                                                        <input
                                                            required
                                                            type="date"
                                                            value={cert.completionDate}
                                                            onChange={e => {
                                                                const updated = (formData.certifications || []).map(c => c.id === cert.id ? { ...c, completionDate: e.target.value } : c);
                                                                setFormData({ ...formData, certifications: updated });
                                                            }}
                                                            className="w-full px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 text-xs focus:ring-1 focus:ring-primary-500 focus:outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex justify-between">
                                                            <span>Data Validade *</span> 
                                                            {isExpired && <span className="text-red-500 font-bold">VENCIDO</span>}
                                                        </label>
                                                        <input
                                                            required
                                                            type="date"
                                                            value={cert.expirationDate || ''}
                                                            onChange={e => {
                                                                const updated = (formData.certifications || []).map(c => c.id === cert.id ? { ...c, expirationDate: e.target.value } : c);
                                                                setFormData({ ...formData, certifications: updated });
                                                            }}
                                                            className={`w-full px-2 py-2 rounded-lg border ${isExpired ? 'border-red-400 dark:border-red-900/60' : 'border-gray-200 dark:border-gray-700'} bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 text-xs focus:ring-1 focus:ring-primary-500 focus:outline-none`}
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Código de Registro / Certificado</label>
                                                    <input
                                                        type="text"
                                                        value={cert.certificateNumber || ''}
                                                        onChange={e => {
                                                            const updated = (formData.certifications || []).map(c => c.id === cert.id ? { ...c, certificateNumber: e.target.value } : c);
                                                            setFormData({ ...formData, certifications: updated });
                                                        }}
                                                        placeholder="Ex: Registro MTE nº 933-A"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-4">
                    <button type="submit" className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 shadow-lg shadow-primary-500/30 font-medium transition-all">
                        Salvar Dados
                    </button>
                </div>
            </form>
        </div>
      );
  }

  return (
    <div className="p-4 md:p-8 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white">Colaboradores</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Gerencie o time, edite informações e controle status.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={handleExportPDFList}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-dark-card dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-gray-200 dark:border-dark-border rounded-lg transition-colors font-medium text-sm"
          >
            <span className="material-icons-outlined text-lg">picture_as_pdf</span>
            <span>Exportar PDF</span>
          </button>
          <button onClick={handleNewEmployee} className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 shadow-sm transition-colors font-medium text-sm">
            <span className="material-icons-outlined">person_add</span>
            <span>Adicionar</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border flex flex-col flex-1 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 dark:border-dark-border flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
                <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome..." 
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                />
            </div>
            
            <div className="hidden md:block w-48">
              <select 
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-dark-card text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              >
                <option value="Todos">Cargo: Todos</option>
                {uniqueRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            <div className="hidden md:block w-48">
              <select 
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-dark-card text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              >
                <option value="Todos">Dept: Todos</option>
                {uniqueDepartments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div className="hidden md:block w-40">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-dark-card text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              >
                <option value="Todos">Status</option>
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
                <option value="Férias">Férias</option>
                <option value="Atestado / Afastamento">Atestado / Afastamento</option>
              </select>
            </div>

            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="md:hidden px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center justify-center gap-2"
            >
              <span className="material-icons-outlined">filter_list</span> Filtros
            </button>
        </div>

        {/* Mobile Filters */}
        {showMobileFilters && (
            <div className="p-4 border-b border-gray-100 dark:border-dark-border bg-gray-50 dark:bg-white/5 grid grid-cols-1 gap-4 md:hidden animate-in fade-in slide-in-from-top-2">
                 <select 
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-dark-card text-slate-700 dark:text-slate-300"
                  >
                    <option value="Todos">Cargo: Todos</option>
                    {uniqueRoles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                 <select 
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-dark-card text-slate-700 dark:text-slate-300"
                  >
                    <option value="Todos">Dept: Todos</option>
                    {uniqueDepartments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-dark-card text-slate-700 dark:text-slate-300"
                  >
                    <option value="Todos">Status</option>
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                    <option value="Férias">Férias</option>
                    <option value="Atestado / Afastamento">Atestado / Afastamento</option>
                  </select>
            </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-[#121212] text-xs uppercase text-slate-500 dark:text-slate-400 sticky top-0 z-10">
                    <tr>
                        <th className="px-6 py-4 font-semibold">Colaborador</th>
                        <th className="px-6 py-4 font-semibold">Departamento</th>
                        <th className="px-6 py-4 font-semibold">Cargo (Editável)</th>
                        <th className="px-6 py-4 font-semibold">Status</th>
                        <th className="px-6 py-4 font-semibold text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                    {isLoading ? (
                        <tr><td colSpan={5} className="p-8 text-center text-slate-500">Carregando...</td></tr>
                    ) : filteredEmployees.length === 0 ? (
                        <tr><td colSpan={5} className="p-8 text-center text-slate-500">Nenhum colaborador encontrado.</td></tr>
                    ) : filteredEmployees.map((emp) => {
                        const isEditingDept = editingCell?.id === emp.id && editingCell?.field === 'department';
                        const isEditingRole = editingCell?.id === emp.id && editingCell?.field === 'role';

                        return (
                        <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-600 dark:text-primary-300 font-bold">
                                        {emp.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-800 dark:text-white">{emp.name}</p>
                                    </div>
                                </div>
                            </td>
                            
                            {/* Editable Department */}
                            <td className="px-6 py-4">
                                {isEditingDept ? (
                                    <div className="flex items-center gap-2 animate-in fade-in duration-200">
                                        <select 
                                            value={tempValue}
                                            onChange={(e) => setTempValue(e.target.value)}
                                            className="bg-white dark:bg-dark-card border border-primary-500 text-slate-800 dark:text-slate-200 text-sm rounded px-2 py-1 focus:outline-none w-full max-w-[140px]"
                                            autoFocus
                                        >
                                            <option value="">Selecione...</option>
                                            {availableDepartments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                                        </select>
                                        <button 
                                            onClick={saveEditing} 
                                            disabled={isSavingInline}
                                            className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                                            title="Salvar"
                                        >
                                            {isSavingInline ? <span className="material-icons-outlined text-sm animate-spin">refresh</span> : <span className="material-icons-outlined text-sm">check</span>}
                                        </button>
                                        <button 
                                            onClick={cancelEditing} 
                                            className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                                            title="Cancelar"
                                        >
                                            <span className="material-icons-outlined text-sm">close</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div 
                                        onClick={() => startEditing(emp.id, 'department', emp.department)}
                                        className="group/cell flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 px-2 py-1 rounded -ml-2 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                                    >
                                        <span className="text-slate-600 dark:text-slate-300">{emp.department}</span>
                                        <span className="material-icons-outlined text-xs text-slate-400 opacity-0 group-hover/cell:opacity-100 transition-opacity">edit</span>
                                    </div>
                                )}
                            </td>

                            {/* Editable Role */}
                            <td className="px-6 py-4">
                                {isEditingRole ? (
                                    <div className="flex items-center gap-2 animate-in fade-in duration-200">
                                        <select 
                                            value={tempValue}
                                            onChange={(e) => setTempValue(e.target.value)}
                                            className="bg-white dark:bg-dark-card border border-primary-500 text-slate-800 dark:text-slate-200 text-sm rounded px-2 py-1 focus:outline-none w-full max-w-[140px]"
                                            autoFocus
                                        >
                                            <option value="">Selecione...</option>
                                            {availableRoles.map(role => <option key={role} value={role}>{role}</option>)}
                                        </select>
                                        <button 
                                            onClick={saveEditing} 
                                            disabled={isSavingInline}
                                            className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                                            title="Salvar"
                                        >
                                            {isSavingInline ? <span className="material-icons-outlined text-sm animate-spin">refresh</span> : <span className="material-icons-outlined text-sm">check</span>}
                                        </button>
                                        <button 
                                            onClick={cancelEditing} 
                                            className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                                            title="Cancelar"
                                        >
                                            <span className="material-icons-outlined text-sm">close</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div 
                                        onClick={() => startEditing(emp.id, 'role', emp.role)}
                                        className="group/cell flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 px-2 py-1 rounded -ml-2 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                                    >
                                        <span className="text-slate-600 dark:text-slate-300">{emp.role}</span>
                                        <span className="material-icons-outlined text-xs text-slate-400 opacity-0 group-hover/cell:opacity-100 transition-opacity">edit</span>
                                    </div>
                                )}
                            </td>

                            <td className="px-6 py-4">
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(emp.status)}`}>
                                    {emp.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => handleViewEmployee(emp)} className="p-1.5 text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors" title="Visualizar Ficha">
                                        <span className="material-icons-outlined">visibility</span>
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                          setValesEmployee(emp);
                                          setIsDirectValesOpen(true);
                                        }} 
                                        className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors" 
                                        title="Lançar Vales/Adiantamentos"
                                     >
                                         <span className="material-icons-outlined">payments</span>
                                     </button>
                                     <button onClick={() => handleEditEmployee(emp)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors" title="Editar Completo">
                                        <span className="material-icons-outlined">edit_note</span>
                                    </button>
                                    <button onClick={() => handleDelete(emp.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Remover">
                                        <span className="material-icons-outlined">delete</span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    )})}
                </tbody>
            </table>
        </div>
      </div>

      {/* VIEW MODAL */}
      {showViewModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-dark-card w-full max-w-2xl rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-200 dark:border-dark-border flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-lg">
                            {selectedEmployee.name.charAt(0)}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">{selectedEmployee.name}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{selectedEmployee.role}</p>
                        </div>
                    </div>
                    <button onClick={() => setShowViewModal(false)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors">
                        <span className="material-icons-outlined">close</span>
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto">
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-white/5 pb-2">Dados Pessoais</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">CPF</p>
                            <p className="font-medium text-slate-800 dark:text-white">{selectedEmployee.cpf || '-'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">RG</p>
                            <p className="font-medium text-slate-800 dark:text-white">{selectedEmployee.rg || '-'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Data de Nascimento</p>
                            <p className="font-medium text-slate-800 dark:text-white">
                                {selectedEmployee.birthDate ? new Date(selectedEmployee.birthDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '-'}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Telefone</p>
                            <p className="font-medium text-slate-800 dark:text-white">{selectedEmployee.phone || '-'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Carteira de Trabalho (CTPS)</p>
                            <p className="font-medium text-slate-800 dark:text-white">{selectedEmployee.ctps || '-'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Carteira de Motorista (CNH)</p>
                            <p className="font-medium text-slate-800 dark:text-white">
                                {selectedEmployee.cnh ? `${selectedEmployee.cnh}${selectedEmployee.cnhCategory ? ` - Cat. ${selectedEmployee.cnhCategory}` : ''}` : '-'}
                            </p>
                        </div>
                        <div className="md:col-span-2">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Endereço Completo</p>
                            <p className="font-medium text-slate-800 dark:text-white">
                                {selectedEmployee.addressStreet 
                                    ? `${selectedEmployee.addressStreet}, ${selectedEmployee.addressNumber} ${selectedEmployee.addressComplement || ''} - ${selectedEmployee.addressNeighborhood}, ${selectedEmployee.addressCity}/${selectedEmployee.addressState}`
                                    : selectedEmployee.address || '-'}
                            </p>
                            {selectedEmployee.addressZip && <p className="text-xs text-slate-500 mt-1">CEP: {selectedEmployee.addressZip}</p>}
                        </div>
                    </div>

                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-white/5 pb-2">Dados Contratuais</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Departamento</p>
                            <p className="font-medium text-slate-800 dark:text-white">{selectedEmployee.department}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Status</p>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${getStatusColor(selectedEmployee.status)}`}>
                                {selectedEmployee.status}
                            </span>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Data de Admissão</p>
                            <p className="font-medium text-slate-800 dark:text-white">
                                {new Date(selectedEmployee.admissionDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Salário Mensal</p>
                            <p className="font-semibold text-slate-800 dark:text-white">
                                {selectedEmployee.salary 
                                    ? `R$ ${selectedEmployee.salary.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                                    : 'Não informado'}
                            </p>
                        </div>
                        
                        {selectedEmployee.status === 'Férias' && (
                            <div className="md:col-span-2 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800 mt-2">
                                <p className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-1">Período de Férias</p>
                                <p className="text-sm text-blue-700 dark:text-blue-200">
                                    {selectedEmployee.vacationStartDate ? new Date(selectedEmployee.vacationStartDate).toLocaleDateString('pt-BR') : '?'} até {selectedEmployee.vacationEndDate ? new Date(selectedEmployee.vacationEndDate).toLocaleDateString('pt-BR') : '?'}
                                </p>
                                {selectedEmployee.vacationNotify && <span className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-1"><span className="material-icons-outlined text-xs">notifications_active</span> Notificação Ativada</span>}
                            </div>
                        )}

                        {/* Vales & Adiantamentos */}
                        <div className="md:col-span-2 bg-amber-50/40 dark:bg-amber-955/10 p-3 rounded-lg border border-amber-100/60 dark:border-amber-900/40 mt-2">
                            <p className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-2 flex items-center gap-1">
                                <span className="material-icons-outlined text-sm">payments</span> Vales & Adiantamentos Registrados
                            </p>
                            {(!selectedEmployee.advances || selectedEmployee.advances.length === 0) ? (
                                <p className="text-xs text-slate-500 dark:text-slate-400 italic">Nenhum vale ou adiantamento lançado.</p>
                            ) : (
                                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                    {selectedEmployee.advances.map(item => (
                                        <div key={item.id} className="flex justify-between items-center text-xs bg-white dark:bg-[#121212] p-2 rounded border border-gray-100 dark:border-white/5">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                                    {item.type}
                                                </span>
                                                <span className="text-[10px] text-slate-500 dark:text-slate-450">
                                                    {new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="font-bold text-slate-900 dark:text-slate-100">
                                                    R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                                {item.notes && <p className="text-[10px] text-slate-400 mt-0.5 max-w-[150px] truncate" title={item.notes}>{item.notes}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tamanhos de Uniformes e EPI */}
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mt-6 mb-4 border-b border-gray-100 dark:border-white/5 pb-2 flex items-center gap-1.5">
                        <span className="material-icons-outlined text-sm text-primary-500">checkroom</span> Tamanhos de EPI & Uniforme
                    </h4>
                    <div className="space-y-4 bg-slate-50/50 dark:bg-white/5 p-4 rounded-xl border border-gray-150 dark:border-white/5">
                        {/* Linha 1: Calçados */}
                        <div className="border-b border-gray-150/50 dark:border-white/5 pb-3">
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-2">Calçados & Botas</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Tipo de Calçado</p>
                                    <p className="font-semibold text-slate-800 dark:text-white">{selectedEmployee.shoeType || 'Não Informado'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Tamanho de Calçado</p>
                                    <p className="font-semibold text-slate-800 dark:text-white">
                                        {selectedEmployee.shoeSize ? `${selectedEmployee.shoeSize}` : 'Não Informado'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Linha 2: Vestuário Superior */}
                        <div className="border-b border-gray-150/50 dark:border-white/5 pb-3">
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-2">Vestuário Superior (Camisetas, Camisas e Jaquetas)</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Tamanho da Camiseta</p>
                                    <p className="font-semibold text-slate-800 dark:text-white">{selectedEmployee.shirtSize || 'Não Informado'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Tamanho da Camisa</p>
                                    <p className="font-semibold text-slate-800 dark:text-white">{selectedEmployee.dressShirtSize || 'Não Informado'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Tamanho da Jaqueta / Blusa</p>
                                    <p className="font-semibold text-slate-800 dark:text-white">{selectedEmployee.jacketSize || 'Não Informado'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Linha 3: Vestuário Inferior */}
                        <div>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-2">Vestuário Inferior (Calças)</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Tamanho da Calça</p>
                                    <p className="font-semibold text-slate-800 dark:text-white">{selectedEmployee.pantsSize || 'Não Informado'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Cursos de Especialização */}
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mt-6 mb-4 border-b border-gray-100 dark:border-white/5 pb-2 flex items-center gap-1.5">
                        <span className="material-icons-outlined text-sm text-primary-500">school</span> Cursos de Especialização
                    </h4>
                    {(!selectedEmployee.certifications || selectedEmployee.certifications.filter(c => getCertType(c) === 'curso').length === 0) ? (
                        <div className="p-4 rounded-xl border border-dashed border-gray-200 dark:border-white/10 text-center bg-slate-50/50 dark:bg-white/5 mb-4">
                            <p className="text-sm text-slate-400 italic">Nenhum curso de especialização registrado na ficha deste colaborador.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            {selectedEmployee.certifications.filter(c => getCertType(c) === 'curso').map(cert => {
                                return (
                                    <div key={cert.id} className="p-4 bg-slate-50 dark:bg-[#121212] border border-gray-150 dark:border-white/5 rounded-xl flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-2 gap-1">
                                                <h5 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-1.5 leading-tight">
                                                    <span className="material-icons-outlined text-xs text-primary-500">verified</span>
                                                    {cert.name}
                                                </h5>
                                                <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400 border border-gray-200 dark:border-slate-800">
                                                    Sem Validade
                                                </span>
                                            </div>
                                            {cert.institution && (
                                                <p className="text-xs text-slate-500 mb-2">
                                                    <span className="font-semibold text-slate-600 dark:text-slate-400">Emissor:</span> {cert.institution}
                                                </p>
                                            )}
                                        </div>
                                        <div className="pt-2.5 border-t border-gray-200/50 dark:border-white/5 grid grid-cols-2 gap-2 text-xs text-slate-500">
                                            <div>
                                                <span className="block text-slate-400 text-[10px] uppercase tracking-wider">Conclusão:</span>
                                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                                    {cert.completionDate ? new Date(cert.completionDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '-'}
                                                </span>
                                            </div>
                                            {cert.certificateNumber && (
                                                <div className="col-span-2 pt-2 border-t border-dashed border-gray-200/50 dark:border-white/5 text-[11px] flex items-center justify-between">
                                                    <span className="text-slate-400 uppercase text-[9px] tracking-wider">Registro/Certificado:</span>
                                                    <span className="bg-slate-200/60 dark:bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono text-slate-800 dark:text-slate-200 font-bold">{cert.certificateNumber}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Normas Regulamentadoras (NRs) */}
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mt-6 mb-4 border-b border-gray-100 dark:border-white/5 pb-2 flex items-center gap-1.5">
                        <span className="material-icons-outlined text-sm text-primary-500">shield</span> Normas Regulamentadoras (NR's)
                    </h4>
                    {(!selectedEmployee.certifications || selectedEmployee.certifications.filter(c => getCertType(c) === 'nr').length === 0) ? (
                        <div className="p-4 rounded-xl border border-dashed border-gray-200 dark:border-white/10 text-center bg-slate-50/50 dark:bg-white/5">
                            <p className="text-sm text-slate-400 italic">Nenhuma Norma Regulamentadora (NR) registrada na ficha deste colaborador.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {selectedEmployee.certifications.filter(c => getCertType(c) === 'nr').map(cert => {
                                const isExpired = cert.expirationDate && new Date(cert.expirationDate) < new Date();
                                return (
                                    <div key={cert.id} className="p-4 bg-slate-50 dark:bg-[#121212] border border-gray-150 dark:border-white/5 rounded-xl flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-2 gap-1">
                                                <h5 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-1.5 leading-tight">
                                                    <span className="material-icons-outlined text-xs text-primary-500">verified_user</span>
                                                    {cert.name}
                                                </h5>
                                                {cert.expirationDate ? (
                                                    <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                                                        isExpired 
                                                            ? 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-450 border border-red-200 dark:border-red-900/40 font-bold' 
                                                            : 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400 border border-green-200 dark:border-green-900/40'
                                                    }`}>
                                                        {isExpired ? 'Vencido' : 'Ativo'}
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400 border border-gray-200 dark:border-slate-800">
                                                        Sem Expiração
                                                    </span>
                                                )}
                                            </div>
                                            {cert.institution && (
                                                <p className="text-xs text-slate-500 mb-2">
                                                    <span className="font-semibold text-slate-600 dark:text-slate-400">Emissor:</span> {cert.institution}
                                                </p>
                                            )}
                                        </div>
                                        <div className="pt-2.5 border-t border-gray-200/50 dark:border-white/5 grid grid-cols-2 gap-2 text-xs text-slate-500">
                                            <div>
                                                <span className="block text-slate-400 text-[10px] uppercase tracking-wider">Conclusão:</span>
                                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                                    {cert.completionDate ? new Date(cert.completionDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '-'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="block text-slate-400 text-[10px] uppercase tracking-wider">Vencimento:</span>
                                                <span className={`font-medium ${isExpired ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>
                                                    {cert.expirationDate ? new Date(cert.expirationDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'Sem Validade'}
                                                </span>
                                            </div>
                                            {cert.certificateNumber && (
                                                <div className="col-span-2 pt-2 border-t border-dashed border-gray-200/50 dark:border-white/5 text-[11px] flex items-center justify-between">
                                                    <span className="text-slate-400 uppercase text-[9px] tracking-wider">Registro/Certificado:</span>
                                                    <span className="bg-slate-200/60 dark:bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono text-slate-800 dark:text-slate-200 font-bold">{cert.certificateNumber}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Alojamento & Moradia */}
                    {(() => {
                        const residentProperty = properties.find(p => p.residentIds && p.residentIds.includes(selectedEmployee.id));
                        if (residentProperty) {
                            return (
                                <div className="mt-6 mb-4">
                                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-white/5 pb-2 flex items-center gap-1.5">
                                        <span className="material-icons-outlined text-sm text-primary-500">holiday_village</span> Alojamento & Moradia
                                    </h4>
                                    <div className="p-4 bg-slate-50/50 dark:bg-[#121212] border border-gray-150 dark:border-white/5 rounded-xl">
                                        <div className="flex justify-between items-start mb-2 gap-2">
                                            <div>
                                                <h5 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">
                                                    {residentProperty.name}
                                                </h5>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 font-semibold">
                                                    <span className="material-icons-outlined text-xs">place</span>
                                                    {residentProperty.addressStreet}, Nº {residentProperty.addressNumber} {residentProperty.addressComplement ? `- ${residentProperty.addressComplement}` : ''}
                                                </p>
                                                <span className="text-xs text-slate-400 dark:text-slate-500 pl-4.5 mt-0.5 block">
                                                    {residentProperty.addressNeighborhood}, {residentProperty.addressCity}/{residentProperty.addressState} — CEP: {residentProperty.addressZip}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-150 shrink-0">
                                                Hospedado
                                            </span>
                                        </div>
                                        {residentProperty.associatedWorkName && (
                                            <div className="inline-flex items-center gap-1 mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-md">
                                                <span className="material-icons-outlined text-sm">construction</span>
                                                Obra Vinculada: {residentProperty.associatedWorkName}
                                            </div>
                                        )}
                                        <div className="mt-3.5 pt-3.5 border-t border-gray-200/50 dark:border-white/5">
                                            <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider block mb-2">Mobília Disponível / Atribuída ao Imóvel:</span>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {residentProperty.furniture && residentProperty.furniture.length > 0 ? (
                                                    residentProperty.furniture.map((f: any) => (
                                                        <div key={f.id} className="text-xs p-2 bg-white dark:bg-white/5 rounded-lg border border-gray-150 dark:border-white/5 flex justify-between items-center font-bold text-slate-700 dark:text-slate-300 animate-in fade-in">
                                                            <span>{f.quantity}x {f.name}</span>
                                                            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 font-black">{f.condition}</span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-[11px] text-slate-400 italic">Nenhum mobiliário cadastrado.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        } else {
                            return (
                                <div className="mt-6 mb-4">
                                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-white/5 pb-2 flex items-center gap-1.5">
                                        <span className="material-icons-outlined text-sm text-primary-500">holiday_village</span> Alojamento & Moradia
                                    </h4>
                                    <div className="p-4 rounded-xl border border-dashed border-gray-200 dark:border-white/10 text-center bg-slate-50/50 dark:bg-white/5">
                                        <p className="text-xs text-slate-400 italic font-bold">Nenhum alojamento associado</p>
                                        <p className="text-[10px] text-slate-500 mt-1">Este colaborador não se encontra hospedado em nenhum imóvel de apoio no momento.</p>
                                    </div>
                                </div>
                            );
                        }
                    })()}

                    {/* Ferramental & Equipamentos sob Guarda */}
                    {(() => {
                        const assignedTools = tools.filter(t => t.responsibleEmployeeIds && t.responsibleEmployeeIds.includes(selectedEmployee.id));
                        return (
                            <div className="mt-6 mb-4">
                                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-white/5 pb-2 flex items-center gap-1.5">
                                    <span className="material-icons-outlined text-sm text-primary-500">handyman</span> Ferramental & Equipamentos sob Custódia
                                </h4>
                                {assignedTools.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in">
                                        {assignedTools.map(t => (
                                            <div key={t.id} className="p-3 bg-slate-50/50 dark:bg-[#121212] border border-gray-150 dark:border-white/5 rounded-xl flex flex-col justify-between">
                                                <div>
                                                    <div className="flex justify-between items-start gap-1">
                                                        <span className="text-[9px] font-black uppercase text-indigo-650 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded block w-fit">
                                                            {t.category}
                                                        </span>
                                                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-350">
                                                            {t.condition}
                                                        </span>
                                                    </div>
                                                    <h5 className="font-extrabold text-slate-800 dark:text-slate-100 text-xs mt-1.5 leading-tight">
                                                        {t.name}
                                                    </h5>
                                                    {t.serialNumber && (
                                                        <p className="text-[10px] text-slate-405 dark:text-slate-500 font-mono mt-1">Reg/Série: {t.serialNumber}</p>
                                                    )}
                                                </div>
                                                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-455 font-semibold">
                                                    <span>Qtd: {t.quantity} un</span>
                                                    {t.associatedWorkName && (
                                                        <span className="text-indigo-600 dark:text-indigo-400 max-w-[120px] truncate" title={t.associatedWorkName}>
                                                            Obra: {t.associatedWorkName}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-xl border border-dashed border-gray-200 dark:border-white/10 text-center bg-slate-50/50 dark:bg-white/5">
                                        <p className="text-xs text-slate-400 italic font-bold">Nenhum equipamento atribuído</p>
                                        <p className="text-[10px] text-slate-500 mt-1">Este colaborador não possui ferramentas de trabalho ou equipamentos em seu termo de responsabilidade no momento.</p>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>

                <div className="p-6 border-t border-gray-100 dark:border-dark-border bg-gray-50 dark:bg-white/5 flex justify-end gap-3 rounded-b-xl">
                    <button onClick={() => setShowViewModal(false)} className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/5 transition-colors font-medium">
                        Fechar
                    </button>
                    <button 
                        onClick={handlePrint}
                        className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-900 dark:hover:bg-slate-600 shadow-sm transition-colors flex items-center gap-2 font-medium"
                    >
                        <span className="material-icons-outlined">print</span>
                        Imprimir / PDF
                    </button>
                </div>
            </div>
        </div>
      )}

      {isDirectValesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCloseDirectVales}></div>
          
          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 w-full max-w-2xl z-10 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-150 dark:border-white/5 flex justify-between items-center shrink-0">
              <h3 className="text-base font-black text-slate-800 dark:text-gray-100 flex items-center gap-2 uppercase tracking-wide">
                <span className="material-icons-outlined text-amber-550">payments</span>
                Lançador Rápido de Vales & Adiantamentos
              </h3>
              <button type="button" onClick={handleCloseDirectVales} className="text-slate-400 hover:text-slate-655 dark:hover:text-slate-200 p-1.5 rounded-lg">
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Selecionar Colaborador */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-tight">Colaborador Alvo</label>
                <select
                  value={valesEmployee?.id || ''}
                  onChange={(e) => {
                    const emp = employees.find(x => x.id === e.target.value);
                    setValesEmployee(emp || null);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-750 bg-slate-50 dark:bg-[#121212] text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                >
                  <option value="" disabled>-- Selecione o colaborador --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role} - {emp.department})
                    </option>
                  ))}
                </select>
              </div>

              {valesEmployee ? (
                <>
                  {/* Informações de Apoio Financeiro */}
                  <div className="bg-amber-50/45 dark:bg-amber-955/10 p-4 rounded-xl border border-amber-100/60 dark:border-amber-900/40 text-xs flex justify-between items-center">
                    <div>
                      <span className="text-slate-400 uppercase font-bold text-[9px] block">Colaborador selecionado</span>
                      <span className="font-extrabold text-[#9A7F31] dark:text-amber-400 text-sm">{valesEmployee.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 uppercase font-bold text-[9px] block">Salário Base</span>
                      <span className="font-extrabold text-slate-700 dark:text-slate-300 text-sm">
                        {valesEmployee.salary ? `R$ ${valesEmployee.salary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não Informado'}
                      </span>
                    </div>
                  </div>

                  {/* Form de Lançamento */}
                  <div className="bg-slate-50/50 dark:bg-white/5 p-4 rounded-xl border border-gray-150 dark:border-white/5 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Novo Lançamento</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Tipo</label>
                        <select 
                          value={directValesType} 
                          onChange={e => setDirectValesType(e.target.value as any)} 
                          className="w-full px-2.5 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/50 focus:outline-none"
                        >
                          <option value="Vale">Vale</option>
                          <option value="Adiantamento">Adiantamento</option>
                          <option value="Outros">Outras Deduções</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Valor (R$)</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">R$</span>
                          <input 
                            type="number" 
                            step="0.01" 
                            placeholder="0,00" 
                            value={directValesAmount} 
                            onChange={e => setDirectValesAmount(e.target.value)} 
                            className="w-full pl-7 pr-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/50 focus:outline-none font-bold"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Data</label>
                        <input 
                          type="date" 
                          value={directValesDate} 
                          onChange={e => setDirectValesDate(e.target.value)} 
                          className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/50 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 items-end pt-1">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Obs / Referência (Opcional)</label>
                        <input 
                          type="text" 
                          placeholder="Ex: Ref adiantamento quinzenal" 
                          value={directValesNotes} 
                          onChange={e => setDirectValesNotes(e.target.value)} 
                          className="w-full px-3 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121212] text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/50 focus:outline-none"
                        />
                      </div>
                      <div className="shrink-0">
                        <button 
                          type="button" 
                          onClick={handleAddDirectAdvance}
                          className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-black flex items-center justify-center shadow-sm h-[32px] gap-1 cursor-pointer transition-colors"
                        >
                          <span className="material-icons-outlined text-sm font-bold">add</span>
                          <span>Lançar</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Histórico do Colaborador Selecionado */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Histórico de Vales e Adiantamentos</h4>
                    <div className="border border-gray-150 dark:border-white/5 rounded-xl overflow-hidden max-h-56 overflow-y-auto bg-white dark:bg-dark-card">
                      {(!valesEmployee.advances || valesEmployee.advances.length === 0) ? (
                        <div className="p-8 text-center text-slate-400 dark:text-slate-500 italic text-xs">
                          Nenhum vale ou adiantamento lançado para este colaborador.
                        </div>
                      ) : (
                        <table className="w-full text-left text-xs text-slate-650 dark:text-slate-350">
                          <thead className="bg-slate-50 dark:bg-white/5">
                            <tr className="border-b border-gray-150 dark:border-white/5 text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[9px] font-bold">
                              <th className="py-2.5 px-3">Tipo</th>
                              <th className="py-2.5 px-3">Valor</th>
                              <th className="py-2.5 px-3">Data</th>
                              <th className="py-2.5 px-3">Observação</th>
                              <th className="py-2.5 px-3 text-right">Ação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {valesEmployee.advances.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                                <td className="py-2.5 px-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    item.type === 'Vale' 
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400' 
                                      : item.type === 'Adiantamento'
                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400'
                                        : 'bg-slate-100 text-slate-800 dark:bg-slate-950/40 dark:text-slate-400'
                                  }`}>
                                    {item.type}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-200">
                                  R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                                  {item.date ? new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                                  {item.notes || '-'}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <button 
                                    type="button" 
                                    onClick={() => handleDeleteDirectAdvance(item.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors"
                                    title="Remover Lançamento"
                                  >
                                    <span className="material-icons-outlined text-sm">delete</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 italic text-xs bg-slate-50/50 dark:bg-white/5 rounded-xl">
                  Selecione um colaborador acima para iniciar o lançamento.
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5 flex justify-end gap-3 rounded-b-2xl shrink-0">
              <button
                type="button"
                onClick={handleCloseDirectVales}
                className="px-5 py-2 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 font-extrabold text-xs uppercase tracking-tight rounded-xl transition-all border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-card"
              >
                Voltar / Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;