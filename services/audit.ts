import { supabase } from './supabase';

export interface AuditLog {
  id?: string;
  action_type: string; // e.g., 'SALARY_UPDATE', 'TRANSFER_COLLABORATOR', 'WORK_CREATE', 'WORK_DELETE', 'EMPLOYEE_CREATE'
  description: string;
  performed_by: string;
  created_at: string;
  details?: Record<string, any>;
}

export async function logAction(actionType: string, description: string, details?: Record<string, any>) {
  try {
    // Obter o usuário atual
    const { data } = await supabase.auth.getUser();
    const email = data?.user?.email || localStorage.getItem('gestaorh_logged_user') || 'demo@gestaorh.pro';
    
    const entry: AuditLog = {
      action_type: actionType,
      description,
      performed_by: email,
      created_at: new Date().toISOString(),
      details
    };

    const { error } = await supabase.from('audit_logs').insert(entry);
    if (error) {
      console.error('Erro ao registrar log de auditoria no Supabase:', error);
    }
  } catch (err) {
    console.error('Erro ao registrar log de auditoria:', err);
  }
}
