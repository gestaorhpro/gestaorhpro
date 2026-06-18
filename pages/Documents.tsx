
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';

interface DocItem {
  id: string;
  parentId: string | null;
  name: string;
  type: 'folder' | 'file';
  fileType?: string; 
  size?: string;
  date: string;
  owner: string;
  url?: string;
}

const Documents: React.FC = () => {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [items, setItems] = useState<DocItem[]>([]);
  
  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Fetch Data ---
  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase.from('documents').select('*');
      if (error) throw error;

      if (data) {
        setItems(data.map((d: any) => ({
          id: d.id,
          parentId: d.parent_id,
          name: d.name,
          type: d.type,
          fileType: d.file_type,
          size: d.size,
          date: new Date(d.created_at).toLocaleDateString('pt-BR'),
          owner: d.owner || 'Sistema',
          url: d.url
        })));
      }
    } catch (error) {
      console.error('Erro ao buscar documentos:', error);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Helpers
  const getCurrentFolder = () => items.find(i => i.id === currentFolderId);
  
  const getBreadcrumbs = () => {
    const path = [];
    let current = getCurrentFolder();
    while (current) {
      path.unshift(current);
      current = items.find(i => i.id === current!.parentId);
    }
    return path;
  };

  const filteredItems = items.filter(item => {
    if (searchTerm) {
      return item.name.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return item.parentId === currentFolderId;
  });

  const getFileIcon = (fileType?: string) => {
    switch (fileType) {
      case 'pdf': return 'picture_as_pdf';
      case 'image': return 'image';
      case 'doc': case 'docx': return 'description';
      case 'xls': case 'xlsx': return 'table_view';
      default: return 'insert_drive_file';
    }
  };

  // Actions
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName) return;
    
    await supabase.from('documents').insert([{
        parent_id: currentFolderId,
        name: newFolderName,
        type: 'folder',
        owner: 'Eu'
    }]);
    
    await fetchDocuments();
    setShowNewFolderModal(false);
    setNewFolderName('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    const totalFiles = files.length;

    // Em um app real, faríamos upload para o Storage. 
    // Aqui criaremos apenas o registro no banco para manter o fluxo.
    for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        const fileType = file.name.split('.').pop() || 'file';
        let sizeStr = '';
        if (file.size < 1024 * 1024) {
          sizeStr = `${(file.size / 1024).toFixed(0)} KB`;
        } else {
          sizeStr = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
        }
        
        // Simular um pequeno delay de rede para visualização do progresso
        await new Promise(resolve => setTimeout(resolve, 600));

        await supabase.from('documents').insert([{
            parent_id: currentFolderId,
            name: file.name,
            type: 'file',
            file_type: fileType,
            size: sizeStr,
            owner: 'Eu',
            url: '#' // URL placeholder
        }]);

        // Atualiza progresso
        const currentPercent = Math.round(((i + 1) / totalFiles) * 100);
        setUploadProgress(currentPercent);
    }

    await fetchDocuments();
    
    // Pequeno delay para mostrar o 100% antes de fechar
    setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
    }, 500);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este item?')) {
      await supabase.from('documents').delete().eq('id', id);
      setItems(items.filter(i => i.id !== id));
    }
  };

  const handleItemClick = (item: DocItem) => {
    if (item.type === 'folder') {
      setCurrentFolderId(item.id);
      setSearchTerm('');
    }
  };

  return (
    <div className="p-4 md:p-8 h-full flex flex-col relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white">Documentos Digitais</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Gerencie arquivos, contratos e políticas da empresa.</p>
        </div>
        <div className="flex gap-3">
            <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
            <button onClick={() => setShowNewFolderModal(true)} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
              <span className="material-icons-outlined">create_new_folder</span>
              <span className="hidden sm:inline">Nova Pasta</span>
            </button>
            <button onClick={() => !isUploading && fileInputRef.current?.click()} disabled={isUploading} className={`flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg shadow-sm transition-colors ${isUploading ? 'opacity-75 cursor-not-allowed' : 'hover:bg-primary-600'}`}>
              <span className="material-icons-outlined">cloud_upload</span>
              <span>{isUploading ? 'Enviando...' : 'Upload'}</span>
            </button>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-sm overflow-x-auto w-full sm:w-auto scrollbar-hide whitespace-nowrap">
           <button onClick={() => setCurrentFolderId(null)} className={`flex items-center hover:bg-gray-100 dark:hover:bg-white/10 px-2 py-1 rounded transition-colors ${!currentFolderId ? 'font-bold text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
             <span className="material-icons-outlined text-lg mr-1">home</span> Início
           </button>
           {getBreadcrumbs().map((folder) => (
             <React.Fragment key={folder.id}>
               <span className="text-slate-400">/</span>
               <button onClick={() => setCurrentFolderId(folder.id)} className={`hover:bg-gray-100 dark:hover:bg-white/10 px-2 py-1 rounded transition-colors ${currentFolderId === folder.id ? 'font-bold text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                 {folder.name}
               </button>
             </React.Fragment>
           ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-6">
         {filteredItems.length === 0 ? (
           <div className="h-full flex flex-col items-center justify-center text-slate-400">
             <span className="material-icons-outlined text-6xl mb-4 opacity-50">folder_off</span>
             <p className="text-lg">Esta pasta está vazia</p>
           </div>
         ) : viewMode === 'GRID' ? (
           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
             {filteredItems.map(item => (
               <div key={item.id} onClick={() => handleItemClick(item)} className="group relative bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/10 rounded-xl p-4 flex flex-col items-center text-center cursor-pointer transition-all aspect-[4/5]">
                 <div className="flex-1 flex items-center justify-center w-full">
                    {item.type === 'folder' ? (
                      <span className="material-icons-outlined text-7xl text-amber-300 drop-shadow-sm group-hover:scale-110 transition-transform">folder</span>
                    ) : (
                      <span className="material-icons-outlined text-6xl text-slate-500 group-hover:scale-110 transition-transform">{getFileIcon(item.fileType)}</span>
                    )}
                 </div>
                 <div className="w-full mt-3">
                   <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate w-full" title={item.name}>{item.name}</p>
                   <p className="text-xs text-slate-400 mt-1">{item.date}</p>
                 </div>
                 <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-full bg-white dark:bg-black/50 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all shadow-sm">
                   <span className="material-icons-outlined text-sm">delete</span>
                 </button>
               </div>
             ))}
           </div>
         ) : (
           <table className="w-full text-sm text-left">
             <thead className="text-xs text-slate-500 uppercase bg-gray-50 dark:bg-white/5">
                 <tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Data</th><th className="px-4 py-3 text-right">Ações</th></tr>
             </thead>
             <tbody>
                 {filteredItems.map(item => (
                   <tr key={item.id} onClick={() => handleItemClick(item)} className="hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer">
                     <td className="px-4 py-3 flex items-center gap-3">
                       <span className="material-icons-outlined text-xl">{item.type === 'folder' ? 'folder' : 'description'}</span>
                       {item.name}
                     </td>
                     <td className="px-4 py-3 text-slate-500">{item.date}</td>
                     <td className="px-4 py-3 text-right"><button onClick={(e)=>{e.stopPropagation(); handleDelete(item.id)}} className="text-red-500"><span className="material-icons-outlined">delete</span></button></td>
                   </tr>
                 ))}
             </tbody>
           </table>
         )}
      </div>

      {/* Upload Progress Indicator */}
      {isUploading && (
        <div className="fixed bottom-6 right-6 z-50 w-80 bg-white dark:bg-dark-card rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
           <div className="bg-primary-500 px-4 py-3 flex justify-between items-center">
              <span className="text-white font-bold text-sm flex items-center gap-2">
                 <span className="material-icons-outlined text-lg animate-bounce">cloud_upload</span>
                 Enviando arquivos...
              </span>
              <span className="text-white font-bold text-sm">{uploadProgress}%</span>
           </div>
           <div className="p-4">
              <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-2.5">
                 <div 
                   className="bg-primary-500 h-2.5 rounded-full transition-all duration-300 ease-out" 
                   style={{ width: `${uploadProgress}%` }}
                 ></div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
                 Por favor, aguarde a conclusão do upload.
              </p>
           </div>
        </div>
      )}

      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-dark-card w-full max-w-sm rounded-xl p-6">
             <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Nova Pasta</h3>
             <form onSubmit={handleCreateFolder}>
               <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} className="w-full px-3 py-2 rounded-lg border dark:bg-[#121212] dark:border-gray-600 dark:text-white mb-6" placeholder="Nome da pasta" autoFocus />
               <div className="flex justify-end gap-2">
                 <button type="button" onClick={() => setShowNewFolderModal(false)} className="px-4 py-2 border rounded dark:text-white">Cancelar</button>
                 <button type="submit" disabled={!newFolderName} className="px-4 py-2 bg-primary-500 text-white rounded font-medium">Criar</button>
               </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Documents;
