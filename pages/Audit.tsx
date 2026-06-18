import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface AuditLog {
  id: string;
  action_type: string;
  description: string;
  performed_by: string;
  created_at: string;
  details?: Record<string, any>;
}

const ACTION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  SALARY_UPDATE: { label: 'Ajuste de Salário', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30', icon: 'payments' },
  TRANSFER_COLLABORATOR: { label: 'Transferência', color: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30', icon: 'swap_horiz' },
  WORK_CREATE: { label: 'Nova Obra', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-100 dark:border-blue-900/30', icon: 'add_business' },
  WORK_DELETE: { label: 'Exclusão de Obra', color: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-100 dark:border-red-900/30', icon: 'delete_sweep' },
  WORK_STATUS_UPDATE: { label: 'Status de Obra', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-100 dark:border-amber-900/30', icon: 'sync' },
  EMPLOYEE_CREATE: { label: 'Novo Colaborador', color: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400 border-teal-100 dark:border-teal-900/30', icon: 'person_add' },
  EMPLOYEE_UPDATE: { label: 'Edição de Perfil', color: 'bg-slate-50 text-slate-700 dark:bg-slate-950/40 dark:text-slate-400 border-slate-100 dark:border-slate-900/30', icon: 'manage_accounts' },
  EMPLOYEE_DELETE: { label: 'Exclusão de Func.', color: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-100 dark:border-red-900/30', icon: 'person_remove' },
  TOOL_ALLOCATION: { label: 'Alocação de Ferramenta', color: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 border-orange-100 dark:border-orange-900/30', icon: 'construction' },
  PROPERTY_ALLOCATION: { label: 'Alocação de Albergue', color: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-100 dark:border-purple-900/30', icon: 'home' },
  PAYROLL_RECORD_CREATE: { label: 'Fechamento de Folha', color: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400 border-cyan-100 dark:border-cyan-900/30', icon: 'receipt_long' },
};

const INITIAL_AUDITS_SEED: AuditLog[] = [
  {
    id: 'seed-1',
    action_type: 'TRANSFER_COLLABORATOR',
    description: 'Colaborador Ana Silva alocado para a obra "Duplicação do Viaduto Principal - Porto Alegre"',
    performed_by: 'diretoria@gestaorh.pro',
    created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    details: { employee_id: 'emp-1', employee_name: 'Ana Silva', work_name: 'Duplicação do Viaduto Principal - Porto Alegre', action: 'allocated' }
  },
  {
    id: 'seed-2',
    action_type: 'SALARY_UPDATE',
    description: 'Atualização de salário de Lucas Santos: de R$ 11.500,00 para R$ 12.000,00',
    performed_by: 'financeiro@gestaorh.pro',
    created_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    details: { employee_id: 'emp-2', employee_name: 'Lucas Santos', old_salary: 11500, new_salary: 12000 }
  },
  {
    id: 'seed-3',
    action_type: 'TOOL_ALLOCATION',
    description: 'Ferramenta "Furadeira de Impacto Bosch GSB 13 RE" alocada para a obra "Duplicação do Viaduto Principal - Porto Alegre"',
    performed_by: 'almoxarifado@gestaorh.pro',
    created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    details: { tool_id: 'tool-1', tool_name: 'Furadeira de Impacto Bosch GSB 13 RE', work_name: 'Duplicação do Viaduto Principal - Porto Alegre', action: 'allocated' }
  },
  {
    id: 'seed-4',
    action_type: 'PAYROLL_RECORD_CREATE',
    description: 'Pagamento processado para o colaborador Ana Silva referente ao período 05/2026: R$ 9.200,00 líquido',
    performed_by: 'contabilidade@gestaorh.pro',
    created_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    details: { employee_id: 'emp-1', employee_name: 'Ana Silva', reference_month: '05/2026', net_salary: 9200 }
  },
  {
    id: 'seed-5',
    action_type: 'WORK_STATUS_UPDATE',
    description: 'Status de obra "Adequação Elétrica de Galpão - Curitiba" alterado de "Planejado" para "Em Andamento"',
    performed_by: 'gerencia@gestaorh.pro',
    created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    details: { work_id: 'work-2', work_name: 'Adequação Elétrica de Galpão - Curitiba', old_status: 'Planejado', new_status: 'Em Andamento' }
  }
];

const Audit: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedUser, setSelectedUser] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Estados dos Modais
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data } = await supabase.from('audit_logs').select('*');
      
      if (data && data.length > 0) {
        // Encomenda por data decrescente
        const sortedData = [...data].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setLogs(sortedData);
      } else {
        // Se estiver vazio, popula com os seeds iniciais no localStorage
        localStorage.setItem('gestaorh_db_audit_logs', JSON.stringify(INITIAL_AUDITS_SEED));
        setLogs(INITIAL_AUDITS_SEED);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Aplicação dos Filtros
  useEffect(() => {
    let result = [...logs];

    // Busca Textual (Descrição ou Usuário)
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(log => 
        log.description.toLowerCase().includes(term) || 
        log.performed_by.toLowerCase().includes(term)
      );
    }

    // Filtro por Tipo de Ação
    if (selectedType !== 'ALL') {
      result = result.filter(log => log.action_type === selectedType);
    }

    // Filtro por Operador
    if (selectedUser !== 'ALL') {
      result = result.filter(log => log.performed_by === selectedUser);
    }

    // Filtro por Data Inicial
    if (startDate) {
      const startMs = new Date(startDate + 'T00:00:00').getTime();
      result = result.filter(log => new Date(log.created_at).getTime() >= startMs);
    }

    // Filtro por Data Final
    if (endDate) {
      const endMs = new Date(endDate + 'T23:59:59').getTime();
      result = result.filter(log => new Date(log.created_at).getTime() <= endMs);
    }

    setFilteredLogs(result);
  }, [logs, searchTerm, selectedType, selectedUser, startDate, endDate]);

  // Lista única de operadores para o filtro
  const operators = Array.from(new Set(logs.map(log => log.performed_by)));

  const handleClearLogs = () => {
    if (window.confirm('Atenção: Deseja realmente esvaziar todo o registro de auditoria? Esta ação é irreversível e removerá todas as atividades registradas!')) {
      localStorage.setItem('gestaorh_db_audit_logs', JSON.stringify([]));
      setLogs([]);
    }
  };

  // Estatísticas Rápidas
  const totalAudits = filteredLogs.length;
  const salaryUpdatesCount = filteredLogs.filter(log => log.action_type === 'SALARY_UPDATE').length;
  const transfersCount = filteredLogs.filter(log => log.action_type === 'TRANSFER_COLLABORATOR').length;
  const allocationsCount = filteredLogs.filter(log => log.action_type === 'TOOL_ALLOCATION' || log.action_type === 'PROPERTY_ALLOCATION').length;

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(date);
    } catch {
      return dateString;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 dark:border-dark-border pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-icons-outlined text-primary-500 text-3xl">history_edu</span>
            Auditoria de Ações & Logs
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Rastreie todas as ações críticas efetuadas no sistema, incluindo alterações de salários e colaboradores
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchLogs}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors shadow-xs"
          >
            <span className="material-icons-outlined text-sm">refresh</span>
            Atualizar
          </button>
          <button 
            disabled={logs.length === 0}
            onClick={handleClearLogs}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30 dark:hover:bg-red-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs"
          >
            <span className="material-icons-outlined text-sm">delete_sweep</span>
            Limpar Registros
          </button>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-dark-card border border-gray-150 dark:border-dark-border shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-400 shrink-0">
            <span className="material-icons-outlined text-2xl">receipt_long</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Ações Gravadas</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">{totalAudits}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-dark-card border border-gray-150 dark:border-dark-border shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <span className="material-icons-outlined text-2xl">payments</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Ajustes de Salário</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">{salaryUpdatesCount}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-dark-card border border-gray-150 dark:border-dark-border shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <span className="material-icons-outlined text-2xl">swap_horiz</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Troca de Obra/Mão</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">{transfersCount}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-dark-card border border-gray-150 dark:border-dark-border shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/20 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
            <span className="material-icons-outlined text-2xl">link</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Novas Alocações</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">{allocationsCount}</span>
          </div>
        </div>
      </div>

      {/* Caixa de Filtros Avançados */}
      <div className="bg-white dark:bg-dark-card border border-gray-150 dark:border-dark-border rounded-2xl p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-1.5">
          <span className="material-icons-outlined text-base">tune</span>
          Filtros de Pesquisa Avançados
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Busca por Palavra-chave */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Buscar por Descrição/Nome</label>
            <div className="relative">
              <span className="material-icons-outlined text-slate-400 absolute left-3 top-2.5 text-lg">search</span>
              <input 
                type="text"
                placeholder="Ex: Lucas, viaduto, salário..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-dark-border rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
              />
            </div>
          </div>

          {/* Filtro por Tipo de Ação */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 font-sans">Tipo de Evento</label>
            <select 
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-dark-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="ALL">Qualquer Tipo</option>
              <option value="SALARY_UPDATE">Ajustes de Salário</option>
              <option value="TRANSFER_COLLABORATOR">Transferências entre Obras</option>
              <option value="PAYROLL_RECORD_CREATE">Processamento de Folha</option>
              <option value="EMPLOYEE_CREATE">Novo Colaborador</option>
              <option value="EMPLOYEE_UPDATE">Edição de Perfil de Colaborador</option>
              <option value="EMPLOYEE_DELETE">Exclusão de Funcionário</option>
              <option value="WORK_CREATE">Cadastro de Obra</option>
              <option value="WORK_DELETE">Exclusão de Obra</option>
              <option value="WORK_STATUS_UPDATE">Mudança de Status de Obra</option>
              <option value="TOOL_ALLOCATION">Vínculo de Ferramentas</option>
              <option value="PROPERTY_ALLOCATION">Alojamento de Obras</option>
            </select>
          </div>

          {/* Filtro por Operador */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 font-sans">Responsável (Operador)</label>
            <select 
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-dark-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="ALL">Todo mundo</option>
              {operators.map(oper => (
                <option key={oper} value={oper}>{oper}</option>
              ))}
            </select>
          </div>

          {/* Filtro por Intervalo de Datas */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 font-sans">Período</label>
            <div className="flex items-center gap-1.5">
              <input 
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-dark-border rounded-xl px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
              <span className="text-slate-400 text-xs">-</span>
              <input 
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-dark-border rounded-xl px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {(searchTerm || selectedType !== 'ALL' || selectedUser !== 'ALL' || startDate || endDate) && (
          <div className="flex justify-end pt-1">
            <button 
              onClick={() => {
                setSearchTerm('');
                setSelectedType('ALL');
                setSelectedUser('ALL');
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1 cursor-pointer"
            >
              <span className="material-icons-outlined text-sm">filter_alt_off</span>
              Redefinir Filtros
            </button>
          </div>
        )}
      </div>

      {/* Painel da Timeline / Tabela de Auditoria */}
      <div className="bg-white dark:bg-dark-card border border-gray-150 dark:border-dark-border rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-500">
            <span className="material-icons-outlined animate-spin text-4xl text-primary-500 mb-2">refresh</span>
            <p className="font-semibold text-sm">Carregando logs de auditoria...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <span className="material-icons-outlined text-4xl mb-2 text-slate-300 dark:text-slate-700">info</span>
            <h4 className="font-bold text-slate-700 dark:text-slate-300">Nenhum evento registrado</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Nenhuma atividade importante foi rastreada com os filtros atuais. Realize manipulações no sistema para gerar novos logs.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-150 dark:divide-dark-border">
            {/* Header da Tabela */}
            <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 dark:bg-slate-900/40 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <div className="col-span-3">Data e Hora</div>
              <div className="col-span-2">Ação / Tipo</div>
              <div className="col-span-4">Descrição do Evento</div>
              <div className="col-span-2">Operador</div>
              <div className="col-span-1 text-center font-bold">Ações</div>
            </div>

            {/* Listagem de Logs */}
            <div className="divide-y divide-gray-100 dark:divide-dark-border">
              {filteredLogs.map(log => {
                const actionMeta = ACTION_LABELS[log.action_type] || { label: log.action_type, color: 'bg-gray-100 text-gray-700 border-gray-200', icon: 'info' };
                return (
                  <div 
                    key={log.id} 
                    className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 px-6 py-4 items-center hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors group"
                  >
                    {/* Data */}
                    <div className="col-span-3 flex lg:flex-row items-center gap-2 lg:gap-0">
                      <span className="lg:hidden text-[10px] font-black text-slate-400 uppercase tracking-wider w-24 shrink-0">Data:</span>
                      <div className="flex items-center gap-2">
                        <span className="material-icons-outlined text-slate-300 dark:text-slate-700 text-lg hidden lg:inline">schedule</span>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{formatDate(log.created_at)}</span>
                      </div>
                    </div>

                    {/* Badge de Ação */}
                    <div className="col-span-2 flex lg:flex-row items-center gap-2 lg:gap-0">
                      <span className="lg:hidden text-[10px] font-black text-slate-400 uppercase tracking-wider w-24 shrink-0">Evento:</span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold border rounded-lg ${actionMeta.color}`}>
                        <span className="material-icons text-[14px]">{actionMeta.icon}</span>
                        {actionMeta.label}
                      </span>
                    </div>

                    {/* Descrição */}
                    <div className="col-span-4 flex lg:flex-row items-center gap-2 lg:gap-0">
                      <span className="lg:hidden text-[10px] font-black text-slate-400 uppercase tracking-wider w-24 shrink-0">Descrição:</span>
                      <span className="text-sm font-semibold text-slate-850 dark:text-slate-100 line-clamp-3 lg:line-clamp-2 pr-2">
                        {log.description}
                      </span>
                    </div>

                    {/* Realizado Por */}
                    <div className="col-span-2 flex lg:flex-row items-center gap-2 lg:gap-0">
                      <span className="lg:hidden text-[10px] font-black text-slate-400 uppercase tracking-wider w-24 shrink-0">Operador:</span>
                      <div className="flex items-center gap-1.5 bg-slate-100/50 dark:bg-slate-900 border border-gray-200 dark:border-dark-border px-2 py-1 rounded-lg">
                        <span className="material-icons text-[13px] text-slate-400">admin_panel_settings</span>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 truncate max-w-[140px]" title={log.performed_by}>
                          {log.performed_by.split('@')[0]}
                        </span>
                      </div>
                    </div>

                    {/* Detalhes / Botão */}
                    <div className="col-span-1 flex lg:justify-center items-center gap-2 lg:gap-0 pt-2 lg:pt-0">
                      <span className="lg:hidden text-[10px] font-black text-slate-400 uppercase tracking-wider w-24 shrink-0">Ação:</span>
                      <button 
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-white/5 border border-gray-200 dark:border-dark-border text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-colors flex items-center gap-1 w-full lg:w-auto"
                      >
                        <span className="material-icons-outlined text-sm">visibility</span>
                        Metadados
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Detalhes de Auditoria (Visualizador de Metadados JSON) */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-dark-card border border-gray-150 dark:border-dark-border rounded-2xl max-w-xl w-full shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
            {/* Header */}
            <div className="p-5 border-b border-gray-150 dark:border-dark-border flex justify-between items-center bg-slate-50 dark:bg-slate-900/45">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                  <span className="material-icons-outlined">receipt_long</span>
                </span>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">Rastreabilidade Completa</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Identificador Log: {selectedLog.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white cursor-pointer"
              >
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Informações Básicas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50/50 dark:bg-slate-900/10 p-3 rounded-xl border border-gray-100 dark:border-dark-border/40">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Momento da Operação</span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block mt-1">{formatDate(selectedLog.created_at)}</span>
                </div>
                <div className="bg-slate-50/50 dark:bg-slate-900/10 p-3 rounded-xl border border-gray-100 dark:border-dark-border/40">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Tipo do Evento</span>
                  <span className="text-xs font-black text-primary-650 dark:text-primary-400 block mt-1 text-ellipsis overflow-hidden">{selectedLog.action_type}</span>
                </div>
              </div>

              {/* Descrição Detalhada */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/20 border border-slate-150 dark:border-dark-border/60 rounded-xl">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Relatório Descritivo</span>
                <p className="text-sm font-semibold text-slate-750 dark:text-slate-200 mt-1.5 leading-relaxed">
                  {selectedLog.description}
                </p>
              </div>

              {/* Operador de Ações */}
              <div className="flex items-center justify-between p-3.5 bg-slate-100/30 dark:bg-slate-900/40 rounded-xl border border-gray-150 dark:border-dark-border">
                <div className="flex items-center gap-2">
                  <span className="material-icons-outlined text-slate-400">admin_panel_settings</span>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Usuário Responsável:</span>
                </div>
                <span className="text-xs font-black text-slate-900 dark:text-white bg-slate-200/50 dark:bg-slate-900 px-3 py-1 rounded-lg">
                  {selectedLog.performed_by}
                </span>
              </div>

              {/* Bloco de Detalhes JSON */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Metadados Técnicos (JSON)</span>
                {selectedLog.details ? (
                  <pre className="bg-slate-900 text-teal-400 dark:bg-black/40 text-xs font-mono p-4 rounded-xl border border-slate-950 dark:border-dark-border overflow-x-auto select-all leading-normal max-h-[160px]">
                    {JSON.stringify(typeof selectedLog.details === 'string' ? JSON.parse(selectedLog.details) : selectedLog.details, null, 2)}
                  </pre>
                ) : (
                  <p className="text-xs text-slate-400 italic">Sem metadados adicionais fornecidos para esta ação.</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-150 dark:border-dark-border bg-slate-50 dark:bg-slate-900/20 flex justify-end">
              <button 
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-800 dark:bg-white text-white dark:text-slate-900 text-xs font-black rounded-xl hover:opacity-95 cursor-pointer shadow-xs"
              >
                Fechar Visualização
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Audit;
