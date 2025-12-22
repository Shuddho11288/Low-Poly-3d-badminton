export class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    try {
      // @ts-ignore
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
    } catch (e) {
      console.error("Web Audio API not supported");
      this.enabled = false;
    }
  }

  public resume() {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, vol: number = 0.1) {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  public playHit(isSmash: boolean) {
    // Thwack sound
    const freq = isSmash ? 150 : 200;
    const dur = isSmash ? 0.15 : 0.1;
    this.playTone(freq, 'sawtooth', dur, 0.2);
    // Ping for racket string
    this.playTone(isSmash ? 800 : 1200, 'triangle', 0.1, 0.05);
  }

  public playNetHit() {
    this.playTone(100, 'square', 0.1, 0.1);
  }

  public playBounce() {
    this.playTone(80, 'sine', 0.1, 0.2);
  }

  public playScore(isPlayer: boolean) {
    if (isPlayer) {
      // Happy major chord
      this.playTone(440, 'sine', 0.3, 0.1);
      setTimeout(() => this.playTone(554, 'sine', 0.3, 0.1), 100);
      setTimeout(() => this.playTone(659, 'sine', 0.4, 0.1), 200);
    } else {
      // Sad tone
      this.playTone(300, 'sawtooth', 0.4, 0.1);
      setTimeout(() => this.playTone(250, 'sawtooth', 0.4, 0.1), 200);
    }
  }

  public playStep() {
    // Soft noise-like step (simulated with low sine for thud)
    this.playTone(50 + Math.random() * 20, 'sine', 0.05, 0.05);
  }

  public playWhistle() {
    this.playTone(2000, 'square', 0.1, 0.1);
    setTimeout(() => this.playTone(2000, 'square', 0.3, 0.1), 150);
  }
}

export const soundManager = new SoundManager();