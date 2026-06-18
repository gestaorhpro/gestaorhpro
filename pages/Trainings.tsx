import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Employee, Certification } from '../types';

interface TrainingWithEmployee {
  employeeId: string;
  employeeName: string;
  department: string;
  role: string;
  certId: string;
  name: string;
  type: 'curso' | 'nr';
  institution?: string;
  completionDate: string;
  expirationDate?: string;
  certificateNumber?: string;
  daysRemaining: number | null;
  status: 'valid' | 'expiring_soon' | 'critical_15' | 'expired';
}

const Trainings: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [trainingsList, setTrainingsList] = useState<TrainingWithEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'nr' | 'curso' | 'expired' | 'critical_15' | 'expiring_soon'>('all');
  
  // Modal / Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<TrainingWithEmployee | null>(null);
  
  // Form Fields
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [trainingType, setTrainingType] = useState<'nr' | 'curso'>('nr');
  const [trainingName, setTrainingName] = useState('');
  const [institution, setInstitution] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [certificateNumber, setCertificateNumber] = useState('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: employeesData, error } = await supabase
        .from('employees')
        .select('*');

      if (error) throw error;

      if (employeesData) {
        setEmployees(employeesData as Employee[]);
        processTrainings(employeesData as Employee[]);
      }
    } catch (err) {
      console.error('Erro ao buscar dados de treinamentos:', err);
    } finally {
      setLoading(false);
    }
  };

  const processTrainings = (employeesList: Employee[]) => {
    const list: TrainingWithEmployee[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getCertTypeHelper = (cert: any): 'curso' | 'nr' => {
      if (cert.type === 'nr' || cert.type === 'curso') return cert.type;
      if (/nr[- ]?\d+/i.test(cert.name)) {
        return 'nr';
      }
      return 'curso';
    };

    employeesList.forEach(emp => {
      const rawCerts = Array.isArray(emp.certifications) 
        ? emp.certifications 
        : (typeof emp.certifications === 'string' ? JSON.parse(emp.certifications) : []);
      
      if (rawCerts && Array.isArray(rawCerts)) {
        rawCerts.forEach((cert: any) => {
          let daysRem: number | null = null;
          let status: TrainingWithEmployee['status'] = 'valid';

          if (cert.expirationDate) {
            const expDate = new Date(cert.expirationDate);
            expDate.setHours(23, 59, 59, 999);
            const diffTime = expDate.getTime() - today.getTime();
            daysRem = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (daysRem < 0) {
              status = 'expired';
            } else if (daysRem <= 15) {
              status = 'critical_15';
            } else if (daysRem <= 60) {
              status = 'expiring_soon';
            }
          }

          list.push({
            employeeId: emp.id,
            employeeName: emp.name,
            department: emp.department || 'Geral',
            role: emp.role || 'Colaborador',
            certId: cert.id || `cert-${Math.random()}`,
            name: cert.name,
            type: getCertTypeHelper(cert),
            institution: cert.institution || '',
            completionDate: cert.completionDate,
            expirationDate: cert.expirationDate || '',
            certificateNumber: cert.certificateNumber || '',
            daysRemaining: daysRem,
            status
          });
        });
      }
    });

    // Ordenação padrão: mais críticos/vencidos primeiro
    list.sort((a, b) => {
      // Diferenciar status
      const score = { expired: 4, critical_15: 3, expiring_soon: 2, valid: 1 };
      const scoreA = score[a.status];
      const scoreB = score[b.status];

      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      if (a.daysRemaining !== null && b.daysRemaining !== null) {
        return a.daysRemaining - b.daysRemaining;
      }

      return a.employeeName.localeCompare(b.employeeName);
    });

    setTrainingsList(list);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleOpenAddModal = () => {
    setEditingTraining(null);
    setSelectedEmployeeId('');
    setTrainingType('nr');
    setTrainingName('');
    setInstitution('');
    setCompletionDate('');
    setExpirationDate('');
    setCertificateNumber('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: TrainingWithEmployee) => {
    setEditingTraining(t);
    setSelectedEmployeeId(t.employeeId);
    setTrainingType(t.type);
    setTrainingName(t.name);
    setInstitution(t.institution || '');
    setCompletionDate(t.completionDate);
    setExpirationDate(t.expirationDate || '');
    setCertificateNumber(t.certificateNumber || '');
    setIsModalOpen(true);
  };

  const handleDeleteTraining = async (t: TrainingWithEmployee) => {
    if (!window.confirm(`Tem certeza de que deseja remover o treinamento "${t.name}" do colaborador ${t.employeeName}?`)) {
      return;
    }

    try {
      setLoading(true);
      // Carrega o funcionário
      const emp = employees.find(e => e.id === t.employeeId);
      if (!emp) return;

      const rawCerts = Array.isArray(emp.certifications) 
        ? emp.certifications 
        : (typeof emp.certifications === 'string' ? JSON.parse(emp.certifications) : []);

      // Filtra tirando o certId
      const updatedCerts = rawCerts.filter((c: any) => (c.id || c.name) !== t.certId && c.name !== t.name);

      const { error } = await supabase
        .from('employees')
        .update({ certifications: updatedCerts })
        .eq('id', t.employeeId);

      if (error) throw error;

      showToast(`Treinamento "${t.name}" removido com sucesso.`);
      fetchData();
    } catch (err) {
      console.error('Erro ao excluir treinamento:', err);
      showToast('Erro ao remover o treinamento da base de dados.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTraining = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEmployeeId) {
      alert('Por favor, selecione um colaborador.');
      return;
    }

    if (!trainingName.trim()) {
      alert('Por favor, digite o nome do treinamento.');
      return;
    }

    if (!completionDate) {
      alert('Por favor, defina a data de conclusão.');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Busca o funcionário selecionado
      const emp = employees.find(e => e.id === selectedEmployeeId);
      if (!emp) throw new Error('Colaborador não encontrado');

      const rawCerts = Array.isArray(emp.certifications) 
        ? emp.certifications 
        : (typeof emp.certifications === 'string' ? JSON.parse(emp.certifications) : []);

      const newCert: any = {
        id: editingTraining ? editingTraining.certId : `cert-${Math.random().toString(36).substring(2, 9)}`,
        name: trainingName.trim(),
        type: trainingType,
        institution: institution.trim(),
        completionDate,
        expirationDate: trainingType === 'nr' && expirationDate ? expirationDate : undefined,
        certificateNumber: certificateNumber.trim() || undefined
      };

      let updatedCerts = [];
      if (editingTraining) {
        // Modo de edição: substitui o certificado existente
        updatedCerts = rawCerts.map((c: any) => {
          if (c.id === editingTraining.certId || c.name === editingTraining.name) {
            return newCert;
          }
          return c;
        });
      } else {
        // Novo registro
        updatedCerts = [...rawCerts, newCert];
      }

      // Atualiza o funcionário no banco
      const { error } = await supabase
        .from('employees')
        .update({ certifications: updatedCerts })
        .eq('id', selectedEmployeeId);

      if (error) throw error;

      showToast(editingTraining ? 'Treinamento atualizado com sucesso!' : 'Novo treinamento cadastrado com sucesso!');
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Erro ao salvar treinamento:', err);
      showToast('Ocorreu um erro ao salvar o registro de treinamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Predefined NR suggestions for easy selection
  const nrQuickOptions = [
    'NR-06 Equipamentos de Proteção Individual',
    'NR-10 Segurança em Instalações e Serviços em Eletricidade',
    'NR-11 Transporte, Movimentação, Armazenagem e Manuseio de Materiais',
    'NR-12 Segurança no Trabalho em Máquinas e Equipamentos',
    'NR-18 Segurança e Saúde no Trabalho na Indústria da Construção',
    'NR-20 Segurança e Saúde no Trabalho com Inflamáveis e Combustíveis',
    'NR-33 Segurança e Saúde nos Trabalhos em Espaços Confinados',
    'NR-35 Trabalho em Altura'
  ];

  const filteredTrainings = trainingsList.filter(t => {
    // 1. Pesquisa por texto
    if (searchTerm.trim() !== '') {
      const search = searchTerm.toLowerCase();
      const matchName = t.employeeName.toLowerCase().includes(search);
      const matchTrainName = t.name.toLowerCase().includes(search);
      const matchDept = t.department.toLowerCase().includes(search);
      if (!matchName && !matchTrainName && !matchDept) return false;
    }

    // 2. Filtro de Tab
    if (activeTab === 'nr' && t.type !== 'nr') return false;
    if (activeTab === 'curso' && t.type !== 'curso') return false;
    if (activeTab === 'expired' && t.status !== 'expired') return false;
    if (activeTab === 'critical_15' && t.status !== 'critical_15') return false;
    if (activeTab === 'expiring_soon' && t.status !== 'expiring_soon') return false;

    return true;
  });

  // KPI calculations
  const totalCertifications = trainingsList.length;
  const expiredCount = trainingsList.filter(t => t.status === 'expired').length;
  const critical15Count = trainingsList.filter(t => t.status === 'critical_15').length;
  const expiringSoonCount = trainingsList.filter(t => t.status === 'expiring_soon').length;

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Central de Treinamentos e NRs</h2>
          <p className="text-slate-500 dark:text-slate-400">Controle e planejamento profissional das Normas Regulamentadoras e cursos específicos.</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-sm px-5 py-3 rounded-xl shadow-md hover:shadow-lg hover:scale-[1.01] transition-all flex items-center gap-2"
        >
          <span className="material-icons-outlined text-sm">add_task</span>
          Cadastrar Treinamento
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-gray-100 dark:border-dark-border flex items-center justify-between transition-colors shadow-xs">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Total Ativo</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white mt-1">{totalCertifications}</span>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/10 text-blue-500 rounded-xl">
            <span className="material-icons-outlined text-xl">assignment_turned_in</span>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-gray-100 dark:border-dark-border flex items-center justify-between transition-colors shadow-xs">
          <div>
            <span className="text-xs font-bold text-red-500 uppercase tracking-widest block">Já Vencidos</span>
            <span className="text-2xl font-black text-red-600 dark:text-red-405 mt-1">{expiredCount}</span>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-900/10 text-red-500 rounded-xl">
            <span className="material-icons-outlined text-xl">dangerous</span>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-gray-100 dark:border-dark-border flex items-center justify-between transition-colors shadow-xs">
          <div>
            <span className="text-xs font-bold text-orange-500 uppercase tracking-widest block">Críticos (15 dias)</span>
            <span className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-1">{critical15Count}</span>
          </div>
          <div className="p-3 bg-orange-50 dark:bg-orange-900/10 text-orange-500 rounded-xl">
            <span className="material-icons-outlined text-xl">history_toggle_off</span>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-gray-100 dark:border-dark-border flex items-center justify-between transition-colors shadow-xs">
          <div>
            <span className="text-xs font-bold text-amber-500 uppercase tracking-widest block">A Vencer (60 dias)</span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{expiringSoonCount}</span>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-900/10 text-amber-500 rounded-xl">
            <span className="material-icons-outlined text-xl">hourglass_empty</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Tabs */}
      <div className="bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-100 dark:border-dark-border space-y-4">
        <div className="relative">
          <span className="material-icons-outlined absolute left-3 top-3 text-slate-400">search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por colaborador, departamento ou nome do treinamento..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50/50 dark:bg-white/5 text-slate-800 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 font-medium"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-gray-100 dark:border-white/5 pt-3">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition-all ${
              activeTab === 'all'
                ? 'bg-slate-800 border-slate-800 text-white dark:bg-white dark:border-white dark:text-slate-900'
                : 'bg-slate-50 hover:bg-slate-100 border-gray-200 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 text-slate-600 dark:text-slate-300'
            }`}
          >
            Todos ({totalCertifications})
          </button>
          <button
            onClick={() => setActiveTab('nr')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition-all ${
              activeTab === 'nr'
                ? 'bg-primary-600 border-primary-600 text-white'
                : 'bg-slate-50 hover:bg-slate-100 border-gray-200 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 text-slate-600 dark:text-slate-300'
            }`}
          >
            Normas (NRs) ({trainingsList.filter(t => t.type === 'nr').length})
          </button>
          <button
            onClick={() => setActiveTab('curso')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition-all ${
              activeTab === 'curso'
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-slate-50 hover:bg-slate-100 border-gray-200 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 text-slate-600 dark:text-slate-300'
            }`}
          >
            Cursos Especializados ({trainingsList.filter(t => t.type === 'curso').length})
          </button>
          <div className="w-px bg-gray-200 dark:bg-white/10 my-1 mx-1 hidden sm:block"></div>
          <button
            onClick={() => setActiveTab('expired')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition-all ${
              activeTab === 'expired'
                ? 'bg-red-600 border-red-600 text-white'
                : 'bg-red-50 hover:bg-red-100/70 border-red-200 dark:bg-red-950/20 dark:hover:bg-red-950/30 dark:border-red-900/30 text-red-600 dark:text-red-400'
            }`}
          >
            Vencidos ({expiredCount})
          </button>
          <button
            onClick={() => setActiveTab('critical_15')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition-all ${
              activeTab === 'critical_15'
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'bg-orange-50 hover:bg-orange-100/70 border-orange-200 dark:bg-orange-950/20 dark:hover:bg-orange-950/30 dark:border-orange-900/30 text-orange-600 dark:text-orange-400'
            }`}
          >
            Urgentes (Até 15 dias) ({critical15Count})
          </button>
          <button
            onClick={() => setActiveTab('expiring_soon')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition-all ${
              activeTab === 'expiring_soon'
                ? 'bg-amber-500 border-amber-500 text-white'
                : 'bg-amber-50 hover:bg-amber-100/70 border-amber-200 dark:bg-amber-950/20 dark:hover:bg-amber-950/30 dark:border-amber-900/30 text-amber-600 dark:text-amber-400'
            }`}
          >
            Próximos (Até 60 dias) ({expiringSoonCount})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-16 flex justify-center items-center">
          <span className="material-icons-outlined animate-spin text-4xl text-primary-500">refresh</span>
        </div>
      ) : filteredTrainings.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-white dark:bg-dark-card shadow-xs">
          <span className="material-icons-outlined text-4xl text-slate-350 dark:text-slate-650 mb-2">assignment_ind</span>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhum treinamento encontrado</p>
          <p className="text-xs text-slate-400 mt-1">Experimente alterar os termos de busca ou filtros ativos.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTrainings.map((t) => {
            const isExpired = t.status === 'expired';
            const isCritical = t.status === 'critical_15';
            const isExpiring = t.status === 'expiring_soon';
            
            return (
              <div 
                key={`${t.employeeId}-${t.certId}`}
                className={`flex flex-col lg:flex-row lg:items-center justify-between p-4 rounded-xl border bg-white dark:bg-dark-card transition-all hover:scale-[1.003] hover:shadow-xs gap-4 ${
                  isExpired 
                    ? 'border-red-155 dark:border-red-950 bg-red-500/[0.01]' 
                    : isCritical 
                      ? 'border-orange-200 dark:border-orange-950 bg-orange-500/[0.01]'
                      : isExpiring 
                        ? 'border-amber-200 dark:border-amber-950 bg-amber-500/[0.01]'
                        : 'border-gray-100 dark:border-dark-border'
                }`}
              >
                {/* Person details */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shrink-0 shadow-xs ${
                    isExpired 
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30' 
                      : isCritical 
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30'
                        : isExpiring
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-940/30'
                          : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'
                  }`}>
                    {t.employeeName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                        {t.employeeName}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 capitalize shrink-0">
                        {t.department}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                      <span>{t.role}</span>
                    </div>
                  </div>
                </div>

                {/* Training and type details */}
                <div className="flex-1 min-w-0 lg:px-4">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      t.type === 'nr' 
                        ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/30 dark:text-primary-400' 
                        : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400'
                    }`}>
                      {t.type === 'nr' ? 'NR' : 'Curso'}
                    </span>
                    <strong className="text-sm text-slate-800 dark:text-white truncate font-extrabold">{t.name}</strong>
                  </div>
                  <div className="text-xs text-slate-400 font-medium mt-1 select-none flex flex-wrap gap-x-3 gap-y-1">
                    {t.institution && <span className="flex items-center gap-1"><span className="material-icons-outlined text-xs">business</span>{t.institution}</span>}
                    {t.certificateNumber && <span className="flex items-center gap-1"><span className="material-icons-outlined text-xs">grid_3x3</span>Reg: {t.certificateNumber}</span>}
                  </div>
                </div>

                {/* Date values */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between lg:justify-end gap-4 shrink-0 lg:w-[320px]">
                  <div className="flex flex-col text-xs sm:text-right">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">Concluído em</span>
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-bold">
                      {new Date(t.completionDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </span>
                    {t.expirationDate ? (
                      <span className={`text-[11px] font-semibold mt-1 ${
                        isExpired 
                          ? 'text-red-500' 
                          : isCritical 
                            ? 'text-orange-500' 
                            : isExpiring 
                              ? 'text-amber-500' 
                              : 'text-emerald-500'
                      }`}>
                        Venc {isExpired ? 'eu' : 'erá'} {new Date(t.expirationDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-500 font-bold mt-1 uppercase">Prazo Indeterminado</span>
                    )}
                  </div>

                  {/* Status & action buttons */}
                  <div className="flex items-center gap-2 lg:justify-end">
                    {t.expirationDate ? (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold leading-none ${
                        isExpired
                          ? 'bg-red-100 text-red-800 dark:bg-red-950/50'
                          : isCritical 
                            ? 'bg-orange-100 text-orange-850 dark:bg-orange-950/50 border border-orange-200/50'
                            : isExpiring
                              ? 'bg-amber-100 text-amber-850 dark:bg-amber-950/50 border border-amber-200/50'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30'
                      }`}>
                        <span className={`w-1 h-1 rounded-full bg-current ${isExpired || isCritical ? 'animate-pulse' : ''}`}></span>
                        {isExpired 
                          ? `Vencido há ${Math.abs(t.daysRemaining || 0)} dias` 
                          : isCritical 
                            ? `CRÍTICO (${t.daysRemaining}d)` 
                            : isExpiring 
                              ? `Em ${t.daysRemaining} dias` 
                              : `Em dia (${t.daysRemaining}d)`
                        }
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-emerald-55/10 text-emerald-600">
                        Ativo
                      </span>
                    )}

                    <div className="flex items-center ml-2 border-l border-gray-100 dark:border-white/5 pl-2 gap-1">
                      <button
                        onClick={() => handleOpenEditModal(t)}
                        title="Editar Treinamento"
                        className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                      >
                        <span className="material-icons-outlined text-sm">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteTraining(t)}
                        title="Excluir Treinamento"
                        className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 dark:text-slate-550 hover:text-red-550 transition-colors"
                      >
                        <span className="material-icons-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slide Loader / Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 w-full max-w-lg z-10 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 dark:border-white/5 flex justify-between items-center shrink-0">
              <h3 className="font-extrabold text-base text-slate-800 dark:text-white flex items-center gap-2">
                <span className="material-icons-outlined text-primary-550">assignment_turned_in</span>
                {editingTraining ? 'Editar Treinamento' : 'Cadastrar Novo Treinamento / NR'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-200">
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveTraining} className="p-5 space-y-4 overflow-y-auto">
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Colaborador</label>
                <select
                  disabled={!!editingTraining}
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none disabled:opacity-60"
                  required
                >
                  <option value="">Selecione um funcionário...</option>
                  {employees
                    .filter(emp => emp.status === 'Ativo' || emp.status === 'Férias')
                    .map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.department} - {emp.role})
                      </option>
                    ))
                  }
                </select>
              </div>

              {/* Training Type */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Tipo do Treinamento</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTrainingType('nr')}
                    className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      trainingType === 'nr'
                        ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/20 dark:text-primary-300 font-extrabold'
                        : 'border-gray-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="material-icons-outlined text-sm">gpp_maybe</span>
                    Norma Regulamentadora (NR)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrainingType('curso')}
                    className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      trainingType === 'curso'
                        ? 'border-indigo-505 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-300 font-extrabold'
                        : 'border-gray-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="material-icons-outlined text-sm">school</span>
                    Curso / Especialização
                  </button>
                </div>
              </div>

              {/* Training Name Input with suggestions if NR */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Nome do Treinamento ou Norma</label>
                  {trainingType === 'nr' && (
                    <span className="text-[10px] text-primary-500 font-bold uppercase select-none">Escolha ou digite abaixo</span>
                  )}
                </div>
                
                {trainingType === 'nr' && !editingTraining && (
                  <div className="flex flex-wrap gap-1.5 mb-2.5 max-h-[110px] overflow-y-auto p-1.5 border border-dashed border-gray-150 dark:border-white/5 rounded-lg bg-gray-50/50 dark:bg-white/5 custom-scrollbar">
                    {nrQuickOptions.map(nrOpt => {
                      const nrCode = nrOpt.split(' ')[0];
                      return (
                        <button
                          key={nrOpt}
                          type="button"
                          onClick={() => setTrainingName(nrOpt)}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition-all border ${
                            trainingName === nrOpt
                              ? 'bg-primary-500 border-primary-500 text-white'
                              : 'bg-white hover:bg-slate-100 border-gray-200 text-slate-600 dark:bg-[#252525] dark:border-white/10 dark:text-slate-300'
                          }`}
                        >
                          {nrCode}
                        </button>
                      );
                    })}
                  </div>
                )}

                <input
                  type="text"
                  value={trainingName}
                  onChange={(e) => setTrainingName(e.target.value)}
                  placeholder={trainingType === 'nr' ? 'Ex: NR-35 Trabalho em Altura' : 'Ex: Direção Defensiva, Operador de Munck, etc.'}
                  className="w-full p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none placeholder:text-slate-400 font-semibold"
                  required
                />
              </div>

              {/* Training Institution */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Instituição Emissora</label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Ex: SENAI, SEST SENAT, SEBRAE, etc."
                  className="w-full p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none placeholder:text-slate-400 font-semibold"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Data de Conclusão</label>
                  <input
                    type="date"
                    value={completionDate}
                    onChange={(e) => setCompletionDate(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Data de Validade {trainingType === 'curso' && <span className="text-[10px] text-slate-400 lowercase">(Opcional)</span>}
                  </label>
                  <input
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    required={trainingType === 'nr'}
                  />
                </div>
              </div>

              {/* Certificate Number */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Número do Certificado / Registro</label>
                <input
                  type="text"
                  value={certificateNumber}
                  onChange={(e) => setCertificateNumber(e.target.value)}
                  placeholder="Ex: CERT-99388, Registro SEST_039X"
                  className="w-full p-2.5 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none placeholder:text-slate-400 font-semibold"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-primary-650 hover:bg-primary-700 text-white rounded-xl text-xs font-black shadow-sm hover:shadow-md transition-all flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <span className="material-icons-outlined text-sm animate-spin">refresh</span>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <span className="material-icons-outlined text-sm">save</span>
                      {editingTraining ? 'Salvar Alterações' : 'Salvar Treinamento'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3 rounded-xl shadow-lg border border-slate-800 dark:border-slate-100 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 z-50">
          <span className="material-icons-outlined text-primary-500">verified</span>
          <span className="text-xs font-bold">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 dark:text-slate-500 hover:text-white dark:hover:text-slate-800 transition-colors ml-1.5">
            <span className="material-icons-outlined text-sm">close</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Trainings;
