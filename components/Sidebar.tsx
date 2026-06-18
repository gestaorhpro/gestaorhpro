
import React from 'react';
import { Page } from '../types';
import Logo from './Logo';

interface SidebarProps {
  currentPage: Page;
  setPage: (page: Page) => void;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, setPage, isOpen, onClose, onLogout }) => {
  const NavItem = ({ page, icon, label, isAction = false }: { page?: Page; icon: string; label: string; isAction?: boolean }) => {
    const isActive = currentPage === page;
    const baseClasses = "flex items-center px-4 py-3 cursor-pointer transition-colors duration-200 rounded-lg mx-2 mb-1";
    const activeClasses = "bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-medium";
    const inactiveClasses = "text-slate-500 hover:bg-gray-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white";
    const actionClasses = "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 font-medium";

    return (
      <div 
        onClick={() => {
          if (page) {
            setPage(page);
            onClose(); // Close menu on mobile when item clicked
          }
        }}
        className={`${baseClasses} ${isAction ? actionClasses : (isActive ? activeClasses : inactiveClasses)}`}
      >
        <span className="material-icons-outlined text-xl mr-3">{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
    );
  };

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-dark-card border-r border-gray-200 dark:border-dark-border 
      flex flex-col h-full transition-transform duration-300 ease-in-out md:translate-x-0 md:static
      ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
    `}>
      <div className="p-6 flex justify-between items-center">
        <Logo className="w-8 h-8" textClassName="text-xl" />
        <button onClick={onClose} className="md:hidden text-slate-500 dark:text-slate-400 cursor-pointer">
          <span className="material-icons-outlined">close</span>
        </button>
      </div>

      <nav className="flex-1 pb-6 overflow-y-auto space-y-4">
        {/* Grupo 1: Painel Geral */}
        <div className="px-2">
          <div className="px-4 mb-2 flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Painel Geral</span>
            <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 font-mono">Live</span>
          </div>
          <NavItem page={Page.DASHBOARD} icon="dashboard" label="Visão Geral" />
          <NavItem page={Page.REPORTS} icon="analytics" label="Relatórios Consolidados" />
        </div>

        {/* Separador */}
        <div className="mx-4 border-t border-gray-150 dark:border-dark-border" />

        {/* Grupo 2: Fluxo Regulatório (Configurações -> EPIs) */}
        <div className="px-2">
          <div className="px-4 mb-2 flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase text-indigo-650 dark:text-indigo-400 tracking-wider">Fluxo SST & RH</span>
            <span className="text-[8px] font-extrabold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded-md">Fase 1</span>
          </div>
          <NavItem page={Page.SETTINGS} icon="settings" label="1. Configurações" />
          <NavItem page={Page.EMPLOYEES} icon="groups" label="2. Colaboradores" />
          <NavItem page={Page.TRAININGS} icon="school" label="3. Treinamentos" />
          <NavItem page={Page.PPE_CONTROL} icon="health_and_safety" label="4. EPIs" />
        </div>

        {/* Separador */}
        <div className="mx-4 border-t border-gray-150 dark:border-dark-border" />

        {/* Grupo 3: Logística de Campo (Imóveis -> Obras) */}
        <div className="px-2">
          <div className="px-4 mb-2 flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase text-emerald-650 dark:text-emerald-400 tracking-wider">Logística de Campo</span>
            <span className="text-[8px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-md">Fase 2</span>
          </div>
          <NavItem page={Page.PROPERTIES} icon="holiday_village" label="5. Imóveis" />
          <NavItem page={Page.TOOLS} icon="handyman" label="6. Ferramentas" />
          <NavItem page={Page.WORKS} icon="construction" label="7. Obras" />
          <NavItem page={Page.PHOTOS} icon="photo_camera" label="8. Fotos do Canteiro" />
        </div>

        {/* Separador */}
        <div className="mx-4 border-t border-gray-150 dark:border-dark-border" />

        {/* Grupo 4: Informações de Apoio */}
        <div className="px-2">
          <div className="px-4 mb-2">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider font-semibold">Auditoria & Suporte</span>
          </div>
          <NavItem page={Page.AUDIT} icon="history_edu" label="Auditoria de Ações" />
          <NavItem page={Page.HELP} icon="help_outline" label="Central de Ajuda" />
        </div>

        <div className="px-2 pt-2 border-t border-gray-150 dark:border-dark-border">
          <button 
            type="button"
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="w-[calc(100%-1rem)] text-left flex items-center px-4 py-3 cursor-pointer transition-colors duration-200 rounded-lg mx-2 mb-1 text-slate-500 hover:bg-red-50 hover:text-red-650 dark:text-slate-400 dark:hover:bg-red-950/20 dark:hover:text-red-400"
          >
            <span className="material-icons-outlined text-xl mr-3">logout</span>
            <span className="text-sm font-semibold">Sair</span>
          </button>
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;
