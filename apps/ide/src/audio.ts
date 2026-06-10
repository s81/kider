// audio.ts — Web Audio tone playback for Sprout sound commands.
//
// One shared AudioContext, created lazily on the first tone. Creation always
// happens downstream of a user gesture (Run click, canvas click, key press),
// so the context starts in the "running" state.

let audioCtx: AudioContext | null = null;

const VOLUME = 0.2;
const ATTACK_S = 0.01;
const RELEASE_S = 0.03;

export function playTone(frequency: number, durationMs: number): void {
  if (durationMs <= 0 || frequency <= 0) return;
  if (audioCtx === null) audioCtx = new AudioContext();
  // A suspended context (autoplay policy) can be resumed inside a gesture.
  if (audioCtx.state === 'suspended') void audioCtx.resume();

  const now = audioCtx.currentTime;
  const durationS = durationMs / 1000;

  const osc = audioCtx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = frequency;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(VOLUME, now + Math.min(ATTACK_S, durationS / 2));
  gain.gain.setValueAtTime(VOLUME, now + Math.max(durationS - RELEASE_S, durationS / 2));
  gain.gain.linearRampToValueAtTime(0, now + durationS);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + durationS);
}
