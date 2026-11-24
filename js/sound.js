// Sound for the workshop: real field recordings (CC0, via the ESC-50 dataset) mixed with a
// few synthesised layers (the pond, the office in the intro, the PC boot). Everything is positioned
// in the stereo field by where it sits in the scene, and the wind follows the same gusts
// that move the trees.
const FILES = ["moo1", "moo2", "moo3", "rooster", "bark", "bark1", "bark2", "bark3", "snore", "birds1", "birds2", "birds3", "crickets", "wind", "diesel", "click", "typing"];

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    try { if (localStorage.getItem("lm-sound") === "off") this.enabled = false; } catch {}
    this.buf = {};
    this.focus = null;
    this.gust = 0.5;
    this.view = { cx: 835, hw: 835 };
    this.drone = { x: 1035, y: 173, near: 0, speed: 0 };
    this.nature = 0;
    // the 3D page sets these: no sprinklers there, and the ambience follows the time of day
    this.scene3d = false;
    this.timeOfDay = 'sunset';
  }

  start() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 1 : 0;
    // gentle glue compressor so layers sit together
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.3;
    this.master.connect(comp).connect(ctx.destination);
    this.amb = ctx.createGain(); this.amb.gain.value = 1; this.amb.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 1; this.sfx.connect(this.master);

    const len = ctx.sampleRate * 4;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    this.brownBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const w = this.noiseBuf.getChannelData(0), b = this.brownBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { w[i] = Math.random() * 2 - 1; last = (last + 0.02 * w[i]) / 1.02; b[i] = last * 3.5; }

    // --- synthesised beds ---
    // the pond: very soft lapping at the bank (a slow swell of filtered water noise), panned right
    this.river = this.bed([
      { buf: this.noiseBuf, type: "bandpass", f: 650, q: 1.2, g: 0.022, wander: [450, 950] },
      { buf: this.noiseBuf, type: "bandpass", f: 1800, q: 2.0, g: 0.008, wander: [1400, 2400] },
    ], 0.55, 0);
    this.sprinklers = this.bed([
      {buf:this.noiseBuf,type:"bandpass",f:3200,q:.7,g:.006},
    ], 0, 0);
    this.sprinklerMotion = 0;
    // the office in the intro: murmur of voices, air-con, the odd keyboard and phone
    this.office = this.bed([
      { buf: this.brownBuf, type: "lowpass", f: 180, g: 0.09 },                                // air-con rumble
      { buf: this.brownBuf, type: "bandpass", f: 420, q: 0.8, g: 0.08, wander: [300, 700] },
      { buf: this.noiseBuf, type: "bandpass", f: 1100, q: 1.6, g: 0.02, wander: [800, 1500] },
      { buf: this.noiseBuf, type: "highpass", f: 5000, q: 0.5, g: 0.005 },
    ], 0, 0);
    // a room full of people talking: several voice-band noises, each chopped at speaking rhythm
    this.babble = [0, 1, 2, 3].map((i) => {
      const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 350 + i * 180; f.Q.value = 3.5;
      const f2 = ctx.createBiquadFilter(); f2.type = "peaking"; f2.frequency.value = 1100 + i * 250; f2.Q.value = 2; f2.gain.value = 8;
      const g = ctx.createGain(); g.gain.value = 0;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 3.2 + i * 0.7;
      const lg = ctx.createGain(); lg.gain.value = 0.02;
      lfo.connect(lg).connect(g.gain); lfo.start();
      const p = ctx.createStereoPanner(); p.pan.value = [-0.6, 0.5, -0.2, 0.75][i];
      s.connect(f).connect(f2).connect(g).connect(p).connect(this.office.out);
      s.start(0, Math.random() * 3);
      return { g, lg };
    });
    this.nextOffice = ctx.currentTime + 0.5;
    // the drone: a thin motor whine (two detuned saws through a band-pass), loudness set by where it is vs. the cursor
    {
      const out = ctx.createGain(); out.gain.value = 0;
      const p = ctx.createStereoPanner(); out.connect(p).connect(this.amb);
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 1.4;
      const oscs = [180, 183.5, 361].map((f) => { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.start(); return o; });
      const og = ctx.createGain(); og.gain.value = 0.03; oscs.forEach((o) => o.connect(og)); og.connect(bp).connect(out);
      const n = ctx.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true; const nf = ctx.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = 2200; nf.Q.value = 2;
      const ng = ctx.createGain(); ng.gain.value = 0.012; n.connect(nf).connect(ng).connect(out); n.start();
      this.droneSnd = { out, p, oscs };
    }
    // leaves: a soft rustle (filtered noise) that rises and falls with the gusts
    this.rustle = this.bed([
      { buf: this.noiseBuf, type: "bandpass", f: 3800, q: 0.7, g: 0.03, wander: [2800, 5200] },
      { buf: this.noiseBuf, type: "highpass", f: 7000, q: 0.5, g: 0.008 },
    ], 0.3, 0);
    this.nextChime = ctx.currentTime + 6;
    this.nextFarm = ctx.currentTime + 12;
    this.nextBird = ctx.currentTime + 1.5;
    this.nextRooster = ctx.currentTime + 18 + Math.random() * 30;

    FILES.forEach((n) => fetch(`assets/audio/${n}.mp3`).then((r) => r.arrayBuffer()).then((a) => new Promise((res, rej) => ctx.decodeAudioData(a, res, rej))).then((bf) => {
      this.buf[n] = bf;
      if (n === "wind") this.wind = this.sampleLoop("wind", 0.0, -0.2);
      if (n === "crickets") this.crickets = this.sampleLoop("crickets", 0.0, 0.25);
    }).catch(() => {}));
  }

  bed(layers, pan = 0, gain = 1) {
    const ctx = this.ctx;
    const out = ctx.createGain(); out.gain.value = 0;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; out.connect(p).connect(this.amb); } else out.connect(this.amb);
    const filters = [];
    layers.forEach((L) => {
      const s = ctx.createBufferSource(); s.buffer = L.buf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = L.type; f.frequency.value = L.f; if (L.q) f.Q.value = L.q;
      const g = ctx.createGain(); g.gain.value = L.g;
      s.connect(f).connect(g).connect(out); s.start(0, Math.random() * 3);
      filters.push({ f, L });
    });
    if (gain) out.gain.linearRampToValueAtTime(gain, ctx.currentTime + 3);
    return { out, pan: p, filters, base: gain };
  }

  sampleLoop(name, gain, pan) {
    const ctx = this.ctx, b = this.buf[name];
    const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.loopStart = 0.06; s.loopEnd = b.duration - 0.06;
    const g = ctx.createGain(); g.gain.value = 0;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; s.connect(g).connect(p).connect(this.amb); } else s.connect(g).connect(this.amb);
    s.start(0, 0.06);
    return { g, s };
  }

  toggle() {
    this.enabled = !this.enabled;
    try { localStorage.setItem("lm-sound", this.enabled ? "on" : "off"); } catch {}
    if (this.master) this.master.gain.setTargetAtTime(this.enabled ? 1 : 0, this.ctx.currentTime, 0.05);
    return this.enabled;
  }
  get ok() { return this.ctx && this.enabled; }

  /** stereo position from a point in the photo (image px) given the current view */
  panAt(x) { return Math.max(-0.9, Math.min(0.9, (x - this.view.cx) / (this.view.hw * 1.1))); }

  /** one-shot sample with pan, gain, optional lowpass (distance) and rate */
  play(name, { gain = 0.5, pan = 0, lp = 0, rate = 1, offset = 0, dur, bus } = {}) {
    if (!this.ok || !this.buf[name]) return null;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.buf[name]; s.playbackRate.value = rate;
    let node = s;
    if (lp) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp; node.connect(f); node = f; }
    const g = ctx.createGain(); g.gain.value = gain; node.connect(g); node = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); node = p; }
    node.connect(bus || this.sfx);
    if (dur) { g.gain.setValueAtTime(gain, t + dur - 0.03); g.gain.linearRampToValueAtTime(0, t + dur); s.start(t, offset, dur); } else s.start(t, offset);
    return { s, g };
  }

  setFocus(id) { this.focus = id; }

  /** per frame: ambience levels follow the gusts, what you're looking at, and random life */
  update(dt) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const f = this.focus;
    const lvl = (node, v, tc = 0.4) => node && node.gain.setTargetAtTime(v, t, tc);
    const N = this.nature; // crossfade office -> nature when the headset goes on
    if (this.wind) lvl(this.wind.g, N * (0.10 + 0.30 * this.gust) * (f === "monitor" ? 0.4 : 1), 0.6);
    const tod = this.scene3d ? this.timeOfDay : 'sunset';
    const crick = { night: 1.6, sunset: 0.9, sunrise: 0.3, day: 0.12 }[tod] ?? 1;
    if (this.crickets) lvl(this.crickets.g, N * crick * (f === "monitor" ? 0.012 : 0.03), 1);
    // the lapping swells and settles slowly
    const lap = 0.6 + 0.4 * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1);
    lvl(this.river.out, N * lap * (f === "monitor" ? 0.25 : 1), 0.5);
    if (this.river.pan) this.river.pan.pan.setTargetAtTime(this.panAt(1400), t, 0.3);
    lvl(this.sprinklers.out, this.scene3d ? 0 : N * (0.35 + .15 * Math.sin((this.sprinklerMotion || 0) * .43)) * (f === "monitor" ? .2 : 1), .5);
    if(this.sprinklers.pan)this.sprinklers.pan.pan.setTargetAtTime(this.panAt(900),t,.3);
    lvl(this.office.out, (1 - N) * 1.0, N > 0.02 ? 0.6 : 0.15);
    // voices come and go in waves
    this.babble.forEach((b, i) => b.g.gain.setTargetAtTime(Math.max(0, Math.sin(t * (0.21 + i * 0.07) + i * 1.7)) * 0.03, t, 0.5));
    lvl(this.rustle.out, N * (0.15 + 0.85 * this.gust * this.gust) * (f === "monitor" ? 0.3 : 1), 0.4);
    if (this.droneSnd) {
      lvl(this.droneSnd.out, N * ((this.scene3d ? 0 : 0.1) + 0.9 * this.drone.near) * 0.5 * (f === "monitor" ? 0.2 : 1), 0.3);
      this.droneSnd.p.pan.setTargetAtTime(this.panAt(this.drone.x), t, 0.2);
      const pitch = 1 + (this.drone.speed || 0) * 0.004;
      this.droneSnd.oscs.forEach((o, i) => o.frequency.setTargetAtTime([180, 183.5, 361][i] * pitch, t, 0.2));
    }
    [this.river, this.office, this.rustle].forEach((bd) => bd.filters.forEach(({ f: fl, L }) => { if (L.wander && Math.random() < dt * 2) fl.frequency.setTargetAtTime(L.wander[0] + Math.random() * (L.wander[1] - L.wander[0]), t, 0.4); }));
    if (!this.ok) return;
    if (N < 0.5) {
      // office life: bursts of typing somewhere nearby, a distant phone now and then
      if (t > this.nextOffice) {
        const b = this.buf.typing;
        const r = Math.random();
        if (b && r < 0.7) this.play("typing", { gain: 0.16 + Math.random() * 0.14, pan: Math.random() * 1.4 - 0.7, lp: 3500, offset: Math.random() * (b.duration - 1), dur: 0.6 + Math.random() * 1.2, bus: this.office.out });
        else if (r < 0.85) this.ring();
        else if (this.buf.click) this.play("click", { gain: 0.2, pan: Math.random() * 1.2 - 0.6, lp: 3000, bus: this.office.out });
        this.nextOffice = t + 0.5 + Math.random() * 1.4;
      }
      return;
    }
    if (t > this.nextBird && tod === 'night') this.nextBird = t + 20;      // no birdsong at night
    if (t > this.nextBird) {
      const n = ["birds1", "birds2", "birds3"][Math.floor(Math.random() * 3)];
      this.play(n, { gain: (0.10 + Math.random() * 0.16) * (f === "monitor" ? 0.35 : 1), pan: Math.random() * 1.6 - 0.8, lp: 3000 + Math.random() * 6000, bus: this.amb, rate: 0.96 + Math.random() * 0.08 });
      this.nextBird = t + (tod === 'sunrise' ? 3 + Math.random() * 5 : 6 + Math.random() * 10);   // a dawn chorus at sunrise
    }
    // wind chimes: a few soft notes when a gust picks up
    if (t > this.nextChime) {
      if (this.gust > 0.55) this.chimes(Math.round(1 + this.gust * 3));
      this.nextChime = t + 2.5 + Math.random() * 5;
    }
    // the farm: distant cows, a dog from the farmhouse
    if (t > this.nextFarm) {
      const r = Math.random();
      if (r < 0.6) this.moo(820 + Math.random() * 300, 4);
      else this.play(["bark1", "bark3"][Math.floor(Math.random() * 2)], { gain: 0.05, pan: this.panAt(1450), lp: 1400, bus: this.amb, rate: 0.9 + Math.random() * 0.2 });
      this.nextFarm = t + 14 + Math.random() * 20;
    }
    if (t > this.nextRooster) {
      if (tod !== 'night') this.play("rooster", { gain: 0.07, pan: this.panAt(940), lp: 2200, bus: this.amb });
      this.nextRooster = t + (tod === 'sunrise' ? 35 + Math.random() * 40 : 90 + Math.random() * 120);
    }
  }

  /** a muffled desk phone across the office */
  ring() {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime, pan = Math.random() * 1.2 - 0.6;
    for (let k = 0; k < 2; k++) {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(); o.frequency.value = 440; o2.frequency.value = 480;
      const g = ctx.createGain(); const t0 = t + k * 0.45;
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.03, t0 + 0.02); g.gain.setValueAtTime(0.03, t0 + 0.35); g.gain.linearRampToValueAtTime(0.0001, t0 + 0.38);
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1500;
      const p = ctx.createStereoPanner(); p.pan.value = pan;
      o.connect(g); o2.connect(g); g.connect(lp).connect(p).connect(this.office.out);
      o.start(t0); o2.start(t0); o.stop(t0 + 0.4); o2.stop(t0 + 0.4);
    }
  }
  /** the headset going on: fabric rustle, a soft thud of padding, then the world opens up */
  headset() {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 0.8;
    f.frequency.setValueAtTime(2500, t); f.frequency.exponentialRampToValueAtTime(600, t + 1.4);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    s.connect(f).connect(g).connect(this.sfx); s.start(t, 0, 1.6);
    const th = ctx.createOscillator(); th.frequency.setValueAtTime(110, t + 1.45); th.frequency.exponentialRampToValueAtTime(55, t + 1.65);
    const tg = ctx.createGain(); tg.gain.setValueAtTime(0.0001, t + 1.45); tg.gain.exponentialRampToValueAtTime(0.08, t + 1.48); tg.gain.exponentialRampToValueAtTime(0.0001, t + 1.75);
    th.connect(tg).connect(this.sfx); th.start(t + 1.45); th.stop(t + 1.8);
  }
  tick({ gain, pan }) {
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = "bandpass"; fl.frequency.value = 2400 + Math.random() * 600; fl.Q.value = 1.5;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    s.connect(fl).connect(g); if (p) { p.pan.value = pan; g.connect(p).connect(this.amb); } else g.connect(this.amb);
    s.start(t, Math.random() * 3, 0.09);
  }

  burst({ freq = 2500, q = 2, gain = 0.25, dur = 0.03, type = "bandpass", when = 0, bus } = {}) {
    if (!this.ok) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus || this.sfx);
    src.start(t, Math.random() * 3, dur + 0.02);
  }

  click() { if (!this.play("click", { gain: 0.35, rate: 0.95 + Math.random() * 0.1 })) this.burst({ freq: 3200, q: 3, gain: 0.3, dur: 0.025 }); }
  key() {
    const b = this.buf.typing;
    if (b) this.play("typing", { gain: 0.5, offset: Math.random() * (b.duration - 0.2), dur: 0.11, rate: 0.95 + Math.random() * 0.1 });
    else this.burst({ freq: 1800 + Math.random() * 600, q: 2, gain: 0.3, dur: 0.035 });
  }

  whoosh() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource(); src.buffer = this.brownBuf;
    const f = this.ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 0.7;
    f.frequency.setValueAtTime(180, t); f.frequency.exponentialRampToValueAtTime(700, t + 0.6); f.frequency.exponentialRampToValueAtTime(220, t + 1.2);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    src.connect(f).connect(g).connect(this.sfx); src.start(t, 0, 1.3);
  }

  /** the computer waking: power click, fans spinning up, drive chatter, POST beep */
  boot() {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime;
    this.play("click", { gain: 0.5, rate: 0.8 });
    // fan spin-up
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 2;
    f.frequency.setValueAtTime(250, t + 0.1); f.frequency.exponentialRampToValueAtTime(1500, t + 1.6); f.frequency.exponentialRampToValueAtTime(900, t + 3.2);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.9); g.gain.exponentialRampToValueAtTime(0.025, t + 2.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
    s.connect(f).connect(g).connect(this.sfx); s.start(t + 0.1); s.stop(t + 3.7);
    const whine = ctx.createOscillator(); whine.type = "sine";
    whine.frequency.setValueAtTime(90, t + 0.1); whine.frequency.exponentialRampToValueAtTime(380, t + 1.5);
    const wg = ctx.createGain(); wg.gain.setValueAtTime(0.0001, t); wg.gain.exponentialRampToValueAtTime(0.012, t + 1.2); wg.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    whine.connect(wg).connect(this.sfx); whine.start(t + 0.1); whine.stop(t + 3.3);
    // drive chatter
    for (let i = 0; i < 14; i++) this.burst({ freq: 3500 + Math.random() * 2500, q: 4, gain: 0.05 + Math.random() * 0.05, dur: 0.012, when: 0.5 + Math.random() * 1.6 });
    // single POST beep
    const o = ctx.createOscillator(); o.type = "square"; o.frequency.value = 1000;
    const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t + 1.0); og.gain.setValueAtTime(0.03, t + 1.01); og.gain.setValueAtTime(0.03, t + 1.15); og.gain.linearRampToValueAtTime(0.0001, t + 1.17);
    const ol = ctx.createBiquadFilter(); ol.type = "lowpass"; ol.frequency.value = 2500;
    o.connect(ol).connect(og).connect(this.sfx); o.start(t + 1.0); o.stop(t + 1.2);
  }

  /** soft start-up chord when the desktop appears */
  chime() {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.05;
    [[261.6, 0], [392.0, 0.08], [493.9, 0.16], [587.3, 0.26], [784.0, 0.4]].forEach(([fr, d]) => {
      const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = fr;
      const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = fr * 2.003;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.05, t + d + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 2.6);
      const g2 = ctx.createGain(); g2.gain.value = 0.25;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
      o.connect(g); o2.connect(g2).connect(g); g.connect(lp).connect(this.sfx);
      o.start(t + d); o2.start(t + d); o.stop(t + d + 2.7); o2.stop(t + d + 2.7);
    });
  }

  diesel() {
    const b = this.buf.diesel;
    if (!b || !this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = b; s.loop = true;
    s.playbackRate.setValueAtTime(0.8, t); s.playbackRate.linearRampToValueAtTime(1.0, t + 0.5); s.playbackRate.linearRampToValueAtTime(1.35, t + 1.2); s.playbackRate.linearRampToValueAtTime(0.95, t + 2.4);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.25); g.gain.setValueAtTime(0.5, t + 2.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1400;
    const p = ctx.createStereoPanner(); p.pan.value = this.panAt(510);
    s.connect(lp).connect(g).connect(p).connect(this.sfx); s.start(t); s.stop(t + 3.3);
  }

  /** synthesised supercar rev (no recording used) */
  v8() {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime, dur = 2.0;
    const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.16, t + 0.08); out.gain.setValueAtTime(0.16, t + dur * 0.7); out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
    const sh = ctx.createWaveShaper(); const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) c[i] = Math.tanh(((i / 1023) * 2 - 1) * 3); sh.curve = c;
    const p = ctx.createStereoPanner(); p.pan.value = this.panAt(238);
    sh.connect(lp).connect(out).connect(p).connect(this.sfx);
    [1, 0.5, 1.5].forEach((m, i) => {
      const o = ctx.createOscillator(); o.type = i === 1 ? "square" : "sawtooth";
      o.frequency.setValueAtTime(70 * m, t); o.frequency.exponentialRampToValueAtTime(320 * m, t + dur * 0.35); o.frequency.exponentialRampToValueAtTime(78 * m, t + dur);
      const og = ctx.createGain(); og.gain.value = i ? 0.25 : 0.5;
      o.connect(og).connect(sh); o.start(t); o.stop(t + dur + 0.05);
    });
  }

  /** each of the three dogs has its own voice */
  dog(i, x = 250) {
    const n = ["bark1", "bark2", "bark3"][i];
    if (!this.play(n, { gain: [0.5, 0.55, 0.45][i], pan: this.panAt(x), rate: [1.0, 0.92, 1.12][i] })) this.bark();
  }
  /** a few soft, randomly struck chime tubes (pentatonic, long ring) */
  chimes(n = 2) {
    if (!this.ok) return;
    const ctx = this.ctx, notes = [880, 987.8, 1174.7, 1318.5, 1568, 1760];
    for (let k = 0; k < n; k++) {
      const t = ctx.currentTime + k * (0.12 + Math.random() * 0.25), f = notes[Math.floor(Math.random() * notes.length)];
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.018, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      const p = ctx.createStereoPanner(); p.pan.value = this.panAt(1530) * 0.8;
      [1, 2.76, 5.4].forEach((m, j) => { const o = ctx.createOscillator(); o.frequency.value = f * m; const og = ctx.createGain(); og.gain.value = [1, 0.35, 0.12][j]; o.connect(og).connect(g); o.start(t); o.stop(t + 3.3); });
      g.connect(p).connect(this.amb);
    }
  }
  bark() { if (!this.play("bark", { gain: 0.55, pan: this.panAt(236) })) this.burst({ freq: 700, q: 3, gain: 0.3, dur: 0.12 }); }
  snore(near) { this.play("snore", { gain: near ? 0.32 : 0.05, pan: this.panAt(236), lp: near ? 0 : 1800, bus: this.amb }); }
  moo(x = 760, dist = 1) {
    const n = ["moo1", "moo2", "moo3"][Math.floor(Math.random() * 3)];
    this.play(n, { gain: 0.3 / Math.max(1, dist), pan: this.panAt(x), lp: 1400 + 2600 / Math.max(1, dist), bus: this.amb, rate: 0.94 + Math.random() * 0.1 });
  }
  splash() {
    for (let i = 0; i < 5; i++) this.burst({ freq: 700 + Math.random() * 1800, q: 1.1, gain: 0.22, dur: 0.2, when: i * 0.07 });
  }
  /** stepper motors of the 3D printer */
  printer() {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "square";
    [420, 560, 380, 720, 520, 640, 460].forEach((f, i) => o.frequency.setValueAtTime(f, t + i * 0.22));
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.025, t + 0.05); g.gain.setValueAtTime(0.025, t + 1.45); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 1.2;
    const p = ctx.createStereoPanner(); p.pan.value = this.panAt(420);
    o.connect(bp).connect(g).connect(p).connect(this.sfx); o.start(t); o.stop(t + 1.65);
  }
  /** home-lab: a burst of drive activity */
  rack() { for (let i = 0; i < 18; i++) this.burst({ freq: 3000 + Math.random() * 3000, q: 4, gain: 0.04 + Math.random() * 0.04, dur: 0.012, when: Math.random() * 1.2 }); }

  // small game sounds (used by the OS games via postMessage)
  jump() {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = "square";
    o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.12);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g).connect(this.sfx); o.start(t); o.stop(t + 0.16);
  }
  crash() { this.burst({ freq: 300, q: 0.7, gain: 0.5, dur: 0.4, type: "lowpass" }); }
  boom() { this.burst({ freq: 150, q: 0.5, gain: 0.6, dur: 0.6, type: "lowpass" }); }
}
