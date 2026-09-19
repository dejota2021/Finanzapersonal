import React from 'react';
import { Settings, RefreshCw } from 'lucide-react';
import { ProjectFinanceState } from '../types';

interface NavbarProps {
  state: ProjectFinanceState;
  darkMode: boolean;
  isSynced?: boolean;
  isRefreshing?: boolean;
  onlineCount?: number;
  onRefresh?: () => void;
  onOpenSettings: () => void;
  onUpdateProjectName: (newName: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  state,
  darkMode,
  isSynced,
  isRefreshing,
  onlineCount = 1,
  onRefresh,
  onOpenSettings,
  onUpdateProjectName,
}) => {
  const { settings } = state;

  return (
    <header
      id="main-navbar"
      className={`sticky top-0 z-30 transition-colors border-b backdrop-blur-md ${
        darkMode
          ? 'bg-neutral-900/90 border-neutral-800 text-neutral-100'
          : 'bg-white/90 border-neutral-200 text-neutral-800'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Left: Custom Geometric Silver Dollar Logo + Editable Page Name */}
        <div className="flex-1 max-w-xl flex items-center gap-2.5">
          <div
            id="brand-custom-logo"
            className="w-10 h-10 rounded-xl bg-black border border-neutral-700/80 shadow-md shadow-black/60 flex items-center justify-center flex-shrink-0 overflow-hidden select-none transition-all hover:scale-105 hover:border-neutral-500"
            title="SISTEMA DE FINANZA"
          >
            <div className="w-full h-full bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-300 flex items-center justify-center text-neutral-950 font-black text-lg">
              $
            </div>
          </div>
          <div className="relative w-full py-1.5">
            <h1 className="text-base sm:text-lg font-extrabold text-neutral-900 dark:text-neutral-100 truncate">
              {settings.projectName || 'SISTEMA DE FINANZA'}
            </h1>
          </div>
        </div>

        {/* Right: Quick Refresh and Settings */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Quick Refresh Button */}
          {onRefresh && (
            <button
              id="refresh-sync-btn"
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`p-2 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                darkMode
                  ? 'bg-neutral-800/80 border-neutral-700/80 text-neutral-300 hover:bg-neutral-750 hover:text-white'
                  : 'bg-neutral-100 border-neutral-300 text-neutral-700 hover:bg-neutral-200 hover:text-neutral-900'
              } disabled:opacity-50`}
              title="Actualizar datos para todos los usuarios"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-500' : ''}`} />
            </button>
          )}

          {/* Configuration button */}
          <button
            id="open-settings-modal-btn"
            onClick={onOpenSettings}
            className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 sm:gap-2 shadow-sm cursor-pointer ${
              darkMode
                ? 'bg-neutral-800 border-neutral-700 text-neutral-100 hover:bg-neutral-750 hover:border-neutral-600'
                : 'bg-neutral-100 border-neutral-300 text-neutral-800 hover:bg-neutral-200 hover:border-neutral-400'
            }`}
            title="Abrir Configuración (Exportaciones, Modo, Sincronización y Ajustes)"
          >
            <Settings className="w-4 h-4 text-amber-500" />
            <span>Configuración</span>
          </button>
        </div>
      </div>
    </header>
  );
};
