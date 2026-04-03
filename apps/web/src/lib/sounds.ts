/**
 * Lightweight sound effects using Web Audio API.
 * No audio files needed — all synthesized.
 *
 * Routes through the shared AudioContext and sfxBus so all
 * synth SFX respect the global volume / mute controls.
 */

import { getAudioContext, ensureResumed, getSfxBus } from "@/lib/audio/context";
import { initVolume } from "@/lib/audio/volume";
import { duck } from "@/lib/audio/music";

function play(fn: (ac: AudioContext, dest: AudioNode) => void) {
  try {
    const ac = getAudioContext();
    ensureResumed();
    initVolume();
    fn(ac, getSfxBus());
    duck(400);
  } catch {
    // Audio not available — silent fail
  }
}

/** Short click/tap sound */
export function sfxClick() {
  play((ac, dest) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ac.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.08);
    osc.connect(gain).connect(dest);
    osc.start();
    osc.stop(ac.currentTime + 0.08);
  });
}

/** Whoosh sound for submissions */
export function sfxWhoosh() {
  play((ac, dest) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ac.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.2);
    osc.connect(gain).connect(dest);
    osc.start();
    osc.stop(ac.currentTime + 0.2);
  });
}

/** Countdown tick for last seconds */
export function sfxTick() {
  play((ac, dest) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1000, ac.currentTime);
    gain.gain.setValueAtTime(0.1, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.05);
    osc.connect(gain).connect(dest);
    osc.start();
    osc.stop(ac.currentTime + 0.05);
  });
}

/** Rising reveal sound */
export function sfxReveal() {
  play((ac, dest) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(300, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, ac.currentTime + 0.4);
    gain.gain.setValueAtTime(0.15, ac.currentTime);
    gain.gain.setValueAtTime(0.15, ac.currentTime + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5);
    osc.connect(gain).connect(dest);
    osc.start();
    osc.stop(ac.currentTime + 0.5);
  });
}

/** Winner fanfare — three ascending notes */
export function sfxFanfare() {
  play((ac, dest) => {
    const notes = [523, 659, 784]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "triangle";
      const t = ac.currentTime + i * 0.15;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
      gain.gain.setValueAtTime(0.15, t + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain).connect(dest);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  });
}

/** Score increment blip */
export function sfxScore() {
  play((ac, dest) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, ac.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
    osc.connect(gain).connect(dest);
    osc.start();
    osc.stop(ac.currentTime + 0.15);
  });
}

/** Countdown urgent beep — for last 5 seconds */
export function sfxUrgent() {
  play((ac, dest) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(880, ac.currentTime);
    gain.gain.setValueAtTime(0.08, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.1);
    osc.connect(gain).connect(dest);
    osc.start();
    osc.stop(ac.currentTime + 0.1);
  });
}

/** Drumroll — rising noise burst before a reveal */
export function sfxDrumroll() {
  play((ac, dest) => {
    const t = ac.currentTime;
    // Snare-like noise bursts that accelerate (exponential decay spacing)
    const delays = [0, 0.10, 0.19, 0.27, 0.33, 0.38, 0.42, 0.45];
    for (let i = 0; i < 8; i++) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "triangle";
      const delay = delays[i];
      const freq = 200 + i * 30;
      osc.frequency.setValueAtTime(freq, t + delay);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + delay + 0.04);
      gain.gain.setValueAtTime(0.06 + i * 0.01, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.06);
      osc.connect(gain).connect(dest);
      osc.start(t + delay);
      osc.stop(t + delay + 0.06);
    }
  });
}

/** Answer pop — punchy sound when an answer card appears */
export function sfxAnswerPop() {
  play((ac, dest) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(500, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ac.currentTime + 0.05);
    osc.frequency.exponentialRampToValueAtTime(600, ac.currentTime + 0.12);
    gain.gain.setValueAtTime(0.15, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
    osc.connect(gain).connect(dest);
    osc.start();
    osc.stop(ac.currentTime + 0.15);
  });
}

/** Sandhed: side switch whoosh — quick swooping pitch slide */
export function sfxSwitch() {
  play((ac, dest) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ac.currentTime + 0.12);
    osc.frequency.exponentialRampToValueAtTime(800, ac.currentTime + 0.25);
    gain.gain.setValueAtTime(0.1, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3);
    osc.connect(gain).connect(dest);
    osc.start();
    osc.stop(ac.currentTime + 0.3);
  });
}

/** Sandhed: correct answer — bright ascending ding */
export function sfxCorrect() {
  play((ac, dest) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(523, ac.currentTime); // C5
    osc.frequency.setValueAtTime(659, ac.currentTime + 0.1); // E5
    gain.gain.setValueAtTime(0.15, ac.currentTime);
    gain.gain.setValueAtTime(0.15, ac.currentTime + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.35);
    osc.connect(gain).connect(dest);
    osc.start();
    osc.stop(ac.currentTime + 0.35);
  });
}

/** Sandhed: wrong answer — descending buzz */
export function sfxWrong() {
  play((ac, dest) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(300, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ac.currentTime + 0.25);
    gain.gain.setValueAtTime(0.08, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3);
    osc.connect(gain).connect(dest);
    osc.start();
    osc.stop(ac.currentTime + 0.3);
  });
}

/** Sandhed: no-answer shame — descending wah-wah */
export function sfxShame() {
  play((ac, dest) => {
    const t = ac.currentTime;
    [400, 350, 300].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "triangle";
      const start = t + i * 0.2;
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, start + 0.18);
      gain.gain.setValueAtTime(0.1, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      osc.connect(gain).connect(dest);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  });
}

/** Sandhed: avatar hops forward on track */
export function sfxHop() {
  play((ac, dest) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(700, ac.currentTime + 0.08);
    osc.frequency.exponentialRampToValueAtTime(500, ac.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.18);
    osc.connect(gain).connect(dest);
    osc.start();
    osc.stop(ac.currentTime + 0.18);
  });
}

/** Crowd reaction — warm layered "ooh" shimmer */
export function sfxCrowdReact() {
  play((ac, dest) => {
    const t = ac.currentTime;
    // Layer several detuned tones with vibrato for a "crowd murmur" feel
    const freqs = [280, 350, 420, 330];
    freqs.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq + (i * 7), t);
      osc.frequency.setValueAtTime(freq + 20, t + 0.2);
      osc.frequency.setValueAtTime(freq - 10, t + 0.4);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.04, t + 0.05 + i * 0.03);
      gain.gain.setValueAtTime(0.04, t + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.connect(gain).connect(dest);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  });
}

/** Vote result whoosh — dramatic percentage bar fill */
export function sfxVoteReveal() {
  play((ac, dest) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ac.currentTime + 0.3);
    gain.gain.setValueAtTime(0.06, ac.currentTime);
    gain.gain.setValueAtTime(0.06, ac.currentTime + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.35);
    osc.connect(gain).connect(dest);
    osc.start();
    osc.stop(ac.currentTime + 0.35);
  });
}
