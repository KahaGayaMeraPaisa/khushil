const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SAHIL_PASSCODE = String(process.env.SAHIL_PASSCODE || process.env.APP_PASSCODE || '1111').trim();
const KHUSHI_PASSCODE = String(process.env.KHUSHI_PASSCODE || '2222').trim();
const TENOR_API_KEY = String(process.env.TENOR_API_KEY || '').trim();
const STATE_FILE = path.join(DATA_DIR, 'khushil-ultra-state.json');

// Optional Supabase Storage Cloud Persistence (permanent storage on Render / Koyeb free tiers)
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_SERVICE_KEY = String(process.env.SUPABASE_SERVICE_KEY || '').trim();
const SUPABASE_BUCKET = String(process.env.SUPABASE_BUCKET || 'khushil-data').trim();
const SUPABASE_OBJECT = 'khushil-ultra-state.json';
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);

fs.mkdirSync(DATA_DIR, { recursive: true });

const DAILY_PROMPTS = [
  'What is one tiny moment with me you replay in your head?',
  'If we could teleport anywhere together tonight for 3 hours, where are we going?',
  'Which song instantly reminds you of us?',
  'What is one thing I do that secretly makes you smile?',
  'Describe our ideal lazy Sunday when we are finally in the same city.'
];

const MLT_PROMPTS = [
  'Who is most likely to fall asleep first on a late-night call? 😴',
  'Who is most likely to take 100 photos on a trip? 📸',
  'Who is most likely to say "I am not hungry" and eat half the fries? 🍟',
  'Who is most likely to plan a surprise mountain getaway? 🏔️',
  'Who is most likely to cry first at an emotional movie? 🎬',
  'Who is most likely to send a double-text within 10 seconds? 📱'
];

const WHEEL_ITEMS = [
  'Dare: Send a cute selfie snap right now 📸',
  'Truth: What first made you fall for me? 💘',
  'Date Pick: Late-night car drive + favorite playlist 🚗🎶',
  'Dare: Draw my portrait on the Live Draw board 🎨',
  'Truth: Which outfit of mine is your all-time favorite? ✨',
  'Date Pick: Remote movie night + matching snacks 🍿',
  'Dare: Start a 30-second video call and smile without blinking 📹'
];

function istTime() {
  return new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata'
  });
}

function createDefaultState() {
  return {
    theme: 'cyber-aurora',
    admin: {
      stealthLocation: false,
      stealthPresence: false,
      stealthReceipts: false,
      lockedTabs: []
    },
    meetupDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    moods: { sahil: 'Thinking of you ✨', khushi: 'Missing you badly 🥺' },
    songOfDay: { title: 'Haseen — Talwiinder', note: 'Pinned for our late-night vibe', by: 'sahil' },
    wishes: [
      { id: 1, by: 'sahil', text: 'Always watching 11:11 skies with Khushi ✨', time: '11:11 PM' }
    ],
    dailyQ: {
      index: 0,
      prompt: DAILY_PROMPTS[0],
      answers: { sahil: '', khushi: '' }
    },
    messages: [
      {
        id: 1,
        from: 'sahil',
        type: 'text',
        text: 'Welcome to Khushil Ultra 💖 HD video calls, real live map, stickers, GIFs & grand 11:11 fireworks are live!',
        media: '',
        stickerId: '',
        time: istTime(),
        seenAt: '',
        react: ''
      }
    ],
    streak: 1,
    lastSnapDate: '',
    freezeOn: true,
    snaps: [],
    coords: {
      sahil: { lat: 28.4744, lng: 77.0125, accuracy: 25, place: 'Gurugram, HR', updatedAt: 'Initial Pin', battery: null },
      khushi: { lat: 28.7160, lng: 77.0650, accuracy: 25, place: 'Rohini, Delhi', updatedAt: 'Initial Pin', battery: null }
    },
    c4: { board: Array.from({ length: 6 }, () => Array(7).fill('')), turn: 'sahil', winner: '' },
    ttt: { board: Array(9).fill(''), turn: 'sahil', winner: '', score: { sahil: 0, khushi: 0 } },
    mlt: { index: 0, question: MLT_PROMPTS[0], votes: { sahil: '', khushi: '' } },
    wheelResult: 'Tap Spin for a Couple Challenge ✨',
    bucketList: [
      { id: 1, text: 'Watch grand fireworks together at 11:11 🎆', done: false },
      { id: 2, text: 'Midnight long drive with our playlist 🚗', done: false },
      { id: 3, text: 'Mountain café coffee date in Himachal ☕', done: false }
    ]
  };
}

