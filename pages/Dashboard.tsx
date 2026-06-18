
import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../services/supabase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

// Interface para as solicitações de férias
interface VacationRequest {
  id: number;
  employee_name: string;
  department: string;
  start_date: string;
  end_date: string;
  status: 'Pendente' | 'Aprovado' | 'Reprovado';
}

const StatCard = ({ title, value, icon, colorClass, iconColorClass, index }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: index * 0.05, ease: "easeOut" }}
    className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border flex justify-between items-start transition-colors duration-200"
  >
    <div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
      <p className="text-3xl font-bold text-slate-800 dark:text-white mt-2">{value}</p>
    </div>
    <div className={`p-3 rounded-lg ${colorClass}`}>
      <span className={`material-icons-outlined text-2xl ${iconColorClass}`}>{icon}</span>
    </div>
  </motion.div>
);

import { Page } from '../types';

interface DashboardProps {
  setPage?: (page: Page) => void;
  onQuickAction?: (actionType: 'TOOLS' | 'WORKS' | 'VALES') => void;
}

const Dashboard: React.FC<DashboardProps> = ({ setPage, onQuickAction }) => {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const [stats, setStats] = useState({
    totalEmployees: 0,
    onVacation: 0,
    birthdays: 0,
    expiredPPE: 0,
    criticalNRs: 0
  });
  
  const [nrAlerts, setNrAlerts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [birthdayList, setBirthdayList] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [works, setWorks] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [workStatusFilter, setWorkStatusFilter] = useState<'all' | 'em_dia' | 'atrasado' | 'finalizado'>('all');
  
  // Estado mantido para cálculo de stats, mesmo sem a tabela visual
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancesMonthlyData, setAdvancesMonthlyData] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // 1. Buscar todos os colaboradores
      const { data: employees, error } = await supabase
        .from('employees')
        .select('*');

      if (error) throw error;

      // 2. Buscar solicitações de férias
      const { data: vacations, error: vacationError } = await supabase
        .from('vacation_requests')
        .select('*')
        .order('created_at', { ascending: false });

      // Se a tabela não existir ainda, apenas loga e segue vazio (para não quebrar)
      if (vacationError) console.warn("Tabela vacation_requests não encontrada ou erro:", vacationError.message);

      // Buscar Obras e Ferramentas para o widget de Performance Overview
      const { data: worksData } = await supabase.from('works').select('*');
      const { data: toolsData } = await supabase.from('tools').select('*');

      if (worksData) setWorks(worksData);
      if (toolsData) setTools(toolsData);

      if (employees) {
        const now = new Date();
        const currentMonth = now.getMonth();

        // --- KPI: Totais ---
        const total = employees.length;
        
        // Conta férias baseada nas solicitações 'Aprovado' que englobam a data de hoje (lógica simples)
        // Se a tabela não existir, usa o status do colaborador como fallback
        let vacationCount = 0;
        if (vacations) {
            vacationCount = vacations.filter((v: any) => v.status === 'Aprovado').length;
            setVacationRequests(vacations);
        } else {
            vacationCount = employees.filter(e => e.status === 'Férias').length;
        }
        
        // Aniversariantes do Mês
        const bdaysList = employees.filter(e => {
          if (!e.birth_date) return false;
          try {
            const parts = e.birth_date.split('-');
            if (parts.length >= 2) {
              const m = parseInt(parts[1], 10) - 1;
              return m === currentMonth;
            }
          } catch (err) {}
          const birth = new Date(e.birth_date);
          return birth.getMonth() === currentMonth; 
        }).sort((a, b) => {
          try {
            const dayA = parseInt(a.birth_date.split('-')[2], 10) || 0;
            const dayB = parseInt(b.birth_date.split('-')[2], 10) || 0;
            return dayA - dayB;
          } catch (err) {
            return 0;
          }
        });
        const bdays = bdaysList.length;
        setBirthdayList(bdaysList);

        // EPIs Vencidos 
        const { count: ppeCount } = await supabase.from('ppe_deliveries').select('*', { count: 'exact', head: true }).lt('expiry_date', now.toISOString());

        // Lógica de Alertas de NR (Normas Regulamentadoras) próximo do vencimento
        const todayVal = new Date();
        todayVal.setHours(0, 0, 0, 0);

        const alerts: any[] = [];
        const getCertTypeHelper = (cert: any): 'curso' | 'nr' => {
          if (cert.type === 'nr' || cert.type === 'curso') return cert.type;
          if (/nr[- ]?\d+/i.test(cert.name)) {
            return 'nr';
          }
          return 'curso';
        };

        employees.forEach((emp: any) => {
          const rawCerts = Array.isArray(emp.certifications) 
            ? emp.certifications 
            : (typeof emp.certifications === 'string' ? JSON.parse(emp.certifications) : []);
          
          if (rawCerts && Array.isArray(rawCerts)) {
            rawCerts.forEach((cert: any) => {
              if (getCertTypeHelper(cert) === 'nr' && cert.expirationDate) {
                const expDate = new Date(cert.expirationDate);
                expDate.setHours(23, 59, 59, 999);
                
                const diffTime = expDate.getTime() - todayVal.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays < 0) {
                  alerts.push({
                    id: `${emp.id}-${cert.id || Math.random()}`,
                    employeeId: emp.id,
                    employeeName: emp.name,
                    department: emp.department || 'Geral',
                    nrName: cert.name,
                    expirationDate: cert.expirationDate,
                    daysRemaining: diffDays,
                    status: 'expired'
                  });
                } else if (diffDays <= 60) {
                  alerts.push({
                    id: `${emp.id}-${cert.id || Math.random()}`,
                    employeeId: emp.id,
                    employeeName: emp.name,
                    department: emp.department || 'Geral',
                    nrName: cert.name,
                    expirationDate: cert.expirationDate,
                    daysRemaining: diffDays,
                    status: 'expiring_soon'
                  });
                }
              }
            });
          }
        });

        // Ordenar os alertas: vencidos primeiro, depois por proximidade de dias
        alerts.sort((a, b) => {
          if (a.status === b.status) {
            return a.daysRemaining - b.daysRemaining;
          }
          return a.status === 'expired' ? -1 : 1;
        });

        setNrAlerts(alerts);

        setStats({
          totalEmployees: total,
          onVacation: vacationCount,
          birthdays: bdays,
          expiredPPE: ppeCount || 0,
          criticalNRs: alerts.length
        });
        
        // --- Cálculo de Vales e Adiantamentos nos últimos 6 meses ---
        const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const nowVal = new Date();
        const initial6Months = [];
        
        for (let i = 5; i >= 0; i--) {
          const d = new Date(nowVal.getFullYear(), nowVal.getMonth() - i, 1);
          initial6Months.push({
            year: d.getFullYear(),
            month: d.getMonth(),
            name: `${MONTH_NAMES[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`,
            'Vales': 0,
            'Adiantamentos': 0,
            'Outras Deduções': 0,
            'Total': 0
          });
        }

        employees.forEach((emp: any) => {
          const rawAdvances = Array.isArray(emp.advances) 
            ? emp.advances 
            : (typeof emp.advances === 'string' && emp.advances ? JSON.parse(emp.advances) : []);
          
          if (Array.isArray(rawAdvances)) {
            rawAdvances.forEach((adv: any) => {
              if (!adv || !adv.date || !adv.amount) return;
              const advAmt = parseFloat(adv.amount) || 0;
              const advDate = new Date(adv.date + 'T12:00:00');
              if (isNaN(advDate.getTime())) return;
              
              const advYear = advDate.getFullYear();
              const advMonth = advDate.getMonth();
              
              const match = initial6Months.find(m => m.year === advYear && m.month === advMonth);
              if (match) {
                if (adv.type === 'Vale') {
                  match['Vales'] += advAmt;
                } else if (adv.type === 'Adiantamento') {
                  match['Adiantamentos'] += advAmt;
                } else {
                  match['Outras Deduções'] += advAmt;
                }
                match['Total'] += advAmt;
              }
            });
          }
        });

        setAdvancesMonthlyData(initial6Months);
      }

    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-full">
        <span className="material-icons-outlined animate-spin text-4xl text-primary-500">refresh</span>
      </div>
    );
  }

  // Preparar os dados para o gráfico de desempenho de ferramentas por obra
  const toolPerformanceData = works.map((work: any) => {
    // Filtrar as ferramentas alocadas a esta obra específica
    const allocatedTools = tools.filter((tool: any) => 
      tool.associatedWorkId === work.id || 
      (work.toolIds && work.toolIds.includes(tool.id))
    );
    
    // Sumarizar as quantidades de ferramentas alocadas
    const totalAllocated = allocatedTools.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
    
    // Ferramentas disponíveis (sem associação de obra ou cujo campo esteja limpo)
    const totalAvailable = tools
      .filter((tool: any) => !tool.associatedWorkId && !tool.associatedWorkName)
      .reduce((acc, curr) => acc + (curr.quantity || 0), 0);
      
    // Nome reduzido para não quebrar o layout do eixo X
    const displayName = work.name.length > 22 
      ? work.name.substring(0, 22) + '...' 
      : work.name;

    return {
      name: displayName,
      fullName: work.name,
      'Ferramentas Alocadas': totalAllocated,
      'Disponíveis em Estoque': totalAvailable
    };
  });

  const getWorkScheduleStats = (startDateStr: string, endDateStr: string, workStatus: string) => {
    if (!startDateStr || !endDateStr) {
      return {
        totalDays: 0,
        daysPassed: 0,
        daysRemaining: 0,
        percent: 0,
        statusLabel: 'Prazos não definidos',
        statusColor: 'slate',
        statusKey: 'em_dia'
      };
    }

    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalTime = end.getTime() - start.getTime();
    const totalDays = Math.max(1, Math.ceil(totalTime / (1000 * 60 * 60 * 24)));

    const timePassed = today.getTime() - start.getTime();
    const daysPassed = Math.max(0, Math.ceil(timePassed / (1000 * 60 * 60 * 24)));
    let percent = Math.min(100, Math.max(0, Math.round((daysPassed / totalDays) * 100)));

    if (workStatus === 'Concluído') percent = 100;

    const timeRem = end.getTime() - today.getTime();
    const daysRemaining = Math.ceil(timeRem / (1000 * 60 * 60 * 24));

    let statusLabel = 'Em Dia';
    let statusColor = 'emerald';
    let statusKey = 'em_dia';

    if (workStatus === 'Concluído') {
      statusLabel = 'Finalizado';
      statusColor = 'emerald';
      statusKey = 'finalizado';
    } else if (daysRemaining < 0) {
      statusLabel = `Atrasado em ${Math.abs(daysRemaining)} dia(s)`;
      statusColor = 'rose';
      statusKey = 'atrasado';
    } else if (workStatus === 'Pausado') {
      statusLabel = 'Pausado';
      statusColor = 'amber';
      statusKey = 'em_dia';
    } else if (daysRemaining <= 10) {
      statusLabel = `Prazo Crítico (${daysRemaining} d)`;
      statusColor = 'rose';
      statusKey = 'atrasado';
    } else {
      statusLabel = 'Em Dia';
      statusColor = 'indigo';
      statusKey = 'em_dia';
    }

    return {
      totalDays,
      daysPassed: Math.min(totalDays, daysPassed),
      daysRemaining,
      percent,
      statusLabel,
      statusColor,
      statusKey
    };
  };

  const scheduledWorks = works.map((work: any) => {
    const stats = getWorkScheduleStats(work.startDate, work.estimatedEndDate, work.status);
    return {
      ...work,
      schedule: stats
    };
  }).filter((work: any) => {
    if (workStatusFilter === 'all') return true;
    return work.schedule.statusKey === workStatusFilter;
  });

  const worksAtRisk = works.filter((w: any) => {
    if (w.status === 'Concluído') return false;
    const stats = getWorkScheduleStats(w.startDate, w.estimatedEndDate, w.status);
    return w.startDate && w.estimatedEndDate && stats.daysRemaining !== undefined && stats.daysRemaining >= 0 && stats.daysRemaining < 5;
  });
  const worksAtRiskCount = worksAtRisk.length;

  const filteredAlerts = nrAlerts.filter(alert => {
    if (searchTerm.trim() !== '') {
      const searchLower = searchTerm.toLowerCase();
      const matchName = alert.employeeName.toLowerCase().includes(searchLower);
      const matchNR = alert.nrName.toLowerCase().includes(searchLower);
      const matchDept = alert.department.toLowerCase().includes(searchLower);
      return matchName || matchNR || matchDept;
    }
    
    return true;
  });

  const filteredBirthdays = birthdayList.filter(emp => {
    if (searchTerm.trim() !== '') {
      const searchLower = searchTerm.toLowerCase();
      const matchName = emp.name.toLowerCase().includes(searchLower);
      const matchDept = (emp.department || '').toLowerCase().includes(searchLower);
      const matchRole = (emp.role || '').toLowerCase().includes(searchLower);
      return matchName || matchDept || matchRole;
    }
    
    return true;
  });

  const handleEmailNotification = (emp: any) => {
    try {
      const emailSubject = `Feliz Aniversário, ${emp.name}! 🎂🎈`;
      const emailBody = `Olá, ${emp.name}!\n\nDesejamos-lhe um dia maravilhoso, de muita alegria, saúde e realizações. É com grande orgulho que temos você em nossa equipe!\n\nParabéns pelo seu dia! 🎉🥳\n\nAtenciosamente,\nGestão de Pessoas`;
      
      navigator.clipboard.writeText(emailBody);
      setToastMessage(`E-mail de aniversário preparado para ${emp.name}! Texto de parabenização copiado para a área de transferência.`);
      setTimeout(() => {
        setToastMessage(null);
      }, 5000);
    } catch (err) {
      setToastMessage(`Iniciando envio de e-mail de parabenização para ${emp.name}...`);
      setTimeout(() => {
        setToastMessage(null);
      }, 4000);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-1">Painel de Controle Principal</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Visão integrada de canteiros, colaboradores e conformidades.</p>
        </div>
      </div>

      {/* SEÇÃO DE ACESSO RÁPIDO */}
      <div className="space-y-3">
        <span className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-1.5 ml-1">
          <span className="material-icons-outlined text-xs">bolt</span>
          Ações Rápidas de Alta Frequência
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Card 1: Cadastrar Novo Colaborador */}
          <button
            type="button"
            onClick={() => setPage && setPage(Page.EMPLOYEE_FORM)}
            className="bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-150/50 dark:border-white/5 text-left hover:border-indigo-500/80 dark:hover:border-indigo-400/80 hover:shadow-xs transition-all hover:scale-[1.015] flex items-center gap-4 cursor-pointer group"
          >
            <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-2xs">
              <span className="material-icons-outlined text-2xl">person_add_alt</span>
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-800 dark:text-gray-100 uppercase tracking-tight">Novo Colaborador</h4>
              <p className="text-[10px] text-slate-450 dark:text-slate-500 mt-0.5 font-medium leading-tight">Cadastrar dados de RH e admissão</p>
            </div>
          </button>

          {/* Card 2: Alocar Ferramental */}
          <button
            type="button"
            onClick={() => {
              if (setPage) {
                setPage(Page.TOOLS);
                if (onQuickAction) onQuickAction('TOOLS');
              }
            }}
            className="bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-150/50 dark:border-white/5 text-left hover:border-emerald-500/80 dark:hover:border-emerald-400/80 hover:shadow-xs transition-all hover:scale-[1.015] flex items-center gap-4 cursor-pointer group"
          >
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-2xs">
              <span className="material-icons-outlined text-2xl">handyman</span>
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-800 dark:text-gray-100 uppercase tracking-tight">Alocar Ferramental</h4>
              <p className="text-[10px] text-slate-450 dark:text-slate-500 mt-0.5 font-medium leading-tight">Atribuir ferramentas a obras</p>
            </div>
          </button>

          {/* Card 3: Registrar Vales */}
          <button
            type="button"
            onClick={() => {
              if (setPage) {
                setPage(Page.EMPLOYEES);
                if (onQuickAction) onQuickAction('VALES');
              }
            }}
            className="bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-150/50 dark:border-white/5 text-left hover:border-amber-500/80 dark:hover:border-amber-400/80 hover:shadow-xs transition-all hover:scale-[1.015] flex items-center gap-4 cursor-pointer group"
          >
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition-all shadow-2xs">
              <span className="material-icons-outlined text-2xl">payments</span>
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-800 dark:text-gray-100 uppercase tracking-tight">Registrar Vales</h4>
              <p className="text-[10px] text-slate-450 dark:text-slate-500 mt-0.5 font-medium leading-tight">Lançar adiantamentos ou vales</p>
            </div>
          </button>

          {/* Card 4: Nova Obra */}
          <button
            type="button"
            onClick={() => {
              if (setPage) {
                setPage(Page.WORKS);
                if (onQuickAction) onQuickAction('WORKS');
              }
            }}
            className="bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-150/50 dark:border-white/5 text-left hover:border-violet-500/80 dark:hover:border-violet-400/80 hover:shadow-xs transition-all hover:scale-[1.015] flex items-center gap-4 cursor-pointer group"
          >
            <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 group-hover:bg-violet-600 group-hover:text-white transition-all shadow-2xs">
              <span className="material-icons-outlined text-2xl">engineering</span>
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-800 dark:text-gray-100 uppercase tracking-tight">Cadastrar Nova Obra</h4>
              <p className="text-[10px] text-slate-450 dark:text-slate-500 mt-0.5 font-medium leading-tight">Abrir projeto ou canteiro de campo</p>
            </div>
          </button>

          {/* Card 5: Fotos do Canteiro */}
          <button
            type="button"
            onClick={() => {
              if (setPage) {
                setPage(Page.PHOTOS);
                if (onQuickAction) onQuickAction('PHOTOS');
              }
            }}
            className="bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-150/50 dark:border-white/5 text-left hover:border-cyan-500/80 dark:hover:border-cyan-400/80 hover:shadow-xs transition-all hover:scale-[1.015] flex items-center gap-4 cursor-pointer group"
          >
            <div className="p-3 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 group-hover:bg-cyan-600 group-hover:text-white transition-all shadow-2xs">
              <span className="material-icons-outlined text-2xl">photo_camera</span>
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-800 dark:text-gray-100 uppercase tracking-tight">Fotos do Canteiro</h4>
              <p className="text-[10px] text-slate-450 dark:text-slate-500 mt-0.5 font-medium leading-tight">Visualizar e cadastrar fotos diárias</p>
            </div>
          </button>
        </div>
      </div>


      {/* Busca Rápida Global de Colaboradores / Departamentos */}
      <div className="bg-white dark:bg-dark-card p-4 rounded-xl shadow-xs border border-gray-100 dark:border-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
            <span className="material-icons-outlined text-xl">person_search</span>
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-slate-800 dark:text-white">Filtro Rápido do Dashboard</h4>
            <p className="text-xs text-slate-400">Filtre alertas de NR e aniversariantes por nome ou departamento em tempo real</p>
          </div>
        </div>
        <div className="w-full sm:w-80 md:w-96 relative">
          <span className="material-icons-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Digite o nome ou departamento..."
            className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all placeholder:text-slate-400 font-medium"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center"
            >
              <span className="material-icons-outlined text-base">close</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <StatCard 
          title="Total de Colaboradores" 
          value={stats.totalEmployees} 
          icon="groups" 
          colorClass="bg-blue-50 dark:bg-blue-900/20" 
          iconColorClass="text-blue-500" 
          index={0}
        />
        <StatCard 
          title="Férias Aprovadas" 
          value={stats.onVacation} 
          icon="beach_access" 
          colorClass="bg-green-50 dark:bg-green-900/20" 
          iconColorClass="text-green-500" 
          index={1}
        />
        <StatCard 
          title="Aniversariantes do Mês" 
          value={stats.birthdays} 
          icon="cake" 
          colorClass="bg-pink-50 dark:bg-pink-900/20" 
          iconColorClass="text-pink-500" 
          index={2}
        />
        <StatCard 
          title="EPIs Vencidos" 
          value={stats.expiredPPE} 
          icon="warning_amber" 
          colorClass="bg-yellow-50 dark:bg-yellow-900/20" 
          iconColorClass="text-yellow-500" 
          index={3}
        />
        <StatCard 
          title="NRs Críticas / Vencidas" 
          value={stats.criticalNRs} 
          icon="gpp_maybe" 
          colorClass={stats.criticalNRs > 0 ? "bg-red-50 dark:bg-red-900/25" : "bg-emerald-50 dark:bg-emerald-900/20"} 
          iconColorClass={stats.criticalNRs > 0 ? "text-red-500" : "text-emerald-500"} 
          index={4}
        />
        <StatCard 
          title="Risco de Prazo (<5d)" 
          value={worksAtRiskCount} 
          icon="report_problem" 
          colorClass={worksAtRiskCount > 0 ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 font-bold text-amber-600 animate-pulse" : "bg-slate-50 dark:bg-white/5"} 
          iconColorClass={worksAtRiskCount > 0 ? "text-amber-500 animate-bounce" : "text-slate-400"} 
          index={5}
        />
      </div>

      {/* NOVO WIDGET: Performance Overview de Ferramental */}
      <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border transition-all duration-200">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined text-indigo-500 text-2xl">troubleshoot</span>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Performance Overview de Ferramental</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Visão geral comparativa do total de ferramentas alocadas no canteiro de cada obra ativa versus o total disponível atualmente em estoque.
            </p>
          </div>
          
          {/* Métricas rápidas */}
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1.5 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-lg flex items-center gap-1 border border-gray-100 dark:border-white/5">
              <span className="material-icons-outlined text-xs text-indigo-500">handyman</span>
              Total Geral de Equipamentos: <strong className="text-slate-800 dark:text-white">{tools.reduce((acc, curr) => acc + (curr.quantity || 0), 0)}</strong>
            </span>
            <span className="px-3 py-1.5 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-lg flex items-center gap-1 border border-indigo-100/50 dark:border-indigo-950/20">
              <span className="material-icons-outlined text-xs">local_shipping</span>
              Alocados em Obras: <strong className="text-indigo-800 dark:text-indigo-300">{tools.filter(t => t.associatedWorkId || t.associatedWorkName).reduce((acc, curr) => acc + (curr.quantity || 0), 0)}</strong>
            </span>
            <span className="px-3 py-1.5 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-lg flex items-center gap-1 border border-emerald-100/50 dark:border-emerald-950/20">
              <span className="material-icons-outlined text-xs">inventory_2</span>
              Estoque Disponível: <strong className="text-emerald-800 dark:text-emerald-300">{tools.filter(t => !t.associatedWorkId && !t.associatedWorkName).reduce((acc, curr) => acc + (curr.quantity || 0), 0)}</strong>
            </span>
          </div>
        </div>

        {toolPerformanceData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
            <span className="material-icons-outlined text-5xl mb-2 text-slate-350 dark:text-slate-600 animate-pulse">construction</span>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nenhum canteiro de obra ou ferramenta cadastrada</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Cadastre suas obras na seção correspondente e associe as ferramentas disponíveis para visualizar este gráfico comparativo de desempenho com o Recharts.
            </p>
          </div>
        ) : (
          <div className="w-full h-[340px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={toolPerformanceData}
                margin={{ top: 20, right: 35, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#24324c" : "#cbd5e1"} opacity={isDark ? 0.6 : 0.4} vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke={isDark ? "#4b5563" : "#cbd5e1"} 
                  tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#475569' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke={isDark ? "#4b5563" : "#cbd5e1"} 
                  tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#475569' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: isDark ? '#141c2f' : '#ffffff',
                    border: `1px solid ${isDark ? '#24324c' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    color: isDark ? '#f8fafc' : '#0f172a',
                    fontSize: '11px',
                    padding: '8px 12px'
                  }}
                  cursor={{ fill: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)' }}
                  separator=": "
                  labelFormatter={(value, items) => {
                    const originalObj = items[0]?.payload;
                    return originalObj ? originalObj.fullName : value;
                  }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  iconType="circle"
                  iconSize={10}
                  wrapperStyle={{
                    fontSize: '11px',
                    fontWeight: 500,
                    paddingBottom: '10px'
                  }}
                />
                <Bar 
                  dataKey="Ferramentas Alocadas" 
                  fill="#6366f1" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={45}
                />
                <Bar 
                  dataKey="Disponíveis em Estoque" 
                  fill="#10b981" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={45} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* NOVO WIDGET: Gráfico de Vales & Adiantamentos Mensal */}
      <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border transition-all duration-200">
        <div className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined text-amber-500 text-2xl font-bold">payments</span>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Fluxo de Caixa: Vales & Adiantamentos</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Visualização integrada do volume de adiantamentos salariais, vales e outras deduções concedidas mensalmente aos colaboradores nos últimos 6 meses.
            </p>
          </div>
          
          {/* Métricas rápidas consolidando o período */}
          <div className="flex flex-wrap gap-2 text-xs">
            <div className="px-3 py-1.5 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 font-semibold rounded-lg border border-amber-100/50 dark:border-amber-900/10">
              Vales: <strong className="text-slate-800 dark:text-white">R$ {advancesMonthlyData.reduce((acc, curr) => acc + (curr['Vales'] || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div className="px-3 py-1.5 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 font-semibold rounded-lg border border-blue-100/50 dark:border-blue-900/10">
              Adiantamentos: <strong className="text-slate-800 dark:text-white">R$ {advancesMonthlyData.reduce((acc, curr) => acc + (curr['Adiantamentos'] || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div className="px-3 py-1.5 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-semibold rounded-lg border border-gray-100 dark:border-white/5">
              Outras Deduções: <strong className="text-slate-800 dark:text-white">R$ {advancesMonthlyData.reduce((acc, curr) => acc + (curr['Outras Deduções'] || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-bold rounded-lg border border-emerald-100/50 dark:border-emerald-900/20 shadow-2xs">
              Total Geral: <strong className="text-slate-900 dark:text-white">R$ {advancesMonthlyData.reduce((acc, curr) => acc + (curr['Total'] || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>
        </div>

        {advancesMonthlyData.reduce((acc, curr) => acc + (curr['Total'] || 0), 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-405 bg-slate-50/20 dark:bg-white/5 border border-dashed border-gray-150 dark:border-white/5 rounded-xl">
            <span className="material-icons-outlined text-5xl mb-2 text-slate-350 dark:text-slate-600 animate-pulse">query_stats</span>
            <p className="text-sm font-semibold text-slate-750 dark:text-slate-300 font-bold">Nenhum vale ou adiantamento registrado nos últimos 6 meses</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Conceda vales e adiantamentos diretamente na lista ou ficha de colaboradores para alimentar este indicador de fluxo de caixa.
            </p>
          </div>
        ) : (
          <div className="w-full h-[340px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={advancesMonthlyData}
                margin={{ top: 20, right: 35, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#24324c" : "#cbd5e1"} opacity={isDark ? 0.6 : 0.4} vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke={isDark ? "#4b5563" : "#cbd5e1"} 
                  tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#475569' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke={isDark ? "#4b5563" : "#cbd5e1"} 
                  tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#475569' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `R$ ${val}`}
                />
                <Tooltip 
                  formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 })}`]}
                  contentStyle={{
                    backgroundColor: isDark ? '#141c2f' : '#ffffff',
                    border: `1px solid ${isDark ? '#24324c' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    color: isDark ? '#f8fafc' : '#0f172a',
                    fontSize: '11px',
                    padding: '8px 12px'
                  }}
                  cursor={{ fill: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)' }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  iconType="circle"
                  iconSize={10}
                  wrapperStyle={{
                    fontSize: '11px',
                    fontWeight: 500,
                    paddingBottom: '10px'
                  }}
                />
                <Bar 
                  dataKey="Vales" 
                  stackId="a"
                  fill="#f59e0b" 
                  radius={[0, 0, 0, 0]} 
                  maxBarSize={45}
                />
                <Bar 
                  dataKey="Adiantamentos" 
                  stackId="a"
                  fill="#3b82f6" 
                  radius={[0, 0, 0, 0]} 
                  maxBarSize={45}
                />
                <Bar 
                  dataKey="Outras Deduções" 
                  stackId="a"
                  fill="#94a3b8" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={45}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* NOVO WIDGET: Cronograma de Obras */}
      <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border transition-all duration-200">
        <div className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined text-indigo-500 text-2xl">date_range</span>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Cronograma & Fluxo de Obras</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Acompanhamento cronológico do cronograma contratual com indicadores visuais de progresso de tempo e prazos.
            </p>
          </div>

          {/* Filtros de cronograma */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 dark:bg-white/5 p-1 rounded-lg border border-gray-150/50 dark:border-white/5 self-start lg:self-center">
            <button
              onClick={() => setWorkStatusFilter('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                workStatusFilter === 'all'
                  ? 'bg-white dark:bg-dark-card text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Todos ({works.length})
            </button>
            <button
              onClick={() => setWorkStatusFilter('em_dia')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                workStatusFilter === 'em_dia'
                  ? 'bg-white dark:bg-dark-card text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Em Dia ({works.filter(w => getWorkScheduleStats(w.startDate, w.estimatedEndDate, w.status).statusKey === 'em_dia').length})
            </button>
            <button
              onClick={() => setWorkStatusFilter('atrasado')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                workStatusFilter === 'atrasado'
                  ? 'bg-white dark:bg-dark-card text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Atrasados / Críticos ({works.filter(w => getWorkScheduleStats(w.startDate, w.estimatedEndDate, w.status).statusKey === 'atrasado').length})
            </button>
            <button
              onClick={() => setWorkStatusFilter('finalizado')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                workStatusFilter === 'finalizado'
                  ? 'bg-white dark:bg-dark-card text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Concluídos ({works.filter(w => getWorkScheduleStats(w.startDate, w.estimatedEndDate, w.status).statusKey === 'finalizado').length})
            </button>
          </div>
        </div>

        {/* INDICADOR VISUAL: Alertas de Risco de Prazo (< 5 dias) */}
        {worksAtRiskCount > 0 && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <span className="material-icons-outlined text-amber-600 dark:text-amber-400 text-2xl shrink-0 animate-bounce">warning</span>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-850 dark:text-amber-300 flex items-center gap-1.5 flex-wrap">
                Risco de Prazo Detectado
                <span className="bg-amber-500 text-white rounded-full px-2 py-0.5 text-[10px] uppercase font-black tracking-wider animate-pulse">
                  {worksAtRiskCount} {worksAtRiskCount === 1 ? 'Obra em Atenção' : 'Obras em Atenção'}
                </span>
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                As seguintes frentes de serviço estão a menos de 5 dias do encerramento estimado e precisam de acompanhamento prioritário:
              </p>
              <div className="flex flex-wrap gap-2 mt-2 pt-1">
                {worksAtRisk.map((w: any) => {
                  const stats = getWorkScheduleStats(w.startDate, w.estimatedEndDate, w.status);
                  return (
                    <div key={w.id} className="px-2.5 py-1.5 bg-white dark:bg-dark-card text-slate-800 dark:text-slate-200 border border-amber-200/60 dark:border-amber-900/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                      <strong className="text-slate-850 dark:text-white font-black">{w.name}</strong>
                      <span className="text-slate-400">|</span>
                      <span className="text-amber-700 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-1 py-0.5 rounded">
                        {stats.daysRemaining === 0 ? 'Prazo vence hoje!' : `Faltam ${stats.daysRemaining} d`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {scheduledWorks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 border border-dashed border-gray-200 dark:border-white/5 rounded-xl">
            <span className="material-icons-outlined text-4xl mb-2 text-slate-300 dark:text-slate-700 animate-pulse">calendar_today</span>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nenhum cronograma nesta seleção</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Cadastre e atualize as datas das obras na tela correspondente para preencher o cronograma ativo.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scheduledWorks.map((work: any) => {
              const stats = work.schedule;
              const isAtDeadlineRisk = work.status !== 'Concluído' && work.startDate && work.estimatedEndDate && stats.daysRemaining !== undefined && stats.daysRemaining >= 0 && stats.daysRemaining < 5;
              
              // Determina as cores CSS baseadas nos status
              let progressColor = 'bg-indigo-500';
              let progressTrackColor = 'bg-indigo-100 dark:bg-indigo-950/20';
              let badgeColor = 'bg-indigo-50 text-indigo-750 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/30';
              
              if (isAtDeadlineRisk) {
                progressColor = 'bg-amber-500 animate-pulse';
                progressTrackColor = 'bg-amber-100 dark:bg-amber-950/25';
                badgeColor = 'bg-amber-500 text-white font-extrabold border border-amber-600 shadow-xs flex items-center gap-1';
              } else if (stats.statusColor === 'emerald') {
                progressColor = 'bg-emerald-500';
                progressTrackColor = 'bg-emerald-100 dark:bg-emerald-950/20';
                badgeColor = 'bg-emerald-50 text-emerald-750 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30';
              } else if (stats.statusColor === 'rose') {
                progressColor = 'bg-rose-500 animate-pulse';
                progressTrackColor = 'bg-rose-100 dark:bg-rose-950/20';
                badgeColor = 'bg-rose-50 text-rose-750 dark:bg-rose-950/45 dark:text-rose-300 border border-rose-150 dark:border-rose-900/30';
              } else if (stats.statusColor === 'amber') {
                progressColor = 'bg-amber-500';
                progressTrackColor = 'bg-amber-100 dark:bg-amber-950/20';
                badgeColor = 'bg-amber-50 text-amber-750 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-100 dark:border-amber-900/10';
              }

              return (
                <div 
                  key={work.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between transition-all duration-200 group hover:scale-[1.005] ${
                    isAtDeadlineRisk 
                      ? 'bg-amber-50/[0.12] dark:bg-amber-950/[0.06] border-amber-400 dark:border-amber-500/60 ring-1 ring-amber-400/20 shadow-md shadow-amber-500/[0.02]' 
                      : 'bg-slate-50/40 dark:bg-white/[0.01] border-gray-150/65 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.03] hover:shadow-xs'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header do card de cronograma */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block">
                          {work.type}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-0.5 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-405 transition-colors flex items-center gap-1.5">
                          {isAtDeadlineRisk && (
                            <span className="material-icons-outlined text-amber-500 text-base shrink-0 animate-pulse" title="Risco de Prazo (< 5 dias restantes!)">warning</span>
                          )}
                          {work.name}
                        </h4>
                      </div>
                      <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-lg shrink-0 ${badgeColor}`}>
                        {isAtDeadlineRisk && <span className="material-icons text-[10px] animate-pulse">report_problem</span>}
                        {isAtDeadlineRisk ? 'Risco < 5d' : stats.statusLabel}
                      </span>
                    </div>

                    {/* Barra de progresso */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Prazo Decorrido</span>
                        <span className="text-slate-700 dark:text-slate-200">{stats.percent}%</span>
                      </div>
                      <div className={`w-full h-2 rounded-full ${progressTrackColor} overflow-hidden`}>
                        <div 
                          className={`h-full rounded-full transition-all duration-550 ${progressColor}`}
                          style={{ width: `${stats.percent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Datas de início e término e totalizadores */}
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-gray-150/45 dark:border-white/5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <span className="material-icons-outlined text-xs text-indigo-500">play_circle_filled</span>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase tracking-wide block font-bold">Início</span>
                        <span className="font-bold text-slate-700 dark:text-slate-350">
                          {new Date(work.startDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-icons-outlined text-xs text-emerald-500">flag</span>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase tracking-wide block font-bold">Est. Conclusão</span>
                        <span className="font-bold text-slate-700 dark:text-slate-350">
                          {new Date(work.estimatedEndDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Alertas de Normas Regulamentadoras (NR) */}
      <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border transition-colors duration-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined text-red-500 text-2xl">gpp_maybe</span>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Central de Monitoramento de NRs</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Colaboradores com treinamentos de NR vencidos ou que expiram nos próximos 60 dias. Use esta central para providenciar as reciclagens.
            </p>
          </div>
        </div>

        {/* Painel de Resumos de NRs */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="bg-slate-50/70 dark:bg-white/5 p-4 rounded-xl border border-gray-150 dark:border-white/5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wider block">Vencimentos Pendentes</span>
              <span className="text-2xl font-black text-slate-800 dark:text-white">{nrAlerts.length}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">Total de pendências para ação</span>
            </div>
            <div className="p-3 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400">
              <span className="material-icons-outlined text-2xl">pending_actions</span>
            </div>
          </div>

          <div className="bg-red-50/40 dark:bg-red-950/10 p-4 rounded-xl border border-red-100/80 dark:border-red-900/20 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-red-600/90 dark:text-red-400 uppercase tracking-wider block">Treinamentos Vencidos</span>
              <span className="text-2xl font-black text-red-600 dark:text-red-400">
                {nrAlerts.filter(a => a.status === 'expired').length}
              </span>
              <span className="text-xs text-red-500/80 dark:text-red-400/80 block mt-0.5 font-medium">Requer reciclagem imediata</span>
            </div>
            <div className="p-3 rounded-full bg-red-100/50 dark:bg-red-950/30 text-red-500 dark:text-red-400 animate-pulse">
              <span className="material-icons-outlined text-2xl">cancel</span>
            </div>
          </div>

          <div className="bg-amber-50/40 dark:bg-amber-950/10 p-4 rounded-xl border border-amber-100/80 dark:border-amber-900/20 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-amber-600/90 dark:text-amber-400 uppercase tracking-wider block">Críticos (Até 60 dias)</span>
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {nrAlerts.filter(a => a.status === 'expiring_soon').length}
              </span>
              <span className="text-xs text-amber-550/80 dark:text-amber-400/80 block mt-0.5 font-medium">Agendar treinamentos em breve</span>
            </div>
            <div className="p-3 rounded-full bg-amber-100/50 dark:bg-amber-950/30 text-amber-500 dark:text-amber-400">
              <span className="material-icons-outlined text-2xl">hourglass_empty</span>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="relative">
            <span className="material-icons-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Pesquisar por colaborador, norma (ex: NR-35) ou departamento..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-white/5 text-slate-800 dark:text-white text-sm focus:ring-1 focus:ring-primary-500 focus:outline-none"
            />
          </div>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-gray-200 dark:border-white/10 text-center bg-slate-50/55 dark:bg-white/5">
            <span className="material-icons-outlined text-4xl text-emerald-500 mb-2">check_circle</span>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Tudo em dia!</p>
            <p className="text-xs text-slate-400 mt-1">Nenhum alerta de NR nesta seleção de filtros.</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredAlerts.map(alert => {
              const isExpired = alert.status === 'expired';
              return (
                <div 
                  key={alert.id} 
                  className={`flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border transition-all hover:scale-[1.005] hover:shadow-xs gap-4 ${
                    isExpired 
                      ? 'bg-red-50/20 dark:bg-red-950/10 border-red-100/70 dark:border-red-900/15' 
                      : 'bg-amber-50/20 dark:bg-amber-950/10 border-amber-100/70 dark:border-amber-900/15'
                  }`}
                >
                  {/* Left Side: Collaborator and Norma details */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shrink-0 shadow-sm ${
                      isExpired 
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' 
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    }`}>
                      {alert.employeeName.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100 truncate">
                          {alert.employeeName}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 border border-gray-200/50 dark:border-white/5 uppercase shrink-0">
                          {alert.department}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <span className="material-icons-outlined text-xs text-slate-400">gpp_maybe</span>
                        <span>Norma Regulamentadora: <strong className="text-slate-800 dark:text-white">{alert.nrName}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Expiry details and state badge */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between md:justify-end gap-4 md:gap-8 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-gray-150/10 dark:border-white/5">
                    <div className="flex flex-col text-xs md:text-right">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                        Vencimento do Treinamento
                      </span>
                      <span className={`text-sm mt-0.5 ${isExpired ? 'text-red-600 dark:text-red-400 font-extrabold' : 'text-slate-700 dark:text-slate-200 font-bold'}`}>
                        {new Date(alert.expirationDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                      </span>
                      <span className="text-slate-450 dark:text-slate-400 text-[11px] mt-0.5">
                        {isExpired 
                          ? `Venceu há ${Math.abs(alert.daysRemaining)} dia${Math.abs(alert.daysRemaining) > 1 ? 's' : ''}`
                          : `Vencerá em ${alert.daysRemaining} dia${alert.daysRemaining > 1 ? 's' : ''}`
                        }
                      </span>
                    </div>

                    <div className="flex items-center md:justify-end">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold leading-none shadow-sm ${
                        isExpired
                          ? 'bg-red-100 text-red-850 dark:bg-red-950/50 dark:text-red-300 border border-red-200/50 dark:border-red-900/30'
                          : 'bg-amber-100 text-amber-850 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/50 dark:border-amber-900/30'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full bg-current ${isExpired ? 'animate-pulse' : ''}`}></span>
                        {isExpired ? 'Treinamento Vencido' : 'Prazo Crítico'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Aniversariantes do Mês Vigente */}
      <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border transition-all hover:shadow-md">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined text-pink-500 text-2xl animate-pulse">cake</span>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Aniversariantes do Mês</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Colaboradores que comemoram ano de vida no mês vigente.
            </p>
          </div>
          <div className="bg-pink-50 dark:bg-pink-950/20 text-pink-600 dark:text-pink-400 px-3 py-1.5 rounded-lg text-xs font-bold border border-pink-150 dark:border-pink-900/30 flex items-center gap-1">
            <span className="material-icons-outlined text-sm">celebration</span>
            Total de comemorações este mês: <strong>{birthdayList.length}</strong>
          </div>
        </div>

        {filteredBirthdays.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
            <span className="material-icons-outlined text-5xl mb-2 text-slate-350 dark:text-slate-600">celebration</span>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Nenhum aniversariante encontrado</p>
            <p className="text-xs text-slate-400 mt-1">Nenhum colaborador com o critério de busca faz aniversário este mês.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredBirthdays.map((emp, index) => {
              let displayDay = '';
              try {
                const parts = emp.birth_date.split('-');
                if (parts.length >= 3) {
                  displayDay = `${parts[2]}/${parts[1]}`;
                } else {
                  const d = new Date(emp.birth_date);
                  displayDay = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
                }
              } catch (e) {
                displayDay = '--/--';
              }

              return (
                <div key={emp.id || index} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-gray-150/50 dark:border-white/5 transition-all hover:scale-[1.02] hover:bg-white dark:hover:bg-white/10 hover:shadow-sm">
                  <div className="flex items-center gap-3 min-w-0 font-medium">
                    <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 flex items-center justify-center font-bold text-xs shrink-0 border border-pink-200/50 dark:border-pink-800/20 shadow-sm">
                      {emp.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{emp.name}</span>
                        <a
                          href={`mailto:${emp.email || ''}?subject=${encodeURIComponent(`Feliz Aniversário, ${emp.name}! 🎂🎈`)}&body=${encodeURIComponent(`Olá, ${emp.name}!\n\nDesejamos-lhe um dia maravilhoso, de muita alegria, saúde e realizações. É com grande orgulho que temos você em nossa equipe!\n\nParabéns pelo seu dia! 🎉🥳\n\nAtenciosamente,\nGestão de Pessoas`)}`}
                          onClick={() => handleEmailNotification(emp)}
                          title="Enviar e-mail de parabenização padrão"
                          className="hover:scale-110 text-pink-500 hover:text-pink-600 dark:text-pink-400 dark:hover:text-pink-300 transition-all flex items-center p-0.5 rounded-full hover:bg-pink-100/30 dark:hover:bg-white/5 cursor-pointer shrink-0"
                        >
                          <span className="material-icons-outlined text-sm">forward_to_inbox</span>
                        </a>
                      </div>
                      <span className="block text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{emp.role || emp.department || 'Colaborador'}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1 bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 px-2 py-1 rounded-md text-xs font-black border border-pink-200/30 dark:border-pink-900/10 shadow-sm">
                      <span className="material-icons-outlined text-xs">cake</span>
                      {displayDay}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3 rounded-xl shadow-lg border border-slate-800 dark:border-slate-100 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 z-50">
          <span className="material-icons-outlined text-pink-500">celebration</span>
          <span className="text-xs font-bold">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 dark:text-slate-500 hover:text-white dark:hover:text-slate-800 transition-colors ml-1.5">
            <span className="material-icons-outlined text-sm">close</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
