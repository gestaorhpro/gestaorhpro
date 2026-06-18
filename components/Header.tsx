
import React, { useState, useRef, useEffect } from 'react';
import { Page } from '../types';
import { supabase } from '../services/supabase';

interface UserData {
  name: string;
  email: string;
  role: string;
}

interface HeaderProps {
  onMenuClick: () => void;
  isDark: boolean;
  toggleTheme: () => void;
  onLogout: () => void;
  onNavigate: (page: Page) => void;
  user: UserData;
}

interface Notification {
  id: number;
  title: string;
  time: string;
  read: boolean;
  type: 'info' | 'warning' | 'success';
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, isDark, toggleTheme, onLogout, onNavigate, user }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Inicializando sem notificações mockadas
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
    setShowProfileMenu(false);
  };

  const toggleProfileMenu = () => {
    setShowProfileMenu(!showProfileMenu);
    setShowNotifications(false);
  };

  const markAsRead = (id: number) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const handleNavigate = (page: Page) => {
    onNavigate(page);
    setShowProfileMenu(false);
  };

  // Carrega notificações dinâmicas de vencimento nos próximos 15 dias de NRs e treinamentos
  useEffect(() => {
    const fetchExpiringCertifications = async () => {
      try {
        const { data: employeesData } = await supabase
          .from('employees')
          .select('id, name, department, certifications');
          
        if (employeesData) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const alerts: Notification[] = [];
          let idCounter = 1;

          employeesData.forEach((emp: any) => {
            const rawCerts = Array.isArray(emp.certifications) 
              ? emp.certifications 
              : (typeof emp.certifications === 'string' ? JSON.parse(emp.certifications) : []);
              
            if (rawCerts && Array.isArray(rawCerts)) {
              rawCerts.forEach((cert: any) => {
                if (cert.expirationDate) {
                  const expDate = new Date(cert.expirationDate);
                  expDate.setHours(23, 59, 59, 999);
                  
                  const diffTime = expDate.getTime() - today.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  
                  // Se já venceu ou vence nos próximos 15 dias
                  if (diffDays <= 15) {
                    const isExpired = diffDays < 0;
                    const type = isExpired ? 'warning' : 'info';
                    const timeText = isExpired 
                      ? `Vencido há ${Math.abs(diffDays)} dia${Math.abs(diffDays) > 1 ? 's' : ''}`
                      : `Vencerá em ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
                      
                    alerts.push({
                      id: idCounter++,
                      title: `${cert.name} - ${emp.name}`,
                      time: timeText,
                      read: false,
                      type: type
                    });
                  }
                }
              });
            }
          });
          
          setNotifications(alerts);
        }
      } catch (err) {
        console.error('Erro ao buscar notificações:', err);
      }
    };
    
    fetchExpiringCertifications();
    const interval = setInterval(fetchExpiringCertifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getIconForType = (type: Notification['type']) => {
    switch (type) {
      case 'warning': return 'warning_amber';
      case 'success': return 'check_circle_outline';
      default: return 'info_outline';
    }
  };

  const getColorForType = (type: Notification['type']) => {
    switch (type) {
      case 'warning': return 'text-yellow-500';
      case 'success': return 'text-green-500';
      default: return 'text-blue-500';
    }
  };

  // Helper para iniciais
  const getInitials = (name: string) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <header className="bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border px-4 md:px-8 py-4 flex items-center justify-between sticky top-0 z-20 transition-colors duration-200">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-2 rounded-lg text-slate-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-white/10 transition-colors"
        >
          <span className="material-icons-outlined">menu</span>
        </button>

        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <span className="material-icons-outlined hidden sm:block">calendar_month</span>
          <span className="text-sm font-medium capitalize">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-6">
        <button 
          onClick={toggleTheme} 
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-300 transition-colors"
          title="Alternar Tema"
        >
          <span className="material-icons-outlined">{isDark ? 'light_mode' : 'dark_mode'}</span>
        </button>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notificationRef}>
          <button 
            onClick={toggleNotifications}
            className={`p-2 rounded-full transition-colors ${
              showNotifications 
                ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400' 
                : unreadCount > 0 
                  ? 'text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/10' // Cor vermelha quando há não lidas
                  : 'hover:bg-gray-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-300'
            }`}
          >
            <span className={`material-icons-outlined ${unreadCount > 0 ? 'animate-pulse' : ''}`}>notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white dark:border-dark-card"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-[#1E1E1E] rounded-xl shadow-2xl border border-gray-100 dark:border-[#333] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-white dark:bg-[#1E1E1E]">
                <h3 className="font-bold text-slate-800 dark:text-white">Notificações</h3>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-xs text-primary-500 hover:text-primary-600 font-medium hover:underline">
                    Marcar todas como lidas
                  </button>
                )}
              </div>
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                    <span className="material-icons-outlined text-4xl mb-2 opacity-50">notifications_off</span>
                    <p>Nenhuma notificação.</p>
                  </div>
                ) : (
                  notifications.map(notification => (
                    <div 
                      key={notification.id} 
                      onClick={() => {
                        markAsRead(notification.id);
                        setShowNotifications(false);
                        onNavigate(Page.TRAININGS);
                      }}
                      className={`p-4 border-b border-gray-50 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors relative group ${!notification.read ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}
                    >
                      <div className="flex gap-3">
                        <div className={`mt-0.5 p-1.5 rounded-full bg-gray-100 dark:bg-white/5 h-fit ${getColorForType(notification.type)}`}>
                           <span className="material-icons-outlined text-sm">{getIconForType(notification.type)}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <p className={`text-sm mb-1 leading-snug ${!notification.read ? 'font-semibold text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                              {notification.title}
                            </p>
                            {!notification.read && <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-1.5"></span>}
                          </div>
                          <p className="text-xs text-slate-400 flex items-center gap-1">
                            <span className="material-icons-outlined text-[10px]">schedule</span>
                            {notification.time}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative" ref={profileRef}>
            <button 
              onClick={toggleProfileMenu}
              className="flex items-center gap-3 pl-2 md:pl-6 border-l border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-white/5 transition-colors p-2 rounded-lg group"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {user.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {user.role}
                </p>
              </div>
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-600 dark:text-primary-300 font-bold border-2 border-white dark:border-dark-card shadow-sm text-sm md:text-base group-hover:ring-2 ring-primary-500/50 transition-all uppercase">
                {getInitials(user.name)}
              </div>
            </button>

            {showProfileMenu && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-[#1E1E1E] rounded-xl shadow-2xl border border-gray-100 dark:border-[#333] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-gray-100 dark:border-[#333] bg-gray-50/50 dark:bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-600 dark:text-primary-300 font-bold border border-primary-200 dark:border-primary-800 text-lg uppercase">
                            {getInitials(user.name)}
                        </div>
                        <div className="overflow-hidden">
                            <p className="font-bold text-slate-800 dark:text-white truncate" title={user.name}>{user.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate" title={user.email}>{user.email}</p>
                        </div>
                    </div>
                  </div>
                  <div className="p-2 space-y-1">
                    <button 
                      onClick={() => handleNavigate(Page.PROFILE)}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg flex items-center gap-3 transition-colors"
                    >
                      <span className="material-icons-outlined text-slate-400 text-xl">person_outline</span>
                      Meu Perfil
                    </button>
                    <button 
                      onClick={() => handleNavigate(Page.SETTINGS)}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg flex items-center gap-3 transition-colors"
                    >
                      <span className="material-icons-outlined text-slate-400 text-xl">settings</span>
                      Configurações
                    </button>
                    <button 
                      onClick={() => handleNavigate(Page.HELP)}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg flex items-center gap-3 transition-colors"
                    >
                      <span className="material-icons-outlined text-slate-400 text-xl">help_outline</span>
                      Central de Ajuda
                    </button>
                  </div>
                  <div className="h-px bg-gray-100 dark:bg-[#333] mx-2"></div>
                  <div className="p-2">
                    <button 
                      onClick={() => { onLogout(); setShowProfileMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg flex items-center gap-3 transition-colors font-medium"
                    >
                      <span className="material-icons-outlined text-xl">logout</span>
                      Sair da Conta
                    </button>
                  </div>
                </div>
            )}
        </div>
      </div>
    </header>
  );
};

export default Header;