function verifyPasscode(user, passcode) {
  const clean = String(passcode || '').trim();
  if (user === 'sahil') return clean === SAHIL_PASSCODE;
  if (user === 'khushi') return clean === KHUSHI_PASSCODE;
  return false;
}

function loadLocalState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      const def = createDefaultState();
      return Object.assign(def, parsed, { admin: Object.assign(def.admin, parsed.admin || {}) });
    }
  } catch (err) {
    console.error('Local state read error:', err.message);
  }
  return createDefaultState();
}

function sbHeaders(extra = {}) {
  return Object.assign({
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
  }, extra);
}

async function ensureSupabaseBucket() {
  if (!USE_SUPABASE) return;
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: sbHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id: SUPABASE_BUCKET, name: SUPABASE_BUCKET, public: false })
    });
  } catch (err) {
    console.error('Supabase bucket warning:', err.message);
  }
}

async function loadCloudState() {
  if (!USE_SUPABASE) return loadLocalState();
  try {
    await ensureSupabaseBucket();
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(SUPABASE_BUCKET)}/${SUPABASE_OBJECT}`,
      { headers: sbHeaders() }
    );
    if (res.ok) {
      const parsed = await res.json();
      const def = createDefaultState();
      console.log('Loaded Khushil Ultra state from Supabase Storage.');
      return Object.assign(def, parsed, { admin: Object.assign(def.admin, parsed.admin || {}) });
    }
  } catch (err) {
    console.error('Supabase load fallback to local:', err.message);
  }
  return loadLocalState();
}

let state = loadLocalState();
let saveTimeout = null;
let cloudSyncInFlight = false;
let cloudSyncQueued = false;

async function pushToSupabase(serialized) {
  if (!USE_SUPABASE) return;
  if (cloudSyncInFlight) { cloudSyncQueued = true; return; }
  cloudSyncInFlight = true;
  try {
    await fetch(
      `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(SUPABASE_BUCKET)}/${SUPABASE_OBJECT}`,
      {
        method: 'POST',
        headers: sbHeaders({ 'Content-Type': 'application/json', 'x-upsert': 'true' }),
        body: serialized
      }
    );
  } catch (err) {
    console.error('Supabase save error:', err.message);
  } finally {
    cloudSyncInFlight = false;
    if (cloudSyncQueued) {
      cloudSyncQueued = false;
      pushToSupabase(JSON.stringify(state));
    }
  }
}

function persistState() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    const serialized = JSON.stringify(state);
    try {
      const tmp = STATE_FILE + '.tmp';
      fs.writeFileSync(tmp, serialized, 'utf8');
      fs.renameSync(tmp, STATE_FILE);
    } catch (err) {
      console.error('Local save error:', err.message);
    }
    if (USE_SUPABASE) pushToSupabase(serialized);
  }, 300);
}

function checkC4Win(b, r, c, p) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  return dirs.some(([dr, dc]) => {
    let count = 1;
    for (const s of [1, -1]) {
      let nr = r + dr * s, nc = c + dc * s;
      while (nr >= 0 && nr < 6 && nc >= 0 && nc < 7 && b[nr][nc] === p) {
        count++; nr += dr * s; nc += dc * s;
      }
    }
    return count >= 4;
  });
}

const app = express();
app.use(express.json({ limit: '16mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    app: 'khushil-ultra',
    storage: USE_SUPABASE ? 'supabase' : 'local',
    time: new Date().toISOString()
  });
});

app.post('/api/auth', (req, res) => {
  const { user, passcode } = req.body || {};
  if (!['sahil', 'khushi'].includes(user)) {
    return res.status(400).json({ ok: false, error: 'Select Sahil or Khushi' });
  }
  if (!verifyPasscode(user, passcode)) {
    return res.status(401).json({ ok: false, error: 'Wrong passcode for this profile' });
  }
  return res.json({ ok: true, user, isAdmin: user === 'sahil' });
});

// Optional Tenor GIF Search endpoint
app.get('/api/gifs', async (req, res) => {
  const q = String(req.query.q || 'cute love couple').trim().slice(0, 60);
  if (!TENOR_API_KEY) {
    return res.json({ ok: true, source: 'builtin', results: [] });
  }
  try {
    const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${encodeURIComponent(TENOR_API_KEY)}&limit=16&media_filter=tinygif,gif`;
    const r = await fetch(url);
    const data = await r.json();
    const results = (data.results || []).map((item) => ({
      id: item.id,
      title: item.content_description || 'GIF',
      url: item.media_formats?.tinygif?.url || item.media_formats?.gif?.url || ''
    })).filter((x) => x.url);
    return res.json({ ok: true, source: 'tenor', results });
  } catch (err) {
    return res.json({ ok: false, source: 'error', results: [] });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 16 * 1024 * 1024,
  cors: { origin: '*' }
});

