
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface SettingsProps {
  isDark: boolean;
  toggleTheme: () => void;
}

interface OrganizationItem {
  id: number;
  name: string;
}

interface HolidayItem {
  id: number;
  name: string;
  date: string;
  type: 'Nacional' | 'Regional' | 'Municipal';
}

interface RecoveryPoint {
  id: string;
  name: string;
  timestamp: string;
  isAuto: boolean;
  summary: {
    employees: number;
    works: number;
    properties: number;
    tools: number;
    ppe_items: number;
    tasks: number;
  };
  payload: any;
}

const Settings: React.FC<SettingsProps> = ({ isDark, toggleTheme }) => {
  // Notification States
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [isSavingNotifs, setIsSavingNotifs] = useState(false);
  const [notifMessage, setNotifMessage] = useState('');
  
  // Email Validation State
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState('');

  // Password Change States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [statusMessage, setStatusMessage] = useState('');

  // Company Data State
  const [companyData, setCompanyData] = useState({
    companyName: '',
    cnpj: '',
    email: '',
    phone: '',
    website: '',
    contactName: '',
    contactPhone: '',
    address: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zipCode: ''
  });
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [companyMessage, setCompanyMessage] = useState('');

  // Structure Management States (Departments & Roles)
  const [newDept, setNewDept] = useState('');
  const [newRole, setNewRole] = useState('');
  
  const [departments, setDepartments] = useState<OrganizationItem[]>([]);
  const [roles, setRoles] = useState<OrganizationItem[]>([]);
  const [isLoadingStructure, setIsLoadingStructure] = useState(true);

  // Holidays State
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [holidayForm, setHolidayForm] = useState({ name: '', date: '', type: 'Nacional' });
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(false);

  // Recovery / History States
  const [recoveryPoints, setRecoveryPoints] = useState<RecoveryPoint[]>([]);
  const [newRecoveryName, setNewRecoveryName] = useState('');
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const [backupError, setBackupError] = useState('');

  // Load initial data
  useEffect(() => {
    fetchCompanyData();
    fetchStructure();
    fetchHolidays();
    loadRecoveryPoints();
  }, []);

  const loadRecoveryPoints = () => {
    const raw = localStorage.getItem('gestaorh_recovery_points');
    if (raw) {
      try {
        setRecoveryPoints(JSON.parse(raw));
      } catch (e) {
        console.error("Erro ao ler pontos de recuperação:", e);
      }
    }
  };

  const fetchCompanyData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setCompanyData({
          companyName: data.company_name || '',
          cnpj: data.cnpj || '',
          email: data.email || '',
          phone: data.phone || '',
          website: data.website || '',
          contactName: data.contact_name || '',
          contactPhone: data.contact_phone || '',
          address: data.address_info?.rua || '',
          number: data.address_info?.numero || '',
          complement: data.address_info?.complemento || '',
          neighborhood: data.address_info?.bairro || '',
          city: data.address_info?.cidade || '',
          state: data.address_info?.estado || '',
          zipCode: data.address_info?.cep || ''
        });
      }
    } catch (error) {
      // Se não encontrar dados (primeiro acesso), não é um erro crítico
      console.log("Nenhum dado de empresa encontrado ou erro:", error);
    }
  };

  const fetchStructure = async () => {
    setIsLoadingStructure(true);
    try {
      // Fetch Departments
      const { data: deptData, error: deptError } = await supabase
        .from('company_departments')
        .select('*')
        .order('name');
      
      if (deptData) setDepartments(deptData);
      else if (deptError) console.warn("Tabela company_departments pode não existir ou erro de permissão.", deptError.message);

      // Fetch Roles
      const { data: roleData, error: roleError } = await supabase
        .from('company_roles')
        .select('*')
        .order('name');

      if (roleData) setRoles(roleData);
      else if (roleError) console.warn("Tabela company_roles pode não existir ou erro de permissão.", roleError.message);

    } catch (error) {
      console.error("Erro ao carregar estrutura:", error);
    } finally {
      setIsLoadingStructure(false);
    }
  };

  const fetchHolidays = async () => {
    setIsLoadingHolidays(true);
    try {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .order('date', { ascending: true });

      if (data) {
        const typedData = data.map((h: any) => ({
             id: h.id,
             name: h.name,
             date: h.date,
             type: h.type as 'Nacional' | 'Regional' | 'Municipal'
        }));
        setHolidays(typedData);
      } else if (error) {
        console.warn("Tabela holidays: ", error.message);
      }
    } catch (error) {
      console.error("Erro ao carregar feriados:", error);
    } finally {
      setIsLoadingHolidays(false);
    }
  };

  // --- COMPONENTES DE BACKUP, HISTÓRICO E RECUPERAÇÃO DE DADOS ---

  const handleCreateBackupPoint = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setIsCreatingBackup(true);
      setBackupMessage('Iniciando exportação e consolidação de tabelas...');
      setBackupError('');

      // Safe fetch wrappers
      const safeFetch = async (table: string) => {
        try {
          const { data, error } = await supabase.from(table).select('*');
          if (error) {
            console.warn(`Tabela ${table} ignorada ou indisponível:`, error.message);
            return [];
          }
          return data || [];
        } catch (e) {
          console.warn(`Crítico ao ler tabela ${table}:`, e);
          return [];
        }
      };

      const [
        employees,
        properties,
        works,
        tools,
        holidaysDb,
        company_departments,
        company_roles,
        companies,
        tasks,
        documents,
        messages,
        ppe_items,
        ppe_suppliers,
        ppe_deliveries,
        ppe_returns
      ] = await Promise.all([
        safeFetch('employees'),
        safeFetch('properties'),
        safeFetch('works'),
        safeFetch('tools'),
        safeFetch('holidays'),
        safeFetch('company_departments'),
        safeFetch('company_roles'),
        safeFetch('companies'),
        safeFetch('tasks'),
        safeFetch('documents'),
        safeFetch('messages'),
        safeFetch('ppe_items'),
        safeFetch('ppe_suppliers'),
        safeFetch('ppe_deliveries'),
        safeFetch('ppe_returns')
      ]);

      const payload = {
        employees,
        properties,
        works,
        tools,
        holidays: holidaysDb,
        company_departments,
        company_roles,
        companies,
        tasks,
        documents,
        messages,
        ppe_items,
        ppe_suppliers,
        ppe_deliveries,
        ppe_returns
      };

      const summary = {
        employees: employees.length,
        works: works.length,
        properties: properties.length,
        tools: tools.length,
        ppe_items: ppe_items.length,
        tasks: tasks.length
      };

      const pointName = newRecoveryName.trim() || `Backup Geral - ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;

      const newPoint: RecoveryPoint = {
        id: `rec-${Date.now()}`,
        name: pointName,
        timestamp: new Date().toISOString(),
        isAuto: !newRecoveryName.trim(),
        summary,
        payload
      };

      const updated = [newPoint, ...recoveryPoints];
      setRecoveryPoints(updated);
      localStorage.setItem('gestaorh_recovery_points', JSON.stringify(updated));
      setNewRecoveryName('');
      
      setBackupMessage(`Ponto de recuperação "${pointName}" salvo com sucesso localmente!`);
      setTimeout(() => setBackupMessage(''), 4500);
    } catch (err: any) {
      console.error(err);
      setBackupError('Erro ao criar ponto de histórico: ' + err.message);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleDeleteBackupPoint = (id: string, name: string) => {
    if (confirm(`Excluir o ponto de recuperação "${name}" da lista histórica?\n\nIsso removerá apenas este registro das opções locais.`)) {
      const updated = recoveryPoints.filter(p => p.id !== id);
      setRecoveryPoints(updated);
      localStorage.setItem('gestaorh_recovery_points', JSON.stringify(updated));
    }
  };

  const handleClearAllPoints = () => {
    if (confirm('DESEJA REALMENTE LIMPAR TODOS OS SEUS PONTOS HISTÓRICOS?\n\nEsta ação removerá todos os checkpoints armazenados no seu navegador local.')) {
      setRecoveryPoints([]);
      localStorage.removeItem('gestaorh_recovery_points');
    }
  };

  const handleRestoreBackupPoint = async (point: RecoveryPoint) => {
    const isConfirmed = confirm(
      `ATENÇÃO: ALERTA DE SEGURANÇA ⚠️\n\n` +
      `Isso irá SOBRESCREVER de forma definitiva os dados atuais do banco de dados pelos dados salvos no snapshot "${point.name}".\n\n` +
      `Esta ação fará a restauração completa das tabelas.\n` +
      `Deseja prosseguir com a restauração de segurança dos dados?`
    );
    if (!isConfirmed) return;

    try {
      setIsRestoringBackup(true);
      setBackupMessage('Iniciando substituição segura de dados em massa...');
      setBackupError('');

      const p = point.payload;

      // Safe clean function
      const safeClean = async (table: string, keyField: string = 'id') => {
        try {
          const { error } = await supabase.from(table).delete().not(keyField, 'is', null);
          if (error) {
            console.warn(`Aviso de limpeza na tabela ${table}:`, error.message);
          }
        } catch (e) {
          console.warn(`Erro limpando ${table}:`, e);
        }
      };

      // Safe insert function
      const safeInsert = async (table: string, rows: any[]) => {
        if (!rows || rows.length === 0) return;
        try {
          const { error } = await supabase.from(table).insert(rows);
          if (error) {
            console.warn(`Lote falhou na tabela ${table}, tentando inserção unitária...`, error.message);
            // Fallback: Tentativa uma a uma para não violar integridade parcial ou travar em nulos
            for (const r of rows) {
              await supabase.from(table).insert([r]).catch(err => {
                console.error(`Falha ao restaurar registro unitário em ${table}:`, err);
              });
            }
          }
        } catch (e) {
          console.warn(`Erro inserindo dados em ${table}:`, e);
        }
      };

      // 1. Limpar todas as tabelas na ordem de dependências (Filhas primeiro)
      setBackupMessage('Limpando registros atuais (Fase 1/2)...');
      await safeClean('ppe_deliveries');
      await safeClean('ppe_returns');
      await safeClean('ppe_items');
      await safeClean('ppe_suppliers');
      await safeClean('tasks');
      await safeClean('documents');
      await safeClean('messages');
      await safeClean('tools');
      await safeClean('properties');
      await safeClean('works');
      await safeClean('employees');
      await safeClean('holidays');
      await safeClean('company_roles');
      await safeClean('company_departments');
      await safeClean('companies');

      // 2. Restaurar registros na ordem de consistência de chaves-estrangeiras (Mães primeiro)
      setBackupMessage('Injetando dados do checkpoint selecionado (Fase 2/2)...');
      await safeInsert('companies', p.companies || []);
      await safeInsert('company_departments', p.company_departments || []);
      await safeInsert('company_roles', p.company_roles || []);
      await safeInsert('holidays', p.holidays || []);
      await safeInsert('employees', p.employees || []);
      await safeInsert('works', p.works || []);
      await safeInsert('properties', p.properties || []);
      await safeInsert('tools', p.tools || []);
      await safeInsert('messages', p.messages || []);
      await safeInsert('documents', p.documents || []);
      await safeInsert('tasks', p.tasks || []);
      await safeInsert('ppe_suppliers', p.ppe_suppliers || []);
      await safeInsert('ppe_items', p.ppe_items || []);
      await safeInsert('ppe_deliveries', p.ppe_deliveries || []);
      await safeInsert('ppe_returns', p.ppe_returns || []);

      // Atualiza os estados locais
      setBackupMessage('Atualizando tela de configurações...');
      await fetchCompanyData();
      await fetchStructure();
      await fetchHolidays();

      setBackupMessage('Parabéns! Sistema totalmente recuperado para o estado original.');
      setTimeout(() => setBackupMessage(''), 5050);
      alert('Restauração efetuada com absoluto sucesso!');
    } catch (err: any) {
      console.error(err);
      setBackupError('Falha durante a recuperação geral do snapshot: ' + err.message);
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      setIsCreatingBackup(true);
      setBackupMessage('Consolidando dados em arquivo JSON...');
      setBackupError('');

      const safeFetch = async (table: string) => {
        try {
          const { data, error } = await supabase.from(table).select('*');
          if (error) return [];
          return data || [];
        } catch (e) {
          return [];
        }
      };

      const [
        employees,
        properties,
        works,
        tools,
        holidaysDb,
        company_departments,
        company_roles,
        companies,
        tasks,
        documents,
        messages,
        ppe_items,
        ppe_suppliers,
        ppe_deliveries,
        ppe_returns
      ] = await Promise.all([
        safeFetch('employees'),
        safeFetch('properties'),
        safeFetch('works'),
        safeFetch('tools'),
        safeFetch('holidays'),
        safeFetch('company_departments'),
        safeFetch('company_roles'),
        safeFetch('companies'),
        safeFetch('tasks'),
        safeFetch('documents'),
        safeFetch('messages'),
        safeFetch('ppe_items'),
        safeFetch('ppe_suppliers'),
        safeFetch('ppe_deliveries'),
        safeFetch('ppe_returns')
      ]);

      const backupObj = {
        app: "GestãoRH Pro",
        version: "1.1.2",
        exportedAt: new Date().toISOString(),
        data: {
          employees,
          properties,
          works,
          tools,
          holidays: holidaysDb,
          company_departments,
          company_roles,
          companies,
          tasks,
          documents,
          messages,
          ppe_items,
          ppe_suppliers,
          ppe_deliveries,
          ppe_returns
        }
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      
      const formattedDate = new Date().toISOString().split('T')[0];
      downloadAnchor.setAttribute("download", `gestaorh_pro_backup_${formattedDate}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setBackupMessage('Download do arquivo de backup iniciado!');
      setTimeout(() => setBackupMessage(''), 3000);
    } catch (err: any) {
      setBackupError('Erro na exportação de chaves: ' + err.message);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const rawJson = e.target?.result as string;
        const parsed = JSON.parse(rawJson);

        if (parsed.app !== "GestãoRH Pro" || !parsed.data) {
          alert("O arquivo selecionado não é compatível com os padrões de dados do GestãoRH Pro.");
          return;
        }

        const pointName = `Recuperação Arquivo - ${file.name}`;
        const pointData = parsed.data;

        const point: RecoveryPoint = {
          id: `rec-import-${Date.now()}`,
          name: pointName,
          timestamp: parsed.exportedAt || new Date().toISOString(),
          isAuto: false,
          summary: {
            employees: pointData.employees?.length || 0,
            works: pointData.works?.length || 0,
            properties: pointData.properties?.length || 0,
            tools: pointData.tools?.length || 0,
            ppe_items: pointData.ppe_items?.length || 0,
            tasks: pointData.tasks?.length || 0
          },
          payload: pointData
        };

        const updated = [point, ...recoveryPoints];
        setRecoveryPoints(updated);
        localStorage.setItem('gestaorh_recovery_points', JSON.stringify(updated));
        
        const wantRestore = confirm(
          `Backup do arquivo "${file.name}" carregado com sucesso listado nos pontos históricos!\n\n` +
          `Deseja restaurar as informações deste arquivo para a aplicação exatamente AGORA?`
        );
        if (wantRestore) {
          await handleRestoreBackupPoint(point);
        } else {
          setBackupMessage(`Snapshot importado está pronto na lista de Pontos de Recuperação.`);
        }
      } catch (err: any) {
        alert("Erro ao ler ou processar arquivo JSON: " + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // --- MÁSCARAS E FORMATAÇÃO ---

  const formatPhoneNumber = (value: string) => {
    // Remove tudo que não é dígito
    let v = value.replace(/\D/g, "");
    
    // Limita tamanho para evitar erros (máximo 11 dígitos para celular com DDD)
    v = v.substring(0, 11);

    // Formata: (XX) XXXXX-XXXX
    if (v.length > 10) { // Celular 9 dígitos
        v = v.replace(/^(\d\d)(\d{5})(\d{4}).*/, "($1) $2-$3");
    } else if (v.length > 5) { // Fixo ou incompleto
        v = v.replace(/^(\d\d)(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    } else if (v.length > 2) { // Apenas DDD
        v = v.replace(/^(\d\d)(\d{0,5}).*/, "($1) $2");
    }
    
    return v;
  };

  const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let newValue = value;

    if (name === 'phone' || name === 'contactPhone') {
      newValue = formatPhoneNumber(value);
    } else if (name === 'email') {
      // Email: remove espaços e força minúsculo
      newValue = value.replace(/\s/g, '').toLowerCase();
    }

    setCompanyData(prev => ({ ...prev, [name]: newValue }));
  };

  const handleCepBlur = async () => {
    const cep = companyData.zipCode.replace(/\D/g, '');
    if (cep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (!data.erro) {
        setCompanyData(prev => ({
          ...prev,
          address: data.logradouro,
          neighborhood: data.bairro,
          city: data.localidade,
          state: data.uf
        }));
      } else {
        console.warn("CEP não encontrado");
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCompany(true);
    setCompanyMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const payload = {
        user_id: user.id,
        company_name: companyData.companyName,
        cnpj: companyData.cnpj,
        email: companyData.email,
        phone: companyData.phone,
        website: companyData.website,
        contact_name: companyData.contactName,
        contact_phone: companyData.contactPhone,
        address_info: {
          cep: companyData.zipCode,
          rua: companyData.address,
          numero: companyData.number,
          complemento: companyData.complement,
          bairro: companyData.neighborhood,
          cidade: companyData.city,
          estado: companyData.state
        }
      };

      const { error } = await supabase
        .from('companies')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;

      setCompanyMessage('Dados da empresa salvos com sucesso!');
      localStorage.setItem('gestaorh_company_data', JSON.stringify(companyData));

    } catch (error: any) {
      alert("Erro ao salvar dados da empresa: " + error.message);
    } finally {
      setIsSavingCompany(false);
      setTimeout(() => setCompanyMessage(''), 3000);
    }
  };

  // Handlers for Structure
  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDept) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('company_departments')
        .insert([{ name: newDept, user_id: user?.id }])
        .select();

      if (error) throw error;
      
      if (data) {
        setDepartments([...departments, data[0]]);
        setNewDept('');
      }
    } catch (error: any) {
      alert("Erro ao adicionar departamento. " + error.message);
    }
  };

  const handleRemoveDepartment = async (id: number, name: string) => {
    if (confirm(`Remover o departamento "${name}"?`)) {
      try {
        const { error } = await supabase
          .from('company_departments')
          .delete()
          .eq('id', id);

        if (error) throw error;

        setDepartments(departments.filter(d => d.id !== id));
      } catch (error: any) {
        alert("Erro ao remover departamento.");
        console.error(error);
      }
    }
  };

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRole) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('company_roles')
        .insert([{ name: newRole, user_id: user?.id }])
        .select();

      if (error) throw error;
      
      if (data) {
        setRoles([...roles, data[0]]);
        setNewRole('');
      }
    } catch (error: any) {
      alert("Erro ao adicionar cargo. " + error.message);
    }
  };

  const handleRemoveRole = async (id: number, name: string) => {
    if (confirm(`Remover o cargo "${name}"?`)) {
      try {
        const { error } = await supabase
          .from('company_roles')
          .delete()
          .eq('id', id);

        if (error) throw error;

        setRoles(roles.filter(r => r.id !== id));
      } catch (error: any) {
        alert("Erro ao remover cargo.");
        console.error(error);
      }
    }
  };

  // Handlers for Holidays
  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayForm.name || !holidayForm.date) return;

    try {
      const { data, error } = await supabase
        .from('holidays')
        .insert([{
          name: holidayForm.name,
          date: holidayForm.date,
          type: holidayForm.type
        }])
        .select();

      if (error) throw error;

      if (data) {
        const newHoliday = {
            id: data[0].id,
            name: data[0].name,
            date: data[0].date,
            type: data[0].type
        } as HolidayItem;
        
        const newHolidays = [...holidays, newHoliday].sort((a,b) => a.date.localeCompare(b.date));
        setHolidays(newHolidays);
        
        setHolidayForm({ name: '', date: '', type: 'Nacional' });
      }
    } catch (error: any) {
      if (error.message?.includes('relation "public.holidays" does not exist') || error.code === '42P01') {
          alert("A tabela 'holidays' não foi encontrada. Execute o script SQL fornecido.");
      } else {
          alert("Erro ao adicionar feriado: " + error.message);
      }
    }
  };

  const handleRemoveHoliday = async (id: number) => {
    if (confirm('Remover este feriado?')) {
        try {
            const { error } = await supabase.from('holidays').delete().eq('id', id);
            if (error) throw error;
            setHolidays(prev => prev.filter(h => h.id !== id));
        } catch (error: any) {
            alert("Erro ao remover: " + error.message);
        }
    }
  };

  const getHolidayTypeColor = (type: string) => {
    switch (type) {
        case 'Nacional': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
        case 'Regional': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
        case 'Municipal': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
        default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Configurações</h2>
        <p className="text-slate-500 dark:text-slate-400">Gerencie seus dados corporativos e preferências.</p>
      </div>

      {/* Aparência */}
      <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-100 dark:border-dark-border">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span className="material-icons-outlined">palette</span> Aparência
          </h3>
        </div>
        <div className="p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800 dark:text-white">Modo Escuro</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Alterne entre temas claro e escuro para melhor conforto visual.</p>
            </div>
            <button 
              onClick={toggleTheme}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${isDark ? 'bg-primary-500' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDark ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Dados da Empresa */}
      <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-100 dark:border-dark-border">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span className="material-icons-outlined">business</span> Dados da Empresa
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Estes dados serão usados em relatórios e documentos.</p>
        </div>
        <div className="p-4 md:p-6">
            <form onSubmit={handleSaveCompany} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Razão Social / Nome da Empresa</label>
                        <input type="text" name="companyName" value={companyData.companyName} onChange={handleCompanyChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" placeholder="Sua Empresa Ltda" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CNPJ</label>
                        <input type="text" name="cnpj" value={companyData.cnpj} onChange={handleCompanyChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" placeholder="00.000.000/0000-00" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Website</label>
                        <input type="text" name="website" value={companyData.website} onChange={handleCompanyChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" placeholder="www.suaempresa.com.br" />
                    </div>
                    
                    <div className="md:col-span-2 border-t border-dashed border-gray-200 dark:border-gray-700 my-2 pt-2">
                         <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Contato Principal</p>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do Contato</label>
                                <input type="text" name="contactName" value={companyData.contactName} onChange={handleCompanyChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" placeholder="Ex: João Silva" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone do Contato</label>
                                <input 
                                  type="text" 
                                  name="contactPhone" 
                                  value={companyData.contactPhone} 
                                  onChange={handleCompanyChange} 
                                  maxLength={15}
                                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" 
                                  placeholder="(00) 00000-0000" 
                                />
                            </div>
                         </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Geral</label>
                        <input type="email" name="email" value={companyData.email} onChange={handleCompanyChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" placeholder="contato@suaempresa.com.br" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone Geral</label>
                        <input 
                          type="text" 
                          name="phone" 
                          value={companyData.phone} 
                          onChange={handleCompanyChange} 
                          maxLength={15}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" 
                          placeholder="(00) 0000-0000" 
                        />
                    </div>
                </div>
                
                <div className="border-t border-gray-100 dark:border-white/5 pt-4 mt-2">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Endereço</h4>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                        <div className="md:col-span-1">
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">CEP</label>
                            <input 
                              type="text" 
                              name="zipCode" 
                              value={companyData.zipCode} 
                              onChange={handleCompanyChange} 
                              onBlur={handleCepBlur}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 text-sm" 
                              placeholder="00000-000"
                            />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Logradouro</label>
                            <input type="text" name="address" value={companyData.address} onChange={handleCompanyChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 text-sm" />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Número</label>
                            <input type="text" name="number" value={companyData.number} onChange={handleCompanyChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 text-sm" />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Andar / Sala</label>
                            <input type="text" name="complement" value={companyData.complement} onChange={handleCompanyChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 text-sm" placeholder="Comp." />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Bairro</label>
                            <input type="text" name="neighborhood" value={companyData.neighborhood} onChange={handleCompanyChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 text-sm" />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Cidade</label>
                            <input type="text" name="city" value={companyData.city} onChange={handleCompanyChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 text-sm" />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Estado</label>
                            <input type="text" name="state" value={companyData.state} onChange={handleCompanyChange} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 text-sm" maxLength={2} />
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                    {companyMessage && <span className="text-sm text-green-600 dark:text-green-400 animate-fade-in flex items-center gap-1"><span className="material-icons-outlined text-sm">check</span> {companyMessage}</span>}
                    <div className="flex-1"></div>
                    <button 
                        type="submit" 
                        disabled={isSavingCompany}
                        className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                        {isSavingCompany ? <span className="material-icons-outlined animate-spin text-sm">refresh</span> : <span className="material-icons-outlined text-sm">save</span>}
                        Salvar Dados
                    </button>
                </div>
            </form>
        </div>
      </div>

      {/* Estrutura Corporativa */}
      <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-100 dark:border-dark-border">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span className="material-icons-outlined">domain</span> Estrutura Corporativa
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gerencie os departamentos e cargos disponíveis no sistema.</p>
        </div>
        <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Departamentos */}
          <div>
            <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <span className="material-icons-outlined text-primary-500 text-sm">business</span> Departamentos
            </h4>
            <form onSubmit={handleAddDepartment} className="flex gap-2 mb-4">
              <input 
                type="text" 
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                placeholder="Novo departamento..."
                className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              />
              <button 
                type="submit"
                disabled={!newDept}
                className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors shrink-0 flex items-center justify-center"
              >
                <span className="material-icons-outlined text-sm">add</span>
              </button>
            </form>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
              {isLoadingStructure ? (
                <span className="text-xs text-slate-400">Carregando...</span>
              ) : departments.length > 0 ? departments.map((dept) => (
                <span key={dept.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-gray-200 dark:border-white/5">
                  {dept.name}
                  <button 
                    onClick={() => handleRemoveDepartment(dept.id, dept.name)}
                    className="ml-1 text-slate-400 hover:text-red-500 flex items-center"
                    title="Excluir"
                  >
                    <span className="material-icons-outlined text-[14px]">close</span>
                  </button>
                </span>
              )) : <span className="text-xs text-slate-400 italic">Nenhum departamento.</span>}
            </div>
          </div>

          {/* Cargos */}
          <div>
            <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <span className="material-icons-outlined text-primary-500 text-sm">badge</span> Cargos e Funções
            </h4>
            <form onSubmit={handleAddRole} className="flex gap-2 mb-4">
              <input 
                type="text" 
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                placeholder="Novo cargo..."
                className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              />
              <button 
                type="submit"
                disabled={!newRole}
                className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors shrink-0 flex items-center justify-center"
              >
                <span className="material-icons-outlined text-sm">add</span>
              </button>
            </form>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
              {isLoadingStructure ? (
                <span className="text-xs text-slate-400">Carregando...</span>
              ) : roles.length > 0 ? roles.map((role) => (
                <span key={role.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-gray-200 dark:border-white/5">
                  {role.name}
                  <button 
                    onClick={() => handleRemoveRole(role.id, role.name)}
                    className="ml-1 text-slate-400 hover:text-red-500 flex items-center"
                    title="Excluir"
                  >
                    <span className="material-icons-outlined text-[14px]">close</span>
                  </button>
                </span>
              )) : <span className="text-xs text-slate-400 italic">Nenhum cargo.</span>}
            </div>
          </div>

        </div>
      </div>

      {/* Calendário de Feriados */}
      <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden">
         <div className="p-4 md:p-6 border-b border-gray-100 dark:border-dark-border">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span className="material-icons-outlined">calendar_today</span> Calendário de Feriados
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Cadastre os feriados nacionais, estaduais e municipais.</p>
         </div>
         <div className="p-4 md:p-6">
            <form onSubmit={handleAddHoliday} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="md:col-span-2">
                    <input 
                      type="text" 
                      placeholder="Nome do Feriado" 
                      value={holidayForm.name}
                      onChange={(e) => setHolidayForm({...holidayForm, name: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                      required
                    />
                </div>
                <div>
                    <input 
                      type="date" 
                      value={holidayForm.date}
                      onChange={(e) => setHolidayForm({...holidayForm, date: e.target.value})}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                      required
                    />
                </div>
                <div className="flex gap-2">
                    <select 
                      value={holidayForm.type}
                      onChange={(e) => setHolidayForm({...holidayForm, type: e.target.value as any})}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                    >
                        <option value="Nacional">Nacional</option>
                        <option value="Regional">Regional</option>
                        <option value="Municipal">Municipal</option>
                    </select>
                    <button 
                        type="submit"
                        className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors flex items-center justify-center"
                        title="Adicionar Feriado"
                    >
                        <span className="material-icons-outlined">add</span>
                    </button>
                </div>
            </form>

            <div className="max-h-60 overflow-y-auto">
               {isLoadingHolidays ? (
                   <p className="text-sm text-slate-400 text-center py-4">Carregando...</p>
               ) : holidays.length === 0 ? (
                   <p className="text-sm text-slate-400 text-center py-4 italic">Nenhum feriado cadastrado.</p>
               ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                       {holidays.map(holiday => (
                           <div key={holiday.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5">
                               <div>
                                   <p className="font-medium text-slate-800 dark:text-white text-sm">{holiday.name}</p>
                                   <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                       <span className="material-icons-outlined text-xs">event</span>
                                       {new Date(holiday.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                                       <span className={`px-1.5 py-0.5 rounded text-[10px] ${getHolidayTypeColor(holiday.type)}`}>{holiday.type}</span>
                                   </p>
                               </div>
                               <button 
                                   onClick={() => handleRemoveHoliday(holiday.id)}
                                   className="text-slate-400 hover:text-red-500 p-1"
                               >
                                   <span className="material-icons-outlined text-sm">delete</span>
                               </button>
                           </div>
                       ))}
                   </div>
               )}
            </div>
         </div>
      </div>

      {/* Ponto de Histórico, Salvamento e Recuperação de Dados */}
      <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-100 dark:border-dark-border bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span className="material-icons-outlined text-primary-500">settings_backup_restore</span> Histórico e Recuperação de Dados
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Crie pontos de segurança instantâneos, baixe cópias físicas ou restaure estados anteriores em caso de falha.
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportBackup}
                disabled={isCreatingBackup || isRestoringBackup}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-all disabled:opacity-50"
                title="Fazer download de todos os dados do banco como arquivo JSON"
              >
                <span className="material-icons-outlined text-sm">cloud_download</span>
                Exportar Arquivo
              </button>

              <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50">
                <span className="material-icons-outlined text-sm">file_upload</span>
                Importar Arquivo
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  disabled={isCreatingBackup || isRestoringBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          {/* Notificações de Status do Backup */}
          {backupMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-400 rounded-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
              <span className="material-icons-outlined text-base text-emerald-500 animate-pulse">check_circle</span>
              <span>{backupMessage}</span>
            </div>
          )}

          {backupError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 text-rose-800 dark:text-rose-400 rounded-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
              <span className="material-icons-outlined text-base text-rose-500">error_outline</span>
              <span>{backupError}</span>
            </div>
          )}

          {/* Painel para criar Novo Checkpoint manual */}
          <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-gray-150 dark:border-white/5">
            <h4 className="text-xs font-bold text-slate-650 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="material-icons-outlined text-xs">add_to_photos</span>
              Novo Checkpoint de Segurança (Ponto Histórico)
            </h4>
            <form onSubmit={handleCreateBackupPoint} className="flex flex-col md:flex-row gap-3">
              <input
                type="text"
                value={newRecoveryName}
                onChange={(e) => setNewRecoveryName(e.target.value)}
                disabled={isCreatingBackup || isRestoringBackup}
                placeholder="Digite um rótulo personalizado (Ex: Antes de importar planilha, Obra Bella Vista OK)"
                className="flex-1 px-3 py-2 border border-gray-205 dark:border-white/10 rounded-lg bg-white dark:bg-[#1E1E1E] text-xs text-slate-800 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder:text-slate-405"
              />
              <button
                type="submit"
                disabled={isCreatingBackup || isRestoringBackup}
                className="px-5 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-450 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all shrink-0 hover:scale-[1.01]"
              >
                {isCreatingBackup ? (
                  <>
                    <span className="material-icons-outlined animate-spin text-sm">refresh</span>
                    Processando...
                  </>
                ) : (
                  <>
                     <span className="material-icons-outlined text-sm">save</span>
                     Salvar Ponto Local
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Histórico de Pontos Gravados */}
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-gray-100 dark:border-white/5 pb-2">
              <h4 className="text-xs font-bold text-slate-650 dark:text-slate-350 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-icons-outlined text-sm">history</span>
                Linha do Tempo de Recuperações ({recoveryPoints.length})
              </h4>
              {recoveryPoints.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllPoints}
                  className="text-[10px] text-slate-400 hover:text-red-500 font-bold uppercase tracking-wider transition-colors"
                >
                  Limpar Histórico
                </button>
              )}
            </div>

            {recoveryPoints.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-gray-200 dark:border-white/5 rounded-xl">
                <span className="material-icons-outlined text-3xl text-slate-300 dark:text-slate-700">inventory_2</span>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1.5">Nenhum ponto de recuperação gravado localmente.</p>
                <p className="text-[10px] text-slate-400/80 italic mt-0.5">Use o formulário acima para criar o seu primeiro snapshot de segurança.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {recoveryPoints.map((point) => (
                  <div 
                    key={point.id} 
                    className="p-3 border border-gray-150 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.04] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800 dark:text-slate-100 text-xs">
                          {point.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                          <span className="material-icons-outlined text-[10px]">schedule</span>
                          {new Date(point.timestamp).toLocaleString('pt-BR')}
                        </span>
                        {point.isAuto && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-100/30 uppercase tracking-widest text-center">
                            Automático
                          </span>
                        )}
                      </div>

                      {/* Resumo estrutural */}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                        <span className="flex items-center gap-0.5"><strong className="text-slate-700 dark:text-slate-300 font-extrabold">{point.summary?.employees || 0}</strong> colab.</span>
                        <span className="flex items-center gap-0.5"><strong className="text-slate-700 dark:text-slate-300 font-extrabold">{point.summary?.works || 0}</strong> obras</span>
                        <span className="flex items-center gap-0.5"><strong className="text-slate-700 dark:text-slate-300 font-extrabold">{point.summary?.properties || 0}</strong> imóveis</span>
                        <span className="flex items-center gap-0.5"><strong className="text-slate-700 dark:text-slate-300 font-extrabold">{point.summary?.tools || 0}</strong> equip.</span>
                        <span className="flex items-center gap-0.5"><strong className="text-slate-700 dark:text-slate-300 font-extrabold">{point.summary?.ppe_items || 0}</strong> EPIs</span>
                        <span className="flex items-center gap-0.5"><strong className="text-slate-700 dark:text-slate-300 font-extrabold">{point.summary?.tasks || 0}</strong> ações</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <button
                        type="button"
                        onClick={() => handleRestoreBackupPoint(point)}
                        disabled={isRestoringBackup}
                        className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-lg text-[10px] flex items-center gap-1 shadow-sm transition-all hover:scale-[1.02] disabled:opacity-50"
                        title="Sobrescrever dados atuais pelas deste ponto"
                      >
                        <span className="material-icons-outlined text-xs">restore_page</span>
                        Restaurar
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteBackupPoint(point.id, point.name)}
                        disabled={isRestoringBackup}
                        className="p-1.5 bg-slate-100 hover:bg-red-50 dark:bg-white/5 dark:hover:bg-red-950/20 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg transition-colors"
                        title="Excluir este ponto do histórico local"
                      >
                        <span className="material-icons-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-8 font-medium">
        <p>GestãoRH Pro v1.1.2</p>
        <p>© 2026 Pixel Negócios Digitais. Todos os direitos reservados.</p>
      </div>
    </div>
  );
};

export default Settings;
