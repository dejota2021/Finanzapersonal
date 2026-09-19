/**
 * Audio / Microphone Stream Singleton Manager
 * Ensures that browser microphone permissions are requested ONLY ONCE.
 * Tracks are muted (enabled = false) between recording sessions instead of being destroyed (.stop()),
 * preventing repeated browser permission prompts on mobile and desktop browsers.
 */

let cachedAudioStream: MediaStream | null = null;
const MIC_GRANTED_STORAGE_KEY = 'sf_mic_permission_granted';

/**
 * Checks if the browser has already granted microphone permission in this session or storage.
 */
export function isMicPermissionGranted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(MIC_GRANTED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Gets the current active live audio stream, or requests permission from the browser ONCE.
 */
export async function getMicrophoneStream(): Promise<MediaStream> {
  if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('El navegador no soporta captura de micrófono');
  }

  // If we already have a stream and its audio track is alive, reuse it directly!
  if (cachedAudioStream) {
    const tracks = cachedAudioStream.getAudioTracks();
    const isLive = tracks.length > 0 && tracks.some((t) => t.readyState === 'live');
    if (isLive) {
      tracks.forEach((t) => {
        t.enabled = true;
      });
      return cachedAudioStream;
    }
  }

  // Request stream from user (first time only)
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    cachedAudioStream = stream;
    try {
      localStorage.setItem(MIC_GRANTED_STORAGE_KEY, 'true');
    } catch {}

    // Listen to track ending (e.g. bluetooth disconnect)
    stream.getAudioTracks().forEach((track) => {
      track.onended = () => {
        if (cachedAudioStream === stream) {
          cachedAudioStream = null;
        }
      };
    });

    return stream;
  } catch (err: any) {
    console.warn('Error requesting microphone access:', err);
    throw err;
  }
}

/**
 * Temporarily pauses/mutes the microphone without stopping tracks or revoking permissions.
 */
export function pauseMicrophoneStream(): void {
  if (!cachedAudioStream) return;
  try {
    cachedAudioStream.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
  } catch (e) {
    console.warn('Error pausing mic stream', e);
  }
}

/**
 * Explicitly release and terminate tracks if the user closes or resets.
 */
export function terminateMicrophoneStream(): void {
  if (!cachedAudioStream) return;
  try {
    cachedAudioStream.getTracks().forEach((track) => {
      track.stop();
    });
  } catch (e) {
    console.warn('Error terminating mic stream', e);
  }
  cachedAudioStream = null;
}
