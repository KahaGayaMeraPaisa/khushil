/* ========= 1. PROCEDURAL GAME-GRADE WEB AUDIO SFX ENGINE ========= */
const SFX = (() => {
  let ctx = null;
  let enabled = localStorage.getItem('khushil_sfx') !== '0';
  let ringIv = null;

  function ensure() {
    if (!enabled) return null;
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch { return null; }
  }

  function tone(freq, endFreq, dur, type = 'sine', vol = 0.14, delay = 0) {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, freq, q, vol, delay = 0) {
    const c = ensure();
    if (!c) return;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.8);
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = c.createGain();
    const t = c.currentTime + delay;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(g).connect(c.destination);
    src.start(t);
  }

  return {
    isEnabled: () => enabled,
    setEnabled(v) { enabled = !!v; localStorage.setItem('khushil_sfx', enabled ? '1' : '0'); if (enabled) ensure(); },
    unlock: ensure,
    tap() { tone(520, 740, 0.06, 'triangle', 0.07); },
    send() { tone(440, 880, 0.12, 'sine', 0.11); tone(660, 1120, 0.12, 'triangle', 0.08, 0.04); },
    receive() { tone(780, 1040, 0.14, 'sine', 0.12); tone(1040, 1320, 0.18, 'sine', 0.11, 0.09); },
    snap() { noise(0.09, 2600, 1.2, 0.2); tone(900, 320, 0.08, 'triangle', 0.12); },
    drop() { tone(360, 140, 0.11, 'sine', 0.14); },
    win() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, f * 1.02, 0.25, 'triangle', 0.14, i * 0.09));
    },
    heartbeat() {
      tone(92, 42, 0.14, 'sine', 0.26, 0);
      tone(108, 46, 0.18, 'sine', 0.3, 0.16);
    },
    ringStart() {
      this.ringStop();
      const chime = () => {
        tone(659.25, 659.25, 0.22, 'sine', 0.15, 0);
        tone(880, 880, 0.28, 'sine', 0.15, 0.22);
        tone(1174.66, 1174.66, 0.35, 'triangle', 0.12, 0.44);
        if (navigator.vibrate) navigator.vibrate([220, 140, 220]);
      };
      chime();
      ringIv = setInterval(chime, 1800);
    },
    ringStop() {
      clearInterval(ringIv);
      ringIv = null;
    },
    fireworkWhistle() {
      tone(700 + Math.random() * 400, 1900 + Math.random() * 500, 0.42, 'sine', 0.045);
    },
    fireworkBoom(power = 1, isHeart = false) {
      // Deep realistic chest-thump detonation + sub-bass rumble + high crackle
      tone(125 * power, 24, 0.55, 'sine', 0.32);
      tone(70, 22, 0.72, 'triangle', 0.24, 0.03);
      noise(0.45, isHeart ? 1400 : 950, 0.7, 0.26, 0.02);
      // Shimmer crackles after main burst
      for (let i = 0; i < 4; i++) {
        noise(0.14, 2400 + Math.random() * 2400, 2.5, 0.09, 0.12 + Math.random() * 0.32);
      }
    }
  };
})();

