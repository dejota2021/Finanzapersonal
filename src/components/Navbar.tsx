import React, { useState, useEffect } from 'react';
import { Settings, Check, RefreshCw } from 'lucide-react';
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
  const [localName, setLocalName] = useState(settings.projectName || '');
  const [isSaved, setIsSaved] = useState(false);

  // Sync if settings update externally
  useEffect(() => {
    setLocalName(settings.projectName || '');
  }, [settings.projectName]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalName(val);
    onUpdateProjectName(val);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

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
          {/* Custom Logo: Geometric Silver $ on Pitch Black Background */}
          <div
            id="brand-custom-logo"
            className="w-10 h-10 rounded-xl bg-black border border-neutral-700/80 shadow-md shadow-black/60 flex items-center justify-center flex-shrink-0 overflow-hidden select-none transition-all hover:scale-105 hover:border-neutral-500 hover:shadow-neutral-800/40"
            title="SISTEMA DE FINANZA"
          >
            <img
              src="/logo.jpg"
              alt="SISTEMA DE FINANZA Logo"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="relative w-full">
            <input
              id="page-name-input"
              type="text"
              value={localName}
              onChange={handleChange}
              placeholder="SISTEMA DE FINANZA"
              aria-label="Nombre de la página"
              className={`w-full text-base sm:text-lg font-bold px-3 py-1.5 rounded-xl border transition-all outline-none ${
                darkMode
                  ? 'bg-neutral-950/60 border-neutral-700/80 text-white placeholder-neutral-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                  : 'bg-neutral-50 border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
              }`}
            />
            {isSaved && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-emerald-400 flex items-center gap-1 animate-fade-in pointer-events-none">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span className="hidden sm:inline text-[11px]">Guardado</span>
              </span>
            )}
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
