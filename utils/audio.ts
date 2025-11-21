
export class SoundManager {
  ctx: AudioContext;
  masterGain: GainNode;
  
  // Thrust
  thrustGain: GainNode | null = null;
  thrustSource: AudioBufferSourceNode | null = null;
  
  // Laser
  laserOsc: OscillatorNode | null = null;
  laserGain: GainNode | null = null;
  laserLfo: OscillatorNode | null = null;

  // Alien
  alienHumOsc: OscillatorNode | null = null;
  alienHumGain: GainNode | null = null;

  private initialized: boolean = false;

  constructor() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.25; // Master volume
    this.masterGain.connect(this.ctx.destination);
  }

  // Call this on first user interaction to unlock audio context
  resume() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.initialized = true;
  }

  // Create a noise buffer (White noise)
  private createNoiseBuffer() {
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds buffer
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  startThrust() {
    if (!this.initialized) this.resume();
    if (this.thrustGain) return; // Already playing

    // Create brown/pinkish noise by filtering white noise
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    noise.loop = true;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 150; // Deep rumble

    const gain = this.ctx.createGain();
    gain.gain.value = 0; 
    
    // Smooth attack
    gain.gain.setTargetAtTime(0.8, this.ctx.currentTime, 0.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    noise.start();
    
    this.thrustSource = noise;
    this.thrustGain = gain;
  }

  stopThrust() {
    if (this.thrustGain) {
      // Smooth release
      this.thrustGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      
      const oldSource = this.thrustSource;
      const oldGain = this.thrustGain;
      
      setTimeout(() => {
        oldSource?.stop();
        oldSource?.disconnect();
        oldGain?.disconnect();
      }, 200);
      
      this.thrustSource = null;
      this.thrustGain = null;
    }
  }

  startLaser() {
    if (!this.initialized) this.resume();
    if (this.laserOsc) return;

    // Main tone - Sawtooth for a buzzy/electric sound
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 100; // Low hum

    // LFO for that "pulsing" sci-fi beam effect
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 30; // Fast wobble
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 10; // Modulation depth

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.15, this.ctx.currentTime, 0.05); // Fast attack

    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    lfo.start();

    this.laserOsc = osc;
    this.laserGain = gain;
    this.laserLfo = lfo;
  }

  stopLaser() {
    if (this.laserGain) {
        this.laserGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
        
        const oldOsc = this.laserOsc;
        const oldGain = this.laserGain;
        const oldLfo = this.laserLfo;

        setTimeout(() => {
            oldOsc?.stop();
            oldOsc?.disconnect();
            oldLfo?.stop();
            oldLfo?.disconnect();
            oldGain?.disconnect();
        }, 100);
        
        this.laserOsc = null;
        this.laserGain = null;
        this.laserLfo = null;
    }
  }

  startAlienHum() {
    if (!this.initialized) this.resume();
    if (this.alienHumGain) return;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 400;

    // LFO for tremolo/warble
    const lfo = this.ctx.createOscillator();
    lfo.type = 'triangle';
    lfo.frequency.value = 10;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 50;

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.1, this.ctx.currentTime, 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain);
    lfo.start();
    osc.start();

    this.alienHumOsc = osc;
    this.alienHumGain = gain;
  }

  stopAlienHum() {
    if (this.alienHumGain) {
        this.alienHumGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
        const oldOsc = this.alienHumOsc;
        const oldGain = this.alienHumGain;
        setTimeout(() => {
            oldOsc?.stop();
            oldOsc?.disconnect();
            oldGain?.disconnect();
        }, 500);
        this.alienHumOsc = null;
        this.alienHumGain = null;
    }
  }

  playAlienZap() {
    if (!this.initialized) this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.linearRampToValueAtTime(200, t + 0.1);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(t + 0.1);
  }

  playExplosion() {
    if (!this.initialized) this.resume();
    const t = this.ctx.currentTime;
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.6); // Filter sweep down
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    noise.start();
    noise.stop(t + 0.7);
  }

  playCollect() {
    if (!this.initialized) this.resume();
    const t = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(1800, t + 0.1);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(t + 0.15);
  }
}