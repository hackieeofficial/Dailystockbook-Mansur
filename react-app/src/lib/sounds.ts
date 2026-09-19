import { useAuthStore } from '../store/useAuthStore';
import { usePreferencesStore } from '../store/usePreferencesStore';

let audioCtx: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

const playTone = (freq: number, type: OscillatorType, duration: number, defaultVol: number, delay: number = 0) => {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return;
    
    const prefs = usePreferencesStore.getState().getPreferences(user.uid);
    if (!prefs.enableSounds) return;

    const vol = defaultVol * prefs.soundVolume; // Scale volume relative to user preference

    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    
    // Envelope to avoid popping
    gainNode.gain.setValueAtTime(0, ctx.currentTime + delay);
    gainNode.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.1);
  } catch (e) {
    // Ignore if audio fails to play
  }
};

export const playRefillSound = () => {
  // Pleasant double ding (success)
  playTone(523.25, 'sine', 0.15, 0.4, 0);    // C5
  playTone(659.25, 'sine', 0.25, 0.4, 0.1);  // E5
};

export const playUndoSound = () => {
  // Falling tone (revert)
  playTone(440, 'triangle', 0.15, 0.2, 0);     // A4
  playTone(349.23, 'triangle', 0.25, 0.2, 0.1); // F4
};

export const playSkipSound = () => {
  // Short neutral bloop
  playTone(300, 'sine', 0.1, 0.2, 0);
};
