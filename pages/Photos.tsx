import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Work, WorkPhoto } from '../types';

interface QueuedPhoto {
  id: string;
  file: File;
  base64: string;
  observation: string;
}

interface PhotosProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
}

const Photos: React.FC<PhotosProps> = ({ user }) => {
  // Simulator states for demo/reviewers - lets user switch active profile context to test both roles!
  const [activeUser, setActiveUser] = useState({
    name: user.name,
    role: user.role
  });

  const [works, setWorks] = useState<Work[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState<string>('');
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const [generalObservation, setGeneralObservation] = useState('');
  
  // Gallery states
  const [savedPhotos, setSavedPhotos] = useState<WorkPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'gallery'>('upload');
  
  // Gallery Filter States
  const [filterWorkId, setFilterWorkId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Expanded Photo State for Modal View
  const [selectedPhoto, setSelectedPhoto] = useState<WorkPhoto | null>(null);

  // Handle escape key to close selected photo modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedPhoto(null);
      }
    };
    if (selectedPhoto) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedPhoto]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  useEffect(() => {
    fetchWorks();
    fetchPhotos();
  }, []);

  // Sync state if prop changes
  useEffect(() => {
    setActiveUser({
      name: user.name,
      role: user.role
    });
  }, [user]);

  const fetchWorks = async () => {
    try {
      const { data, error } = await supabase.from('works').select('*');
      if (!error && data) {
        setWorks(data);
      }
    } catch (err) {
      console.error('Erro ao buscar obras:', err);
    }
  };

  const fetchPhotos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('work_photos')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setSavedPhotos(data.map((p: any) => ({
          id: p.id,
          workId: p.workId || p.work_id,
          workName: p.workName || p.work_name,
          photoUrl: p.photoUrl || p.photo_url,
          observation: p.observation,
          uploadedBy: p.uploadedBy || p.uploaded_by,
          uploadedByRole: p.uploadedByRole || p.uploaded_by_role,
          createdAt: p.created_at || p.createdAt
        })));
      }
    } catch (err) {
      console.error('Erro ao carregar fotos:', err);
    } finally {
      setLoading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, isCamera: boolean = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newQueued: QueuedPhoto[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const file = files[i];
        const base64 = await fileToBase64(file);
        newQueued.push({
          id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          file,
          base64,
          observation: ''
        });
      } catch (err) {
        console.error('Erro ao ler arquivo:', err);
        showToast('Erro ao processar imagem.', 'error');
      }
    }

    setQueue(prev => [...prev, ...newQueued]);
    // Limpa o input
    e.target.value = '';
    showToast(`${newQueued.length} foto(s) adicionada(s) à fila.`);
  };

  const handleRemoveFromQueue = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const handleQueueObservationChange = (id: string, value: string) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, observation: value } : item));
  };

  const handleSavePhotos = async () => {
    if (!selectedWorkId) {
      showToast('Por favor, selecione uma obra para associar as fotos!', 'error');
      return;
    }
    if (queue.length === 0) {
      showToast('Nenhuma foto na fila de envio!', 'error');
      return;
    }

    const selectedWork = works.find(w => w.id === selectedWorkId);
    if (!selectedWork) return;

    setSaving(true);
    try {
      const photosToInsert = queue.map(item => {
        // Usa individual ou herda a geral se individual estiver em branco
        const obs = item.observation.trim() || generalObservation.trim();
        return {
          workId: selectedWork.id,
          workName: selectedWork.name,
          photoUrl: item.base64,
          observation: obs || undefined,
          uploadedBy: activeUser.name,
          uploadedByRole: activeUser.role,
          created_at: new Date().toISOString()
        };
      });

      const { error } = await supabase.from('work_photos').insert(photosToInsert);
      if (error) throw error;

      // Logação na auditoria
      await supabase.from('audit_logs').insert({
        action_type: 'WORK_PHOTOS_UPLOAD',
        description: `Colaborador ${activeUser.name} enviou ${queue.length} fotos para a obra "${selectedWork.name}"`,
        performed_by: activeUser.name,
        details: {
          work_id: selectedWork.id,
          work_name: selectedWork.name,
          photo_count: queue.length
        }
      });

      showToast(`${queue.length} Foto(s) salva(s) com sucesso na obra!`, 'success');
      setQueue([]);
      setGeneralObservation('');
      fetchPhotos();
      setActiveTab('gallery');
    } catch (err) {
      console.error('Erro ao enviar fotos:', err);
      showToast('Erro ao salvar as fotos no banco de dados.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSavedPhoto = async (photoId: string) => {
    // Apenas Administrador pode excluir fotos depois de salvas
    if (activeUser.role !== 'Administrador') {
      showToast('Permissão negada! Somente o Administrador do sistema pode deletar fotos salvas.', 'error');
      return;
    }

    if (!window.confirm('Tem certeza de que deseja excluir permanentemente esta foto do campo?')) {
      return;
    }

    try {
      const { error } = await supabase.from('work_photos').delete().eq('id', photoId);
      if (error) throw error;

      // Log na auditoria
      await supabase.from('audit_logs').insert({
        action_type: 'WORK_PHOTOS_DELETE',
        description: `Administrador ${activeUser.name} excluiu uma foto do campo de id ${photoId}`,
        performed_by: activeUser.name,
        details: { photo_id: photoId }
      });

      showToast('Foto excluída com sucesso do banco de dados.');
      setSavedPhotos(prev => prev.filter(p => p.id !== photoId));
    } catch (err) {
      console.error('Erro ao excluir foto:', err);
      showToast('Erro ao remover foto do banco.', 'error');
    }
  };

  const filteredPhotos = savedPhotos.filter(photo => {
    // Filtro por obra
    if (filterWorkId !== 'all' && photo.workId !== filterWorkId) {
      return false;
    }
    // Filtro por termo (nome da obra, quem enviou, observação)
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      const matchesWork = photo.workName.toLowerCase().includes(term);
      const matchesUploader = photo.uploadedBy.toLowerCase().includes(term);
      const matchesObs = photo.observation ? photo.observation.toLowerCase().includes(term) : false;
      return matchesWork || matchesUploader || matchesObs;
    }
    return true;
  });

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 transform translate-y-0 transition-transform ${
          toast.type === 'success' 
            ? 'bg-emerald-600 text-white' 
            : 'bg-red-600 text-white'
        }`}>
          <span className="material-icons text-lg">{toast.type === 'success' ? 'check_circle' : 'error'}</span>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Simulador de Nível de Permissão (Top Panel) */}
      <div className="bg-slate-50 dark:bg-[#151a26]/40 p-3.5 rounded-xl border border-gray-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors duration-205">
        <div className="flex items-center gap-2.5">
          <span className="material-icons-outlined text-indigo-500 text-xl">admin_panel_settings</span>
          <div>
            <h4 className="text-xs font-black text-slate-700 dark:text-slate-350 uppercase tracking-wider">Painel de Visualização e Permissões</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Visualize a tela como Colaborador de Campo ou Administrador corporativo para testar os fluxos.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-black text-slate-400 mr-1 shrink-0">Simular Papel:</span>
          <button
            onClick={() => setActiveUser({ name: 'Ana Silva (Mestre)', role: 'Mestre de Obras' })}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
              activeUser.role !== 'Administrador'
                ? 'bg-indigo-650 text-white shadow-xs'
                : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-gray-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10'
            }`}
          >
            Colaborador / Mestre
          </button>
          <button
            onClick={() => setActiveUser({ name: user.name, role: 'Administrador' })}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
              activeUser.role === 'Administrador'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-gray-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10'
            }`}
          >
            Administrador
          </button>
        </div>
      </div>

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-2.5">
            <span className="material-icons-outlined text-indigo-600 dark:text-indigo-400 text-3xl">camera_alt</span>
            Fotos e Evidências de Obras
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Registro diário fotográfico dos canteiros de obras. Documentação visual do progresso, equipes e entregas de campo.
          </p>
        </div>
        
        {/* Tab Selector */}
        <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-white/5 w-fit shrink-0">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'upload'
                ? 'bg-white dark:bg-[#1a1f2c] text-indigo-650 dark:text-indigo-400 shadow-xs ring-1 ring-black/5'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="material-icons-outlined text-sm">cloud_upload</span>
            Enviar Fotos
          </button>
          <button
            onClick={() => setActiveTab('gallery')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'gallery'
                ? 'bg-white dark:bg-[#1a1f2c] text-indigo-650 dark:text-indigo-400 shadow-xs ring-1 ring-black/5'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="material-icons-outlined text-sm">photo_library</span>
            Galeria de Obras ({savedPhotos.length})
          </button>
        </div>
      </div>

      {/* UI Body Panels */}
      {activeTab === 'upload' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Form Side - selects Work and opens file/camera inputs */}
          <div className="lg:col-span-4 space-y-5 bg-white dark:bg-dark-card p-5 rounded-xl shadow-xs border border-gray-150/50 dark:border-dark-border">
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider pb-3 border-b border-gray-100 dark:border-white/5 mb-2">
              Selecione o Canteiro
            </h3>

            {/* Dropdown Obra */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">Obra Vinculada *</label>
              <select
                value={selectedWorkId}
                onChange={e => {
                  setSelectedWorkId(e.target.value);
                  setQueue([]); // resets queue upon changing work if wanted, or keeps it. Let's keep it but recommend a work.
                }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-slate-50 dark:bg-[#111622] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
              >
                <option value="">-- Selecione uma Obra / Canteiro --</option>
                {works.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            {/* Upload Buttons */}
            <div className="space-y-3 pt-3">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400">Capturar ou Anexar</h4>
              
              <div className="grid grid-cols-1 gap-2.5">
                {/* Tirar foto diretamente */}
                <label className="flex items-center justify-center gap-2 px-4 py-3 border border-indigo-200 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-950/10 text-indigo-700 dark:text-indigo-400 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-all cursor-pointer text-xs font-bold">
                  <span className="material-icons-outlined text-lg">photo_camera</span>
                  Tirar Foto com a Câmera
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={e => handleFileChange(e, true)}
                    className="hidden"
                  />
                </label>

                {/* Selecionar da galeria */}
                <label className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 dark:border-white/10 bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl transition-all cursor-pointer text-xs font-bold">
                  <span className="material-icons-outlined text-lg font-normal">image</span>
                  Importar da Galeria / Arquivos
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={e => handleFileChange(e, false)}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* General Note */}
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Observação Geral</span>
                <span className="text-[10px] text-slate-400 font-normal">(Será aplicada às fotos sem nota individual)</span>
              </label>
              <textarea
                value={generalObservation}
                onChange={e => setGeneralObservation(e.target.value)}
                placeholder="Fale sobre o andamento geral retratado nessas imagens..."
                rows={3}
                className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-slate-50 dark:bg-[#111622] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                onClick={handleSavePhotos}
                disabled={saving || queue.length === 0}
                className={`w-full py-3 rounded-lg text-xs font-black tracking-wider flex items-center justify-center gap-2 transition-all ${
                  queue.length > 0 
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-md active:scale-95' 
                    : 'bg-gray-100 dark:bg-white/5 text-gray-400 cursor-not-allowed'
                }`}
              >
                {saving ? (
                  <span className="uppercase">Salvando Fotos no Banco...</span>
                ) : (
                  <span className="uppercase">Salvar Fotos ({queue.length})</span>
                )}
              </button>
            </div>
          </div>

          {/* Queue side - lists items added before submission */}
          <div className="lg:col-span-8 bg-white dark:bg-dark-card p-5 rounded-xl shadow-xs border border-gray-150/50 dark:border-dark-border min-h-[350px]">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/5 mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
                  Fila de Envio / Previa Local
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">As imagens abaixo serão salvas apenas quando você clicar em "Salvar Fotos" à esquerda.</p>
              </div>
              <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 text-xs font-extrabold px-3 py-1 rounded-full">
                {queue.length} selecionada(s)
              </span>
            </div>

            {queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16 space-y-3">
                <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-white/5 border border-dashed border-gray-200 dark:border-white/10 flex items-center justify-center text-slate-400">
                  <span className="material-icons-outlined text-3xl">add_photo_alternate</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-350">Fila Vazia</h4>
                  <p className="text-[11px] text-slate-400 max-w-sm mt-1">
                    Anexe arquivos da galeria ou use o disparador da câmera do seu celular no painel lateral para popular esta fila.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {queue.map((item, index) => (
                  <div key={item.id} className="relative group flex flex-col bg-slate-50 dark:bg-white/5 rounded-xl overflow-hidden border border-gray-200/60 dark:border-white/5">
                    {/* Image Preview Container */}
                    <div className="relative h-40 w-full overflow-hidden bg-slate-900 flex items-center justify-center">
                      <img
                        src={item.base64}
                        alt={`Selected preview ${index}`}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Delete button (Users can delete before saving!) */}
                      <button
                        onClick={() => handleRemoveFromQueue(item.id)}
                        className="absolute top-2.5 right-2.5 w-7 h-7 bg-black/60 hover:bg-red-600 rounded-full flex items-center justify-center text-white cursor-pointer transition-colors"
                        title="Remover da fila"
                      >
                        <span className="material-icons text-sm">close</span>
                      </button>
                      <span className="absolute bottom-2.5 left-2.5 bg-black/60 backdrop-blur-xs text-[9px] font-mono font-bold text-white px-2 py-0.5 rounded">
                        #{index + 1} • {getReadableSize(item.file.size)}
                      </span>
                    </div>

                    {/* Individual observation box */}
                    <div className="p-3 space-y-1 bg-white dark:bg-[#131924]">
                      <label className="text-[10px] font-black uppercase text-slate-400 block">Observação Individual</label>
                      <input
                        type="text"
                        value={item.observation}
                        onChange={e => handleQueueObservationChange(item.id, e.target.value)}
                        placeholder="Ex: Alinhamento das estacas, mestre avaliando..."
                        className="w-full px-2 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-700 bg-slate-50 dark:bg-[#1b2333] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Gallery Tab Panel */
        <div className="space-y-5">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-dark-card p-4 rounded-xl shadow-xs border border-gray-150/50 dark:border-dark-border flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              {/* Filter Obra */}
              <div className="w-full sm:w-56 shrink-0">
                <select
                  value={filterWorkId}
                  onChange={e => setFilterWorkId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-slate-50 dark:bg-[#111622] text-slate-700 dark:text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                >
                  <option value="all">Filtrar por todas as Obras</option>
                  {works.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              {/* Text Search */}
              <div className="relative w-full sm:w-64">
                <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                <input
                  type="text"
                  placeholder="Buscar por descrição ou operador..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-slate-50 dark:bg-[#111622] text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>
            </div>

            <div className="text-xs text-slate-400 font-bold">
              Mostrando {filteredPhotos.length} de {savedPhotos.length} foto(s) registradas
            </div>
          </div>

          {/* Loader or Gallery Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center text-center py-24 space-y-3">
              <span className="material-icons animate-spin text-indigo-500 text-4xl">sync</span>
              <p className="text-xs text-slate-400">Carregando galeria fotográfica do banco...</p>
            </div>
          ) : filteredPhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 bg-white dark:bg-dark-card rounded-xl border border-dashed border-gray-200 dark:border-white/10">
              <span className="material-icons-outlined text-4xl text-slate-400 mb-2.5">photo_library</span>
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-350">Nenhuma Foto Localizada</h4>
              <p className="text-[11px] text-slate-400 mt-1 max-w-sm">Use outros filtros ou cadastre novas fotos diárias de progresso.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredPhotos.map(photo => {
                const formattedDate = new Date(photo.createdAt).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });
                return (
                  <div key={photo.id} className="group bg-white dark:bg-dark-card rounded-xl overflow-hidden border border-gray-150/50 dark:border-dark-border shadow-xs flex flex-col text-slate-800 dark:text-slate-250 hover:shadow-md transition-shadow">
                    <div className="relative h-44 w-full bg-slate-950 overflow-hidden flex items-center justify-center">
                      <img
                        src={photo.photoUrl}
                        alt={`Campo ${photo.workName}`}
                        className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300 cursor-pointer"
                        referrerPolicy="no-referrer"
                        onClick={() => setSelectedPhoto(photo)}
                      />

                      {/* Interactive Hover Overlay showing observation and zoom */}
                      <div 
                        onClick={() => setSelectedPhoto(photo)}
                        className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-black/20 opacity-0 group-hover:opacity-100 backdrop-blur-[2px] transition-all duration-300 flex flex-col justify-between p-3 cursor-pointer"
                      >
                        {/* Top corner badge indicating zoom action */}
                        <div className="flex justify-end">
                          <span className="w-6 h-6 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/10 group-hover:scale-110 transition-transform duration-300">
                            <span className="material-icons text-xs">zoom_in</span>
                          </span>
                        </div>
                        
                        {/* Summary of observation details */}
                        <div className="transform translate-y-3 group-hover:translate-y-0 transition-transform duration-300 ease-out space-y-1">
                          <div className="flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse"></span>
                            <p className="text-[8px] uppercase tracking-wider text-slate-300 font-black">
                              Observação da Foto
                            </p>
                          </div>
                          <p className="text-xs font-semibold text-white line-clamp-3 leading-snug drop-shadow-md">
                            {photo.observation ? `"${photo.observation}"` : 'Sem descrição inserida.'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Work tag overlay */}
                      <span className="absolute top-2.5 left-2.5 text-[8px] tracking-wider uppercase font-black bg-indigo-600/90 backdrop-blur-xs text-white px-2.5 py-1 rounded-md max-w-[80%] truncate shadow-xs">
                        {photo.workName}
                      </span>

                      {/* Delete button - ONLY available to Admin after saved */}
                      {activeUser.role === 'Administrador' && (
                        <button
                          onClick={() => handleDeleteSavedPhoto(photo.id)}
                          className="absolute top-2.5 right-2 a-delete-button w-7 h-7 bg-red-650/90 hover:bg-red-700 text-white rounded-full flex items-center justify-center cursor-pointer shadow-sm transition-all"
                          title="Excluir do Banco (Administrador)"
                        >
                          <span className="material-icons-outlined text-base">delete</span>
                        </button>
                      )}
                    </div>

                    <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-2">
                        {/* Observation/Notes */}
                        <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300 italic font-medium">
                          {photo.observation ? `"${photo.observation}"` : 'Sem descrição inserida.'}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-gray-100 dark:border-white/5 space-y-1">
                        {/* Author info */}
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          <span>{photo.uploadedBy}</span>
                        </div>

                        {/* Timestamp */}
                        <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-mono">
                          <span>{formattedDate}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal de Expansão de Foto */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/85 backdrop-blur-md transition-opacity duration-300"
          onClick={() => setSelectedPhoto(null)}
          role="dialog"
          aria-modal="true"
        >
          {/* Close / Return Button */}
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 md:top-6 md:right-6 bg-white/10 hover:bg-white/20 text-white rounded-full px-4 py-2 flex items-center gap-2 border border-white/10 shadow-lg active:scale-95 transition-all text-xs font-bold z-10 cursor-pointer"
            title="Fechar (Esc)"
          >
            <span>Voltar / Fechar</span>
          </button>

          {/* Centralized image container */}
          <div 
            className="relative max-w-5xl w-full max-h-[75vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()} // Prevent close when clicking inside the image area
          >
            <img
              src={selectedPhoto.photoUrl}
              alt={selectedPhoto.workName}
              className="max-h-[72vh] max-w-full rounded-xl object-contain shadow-2xl border border-white/5"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Elegant metadata details overlay */}
          <div 
            className="mt-6 max-w-2xl w-full text-center space-y-2 bg-slate-900/50 border border-white/10 p-4 rounded-xl backdrop-blur-xs text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="inline-block bg-indigo-650 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md mb-1">
              {selectedPhoto.workName}
            </span>
            <p className="text-sm md:text-base font-semibold italic text-slate-100">
              {selectedPhoto.observation ? `"${selectedPhoto.observation}"` : 'Sem descrição inserida.'}
            </p>
            <div className="flex items-center justify-center gap-3 text-[10px] text-slate-400 font-bold">
              <span>{selectedPhoto.uploadedBy}</span>
              <span className="text-slate-600 font-normal">•</span>
              <span className="font-mono">
                {new Date(selectedPhoto.createdAt).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Help Size Readable
function getReadableSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default Photos;
