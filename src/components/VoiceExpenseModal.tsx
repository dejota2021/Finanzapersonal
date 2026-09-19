import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  X,
  Check,
  Loader2,
  Volume2,
  AlertCircle,
  RotateCcw,
  Edit3,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { ProjectSettings, BudgetDestination, Transaction } from '../types';
import { parseVoiceNote } from '../services/api';
import { parseVoiceInput } from '../utils/voiceParser';
import { playVoiceStartSound, playVoiceSuccessSound } from '../utils/soundEffects';

interface VoiceExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ProjectSettings;
  budgets: BudgetDestination[];
  onSaveTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>;
  onAddNewDestination?: (destName: string) => Promise<void>;
  darkMode: boolean;
}

export const VoiceExpenseModal: React.FC<VoiceExpenseModalProps> = ({
  isOpen,
  onClose,
  settings,
  budgets,
  onSaveTransaction,
  onAddNewDestination,
  darkMode,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [micVolume, setMicVolume] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Extracted Data Form
  const [extractedData, setExtractedData] = useState<{
    title: string;
    amount: number;
    type: 'expense' | 'income';
    destination: string;
    paidBy: string;
    split1: number;
    split2: number;
    notes: string;
    suggestedDestinations?: string[];
  } | null>(null);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isManuallyStoppedRef = useRef<boolean>(false);
  const isRecordingRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<any>(null);

  const stopAudioAnalyser = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    setMicVolume(0);
  };

  const startRecording = async () => {
    setParseError(null);
    setTranscript('');
    setInterimText('');
    setExtractedData(null);
    audioChunksRef.current = [];
    isManuallyStoppedRef.current = false;
    isRecordingRef.current = true;
    setIsRecording(true);

    playVoiceStartSound();

    // 1. Web Speech API with Colombian Spanish prioritized
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        // Priority to Colombian Spanish for local currency terms and phonetics
        recognition.lang = 'es-CO';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;

        let accumulatedFinal = '';

        recognition.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            if (res.isFinal) {
              accumulatedFinal += (accumulatedFinal ? ' ' : '') + res[0].transcript.trim();
            } else {
              interim += res[0].transcript;
            }
          }
          setTranscript(accumulatedFinal);
          setInterimText(interim);

          // Auto-stop after 2.8s of silence once words have been spoken
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          if (accumulatedFinal.trim().length > 6) {
            silenceTimerRef.current = setTimeout(() => {
              if (isRecordingRef.current) {
                stopRecording();
              }
            }, 2800);
          }
        };

        recognition.onerror = (e: any) => {
          if (e.error !== 'no-speech') {
            console.warn('SpeechRecognition error:', e.error);
          }
        };

        recognition.onend = () => {
          // If still recording and not manually stopped, auto-restart to prevent timeout silence aborts
          if (!isManuallyStoppedRef.current && recognitionRef.current && isRecordingRef.current) {
            try {
              recognition.start();
            } catch {}
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('SpeechRecognition initialization error:', err);
      }
    }

    // 2. High Quality MediaRecorder + Web Audio Visualizer
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        // Setup real-time audio volume visualizer
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const audioCtx = new AudioContextClass();
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);

          audioContextRef.current = audioCtx;
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const checkVolume = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(checkVolume);
          };
          checkVolume();
        } catch (e) {
          console.warn('AudioAnalyser visualizer error:', e);
        }

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        mediaRecorder.start(250);
      }
    } catch (err) {
      console.warn('Microphone stream error:', err);
    }
  };

  const stopRecording = async () => {
    if (!isRecordingRef.current && !isRecording) return;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    isRecordingRef.current = false;
    isManuallyStoppedRef.current = true;
    setIsRecording(false);
    stopAudioAnalyser();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    let audioBase64: string | undefined;
    const mimeType = 'audio/webm';

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());

      if (audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioBase64 = await blobToBase64(audioBlob);
      }
    }

    const fullSpokenText = [transcript, interimText].filter(Boolean).join(' ').trim();
    if (fullSpokenText) {
      setTranscript(fullSpokenText);
      setInterimText('');
    }

    // Process with Gemini AI + Colombian NLP parser
    processVoice(fullSpokenText, audioBase64, mimeType);
  };

  // Auto-start recording immediately when the modal opens
  useEffect(() => {
    let autoStartTimer: any;
    if (isOpen) {
      autoStartTimer = setTimeout(() => {
        startRecording();
      }, 100);
    } else {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      stopRecording();
      setTranscript('');
      setInterimText('');
      setExtractedData(null);
      setParseError(null);
      setIsProcessing(false);
      setMicVolume(0);
    }

    return () => {
      if (autoStartTimer) clearTimeout(autoStartTimer);
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };
  }, [isOpen]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopAudioAnalyser();
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const processVoice = async (text: string, audioB64?: string, mime?: string) => {
    const rawText = text.trim();
    if (!rawText && !audioB64) {
      setParseError('No se detectó voz ni audio. Habla claro cerca del micrófono o escribe en el recuadro.');
      return;
    }

    setIsProcessing(true);
    setParseError(null);

    // 1. High-precision rule-based Colombian baseline parser
    const baseline = parseVoiceInput(rawText, budgets, settings.partners);

    try {
      const response = await parseVoiceNote({
        transcript: rawText,
        audioBase64: audioB64,
        mimeType: mime,
      });

      if (response && response.data) {
        const d = response.data;

        // Ensure numbers and millions are not truncated or string formatted (e.g. "5,000,000" or 5)
        let finalAmount = 0;
        if (typeof d.amount === 'number' && !isNaN(d.amount)) {
          finalAmount = d.amount;
        } else if (typeof d.amount === 'string') {
          const cleanStr = d.amount.replace(/[^0-9]/g, '');
          finalAmount = parseInt(cleanStr, 10) || 0;
        }

        // If AI truncated to single digit or small number e.g. 5, but baseline detected 5,000,000
        if (
          !finalAmount ||
          finalAmount === 0 ||
          (baseline.amount >= 1000 && finalAmount < 1000) ||
          (baseline.amount >= 1000000 && finalAmount < 100000) ||
          (baseline.amount > 0 && finalAmount < 100 && baseline.amount % finalAmount === 0)
        ) {
          finalAmount = baseline.amount;
        }

        // Ensure type accuracy (income vs expense)
        let finalType: 'expense' | 'income' = d.type || baseline.type;
        if (baseline.type === 'income') {
          finalType = 'income';
        }

        // Clean title
        let finalTitle = d.title;
        if (!finalTitle || finalTitle.length < 3 || finalTitle.toLowerCase().startsWith('me gast')) {
          finalTitle = baseline.title;
        }

        const finalDest = d.destination || baseline.destination || 'Proyecto';
        const finalPaidBy = 'general';

        playVoiceSuccessSound();
        setExtractedData({
          title: finalTitle,
          amount: finalAmount,
          type: finalType,
          destination: finalDest,
          paidBy: finalPaidBy,
          split1: 50,
          split2: 50,
          notes: d.notes || `Voz registrada: "${rawText}"`,
          suggestedDestinations: d.suggestedDestinations || baseline.suggestedDestinations,
        });
      } else {
        playVoiceSuccessSound();
        setExtractedData({
          title: baseline.title,
          amount: baseline.amount,
          type: baseline.type,
          destination: baseline.destination,
          paidBy: baseline.paidByPartnerId,
          split1: baseline.splitPartner1,
          split2: baseline.splitPartner2,
          notes: baseline.notes,
          suggestedDestinations: baseline.suggestedDestinations,
        });
      }
    } catch (err: any) {
      console.warn('Fallback to Colombian NLP Voice Parser:', err);
      playVoiceSuccessSound();
      setExtractedData({
        title: baseline.title,
        amount: baseline.amount,
        type: baseline.type,
        destination: baseline.destination,
        paidBy: baseline.paidByPartnerId,
        split1: baseline.splitPartner1,
        split2: baseline.splitPartner2,
        notes: baseline.notes,
        suggestedDestinations: baseline.suggestedDestinations,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!extractedData) return;
    if (extractedData.amount <= 0) {
      alert('Por favor ingresa un monto válido mayor a 0');
      return;
    }

    const finalDest = extractedData.destination?.trim() || 'Proyecto';

    if (onAddNewDestination && !budgets.some((b) => b.destination.toLowerCase() === finalDest.toLowerCase())) {
      try {
        await onAddNewDestination(finalDest);
      } catch (err) {
        console.warn('Error auto-adding destination', err);
      }
    }

    await onSaveTransaction({
      title: extractedData.title,
      amount: extractedData.amount,
      type: extractedData.type,
      destination: finalDest,
      isDeductible: false,
      deductiblePercentage: 0,
      paidBy: extractedData.paidBy || 'general',
      splitRatio: {
        general: 100,
      },
      date: new Date().toISOString().slice(0, 10),
      notes: extractedData.notes,
      voiceRecorded: true,
    });

    onClose();
  };

  if (!isOpen) return null;

  const quickSuggestions = extractedData?.suggestedDestinations?.length
    ? extractedData.suggestedDestinations
    : ['Proyecto', 'Efectivo', 'Producción', 'Lanzamiento', 'Ensayos'];

  return (
    <div
      id="voice-expense-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
    >
      <div
        id="voice-expense-modal"
        className={`w-full max-w-lg rounded-2xl border p-5 sm:p-6 shadow-2xl transition-all max-h-[92vh] overflow-y-auto ${
          darkMode ? 'bg-neutral-900 border-neutral-800 text-neutral-100' : 'bg-white border-neutral-200 text-neutral-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-700/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-neutral-950 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold">Registro por Voz con IA</h3>
              <p className="text-xs text-neutral-400">Reconocimiento en tiempo real y llenado inteligente</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Center Recording Area */}
        <div className="py-4 flex flex-col items-center text-center space-y-3">
          <div className="relative">
            {/* Visual audio pulse & waves */}
            {isRecording && (
              <>
                <div
                  className="absolute -inset-4 rounded-full bg-amber-500/20 animate-ping pointer-events-none"
                  style={{ transform: `scale(${1 + micVolume / 70})` }}
                />
                <div
                  className="absolute -inset-8 rounded-full bg-amber-500/10 pointer-events-none transition-transform duration-75"
                  style={{ transform: `scale(${1 + micVolume / 100})` }}
                />
              </>
            )}

            <button
              id="record-mic-toggle-btn"
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all transform active:scale-95 ${
                isRecording
                  ? 'bg-rose-500 text-white ring-4 ring-rose-500/30 animate-pulse'
                  : 'bg-amber-500 hover:bg-amber-400 text-neutral-950 hover:scale-105'
              } disabled:opacity-50 cursor-pointer`}
              title={isRecording ? 'Presiona para detener y procesar' : 'Presiona para hablar'}
            >
              {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </button>
          </div>

          <div>
            <p className="text-sm font-bold">
              {isRecording
                ? 'Escuchando en tiempo real...'
                : isProcessing
                ? 'Analizando con IA y llenando campos...'
                : extractedData
                ? '¡Datos interpretados! Revisa y confirma abajo'
                : 'Presiona el micrófono para hablar'}
            </p>

            {/* Mic volume bar during recording */}
            {isRecording && (
              <div className="space-y-2 mt-1">
                <div className="w-36 h-1.5 bg-neutral-800 rounded-full mx-auto overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-75"
                    style={{ width: `${Math.max(10, micVolume)}%` }}
                  />
                </div>
                <button
                  id="stop-and-process-btn"
                  type="button"
                  onClick={stopRecording}
                  className="px-4 py-1.5 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold inline-flex items-center gap-1.5 shadow-lg transition-all active:scale-95 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Listo, procesar nota de voz</span>
                </button>
              </div>
            )}

            <p className="text-[11px] text-neutral-400 max-w-sm mt-1 mx-auto leading-relaxed">
              Ejemplo: <span className="font-semibold text-neutral-200">"Ingresaron 11 millones de pesos en efectivos para el proyecto"</span> o <span className="font-semibold text-neutral-200">"Gastamos 500 mil pesos en producción"</span>
            </p>
          </div>

          {/* Editable Live Transcript Box */}
          <div className="w-full text-left space-y-1">
            <div className="flex items-center justify-between text-[11px] text-neutral-400 font-semibold px-1">
              <span className="flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-amber-500" />
                <span>Texto detectado / Transcripción (Editable):</span>
              </span>
              {transcript && !isRecording && !isProcessing && (
                <button
                  type="button"
                  onClick={() => processVoice(transcript)}
                  className="text-amber-400 hover:underline flex items-center gap-1 text-[11px]"
                >
                  <Sparkles className="w-3 h-3" /> Re-procesar con IA
                </button>
              )}
            </div>

            <div className="relative">
              <textarea
                id="voice-transcript-editor"
                rows={2}
                value={transcript + (interimText ? (transcript ? ' ' : '') + interimText : '')}
                onChange={(e) => {
                  setTranscript(e.target.value);
                  setInterimText('');
                }}
                placeholder={isRecording ? 'Habla ahora... las palabras aparecerán aquí en tiempo real' : 'Si no puedes hablar, también puedes escribir tu frase aquí...'}
                className={`w-full px-3 py-2 rounded-xl text-xs font-mono border outline-none resize-none transition-colors ${
                  darkMode
                    ? 'bg-neutral-950/70 border-neutral-700 text-amber-300 focus:border-amber-500'
                    : 'bg-amber-50/70 border-amber-300 text-amber-950 focus:border-amber-500'
                }`}
              />
              {interimText && (
                <span className="absolute right-3 bottom-2 text-[10px] text-amber-400 font-sans italic animate-pulse">
                  Reconociendo...
                </span>
              )}
            </div>
          </div>

          {isProcessing && (
            <div className="flex items-center justify-center gap-2 text-xs text-amber-400 py-1 font-semibold animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Extrayendo valor exacto, tipo de movimiento, concepto y destino...</span>
            </div>
          )}

          {parseError && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/10 text-rose-400 text-xs border border-rose-500/20 text-left w-full">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{parseError}</span>
            </div>
          )}
        </div>

        {/* Extracted Structured Data Form (Quick review before saving) */}
        {extractedData && (
          <div
            className={`p-4 rounded-xl border space-y-3.5 animate-fade-in ${
              darkMode ? 'bg-neutral-950/80 border-neutral-800' : 'bg-neutral-50 border-neutral-200'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-amber-400 border-b border-neutral-800 pb-2">
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Campos Llenados Automáticamente:</span>
              </span>
              <button
                type="button"
                onClick={startRecording}
                className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-current"
              >
                <RotateCcw className="w-3 h-3" /> Grabar de nuevo
              </button>
            </div>

            {/* Movement Type Toggle: Gasto vs Ingreso */}
            <div>
              <label className="block text-neutral-400 font-semibold mb-1 text-xs">Tipo de Movimiento</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="voice-type-expense-btn"
                  onClick={() => setExtractedData({ ...extractedData, type: 'expense' })}
                  className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    extractedData.type === 'expense'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/60 shadow-sm'
                      : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:text-white'
                  }`}
                >
                  <ArrowDownRight className="w-4 h-4" />
                  <span>Gasto (-)</span>
                </button>
                <button
                  type="button"
                  id="voice-type-income-btn"
                  onClick={() => setExtractedData({ ...extractedData, type: 'income' })}
                  className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    extractedData.type === 'income'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/60 shadow-sm'
                      : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:text-white'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Ingreso (+)</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Concept / Title */}
              <div className="sm:col-span-2">
                <label className="block text-neutral-400 font-semibold mb-1">Concepto / Detalle</label>
                <input
                  type="text"
                  id="voice-extracted-title"
                  value={extractedData.title}
                  onChange={(e) => setExtractedData({ ...extractedData, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-white font-medium focus:border-amber-500 outline-none"
                  placeholder="Ej: Efectivo para el proyecto"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-neutral-400 font-semibold mb-1">
                  Monto ({settings.currencySymbol})
                </label>
                <input
                  type="number"
                  id="voice-extracted-amount"
                  step="any"
                  value={extractedData.amount}
                  onChange={(e) => setExtractedData({ ...extractedData, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-white font-bold font-mono focus:border-amber-500 outline-none text-sm"
                />
                <div className="text-[11px] text-amber-400 font-mono mt-1 font-semibold">
                  {settings.currencySymbol} {Number(extractedData.amount || 0).toLocaleString('es-CO')} {settings.currency}
                </div>
              </div>

              {/* Destination / Category */}
              <div>
                <label className="block text-neutral-400 font-semibold mb-1">Destino / Categoría</label>
                <input
                  type="text"
                  id="voice-extracted-dest"
                  list="voice-dest-list"
                  value={extractedData.destination}
                  onChange={(e) => setExtractedData({ ...extractedData, destination: e.target.value })}
                  placeholder="Escribe o selecciona..."
                  className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-white font-medium focus:border-amber-500 outline-none text-xs"
                />
                <datalist id="voice-dest-list">
                  {budgets.map((b) => (
                    <option key={b.id} value={b.destination} />
                  ))}
                  <option value="Proyecto" />
                  <option value="Efectivo" />
                  <option value="Producción" />
                  <option value="Lanzamiento" />
                  <option value="Ensayos" />
                  <option value="General" />
                </datalist>

                {/* Quick suggestions pills */}
                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                  <span className="text-[10px] text-neutral-500 font-medium">Sugerencias:</span>
                  {quickSuggestions.slice(0, 5).map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setExtractedData({ ...extractedData, destination: sug })}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-all ${
                        extractedData.destination.toLowerCase() === sug.toLowerCase()
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                          : 'bg-neutral-800/60 text-neutral-400 border-neutral-700/60 hover:text-white'
                      }`}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-neutral-800/60">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                id="confirm-voice-expense-btn"
                type="button"
                onClick={handleSave}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-98 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Confirmar y Guardar Movimiento</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