const onlineUsers = { sahil: new Set(), khushi: new Set() };
const holdingHeartbeat = { sahil: false, khushi: false };
const telemetry = {
  khushi: { activeTab: 'home', visible: false, battery: null, lastSeen: 'Never', gpsActive: false }
};

function buildStateForUser(targetUser) {
  if (targetUser === 'sahil') {
    return Object.assign({}, state, {
      telemetry: telemetry.khushi
    });
  }
  // Filtered view for Khushi — no admin panel/settings, respects Sahil's stealth privacy controls
  const filteredCoords = {
    sahil: state.admin.stealthLocation ? null : state.coords.sahil,
    khushi: state.coords.khushi
  };
  return {
    theme: state.theme,
    lockedTabs: state.admin.lockedTabs || [],
    meetupDate: state.meetupDate,
    moods: state.moods,
    songOfDay: state.songOfDay,
    wishes: state.wishes,
    dailyQ: state.dailyQ,
    messages: state.messages,
    streak: state.streak,
    freezeOn: state.freezeOn,
    snaps: state.snaps,
    coords: filteredCoords,
    c4: state.c4,
    ttt: state.ttt,
    mlt: state.mlt,
    wheelResult: state.wheelResult,
    bucketList: state.bucketList
  };
}

function emitPresence() {
  for (const [, sock] of io.sockets.sockets) {
    const u = sock.data.user;
    if (u === 'sahil') {
      sock.emit('presence', {
        sahil: onlineUsers.sahil.size > 0,
        khushi: onlineUsers.khushi.size > 0,
        telemetry: telemetry.khushi
      });
    } else {
      sock.emit('presence', {
        sahil: state.admin.stealthPresence ? false : onlineUsers.sahil.size > 0,
        khushi: onlineUsers.khushi.size > 0
      });
    }
  }
}

function emitState() {
  persistState();
  for (const [, sock] of io.sockets.sockets) {
    sock.emit('state_sync', buildStateForUser(sock.data.user));
  }
}

function emitToUser(targetUser, event, payload) {
  for (const sid of onlineUsers[targetUser]) {
    io.to(sid).emit(event, payload);
  }
}

io.use((socket, next) => {
  const { user, passcode } = socket.handshake.auth || {};
  if (!['sahil', 'khushi'].includes(user) || !verifyPasscode(user, passcode)) {
    return next(new Error('Unauthorized'));
  }
  socket.data.user = user;
  next();
});

