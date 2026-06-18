import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { ToolEquipment, Employee } from '../types';
import { logAction } from '../services/audit';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface ToolsProps {
  initialShowForm?: boolean;
  onFormClose?: () => void;
}

const Tools: React.FC<ToolsProps> = ({ initialShowForm, onFormClose }) => {
  const [tools, setTools] = useState<ToolEquipment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<ToolEquipment | null>(null);

  // Form Fields State
  const [toolName, setToolName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [category, setCategory] = useState<ToolEquipment['category']>('Ferramenta Elétrica');

  useEffect(() => {
    if (initialShowForm) {
      handleOpenAddModal();
    }
  }, [initialShowForm]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    if (onFormClose) {
      onFormClose();
    }
  };
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState<ToolEquipment['condition']>('Bom');
  const [associatedWorkName, setAssociatedWorkName] = useState('');
  const [assignmentDate, setAssignmentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Selected Responsible Employee IDs
  const [selectedResponsibleIds, setSelectedResponsibleIds] = useState<string[]>([]);

  // Feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch active/housed employees
      const { data: employeesData } = await supabase.from('employees').select('*');
      if (employeesData) {
        setEmployees(employeesData as Employee[]);
      }

      // Fetch tools
      const { data: toolsData } = await supabase.from('tools').select('*');
      if (toolsData) {
        // Deduplicate just in case
        const uniqueTools: ToolEquipment[] = [];
        const seenIds = new Set<string>();
        for (const t of (toolsData as ToolEquipment[])) {
          if (t && t.id && !seenIds.has(t.id)) {
            seenIds.add(t.id);
            uniqueTools.push(t);
          }
        }
        setTools(uniqueTools);
      }
    } catch (err) {
      console.error('Erro ao buscar ferramentas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingTool(null);
    setToolName('');
    setSerialNumber('');
    setCategory('Ferramenta Elétrica');
    setQuantity(1);
    setCondition('Bom');
    setAssociatedWorkName('');
    setAssignmentDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setSelectedResponsibleIds([]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: ToolEquipment) => {
    setEditingTool(t);
    setToolName(t.name);
    setSerialNumber(t.serialNumber || '');
    setCategory(t.category);
    setQuantity(t.quantity);
    setCondition(t.condition);
    setAssociatedWorkName(t.associatedWorkName || '');
    setAssignmentDate(t.assignmentDate || new Date().toISOString().split('T')[0]);
    setNotes(t.notes || '');
    setSelectedResponsibleIds([...t.responsibleEmployeeIds]);
    setIsModalOpen(true);
  };

  const handleSaveTool = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!toolName.trim()) {
      alert('Favor inserir a designação ou descrição da ferramenta.');
      return;
    }

    if (selectedResponsibleIds.length === 0) {
      alert('Por favor, defina pelo menos um colaborador responsável pela guarda/uso desta ferramenta.');
      return;
    }

    try {
      setIsSubmitting(true);
      const toolId = editingTool 
        ? editingTool.id 
        : `tool-${Math.random().toString(36).substring(2, 9)}`;

      const savedTool: ToolEquipment = {
        id: toolId,
        name: toolName.trim(),
        serialNumber: serialNumber.trim() || undefined,
        category,
        quantity,
        condition,
        responsibleEmployeeIds: selectedResponsibleIds,
        associatedWorkName: associatedWorkName.trim() || undefined,
        assignmentDate,
        notes: notes.trim() || undefined
      };

      if (editingTool) {
        await supabase
          .from('tools')
          .update(savedTool)
          .eq('id', toolId);
        showToast('Equipamento atualizado com sucesso!');
      } else {
        await supabase
          .from('tools')
          .insert(savedTool);
        showToast('Nova ferramenta cadastrada e atribuída!');
      }

      handleCloseModal();
      fetchData();
    } catch (err) {
      console.error('Erro ao salvar ferramenta:', err);
      showToast('Ocorreu uma falha ao cadastrar a ferramenta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTool = async (t: ToolEquipment) => {
    if (!window.confirm(`Deseja realmente remover o registro de "${t.name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await supabase.from('tools').delete().eq('id', t.id);
      showToast(`Equipamento "${t.name}" excluído correta e permanentemente.`);
      fetchData();
    } catch (err) {
      console.error('Falha ao deletar ferramenta:', err);
      showToast('Falha ao excluir o registro de ferramentas.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleResponsible = (empId: string) => {
    if (selectedResponsibleIds.includes(empId)) {
      setSelectedResponsibleIds(selectedResponsibleIds.filter(id => id !== empId));
    } else {
      setSelectedResponsibleIds([...selectedResponsibleIds, empId]);
    }
  };

  // Filters application
  const filteredTools = tools.filter(t => {
    // Search query
    if (searchTerm.trim() !== '') {
      const search = searchTerm.toLowerCase();
      const matchName = t.name.toLowerCase().includes(search);
      const matchSerial = t.serialNumber?.toLowerCase().includes(search) || false;
      const matchWork = t.associatedWorkName?.toLowerCase().includes(search) || false;

      const hasMatchingEmpName = t.responsibleEmployeeIds.some(id => {
        const emp = employees.find(e => e.id === id);
        return emp?.name.toLowerCase().includes(search);
      });

      if (!matchName && !matchSerial && !matchWork && !hasMatchingEmpName) {
        return false;
      }
    }

    // Category filter
    if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;

    // Condition filter
    if (selectedCondition !== 'all' && t.condition !== selectedCondition) return false;

    return true;
  });

  // Calculate statistics
  const totalToolsCount = tools.length;
  const electricToolsCount = tools.filter(t => t.category === 'Ferramenta Elétrica').length;
  const metalAccessToolsCount = tools.filter(t => t.category === 'Equipamento de Acesso').length;
  const criticalConditionCount = tools.filter(t => t.condition === 'Ruim' || t.condition === 'Regular').length;
  const totalAggregatedUnits = tools.reduce((sum, t) => sum + t.quantity, 0);

  const handleExportPDFList = () => {
    const doc = new jsPDF() as any;
    
    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Relatório de Controle de Ferramentas", 14, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 26);
    doc.text(`Filtros - Categoria: ${selectedCategory === 'all' ? 'Todas' : selectedCategory} | Estado: ${selectedCondition === 'all' ? 'Todos' : selectedCondition}`, 14, 32);
    
    const tableColumns = ["Ferramenta / Equipamento", "Nº Série", "Categoria", "Qtd", "Conservação", "Canteiro / Localização", "Guardiões / Responsáveis"];
    const tableRows = filteredTools.map(t => {
      const respNames = t.responsibleEmployeeIds.map(id => {
        const emp = employees.find(e => e.id === id);
        return emp ? emp.name : `ID: ${id}`;
      }).join(', ');
      
      return [
        t.name,
        t.serialNumber || '-',
        t.category || '-',
        t.quantity.toString(),
        t.condition || '-',
        t.associatedWorkName || 'Estoque Geral / Almoxarifado',
        respNames || 'Sem Guardião'
      ];
    });
    
    doc.autoTable({
      head: [tableColumns],
      body: tableRows,
      startY: 38,
      theme: 'grid',
      styles: { fontSize: 8, font: "helvetica" },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' }
    });
    
    doc.save(`ferramentas_${new Date().toISOString().slice(0, 10)}.pdf`);
    logAction('REPORTS_GENERATE', 'Relatório de ferramentas exportado em PDF', { count: filteredTools.length });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Controle de Ferramental & Equipamentos</h2>
          <p className="text-slate-500 dark:text-slate-400">
            Guarda, alocação e termos de responsabilidade de ferramentas sob custódia de colaboradores e canteiros de obras.
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
            onClick={handleOpenAddModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm px-5 py-3 rounded-xl shadow-md hover:shadow-lg hover:scale-[1.01] transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-icons-outlined text-sm">handyman</span>
            Cadastrar Ferramenta
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="bg-emerald-55 border-l-4 border-emerald-600 p-4 rounded-xl text-white font-extrabold text-xs shadow-md animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <span className="material-icons-outlined">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-gray-100 dark:border-dark-border flex items-center justify-between transition-colors shadow-xs">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Tipos de Ferramenta</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white mt-1">{totalToolsCount}</span>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/10 text-blue-500 rounded-xl">
            <span className="material-icons-outlined text-xl">construction</span>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-gray-100 dark:border-dark-border flex items-center justify-between transition-colors shadow-xs">
          <div>
            <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest block">Unidades Totais</span>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{totalAggregatedUnits}</span>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/10 text-indigo-500 rounded-xl">
            <span className="material-icons-outlined text-xl">inventory_2</span>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-gray-100 dark:border-dark-border flex items-center justify-between transition-colors shadow-xs">
          <div>
            <span className="text-xs font-bold text-amber-500 uppercase tracking-widest block">Elétricas & Motores</span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{electricToolsCount}</span>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-900/10 text-amber-500 rounded-xl">
            <span className="material-icons-outlined text-xl">electrical_services</span>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-gray-100 dark:border-dark-border flex items-center justify-between transition-colors shadow-xs">
          <div>
            <span className="text-xs font-bold text-red-500 uppercase tracking-widest block">Estado Crítico / Regular</span>
            <span className="text-2xl font-black text-red-650 dark:text-red-400 mt-1">{criticalConditionCount}</span>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-900/10 text-red-505 rounded-xl">
            <span className="material-icons-outlined text-xl">report_problem</span>
          </div>
        </div>
      </div>

      {/* Filter and search zone */}
      <div className="bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-100 dark:border-dark-border grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative md:col-span-1.5">
          <span className="material-icons-outlined absolute left-3 top-2.5 text-slate-400">search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por descrição, número de série, obra ou guarda de colaborador..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50/50 dark:bg-white/5 text-slate-800 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 font-medium"
          />
        </div>

        <div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-slate-800 text-slate-800 dark:text-gray-100 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="all" className="bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-gray-100">Todas Categorias</option>
            <option value="Ferramenta Elétrica" className="bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-gray-100">Ferramentas Elétricas</option>
            <option value="Ferramenta Manual" className="bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-gray-100">Ferramentas Manuais</option>
            <option value="Equipamento de Proteção" className="bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-gray-100">Proteção / EPI Especial</option>
            <option value="Equipamento de Acesso" className="bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-gray-100">Acesso (Escadas, Andaimes)</option>
            <option value="Outros" className="bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-gray-100">Outros Materiais</option>
          </select>
        </div>

        <div>
          <select
            value={selectedCondition}
            onChange={(e) => setSelectedCondition(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-slate-800 text-slate-800 dark:text-gray-100 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="all" className="bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-gray-100">Todos Estados de Conservação</option>
            <option value="Novo" className="bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-gray-100">Novo</option>
            <option value="Bom" className="bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-gray-100">Bom</option>
            <option value="Regular" className="bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-gray-100">Regular</option>
            <option value="Ruim" className="bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-gray-100">Ruim (Manutenção Necessária)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-16 flex justify-center items-center">
          <span className="material-icons-outlined animate-spin text-4xl text-indigo-500">refresh</span>
        </div>
      ) : filteredTools.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-white dark:bg-dark-card shadow-xs">
          <span className="material-icons-outlined text-4xl text-slate-350 mb-2">construction</span>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhuma ferramenta catalogada corresponde à busca</p>
          <p className="text-xs text-slate-400 mt-1">Insira novas ferramentas de trabalho ou mude as condições de filtragem.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredTools.map((t) => {
            const responsibleStaff = employees.filter(e => t.responsibleEmployeeIds.includes(e.id));
            
            const conditionColors = {
              Novo: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-350 border border-emerald-150',
              Bom: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-350 border border-blue-150',
              Regular: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-350 border border-amber-150',
              Ruim: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-350 border border-red-150'
            };

            const categoryTagColors = {
              'Ferramenta Elétrica': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
              'Ferramenta Manual': 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
              'Equipamento de Proteção': 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
              'Equipamento de Acesso': 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
              'Outros': 'bg-gray-500/15 text-gray-600 dark:text-gray-300'
            }[t.category];

            return (
              <div 
                key={t.id}
                className="bg-white dark:bg-dark-card rounded-2xl border border-gray-120 dark:border-dark-border p-5 transition-all shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2.5 mb-3">
                    <div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${categoryTagColors} leading-none tracking-wider block w-fit mb-1`}>
                        {t.category}
                      </span>
                      <h4 className="font-extrabold text-lg text-slate-800 dark:text-white leading-tight">{t.name}</h4>
                      {t.associatedWorkName ? (
                        <div className="inline-flex items-center gap-1 mt-1 text-xs text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/70 dark:bg-indigo-950/30 px-2 py-0.5 rounded">
                          <span className="material-icons-outlined text-[13px]">construction</span>
                          Obra: {t.associatedWorkName}
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 mt-1 text-[10px] text-orange-600 dark:text-orange-400 font-bold bg-orange-50/50 dark:bg-orange-950/10 px-1.5 py-0.5 rounded">
                          <span className="material-icons-outlined text-[12px]">sensors_off</span>
                          Sem local fixo / Na Base
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end shrink-0 gap-1.5">
                      <span className="text-xs bg-slate-800 text-white dark:bg-white dark:text-slate-900 px-2 py-0.5 rounded-lg font-black shrink-0">
                        {t.quantity} Unidades
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${conditionColors[t.condition]}`}>
                        {t.condition}
                      </span>
                    </div>
                  </div>

                  {/* Operational Details */}
                  <div className="my-4 space-y-2 text-xs text-slate-500 dark:text-slate-400 font-semibold bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-150/40 dark:border-white/5">
                    {t.serialNumber && (
                      <p className="flex items-center gap-1.5 select-all font-mono">
                        <span className="material-icons-outlined text-slate-400 text-sm">filter_frames</span>
                        <span>SÉRIE: {t.serialNumber}</span>
                      </p>
                    )}
                    {t.assignmentDate && (
                      <p className="flex items-center gap-1.5">
                        <span className="material-icons-outlined text-slate-400 text-sm animate-pulse">assignment_ind</span>
                        <span>Guarda iniciada em: {t.assignmentDate.split('-').reverse().join('/')}</span>
                      </p>
                    )}
                    {t.notes && (
                      <p className="text-xs italic text-slate-400 border-t border-dashed border-gray-200 dark:border-white/10 pt-1.5 mt-1.5 pl-1.5 line-clamp-2">
                        &ldquo;{t.notes}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Custody Employee List */}
                  <div className="mt-4 pt-3.5 border-t border-gray-100 dark:border-white/10 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Estilo de Responsabilidade / Colaboradores Portadores</span>
                    
                    <div className="space-y-1.5">
                      {responsibleStaff.length === 0 ? (
                        <p className="text-xs text-red-500/80 italic">Sem responsável ativo. Favor editar para atribuir.</p>
                      ) : (
                        responsibleStaff.map(emp => (
                          <div 
                            key={emp.id} 
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-gray-150 dark:border-[#333] hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                          >
                            <div className="flex items-center gap-2 max-w-full">
                              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-750 text-[10px] font-black flex items-center justify-center shrink-0">
                                {emp.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div className="truncate">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block truncate">{emp.name}</span>
                                <span className="text-[9px] text-slate-400 font-semibold block">{emp.role} — {emp.department}</span>
                              </div>
                            </div>
                            <span className="text-[9px] font-black uppercase text-indigo-650 bg-indigo-50 dark:bg-indigo-950/40 px-1 py-0.5 rounded leading-none shrink-0 border border-indigo-100">
                              Responsável
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Foot Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-150 dark:border-white/5 mt-4">
                  <button
                    onClick={() => handleOpenEditModal(t)}
                    className="p-2 border border-gray-200 hover:border-indigo-500 dark:border-white/10 hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-550 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                    title="Editar Atribuição"
                  >
                    <span className="material-icons-outlined text-sm">edit</span>
                    <span>Editar Atribuição</span>
                  </button>
                  <button
                    onClick={() => handleDeleteTool(t)}
                    className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-550 rounded-xl text-xs font-bold transition-all"
                    title="Excluir Registro"
                  >
                    <span className="material-icons-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Register / Edit Modal Slideover */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCloseModal}></div>
          
          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 w-full max-w-2xl z-10 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 dark:border-white/5 flex justify-between items-center shrink-0">
              <h3 className="font-extrabold text-base text-slate-800 dark:text-white flex items-center gap-2">
                <span className="material-icons-outlined text-indigo-550">handyman</span>
                {editingTool ? 'Editar Atribuição de Equipamento' : 'Cadastrar Equipamento / Ferramenta de Trabalho'}
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-200">
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveTool} className="p-5 space-y-4 overflow-y-auto">
              
              {/* Section 1: Descrição e Detalhes principais */}
              <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl space-y-3">
                <span className="text-[10px] uppercase font-black text-indigo-650 dark:text-indigo-400 tracking-wider block">1. Especificações Técnicas</span>
                
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Nome / Descrição do Equipamento</label>
                  <input
                    type="text"
                    value={toolName}
                    onChange={(e) => setToolName(e.target.value)}
                    placeholder="Ex: Furadeira Bosch 13mm, Rompedor Makita 20Kg, Andaime Metálico"
                    className="w-full p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none placeholder:text-slate-400 font-semibold"
                    required
                  />
                  {/* Suggest labels */}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {['Furadeira', 'Rompedor', 'Escada de Alumínio', 'Andaime', 'Gerador', 'Makita', 'Jogo de Chaves'].map(sg => (
                      <button
                        key={sg}
                        type="button"
                        onClick={() => setToolName(editing => editing ? editing + ' ' + sg : sg)}
                        className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300 font-bold hover:bg-slate-200"
                      >
                        +{sg}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Categoria</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ToolEquipment['category'])}
                      className="w-full p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-gray-105 text-sm font-semibold focus:outline-none"
                    >
                      <option value="Ferramenta Elétrica" className="bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-gray-100">Ferramenta Elétrica / Motorizada</option>
                      <option value="Ferramenta Manual" className="bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-gray-100">Ferramenta Manual</option>
                      <option value="Equipamento de Proteção" className="bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-gray-100">Equipamento de Proteção Especial</option>
                      <option value="Equipamento de Acesso" className="bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-gray-100">Equipamento de Acesso (Escadas, Andaimes)</option>
                      <option value="Outros" className="bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-gray-100">Outros</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Número de Série / Registro Único</label>
                    <input
                      type="text"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      placeholder="Ex: NR-8890, SN-12345"
                      className="w-full p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none placeholder:text-slate-400 font-mono font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Quantidade de Unidades</label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none font-semibold"
                      min={1}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Estado de Conservação</label>
                    <select
                      value={condition}
                      onChange={(e) => setCondition(e.target.value as ToolEquipment['condition'])}
                      className="w-full p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-gray-105 text-sm font-semibold focus:outline-none"
                    >
                      <option value="Novo" className="bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-gray-100">Novo</option>
                      <option value="Bom" className="bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-gray-100">Bom</option>
                      <option value="Regular" className="bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-gray-100">Regular</option>
                      <option value="Ruim" className="bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-gray-100">Ruim (Manutenção Urgente)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Destino (Obra) e Guarda (Responsáveis) */}
              <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl space-y-3">
                <span className="text-[10px] uppercase font-black text-indigo-650 dark:text-indigo-400 tracking-wider block">2. Guarda dos Colaboradores & Obras</span>
                
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Destinação / Obra Alocada</label>
                  <input
                    type="text"
                    value={associatedWorkName}
                    onChange={(e) => setAssociatedWorkName(e.target.value)}
                    placeholder="Ex: Pavimentação Rodovia PR-120, Alojamento Sede"
                    className="w-full p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none placeholder:text-slate-400 font-semibold"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Vincule a ferramenta a uma facha de construção em andamento ou canteiro principal.</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Data da Atribuição / Entrega do Termo</label>
                  <input
                    type="date"
                    value={assignmentDate}
                    onChange={(e) => setAssignmentDate(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none font-medium"
                    required
                  />
                </div>

                {/* Responsible Picker */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Selecionar Colaboradores Portadores / Responsáveis (Mínimo de 1)
                  </label>
                  <p className="text-[10px] text-slate-450 mb-2">Marque um ou mais colaboradores correspondentes pela tutela das ferramentas.</p>
                  
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto custom-scrollbar p-1">
                    {employees
                      .filter(emp => emp.status === 'Ativo' || emp.status === 'Féris' || emp.status === 'Férias')
                      .map(emp => {
                        const isChecked = selectedResponsibleIds.includes(emp.id);
                        return (
                          <label
                            key={emp.id}
                            className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer select-none transition-all ${
                              isChecked 
                                ? 'border-indigo-500 bg-indigo-55/5 dark:bg-indigo-950/20' 
                                : 'border-gray-150 dark:border-white/5 hover:bg-white dark:hover:bg-white/5 bg-white/50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleResponsible(emp.id)}
                                className="rounded border-gray-301 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                              />
                              <div>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-205 block">{emp.name}</span>
                                <span className="text-[9px] text-slate-400 font-semibold block">{emp.role} — {emp.department}</span>
                              </div>
                            </div>
                            <span className="text-[9px] text-slate-400 font-extrabold uppercase">Ativo</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Section 3: Observações Gerais */}
              <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl space-y-2">
                <span className="text-[10px] uppercase font-black text-indigo-650 dark:text-indigo-400 tracking-wider block">3. Observações Adicionais / Estado de Entrega</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Descreva detalhes como estado das brocas, se acompanha termo de entrega original assinado, acessórios que acompanham, etc."
                  className="w-full p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-slate-800 dark:text-white text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none min-h-[80px]"
                ></textarea>
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-white/5 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 font-extrabold text-xs rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <span className="material-icons-outlined animate-spin text-xs">refresh</span>
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-icons-outlined text-xs">done</span>
                      <span>Salvar Equipamento</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Tools;
