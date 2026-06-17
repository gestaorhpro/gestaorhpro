
import React, { useState, useEffect } from 'react';
import { Page } from './types';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Employees from './pages/Employees';
import PPE from './pages/PPE';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Reports from './pages/Reports';
import Help from './pages/Help';
import Trainings from './pages/Trainings';
import Properties from './pages/Properties';
import Tools from './pages/Tools';
import Works from './pages/Works';
import Audit from './pages/Audit';
import Photos from './pages/Photos';
import { supabase } from './services/supabase';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>(Page.DASHBOARD);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [formModals, setFormModals] = useState({
    tools: false,
    works: false,
    vales: false,
  });
  
  // Estado para armazenar dados do usuário logado
  const [userProfile, setUserProfile] = useState({
    name: 'Gestor Demonstrativo',
    email: 'demo@gestaorh.pro',
    role: 'Administrador'
  });
  
  // Theme state management
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  const fetchUserProfile = async (userId: string, email: string) => {
    try {
      // Tenta buscar dados da tabela de funcionários pelo nome aproximado (parte do e-mail) ou assume admin
      const usernamePart = email.split('@')[0];
      const { data: employee } = await supabase
        .from('employees')
        .select('name, role')
        .ilike('name', `%${usernamePart}%`)
        .maybeSingle();

      if (employee) {
        setUserProfile({
          name: employee.name,
          email: email,
          role: employee.role || 'Colaborador'
        });
      } else {
        // Fallback se não encontrar registro de funcionário
        setUserProfile({
          name: email.split('@')[0], // Usa parte do email como nome provisório
          email: email,
          role: 'Admin'
        });
      }
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
    }
  };

  // Verify Supabase Session on Mount & Listen for Changes
  useEffect(() => {
    // 1. Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setIsAuthenticated(true);
        fetchUserProfile(session.user.id, session.user.email || '');
      } else {
        // Se não houver sessão ativa, mantém como Gestor Demonstrativo
        setIsAuthenticated(true);
        setUserProfile({
          name: 'Gestor Demonstrativo',
          email: 'demo@gestaorh.pro',
          role: 'Administrador'
        });
      }
      setIsAuthLoading(false);
    });

    // 2. Listen for auth changes (Login, Logout, Refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);
        fetchUserProfile(session.user.id, session.user.email || '');
      } else {
        // Ao deslogar por aqui ou caso não haja sessão, o estado de isAuthenticated
        // é decidido pelo handleLogout de forma controlada.
        setUserProfile({
          name: 'Gestor Demonstrativo',
          email: 'demo@gestaorh.pro',
          role: 'Administrador'
        });
      }
      setIsAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
  };

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-dark-bg text-slate-800 dark:text-slate-200">
        <div className="text-center">
          <span className="material-icons-outlined animate-spin text-4xl mb-2 text-primary-500">refresh</span>
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Login 
        onGuestLogin={() => {
          setIsAuthenticated(true);
          setUserProfile({
            name: 'Gestor Demonstrativo',
            email: 'demo@gestaorh.pro',
            role: 'Administrador'
          });
        }} 
      />
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case Page.DASHBOARD:
        return (
          <Dashboard 
            setPage={setCurrentPage} 
            onQuickAction={(action) => {
              if (action === 'TOOLS') {
                setFormModals(prev => ({ ...prev, tools: true }));
              } else if (action === 'WORKS') {
                setFormModals(prev => ({ ...prev, works: true }));
              } else if (action === 'VALES') {
                setFormModals(prev => ({ ...prev, vales: true }));
              }
            }}
          />
        );
      case Page.EMPLOYEES:
        return (
          <Employees 
            setPage={setCurrentPage} 
            initialOpenVales={formModals.vales}
            onValesClose={() => setFormModals(prev => ({ ...prev, vales: false }))}
          />
        );
      case Page.EMPLOYEE_FORM:
        return <Employees setPage={setCurrentPage} subView="FORM" />;
      case Page.PPE_CONTROL:
        return <PPE />;
      case Page.TRAININGS:
        return <Trainings />;
      case Page.SETTINGS:
        return <Settings isDark={isDark} toggleTheme={toggleTheme} />;
      case Page.PROFILE:
        return <Profile />;
      case Page.REPORTS:
        return <Reports />;
      case Page.PROPERTIES:
        return <Properties />;
      case Page.TOOLS:
        return (
          <Tools 
            initialShowForm={formModals.tools} 
            onFormClose={() => setFormModals(prev => ({ ...prev, tools: false }))} 
          />
        );
      case Page.WORKS:
        return (
          <Works 
            initialShowForm={formModals.works} 
            onFormClose={() => setFormModals(prev => ({ ...prev, works: false }))} 
          />
        );
      case Page.AUDIT:
        return <Audit />;
      case Page.HELP:
        return <Help />;
      case Page.PHOTOS:
        return <Photos user={userProfile} />;
      default:
        return (
          <Dashboard 
            setPage={setCurrentPage} 
            onQuickAction={(action) => {
              if (action === 'TOOLS') {
                setFormModals(prev => ({ ...prev, tools: true }));
              } else if (action === 'WORKS') {
                setFormModals(prev => ({ ...prev, works: true }));
              } else if (action === 'VALES') {
                setFormModals(prev => ({ ...prev, vales: true }));
              }
            }}
          />
        );
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-dark-bg text-slate-800 dark:text-slate-200 font-sans overflow-hidden transition-colors duration-200">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <Sidebar 
        currentPage={currentPage} 
        setPage={setCurrentPage} 
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onLogout={handleLogout}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          onMenuClick={() => setIsMobileMenuOpen(true)} 
          isDark={isDark}
          toggleTheme={toggleTheme}
          onLogout={handleLogout}
          onNavigate={setCurrentPage}
          user={userProfile} // Passando dados do usuário
        />
        <main className="flex-1 overflow-y-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
};

export default App;
