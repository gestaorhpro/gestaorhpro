
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const Profile: React.FC = () => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  const [profileData, setProfileData] = useState({
    id: '',
    name: '',
    role: '',
    email: '',
    phone: '',
    location: 'Matriz',
    birthDate: '',
    department: '',
    cpf: ''
  });

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState(profileData);

  // Listas para os dropdowns
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);

  useEffect(() => {
    fetchProfile();
    fetchStructure();
  }, []);

  const fetchStructure = async () => {
    try {
        const { data: rolesData } = await supabase.from('company_roles').select('name').order('name');
        const { data: deptsData } = await supabase.from('company_departments').select('name').order('name');

        if (rolesData) setAvailableRoles(rolesData.map((r: any) => r.name));
        if (deptsData) setAvailableDepartments(deptsData.map((d: any) => d.name));
    } catch (error) {
        console.error("Erro ao carregar estrutura da empresa:", error);
    }
  };

  const fetchProfile = async () => {
    setLoading(true);
    // 1. Get current auth user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
        // 2. Try to find matching employee record by approximate name
        const usernamePart = user.email.split('@')[0];
        const { data: employee } = await supabase
            .from('employees')
            .select('*')
            .ilike('name', `%${usernamePart}%`)
            .maybeSingle();

        if (employee) {
            const initialData = {
                id: employee.id,
                name: employee.name,
                role: employee.role || '',
                email: user.email, // Email vem do auth
                phone: employee.phone || '',
                location: 'Matriz',
                birthDate: employee.birth_date || '',
                department: employee.department || '',
                cpf: employee.cpf || ''
            };
            setProfileData(initialData);
            setEditForm(initialData);
        } else {
            // Fallback if no employee record found but user exists
            const initialData = {
                id: '',
                name: user.user_metadata?.name || '',
                role: '',
                email: user.email || '',
                phone: '',
                location: 'Matriz',
                birthDate: '',
                department: '',
                cpf: ''
            };
            setProfileData(initialData);
            setEditForm(initialData);
        }
    }
    setLoading(false);
  };

  const handleEditClick = () => {
    setEditForm(profileData);
    setShowEditModal(true);
  };

  // Helper de Formatação de CPF
  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditForm({ ...editForm, cpf: formatCPF(e.target.value) });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
        if (profileData.id) {
            // Atualiza no banco de dados existente
            const { error } = await supabase
                .from('employees')
                .update({
                    name: editForm.name,
                    phone: editForm.phone,
                    role: editForm.role,
                    department: editForm.department,
                    birth_date: editForm.birthDate || null,
                    cpf: editForm.cpf // Incluindo CPF
                })
                .eq('id', profileData.id);

            if (error) throw error;

            setProfileData(editForm);
            setShowEditModal(false);
            // alert("Perfil atualizado com sucesso!");
        } else {
            // Se não existe ID, cria um novo registro de colaborador
            const { data: { user } } = await supabase.auth.getUser();
            
            if (!user || !user.email) throw new Error("Usuário não autenticado.");

            const newEmployeePayload = {
                name: editForm.name,
                role: editForm.role,
                department: editForm.department,
                phone: editForm.phone,
                birth_date: editForm.birthDate || null,
                cpf: editForm.cpf, // Incluindo CPF
                status: 'Ativo', // Status padrão
                admission_date: new Date().toISOString().split('T')[0] // Data de hoje como admissão
            };

            const { data, error } = await supabase
                .from('employees')
                .insert([newEmployeePayload])
                .select()
                .single();

            if (error) throw error;

            if (data) {
                const newProfile = {
                    id: data.id,
                    name: data.name,
                    role: data.role,
                    email: user.email,
                    phone: data.phone || '',
                    location: 'Matriz',
                    birthDate: data.birth_date || '',
                    department: data.department,
                    cpf: data.cpf || ''
                };
                setProfileData(newProfile);
                setEditForm(newProfile);
                setShowEditModal(false);
                // alert("Cadastro criado com sucesso!");
            }
        }
    } catch (error: any) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar alterações: " + error.message);
    } finally {
        setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.email) {
        await supabase.auth.resetPasswordForEmail(user.email);
        alert("E-mail de redefinição de senha enviado. Siga as instruções no seu e-mail para alterar a senha de login.");
        setShowPasswordModal(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Carregando perfil...</div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 relative">
      {/* Cover & Profile Header */}
      <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden">
        {/* Cover Image */}
        <div className="h-32 bg-gradient-to-r from-primary-500 to-orange-600 relative">
          <button 
            onClick={handleEditClick}
            className="absolute right-4 top-4 p-2 bg-white/20 hover:bg-white/30 text-white rounded-lg backdrop-blur-sm transition-colors"
            title="Editar Perfil"
          >
            <span className="material-icons-outlined">edit</span>
          </button>
        </div>
        
        {/* Profile Content */}
        <div className="px-6 pb-6">
          <div className="flex flex-col md:flex-row gap-4 md:gap-6">
            
            {/* Avatar - Negative Margin to pull it up */}
            <div className="-mt-12 flex-shrink-0 flex justify-center md:justify-start">
               <div className="w-28 h-28 rounded-full bg-white dark:bg-dark-card p-1.5 shadow-md">
                  <div className="w-full h-full rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-600 dark:text-primary-300 font-bold text-4xl border-2 border-white dark:border-dark-card shadow-inner">
                     {profileData.name ? profileData.name.charAt(0) : 'U'}
                  </div>
               </div>
            </div>

            {/* Name & Role Section - Corrected Alignment */}
            <div className="flex-1 flex flex-col md:justify-end pt-0 md:pt-3 pb-1 text-center md:text-left">
               <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white leading-tight">
                 {profileData.name || 'Novo Usuário'}
               </h1>
               <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
                 <span className="px-2 py-0.5 rounded bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-xs font-semibold uppercase tracking-wide border border-primary-100 dark:border-primary-800">
                    {profileData.role || 'Sem cargo'}
                 </span>
                 <span className="text-slate-300 dark:text-slate-600">|</span>
                 <span className="text-sm text-slate-500 dark:text-slate-400">
                    {profileData.department || 'Geral'}
                 </span>
               </div>
            </div>

            {/* Actions */}
            <div className="flex flex-row md:flex-col justify-center md:justify-end gap-3 mt-4 md:mt-0 md:pb-1">
              <button 
                onClick={() => setShowPasswordModal(true)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 font-medium transition-colors text-sm"
              >
                Alterar Senha
              </button>
              <button 
                onClick={handleEditClick}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 shadow-sm transition-colors font-medium text-sm flex items-center justify-center gap-2"
              >
                <span className="material-icons-outlined text-lg">edit</span>
                {profileData.id ? 'Editar Perfil' : 'Completar Cadastro'}
              </button>
            </div>
          </div>

          {/* Quick Stats / Info Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 pt-6 mt-6 border-t border-gray-100 dark:border-dark-border">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg shrink-0">
                <span className="material-icons-outlined text-xl">email</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400 uppercase font-medium">Email de Login</p>
                <p className="text-slate-700 dark:text-slate-200 font-medium text-sm truncate" title={profileData.email}>{profileData.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg shrink-0">
                <span className="material-icons-outlined text-xl">call</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400 uppercase font-medium">Telefone</p>
                <p className="text-slate-700 dark:text-slate-200 font-medium text-sm">{profileData.phone || 'Não informado'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg shrink-0">
                <span className="material-icons-outlined text-xl">badge</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400 uppercase font-medium">CPF</p>
                <p className="text-slate-700 dark:text-slate-200 font-medium text-sm">{profileData.cpf || 'Não informado'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Informações Pessoais</h3>
                <button onClick={handleEditClick} className="text-slate-400 hover:text-primary-500 transition-colors">
                    <span className="material-icons-outlined">edit</span>
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
               <div className="group">
                 <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase font-medium">Nome Completo</p>
                 <p className="text-slate-800 dark:text-slate-200 font-medium pb-2 border-b border-gray-100 dark:border-white/5 group-hover:border-primary-200 transition-colors">{profileData.name || '-'}</p>
               </div>
               <div className="group">
                 <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase font-medium">Data de Nascimento</p>
                 <p className="text-slate-800 dark:text-slate-200 font-medium pb-2 border-b border-gray-100 dark:border-white/5 group-hover:border-primary-200 transition-colors">
                    {profileData.birthDate ? new Date(profileData.birthDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '-'}
                 </p>
               </div>
               <div className="group">
                 <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase font-medium">Departamento</p>
                 <p className="text-slate-800 dark:text-slate-200 font-medium pb-2 border-b border-gray-100 dark:border-white/5 group-hover:border-primary-200 transition-colors">{profileData.department || '-'}</p>
               </div>
               <div className="group">
                 <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase font-medium">Cargo Atual</p>
                 <p className="text-slate-800 dark:text-slate-200 font-medium pb-2 border-b border-gray-100 dark:border-white/5 group-hover:border-primary-200 transition-colors">{profileData.role || '-'}</p>
               </div>
               <div className="group">
                 <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase font-medium">CPF</p>
                 <p className="text-slate-800 dark:text-slate-200 font-medium pb-2 border-b border-gray-100 dark:border-white/5 group-hover:border-primary-200 transition-colors">{profileData.cpf || '-'}</p>
               </div>
            </div>
          </div>
        </div>

        {/* Right Column - Stats & Activity */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-primary-600 to-orange-600 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <span className="material-icons-outlined text-8xl">verified_user</span>
             </div>
             <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-primary-100 text-xs font-bold uppercase tracking-wider">Status da Conta</p>
                    <p className="text-3xl font-bold mt-1">Ativo</p>
                </div>
                <span className="material-icons-outlined text-white/80 text-3xl">verified</span>
                </div>
                <div className="mt-4 pt-4 border-t border-white/20">
                    <p className="text-xs text-primary-100">Autenticação segura via E-mail e Senha.</p>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-dark-card w-full max-w-lg rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-200 dark:border-dark-border flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                        {profileData.id ? 'Editar Perfil' : 'Completar Cadastro'}
                    </h3>
                    <button onClick={() => setShowEditModal(false)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors">
                        <span className="material-icons-outlined">close</span>
                    </button>
                </div>
                <form onSubmit={handleSaveProfile} className="p-6 overflow-y-auto space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome Completo</label>
                        <input 
                            type="text" 
                            required
                            value={editForm.name} 
                            onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email (Usado para Login)</label>
                        <input 
                            type="email" 
                            disabled
                            value={editForm.email} 
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                            title="O email não pode ser alterado pois é usado para login."
                        />
                        <p className="text-xs text-slate-400 mt-1">O e-mail não pode ser alterado por aqui.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cargo</label>
                            <select 
                                value={editForm.role} 
                                onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                            >
                                <option value="">Selecione...</option>
                                {availableRoles.map(role => (
                                    <option key={role} value={role}>{role}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Departamento</label>
                            <select 
                                value={editForm.department} 
                                onChange={(e) => setEditForm({...editForm, department: e.target.value})}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                            >
                                <option value="">Selecione...</option>
                                {availableDepartments.map(dept => (
                                    <option key={dept} value={dept}>{dept}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data de Nascimento</label>
                            <input 
                                type="date" 
                                value={editForm.birthDate} 
                                onChange={(e) => setEditForm({...editForm, birthDate: e.target.value})}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone</label>
                            <input 
                                type="text" 
                                value={editForm.phone} 
                                onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CPF</label>
                        <input 
                            type="text" 
                            value={editForm.cpf} 
                            onChange={handleCpfChange}
                            maxLength={14}
                            placeholder="000.000.000-00"
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                        />
                    </div>
                    <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-white/5 mt-4">
                        <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors font-medium">Cancelar</button>
                        <button type="submit" disabled={isSaving} className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 shadow-lg shadow-primary-500/30 transition-all font-medium flex items-center gap-2">
                            {isSaving ? <span className="material-icons-outlined animate-spin text-sm">refresh</span> : <span className="material-icons-outlined text-sm">save</span>}
                            {profileData.id ? 'Salvar Alterações' : 'Criar Cadastro'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
             <div className="bg-white dark:bg-dark-card w-full max-w-md rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border">
                <div className="p-6 border-b border-gray-200 dark:border-dark-border">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Redefinir Senha</h3>
                </div>
                <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
                        <span className="material-icons-outlined text-blue-600 dark:text-blue-400">info</span>
                        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                            <p>
                                Por segurança, enviaremos um link para o seu email: <strong>{profileData.email}</strong>.
                            </p>
                            <p className="text-xs opacity-80">
                                Use este link para criar uma nova senha de login.
                            </p>
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={() => setShowPasswordModal(false)} className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 font-medium transition-colors">Cancelar</button>
                        <button type="submit" className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 shadow-md transition-colors font-medium">Confirmar Envio</button>
                    </div>
                </form>
             </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
