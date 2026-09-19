import React from 'react';
import { LayoutDashboard, ListFilter, Mic, BarChart3, Settings } from 'lucide-react';

interface MobileBottomNavProps {
  currentTab: 'overview' | 'transactions' | 'charts' | 'settings';
  onSelectTab: (tab: 'overview' | 'transactions' | 'charts' | 'settings') => void;
  onOpenVoiceModal: () => void;
  onOpenSettings: () => void;
  darkMode: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenVoiceModal,
  onOpenSettings,
  darkMode,
}) => {
  return (
    <nav
      id="mobile-bottom-bar"
      className={`sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-xl px-3 py-1.5 flex items-center justify-around ${
        darkMode ? 'bg-neutral-950/95 border-neutral-800 text-neutral-400' : 'bg-white/95 border-neutral-200 text-neutral-600'
      }`}
    >
      <button
        id="mobile-tab-overview"
        type="button"
        onClick={() => onSelectTab('overview')}
        className={`flex flex-col items-center py-1 px-2 text-xs font-bold transition-colors cursor-pointer ${
          currentTab === 'overview' ? 'text-amber-500' : 'hover:text-current'
        }`}
      >
        <LayoutDashboard className="w-5 h-5 mb-0.5" />
        <span>Resumen</span>
      </button>

      <button
        id="mobile-tab-transactions"
        type="button"
        onClick={() => onSelectTab('transactions')}
        className={`flex flex-col items-center py-1 px-2 text-xs font-bold transition-colors cursor-pointer ${
          currentTab === 'transactions' ? 'text-amber-500' : 'hover:text-current'
        }`}
      >
        <ListFilter className="w-5 h-5 mb-0.5" />
        <span>Movs</span>
      </button>

      {/* Floating Center Voice Button for Mobile Quick Access */}
      <div className="relative -top-5 flex flex-col items-center">
        <button
          id="mobile-voice-fab"
          type="button"
          onClick={onOpenVoiceModal}
          className="w-13 h-13 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-neutral-950 flex items-center justify-center shadow-lg shadow-amber-500/40 active:scale-95 transition-transform border-4 border-neutral-950 cursor-pointer"
          title="Hablar para registrar gasto o ingreso con IA"
        >
          <Mic className="w-6 h-6 stroke-[2.5]" />
        </button>
        <span className="text-[10px] font-extrabold text-amber-500 mt-0.5">Voz IA</span>
      </div>

      <button
        id="mobile-tab-charts"
        type="button"
        onClick={() => onSelectTab('charts')}
        className={`flex flex-col items-center py-1 px-2 text-xs font-bold transition-colors cursor-pointer ${
          currentTab === 'charts' ? 'text-amber-500' : 'hover:text-current'
        }`}
      >
        <BarChart3 className="w-5 h-5 mb-0.5" />
        <span>Gráficos</span>
      </button>

      <button
        id="mobile-tab-settings"
        type="button"
        onClick={onOpenSettings}
        className="flex flex-col items-center py-1 px-2 text-xs font-bold transition-colors hover:text-current cursor-pointer"
      >
        <Settings className="w-5 h-5 mb-0.5" />
        <span>Ajustes</span>
      </button>
    </nav>
  );
};
