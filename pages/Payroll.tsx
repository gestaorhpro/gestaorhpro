
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { logAction } from '../services/audit';

interface PayrollRecord {
  id: string; // Pode ser ID do funcionário (se pendente) ou ID do registro (se salvo)
  employeeId: string;
  name: string;
  role: string;
  department: string;
  baseSalary: number;
  additions: number; // Horas extras, bônus
  discounts: number; // INSS, IRRF, Benefícios
  netSalary: number;
  status: 'Pago' | 'Pendente' | 'Processando';
  paymentDate?: string;
  referenceMonth: string;
  recordId?: number; // ID da tabela payroll_records se existir
}

const Payroll: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [payrollList, setPayrollList] = useState<PayrollRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Modal de Holerite
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecord | null>(null);

  // Formatação de Moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Carregar dados reais do Supabase
  const fetchData = async () => {
    setIsLoading(true);
    setSelectedIds([]); // Reset selection

    try {
        // 1. Buscar todos os funcionários ativos
        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('id, name, role, department, salary')
            .eq('status', 'Ativo');

        if (empError) throw empError;

        // 2. Buscar registros de folha já salvos para o mês selecionado
        const { data: records, error: recError } = await supabase
            .from('payroll_records')
            .select('*')
            .eq('reference_month', selectedMonth);

        if (recError) throw recError;

        // 3. Mesclar dados
        const combinedList: PayrollRecord[] = (employees || []).map(emp => {
            // Verificar se já existe registro para este funcionário neste mês
            const existingRecord = records?.find(r => r.employee_id === emp.id);

            if (existingRecord) {
                // Se existe, usa os dados do histórico (imutável)
                return {
                    id: emp.id,
                    employeeId: emp.id,
                    recordId: existingRecord.id,
                    name: existingRecord.employee_name_snapshot,
                    role: existingRecord.role_snapshot || emp.role,
                    department: existingRecord.department_snapshot || emp.department,
                    baseSalary: Number(existingRecord.base_salary),
                    additions: Number(existingRecord.additions),
                    discounts: Number(existingRecord.discounts),
                    netSalary: Number(existingRecord.net_salary),
                    status: existingRecord.status as any,
                    paymentDate: existingRecord.payment_date,
                    referenceMonth: existingRecord.reference_month
                };
            } else {
                // Se não existe, calcula a PREVISÃO baseada no cadastro atual
                const baseSalary = Number(emp.salary) || 0;
                
                // Cálculo Estimado de Impostos (Simplificado para Demo)
                const inssRate = baseSalary > 7500 ? 877 : baseSalary * 0.11; 
                const irrfRate = baseSalary > 4000 ? baseSalary * 0.15 : baseSalary > 2000 ? baseSalary * 0.075 : 0;
                const benefits = 0; // Poderia buscar do JSONB de benefícios se necessário
                
                const discounts = inssRate + irrfRate + benefits;
                const additions = 0; // Inicialmente zero na previsão
                const netSalary = baseSalary + additions - discounts;

                return {
                    id: emp.id,
                    employeeId: emp.id,
                    name: emp.name,
                    role: emp.role,
                    department: emp.department || 'Geral',
                    baseSalary,
                    additions,
                    discounts,
                    netSalary,
                    status: 'Pendente',
                    referenceMonth: selectedMonth
                };
            }
        });

        setPayrollList(combinedList);

    } catch (error) {
        console.error("Erro ao carregar folha:", error);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  // --- Handlers de Seleção ---

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allPendingIds = payrollList.filter(p => p.status === 'Pendente').map(p => p.employeeId);
      setSelectedIds(allPendingIds);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(itemId => itemId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // --- Handlers de Pagamento ---

  const processPayments = async (idsToPay: string[]) => {
    if (!idsToPay || idsToPay.length === 0) return;

    setIsProcessing(true);
    
    // Filtra os itens da lista que precisam ser pagos
    const itemsToPay = payrollList.filter(item => idsToPay.includes(item.employeeId) && item.status === 'Pendente');
    const today = new Date().toISOString().split('T')[0];

    try {
        const payload = itemsToPay.map(item => ({
            employee_id: item.employeeId,
            reference_month: selectedMonth,
            employee_name_snapshot: item.name,
            role_snapshot: item.role,
            department_snapshot: item.department,
            base_salary: item.baseSalary,
            additions: item.additions,
            discounts: item.discounts,
            net_salary: item.netSalary,
            status: 'Pago',
            payment_date: today
        }));

        const { error } = await supabase.from('payroll_records').insert(payload);

        if (error) throw error;

        for (const item of itemsToPay) {
            await logAction('PAYROLL_RECORD_CREATE', `Pagamento processado para o colaborador ${item.name} referente ao período ${selectedMonth}: R$ ${item.netSalary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} líquido`, {
                employee_id: item.employeeId,
                employee_name: item.name,
                reference_month: selectedMonth,
                net_salary: item.netSalary
            });
        }

        await fetchData(); // Recarrega para pegar os IDs oficiais e status atualizado
        setSelectedIds([]); 

    } catch (error: any) {
        alert('Erro ao processar pagamentos: ' + error.message);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleProcessSinglePayment = (employeeId: string) => {
    if (window.confirm('Confirmar pagamento individual?')) {
      processPayments([employeeId]);
    }
  };

  const handleBatchPayment = () => {
    let idsToProcess = [...selectedIds];
    
    if (idsToProcess.length === 0) {
      idsToProcess = payrollList.filter(p => p.status === 'Pendente').map(p => p.employeeId);
    }
    
    if (idsToProcess.length === 0) {
      alert("Não há pagamentos pendentes para processar.");
      return;
    }

    const message = selectedIds.length > 0 
      ? `Confirmar pagamento de ${idsToProcess.length} colaborador(es) selecionado(s)?`
      : `Confirmar pagamento de TODOS os ${idsToProcess.length} pendentes?`;

    if (window.confirm(message)) {
      processPayments(idsToProcess);
    }
  };

  const handleViewPayslip = (record: PayrollRecord) => {
    setSelectedPayslip(record);
    setShowPayslipModal(true);
  };

  const handleExport = () => {
    const headers = ['ID', 'Nome', 'Cargo', 'Departamento', 'Salario Base', 'Proventos', 'Descontos', 'Liquido', 'Status', 'Data Pagamento'];
    const csvContent = [
      headers.join(','),
      ...payrollList.map(item => [
        item.employeeId,
        `"${item.name}"`,
        `"${item.role}"`,
        `"${item.department}"`,
        item.baseSalary.toFixed(2),
        item.additions.toFixed(2),
        item.discounts.toFixed(2),
        item.netSalary.toFixed(2),
        item.status,
        item.paymentDate || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `folha_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPayslip = () => {
    if (!selectedPayslip) return;

    // Get Company Data
    const company = JSON.parse(localStorage.getItem('gestaorh_company_data') || '{}');
    const companyName = company.companyName || 'GestãoRH Pro Ltda';
    const companyCNPJ = company.cnpj || '12.345.678/0001-90';
    const companyAddress = company.address ? `${company.address}, ${company.number || ''} - ${company.city || ''}/${company.state || ''}` : '';
    const companyPhone = company.phone || '';
    
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      const content = `
        <html>
          <head>
            <title>Holerite - ${selectedPayslip.name}</title>
            <style>
              body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #333; }
              .header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
              .company-info h1 { margin: 0; font-size: 24px; text-transform: uppercase; }
              .company-info p { margin: 5px 0 0; color: #666; font-size: 14px; }
              .ref-info { text-align: right; }
              .ref-info p { margin: 0; font-size: 14px; color: #666; }
              .ref-info h2 { margin: 5px 0 0; font-size: 18px; }
              
              .employee-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
              .field { margin-bottom: 5px; }
              .label { font-size: 11px; text-transform: uppercase; color: #888; display: block; margin-bottom: 2px; }
              .value { font-weight: bold; font-size: 15px; }

              table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
              th { text-align: left; border-bottom: 2px solid #333; padding: 10px 5px; font-size: 12px; text-transform: uppercase; }
              td { border-bottom: 1px solid #eee; padding: 12px 5px; font-size: 14px; }
              .text-right { text-align: right; }
              .text-green { color: #166534; }
              .text-red { color: #991b1b; }
              
              .totals { display: flex; justify-content: flex-end; gap: 40px; margin-bottom: 30px; padding-top: 10px; border-top: 2px solid #333; }
              .total-item { text-align: right; }
              
              .net-pay { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
              .net-label { font-weight: bold; text-transform: uppercase; color: #166534; }
              .net-value { font-size: 24px; font-weight: bold; color: #15803d; }
              
              .company-footer { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 10px; text-align: center; font-size: 10px; color: #666; }

              @media print {
                body { padding: 0; }
                .net-pay { -webkit-print-color-adjust: exact; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="company-info">
                <h1>Recibo de Pagamento</h1>
                <p>${companyName} • CNPJ: ${companyCNPJ}</p>
              </div>
              <div class="ref-info">
                <p>Referência</p>
                <h2>${selectedPayslip.referenceMonth.split('-').reverse().join('/')}</h2>
              </div>
            </div>

            <div class="employee-info">
              <div class="field"><span class="label">Colaborador</span><span class="value">${selectedPayslip.name}</span></div>
              <div class="field"><span class="label">Cargo</span><span class="value">${selectedPayslip.role}</span></div>
              <div class="field"><span class="label">Departamento</span><span class="value">${selectedPayslip.department}</span></div>
              <div class="field"><span class="label">Data Pagamento</span><span class="value">${selectedPayslip.paymentDate ? selectedPayslip.paymentDate.split('-').reverse().join('/') : '---'}</span></div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 50%">Descrição</th>
                  <th class="text-right">Vencimentos</th>
                  <th class="text-right">Descontos</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Salário Base</td>
                  <td class="text-right">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedPayslip.baseSalary)}</td>
                  <td></td>
                </tr>
                ${selectedPayslip.additions > 0 ? `
                <tr>
                  <td>Horas Extras / Bônus</td>
                  <td class="text-right">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedPayslip.additions)}</td>
                  <td></td>
                </tr>` : ''}
                <tr>
                  <td>INSS</td>
                  <td></td>
                  <td class="text-right text-red">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedPayslip.discounts * 0.4)}</td>
                </tr>
                <tr>
                  <td>IRRF / Benefícios</td>
                  <td></td>
                  <td class="text-right text-red">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedPayslip.discounts * 0.6)}</td>
                </tr>
              </tbody>
            </table>

            <div class="totals">
               <div class="total-item">
                 <span class="label">Total Vencimentos</span>
                 <span class="value text-green">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedPayslip.baseSalary + selectedPayslip.additions)}</span>
               </div>
               <div class="total-item">
                 <span class="label">Total Descontos</span>
                 <span class="value text-red">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedPayslip.discounts)}</span>
               </div>
            </div>

            <div class="net-pay">
              <span class="net-label">Líquido a Receber</span>
              <span class="net-value">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedPayslip.netSalary)}</span>
            </div>
            
            <div style="margin-top: 50px; text-align: center; border-top: 1px solid #ccc; padding-top: 10px; width: 60%; margin-left: auto; margin-right: auto;">
                <p style="font-size: 12px; color: #888;">Assinatura do Colaborador</p>
            </div>

            <div class="company-footer">
               <p>${companyName} • ${companyAddress} • ${companyPhone}</p>
            </div>
          </body>
        </html>
      `;
      
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  // --- Derived State ---
  const totalCost = payrollList.reduce((acc, curr) => acc + curr.baseSalary + curr.additions, 0);
  const totalNet = payrollList.reduce((acc, curr) => acc + curr.netSalary, 0);
  const pendingList = payrollList.filter(p => p.status === 'Pendente');
  const pendingCount = pendingList.length;
  
  // Logic for "Select All" checkbox state
  const isAllSelected = pendingCount > 0 && selectedIds.length === pendingCount;
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < pendingCount;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white">Folha de Pagamento</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Gerencie pagamentos, holerites e histórico financeiro.</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          />
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            title="Exportar Relatório"
          >
            <span className="material-icons-outlined">download</span>
            <span className="hidden sm:inline">Exportar</span>
          </button>
          
          <button 
            onClick={handleBatchPayment}
            disabled={isProcessing || pendingCount === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white shadow-sm transition-colors ${
              isProcessing || pendingCount === 0
               ? 'bg-gray-400 cursor-not-allowed' 
               : 'bg-primary-500 hover:bg-primary-600'
            }`}
          >
            {isProcessing ? (
              <span className="material-icons-outlined animate-spin">refresh</span>
            ) : (
              <span className="material-icons-outlined">payments</span>
            )}
            {isProcessing 
              ? 'Processando...' 
              : selectedIds.length > 0 
                ? `Pagar Selecionados (${selectedIds.length})` 
                : 'Pagar Todos Pendentes'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-200 dark:border-dark-border">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Custo Total (Bruto)</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white mt-2">{formatCurrency(totalCost)}</p>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
             <span className="material-icons-outlined text-sm">date_range</span> Referência: {selectedMonth}
          </div>
        </div>
        <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-200 dark:border-dark-border">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Líquido a Pagar</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white mt-2">{formatCurrency(totalNet)}</p>
           <div className="w-full bg-gray-100 dark:bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
             <div 
               className="bg-green-500 h-full rounded-full transition-all duration-500" 
               style={{ width: `${((payrollList.length - pendingCount) / (payrollList.length || 1)) * 100}%` }}
             ></div>
           </div>
        </div>
        <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-200 dark:border-dark-border">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Status de Pagamento</p>
          <div className="flex items-center justify-between mt-2">
            <div>
               <p className="text-2xl font-bold text-green-600 dark:text-green-400">{payrollList.length - pendingCount}</p>
               <p className="text-xs text-slate-400">Pagos</p>
            </div>
            <div className="h-8 w-px bg-gray-200 dark:bg-gray-700"></div>
            <div>
               <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{pendingCount}</p>
               <p className="text-xs text-slate-400">Pendentes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <span className="material-icons-outlined animate-spin text-4xl text-primary-500">refresh</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-[#121212] text-xs uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4 w-4">
                     <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                      checked={isAllSelected}
                      ref={input => { if (input) input.indeterminate = isIndeterminate; }}
                      onChange={handleSelectAll}
                      disabled={pendingCount === 0}
                     />
                  </th>
                  <th className="px-6 py-4 font-semibold">Colaborador</th>
                  <th className="px-6 py-4 font-semibold">Salário Base</th>
                  <th className="px-6 py-4 font-semibold text-green-600 dark:text-green-400">Proventos</th>
                  <th className="px-6 py-4 font-semibold text-red-600 dark:text-red-400">Descontos</th>
                  <th className="px-6 py-4 font-semibold">Líquido</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                {payrollList.map((record) => (
                  <tr key={record.employeeId} className={`hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${selectedIds.includes(record.employeeId) ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}>
                    <td className="px-6 py-4">
                      {record.status === 'Pendente' && (
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                          checked={selectedIds.includes(record.employeeId)}
                          onChange={() => handleSelectRow(record.employeeId)}
                        />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-800 dark:text-white">{record.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{record.role}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {formatCurrency(record.baseSalary)}
                    </td>
                    <td className="px-6 py-4 text-green-600 dark:text-green-400">
                      + {formatCurrency(record.additions)}
                    </td>
                    <td className="px-6 py-4 text-red-600 dark:text-red-400">
                      - {formatCurrency(record.discounts)}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">
                      {formatCurrency(record.netSalary)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        record.status === 'Pago' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : record.status === 'Processando'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 animate-pulse'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                      }`}>
                        {record.status === 'Processando' && <span className="material-icons-outlined text-xs mr-1 animate-spin">refresh</span>}
                        {record.status}
                      </span>
                      {record.paymentDate && (
                         <p className="text-[10px] text-slate-400 mt-1">{record.paymentDate.split('-').reverse().slice(0,2).join('/')}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleViewPayslip(record)}
                          className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                          title="Ver Holerite"
                        >
                          <span className="material-icons-outlined">receipt_long</span>
                        </button>
                        {record.status === 'Pendente' && (
                          <button 
                            onClick={() => handleProcessSinglePayment(record.employeeId)}
                            className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                            title="Pagar Agora"
                          >
                            <span className="material-icons-outlined">attach_money</span>
                          </button>
                        )}
                        {record.status === 'Pago' && (
                          <button 
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title="Enviar por Email"
                            onClick={() => alert(`Holerite enviado para ${record.name}`)}
                          >
                            <span className="material-icons-outlined">send</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {payrollList.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                       Nenhum funcionário ativo ou registro encontrado para este mês.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payslip Modal */}
      {showPayslipModal && selectedPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 my-4 flex flex-col max-h-[90vh]">
            {/* Payslip Header - Using white bg intentionally for print look */}
            <div className="bg-gray-50 border-b border-gray-200 p-6 flex flex-col sm:flex-row justify-between items-start gap-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800 uppercase tracking-wider">Recibo de Pagamento</h3>
                <p className="text-sm text-gray-500 mt-1">GestãoRH Pro Ltda • CNPJ: 12.345.678/0001-90</p>
              </div>
              <div className="text-left sm:text-right w-full sm:w-auto">
                 <p className="text-sm font-bold text-gray-800">Referência</p>
                 <p className="text-lg text-gray-600">{selectedPayslip.referenceMonth.split('-').reverse().join('/')}</p>
              </div>
            </div>

            <div className="p-4 sm:p-8 bg-white text-gray-800 overflow-y-auto">
               {/* Employee Info */}
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8 p-4 border border-gray-200 rounded-lg bg-gray-50/50">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Colaborador</p>
                    <p className="font-bold">{selectedPayslip.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Cargo</p>
                    <p className="font-bold">{selectedPayslip.role}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Departamento</p>
                    <p className="font-medium">{selectedPayslip.department}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Data Pagamento</p>
                    <p className="font-medium">{selectedPayslip.paymentDate ? selectedPayslip.paymentDate.split('-').reverse().join('/') : '---'}</p>
                  </div>
               </div>

               {/* Table */}
               <div className="overflow-x-auto">
                 <table className="w-full mb-8 border-collapse min-w-[500px]">
                   <thead>
                     <tr className="border-b-2 border-gray-800 text-xs uppercase text-left">
                       <th className="py-2 w-1/2">Descrição</th>
                       <th className="py-2 text-right text-green-700">Vencimentos</th>
                       <th className="py-2 text-right text-red-700">Descontos</th>
                     </tr>
                   </thead>
                   <tbody className="text-sm">
                      <tr className="border-b border-gray-100">
                        <td className="py-2">Salário Base</td>
                        <td className="py-2 text-right">{formatCurrency(selectedPayslip.baseSalary)}</td>
                        <td className="py-2 text-right"></td>
                      </tr>
                      {selectedPayslip.additions > 0 && (
                        <tr className="border-b border-gray-100">
                          <td className="py-2">Horas Extras / Bônus</td>
                          <td className="py-2 text-right">{formatCurrency(selectedPayslip.additions)}</td>
                          <td className="py-2 text-right"></td>
                        </tr>
                      )}
                      <tr className="border-b border-gray-100">
                        <td className="py-2">INSS (Estimado)</td>
                        <td className="py-2 text-right"></td>
                        <td className="py-2 text-right">{formatCurrency(selectedPayslip.baseSalary * 0.11)}</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-2">Vale Transporte / Benefícios</td>
                        <td className="py-2 text-right"></td>
                        <td className="py-2 text-right">{formatCurrency(selectedPayslip.discounts - (selectedPayslip.baseSalary * 0.11))}</td>
                      </tr>
                   </tbody>
                   <tfoot className="font-bold border-t-2 border-gray-800">
                     <tr>
                       <td className="py-3">TOTAIS</td>
                       <td className="py-3 text-right text-green-700">{formatCurrency(selectedPayslip.baseSalary + selectedPayslip.additions)}</td>
                       <td className="py-3 text-right text-red-700">{formatCurrency(selectedPayslip.discounts)}</td>
                     </tr>
                   </tfoot>
                 </table>
               </div>

               <div className="flex flex-col sm:flex-row justify-between items-center bg-gray-100 p-4 rounded-lg border border-gray-200 gap-2">
                  <span className="text-sm font-bold uppercase text-gray-600">Líquido a Receber</span>
                  <span className="text-2xl font-bold text-gray-900">{formatCurrency(selectedPayslip.netSalary)}</span>
               </div>
            </div>

            <div className="bg-gray-50 border-t border-gray-200 p-4 flex justify-end gap-3 shrink-0">
              <button 
                onClick={handlePrintPayslip} 
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-white font-medium flex items-center gap-2"
              >
                <span className="material-icons-outlined text-sm">print</span> Imprimir
              </button>
              <button 
                onClick={() => setShowPayslipModal(false)}
                className="px-6 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payroll;