io.on('connection', (socket) => {
  const user = socket.data.user;
  const partner = user === 'sahil' ? 'khushi' : 'sahil';
  onlineUsers[user].add(socket.id);

  if (user === 'khushi') {
    telemetry.khushi.visible = true;
    telemetry.khushi.lastSeen = istTime();
  }

  socket.emit('state_sync', buildStateForUser(user));
  emitPresence();

  // Telemetry from Khushi's open app tab for Sahil's Admin Panel
  socket.on('client_telemetry', (info) => {
    if (user !== 'khushi' || !info) return;
    if (info.activeTab) telemetry.khushi.activeTab = String(info.activeTab).slice(0, 30);
    if (typeof info.visible === 'boolean') telemetry.khushi.visible = info.visible;
    if (typeof info.battery === 'number') telemetry.khushi.battery = info.battery;
    if (typeof info.gpsActive === 'boolean') telemetry.khushi.gpsActive = info.gpsActive;
    telemetry.khushi.lastSeen = istTime();
    emitToUser('sahil', 'presence', {
      sahil: onlineUsers.sahil.size > 0,
      khushi: onlineUsers.khushi.size > 0,
      telemetry: telemetry.khushi
    });
  });

  socket.on('typing', (isTyping) => {
    if (user === 'sahil' && state.admin.stealthPresence) return;
    emitToUser(partner, 'partner_typing', { user, isTyping: !!isTyping });
  });

  socket.on('heartbeat_hold', (holding) => {
    holdingHeartbeat[user] = !!holding;
    io.emit('heartbeat_state', {
      sahil: holdingHeartbeat.sahil,
      khushi: holdingHeartbeat.khushi,
      synced: holdingHeartbeat.sahil && holdingHeartbeat.khushi
    });
  });

  // Rich Messages: Text, Stickers, GIFs, Clipboard/WhatsApp Images
  socket.on('send_message', (payload) => {
    const type = ['text', 'image', 'gif', 'sticker'].includes(payload?.type) ? payload.type : 'text';
    const text = String(payload?.text || '').trim().slice(0, 1500);
    const media = String(payload?.media || '').trim();
    const stickerId = String(payload?.stickerId || '').trim().slice(0, 60);

    if (type === 'text' && !text) return;
    if ((type === 'image' || type === 'gif') && !media) return;
    if (type === 'sticker' && !stickerId) return;

    // Validate safe URL/data URI for images/GIFs
    if (media && !(media.startsWith('data:image/') || media.startsWith('https://'))) return;
    if (media.length > 6 * 1024 * 1024) return;

    state.messages.push({
      id: Date.now() + Math.floor(Math.random() * 1000),
      from: user,
      type,
      text,
      media,
      stickerId,
      time: istTime(),
      seenAt: '',
      react: ''
    });
    if (state.messages.length > 260) state.messages = state.messages.slice(-260);
    emitState();

    const preview = type === 'text' ? text : (type === 'sticker' ? 'Sent an animated sticker ✨' : type === 'gif' ? 'Sent a GIF 🎞️' : 'Sent a photo/sticker 🖼️');
    emitToUser(partner, 'notify', {
      title: user === 'sahil' ? 'Sahil 💙' : 'Khushi 💖',
      body: preview
    });
  });

  socket.on('mark_seen', () => {
    if (user === 'sahil' && state.admin.stealthReceipts) return;
    let changed = false;
    const t = istTime();
    state.messages.forEach((m) => {
      if (m.from !== user && !m.seenAt) {
        m.seenAt = t;
        changed = true;
      }
    });
    if (changed) emitState();
  });

  socket.on('react_message', ({ id, emoji }) => {
    const msg = state.messages.find((m) => m.id === id);
    if (!msg) return;
    const pick = String(emoji || '❤️').slice(0, 6);
    msg.react = msg.react === pick ? '' : pick;
    emitState();
  });

  socket.on('send_mood', ({ text }) => {
    const clean = String(text || '').trim().slice(0, 120);
    if (!clean) return;
    state.moods[user] = clean;
    emitState();
    emitToUser(partner, 'notify', {
      title: `${user === 'sahil' ? 'Sahil' : 'Khushi'} mood update`,
      body: clean
    });
  });

  socket.on('set_meetup_date', ({ date }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return;
    state.meetupDate = date;
    emitState();
  });

  socket.on('set_song', ({ title, note }) => {
    const t = String(title || '').trim().slice(0, 120);
    if (!t) return;
    state.songOfDay = { title: t, note: String(note || '').trim().slice(0, 140), by: user };
    emitState();
  });

  socket.on('save_wish', ({ text }) => {
    const clean = String(text || '').trim().slice(0, 300);
    if (!clean) return;
    state.wishes.push({ id: Date.now(), by: user, text: clean, time: istTime() });
    if (state.wishes.length > 100) state.wishes = state.wishes.slice(-100);
    emitState();
  });

  socket.on('daily_answer', ({ text }) => {
    const clean = String(text || '').trim().slice(0, 300);
    if (!clean) return;
    state.dailyQ.answers[user] = clean;
    emitState();
  });

  socket.on('next_daily_q', () => {
    const nextIdx = (state.dailyQ.index + 1) % DAILY_PROMPTS.length;
    state.dailyQ = { index: nextIdx, prompt: DAILY_PROMPTS[nextIdx], answers: { sahil: '', khushi: '' } };
    emitState();
  });

  socket.on('send_snap', ({ img, caption, viewOnce }) => {
    if (!img || typeof img !== 'string' || !img.startsWith('data:image/')) return;
    const today = new Date().toISOString().slice(0, 10);
    if (state.lastSnapDate !== today) {
      state.streak += 1;
      state.lastSnapDate = today;
    }
    state.snaps.unshift({
      id: Date.now(),
      from: user,
      img,
      caption: String(caption || 'Instant click 📸').slice(0, 160),
      viewOnce: !!viewOnce,
      opened: false,
      time: istTime()
    });
    if (state.snaps.length > 25) state.snaps = state.snaps.slice(0, 25);
    emitState();
    emitToUser(partner, 'notify', {
      title: `📸 New Snap from ${user === 'sahil' ? 'Sahil' : 'Khushi'}`,
      body: String(caption || 'Tap to view!')
    });
  });

  socket.on('open_snap', ({ id }) => {
    const snap = state.snaps.find((s) => s.id === id);
    if (!snap || snap.from === user) return;
    snap.opened = true;
    if (snap.viewOnce) snap.img = '';
    emitState();
  });

  socket.on('toggle_freeze', () => {
    state.freezeOn = !state.freezeOn;
    emitState();
  });

  socket.on('update_location', ({ lat, lng, accuracy, place, battery }) => {
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    state.coords[user] = {
      lat,
      lng,
      accuracy: typeof accuracy === 'number' ? Math.round(accuracy) : 20,
      place: place ? String(place).slice(0, 80) : (state.coords[user]?.place || 'Live GPS'),
      updatedAt: istTime(),
      battery: typeof battery === 'number' ? battery : state.coords[user]?.battery ?? null
    };
    if (user === 'khushi') {
      telemetry.khushi.gpsActive = true;
      if (typeof battery === 'number') telemetry.khushi.battery = battery;
    }
    emitState();
  });

  // Games
  socket.on('c4_move', ({ col }) => {
    const g = state.c4;
    if (g.winner || g.turn !== user || col < 0 || col > 6) return;
    for (let r = 5; r >= 0; r--) {
      if (!g.board[r][col]) {
        g.board[r][col] = user;
        if (checkC4Win(g.board, r, col, user)) g.winner = user;
        else g.turn = user === 'sahil' ? 'khushi' : 'sahil';
        emitState();
        return;
      }
    }
  });
  socket.on('c4_reset', () => {
    state.c4 = { board: Array.from({ length: 6 }, () => Array(7).fill('')), turn: 'sahil', winner: '' };
    emitState();
  });

  socket.on('ttt_move', ({ idx }) => {
    const g = state.ttt;
    if (g.winner || g.turn !== user || idx < 0 || idx > 8 || g.board[idx]) return;
    g.board[idx] = user;
    const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    if (wins.some((w) => w.every((i) => g.board[i] === user))) {
      g.winner = user; g.score[user] += 1;
    } else if (g.board.every(Boolean)) {
      g.winner = 'draw';
    } else {
      g.turn = user === 'sahil' ? 'khushi' : 'sahil';
    }
    emitState();
  });
  socket.on('ttt_reset', () => {
    state.ttt.board = Array(9).fill(''); state.ttt.winner = ''; state.ttt.turn = 'sahil';
    emitState();
  });

  socket.on('draw_stroke', (stroke) => emitToUser(partner, 'draw_stroke', stroke));
  socket.on('draw_clear', () => io.emit('draw_clear'));

  socket.on('spin_wheel', () => {
    const pick = WHEEL_ITEMS[Math.floor(Math.random() * WHEEL_ITEMS.length)];
    state.wheelResult = `${pick} (Spun by ${user === 'sahil' ? 'Sahil' : 'Khushi'})`;
    emitState();
  });

  socket.on('mlt_vote', ({ choice }) => {
    if (!['Sahil', 'Khushi'].includes(choice)) return;
    state.mlt.votes[user] = choice;
    emitState();
  });
  socket.on('mlt_next', () => {
    const idx = (state.mlt.index + 1) % MLT_PROMPTS.length;
    state.mlt = { index: idx, question: MLT_PROMPTS[idx], votes: { sahil: '', khushi: '' } };
    emitState();
  });

  socket.on('bucket_add', ({ text }) => {
    const clean = String(text || '').trim().slice(0, 140);
    if (!clean) return;
    state.bucketList.push({ id: Date.now(), text: clean, done: false });
    emitState();
  });
  socket.on('bucket_toggle', ({ id }) => {
    const item = state.bucketList.find((b) => b.id === id);
    if (!item) return;
    item.done = !item.done;
    emitState();
  });

  // ========= WEBRTC VOICE & HD VIDEO CALLING SIGNALING =========
  socket.on('call_invite', ({ mode }) => {
    emitToUser(partner, 'call_incoming', { from: user, mode: mode === 'audio' ? 'audio' : 'video' });
  });
  socket.on('call_accept', ({ mode }) => {
    emitToUser(partner, 'call_accepted', { from: user, mode });
  });
  socket.on('call_reject', () => {
    emitToUser(partner, 'call_rejected', { from: user });
  });
  socket.on('call_end', () => {
    emitToUser(partner, 'call_ended', { from: user });
  });
  socket.on('webrtc_offer', (data) => emitToUser(partner, 'webrtc_offer', data));
  socket.on('webrtc_answer', (data) => emitToUser(partner, 'webrtc_answer', data));
  socket.on('webrtc_ice', (data) => emitToUser(partner, 'webrtc_ice', data));
  socket.on('call_fx', (data) => io.emit('call_fx', { from: user, kind: data?.kind || 'hearts' }));

  // ========= SAHIL EXCLUSIVE ADMIN CONTROLS (STRICTLY SERVER-VERIFIED) =========
  function requireSahil() {
    return user === 'sahil';
  }

  socket.on('admin_trigger_fireworks', ({ duration, message, intensity }) => {
    if (!requireSahil()) return;
    const payload = {
      duration: Math.min(180, Math.max(10, Number(duration) || 60)),
      message: String(message || '✨ 11:11 For My Khushi ✨').slice(0, 80),
      intensity: intensity === 'mega' ? 'mega' : 'grand'
    };
    io.emit('remote_fireworks', payload);
  });

  socket.on('admin_send_takeover', ({ title, message, style }) => {
    if (!requireSahil()) return;
    emitToUser('khushi', 'love_takeover', {
      title: String(title || '💌 Message From Sahil').slice(0, 70),
      message: String(message || 'I love you so much! 💖').slice(0, 240),
      style: String(style || 'hearts')
    });
  });

  socket.on('admin_update_settings', (patch) => {
    if (!requireSahil() || !patch) return;
    if (typeof patch.stealthLocation === 'boolean') state.admin.stealthLocation = patch.stealthLocation;
    if (typeof patch.stealthPresence === 'boolean') state.admin.stealthPresence = patch.stealthPresence;
    if (typeof patch.stealthReceipts === 'boolean') state.admin.stealthReceipts = patch.stealthReceipts;
    if (Array.isArray(patch.lockedTabs)) {
      state.admin.lockedTabs = patch.lockedTabs.filter((t) => ['snaps', 'map', 'arcade'].includes(t));
    }
    if (['cyber-aurora', 'royal-gold', 'sakura-neon', 'midnight-crimson'].includes(patch.theme)) {
      state.theme = patch.theme;
    }
    emitState();
    emitPresence();
  });

  socket.on('admin_request_gps', () => {
    if (!requireSahil()) return;
    emitToUser('khushi', 'request_gps_ping');
  });

  socket.on('admin_switch_khushi_tab', ({ tab }) => {
    if (!requireSahil()) return;
    if (!['home', 'chat', 'snaps', 'map', 'arcade'].includes(tab)) return;
    emitToUser('khushi', 'remote_nav', { tab });
  });

  socket.on('admin_delete_msg', ({ id }) => {
    if (!requireSahil()) return;
    state.messages = state.messages.filter((m) => m.id !== id);
    emitState();
  });

  socket.on('admin_clear_snaps', () => {
    if (!requireSahil()) return;
    state.snaps = [];
    emitState();
  });

  socket.on('disconnect', () => {
    onlineUsers[user].delete(socket.id);
    if (user === 'khushi' && onlineUsers.khushi.size === 0) {
      telemetry.khushi.visible = false;
      telemetry.khushi.lastSeen = istTime();
    }
    if (onlineUsers[user].size === 0) {
      holdingHeartbeat[user] = false;
      io.emit('heartbeat_state', {
        sahil: holdingHeartbeat.sahil,
        khushi: holdingHeartbeat.khushi,
        synced: false
      });
    }
    emitPresence();
  });
});

(async () => {
  state = await loadCloudState();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Khushil Ultra running on http://0.0.0.0:${PORT} (storage: ${USE_SUPABASE ? 'supabase' : 'local'})`);
  });
})();
