import React, { useEffect, useState } from 'react';
import { Bell, X, Radio } from 'lucide-react';
import { SyncEvent } from '../types';
import { playPushChime } from '../utils/soundEffects';

interface PushNotificationToastProps {
  currentEvent: SyncEvent | null;
  onDismiss: () => void;
  darkMode: boolean;
}

export const PushNotificationToast: React.FC<PushNotificationToastProps> = ({
  currentEvent,
  onDismiss,
  darkMode,
}) => {
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (currentEvent && currentEvent.type !== 'USER_ONLINE_COUNT') {
      setShowToast(true);
      if (currentEvent.type === 'TRANSACTION_ADDED') {
        playPushChime();
      }
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Movimiento Registrado', {
            body: currentEvent.message,
          });
        } catch (e) {
          console.warn('Native notification failed', e);
        }
      }
      const timer = setTimeout(() => {
        setShowToast(false);
        onDismiss();
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [currentEvent, onDismiss]);

  const requestBrowserPush = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setBrowserPermission(perm);
      if (perm === 'granted') {
        new Notification('¡Notificaciones Push Activadas!', {
          body: 'Recibirás avisos instantáneos cuando se registren nuevos movimientos.',
        });
      }
    }
  };

  return (
    <>
      {showToast && currentEvent && (
        <div
          id="push-toast-banner"
          className={`fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 max-w-sm w-full p-4 rounded-2xl border shadow-2xl transition-all transform animate-slide-up ${
            darkMode
              ? 'bg-neutral-900/95 border-amber-500/50 text-white shadow-amber-500/10'
              : 'bg-white/95 border-amber-400 text-neutral-900 shadow-xl'
          } backdrop-blur-md`}
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-neutral-950 flex items-center justify-center flex-shrink-0 shadow-md">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider uppercase text-amber-500">
                  Notificación en Tiempo Real
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowToast(false);
                    onDismiss();
                  }}
                  className="text-neutral-400 hover:text-white p-0.5 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs font-semibold leading-snug">{currentEvent.message}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-neutral-400 font-mono">
                  {new Date(currentEvent.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                  <Radio className="w-2.5 h-2.5 animate-pulse" /> Sincronizado
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {browserPermission === 'default' && (
        <div
          className={`hidden md:flex fixed bottom-3 left-4 z-40 items-center gap-3 p-2.5 px-3.5 rounded-xl border text-xs ${
            darkMode ? 'bg-neutral-900/90 border-neutral-700 text-neutral-300' : 'bg-white/90 border-neutral-300 text-neutral-700'
          } shadow-lg backdrop-blur-md`}
        >
          <Bell className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span>¿Activar notificaciones push en este navegador?</span>
          <button
            type="button"
            onClick={requestBrowserPush}
            className="px-2.5 py-1 rounded-lg font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 text-[11px] transition-colors cursor-pointer"
          >
            Activar
          </button>
        </div>
      )}
    </>
  );
};
