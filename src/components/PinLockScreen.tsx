import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ShieldAlert, Delete, Eye, EyeOff, Lock, Unlock, ShieldCheck, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PinLockScreenProps {
  onSuccess: () => void;
  darkMode: boolean;
  setDarkMode?: (val: boolean) => void;
}

export function PinLockScreen({ onSuccess, darkMode, setDarkMode }: PinLockScreenProps) {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [showPin, setShowPin] = useState<boolean>(false);
  const correctPin = '82465';

  // Handle number click
  const handleNumberPress = useCallback((num: string) => {
    if (success) return;
    setError(false);
    setPin((prev) => {
      if (prev.length >= 5) return prev;
      const newVal = prev + num;
      // Trigger optional haptic feedback on mobile touch
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        try {
          window.navigator.vibrate(12);
        } catch {}
      }
      return newVal;
    });
  }, [success]);

  // Handle backspace
  const handleBackspace = useCallback(() => {
    if (success) return;
    setError(false);
    setPin((prev) => prev.slice(0, -1));
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      try {
        window.navigator.vibrate(8);
      } catch {}
    }
  }, [success]);

  // Handle clear
  const handleClear = useCallback(() => {
    if (success) return;
    setError(false);
    setPin('');
  }, [success]);

  // Handle physical keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (success) return;
      if (e.key >= '0' && e.key <= '9') {
        handleNumberPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNumberPress, handleBackspace, handleClear, success]);

  // Check pin when it reaches 5 digits
  useEffect(() => {
    if (pin.length === 5) {
      if (pin === correctPin) {
        setSuccess(true);
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
          try {
            window.navigator.vibrate([40, 40, 80]);
          } catch {}
        }
        // Give a slight visual confirmation before transitioning
        const timer = setTimeout(() => {
          onSuccess();
        }, 600);
        return () => clearTimeout(timer);
      } else {
        setError(true);
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
          try {
            window.navigator.vibrate([100, 50, 100]);
          } catch {}
        }
        // Shake for 500ms then reset
        const timer = setTimeout(() => {
          setPin('');
          setError(false);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [pin, onSuccess]);

  return (
    <div id="pin-lock-container" className="min-h-screen bg-black text-neutral-100 flex flex-col justify-between p-6 sm:p-8 relative select-none font-sans overflow-hidden">
      {/* Background Subtle Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.06)_0%,transparent_70%)] pointer-events-none" />

      {/* Top Header Row with Theme Toggle and Indicator */}
      <div className="flex justify-between items-center w-full max-w-md mx-auto z-10 pt-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest font-mono text-amber-500/80 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
            Acceso Protegido
          </span>
        </div>
        {setDarkMode && (
          <button
            id="pin-theme-toggle"
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Cambiar tema"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Status Banner & Title */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-md w-full mx-auto z-10 py-4">
        <motion.div
          animate={error ? { x: [-8, 8, -6, 6, -4, 4, 0] } : {}}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center text-center space-y-6"
        >
          {/* Logo Badge */}
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${
            success 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
              : error 
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse' 
                : 'bg-amber-500/15 text-amber-500 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.08)]'
          }`}>
            {success ? (
              <ShieldCheck className="w-8 h-8 animate-bounce" />
            ) : error ? (
              <ShieldAlert className="w-8 h-8" />
            ) : (
              <Lock className="w-7 h-7" />
            )}
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-mono uppercase tracking-wider font-extrabold text-white">
              SISTEMA DE FINANZAS
            </h1>
            <p className="text-xs text-neutral-400 font-medium">
              Por favor ingresa tu clave de seguridad de 5 dígitos
            </p>
          </div>

          {/* Dots Display */}
          <div className="flex items-center justify-center gap-4.5 py-4">
            {Array.from({ length: 5 }).map((_, index) => {
              const isActive = pin.length > index;
              return (
                <div key={index} className="relative">
                  <motion.div
                    animate={
                      success
                        ? { scale: [1, 1.25, 1], backgroundColor: '#10b981' }
                        : error
                          ? { scale: [1, 1.3, 1], backgroundColor: '#f43f5e' }
                          : isActive
                            ? { scale: [1, 1.2, 1], backgroundColor: '#f59e0b' }
                            : { scale: 1, backgroundColor: 'rgba(64, 64, 64, 0.5)' }
                    }
                    className={`w-4.5 h-4.5 rounded-full border transition-all duration-200 ${
                      isActive 
                        ? 'border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.4)]' 
                        : 'border-neutral-800'
                    }`}
                  />
                  {/* Absolute numerical preview if toggled */}
                  <AnimatePresence>
                    {showPin && isActive && (
                      <motion.span
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute inset-0 flex items-center justify-center text-xs font-mono font-black text-amber-400"
                      >
                        {pin[index]}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* Reveal option */}
          <button
            id="pin-reveal-toggle"
            onClick={() => setShowPin(!showPin)}
            className="flex items-center gap-1.5 text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors uppercase tracking-wider font-mono bg-neutral-900/60 px-3 py-1.5 rounded-xl border border-neutral-800 cursor-pointer"
          >
            {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPin ? 'Ocultar PIN' : 'Mostrar dígitos'}
          </button>
        </motion.div>
      </div>

      {/* Grid Keypad */}
      <div className="w-full max-w-sm mx-auto z-10 pb-8">
        <div className="grid grid-cols-3 gap-y-4 gap-x-5 justify-items-center">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              id={`pin-btn-${num}`}
              key={num}
              onClick={() => handleNumberPress(num)}
              disabled={success}
              className="w-18 h-18 rounded-2xl bg-neutral-950/70 border border-neutral-800 hover:border-amber-500/50 hover:bg-neutral-900 active:scale-95 text-xl font-mono font-bold text-neutral-200 hover:text-amber-400 transition-all cursor-pointer flex flex-col items-center justify-center shadow-lg hover:shadow-amber-500/5"
            >
              {num}
            </button>
          ))}

          {/* Action Left (Clear) */}
          <button
            id="pin-btn-clear"
            onClick={handleClear}
            disabled={success || pin.length === 0}
            className="w-18 h-18 rounded-2xl bg-neutral-950/70 border border-neutral-900 hover:border-neutral-700 active:scale-95 text-xs uppercase tracking-widest font-mono font-bold text-neutral-500 hover:text-neutral-300 transition-all cursor-pointer flex items-center justify-center disabled:opacity-40"
          >
            Limpiar
          </button>

          {/* Number 0 */}
          <button
            id="pin-btn-0"
            onClick={() => handleNumberPress('0')}
            disabled={success}
            className="w-18 h-18 rounded-2xl bg-neutral-950/70 border border-neutral-800 hover:border-amber-500/50 hover:bg-neutral-900 active:scale-95 text-xl font-mono font-bold text-neutral-200 hover:text-amber-400 transition-all cursor-pointer flex items-center justify-center shadow-lg hover:shadow-amber-500/5"
          >
            0
          </button>

          {/* Action Right (Backspace) */}
          <button
            id="pin-btn-backspace"
            onClick={handleBackspace}
            disabled={success || pin.length === 0}
            className="w-18 h-18 rounded-2xl bg-neutral-950/70 border border-neutral-900 hover:border-rose-500/30 active:scale-95 text-neutral-500 hover:text-rose-400 transition-all cursor-pointer flex items-center justify-center disabled:opacity-40"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
