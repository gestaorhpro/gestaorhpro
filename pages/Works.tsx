import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Work, Employee, Property, ToolEquipment } from '../types';
import { logAction } from '../services/audit';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface WorksProps {
  initialShowForm?: boolean;
  onFormClose?: () => void;
}

const Works: React.FC<WorksProps> = ({ initialShowForm, onFormClose }) => {
  // Database States
  const [works, setWorks] = useState<Work[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tools, setTools] = useState<ToolEquipment[]>([]);
  const [workPhotos, setWorkPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // UI / Modal States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('TODOS');
  const [selectedStatus, setSelectedStatus] = useState<string>('TODOS');
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedWork, setSelectedWork] = useState<Work | null>(null);

  useEffect(() => {
    if (initialShowForm) {
      handleOpenCreate();
    }
  }, [initialShowForm]);

  const handleCloseForm = () => {
    setShowFormModal(false);
    if (onFormClose) {
      onFormClose();
    }
  };
  
  // Toast notifications
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Work>>({
    name: '',
    contactName: '',
    contactPhone: '',
    addressZip: '',
    addressStreet: '',
    addressNumber: '',
    addressComplement: '',
    addressNeighborhood: '',
    addressCity: '',
    addressState: '',
    type: 'Instalação',
    employeeIds: [],
    propertyId: '',
    toolIds: [],
    startDate: '',
    estimatedEndDate: '',
    notes: '',
    status: 'Planejado'
  });

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form search states (for multi-select dropdown search helper)
  const [empSearch, setEmpSearch] = useState<string>('');
  const [toolSearch, setToolSearch] = useState<string>('');

  // Fetch all databases
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: worksData } = await supabase.from('works').select('*');
      const { data: empData } = await supabase.from('employees').select('*');
      const { data: propData } = await supabase.from('properties').select('*');
      const { data: toolData } = await supabase.from('tools').select('*');
      const { data: photosData } = await supabase.from('work_photos').select('*');

      if (worksData) setWorks(worksData);
      if (empData) setEmployees(empData.filter(e => e.status === 'Ativo'));
      if (propData) setProperties(propData);
      if (toolData) setTools(toolData);
      if (photosData) setWorkPhotos(photosData);
    } catch (err) {
      console.error('Erro ao ler tabelas no modulo de obras:', err);
      showToast('Ocorreu um erro ao carregar os dados. Tente atualizar a pagina.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Cep Query (Brazil via ViaCep)
  const handleZipCodeLookup = async (zip: string) => {
    const cleanZip = zip.replace(/\D/g, '');
    if (cleanZip.length === 8) {
      showToast('Buscando CEP...', 'info');
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanZip}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            addressZip: zip,
            addressStreet: data.logradouro || '',
            addressNeighborhood: data.bairro || '',
            addressCity: data.localidade || '',
            addressState: data.uf || ''
          }));
          showToast('Endereço completado com sucesso!', 'success');
        } else {
          showToast('CEP não encontrado.', 'error');
        }
      } catch (e) {
        showToast('Erro ao buscar CEP de forma automática.', 'error');
      }
    }
  };

  // Helper calculation for deadlines
  const calculateDeadlineStats = (startStr: string, endStr: string, workStatus: string) => {
    if (!startStr || !endStr) return { totalDays: 0, daysRemaining: 0, elapsedPercent: 0, criticalState: 'NORMAL', text: 'Prazos não definidos' };
    
    const start = new Date(startStr);
    const end = new Date(endStr);
    const today = new Date();
    today.setHours(0,0,0,0);

    // Total days in contract
    const diffTimeTotal = end.getTime() - start.getTime();
    const totalDays = Math.max(1, Math.ceil(diffTimeTotal / (1000 * 60 * 60 * 24)));

    // Days remaining
    const diffTimeRem = end.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTimeRem / (1000 * 60 * 60 * 24));

    // Elapsed percentage
    const diffTimeSpent = today.getTime() - start.getTime();
    const spentDays = Math.max(0, Math.ceil(diffTimeSpent / (1000 * 60 * 60 * 24)));
    let elapsedPercent = Math.min(100, Math.max(0, Math.round((spentDays / totalDays) * 100)));

    if (workStatus === 'Concluído') elapsedPercent = 100;

    let criticalState: 'NORMAL' | 'WARNED' | 'CRITICAL' | 'COMPLETED' = 'NORMAL';
    let text = '';

    if (workStatus === 'Concluído') {
      criticalState = 'COMPLETED';
      text = 'Obra finalizada';
    } else if (daysRemaining < 0) {
      criticalState = 'CRITICAL';
      text = `Atrasada por ${Math.abs(daysRemaining)} dia(s)`;
    } else if (daysRemaining <= 10) {
      criticalState = 'WARNED';
      text = `Faltam apenas ${daysRemaining} dia(s)`;
    } else {
      text = `${daysRemaining} dias restantes`;
    }

    return { totalDays, daysRemaining, elapsedPercent, criticalState, text };
  };

  // Form Actions
  const handleOpenCreate = () => {
    setIsEditing(false);
    setEditId(null);
    setFormData({
      name: '',
      contactName: '',
      contactPhone: '',
      addressZip: '',
      addressStreet: '',
      addressNumber: '',
      addressComplement: '',
      addressNeighborhood: '',
      addressCity: '',
      addressState: '',
      type: 'Instalação',
      employeeIds: [],
      propertyId: '',
      toolIds: [],
      startDate: new Date().toISOString().substring(0, 10),
      estimatedEndDate: '',
      notes: '',
      status: 'Planejado'
    });
    setEmpSearch('');
    setToolSearch('');
    setShowFormModal(true);
  };

  const handleOpenEdit = (work: Work) => {
    setIsEditing(true);
    setEditId(work.id);
    setFormData({ ...work });
    setEmpSearch('');
    setToolSearch('');
    setShowFormModal(true);
  };

  const handleSaveWork = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name?.trim()) {
      showToast('O nome do empreendimento é obrigatório!', 'error');
      return;
    }
    if (!formData.startDate || !formData.estimatedEndDate) {
      showToast('Datas de início e fim estimados são obrigatórias!', 'error');
      return;
    }

    try {
      let updatedWorksList = [...works];

      if (isEditing && editId) {
        // Encontra o item anterior para remover associações
        const oldWork = works.find(w => w.id === editId);

        const updatedWorkItem: Work = {
          ...(formData as Work),
          id: editId
        };
        
        // Salva obra atualizada no SUPABASE simulação
        const { error } = await supabase.from('works').update(updatedWorkItem).eq('id', editId);
        if (error) throw error;

        // Registrar ações de auditoria para colaboradores, ferramentas, imóveis e status
        if (oldWork) {
          const oldEmpIds = oldWork.employeeIds || [];
          const newEmpIds = formData.employeeIds || [];
          const addedEmpIds = newEmpIds.filter(id => !oldEmpIds.includes(id));
          const removedEmpIds = oldEmpIds.filter(id => !newEmpIds.includes(id));
          
          for (const empId of addedEmpIds) {
            const empName = employees.find(e => e.id === empId)?.name || empId;
            await logAction('TRANSFER_COLLABORATOR', `Colaborador ${empName} alocado para a obra "${formData.name}"`, {
              work_id: editId,
              work_name: formData.name,
              employee_id: empId,
              employee_name: empName,
              action: 'allocated'
            });
          }
          
          for (const empId of removedEmpIds) {
            const empName = employees.find(e => e.id === empId)?.name || empId;
            await logAction('TRANSFER_COLLABORATOR', `Colaborador ${empName} removido da obra "${formData.name}"`, {
              work_id: editId,
              work_name: formData.name,
              employee_id: empId,
              employee_name: empName,
              action: 'removed'
            });
          }

          // Registrar ações de auditoria para ferramentas
          const oldToolIds = oldWork.toolIds || [];
          const newToolIds = formData.toolIds || [];
          const addedToolIds = newToolIds.filter(id => !oldToolIds.includes(id));
          const removedToolIds = oldToolIds.filter(id => !newToolIds.includes(id));
          
          for (const toolId of addedToolIds) {
            const toolName = tools.find(t => t.id === toolId)?.name || toolId;
            await logAction('TOOL_ALLOCATION', `Ferramenta "${toolName}" alocada para a obra "${formData.name}"`, {
              work_id: editId,
              work_name: formData.name,
              tool_id: toolId,
              tool_name: toolName,
              action: 'allocated'
            });
          }
          
          for (const toolId of removedToolIds) {
            const toolName = tools.find(t => t.id === toolId)?.name || toolId;
            await logAction('TOOL_ALLOCATION', `Ferramenta "${toolName}" desvinculada da obra "${formData.name}"`, {
              work_id: editId,
              work_name: formData.name,
              tool_id: toolId,
              tool_name: toolName,
              action: 'removed'
            });
          }

          // Registrar se mudou de alojamento/imóvel
          if (oldWork.propertyId !== formData.propertyId) {
            const oldPropName = properties.find(p => p.id === oldWork.propertyId)?.name || 'Nenhum';
            const newPropName = properties.find(p => p.id === formData.propertyId)?.name || 'Nenhum';
            await logAction('PROPERTY_ALLOCATION', `Alojamento da obra "${formData.name}" alterado de "${oldPropName}" para "${newPropName}"`, {
              work_id: editId,
              work_name: formData.name,
              old_property_id: oldWork.propertyId,
              new_property_id: formData.propertyId
            });
          }

          // Registrar se mudou status
          if (oldWork.status !== formData.status) {
            await logAction('WORK_STATUS_UPDATE', `Status de obra "${formData.name}" alterado de "${oldWork.status}" para "${formData.status}"`, {
              work_id: editId,
              work_name: formData.name,
              old_status: oldWork.status,
              new_status: formData.status
            });
          }
        }

        // Atualização de relacionamento cruzado nas ferramentas:
        // Remove associacao antiga se houver
        if (oldWork && oldWork.toolIds) {
          const removedToolIds = oldWork.toolIds.filter((id: string) => !formData.toolIds?.includes(id));
          if (removedToolIds.length > 0) {
            const { data: affectedTools } = await supabase.from('tools').select('*');
            if (affectedTools) {
              const cleanedTools = affectedTools.map((t: ToolEquipment) => {
                if (removedToolIds.includes(t.id)) {
                  return { ...t, associatedWorkId: '', associatedWorkName: '' };
                }
                return t;
              });
              localStorage.setItem('gestaorh_db_tools', JSON.stringify(cleanedTools));
            }
          }
        }

        // Aplica novas associacoes ao banco de ferramentas
        if (formData.toolIds && formData.toolIds.length > 0) {
          const { data: dbTools } = await supabase.from('tools').select('*');
          if (dbTools) {
            const updatedTools = dbTools.map((t: ToolEquipment) => {
              if (formData.toolIds?.includes(t.id)) {
                return { 
                  ...t, 
                  associatedWorkId: editId, 
                  associatedWorkName: formData.name || '' 
                };
              }
              return t;
            });
            localStorage.setItem('gestaorh_db_tools', JSON.stringify(updatedTools));
          }
        }

        // Relacionamento com imóvel:
        // Remove associação antiga se mudou
        if (oldWork && oldWork.propertyId && oldWork.propertyId !== formData.propertyId) {
          const { data: oldProps } = await supabase.from('properties').select('*');
          if (oldProps) {
            const cleaned = oldProps.map((p: Property) => {
              if (p.id === oldWork.propertyId) {
                return { ...p, associatedWorkId: '', associatedWorkName: '' };
              }
              return p;
            });
            localStorage.setItem('gestaorh_db_properties', JSON.stringify(cleaned));
          }
        }

        // Adiciona nova associacao no imóvel
        if (formData.propertyId) {
          const { data: dbProps } = await supabase.from('properties').select('*');
          if (dbProps) {
            const updatedProps = dbProps.map((p: Property) => {
              if (p.id === formData.propertyId) {
                return { 
                  ...p, 
                  associatedWorkId: editId, 
                  associatedWorkName: formData.name || '' 
                };
              }
              return p;
            });
            localStorage.setItem('gestaorh_db_properties', JSON.stringify(updatedProps));
          }
        }

        showToast('Obra atualizada com sucesso no banco de dados!', 'success');
      } else {
        // Criar nova obra
        const newId = `work-${Date.now()}`;
        const newWorkItem: Work = {
          ...(formData as Work),
          id: newId
        };

        const { error } = await supabase.from('works').insert(newWorkItem);
        if (error) throw error;

        await logAction('WORK_CREATE', `Nova obra "${formData.name}" foi cadastrada com sucesso`, {
          work_id: newId,
          work_name: formData.name,
          employee_count: formData.employeeIds?.length || 0,
          tool_count: formData.toolIds?.length || 0
        });

        // Atualiza ferramentas que foram vinculadas a esta nova obra
        if (formData.toolIds && formData.toolIds.length > 0) {
          const { data: dbTools } = await supabase.from('tools').select('*');
          if (dbTools) {
            const updatedTools = dbTools.map((t: ToolEquipment) => {
              if (formData.toolIds?.includes(t.id)) {
                return { ...t, associatedWorkId: newId, associatedWorkName: formData.name || '' };
              }
              return t;
            });
            localStorage.setItem('gestaorh_db_tools', JSON.stringify(updatedTools));
          }
        }

        // Atualiza imóvel que foi vinculado a esta nova obra
        if (formData.propertyId) {
          const { data: dbProps } = await supabase.from('properties').select('*');
          if (dbProps) {
            const updatedProps = dbProps.map((p: Property) => {
              if (p.id === formData.propertyId) {
                return { ...p, associatedWorkId: newId, associatedWorkName: formData.name || '' };
              }
              return p;
            });
            localStorage.setItem('gestaorh_db_properties', JSON.stringify(updatedProps));
          }
        }

        showToast('Obra cadastrada e gravada no fluxo do sistema!', 'success');
      }

      handleCloseForm();
      fetchData(); // Recarrega todas as tabelas para garantir integridade visual
    } catch (err: any) {
      console.error(err);
      showToast('Módulo encontrou falhas ao gravar obra.', 'error');
    }
  };

  const handleDeleteWork = async (id: string, name: string) => {
    if (window.confirm(`Deseja realmente excluir a obra "${name}"? Os vínculos de ferramentas e alojamentos vinculados serão limpos.`)) {
      try {
        // Limpa referências nas ferramentas
        const { data: dbTools } = await supabase.from('tools').select('*');
        if (dbTools) {
          const cleanedTools = dbTools.map((t: ToolEquipment) => {
            if (t.associatedWorkId === id) {
              return { ...t, associatedWorkId: '', associatedWorkName: '' };
            }
            return t;
          });
          localStorage.setItem('gestaorh_db_tools', JSON.stringify(cleanedTools));
        }

        // Limpa referência nos imóveis
        const { data: dbProps } = await supabase.from('properties').select('*');
        if (dbProps) {
          const cleanedProps = dbProps.map((p: Property) => {
            if (p.associatedWorkId === id) {
              return { ...p, associatedWorkId: '', associatedWorkName: '' };
            }
            return p;
          });
          localStorage.setItem('gestaorh_db_properties', JSON.stringify(cleanedProps));
        }

        const { error } = await supabase.from('works').delete().eq('id', id);
        if (error) throw error;

        await logAction('WORK_DELETE', `Obra "${name}" foi excluída do sistema`, {
          work_id: id,
          work_name: name
        });

        showToast('Obra removida e dependências atualizadas com sucesso.', 'success');
        fetchData();
      } catch (e) {
        showToast('Ocorreu uma falha ao remover registro.', 'error');
      }
    }
  };

  // Helper selectors inside Form
  const toggleEmployeeSelection = (empId: string) => {
    const list = formData.employeeIds || [];
    if (list.includes(empId)) {
      setFormData(prev => ({ ...prev, employeeIds: list.filter(id => id !== empId) }));
    } else {
      setFormData(prev => ({ ...prev, employeeIds: [...list, empId] }));
    }
  };

  const toggleToolSelection = (toolId: string) => {
    const list = formData.toolIds || [];
    if (list.includes(toolId)) {
      setFormData(prev => ({ ...prev, toolIds: list.filter(id => id !== toolId) }));
    } else {
      setFormData(prev => ({ ...prev, toolIds: [...list, toolId] }));
    }
  };

  // Real-time counts for advance filters
  const getStatusCount = (statusValue: string) => {
    if (statusValue === 'TODOS') return works.length;
    if (statusValue === 'Atrasado') {
      return works.filter(w => {
        if (w.status === 'Concluído') return false;
        const stats = calculateDeadlineStats(w.startDate, w.estimatedEndDate, w.status);
        return w.status === 'Atrasado' || stats.criticalState === 'CRITICAL';
      }).length;
    }
    return works.filter(w => w.status === statusValue).length;
  };

  const getTypeCount = (typeValue: string) => {
    if (typeValue === 'TODOS') return works.length;
    return works.filter(w => w.type === typeValue).length;
  };

  // Filters logic
  const filteredWorks = works.filter(w => {
    const matchesSearch = w.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (w.contactName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (w.addressCity || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = selectedType === 'TODOS' || w.type === selectedType;
    
    let matchesStatus = selectedStatus === 'TODOS';
    if (!matchesStatus) {
      if (selectedStatus === 'Em Andamento') {
        matchesStatus = w.status === 'Em Andamento';
      } else if (selectedStatus === 'Atrasado') {
        const stats = calculateDeadlineStats(w.startDate, w.estimatedEndDate, w.status);
        matchesStatus = w.status === 'Atrasado' || stats.criticalState === 'CRITICAL';
      } else if (selectedStatus === 'Concluído') {
        matchesStatus = w.status === 'Concluído';
      } else {
        matchesStatus = w.status === selectedStatus;
      }
    }

    return matchesSearch && matchesType && matchesStatus;
  });

  // KPI Computations
  const totalActiveWorks = works.filter(w => w.status === 'Em Andamento').length;
  const totalCompletedWorks = works.filter(w => w.status === 'Concluído').length;
  const totalDelayedWorks = works.filter(w => {
    if (w.status === 'Concluído') return false;
    const stats = calculateDeadlineStats(w.startDate, w.estimatedEndDate, w.status);
    return stats.criticalState === 'CRITICAL';
  }).length;
  
  let totalActiveEmployeesOnWorks = 0;
  works.forEach(w => {
    if (w.status === 'Em Andamento' && w.employeeIds) {
      totalActiveEmployeesOnWorks += w.employeeIds.length;
    }
  });

  const handleExportPDFList = () => {
    const doc = new jsPDF() as any;
    
    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Relatório de Obras e Projetos", 14, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 26);
    doc.text(`Filtros - Tipo: ${selectedType} | Status: ${selectedStatus}`, 14, 32);
    
    const tableColumns = ["Obra / Projeto", "Tipo", "Status", "Início", "Fim Estimado", "Contato / Resp.", "Integrantes", "Ferramentas"];
    const tableRows = filteredWorks.map(w => [
      w.name,
      w.type || '-',
      w.status || '-',
      w.startDate ? new Date(w.startDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '-',
      w.estimatedEndDate ? new Date(w.estimatedEndDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '-',
      w.contactName ? `${w.contactName} (${w.contactPhone || 'S/N'})` : '-',
      `${w.employeeIds?.length || 0} colab.`,
      `${w.toolIds?.length || 0} un.`
    ]);
    
    doc.autoTable({
      head: [tableColumns],
      body: tableRows,
      startY: 38,
      theme: 'grid',
      styles: { fontSize: 8, font: "helvetica" },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' }
    });
    
    doc.save(`obras_${new Date().toISOString().slice(0, 10)}.pdf`);
    logAction('REPORTS_GENERATE', 'Relatório de obras exportado em PDF', { count: filteredWorks.length });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-300">
      
      {/* Toast Message */}
      {toastMessage && (
        <div className={`fixed right-6 top-6 z-50 px-5 py-3.5 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 border animate-in slide-in-from-top duration-300 ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/90 dark:text-emerald-305 dark:border-emerald-800' 
            : toastMessage.type === 'error' 
            ? 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/90 dark:text-red-305 dark:border-red-800' 
            : 'bg-indigo-50 text-indigo-850 border-indigo-200 dark:bg-indigo-950/90 dark:text-indigo-300 dark:border-indigo-800'
        }`}>
          <span className="material-icons text-sm">
            {toastMessage.type === 'success' ? 'check_circle' : toastMessage.type === 'error' ? 'error_outline' : 'info'}
          </span>
          {toastMessage.text}
        </div>
      )}

      {/* Module Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-black tracking-widest text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">Passo 7 do Fluxo</span>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white mt-1">Controle e Cadastro de Obras</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gerencie canteiros de obras ativos, associe alojamentos de suporte, aloque equipes técnicas de alta performance e monitore ferramentas em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPDFList}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-dark-card dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-gray-200 dark:border-dark-border rounded-xl transition-colors font-extrabold text-xs cursor-pointer"
          >
            <span className="material-icons-outlined text-sm">picture_as_pdf</span> Exportar PDF
          </button>
          <button
            onClick={handleOpenCreate}
            className="bg-indigo-650 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-550 text-white font-extrabold text-xs px-5 py-3 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all hover:scale-[1.01]"
          >
            <span className="material-icons-outlined text-sm">add_circle</span> Nova Obra / Projeto
          </button>
        </div>
      </div>

      {/* METRICS HEADER BENTO GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-gray-150/50 dark:border-white/5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">Obras em Andamento</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white block mt-1.5">{totalActiveWorks}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Operações ativas em campo</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <span className="material-icons-outlined text-xl">construction</span>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-gray-150/50 dark:border-white/5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">Equipe Alocada</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white block mt-1.5">{totalActiveEmployeesOnWorks}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Colaboradores em campo hoje</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <span className="material-icons-outlined text-xl">engineering</span>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-gray-150/50 dark:border-white/5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">Entregues / Concluídas</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white block mt-1.5">{totalCompletedWorks}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Projetos finalizados com êxito</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <span className="material-icons-outlined text-xl">task_alt</span>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-gray-150/50 dark:border-white/5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">Fora do Prazo / Críticas</span>
            <span className={`text-2xl font-black block mt-1.5 ${totalDelayedWorks > 0 ? 'text-rose-600 dark:text-rose-450' : 'text-slate-800 dark:text-white'}`}>{totalDelayedWorks}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Necessitam de plano de ação</span>
          </div>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${totalDelayedWorks > 0 ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400' : 'bg-slate-50 text-slate-505 dark:bg-white/5 dark:text-slate-400'}`}>
            <span className="material-icons-outlined text-xl">pending_actions</span>
          </div>
        </div>

      </div>

      {/* FILTER AND SEARCH BAR */}
      <div className="space-y-4">
        <div className="bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-150/50 dark:border-white/5 flex flex-col md:flex-row md:items-center gap-4 transition-colors">
          <div className="flex-1 relative">
            <span className="material-icons-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome da obra, gestor de contato, cidade..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50/50 dark:bg-white/5 text-slate-800 dark:text-white text-xs focus:ring-1 focus:ring-indigo-550 focus:outline-none placeholder:text-slate-400 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Filtros Ativos:</span>
            <button
              onClick={() => {
                setSelectedStatus('TODOS');
                setSelectedType('TODOS');
                setSearchTerm('');
              }}
              className="text-indigo-600 dark:text-indigo-400 hover:underline text-[10px] font-extrabold cursor-pointer"
            >
              Limpar Tudo
            </button>
          </div>
        </div>

        {/* ADVANCED SELECTIONS PANEL (Pills & Badges) */}
        <div className="bg-slate-50/40 dark:bg-dark-card/50 p-4 rounded-xl border border-gray-150/40 dark:border-white/5 space-y-4">
          {/* Status Selection Group */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <span className="material-icons-outlined text-xs">tune</span>
                Filtrar por Status do Projeto
              </span>
              {selectedStatus !== 'TODOS' && (
                <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-bold">
                  Status Ativo: {selectedStatus === 'Concluído' ? 'Finalizada' : selectedStatus === 'Atrasado' ? 'Atrasada' : selectedStatus}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Todos os Status', value: 'TODOS', colorClass: 'hover:bg-slate-100 dark:hover:bg-white/5', activeColorClass: 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 border-slate-800 dark:border-white' },
                { label: 'Planejado', value: 'Planejado', colorClass: 'hover:bg-slate-100 text-slate-700 dark:text-slate-350 hover:text-slate-900 dark:hover:text-white', activeColorClass: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700' },
                { label: 'Em Andamento', value: 'Em Andamento', colorClass: 'text-blue-600 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20', activeColorClass: 'bg-blue-105 text-blue-800 border-blue-200 dark:bg-blue-950/55 dark:text-blue-100 dark:border-blue-900' },
                { label: 'Pausado', value: 'Pausado', colorClass: 'text-amber-650 dark:text-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/20', activeColorClass: 'bg-amber-100 text-amber-805 border-amber-200 dark:bg-amber-950/55 dark:text-amber-100 dark:border-amber-900' },
                { label: 'Finalizada (Concluída)', value: 'Concluído', colorClass: 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20', activeColorClass: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/55 dark:text-emerald-100 dark:border-emerald-900' },
                { label: 'Atrasada (Crítica)', value: 'Atrasado', colorClass: 'text-red-600 dark:text-rose-450 hover:bg-red-50/50 dark:hover:bg-red-950/20', activeColorClass: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/55 dark:text-red-100 dark:border-red-900' }
              ].map((btn) => {
                const count = getStatusCount(btn.value);
                const isActive = selectedStatus === btn.value;
                return (
                  <button
                    key={btn.value}
                    type="button"
                    onClick={() => setSelectedStatus(btn.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                      isActive 
                        ? btn.activeColorClass 
                        : `bg-white dark:bg-dark-card border-gray-200 dark:border-white/5 ${btn.colorClass}`
                    }`}
                  >
                    <span>{btn.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isActive ? 'bg-black/10 dark:bg-white/20' : 'bg-slate-100 dark:bg-white/5 text-slate-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Type Selection Group */}
          <div className="space-y-2 pt-2 border-t border-gray-150/40 dark:border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <span className="material-icons-outlined text-xs">category</span>
                Filtrar por Tipo de Obra / Projeto
              </span>
              {selectedType !== 'TODOS' && (
                <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-bold">
                  Tipo Ativo: {selectedType}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Todos os Tipos', value: 'TODOS' },
                { label: 'Instalação', value: 'Instalação' },
                { label: 'Manutenção', value: 'Manutenção' },
                { label: 'Montagem', value: 'Montagem' },
                { label: 'Desmontagem', value: 'Desmontagem' },
                { label: 'Adequação', value: 'Adequação' },
                { label: 'Outros', value: 'Outros' }
              ].map((btn) => {
                const count = getTypeCount(btn.value);
                const isActive = selectedType === btn.value;
                return (
                  <button
                    key={btn.value}
                    type="button"
                    onClick={() => setSelectedType(btn.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                      isActive 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                        : 'bg-white dark:bg-dark-card border-gray-200 dark:border-white/5 text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <span>{btn.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isActive ? 'bg-white/20' : 'bg-slate-100 dark:bg-white/5 text-slate-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* WORKS DIRECTORY LIST */}
      {loading ? (
        <div className="py-24 text-center">
          <span className="material-icons-outlined animate-spin text-4xl text-indigo-500">refresh</span>
          <p className="text-xs text-slate-400 mt-2">Sincronizando fluxo com a base de dados...</p>
        </div>
      ) : filteredWorks.length === 0 ? (
        <div className="bg-white dark:bg-dark-card py-20 rounded-2xl border border-dashed border-gray-200 dark:border-white/10 text-center flex flex-col items-center justify-center">
          <span className="material-icons-outlined text-4xl text-slate-300 dark:text-slate-700 mb-2">construction</span>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhuma obra localizada</p>
          <p className="text-xs text-slate-400 mt-1 max-w-md px-4">
            Experimente limpar os filtros de busca ou clique em "Nova Obra / Projeto" para dar início ao registro e vincular os ativos do seu fluxo de implantação.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredWorks.map((work) => {
            const stats = calculateDeadlineStats(work.startDate, work.estimatedEndDate, work.status);
            const associatedProperty = properties.find(p => p.id === work.propertyId);
            const allocatedCrewCount = work.employeeIds ? work.employeeIds.length : 0;
            const allocatedToolsCount = work.toolIds ? work.toolIds.length : 0;

            return (
              <div 
                key={work.id} 
                className="bg-white dark:bg-dark-card rounded-2xl border border-gray-150/60 dark:border-white/5 shadow-xs flex flex-col justify-between overflow-hidden hover:shadow-md transition-all hover:scale-[1.002]"
              >
                
                {/* Visual state top banner */}
                <div className="p-5 flex-1 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded">
                          {work.type}
                        </span>
                        
                        {/* Status Badge */}
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          work.status === 'Concluído' 
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-350'
                            : work.status === 'Em Andamento'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-350'
                            : work.status === 'Pausado'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-350'
                            : work.status === 'Atrasado' || stats.criticalState === 'CRITICAL'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-350'
                            : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400'
                        }`}>
                          {work.status}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-base text-slate-800 dark:text-white mt-2 leading-tight">
                        {work.name}
                      </h3>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => { setSelectedWork(work); setShowDetailModal(true); }}
                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-white/5 rounded-lg transition-all"
                        title="Ver Ficha de Detalhes"
                      >
                        <span className="material-icons-outlined text-sm">visibility</span>
                      </button>
                      <button
                        onClick={() => handleOpenEdit(work)}
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-white/5 rounded-lg transition-all"
                        title="Editar"
                      >
                        <span className="material-icons-outlined text-sm">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteWork(work.id, work.name)}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:text-slate-400 dark:hover:text-red-400 dark:hover:bg-white/5 rounded-lg transition-all"
                        title="Excluir"
                      >
                        <span className="material-icons-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>

                  {/* Local info */}
                  <div className="space-y-1 text-slate-500 dark:text-slate-400 text-xs font-semibold">
                    <p className="flex items-center gap-1.5 truncate">
                      <span className="material-icons-outlined text-slate-400 text-xs shrink-0">place</span>
                      <span>{work.addressStreet}, {work.addressNumber} {work.addressComplement ? ` - ${work.addressComplement}` : ''}, {work.addressCity}/{work.addressState}</span>
                    </p>
                    <p className="flex items-center gap-1.5 truncate">
                      <span className="material-icons-outlined text-slate-400 text-xs shrink-0">contact_phone</span>
                      <span>{work.contactName || 'Sem contato'} — <strong className="text-slate-700 dark:text-slate-350">{work.contactPhone || '(--) -------'}</strong></span>
                    </p>
                  </div>

                  {/* Resource summary widgets */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 bg-slate-50/50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 flex items-center gap-1.5">
                      <span className="material-icons-outlined text-slate-400 text-sm">engineering</span>
                      <div>
                        <span className="text-[8px] uppercase font-bold text-slate-400 block leading-none">Equipe</span>
                        <strong className="text-xs text-slate-700 dark:text-slate-250 font-bold">{allocatedCrewCount} colab.</strong>
                      </div>
                    </div>
                    <div className="p-2 bg-slate-50/50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 flex items-center gap-1.5">
                      <span className="material-icons-outlined text-slate-400 text-sm">handyman</span>
                      <div>
                        <span className="text-[8px] uppercase font-bold text-slate-400 block leading-none">Ferramentas</span>
                        <strong className="text-xs text-slate-700 dark:text-slate-250 font-bold">{allocatedToolsCount} itens</strong>
                      </div>
                    </div>
                    <div className="p-2 bg-slate-50/50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 flex items-center gap-1.5 overflow-hidden">
                      <span className="material-icons-outlined text-slate-400 text-sm">holiday_village</span>
                      <div className="min-w-0">
                        <span className="text-[8px] uppercase font-bold text-slate-400 block leading-none">Alojamento</span>
                        <span className="text-xs text-slate-700 dark:text-slate-250 font-extrabold truncate block" title={associatedProperty?.name || 'Não alocado'}>
                          {associatedProperty ? associatedProperty.name : 'Nenhum'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Deadline & progress visuals */}
                  <div className="space-y-1.5 pt-1.5">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-slate-450 dark:text-slate-500">Cronograma da Obra</span>
                      <span className={`${
                        stats.criticalState === 'CRITICAL' ? 'text-red-600 dark:text-rose-400 font-extrabold animate-pulse' :
                        stats.criticalState === 'WARNED' ? 'text-amber-600 dark:text-amber-400 font-extrabold' :
                        stats.criticalState === 'COMPLETED' ? 'text-emerald-600 dark:text-emerald-400 font-bold' :
                        'text-indigo-650 dark:text-indigo-400'
                      }`}>
                        {stats.text}
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 dark:bg-white/10 rounded-full h-2 overflow-hidden flex">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          stats.criticalState === 'CRITICAL' ? 'bg-rose-500' :
                          stats.criticalState === 'WARNED' ? 'bg-amber-505' :
                          stats.criticalState === 'COMPLETED' ? 'bg-emerald-500' :
                          'bg-indigo-600'
                        }`}
                        style={{ width: `${stats.elapsedPercent}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 dark:text-slate-500 pt-0.5">
                      <span>Início: {new Date(work.startDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                      <span>Total de Prazo: {stats.totalDays} dias</span>
                      <span>Encerramento: {new Date(work.estimatedEndDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                    </div>
                  </div>

                </div>

                {/* Card visual footer */}
                {work.notes && (
                  <div className="bg-slate-50/50 dark:bg-white/5 py-3 px-5 border-t border-gray-100 dark:border-white/5 text-[11px] italic text-slate-502 dark:text-slate-400 line-clamp-1">
                    Obs: {work.notes}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* FORM MODAL (Add & Edit) */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#151515] w-full max-w-3xl rounded-2xl border border-gray-100 dark:border-white/5 shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-250">
            
            <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white">
                  {isEditing ? 'Atualizar Canteiro de Obra' : 'Novo Cadastro de Obra'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">Configure o perfil operacional do local, equipe de guarda e prazo.</p>
              </div>
              <button 
                onClick={handleCloseForm}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
              >
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveWork} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* SECTION: GENERAL DATA */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase text-indigo-650 dark:text-indigo-400 border-b border-gray-100 dark:border-white/5 pb-2 flex items-center gap-1.5">
                  <span className="material-icons-outlined text-sm">info</span> Dados Técnicos Gerais
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 block">Nome do Empreendimento/Obra *</label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Reforma do Hospital Municipal, Montagem Linha 5"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-dark-card text-slate-850 dark:text-white text-xs focus:ring-1 focus:ring-indigo-550 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 block">Tipo de Obra</label>
                    <select
                      value={formData.type || 'Instalação'}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-dark-card text-slate-850 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-550"
                    >
                      <option value="Instalação">Instalação</option>
                      <option value="Manutenção">Manutenção</option>
                      <option value="Montagem">Montagem</option>
                      <option value="Desmontagem">Desmontagem</option>
                      <option value="Adequação">Adequação</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 block">Contato de Referência (Gestor/Mestre)</label>
                    <input
                      type="text"
                      value={formData.contactName || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
                      placeholder="Ex: Eng. Ricardo Rezende"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-dark-card text-slate-850 dark:text-white text-xs focus:ring-1 focus:ring-indigo-550 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 block">Telefone de Contato</label>
                    <input
                      type="text"
                      value={formData.contactPhone || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                      placeholder="Ex: (51) 98888-7711"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-dark-card text-slate-850 dark:text-white text-xs focus:ring-1 focus:ring-indigo-550 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 block">Status Operacional</label>
                    <select
                      value={formData.status || 'Planejado'}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-dark-card text-slate-850 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-550"
                    >
                      <option value="Planejado">Planejado</option>
                      <option value="Em Andamento">Em Andamento</option>
                      <option value="Pausado">Pausado</option>
                      <option value="Concluído">Concluído</option>
                      <option value="Atrasado">Atrasado</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION: ADDRESS */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-black uppercase text-indigo-650 dark:text-indigo-400 border-b border-gray-100 dark:border-white/5 pb-2 flex items-center gap-1.5">
                  <span className="material-icons-outlined text-sm">place</span> Endereço Física do Canteiro
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 block">CEP (Completa endereço)</label>
                    <input
                      type="text"
                      value={formData.addressZip || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData(prev => ({ ...prev, addressZip: val }));
                        handleZipCodeLookup(val);
                      }}
                      placeholder="Ex: 90050-001"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-dark-card text-slate-850 dark:text-white text-xs focus:ring-1 focus:ring-indigo-550 focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 block">Logradouro / Rua</label>
                    <input
                      type="text"
                      value={formData.addressStreet || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, addressStreet: e.target.value }))}
                      placeholder="Ex: Avenida Farrapos"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-dark-card text-slate-850 dark:text-white text-xs focus:ring-1 focus:ring-indigo-550 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 block">Número</label>
                    <input
                      type="text"
                      value={formData.addressNumber || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, addressNumber: e.target.value }))}
                      placeholder="Ex: 1500"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-dark-card text-slate-850 dark:text-white text-xs focus:ring-1 focus:ring-indigo-550 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 block">Complemento</label>
                    <input
                      type="text"
                      value={formData.addressComplement || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, addressComplement: e.target.value }))}
                      placeholder="Ex: Galpão B"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-dark-card text-slate-850 dark:text-white text-xs focus:ring-1 focus:ring-indigo-550 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 block">Bairro</label>
                    <input
                      type="text"
                      value={formData.addressNeighborhood || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, addressNeighborhood: e.target.value }))}
                      placeholder="Ex: Floresta"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-dark-card text-slate-850 dark:text-white text-xs focus:ring-1 focus:ring-indigo-550 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 block">Cidade</label>
                    <input
                      type="text"
                      value={formData.addressCity || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, addressCity: e.target.value }))}
                      placeholder="Ex: Porto Alegre"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-dark-card text-slate-850 dark:text-white text-xs focus:ring-1 focus:ring-indigo-550 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 block">Estado (UF)</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={formData.addressState || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, addressState: e.target.value.toUpperCase() }))}
                      placeholder="Ex: RS"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-dark-card text-slate-850 dark:text-white text-xs focus:ring-1 focus:ring-indigo-550 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: DATE PERIOD */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-black uppercase text-indigo-650 dark:text-indigo-400 border-b border-gray-100 dark:border-white/5 pb-2 flex items-center gap-1.5">
                  <span className="material-icons-outlined text-sm">calendar_month</span> Período de Atuação (Cronograma)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 block">Data de Início *</label>
                    <input
                      type="date"
                      required
                      value={formData.startDate || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-dark-card text-slate-850 dark:text-white text-xs focus:ring-1 focus:ring-indigo-550 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 block">Data Estimada de Encerramento (Entrega) *</label>
                    <input
                      type="date"
                      required
                      value={formData.estimatedEndDate || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, estimatedEndDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-dark-card text-slate-850 dark:text-white text-xs focus:ring-1 focus:ring-indigo-550 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: ASSOCIATED LODGING */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-black uppercase text-indigo-650 dark:text-indigo-400 border-b border-gray-100 dark:border-white/5 pb-2 flex items-center gap-1.5">
                  <span className="material-icons-outlined text-sm">holiday_village</span> Imóvel / Alojamento Associado
                </h4>
                <p className="text-[11px] text-slate-400">Vincule um imóvel de suporte para que os colaboradores alocados fiquem hospedados temporariamente.</p>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 block">Alojamento Disponível</label>
                  <select
                    value={formData.propertyId || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, propertyId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-dark-card text-slate-850 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-550"
                  >
                    <option value="">Nenhum alojamento associado</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.addressCity}/{p.addressState} — {p.addressStreet}, Nº {p.addressNumber})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SECTION: ALLOCATE TEAM */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-black uppercase text-indigo-650 dark:text-indigo-400 border-b border-gray-100 dark:border-white/5 pb-2 flex items-center gap-1.5">
                  <span className="material-icons-outlined text-sm">groups</span> Integrantes da Equipe Alocada ({formData.employeeIds?.length || 0})
                </h4>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={empSearch}
                    onChange={(e) => setEmpSearch(e.target.value)}
                    placeholder="Filtrar colaboradores da lista abaixo..."
                    className="w-full px-3 py-1.5 border border-gray-150 dark:border-white/5 rounded-lg bg-gray-55/60 dark:bg-white/5 text-xs text-slate-800 dark:text-white focus:outline-none placeholder:text-slate-405"
                  />
                  
                  <div className="border border-gray-150 dark:border-white/5 rounded-xl max-h-40 overflow-y-auto p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/50 dark:bg-white/5">
                    {employees
                      .filter(emp => emp.name.toLowerCase().includes(empSearch.toLowerCase()))
                      .map((emp) => {
                        const isChecked = formData.employeeIds?.includes(emp.id);
                        return (
                          <div 
                            key={emp.id}
                            onClick={() => toggleEmployeeSelection(emp.id)}
                            className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                              isChecked 
                                ? 'bg-indigo-50/70 border-indigo-200 text-indigo-850 dark:bg-indigo-950/40 dark:border-indigo-805 dark:text-indigo-300' 
                                : 'bg-white border-gray-200 dark:bg-[#121212] dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/10 text-[9px] font-black flex items-center justify-center shrink-0">
                                {emp.name.substring(0,2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold truncate leading-tight">{emp.name}</p>
                                <p className="text-[9px] text-slate-400 truncate leading-none mt-0.5">{emp.role}</p>
                              </div>
                            </div>
                            <span className={`material-icons text-sm shrink-0 ${isChecked ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-700'}`}>
                              {isChecked ? 'check_box' : 'check_box_outline_blank'}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* SECTION: ALLOCATE TOOLS */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-black uppercase text-indigo-650 dark:text-indigo-400 border-b border-gray-100 dark:border-white/5 pb-2 flex items-center gap-1.5">
                  <span className="material-icons-outlined text-sm">handyman</span> Ferramentas & Equipamentos Alocados ({formData.toolIds?.length || 0})
                </h4>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={toolSearch}
                    onChange={(e) => setToolSearch(e.target.value)}
                    placeholder="Filtrar ferramentas livres ou ja cadastradas..."
                    className="w-full px-3 py-1.5 border border-gray-150 dark:border-white/5 rounded-lg bg-gray-55/60 dark:bg-white/5 text-xs text-slate-800 dark:text-white focus:outline-none placeholder:text-slate-405"
                  />

                  <div className="border border-gray-150 dark:border-white/5 rounded-xl max-h-40 overflow-y-auto p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/50 dark:bg-white/5">
                    {tools
                      .filter(t => t.name.toLowerCase().includes(toolSearch.toLowerCase()))
                      .map((t) => {
                        const isChecked = formData.toolIds?.includes(t.id);
                        return (
                          <div 
                            key={t.id}
                            onClick={() => toggleToolSelection(t.id)}
                            className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                              isChecked 
                                ? 'bg-indigo-50/70 border-indigo-200 text-indigo-850 dark:bg-indigo-950/40 dark:border-indigo-805 dark:text-indigo-300' 
                                : 'bg-white border-gray-200 dark:bg-[#121212] dark:border-white/5 hover:border-gray-300" dark:hover:border-white/10'
                            }`}
                          >
                            <div className="min-w-0 text-left">
                              <p className="text-[11px] font-bold truncate leading-tight">{t.name}</p>
                              <div className="flex items-center gap-1 mt-0.5 leading-none">
                                <span className="text-[8.5px] uppercase font-black px-1 rounded bg-slate-100 dark:bg-white/10 text-slate-550 dark:text-slate-400">
                                  {t.category}
                                </span>
                                {t.associatedWorkName && !isChecked && (
                                  <span className="text-[8.5px] font-bold text-rose-500 italic max-w-[100px] truncate">
                                    Na: {t.associatedWorkName}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className={`material-icons text-sm shrink-0 ml-1.5 ${isChecked ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-700'}`}>
                              {isChecked ? 'check_box' : 'check_box_outline_blank'}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* GENERAL NOTES */}
              <div className="space-y-1.5 pt-2">
                <label className="text-[10px] font-black uppercase text-slate-400 block">Observações e Informações do Canteiro</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  placeholder="Instruções de acesso logístico, ponto de referência elétrico ou contatos adicionais de segurança do trabalho..."
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-dark-card text-slate-850 dark:text-white text-xs focus:ring-1 focus:ring-indigo-550 focus:outline-none placeholder:text-slate-401 font-semibold"
                />
              </div>

            </form>

            <div className="p-6 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5 flex justify-end gap-3 rounded-b-2xl">
              <button
                type="button"
                onClick={handleCloseForm}
                className="px-4 py-2 text-slate-500 hover:text-slate-800 dark:text-slate-350 dark:hover:text-white text-xs font-bold transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveWork}
                className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-550 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all"
              >
                {isEditing ? 'Salvar Alterações' : 'Gravar Obra e Ativos'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* DETAIL MODAL (Ficha do Canteiro Bento Box style) */}
      {showDetailModal && selectedWork && (() => {
        const stats = calculateDeadlineStats(selectedWork.startDate, selectedWork.estimatedEndDate, selectedWork.status);
        const associatedProperty = properties.find(p => p.id === selectedWork.propertyId);
        
        const workCrew = employees.filter(e => selectedWork.employeeIds?.includes(e.id));
        const workTools = tools.filter(t => selectedWork.toolIds?.includes(t.id));

        return (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-[#111] w-full max-w-4xl rounded-2xl border border-gray-150/70 dark:border-white/10 shadow-2xl flex flex-col max-h-[92vh] animate-in fade-in zoom-in duration-200">
              
              {/* Header */}
              <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-gray-100/50 dark:bg-white/5 flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                      Ficha Oficial do Canteiro
                    </span>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-350">
                      ID: {selectedWork.id}
                    </span>
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                      selectedWork.status === 'Concluído' 
                        ? 'bg-emerald-50 text-emerald-700'
                        : selectedWork.status === 'Em Andamento'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {selectedWork.status}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold font-sans text-slate-850 dark:text-white mt-1">
                    {selectedWork.name}
                  </h3>
                </div>
                <button
                  onClick={() => { setSelectedWork(null); setShowDetailModal(false); }}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 p-1 rounded-lg"
                >
                  <span className="material-icons-outlined">close</span>
                </button>
              </div>

              {/* Multi Section Body */}
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                
                {/* Visual Deadline timeline banner */}
                <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-white/5 border border-gray-150/50 dark:border-white/5 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400 block">Tempo Decorrido / Cronograma</span>
                    <span className="text-2xl font-black text-slate-800 dark:text-white block">{stats.elapsedPercent}%</span>
                    <span className="text-[10px] text-slate-500 block">Status: {stats.text}</span>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          stats.criticalState === 'CRITICAL' ? 'bg-rose-500' :
                          stats.criticalState === 'WARNED' ? 'bg-amber-500' :
                          stats.criticalState === 'COMPLETED' ? 'bg-emerald-550' :
                          'bg-indigo-600'
                        }`}
                        style={{ width: `${stats.elapsedPercent}%` }}
                      />
                    </div>
                    
                    <div className="grid grid-cols-3 text-[10px] font-bold text-slate-450 dark:text-slate-400">
                      <div>
                        <span className="block text-slate-400">INÍCIO OPERAÇÃO</span>
                        <strong>{new Date(selectedWork.startDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</strong>
                      </div>
                      <div className="text-center">
                        <span className="block text-slate-400">PRAZO CONTRATUAL</span>
                        <strong>{stats.totalDays} dias total</strong>
                      </div>
                      <div className="text-right">
                        <span className="block text-slate-400">ENTREGA PREVISTA</span>
                        <strong>{new Date(selectedWork.estimatedEndDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bento components row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* LEFT: ADDRESS & CONTACTS */}
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-gray-150/40 dark:border-white/5 bg-white dark:bg-dark-card space-y-3.5">
                      <h4 className="text-[11px] font-black uppercase text-indigo-650 dark:text-indigo-400 flex items-center gap-1.5 border-b border-gray-100 dark:border-white/5 pb-2">
                        <span className="material-icons-outlined text-xs">room</span> Localização Física
                      </h4>
                      <div className="space-y-2.5 text-xs">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Endereço do Canteiro</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 block mt-0.5">
                            {selectedWork.addressStreet}, Nº {selectedWork.addressNumber}
                            {selectedWork.addressComplement ? ` - ${selectedWork.addressComplement}` : ''}
                          </span>
                          <span className="text-slate-450 dark:text-slate-400 block">
                            {selectedWork.addressNeighborhood}, {selectedWork.addressCity}/{selectedWork.addressState} — CEP: {selectedWork.addressZip}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-gray-150/40 dark:border-white/5 bg-white dark:bg-dark-card space-y-3.2">
                      <h4 className="text-[11px] font-black uppercase text-indigo-650 dark:text-indigo-400 flex items-center gap-1.5 border-b border-gray-100 dark:border-white/5 pb-2">
                        <span className="material-icons-outlined text-xs">contact_phone</span> Contatos Autoritários
                      </h4>
                      <div className="space-y-3 text-xs">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-slate-400 block">Gestor / Mestre</span>
                            <strong className="text-slate-800 dark:text-slate-200 font-bold block mt-0.5">{selectedWork.contactName || 'Não informado'}</strong>
                          </div>
                          {selectedWork.contactPhone && (
                            <a
                              href={`tel:${selectedWork.contactPhone}`}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-150 text-indigo-755 dark:bg-indigo-950/50 dark:text-indigo-300 font-extrabold rounded-lg text-[10px] flex items-center gap-1"
                            >
                              <span className="material-icons text-xs">phone</span> Ligar
                            </a>
                          )}
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Telefone Comercial</span>
                          <span className="font-mono text-slate-650 dark:text-slate-350">{selectedWork.contactPhone || 'Sem telefone registrado'}</span>
                        </div>
                      </div>
                    </div>

                    {/* ASSOCIATED LODGING */}
                    <div className="p-4 rounded-xl border border-gray-150/40 dark:border-white/5 bg-white dark:bg-dark-card space-y-2.5">
                      <h4 className="text-[11px] font-black uppercase text-indigo-650 dark:text-indigo-400 flex items-center gap-1.5 border-b border-gray-100 dark:border-white/5 pb-2">
                        <span className="material-icons-outlined text-xs">holiday_village</span> Alojamento Associado à Obra
                      </h4>
                      {associatedProperty ? (
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-1">
                            <div>
                              <strong className="text-xs text-slate-800 dark:text-slate-200 block">{associatedProperty.name}</strong>
                              <span className="text-[10px] text-slate-450 dark:text-slate-400 block mt-0.5">
                                Cod/ID: {associatedProperty.id}
                              </span>
                            </div>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-350 rounded border border-emerald-100 dark:border-transparent">
                              VINCULADO
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            End: {associatedProperty.addressStreet}, Nº {associatedProperty.addressNumber}, {associatedProperty.addressNeighborhood}
                          </p>
                          {associatedProperty.furniture && associatedProperty.furniture.length > 0 && (
                            <div>
                              <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Mobília Inclusa no Apoio</span>
                              <div className="flex flex-wrap gap-1">
                                {associatedProperty.furniture.map(f => (
                                  <span key={f.id} className="text-[9.5px] px-2 py-0.5 bg-slate-100/75 dark:bg-white/5 text-slate-650 dark:text-slate-350 rounded-lg">
                                    {f.name} ({f.quantity}x - {f.condition})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 bg-slate-50/50 dark:bg-white/5 rounded-xl text-center border border-dashed border-gray-150 dark:border-white/5">
                          <p className="text-[11px] text-slate-400 italic">Nenhum alojamento associado à obra</p>
                          <p className="text-[9.5px] text-slate-405 mt-1">Este canteiro não possui imóveis de apoio ou casas alugadas sob responsabilidade do contratante no momento.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT: ALLOCATED STAFF & TOOLS */}
                  <div className="space-y-4">
                    
                    {/* ALLOCATED CREW LIST */}
                    <div className="p-4 rounded-xl border border-gray-150/40 dark:border-white/5 bg-white dark:bg-dark-card space-y-3">
                      <h4 className="text-[11px] font-black uppercase text-indigo-650 dark:text-indigo-400 flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-2">
                        <span className="flex items-center gap-1.5">
                          <span className="material-icons-outlined text-xs">engineering</span> Equipe Alocada no Canteiro
                        </span>
                        <span className="bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-[10px] text-slate-700 dark:text-slate-400">
                          {workCrew.length} Colaboradores
                        </span>
                      </h4>

                      {workCrew.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {workCrew.map(e => (
                            <div key={e.id} className="p-2 rounded-lg bg-slate-50/50 dark:bg-white/5 border border-gray-150/20 dark:border-white/5 flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-650 dark:bg-indigo-950/40 dark:text-indigo-300 font-black text-xs flex items-center justify-center shrink-0">
                                  {e.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <strong className="text-xs text-slate-800 dark:text-slate-150 font-bold block truncate">{e.name}</strong>
                                  <span className="text-[10px] text-slate-450 dark:text-slate-455 truncate block">{e.role} — <span className="text-indigo-650 dark:text-indigo-400">{e.department}</span></span>
                                </div>
                              </div>
                              <span className="text-[9px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-300 font-extrabold px-1.5 py-0.5 rounded uppercase">
                                Ativo
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-slate-50/50 dark:bg-white/5 rounded-xl border border-dashed text-center border-gray-150 dark:border-white/5">
                          <p className="text-[11px] text-slate-400 italic">Equipe não alocada</p>
                          <p className="text-[9.5px] text-slate-405 mt-1">Este canteiro de obras não possui equipe técnica atribuída.</p>
                        </div>
                      )}
                    </div>

                    {/* VINCULATED TOOLS LIST */}
                    <div className="p-4 rounded-xl border border-gray-150/40 dark:border-white/5 bg-white dark:bg-dark-card space-y-3">
                      <h4 className="text-[11px] font-black uppercase text-indigo-650 dark:text-indigo-400 flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-2">
                        <span className="flex items-center gap-1.5">
                          <span className="material-icons-outlined text-xs">handyman</span> Ferramental Despachado
                        </span>
                        <span className="bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-[10px] text-slate-700 dark:text-slate-400">
                          {workTools.length} Itens
                        </span>
                      </h4>

                      {workTools.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {workTools.map(t => (
                            <div key={t.id} className="p-2 rounded-lg bg-slate-50/50 dark:bg-white/5 border border-gray-150/20 dark:border-white/5 flex flex-col justify-between">
                              <div className="flex items-start justify-between gap-1.5">
                                <span className="text-[9px] uppercase font-black tracking-wider text-slate-400 dark:text-slate-500">
                                  {t.category}
                                </span>
                                <span className="text-[8.5px] font-black uppercase px-1 py-0.2 rounded bg-slate-100 dark:bg-white/10 text-slate-600">
                                  ESTADO: {t.condition}
                                </span>
                              </div>
                              <strong className="text-xs text-slate-805 dark:text-slate-150 mt-1 block truncate">
                                {t.name}
                              </strong>
                              {t.serialNumber && (
                                <p className="text-[9.5px] text-slate-450 dark:text-slate-500 font-mono mt-0.5">Série: {t.serialNumber}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-slate-50/50 dark:bg-white/5 rounded-xl border border-dashed text-center border-gray-150 dark:border-white/5">
                          <p className="text-[11px] text-slate-400 italic">Sem caixa de ferramentas ativa</p>
                          <p className="text-[9.5px] text-slate-405 mt-1">Este canteiro não possui ferramentas elétricas registradas.</p>
                        </div>
                      )}
                    </div>

                  </div>

                </div>

                {/* GALERIA DE FOTOS DO CANTEIRO */}
                {(() => {
                  const selectedWorkPhotos = workPhotos.filter(photo => (photo.workId === selectedWork.id || photo.work_id === selectedWork.id));
                  return (
                    <div className="space-y-3 bg-white dark:bg-transparent p-4/0 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-icons-outlined text-indigo-500 text-lg">camera_alt</span>
                          <h4 className="text-xs font-black uppercase text-slate-800 dark:text-white tracking-wider">Evidências Fotográficas ({selectedWorkPhotos.length})</h4>
                        </div>
                      </div>
                      
                      {selectedWorkPhotos.length === 0 ? (
                        <div className="p-6 bg-slate-50/50 dark:bg-[#1a1f2c]/10 rounded-xl border border-dashed text-center border-gray-150 dark:border-white/5">
                          <p className="text-[11px] text-slate-400 italic">Nenhuma foto registrada para este canteiro</p>
                          <p className="text-[9.5px] text-slate-450 mt-1">Colaboradores de campo podem anexar imagens de evidência ou tirar fotos diretamente do celular no menu lateral "8. Fotos do Canteiro".</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {selectedWorkPhotos.map((photo: any) => (
                            <div key={photo.id} className="group relative bg-[#f8fafc]/80 dark:bg-white/5 rounded-xl overflow-hidden border border-gray-150 dark:border-white/5 flex flex-col hover:shadow-xs transition-shadow">
                              <div className="relative h-28 bg-slate-900 overflow-hidden flex items-center justify-center">
                                <img
                                  src={photo.photoUrl || photo.photo_url}
                                  alt="Evidência do Canteiro"
                                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div className="p-2 space-y-1 bg-white/50 dark:bg-[#151a26]/30">
                                <p className="text-[10px] text-slate-600 dark:text-slate-300 italic font-medium line-clamp-2 leading-tight" title={photo.observation}>
                                  {photo.observation ? `"${photo.observation}"` : 'Sem descrição'}
                                </p>
                                <div className="flex justify-between items-center text-[8px] text-slate-400 pt-1.5 border-t border-gray-150/40 dark:border-white/5">
                                  <span className="truncate max-w-[65%] font-bold text-slate-500 dark:text-slate-400">{photo.uploadedBy || photo.uploaded_by}</span>
                                  <span className="font-mono text-[7.5px] shrink-0">{new Date(photo.createdAt || photo.created_at || new Date()).toLocaleDateString('pt-BR')}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* OBSERVATION FOOTER */}
                {selectedWork.notes && (
                  <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/25 dark:bg-indigo-950/10 space-y-1.5">
                    <span className="text-[9px] uppercase font-black tracking-widest text-indigo-650 dark:text-indigo-400 block">Informações de Acesso de Campo (Observações)</span>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-350">{selectedWork.notes}</p>
                  </div>
                )}

              </div>

              {/* Modal footer */}
              <div className="p-6 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5 flex justify-end rounded-b-2xl">
                <button
                  onClick={() => { setSelectedWork(null); setShowDetailModal(false); }}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-white/10 dark:hover:bg-white/20 text-white dark:text-slate-200 font-extrabold text-xs rounded-xl"
                >
                  Fechar Ficha
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default Works;