/* ========= 2. AMBIENT HIGH-TECH STARFIELD & NEBULA BACKDROP ========= */
(function initBackdrop() {
  const canvas = document.getElementById('bg-fx-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0;
  const stars = [];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 75; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.6 + Math.random() * 1.8,
      vx: (Math.random() - 0.5) * 0.18,
      vy: -0.08 - Math.random() * 0.24,
      tw: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.5 ? 335 : 192
    });
  }

  let t = 0;
  function frame() {
    t += 0.008;
    ctx.clearRect(0, 0, w, h);

    // Subtle moving aurora blobs
    const g1 = ctx.createRadialGradient(
      w * (0.25 + Math.sin(t) * 0.14), h * (0.18 + Math.cos(t * 0.8) * 0.08), 10,
      w * 0.3, h * 0.2, w * 0.75
    );
    g1.addColorStop(0, 'rgba(255, 62, 138, 0.16)');
    g1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, w, h);

    const g2 = ctx.createRadialGradient(
      w * (0.78 + Math.cos(t * 0.9) * 0.12), h * (0.72 + Math.sin(t * 0.7) * 0.1), 10,
      w * 0.75, h * 0.75, w * 0.75
    );
    g2.addColorStop(0, 'rgba(56, 232, 255, 0.13)');
    g2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, w, h);

    for (const s of stars) {
      s.x += s.vx; s.y += s.vy; s.tw += 0.04;
      if (s.y < -10) { s.y = h + 10; s.x = Math.random() * w; }
      if (s.x < -10) s.x = w + 10;
      if (s.x > w + 10) s.x = -10;
      const alpha = 0.28 + 0.55 * (0.5 + 0.5 * Math.sin(s.tw));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${s.hue}, 100%, 82%, ${alpha})`;
      ctx.fill();
    }
    requestAnimationFrame(frame);
  }
  frame();
})();

/* ========= 3. FLOATING SCREEN PARTICLE BURSTS ========= */
function spawnFloatingFX(kind = 'hearts', count = 14) {
  const layer = document.getElementById('float-fx-layer');
  if (!layer) return;
  const sets = {
    hearts: ['💖', '💘', '✨', '❤️‍🔥', '💕'],
    sparks: ['🎆', '✨', '🌟', '💫', '🔥'],
    win: ['🏆', '🎉', '✨', '💖', '⭐']
  };
  const emojis = sets[kind] || sets.hearts;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'float-particle';
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = (10 + Math.random() * 80) + '%';
    el.style.bottom = (8 + Math.random() * 25) + '%';
    el.style.animationDelay = (Math.random() * 0.45) + 's';
    el.style.fontSize = (20 + Math.random() * 18) + 'px';
    layer.appendChild(el);
    setTimeout(() => el.remove(), 2700);
  }
}

/* ========= 4. GRAND REALISTIC MULTI-STAGE PYROTECHNICS ENGINE ========= */
const FireworksEngine = (() => {
  const overlay = document.getElementById('fireworks-overlay');
  const canvas = document.getElementById('fw-canvas');
  const ctx = canvas.getContext('2d');
  let active = false, raf = null, timerIv = null, launchIv = null;
  let rockets = [], particles = [], flashes = [], skyStars = [];
  let soundOn = true, secondsLeft = 60, intensityMode = 'grand';

  function initSky() {
    canvas.width = window.innerWidth * Math.min(2, window.devicePixelRatio || 1);
    canvas.height = window.innerHeight * Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    skyStars = Array.from({ length: 110 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.72,
      r: (0.7 + Math.random() * 1.8),
      ph: Math.random() * Math.PI * 2
    }));
  }

  function spawnShell(targetX, targetY, forcedType) {
    const w = canvas.width, h = canvas.height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const tx = targetX !== undefined ? targetX * dpr : w * (0.14 + Math.random() * 0.72);
    const ty = targetY !== undefined ? targetY * dpr : h * (0.13 + Math.random() * 0.36);
    const sx = w * (0.18 + Math.random() * 0.64);
    const types = ['heart', 'willow', 'double-ring', 'crossette', 'chrysanthemum'];
    const shellType = forcedType || types[Math.floor(Math.random() * types.length)];
    const hue = shellType === 'willow' ? (42 + Math.random() * 14)
      : shellType === 'heart' ? (332 + Math.random() * 24)
      : Math.floor(Math.random() * 360);

    const steps = 28 + Math.floor(Math.random() * 12);
    rockets.push({
      x: sx, y: h + 10,
      tx, ty,
      vx: (tx - sx) / steps,
      vy: (ty - h) / steps,
      hue,
      shellType,
      trail: []
    });
    if (soundOn && Math.random() < 0.45) SFX.fireworkWhistle();
  }

  function addParticle(opts) {
    particles.push(Object.assign({
      x: 0, y: 0, vx: 0, vy: 0,
      alpha: 1, decay: 0.011, gravity: 0.042, drag: 0.985,
      size: 2.6, hue: 45, light: 65, glitter: false,
      splitAt: 0, trail: []
    }, opts));
  }

  function detonate(r) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    flashes.push({ x: r.x, y: r.y, radius: 190 * dpr, alpha: 0.34, hue: r.hue });

    if (soundOn) SFX.fireworkBoom(r.shellType === 'willow' ? 1.15 : 0.95, r.shellType === 'heart');
    if (navigator.vibrate) navigator.vibrate(r.shellType === 'heart' ? [40, 35, 65] : 28);

    if (r.shellType === 'heart') {
      // Grand 3D Heart Shell + outer sparkle halo
      for (let i = 0; i < 88; i++) {
        const t = (Math.PI * 2 * i) / 88;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        const spd = 0.25 * dpr;
        addParticle({
          x: r.x, y: r.y, vx: hx * spd, vy: hy * spd,
          decay: 0.009 + Math.random() * 0.005, gravity: 0.025 * dpr, drag: 0.988,
          hue: r.hue + (Math.random() * 18 - 9), light: 66, size: 3.1 * dpr, glitter: true
        });
      }
      for (let i = 0; i < 28; i++) {
        const a = Math.random() * Math.PI * 2, s = (1 + Math.random() * 2.4) * dpr;
        addParticle({ x: r.x, y: r.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, hue: 48, light: 78, size: 2 * dpr, glitter: true });
      }
    } else if (r.shellType === 'willow') {
      // Long Golden Weeping Brocade Crown
      for (let i = 0; i < 110; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = (1.6 + Math.random() * 5.2) * dpr;
        addParticle({
          x: r.x, y: r.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          decay: 0.0068 + Math.random() * 0.004, gravity: 0.062 * dpr, drag: 0.976,
          hue: 42 + Math.random() * 12, light: 72, size: 2.6 * dpr, glitter: Math.random() < 0.5
        });
      }
    } else if (r.shellType === 'double-ring') {
      const innerHue = (r.hue + 145) % 360;
      for (let i = 0; i < 64; i++) {
        const a = (Math.PI * 2 * i) / 64;
        const sOuter = 5.4 * dpr;
        addParticle({ x: r.x, y: r.y, vx: Math.cos(a) * sOuter, vy: Math.sin(a) * sOuter, hue: r.hue, light: 64, size: 3 * dpr, decay: 0.011, gravity: 0.036 * dpr });
        if (i % 2 === 0) {
          const sInner = 2.8 * dpr;
          addParticle({ x: r.x, y: r.y, vx: Math.cos(a) * sInner, vy: Math.sin(a) * sInner, hue: innerHue, light: 72, size: 2.5 * dpr, decay: 0.012, glitter: true });
        }
      }
    } else if (r.shellType === 'crossette') {
      // Splits mid-air into secondary mini-explosions!
      for (let i = 0; i < 18; i++) {
        const a = (Math.PI * 2 * i) / 18;
        const s = (3.4 + Math.random() * 1.4) * dpr;
        addParticle({
          x: r.x, y: r.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          hue: r.hue, light: 70, size: 3.6 * dpr, decay: 0.022, gravity: 0.04 * dpr,
          splitAt: 0.45
        });
      }
    } else {
      // Full Luminous Chrysanthemum
      for (let i = 0; i < 115; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = (1.2 + Math.random() * 6.0) * dpr;
        addParticle({
          x: r.x, y: r.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          decay: 0.01 + Math.random() * 0.008, gravity: 0.045 * dpr, drag: 0.982,
          hue: (r.hue + Math.random() * 45) % 360, light: 66, size: 2.7 * dpr, glitter: Math.random() < 0.35
        });
      }
    }
  }

  function tick() {
    if (!active) return;
    const w = canvas.width, h = canvas.height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    // Night sky fade (leaves luminous trailing streaks)
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(3, 2, 12, 0.22)';
    ctx.fillRect(0, 0, w, h);

    // Twinkling stars
    const now = performance.now() * 0.002;
    for (const s of skyStars) {
      const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(now + s.ph));
      ctx.fillStyle = `rgba(255, 250, 240, ${a})`;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }

    // Glowing horizon atmosphere
    const horiz = ctx.createLinearGradient(0, h * 0.78, 0, h);
    horiz.addColorStop(0, 'rgba(0,0,0,0)');
    horiz.addColorStop(1, 'rgba(42, 14, 58, 0.35)');
    ctx.fillStyle = horiz;
    ctx.fillRect(0, h * 0.78, w, h * 0.22);

    // Additive light blending for real pyrotechnic brightness
    ctx.globalCompositeOperation = 'lighter';

    // Detonation sky flashes
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius);
      grad.addColorStop(0, `hsla(${f.hue}, 100%, 75%, ${f.alpha})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      ctx.fill();
      f.alpha -= 0.032;
      if (f.alpha <= 0) flashes.splice(i, 1);
    }

    // Rising rockets with glowing ember tails
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.trail.push({ x: r.x, y: r.y });
      if (r.trail.length > 9) r.trail.shift();
      r.x += r.vx; r.y += r.vy;

      for (let j = 1; j < r.trail.length; j++) {
        ctx.beginPath();
        ctx.moveTo(r.trail[j - 1].x, r.trail[j - 1].y);
        ctx.lineTo(r.trail[j].x, r.trail[j].y);
        ctx.strokeStyle = `hsla(${r.hue}, 100%, 76%, ${j / r.trail.length})`;
        ctx.lineWidth = 2.4 * dpr;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(r.x, r.y, 3.2 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();

      if (Math.hypot(r.tx - r.x, r.ty - r.y) < 18 * dpr || r.y <= r.ty) {
        detonate(r);
        rockets.splice(i, 1);
      }
    }

    // Particles with trailing arcs, gravity, strobe glitter & crossette splits
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 6) p.trail.shift();

      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.alpha -= p.decay;

      if (p.splitAt && p.alpha <= p.splitAt) {
        p.splitAt = 0;
        for (let k = 0; k < 10; k++) {
          const a = Math.random() * Math.PI * 2;
          const s = (1.2 + Math.random() * 2.4) * dpr;
          addParticle({
            x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
            hue: (p.hue + 40) % 360, light: 78, size: 1.9 * dpr, decay: 0.02, glitter: true
          });
        }
      }

      if (p.alpha <= 0.02) { particles.splice(i, 1); continue; }

      const flicker = p.glitter ? (Math.random() < 0.35 ? 0.2 : 1) : 1;
      const a = Math.max(0, Math.min(1, p.alpha * flicker));

      if (p.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(p.trail[0].x, p.trail[0].y);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = `hsla(${p.hue}, 100%, ${p.light}%, ${a * 0.72})`;
        ctx.lineWidth = p.size * 0.75;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.65, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 100%, ${Math.min(95, p.light + 16)}%, ${a})`;
      ctx.fill();
    }

    raf = requestAnimationFrame(tick);
  }

  function updateClockUI() {
    const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
    const ss = String(secondsLeft % 60).padStart(2, '0');
    const el = document.getElementById('fw-countdown');
    if (el) el.textContent = `${mm}:${ss}`;
  }

  function launch(seconds = 60, bannerText = '✨ 11:11 For My Khushi ✨', mode = 'grand') {
    SFX.unlock();
    initSky();
    rockets = []; particles = []; flashes = [];
    active = true;
    secondsLeft = seconds;
    intensityMode = mode;
    const h2 = document.getElementById('fw-banner-title');
    if (h2) h2.textContent = bannerText;
    overlay.classList.add('active');
    updateClockUI();

    // Opening triple heart + golden willow salute
    spawnShell(window.innerWidth * 0.5, window.innerHeight * 0.26, 'heart');
    setTimeout(() => spawnShell(window.innerWidth * 0.28, window.innerHeight * 0.32, 'willow'), 280);
    setTimeout(() => spawnShell(window.innerWidth * 0.72, window.innerHeight * 0.32, 'willow'), 520);

    clearInterval(launchIv);
    const cadence = mode === 'mega' ? 360 : 540;
    launchIv = setInterval(() => {
      spawnShell();
      if (secondsLeft <= 10 || mode === 'mega') {
        // Grand Finale Rapid-Fire Barrage!
        setTimeout(() => spawnShell(), 140);
        if (Math.random() < 0.5) setTimeout(() => spawnShell(undefined, undefined, 'heart'), 260);
      } else if (Math.random() < 0.42) {
        setTimeout(() => spawnShell(), 210);
      }
    }, cadence);

    clearInterval(timerIv);
    timerIv = setInterval(() => {
      secondsLeft--;
      updateClockUI();
      if (secondsLeft <= 0) stop();
    }, 1000);

    cancelAnimationFrame(raf);
    tick();
  }

  function stop() {
    active = false;
    overlay.classList.remove('active');
    clearInterval(timerIv);
    clearInterval(launchIv);
    cancelAnimationFrame(raf);
  }

  canvas.addEventListener('pointerdown', (e) => {
    SFX.unlock();
    spawnShell(e.clientX, e.clientY, Math.random() < 0.55 ? 'heart' : 'willow');
  });
  window.addEventListener('resize', () => { if (active) initSky(); });

  return {
    launch,
    stop,
    toggleSound() {
      soundOn = !soundOn;
      const btn = document.getElementById('fw-sound-btn');
      if (btn) btn.textContent = soundOn ? '🔊 Sound: ON' : '🔇 Sound: OFF';
      if (soundOn) SFX.unlock();
    }
  };
})();
