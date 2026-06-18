
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface Referral {
  id: number;
  candidateName: string;
  email: string;
  phone?: string;
  position: string;
  referredBy: string;
  date: string;
  status: 'Novo' | 'Em Análise' | 'Entrevista' | 'Contratado' | 'Reprovado';
  bonusStatus: 'Pendente' | 'Pago' | 'Cancelado' | 'N/A';
  description?: string;
  bonusValue?: string;
}

const Referrals: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [viewingReferral, setViewingReferral] = useState<Referral | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [referrals, setReferrals] = useState<Referral[]>([]);
  
  // Form States
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [position, setPosition] = useState('');
  const [description, setDescription] = useState('');
  const [bonusValue, setBonusValue] = useState('');

  const fetchReferrals = async () => {
    const { data, error } = await supabase.from('referrals').select('*').order('created_at', { ascending: false });
    if (!error && data) {
        setReferrals(data.map((r: any) => ({
            id: r.id,
            candidateName: r.candidate_name,
            email: r.email,
            phone: r.phone,
            position: r.position,
            referredBy: r.referred_by || 'Anônimo',
            date: new Date(r.created_at).toLocaleDateString('pt-BR'),
            status: r.status,
            bonusStatus: r.bonus_status,
            bonusValue: r.bonus_value ? r.bonus_value.toString() : '',
            description: r.description
        })));
    }
  };

  useEffect(() => {
    fetchReferrals();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
        candidate_name: candidateName,
        email: candidateEmail,
        position,
        referred_by: 'Eu',
        status: 'Novo',
        bonus_status: 'Pendente',
        description,
        bonus_value: bonusValue ? parseFloat(bonusValue.replace('.','').replace(',','.')) : 0
    };

    await supabase.from('referrals').insert([payload]);
    await fetchReferrals();
    setShowModal(false);
    setCandidateName(''); setCandidateEmail(''); setPosition(''); setDescription(''); setBonusValue('');
  };

  const handleBonusStatusChange = async (id: number, newStatus: string) => {
    await supabase.from('referrals').update({ bonus_status: newStatus }).eq('id', id);
    setReferrals(prev => prev.map(r => r.id === id ? { ...r, bonusStatus: newStatus as any } : r));
    if (viewingReferral) setViewingReferral({ ...viewingReferral, bonusStatus: newStatus as any });
  };

  const filteredReferrals = referrals.filter(r => 
    r.candidateName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.position.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white">Indicações</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Gerencie o programa de indicação de talentos internos.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 shadow-sm transition-colors">
          <span className="material-icons-outlined">person_add_alt</span> Nova Indicação
        </button>
      </div>

      <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-dark-border">
          <div className="relative max-w-md">
            <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar indicação..." className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-[#121212] text-xs uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Candidato</th>
                <th className="px-6 py-4 font-semibold">Vaga</th>
                <th className="px-6 py-4 font-semibold">Indicado Por</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Bônus</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
              {filteredReferrals.length > 0 ? filteredReferrals.map((referral) => (
                  <tr key={referral.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{referral.candidateName}<span className="block text-xs text-slate-400 font-normal">{referral.email}</span></td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{referral.position}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{referral.referredBy}</td>
                    <td className="px-6 py-4"><span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{referral.status}</span></td>
                    <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded text-xs ${referral.bonusStatus === 'Pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{referral.bonusStatus}</span></td>
                    <td className="px-6 py-4 text-right">
                       <button onClick={() => setViewingReferral(referral)} className="text-slate-400 hover:text-primary-500 p-2"><span className="material-icons-outlined">visibility</span></button>
                    </td>
                  </tr>
                )) : <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Nenhuma indicação.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-dark-card w-full max-w-lg rounded-xl p-6">
            <h3 className="text-xl font-bold mb-4 dark:text-white">Nova Indicação</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" required value={candidateName} onChange={(e) => setCandidateName(e.target.value)} className="w-full px-3 py-2 border rounded dark:bg-[#121212] dark:border-gray-600 dark:text-white" placeholder="Nome do Candidato" />
              <input type="email" required value={candidateEmail} onChange={(e) => setCandidateEmail(e.target.value)} className="w-full px-3 py-2 border rounded dark:bg-[#121212] dark:border-gray-600 dark:text-white" placeholder="Email" />
              <input type="text" required value={position} onChange={(e) => setPosition(e.target.value)} className="w-full px-3 py-2 border rounded dark:bg-[#121212] dark:border-gray-600 dark:text-white" placeholder="Vaga Sugerida" />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 border rounded dark:bg-[#121212] dark:border-gray-600 dark:text-white" placeholder="Motivo da indicação" rows={3} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded dark:text-white">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-primary-500 text-white rounded">Enviar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingReferral && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-dark-card w-full max-w-lg rounded-xl p-6">
            <h3 className="text-xl font-bold mb-4 dark:text-white">{viewingReferral.candidateName}</h3>
            <div className="space-y-2 mb-4 text-sm text-slate-600 dark:text-slate-300">
                <p><strong>Vaga:</strong> {viewingReferral.position}</p>
                <p><strong>Email:</strong> {viewingReferral.email}</p>
                <p><strong>Status Bônus:</strong> 
                    <select value={viewingReferral.bonusStatus} onChange={(e) => handleBonusStatusChange(viewingReferral.id, e.target.value)} className="ml-2 border rounded p-1 dark:bg-[#121212]">
                        <option>Pendente</option><option>Pago</option><option>Cancelado</option>
                    </select>
                </p>
            </div>
            <button onClick={() => setViewingReferral(null)} className="w-full border p-2 rounded dark:text-white">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Referrals;
