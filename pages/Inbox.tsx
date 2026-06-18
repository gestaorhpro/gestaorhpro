
import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../services/supabase';

const Inbox: React.FC = () => {
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [showCompose, setShowCompose] = useState(false);
  const [viewingMessage, setViewingMessage] = useState<any>(null); 
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  
  // State for autocomplete
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);

  const [allMessages, setAllMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Helper colors
  const getAvatarColor = (index: number) => {
      const colors = [
          'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
          'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
          'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
          'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
          'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
      ];
      return colors[index % colors.length];
  };

  const fetchData = async () => {
    setIsLoading(true);
    // 1. Fetch Messages (Assuming a 'messages' table exists)
    // If table doesn't exist, this will return error, handle gracefully by showing empty list
    const { data: messagesData, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });

    if (messagesData) {
        setAllMessages(messagesData.map((m: any, idx: number) => ({
            id: m.id,
            sender: m.sender || 'Sistema',
            role: m.sender_role || 'Geral',
            subject: m.subject,
            preview: m.body?.substring(0, 50) + '...',
            body: m.body,
            time: new Date(m.created_at).toLocaleDateString('pt-BR'),
            unread: !m.read,
            avatarColor: getAvatarColor(idx),
            folder: m.folder || 'inbox',
            isStarred: m.is_starred || false,
            isSystem: m.is_system || false
        })));
    } else {
        // Fallback or empty if no backend table
        setAllMessages([]); 
    }

    // 2. Fetch Contacts from Employees
    const { data: employees } = await supabase.from('employees').select('name, role, phone');
    if (employees) {
        setContacts(employees.map(e => ({
            name: e.name,
            role: e.role,
            phone: e.phone ? e.phone.replace(/\D/g, '') : '',
            email: ''
        })));
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter messages based on active folder
  const messages = allMessages.filter(msg => {
    if (activeFolder === 'starred') {
      return msg.isStarred && msg.folder !== 'trash';
    }
    return msg.folder === activeFolder;
  });

  const unreadInboxCount = allMessages.filter(m => m.folder === 'inbox' && m.unread).length;
  const draftCount = allMessages.filter(m => m.folder === 'drafts').length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTo(value);
    
    if (selectedContact && value !== selectedContact.name) {
      setSelectedContact(null);
    }

    if (value.length > 0) {
      const filtered = contacts.filter(c => 
        c.name.toLowerCase().includes(value.toLowerCase()) || 
        (c.role && c.role.toLowerCase().includes(value.toLowerCase()))
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const selectContact = (contact: typeof contacts[0]) => {
    setTo(contact.name);
    setSelectedContact(contact);
    setSuggestions([]);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedContact && selectedContact.phone) {
      const text = `*Assunto: ${subject}*\n\n${messageBody}`;
      const encodedText = encodeURIComponent(text);
      const whatsappUrl = `https://wa.me/55${selectedContact.phone}?text=${encodedText}`;
      window.open(whatsappUrl, '_blank');
    } else if (selectedContact) {
        alert("O contato selecionado não possui telefone cadastrado.");
        return;
    } else {
        // Assume internal message if no contact selected (or manual entry)
        // Store in sent folder in DB
        await supabase.from('messages').insert([{
            sender: 'Eu',
            subject: subject,
            body: messageBody,
            folder: 'sent',
            read: true
        }]);
        fetchData();
    }
    setShowCompose(false);
    setTo('');
    setSubject('');
    setMessageBody('');
    setSelectedContact(null);
  };

  const handleDeleteMessage = async () => {
    if (viewingMessage) {
        // Move to trash or delete permanently if already in trash
        if (viewingMessage.folder === 'trash') {
            await supabase.from('messages').delete().eq('id', viewingMessage.id);
        } else {
            await supabase.from('messages').update({ folder: 'trash' }).eq('id', viewingMessage.id);
        }
        
        setAllMessages(prev => prev.filter(m => m.id !== viewingMessage.id)); // Optimistic
        fetchData();
        setViewingMessage(null);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData().then(() => setIsRefreshing(false));
  };

  const handleMarkAllAsRead = async () => {
    // DB Update
    const idsToUpdate = messages.filter(m => m.unread).map(m => m.id);
    if (idsToUpdate.length > 0) {
        await supabase.from('messages').update({ read: true }).in('id', idsToUpdate);
    }

    setAllMessages(prev => prev.map(msg => {
      if (activeFolder === 'starred') {
        return msg.isStarred ? { ...msg, unread: false } : msg;
      }
      return msg.folder === activeFolder ? { ...msg, unread: false } : msg;
    }));
  };

  const toggleStar = async (e: React.MouseEvent, msg: any) => {
      e.stopPropagation();
      const newStatus = !msg.isStarred;
      // Optimistic
      setAllMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isStarred: newStatus } : m));
      // DB
      await supabase.from('messages').update({ is_starred: newStatus }).eq('id', msg.id);
  };

  const FolderButton = ({ id, icon, label, count }: { id: string, icon: string, label: string, count?: number }) => {
    const isActive = activeFolder === id;
    return (
      <button 
        onClick={() => setActiveFolder(id)}
        className={`flex items-center justify-between px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap flex-shrink-0 lg:w-full w-auto ${
          isActive 
            ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400 font-medium' 
            : 'text-slate-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5'
        }`}
      >
        <div className="flex items-center gap-2 lg:gap-3">
          <span className="material-icons-outlined">{icon}</span>
          <span>{label}</span>
        </div>
        {count !== undefined && count > 0 && (
          <span className={`text-xs py-0.5 px-2 rounded-full ml-2 ${
            isActive 
              ? 'bg-primary-100 dark:bg-primary-800' 
              : 'bg-gray-200 dark:bg-gray-700 text-slate-600 dark:text-slate-300'
          }`}>
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="p-4 md:p-8 h-full flex flex-col relative">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white">Inbox</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm hidden sm:block">Gerencie suas mensagens e notificações internas.</p>
        </div>
        <button 
          onClick={() => setShowCompose(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 shadow-sm transition-colors"
        >
          <span className="material-icons-outlined text-xl">edit</span>
          <span className="hidden sm:inline">Nova Mensagem</span>
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-full overflow-hidden">
        {/* Sidebar / Folders */}
        <div className="w-full lg:w-64 flex-shrink-0 flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible gap-2 lg:gap-1 pb-2 lg:pb-0 scrollbar-hide">
          <FolderButton id="inbox" icon="inbox" label="Entrada" count={unreadInboxCount} />
          <FolderButton id="starred" icon="star_border" label="Favoritos" />
          <FolderButton id="sent" icon="send" label="Enviados" />
          <FolderButton id="drafts" icon="drafts" label="Rascunhos" count={draftCount} />
          <FolderButton id="trash" icon="delete_outline" label="Lixeira" />
        </div>

        {/* Message List */}
        <div className="flex-1 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border flex flex-col overflow-hidden">
          {/* Search & Actions */}
          <div className="p-4 border-b border-gray-200 dark:border-dark-border flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative flex-1 w-full sm:max-w-md">
              <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input 
                type="text" 
                placeholder="Pesquisar mensagens..." 
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              />
            </div>
            <div className="flex gap-2 text-slate-500 dark:text-slate-400 w-full sm:w-auto justify-end">
              <button 
                onClick={handleRefresh}
                className={`p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-transform ${isRefreshing ? 'animate-spin' : ''}`} 
                title="Atualizar"
                disabled={isRefreshing}
              >
                <span className="material-icons-outlined">refresh</span>
              </button>
              <button 
                onClick={handleMarkAllAsRead}
                className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-slate-500 hover:text-primary-500 dark:hover:text-primary-400 transition-colors" 
                title="Marcar todas como lidas"
              >
                <span className="material-icons-outlined">done_all</span>
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
                <div className="p-8 text-center text-slate-500">Carregando mensagens...</div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <span className="material-icons-outlined text-4xl mb-2">inbox</span>
                <p>Nenhuma mensagem nesta pasta.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div 
                  key={msg.id} 
                  onClick={() => setViewingMessage(msg)}
                  className={`flex items-start gap-4 p-4 border-b border-gray-100 dark:border-dark-border cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${msg.unread ? 'bg-primary-50/30 dark:bg-primary-900/10' : ''}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${msg.avatarColor}`}>
                    {msg.isSystem ? (
                      <span className="material-icons-outlined text-lg">notifications</span>
                    ) : (
                      <span className="font-semibold text-sm">{msg.sender.substring(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className={`text-sm truncate pr-2 ${msg.unread ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-200'}`}>
                        {msg.sender}
                      </h4>
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => toggleStar(e, msg)} className="hover:text-yellow-400">
                            <span className={`material-icons-outlined text-sm ${msg.isStarred ? 'text-yellow-400' : 'text-slate-300'}`}>star</span>
                        </button>
                        <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{msg.time}</span>
                      </div>
                    </div>
                    <p className={`text-sm mb-1 ${msg.unread ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>
                      {msg.subject}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {msg.preview}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-dark-card w-full max-w-2xl rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-200 dark:border-dark-border flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Nova Mensagem</h3>
              <button 
                onClick={() => setShowCompose(false)}
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors"
              >
                <span className="material-icons-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSend} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Para</label>
                <input 
                  type="text" 
                  value={to}
                  onChange={handleToChange}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  placeholder="Nome ou email do destinatário"
                  required
                  autoComplete="off"
                />
                {/* Autocomplete Suggestions */}
                {suggestions.length > 0 && (
                  <ul ref={suggestionsRef} className="absolute z-10 w-full mt-1 bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {suggestions.map((contact, i) => (
                      <li 
                        key={i}
                        onClick={() => selectContact(contact)}
                        className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/10 cursor-pointer flex justify-between items-center"
                      >
                        <span className="text-slate-800 dark:text-slate-200">{contact.name}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{contact.role}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Assunto</label>
                <input 
                  type="text" 
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  placeholder="Assunto da mensagem"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mensagem</label>
                <textarea 
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#121212] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50 resize-none"
                  placeholder="Escreva sua mensagem aqui..."
                  required
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowCompose(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className={`px-6 py-2 rounded-lg shadow-sm transition-colors font-medium flex items-center gap-2 ${selectedContact ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-primary-500 hover:bg-primary-600 text-white'}`}
                >
                  <span className="material-icons-outlined text-sm">{selectedContact ? 'whatsapp' : 'send'}</span>
                  {selectedContact ? 'Enviar no WhatsApp' : 'Enviar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Message View Modal */}
      {viewingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-dark-card w-full max-w-3xl rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 md:p-5 border-b border-gray-200 dark:border-dark-border flex justify-between items-start gap-4">
              <div>
                <h3 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white mb-2 line-clamp-2">{viewingMessage.subject}</h3>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-gray-200 dark:border-white/10">
                    {viewingMessage.folder === 'inbox' ? 'Entrada' : viewingMessage.folder === 'sent' ? 'Enviados' : 'Rascunho'}
                  </span>
                  {viewingMessage.isStarred && (
                    <span className="px-2 py-0.5 rounded text-xs bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 border border-yellow-100 dark:border-yellow-900/30 flex items-center gap-1">
                      <span className="material-icons-outlined text-[10px]">star</span> Favorito
                    </span>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setViewingMessage(null)}
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white p-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              >
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            {/* Sender Info */}
            <div className="p-4 md:p-5 flex items-center gap-4 border-b border-gray-100 dark:border-dark-border/50 bg-gray-50/50 dark:bg-white/[0.02]">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${viewingMessage.avatarColor} text-lg`}>
                {viewingMessage.isSystem ? (
                  <span className="material-icons-outlined">notifications</span>
                ) : (
                  <span className="font-bold">{viewingMessage.sender.substring(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-900 dark:text-white truncate pr-2">{viewingMessage.sender}</h4>
                  <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">{viewingMessage.time}</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{viewingMessage.role}</p>
              </div>
            </div>
            
            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
              {viewingMessage.body}
            </div>

            {/* Footer / Actions */}
            <div className="p-4 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-[#121212] flex flex-wrap justify-end gap-3 rounded-b-xl">
              <button 
                onClick={handleDeleteMessage}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/5 border border-gray-200 dark:border-gray-600 rounded-lg transition-colors text-sm font-medium"
              >
                <span className="material-icons-outlined text-lg">delete</span>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inbox;
