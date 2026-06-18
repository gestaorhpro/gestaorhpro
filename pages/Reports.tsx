
import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area
} from 'recharts';
import { supabase } from '../services/supabase';

// Components
const KPICard = ({ title, value, change, icon, color }: any) => (
  <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-200 dark:border-dark-border flex items-start justify-between print:border-gray-300 print:shadow-none">
    <div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 print:text-slate-600">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-2 print:text-black">{value}</h3>
      {change !== undefined && change !== 0 && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            <span className="material-icons-outlined text-sm">{change >= 0 ? 'trending_up' : 'trending_down'}</span>
            <span>{Math.abs(change)}% vs anterior</span>
        </div>
      )}
    </div>
    <div className={`p-3 rounded-lg ${color} bg-opacity-10 dark:bg-opacity-20 print:bg-gray-100 print:text-black`}>
      <span className={`material-icons-outlined text-2xl ${color.replace('bg-', 'text-')}`}>{icon}</span>
    </div>
  </div>
);

const tooltipStyle = {
  backgroundColor: '#1e293b', 
  border: '1px solid #334155', 
  borderRadius: '8px', 
  color: '#fff',
  fontSize: '12px',
  padding: '8px 12px'
};

const Reports: React.FC = () => {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const dynamicTooltipStyle = {
    backgroundColor: isDark ? '#141c2f' : '#ffffff',
    border: `1px solid ${isDark ? '#24324c' : '#e2e8f0'}`,
    borderRadius: '8px',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontSize: '12px',
    padding: '8px 12px'
  };

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'RECRUITMENT' | 'PPE' | 'DEMOGRAPHICS' | 'TOOLS'>('OVERVIEW');
  const [selectedPeriod, setSelectedPeriod] = useState(new Date().getFullYear().toString());
  const [isLoading, setIsLoading] = useState(true);

  // States for Data
  const [stats, setStats] = useState<any>({});
  
  // Overview Data
  const [turnoverData, setTurnoverData] = useState<any[]>([]);
  const [deptData, setDeptData] = useState<any[]>([]);

  // PPE Data
  const [ppeConsumption, setPpeConsumption] = useState<any[]>([]);
  const [topPpes, setTopPpes] = useState<any[]>([]);
  const [ppeStats, setPpeStats] = useState<any>({});

  // Demographics Data
  const [ageDistribution, setAgeDistribution] = useState<any[]>([]);
  const [tenureDistribution, setTenureDistribution] = useState<any[]>([]);

  // Tools & Works Core Data
  const [tools, setTools] = useState<any[]>([]);
  const [works, setWorks] = useState<any[]>([]);
  const [employeesList, setEmployeesList] = useState<any[]>([]);

  // Selected tool filter states
  const [selectedWorkId, setSelectedWorkId] = useState<string>('ALL');
  const [toolSearchSearchTerm, setToolSearchSearchTerm] = useState<string>('');
  const [toolCategoryFilter, setToolCategoryFilter] = useState<string>('ALL');
  const [toolConditionFilter, setToolConditionFilter] = useState<string>('ALL');

  useEffect(() => {
    fetchReportData();
  }, [selectedPeriod]);

  const fetchReportData = async () => {
    setIsLoading(true);
    try {
        // 1. Fetch Employees
        const { data: employees } = await supabase.from('employees').select('*');

        // 3. Fetch PPE Data (Deliveries & Items)
        const { data: ppeDeliveries } = await supabase.from('ppe_deliveries').select('*');
        const { data: ppeItems } = await supabase.from('ppe_items').select('*');

        // Fetch Tools & Works
        const { data: dbTools } = await supabase.from('tools').select('*');
        const { data: dbWorks } = await supabase.from('works').select('*');

        if (employees) {
            setEmployeesList(employees);
        }
        if (dbTools) {
            setTools(dbTools);
        }
        if (dbWorks) {
            setWorks(dbWorks);
        }

        // --- OVERVIEW PROCESSING ---
        if (employees) {
            const total = employees.length;
            const turnoverRate = 2.5; // Mock calculation
            const absenteismo = 1.2; // Mock calculation

            setStats({
                totalEmployees: total,
                turnoverRate,
                absenteismo
            });

            // Department Distribution
            const deptMap: {[key:string]: number} = {};
            employees.forEach(e => {
                const d = e.department || 'Sem Depto';
                deptMap[d] = (deptMap[d] || 0) + 1;
            });
            const deptChart = Object.keys(deptMap).map((k, i) => ({
                name: k, 
                value: deptMap[k], 
                color: ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ea580c'][i % 5]
            })).sort((a,b) => b.value - a.value);
            setDeptData(deptChart);

            // Turnover Chart
            const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            const currentYear = parseInt(selectedPeriod);
            
            const turnoverChart = months.map((m, index) => {
                const hiredCount = employees.filter(e => {
                    if (!e.admission_date && !e.created_at) return false;
                    const d = new Date(e.admission_date || e.created_at);
                    return d.getMonth() === index && d.getFullYear() === currentYear;
                }).length;

                return {
                    name: m,
                    contratacoes: hiredCount,
                    desligamentos: Math.floor(Math.random() * 2) // Mock
                };
            });
            setTurnoverData(turnoverChart);

            // --- DEMOGRAPHICS PROCESSING ---
            const today = new Date();
            
            // Age Distribution
            const ageGroups = { '18-25': 0, '26-35': 0, '36-45': 0, '46+': 0 };
            employees.forEach(e => {
                if (e.birth_date) {
                    const birth = new Date(e.birth_date);
                    let age = today.getFullYear() - birth.getFullYear();
                    const m = today.getMonth() - birth.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
                        age--;
                    }

                    if (age <= 25) ageGroups['18-25']++;
                    else if (age <= 35) ageGroups['26-35']++;
                    else if (age <= 45) ageGroups['36-45']++;
                    else ageGroups['46+']++;
                }
            });
            setAgeDistribution(Object.keys(ageGroups).map(key => ({ name: key, value: ageGroups[key as keyof typeof ageGroups] })));

            // Tenure Distribution (Tempo de Casa)
            const tenureGroups = { '< 1 ano': 0, '1-3 anos': 0, '3-5 anos': 0, '> 5 anos': 0 };
            employees.forEach(e => {
                if (e.admission_date) {
                    const admission = new Date(e.admission_date);
                    let years = today.getFullYear() - admission.getFullYear();
                    const m = today.getMonth() - admission.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < admission.getDate())) {
                        years--;
                    }

                    if (years < 1) tenureGroups['< 1 ano']++;
                    else if (years < 3) tenureGroups['1-3 anos']++;
                    else if (years < 5) tenureGroups['3-5 anos']++;
                    else tenureGroups['> 5 anos']++;
                }
            });
            const tenureColors = ['#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8'];
            setTenureDistribution(Object.keys(tenureGroups).map((key, i) => ({ 
                name: key, 
                value: tenureGroups[key as keyof typeof tenureGroups],
                color: tenureColors[i]
            })));
        }

        // --- PPE PROCESSING ---
        if (ppeDeliveries && ppeItems) {
            // Create a map for Item Cost
            const itemCosts: {[key: number]: number} = {};
            ppeItems.forEach(i => itemCosts[i.id] = Number(i.cost || 0));

            let totalPpeCost = 0;
            let totalItemsDelivered = 0;
            const ppeByMonth: {[key: string]: number} = {};
            const ppeCountByName: {[key: string]: number} = {};

            ppeDeliveries.forEach(d => {
                const date = new Date(d.delivery_date || d.created_at);
                if (date.getFullYear() === parseInt(selectedPeriod)) {
                    const monthName = date.toLocaleDateString('pt-BR', { month: 'short' });
                    const cost = (itemCosts[d.item_id] || 0) * d.quantity;
                    
                    ppeByMonth[monthName] = (ppeByMonth[monthName] || 0) + cost;
                    ppeCountByName[d.item_name] = (ppeCountByName[d.item_name] || 0) + d.quantity;
                    
                    totalPpeCost += cost;
                    totalItemsDelivered += d.quantity;
                }
            });

            // Charts
            const ppeChart = Object.keys(ppeByMonth).map(m => ({
                name: m,
                custo: ppeByMonth[m]
            })); 
            setPpeConsumption(ppeChart);

            const topItems = Object.keys(ppeCountByName).map(k => ({
                name: k,
                quantidade: ppeCountByName[k]
            })).sort((a,b) => b.quantidade - a.quantidade).slice(0, 5);
            setTopPpes(topItems);

            setPpeStats({
                totalCost: totalPpeCost,
                totalItems: totalItemsDelivered,
                avgCostPerItem: totalItemsDelivered ? totalPpeCost / totalItemsDelivered : 0
            });
        }

    } catch (error) {
        console.error("Erro ao gerar relatórios", error);
    } finally {
        setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  if (isLoading) return <div className="p-8 text-center"><span className="material-icons-outlined animate-spin text-4xl text-primary-500">refresh</span></div>;

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Print Styles */}
      <style>{`
        @media print {
          aside, header, .print-hidden { display: none !important; }
          body { background-color: white !important; color: black !important; }
          .bg-dark-card { background-color: white !important; border: 1px solid #ddd !important; box-shadow: none !important; color: black !important; }
          .text-white { color: black !important; }
          .text-slate-400, .text-slate-500 { color: #555 !important; }
          main { width: 100% !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
          .recharts-responsive-container { width: 100% !important; }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white">Relatórios & Analytics</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Dados consolidados do sistema em tempo real.</p>
        </div>
        <div className="flex items-center gap-3">
            <select 
                value={selectedPeriod} 
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-700 dark:text-white print-hidden"
            >
                <option value="2024">2024</option>
                <option value="2025">2025</option>
            </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-dark-border overflow-x-auto no-scrollbar print-hidden">
        <nav className="flex space-x-8 min-w-max px-1" aria-label="Tabs">
          {[
            { id: 'OVERVIEW', label: 'Visão Geral', icon: 'dashboard' },
            { id: 'DEMOGRAPHICS', label: 'Demografia', icon: 'people' },
            { id: 'PPE', label: 'EPIs & Segurança', icon: 'health_and_safety' },
            { id: 'TOOLS', label: 'Controle de Ferramentais', icon: 'construction' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-300'
                }
              `}
            >
              <span className={`material-icons-outlined mr-2 text-lg ${activeTab === tab.id ? 'text-primary-500' : 'text-slate-400 group-hover:text-slate-500'}`}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* --- VISÃO GERAL --- */}
        {activeTab === 'OVERVIEW' && (
          <>
            {/* Grid ajustado para 3 colunas pois removemos o eNPS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <KPICard title="Total Colaboradores" value={stats.totalEmployees} change={0} icon="groups" color="bg-blue-500 text-blue-500" />
              <KPICard title="Taxa de Turnover" value={`${stats.turnoverRate}%`} change={0} icon="sync_alt" color="bg-orange-500 text-orange-500" />
              <KPICard title="Absenteísmo" value={`${stats.absenteismo}%`} change={0} icon="event_busy" color="bg-red-500 text-red-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-200 dark:border-dark-border print:border-gray-300">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 print:text-black">Contratações x Desligamentos ({selectedPeriod})</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={turnoverData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#24324c" : "#cbd5e1"} opacity={isDark ? 0.6 : 0.4} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: isDark ? '#94a3b8' : '#475569', fontSize: 12}} dy={10} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill: isDark ? '#94a3b8' : '#475569', fontSize: 12}} />
                      <Tooltip contentStyle={dynamicTooltipStyle} itemStyle={{ paddingBottom: 4 }} />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                      <Line type="monotone" dataKey="contratacoes" name="Contratações" stroke="#f97316" strokeWidth={3} dot={{r: 4, fill: '#f97316', strokeWidth: 2, stroke: '#fff'}} />
                      <Line type="monotone" dataKey="desligamentos" name="Desligamentos" stroke="#ef4444" strokeWidth={3} dot={{r: 4, fill: '#ef4444', strokeWidth: 2, stroke: '#fff'}} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-200 dark:border-dark-border print:border-gray-300">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 print:text-black">Distribuição por Departamento</h3>
                <div className="h-64 w-full relative">
                  {deptData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={deptData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke={isDark ? "#141c2f" : "#ffffff"} strokeWidth={2}>
                            {deptData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={dynamicTooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                  ) : (
                      <div className="flex items-center justify-center h-full text-slate-400 text-sm">Sem dados suficientes</div>
                  )}
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                     {deptData.slice(0, 5).map((d, i) => (
                       <div key={i} className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 print:text-black">
                          <span className="w-2 h-2 rounded-full" style={{backgroundColor: d.color}}></span>
                          {d.name}
                       </div>
                     ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* --- DEMOGRAFIA (Novo) --- */}
        {activeTab === 'DEMOGRAPHICS' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-200 dark:border-dark-border print:border-gray-300">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 print:text-black">Distribuição por Faixa Etária</h3>
                  <div className="h-80 w-full flex items-center justify-center">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={ageDistribution}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#24324c" : "#cbd5e1"} opacity={isDark ? 0.6 : 0.4} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: isDark ? '#94a3b8' : '#475569', fontSize: 12}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: isDark ? '#94a3b8' : '#475569', fontSize: 12}} />
                          <Tooltip cursor={{fill: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)'}} contentStyle={dynamicTooltipStyle} />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40} fill="#8b5cf6" name="Colaboradores" />
                        </BarChart>
                     </ResponsiveContainer>
                  </div>
               </div>

               <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-200 dark:border-dark-border print:border-gray-300">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 print:text-black">Tempo de Casa (Senioridade)</h3>
                  <div className="h-80 w-full relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={tenureDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke={isDark ? "#141c2f" : "#ffffff"} strokeWidth={2}>
                            {tenureDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={dynamicTooltipStyle} />
                          <Legend verticalAlign="bottom" iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                  </div>
               </div>
          </div>
        )}

        {/* --- EPIs --- */}
        {activeTab === 'PPE' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard title="Custo Total EPIs (Ano)" value={formatCurrency(ppeStats.totalCost || 0)} change={0} icon="monetization_on" color="bg-red-500 text-red-500" />
                <KPICard title="Itens Entregues" value={ppeStats.totalItems || 0} change={0} icon="inventory_2" color="bg-amber-500 text-amber-500" />
                <KPICard title="Custo Médio / Item" value={formatCurrency(ppeStats.avgCostPerItem || 0)} change={0} icon="query_stats" color="bg-blue-500 text-blue-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-200 dark:border-dark-border print:border-gray-300">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 print:text-black">Consumo Mensal de Materiais</h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={ppeConsumption}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#24324c" : "#cbd5e1"} opacity={isDark ? 0.6 : 0.4} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: isDark ? '#94a3b8' : '#475569', fontSize: 12}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: isDark ? '#94a3b8' : '#475569', fontSize: 12}} />
                                <Tooltip 
                                    contentStyle={dynamicTooltipStyle} 
                                    formatter={(value: number) => formatCurrency(value)}
                                    cursor={{fill: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)'}}
                                />
                                <Bar dataKey="custo" fill="#ef4444" radius={[4, 4, 0, 0]} name="Custo Total" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-200 dark:border-dark-border print:border-gray-300">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 print:text-black">Top 5 Itens Consumidos</h3>
                    <div className="space-y-4">
                        {topPpes.length > 0 ? topPpes.map((item, index) => (
                            <div key={index} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 print:bg-gray-200 print:text-black">
                                        {index + 1}
                                    </span>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate max-w-[150px] print:text-black" title={item.name}>{item.name}</span>
                                </div>
                                <span className="text-sm font-bold text-slate-800 dark:text-white print:text-black">{item.quantidade} un</span>
                            </div>
                        )) : (
                            <p className="text-center text-sm text-slate-400 py-8">Sem dados de consumo.</p>
                        )}
                    </div>
                </div>
            </div>
          </>
        )}

        {/* --- CONTROLE DE FERRAMENTAIS (FERRAMENTAS) --- */}
        {activeTab === 'TOOLS' && (() => {
          // Filtragem de ferramentas
          const filteredTools = tools.filter(tool => {
            if (selectedWorkId !== 'ALL') {
              if (selectedWorkId === 'ALMOXARIFADO') {
                const hasWork = tool.associatedWorkId || tool.associatedWorkName || works.some(w => w.toolIds?.includes(tool.id));
                if (hasWork) return false;
              } else {
                const targetWork = works.find(w => w.id === selectedWorkId);
                if (!targetWork) return false;
                const matchById = tool.associatedWorkId === selectedWorkId;
                const matchByName = tool.associatedWorkName === targetWork.name;
                const matchInWorkArray = targetWork.toolIds?.includes(tool.id);
                if (!matchById && !matchByName && !matchInWorkArray) return false;
              }
            }

            if (toolCategoryFilter !== 'ALL' && tool.category !== toolCategoryFilter) {
              return false;
            }

            if (toolConditionFilter !== 'ALL' && tool.condition !== toolConditionFilter) {
              return false;
            }

            if (toolSearchSearchTerm.trim() !== '') {
              const term = toolSearchSearchTerm.toLowerCase();
              const nameMatch = tool.name?.toLowerCase().includes(term);
              const snMatch = tool.serialNumber?.toLowerCase().includes(term);
              const notesMatch = tool.notes?.toLowerCase().includes(term);
              if (!nameMatch && !snMatch && !notesMatch) return false;
            }

            return true;
          });

          const totalUnits = filteredTools.reduce((sum, t) => sum + (Number(t.quantity) || 1), 0);
          const bomNovoCount = filteredTools.filter(t => t.condition === 'Novo' || t.condition === 'Bom').length;
          const regularRuimCount = filteredTools.filter(t => t.condition === 'Regular' || t.condition === 'Ruim').length;
          const assignedResponsiblesCount = Array.from(new Set(filteredTools.flatMap(t => t.responsibleEmployeeIds || []))).length;

          const currentWorkObj = selectedWorkId !== 'ALL' && selectedWorkId !== 'ALMOXARIFADO' 
            ? works.find(w => w.id === selectedWorkId) 
            : null;

          const activeTeam = currentWorkObj 
            ? employeesList.filter(emp => currentWorkObj.employeeIds?.includes(emp.id))
            : [];

          const getEmployeeName = (id: string) => {
            const found = employeesList.find(e => e.id === id);
            return found ? `${found.name} (${found.role || 'Colaborador'})` : `ID: ${id}`;
          };

          return (
            <div className="space-y-6">
              {/* Header de Documentação Exclusivo de Impressão */}
              <div className="hidden print:block border-b-2 border-slate-850 pb-4 mb-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">Gestão de RH - Canteiros de Obras</h1>
                    <p className="text-xs text-slate-500 font-mono">Emissão: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-700 bg-slate-100 border px-3 py-1 rounded">Relatório de Rastreabilidade</span>
                  </div>
                </div>
                <h2 className="text-md font-bold text-center text-slate-800 mt-6 tracking-wide uppercase border-y py-2 border-slate-200 bg-slate-50">
                  Ficha de Conferência de Ferramentais & Termo de Responsabilidade Alocados
                </h2>
                
                {/* Metadados da Obra Selecionada na Impressão */}
                {currentWorkObj ? (
                  <div className="mt-4 grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 border rounded-xl leading-relaxed">
                    <div>
                      <p className="mb-1"><span className="font-semibold text-slate-700">Canteiro de Obra:</span> {currentWorkObj.name}</p>
                      <p className="mb-1"><span className="font-semibold text-slate-700">Tipo de Projeto:</span> {currentWorkObj.type}</p>
                      <p className="mb-1"><span className="font-semibold text-slate-700">Responsável local:</span> {currentWorkObj.contactName || 'Não Informado'} ({currentWorkObj.contactPhone || 'S/N'})</p>
                    </div>
                    <div>
                      <p className="mb-1"><span className="font-semibold text-slate-700">Status Obra:</span> {currentWorkObj.status}</p>
                      <p className="mb-1"><span className="font-semibold text-slate-700">Período Previsto:</span> {currentWorkObj.startDate ? new Date(currentWorkObj.startDate).toLocaleDateString('pt-BR') : '-'} até {currentWorkObj.estimatedEndDate ? new Date(currentWorkObj.estimatedEndDate).toLocaleDateString('pt-BR') : '-'}</p>
                      <p className="mb-1"><span className="font-semibold text-slate-700">Total Equipe Canteiro:</span> {activeTeam.length} Colaboradores alocados</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-xs p-3 bg-slate-50 border rounded-xl leading-relaxed">
                    <p><span className="font-semibold">Filtro de Relatório selecionado:</span> {selectedWorkId === 'ALMOXARIFADO' ? 'Apenas Equipamentos em Estoque/Almoxarifado' : 'Visão Geral Multi-Obras (Estoque Completo)'}</p>
                  </div>
                )}
              </div>

              {/* Botão de impressão flutuante e Filtros na UI digital */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-dark-card border border-gray-150 dark:border-dark-border p-5 rounded-2xl shadow-xs print:hidden">
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5 text-base">
                    <span className="material-icons-outlined text-primary-500">filter_list</span>
                    Filtrar Canteiro de Obras & Ferramentais
                  </h3>
                  <p className="text-xs text-slate-400">Verifique os itens associados e emita o PDF para termo de responsabilidade físico de campo</p>
                </div>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white font-bold text-sm rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
                >
                  <span className="material-icons-outlined text-lg">picture_as_pdf</span>
                  Gerar PDF / Imprimir Relatório
                </button>
              </div>

              {/* Linha de Seletores de Filtros */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-dark-card border border-gray-150 dark:border-dark-border p-5 rounded-2xl shadow-xs print:hidden">
                {/* Seletor de Canteiro */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Canteiro / Localização</label>
                  <select
                    value={selectedWorkId}
                    onChange={(e) => setSelectedWorkId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-dark-border rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="ALL">Todo o Portfólio de Obras</option>
                    <option value="ALMOXARIFADO">Almoxarifado Central (Sem Obra)</option>
                    {works.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                {/* Seletor Categoria */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Categoria do Item</label>
                  <select
                    value={toolCategoryFilter}
                    onChange={(e) => setToolCategoryFilter(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-dark-border rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="ALL">Qualquer Categoria</option>
                    <option value="Ferramenta Elétrica">Ferramenta Elétrica</option>
                    <option value="Ferramenta Manual">Ferramenta Manual</option>
                    <option value="Equipamento de Proteção">Equipamento de Proteção</option>
                    <option value="Equipamento de Acesso">Equipamento de Acesso</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                {/* Seletor Conservação */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Estado de Conservação</label>
                  <select
                    value={toolConditionFilter}
                    onChange={(e) => setToolConditionFilter(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-dark-border rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="ALL">Qualquer Estado</option>
                    <option value="Novo">Novo</option>
                    <option value="Bom">Bom</option>
                    <option value="Regular">Regular</option>
                    <option value="Ruim">Ruim</option>
                  </select>
                </div>

                {/* Busca Textual */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Palavra-chave ou Série</label>
                  <div className="relative">
                    <span className="material-icons-outlined text-slate-400 absolute left-3 top-2.5 text-lg">search</span>
                    <input
                      type="text"
                      placeholder="Ex: Furadeira, CP-445..."
                      value={toolSearchSearchTerm}
                      onChange={(e) => setToolSearchSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-dark-border rounded-xl text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Informações da Equipe Ativa (Se Obra Selecionada) */}
              {currentWorkObj && activeTeam.length > 0 && (
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 border border-indigo-150 dark:border-indigo-900/30 p-5 rounded-2xl shadow-xs print:hidden">
                  <h4 className="text-sm font-bold text-indigo-800 dark:text-indigo-400 uppercase tracking-tight flex items-center gap-2 mb-3">
                    <span className="material-icons-outlined text-indigo-500 text-lg">badge</span>
                    Equipe Operacional Alocada Neste Canteiro ({activeTeam.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {activeTeam.map((emp) => (
                      <div key={emp.id} className="flex items-center gap-2.5 bg-white dark:bg-dark-card/60 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/10">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0">
                          {emp.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-150 truncate leading-tight">{emp.name}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{emp.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* KPI específico de Ferramentais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:border-y print:py-4 print:my-4 print:grid-cols-4">
                <div className="p-4 rounded-xl bg-white dark:bg-dark-card border border-gray-150 dark:border-dark-border shadow-xs flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                    <span className="material-icons-outlined text-xl">construction</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block leading-none">Total Equipamentos</span>
                    <span className="text-xl font-bold text-slate-800 dark:text-white mt-1 block">{totalUnits} un.</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-dark-card border border-gray-150 dark:border-dark-border shadow-xs flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <span className="material-icons-outlined text-xl">gavel</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block leading-none">Em Perfeito Estado</span>
                    <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">{bomNovoCount} de {filteredTools.length}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-dark-card border border-gray-150 dark:border-dark-border shadow-xs flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-red-105 bg-red-50 dark:bg-red-950/30 text-red-650 dark:text-red-400 flex items-center justify-center shrink-0">
                    <span className="material-icons-outlined text-xl text-red-500">build_circle</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block leading-none">Regular ou Ruim</span>
                    <span className="text-xl font-bold text-red-600 dark:text-red-400 mt-1 block">{regularRuimCount} itens</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-dark-card border border-gray-150 dark:border-dark-border shadow-xs flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-blue-105 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <span className="material-icons-outlined text-xl text-blue-500">assignment_ind</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block leading-none">Coparticipantes Ativos</span>
                    <span className="text-xl font-bold text-slate-800 dark:text-white mt-1 block">{assignedResponsiblesCount} guardiões</span>
                  </div>
                </div>
              </div>

              {/* Tabela de Itens */}
              <div className="bg-white dark:bg-dark-card border border-gray-150 dark:border-dark-border rounded-2xl overflow-hidden shadow-xs print:border-none print:shadow-none">
                {filteredTools.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <span className="material-icons-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">assignment_late</span>
                    <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Nenhum ferramental corresponde aos filtros</p>
                    <p className="text-xs text-slate-400 mt-1">Altere os seletores de canteiro ou filtros de busca para auditar.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900 border-b border-gray-200 dark:border-dark-border text-slate-500 uppercase tracking-wider font-bold text-[10px] print:bg-slate-100 print:text-black print:border-slate-300">
                          <th className="px-6 py-4">Equipamento / Especificação</th>
                          <th className="px-6 py-4">Categoria</th>
                          <th className="px-6 py-4 text-center">Estado</th>
                          <th className="px-6 py-4 text-center">Qtd</th>
                          <th className="px-6 py-4">Guardião(ões) Responsável(is)</th>
                          <th className="px-6 py-3">Canteiro de Destino</th>
                          <th className="px-6 py-3 text-center">Termo Resp.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-150 dark:divide-dark-border print:divide-slate-200">
                        {filteredTools.map((t) => {
                          const hasResponsibles = t.responsibleEmployeeIds && t.responsibleEmployeeIds.length > 0;
                          
                          let statusColor = 'text-slate-600 bg-slate-150 border-slate-200 dark:bg-slate-900 dark:text-slate-400';
                          if (t.condition === 'Novo') statusColor = 'text-blue-700 bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400';
                          if (t.condition === 'Bom') statusColor = 'text-green-700 bg-green-50 border-green-10 border-green-100 dark:bg-green-950/20 dark:text-green-400';
                          if (t.condition === 'Regular') statusColor = 'text-yellow-700 bg-yellow-50 border-yellow-101 border-orange-100 dark:bg-orange-950/20 dark:text-orange-400';
                          if (t.condition === 'Ruim') statusColor = 'text-red-700 bg-red-55 bg-red-50 border-red-100 dark:bg-red-950/20 dark:text-red-400';

                          return (
                            <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors leading-relaxed print:text-black print:hover:bg-transparent">
                              {/* Nome e Codigo Serie */}
                              <td className="px-6 py-4">
                                <div className="font-bold text-slate-800 dark:text-slate-150 text-sm leading-snug print:text-black">{t.name}</div>
                                {t.serialNumber && (
                                  <div className="text-[10px] font-bold font-mono text-slate-400 dark:text-slate-500 mt-1 uppercase">SÉRIE: {t.serialNumber}</div>
                                )}
                                {t.notes && (
                                  <div className="text-[10px] italic text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1 print:line-clamp-none" title={t.notes}>{t.notes}</div>
                                )}
                              </td>

                              {/* Categoria */}
                              <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-semibold print:text-black">
                                {t.category}
                              </td>

                              {/* Estado */}
                              <td className="px-6 py-4 text-center">
                                <span className={`inline-block px-2.5 py-1 text-[11px] font-bold border rounded-lg ${statusColor}`}>
                                  {t.condition}
                                </span>
                              </td>

                              {/* Quantidade */}
                              <td className="px-6 py-4 text-center font-bold text-slate-850 dark:text-white print:text-black">
                                {t.quantity || 1} un.
                              </td>

                              {/* Responsáveis Alocados */}
                              <td className="px-6 py-4">
                                {hasResponsibles ? (
                                  <div className="space-y-1">
                                    {t.responsibleEmployeeIds.map((eid: string) => (
                                      <div key={eid} className="font-bold text-slate-700 dark:text-slate-350 flex items-center gap-1 print:text-black print:text-slate-800">
                                        <span className="material-icons text-[12px] text-slate-400 print:hidden">person</span>
                                        {getEmployeeName(eid)}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-50 border border-red-100 rounded-md">
                                    Sem Guardião Definido
                                  </span>
                                )}
                              </td>

                              {/* Canteiro Destino */}
                              <td className="px-6 py-4">
                                <div className="font-bold text-slate-700 dark:text-slate-300 print:text-black">
                                  {t.associatedWorkName || 'Estoque Geral / Almoxarifado'}
                                </div>
                                {t.assignmentDate && (
                                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">Guarda desde: {new Date(t.assignmentDate).toLocaleDateString('pt-BR')}</div>
                                )}
                              </td>

                              {/* Assinatura Termo de Responsabilidade */}
                              <td className="px-6 py-4 text-center">
                                {hasResponsibles ? (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-250 rounded-md dark:bg-emerald-950/20 dark:text-emerald-400">
                                    VINCULADO
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-250 rounded-md dark:bg-amber-950/20 dark:text-amber-400 animate-pulse print:animate-none">
                                    PENDENTE
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Assinaturas físicas de campo no PDF */}
              <div className="hidden print:flex justify-around items-center pt-24 pb-8 text-xs text-slate-800">
                <div className="text-center w-5/12">
                  <div className="border-t border-slate-400 pt-2.5">
                    <p className="font-bold uppercase text-slate-800">Almoxarifado Central / Conferente</p>
                    <p className="text-[10px] text-slate-500 mt-1">Confirmo que as ferramentas acima descritas foram devidamente entregues/analisadas.</p>
                  </div>
                </div>
                <div className="text-center w-5/12">
                  <div className="border-t border-slate-400 pt-2.5">
                    <p className="font-bold uppercase text-slate-800">Representante / Supervisor da Obra</p>
                    <p className="text-[10px] text-slate-500 mt-1">Declaro estar ciente da custódia, bom estado e responsabilidade civil do ferramental.</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* --- RECRUTAMENTO DESATIVADO --- */}
        {false && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-200 dark:border-dark-border print:border-gray-300">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 print:text-black">Funil de Recrutamento (Ativos)</h3>
                  <div className="h-80 w-full flex items-center justify-center">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={[]} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                          <XAxis type="number" hide />
                          <YAxis dataKey="stage" type="category" width={90} tick={{fontSize: 12, fill: '#94a3b8'}} />
                          <Tooltip cursor={{fill: 'transparent'}} contentStyle={tooltipStyle} />
                          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24} fill="#f97316" name="Candidatos" />
                        </BarChart>
                     </ResponsiveContainer>
                  </div>
               </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
