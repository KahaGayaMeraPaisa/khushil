/* ========= KHUSHIL ULTRA v2 — REAL-TIME CLIENT ENGINE ========= */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('install-btn');
  if (btn) btn.style.display = 'inline-grid';
});
async function installPWA() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById('install-btn').style.display = 'none';
}

/* ========= DATA CATALOGS (EMOJIS, ANIMATED STICKERS, CURATED GIFS) ========= */
const EMOJIS = [
  '❤️','💖','💘','❤️‍🔥','💕','🥰','😍','😘','🥺','🥹','🤗','🫂','💋','✨',
  '🔥','🎆','🎉','🌹','🦋','🧸','💍','💌','😂','🤣','😭','🙈','😜','😏',
  '😴','🍕','☕','🚗','🌙','⭐','🎵','🎮','👑','💯','🫶','🤍','💙','💗'
];

const BUILTIN_STICKERS = [
  { id: 'flying-kiss', emoji: '😘', label: 'Flying Kiss 💋' },
  { id: 'big-hug', emoji: '🫂', label: 'Tight Hug 💖' },
  { id: 'miss-you', emoji: '🥺', label: 'Miss You So Much' },
  { id: 'heart-boom', emoji: '❤️‍🔥', label: 'Heart On Fire' },
  { id: 'cute-angry', emoji: '😤', label: 'Cute Angry!' },
  { id: 'sleepy-call', emoji: '😴', label: 'Stay On Call' },
  { id: 'fireworks-love', emoji: '🎆', label: '11:11 Magic ✨' },
  { id: 'food-date', emoji: '🍕', label: 'Hungry! Feed Me' },
  { id: 'king-queen', emoji: '👑', label: 'My Everything' }
];

const CURATED_GIFS = [
  { title: 'Cute Bear Hug', url: 'https://media.giphy.com/media/l2QDM9Jnim1YVILXa/giphy.gif' },
  { title: 'Blowing Kisses', url: 'https://media.giphy.com/media/MDJ9IbxxvDUQM/giphy.gif' },
  { title: 'Love Hearts', url: 'https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif' },
  { title: 'Miss You Cute', url: 'https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif' },
  { title: 'Grand Fireworks', url: 'https://media.giphy.com/media/26tOZ42Mg6pbTUPHW/giphy.gif' },
  { title: 'Happy Dance', url: 'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif' }
];

/* ========= APP STATE ========= */
let selectedRole = 'sahil';
let currentUser = localStorage.getItem('khushil_u2_user') || '';
let savedPass = localStorage.getItem('khushil_u2_pass') || '';
let optIn1111 = localStorage.getItem('khushil_optin_1111') !== '0';
let last1111Key = localStorage.getItem('khushil_last_1111') || '';
let socket = null;
let state = null;
let activeTab = 'home';
let presence = { sahil: false, khushi: false };
let lastMsgCount = 0;

function esc(str) {
  return String(str || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2400);
}

function toggleGlobalSfx() {
  const next = !SFX.isEnabled();
  SFX.setEnabled(next);
  document.getElementById('sfx-btn').textContent = next ? '🔊' : '🔇';
  toast(next ? 'Game SFX & Audio ON 🔊' : 'Audio Muted 🔇');
}

/* ========= AUTH ========= */
function selectRole(role) {
  SFX.tap();
  selectedRole = role;
  document.getElementById('pick-sahil').classList.toggle('selected', role === 'sahil');
  document.getElementById('pick-khushi').classList.toggle('selected', role === 'khushi');
  const inp = document.getElementById('login-pass');
  inp.placeholder = role === 'sahil' ? 'Sahil Admin Passcode (default: 1111)' : 'Khushi Passcode (default: 2222)';
}

async function doLogin() {
  SFX.unlock();
  const pass = document.getElementById('login-pass').value.trim();
  const errEl = document.getElementById('login-err');
  errEl.textContent = '';
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: selectedRole, passcode: pass })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      errEl.textContent = data.error || 'Invalid passcode';
      return;
    }
    currentUser = selectedRole;
    savedPass = pass;
    localStorage.setItem('khushil_u2_user', currentUser);
    localStorage.setItem('khushil_u2_pass', savedPass);
    SFX.win();
    startApp();
  } catch {
    errEl.textContent = 'Cannot reach server — check your connection.';
  }
}

function logout() {
  localStorage.removeItem('khushil_u2_user');
  localStorage.removeItem('khushil_u2_pass');
  location.reload();
}

/* ========= START SOCKET & LISTENERS ========= */
function startApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('optin-1111').checked = optIn1111;
  document.getElementById('sfx-btn').textContent = SFX.isEnabled() ? '🔊' : '🔇';

  // Show Admin nav tab STRICTLY for Sahil
  const adminNav = document.getElementById('nav-admin');
  if (adminNav) adminNav.style.display = currentUser === 'sahil' ? 'flex' : 'none';

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }

  buildMediaPickers();
  socket = io({ auth: { user: currentUser, passcode: savedPass } });

  socket.on('connect_error', () => {
    toast('Passcode changed or session expired — sign in again');
    document.getElementById('login-screen').style.display = 'flex';
  });

  socket.on('connect', () => {
    sendTelemetry();
    checkSharedFromWhatsApp();
  });

  socket.on('state_sync', (newState) => {
    const prevCount = state ? state.messages.length : newState.messages.length;
    state = newState;

    // Apply live global theme
    if (state.theme) document.body.setAttribute('data-theme', state.theme);

    // Sound on new incoming message
    if (state.messages.length > prevCount) {
      const latest = state.messages[state.messages.length - 1];
      if (latest && latest.from !== currentUser) {
        SFX.receive();
        if (latest.type === 'sticker' || latest.type === 'gif') spawnFloatingFX('hearts', 8);
      }
    }
    lastMsgCount = state.messages.length;

    if (activeTab === 'chat') {
      const hasUnread = state.messages.some((m) => m.from !== currentUser && !m.seenAt);
      if (hasUnread) socket.emit('mark_seen');
    }
    renderAll();
  });

  socket.on('presence', (p) => {
    presence = p;
    const partner = currentUser === 'sahil' ? 'khushi' : 'sahil';
    const isOn = !!presence[partner];
    document.getElementById('p-dot').classList.toggle('on', isOn);
    document.getElementById('p-text').textContent =
      `${partner === 'sahil' ? 'Sahil' : 'Khushi'} ${isOn ? 'online now' : 'away'} • ${currentUser === 'sahil' ? 'Sahil 👑' : 'Khushi 💖'}`;
    if (currentUser === 'sahil' && p.telemetry) renderAdminTelemetry(p.telemetry, !!p.khushi);
  });

  socket.on('partner_typing', ({ isTyping }) => {
    document.getElementById('typing-pill').textContent = isTyping ? 'Typing... ✨' : 'Live Synced';
  });

  socket.on('heartbeat_state', ({ synced, sahil, khushi }) => {
    const btn = document.getElementById('hb-btn');
    btn.classList.toggle('synced', synced);
    if (synced) {
      btn.textContent = '💓 BOTH HOLDING! Synced Heartbeat 💓';
      SFX.heartbeat();
      spawnFloatingFX('hearts', 10);
      if (navigator.vibrate) navigator.vibrate([85, 85, 140]);
    } else if (sahil || khushi) {
      btn.textContent = '💗 Partner is holding... Press & Hold too!';
    } else {
      btn.textContent = 'Hold Together for Live Heartbeat 💗';
    }
  });

  socket.on('notify', ({ title, body }) => {
    toast(`${title}: ${body.slice(0, 50)}`);
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      new Notification(title, { body, icon: '/icons/icon-192.png' });
    }
  });

  // Live Draw
  socket.on('draw_stroke', (s) => drawRemoteStroke(s));
  socket.on('draw_clear', () => liveCtx.clearRect(0, 0, liveCanvas.width, liveCanvas.height));

  // Remote Controls triggered by Sahil Admin
  socket.on('remote_fireworks', ({ duration, message, intensity }) => {
    FireworksEngine.launch(duration || 60, message || '✨ 11:11 For My Khushi ✨', intensity || 'grand');
  });

  socket.on('love_takeover', ({ title, message }) => {
    SFX.win();
    spawnFloatingFX('hearts', 22);
    if (navigator.vibrate) navigator.vibrate([120, 80, 180]);
    document.getElementById('takeover-title').textContent = title;
    document.getElementById('takeover-msg').textContent = message;
    document.getElementById('takeover-modal').classList.add('open');
  });

  socket.on('request_gps_ping', () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(sendGPSCoords, () => {}, { enableHighAccuracy: true, timeout: 12000 });
    }
  });

  socket.on('remote_nav', ({ tab }) => {
    const btn = document.querySelector(`nav.bottom-nav button[data-tab="${tab}"]`);
    if (btn) openTab(tab, btn, true);
  });

  // WebRTC Call Signaling
  socket.on('call_incoming', handleIncomingCall);
  socket.on('call_accepted', handleCallAccepted);
  socket.on('call_rejected', () => { cleanupCall(); toast('Call declined'); });
  socket.on('call_ended', () => { cleanupCall(); toast('Call ended'); });
  socket.on('webrtc_offer', handleWebRTCOffer);
  socket.on('webrtc_answer', handleWebRTCAnswer);
  socket.on('webrtc_ice', handleWebRTCIce);
  socket.on('call_fx', ({ kind }) => {
    spawnFloatingFX(kind || 'hearts', 16);
    if (kind === 'sparks') SFX.fireworkBoom(0.8, true);
    else SFX.heartbeat();
  });

  if (new URLSearchParams(location.search).get('fireworks') === '1' && optIn1111) {
    setTimeout(() => FireworksEngine.launch(60), 350);
  }
}

async function sendTelemetry() {
  if (!socket || currentUser !== 'khushi') return;
  let bat = null;
  try {
    if (navigator.getBattery) {
      const b = await navigator.getBattery();
      bat = Math.round(b.level * 100);
    }
  } catch {}
  socket.emit('client_telemetry', {
    activeTab,
    visible: !document.hidden,
    battery: bat,
    gpsActive: gpsWatchId !== null
  });
}
document.addEventListener('visibilitychange', sendTelemetry);

if (currentUser && savedPass) startApp();

/* ========= NAVIGATION ========= */
function openTab(tab, btn, silent = false) {
  if (currentUser === 'khushi' && state?.lockedTabs?.includes(tab)) {
    toast('This section is currently paused by Sahil 🔒');
    return;
  }
  if (!silent) SFX.tap();
  activeTab = tab;
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
  const target = document.getElementById('tab-' + tab);
  if (target) target.classList.add('active');
  document.querySelectorAll('nav.bottom-nav button').forEach((b) => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (tab === 'chat' && socket) socket.emit('mark_seen');
  if (tab === 'map') {
    setTimeout(() => {
      initMap();
      if (map) {
        map.invalidateSize(true);
        renderMap(true);
      }
    }, 120);
  }
  sendTelemetry();
}

/* ========= HOME ACTIONS ========= */
function toggleDateEdit() {
  const row = document.getElementById('date-edit-row');
  row.style.display = row.style.display === 'none' ? 'flex' : 'none';
  if (state) document.getElementById('meetup-date-input').value = state.meetupDate;
}
function saveMeetupDate() {
  const val = document.getElementById('meetup-date-input').value;
  if (!val || !socket) return;
  socket.emit('set_meetup_date', { date: val });
  document.getElementById('date-edit-row').style.display = 'none';
  SFX.send();
  toast('Meetup countdown updated ⏳');
}
function sendMood(text) {
  if (!socket) return;
  SFX.send();
  spawnFloatingFX('hearts', 7);
  socket.emit('send_mood', { text });
  toast('Mood sent ✨');
}
function submitDailyAnswer() {
  const inp = document.getElementById('dq-input');
  const val = inp.value.trim();
  if (!val || !socket) return;
  socket.emit('daily_answer', { text: val });
  inp.value = '';
  SFX.send();
  toast('Answer locked 🔐');
}
function pinSong() {
  const inp = document.getElementById('song-input');
  const title = inp.value.trim();
  if (!title || !socket) return;
  socket.emit('set_song', { title, note: 'Pinned from Home' });
  inp.value = '';
  SFX.send();
}
function addBucket() {
  const inp = document.getElementById('bucket-input');
  const text = inp.value.trim();
  if (!text || !socket) return;
  socket.emit('bucket_add', { text });
  inp.value = '';
  SFX.tap();
}

const hbBtn = document.getElementById('hb-btn');
hbBtn.addEventListener('pointerdown', () => { SFX.unlock(); if (socket) socket.emit('heartbeat_hold', true); });
['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) =>
  hbBtn.addEventListener(ev, () => { if (socket) socket.emit('heartbeat_hold', false); })
);

/* ========= CHAT, EMOJIS, STICKERS, GIFS, CLIPBOARD & WHATSAPP SHARE ========= */
let typingTimer = null;
let currentDrawerTab = 'emoji';

function handleTyping() {
  if (!socket) return;
  socket.emit('typing', true);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => socket.emit('typing', false), 1200);
}

function sendMessage(customText) {
  if (!socket) return;
  const inp = document.getElementById('chat-input');
  const text = customText !== undefined ? customText : inp.value.trim();
  if (!text) return;
  socket.emit('send_message', { type: 'text', text });
  if (customText === undefined) inp.value = '';
  socket.emit('typing', false);
  SFX.send();
}

function sendHeartBurst() {
  sendMessage('💖✨ Sending you a storm of hearts right now! ✨💖');
  spawnFloatingFX('hearts', 18);
  if (navigator.vibrate) navigator.vibrate([45, 35, 90]);
}

function toggleMediaDrawer(tab) {
  SFX.tap();
  const drawer = document.getElementById('media-drawer');
  if (drawer.classList.contains('open') && currentDrawerTab === tab) {
    drawer.classList.remove('open');
    return;
  }
  currentDrawerTab = tab;
  drawer.classList.add('open');
  ['emoji', 'sticker', 'gif'].forEach((t) => {
    document.getElementById('pane-' + t).style.display = t === tab ? 'block' : 'none';
  });
}

function buildMediaPickers() {
  // Emojis
  document.getElementById('emoji-grid').innerHTML = EMOJIS.map((em) =>
    `<button class="emoji-btn" onclick="insertEmoji('${em}')">${em}</button>`
  ).join('');

  // Built-in Animated Stickers
  document.getElementById('sticker-grid').innerHTML = BUILTIN_STICKERS.map((st) =>
    `<button class="sticker-pick" onclick="sendBuiltinSticker('${st.id}')"><span>${st.emoji}</span><small>${esc(st.label)}</small></button>`
  ).join('');

  // Curated GIFs
  renderGifGrid(CURATED_GIFS);
}

function insertEmoji(em) {
  SFX.tap();
  const inp = document.getElementById('chat-input');
  inp.value += em;
  inp.focus();
}

function sendBuiltinSticker(stickerId) {
  if (!socket) return;
  socket.emit('send_message', { type: 'sticker', stickerId });
  document.getElementById('media-drawer').classList.remove('open');
  SFX.send();
  spawnFloatingFX('hearts', 8);
}

function renderGifGrid(list) {
  document.getElementById('gif-grid').innerHTML = list.map((g) =>
    `<img class="gif-item" src="${esc(g.url)}" alt="${esc(g.title)}" loading="lazy" onclick="sendGifUrl('${esc(g.url)}')" />`
  ).join('');
}

async function searchGifs() {
  const q = document.getElementById('gif-search-input').value.trim();
  if (!q) return renderGifGrid(CURATED_GIFS);
  if (q.startsWith('https://')) {
    sendGifUrl(q);
    document.getElementById('gif-search-input').value = '';
    return;
  }
  try {
    const res = await fetch('/api/gifs?q=' + encodeURIComponent(q));
    const data = await res.json();
    if (data.results && data.results.length) {
      renderGifGrid(data.results);
    } else {
      const filtered = CURATED_GIFS.filter((g) => g.title.toLowerCase().includes(q.toLowerCase()));
      renderGifGrid(filtered.length ? filtered : CURATED_GIFS);
      toast('Tip: Paste any GIF link or attach from WhatsApp/Gallery!');
    }
  } catch {
    renderGifGrid(CURATED_GIFS);
  }
}

function sendGifUrl(url) {
  if (!socket || !url) return;
  socket.emit('send_message', { type: 'gif', media: url });
  document.getElementById('media-drawer').classList.remove('open');
  SFX.send();
}

// Send Image / Animated GIF / WhatsApp WebP Sticker from File Picker or Clipboard
function sendMediaBlob(blob, caption = '') {
  if (!socket || !blob) return;
  if (blob.size > 4.5 * 1024 * 1024) {
    toast('File too large (max 4.5 MB)');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const isGif = blob.type === 'image/gif';
    socket.emit('send_message', {
      type: isGif ? 'gif' : 'image',
      media: reader.result,
      text: caption
    });
    SFX.send();
    toast(blob.type === 'image/webp' ? 'WhatsApp Sticker sent! ✨' : isGif ? 'GIF sent! 🎞️' : 'Photo sent! 🖼️');
  };
  reader.readAsDataURL(blob);
}

function handleChatMediaFile(ev) {
  const file = ev.target.files[0];
  if (file) sendMediaBlob(file);
  ev.target.value = '';
}

// Paste directly from Samsung / Android / Desktop Clipboard (Images, Stickers, GIFs, Text)
async function pasteFromClipboard() {
  SFX.tap();
  if (navigator.clipboard && navigator.clipboard.read) {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find((t) => t.startsWith('image/'));
        if (imgType) {
          const blob = await item.getType(imgType);
          sendMediaBlob(blob);
          return;
        }
        if (item.types.includes('text/plain')) {
          const textBlob = await item.getType('text/plain');
          const txt = (await textBlob.text()).trim();
          if (txt.startsWith('https://') && /\.(gif|webp|png|jpg|jpeg)(\?|$)/i.test(txt)) {
            sendGifUrl(txt);
            return;
          }
          if (txt) {
            const inp = document.getElementById('chat-input');
            inp.value += txt;
            inp.focus();
            toast('Pasted text from clipboard 📋');
            return;
          }
        }
      }
      toast('Clipboard is empty or unsupported format');
      return;
    } catch {
      // Fallback to readText
    }
  }
  if (navigator.clipboard && navigator.clipboard.readText) {
    try {
      const txt = await navigator.clipboard.readText();
      if (txt) {
        document.getElementById('chat-input').value += txt;
        toast('Pasted from clipboard 📋');
        return;
      }
    } catch {}
  }
  toast('Long-press the message box & tap Paste (or use 📎 for WhatsApp Stickers)');
}

// Native paste event listener on chat input (works with Samsung Keyboard clipboard & Gboard GIFs!)
document.getElementById('chat-input').addEventListener('paste', (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type && item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) sendMediaBlob(file);
      return;
    }
  }
});

// Pick up Stickers / GIFs / Photos shared directly from WhatsApp via Android Share Sheet!
async function checkSharedFromWhatsApp() {
  const params = new URLSearchParams(location.search);
  const shared = params.get('shared');
  if (!shared || !('caches' in window)) return;
  try {
    const cache = await caches.open('khushil-share-cache');
    if (shared === 'media') {
      const resp = await cache.match('/shared-media');
      if (resp) {
        const blob = await resp.blob();
        const cap = decodeURIComponent(resp.headers.get('X-Shared-Text') || '');
        await cache.delete('/shared-media');
        const chatBtn = document.querySelector('nav.bottom-nav button[data-tab="chat"]');
        openTab('chat', chatBtn, true);
        sendMediaBlob(blob, cap);
      }
    } else if (shared === 'text') {
      const resp = await cache.match('/shared-text');
      if (resp) {
        const txt = await resp.text();
        await cache.delete('/shared-text');
        const chatBtn = document.querySelector('nav.bottom-nav button[data-tab="chat"]');
        openTab('chat', chatBtn, true);
        if (txt) sendMessage(txt);
      }
    }
    history.replaceState({}, '', '/');
  } catch {}
}

/* ========= SNAPS ========= */
const snapCanvas = document.getElementById('snap-canvas');
const snapCtx = snapCanvas.getContext('2d');
let snapPen = '#ff4d8d';
let snapDrawing = false;

function clearSnapCanvas() { snapCtx.clearRect(0, 0, snapCanvas.width, snapCanvas.height); }
function cPos(canvas, e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
}
snapCanvas.addEventListener('pointerdown', (e) => {
  snapDrawing = true;
  const p = cPos(snapCanvas, e);
  snapCtx.beginPath(); snapCtx.moveTo(p.x, p.y);
  snapCtx.strokeStyle = snapPen; snapCtx.lineWidth = 4; snapCtx.lineCap = 'round';
});
snapCanvas.addEventListener('pointermove', (e) => {
  if (!snapDrawing) return;
  const p = cPos(snapCanvas, e);
  snapCtx.lineTo(p.x, p.y); snapCtx.stroke();
});
window.addEventListener('pointerup', () => { snapDrawing = false; liveDrawing = false; });

function loadSnapPhoto(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      clearSnapCanvas();
      const scale = Math.min(snapCanvas.width / img.width, snapCanvas.height / img.height);
      const w = img.width * scale, h = img.height * scale;
      snapCtx.drawImage(img, (snapCanvas.width - w) / 2, (snapCanvas.height - h) / 2, w, h);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
function sendSnap() {
  if (!socket) return;
  const img = snapCanvas.toDataURL('image/jpeg', 0.78);
  const caption = document.getElementById('snap-caption').value.trim() || 'Instant click 📸';
  const viewOnce = document.getElementById('snap-view-once').checked;
  socket.emit('send_snap', { img, caption, viewOnce });
  document.getElementById('snap-caption').value = '';
  clearSnapCanvas();
  SFX.snap();
  toast('Snap sent! 🔥');
}
let viewingSnapId = null;
function openSnap(id) {
  if (!state) return;
  const s = state.snaps.find((x) => x.id === id);
  if (!s) return;
  if (s.viewOnce && s.opened && !s.img) return toast('This View-Once snap already expired 💨');
  viewingSnapId = s.from !== currentUser ? id : null;
  document.getElementById('snap-modal-img').src = s.img;
  document.getElementById('snap-modal-cap').textContent = `${s.from === 'sahil' ? 'Sahil' : 'Khushi'}: ${s.caption}`;
  document.getElementById('snap-modal-note').textContent = s.viewOnce ? '⏳ View Once — disappears when closed' : '💾 Saved Snap';
  document.getElementById('snap-modal').classList.add('open');
  SFX.tap();
}
function closeSnapModal() {
  document.getElementById('snap-modal').classList.remove('open');
  if (viewingSnapId && socket) {
    socket.emit('open_snap', { id: viewingSnapId });
    viewingSnapId = null;
  }
}

/* ========= REAL INTERACTIVE LIVE MAP (STREET / SATELLITE / DARK) ========= */
let map = null, tileLayers = {}, activeLayerName = 'street';
let markerSahil = null, markerKhushi = null, circleSahil = null, circleKhushi = null, routeLine = null;
let gpsWatchId = null, lastGeocodeAt = 0, lastPlaceName = '';

function makePinIcon(who, label) {
  return L.divIcon({
    className: '',
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    html: `<div class="live-pin-wrap pin-${who}"><div class="live-pin-ring"></div><div class="live-pin-core">${label}</div></div>`
  });
}

function initMap() {
  if (map || typeof L === 'undefined') return;
  map = L.map('leaflet-map', { zoomControl: true, attributionControl: false }).setView([28.59, 77.04], 11);

  tileLayers = {
    street: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 })
  };
  tileLayers.street.addTo(map);

  markerSahil = L.marker([28.4744, 77.0125], { icon: makePinIcon('sahil', '💙 Sahil') }).addTo(map);
  markerKhushi = L.marker([28.7160, 77.0650], { icon: makePinIcon('khushi', '💖 Khushi') }).addTo(map);

  circleSahil = L.circle([28.4744, 77.0125], { radius: 80, color: '#38e8ff', fillOpacity: 0.12, weight: 1 }).addTo(map);
  circleKhushi = L.circle([28.7160, 77.0650], { radius: 80, color: '#ff4d8d', fillOpacity: 0.12, weight: 1 }).addTo(map);

  routeLine = L.polyline([[28.4744, 77.0125], [28.7160, 77.0650]], {
    color: '#ffcb57', dashArray: '8, 8', weight: 3, opacity: 0.9
  }).addTo(map);
}

function setMapStyle(styleName, btn) {
  SFX.tap();
  initMap();
  if (!map || !tileLayers[styleName]) return;
  Object.values(tileLayers).forEach((l) => map.removeLayer(l));
  tileLayers[styleName].addTo(map);
  activeLayerName = styleName;
  document.querySelectorAll('.map-style-btn').forEach((b) => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function haversineKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function reverseGeocode(lat, lng) {
  if (Date.now() - lastGeocodeAt < 45000 && lastPlaceName) return lastPlaceName;
  lastGeocodeAt = Date.now();
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
    const d = await r.json();
    const a = d.address || {};
    lastPlaceName = [a.suburb || a.neighbourhood || a.road, a.city || a.town || a.state_district].filter(Boolean).join(', ') || 'Live GPS';
    return lastPlaceName;
  } catch {
    return lastPlaceName || 'Live GPS';
  }
}

async function sendGPSCoords(pos) {
  if (!socket) return;
  let bat = null;
  try {
    if (navigator.getBattery) {
      const b = await navigator.getBattery();
      bat = Math.round(b.level * 100);
    }
  } catch {}
  const place = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
  socket.emit('update_location', {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy || 20,
    place,
    battery: bat
  });
}

function toggleLiveGPS() {
  SFX.tap();
  const btn = document.getElementById('gps-btn');
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
    btn.textContent = '📡 Share My Exact GPS';
    sendTelemetry();
    toast('Live GPS paused');
    return;
  }
  if (!navigator.geolocation) return toast('GPS unavailable in this browser');
  btn.textContent = '🟢 Live GPS ON (Stop)';
  toast('Locating exact GPS position... 🛰️');
  gpsWatchId = navigator.geolocation.watchPosition(
    sendGPSCoords,
    () => toast('Allow Location permission on your phone to share exact live pin'),
    { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 }
  );
  sendTelemetry();
}

function focusPin(who) {
  SFX.tap();
  initMap();
  if (!map || !state) return;
  const c = state.coords[who];
  if (!c) return toast('Location currently hidden');
  map.flyTo([c.lat, c.lng], 16, { duration: 0.9 });
}

function centerMap() {
  SFX.tap();
  initMap();
  if (!map || !state) return;
  const s = state.coords.sahil, k = state.coords.khushi;
  if (s && k) map.fitBounds([[s.lat, s.lng], [k.lat, k.lng]], { padding: [46, 46] });
  else if (k) map.flyTo([k.lat, k.lng], 15);
  else if (s) map.flyTo([s.lat, s.lng], 15);
}

function openPartnerInGoogleMaps() {
  const partner = currentUser === 'sahil' ? 'khushi' : 'sahil';
  const c = state?.coords?.[partner];
  if (!c) return toast('Partner location is currently hidden');
  window.open(`https://www.google.com/maps?q=${c.lat},${c.lng}`, '_blank');
}

function safePing(msg) {
  sendMessage(`🛡️ Safe Check-In: ${msg}`);
  toast('Safe-Arrival Ping sent to Chat 🛡️');
}

/* ========= WEBRTC VOICE & HD VIDEO CALLING ========= */
let pc = null, localStream = null, callMode = 'video', facingMode = 'user';
let isMicMuted = false, isCamOff = false, callTimerIv = null, callSeconds = 0;

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

function showCallOverlay(stateText, isIncoming = false) {
  document.getElementById('call-overlay').classList.add('active');
  document.getElementById('call-status-text').textContent = stateText;
  const partnerName = currentUser === 'sahil' ? 'Khushi 💖' : 'Sahil 💙';
  document.getElementById('call-partner-name').textContent = partnerName;
  document.getElementById('call-accept-btn').style.display = isIncoming ? 'grid' : 'none';
  document.getElementById('local-video').style.display = callMode === 'video' ? 'block' : 'none';
  document.getElementById('remote-video').style.display = callMode === 'video' ? 'block' : 'none';
  document.getElementById('call-avatar-center').style.display = callMode === 'audio' || isIncoming ? 'block' : 'none';
}

async function prepareMedia(mode) {
  if (localStream) localStream.getTracks().forEach((t) => t.stop());
  localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: mode === 'video' ? { facingMode } : false
  });
  document.getElementById('local-video').srcObject = localStream;
}

function createPeerConnection() {
  pc = new RTCPeerConnection(ICE_CONFIG);
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  pc.ontrack = (ev) => {
    const rv = document.getElementById('remote-video');
    rv.srcObject = ev.streams[0];
    if (callMode === 'video') document.getElementById('call-avatar-center').style.display = 'none';
  };
  pc.onicecandidate = (ev) => {
    if (ev.candidate && socket) socket.emit('webrtc_ice', { candidate: ev.candidate });
  };
  pc.onconnectionstatechange = () => {
    if (pc && pc.connectionState === 'connected') {
      SFX.ringStop();
      startCallTimer();
    } else if (pc && ['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
      cleanupCall();
    }
  };
}

function startCallTimer() {
  clearInterval(callTimerIv);
  callSeconds = 0;
  callTimerIv = setInterval(() => {
    callSeconds++;
    const m = String(Math.floor(callSeconds / 60)).padStart(2, '0');
    const s = String(callSeconds % 60).padStart(2, '0');
    document.getElementById('call-status-text').textContent = `${callMode === 'video' ? 'HD Video' : 'Voice'} • ${m}:${s}`;
  }, 1000);
}

async function startCall(mode) {
  if (!socket) return;
  SFX.unlock();
  callMode = mode;
  try {
    await prepareMedia(mode);
    showCallOverlay(mode === 'video' ? 'Calling (HD Video)...' : 'Calling (Voice)...', false);
    socket.emit('call_invite', { mode });
  } catch {
    toast('Allow Camera & Microphone permission to make calls');
  }
}

function handleIncomingCall({ mode }) {
  callMode = mode || 'video';
  SFX.ringStart();
  showCallOverlay(callMode === 'video' ? 'Incoming HD Video Call 📹' : 'Incoming Voice Call 📞', true);
}

async function acceptIncomingCall() {
  SFX.ringStop();
  try {
    await prepareMedia(callMode);
    createPeerConnection();
    showCallOverlay('Connecting...', false);
    socket.emit('call_accept', { mode: callMode });
  } catch {
    toast('Allow Camera & Microphone permission to answer');
    endActiveCall();
  }
}

async function handleCallAccepted() {
  try {
    createPeerConnection();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('webrtc_offer', { offer });
    showCallOverlay('Connecting...', false);
  } catch {
    cleanupCall();
  }
}

async function handleWebRTCOffer({ offer }) {
  if (!pc) return;
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('webrtc_answer', { answer });
}

async function handleWebRTCAnswer({ answer }) {
  if (!pc) return;
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

async function handleWebRTCIce({ candidate }) {
  if (pc && candidate) {
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
  }
}

function toggleMuteMic() {
  if (!localStream) return;
  isMicMuted = !isMicMuted;
  localStream.getAudioTracks().forEach((t) => t.enabled = !isMicMuted);
  document.getElementById('call-mute-btn').classList.toggle('muted', isMicMuted);
}

function toggleCallCam() {
  if (!localStream) return;
  isCamOff = !isCamOff;
  localStream.getVideoTracks().forEach((t) => t.enabled = !isCamOff);
  document.getElementById('call-cam-btn').classList.toggle('muted', isCamOff);
}

async function flipCallCamera() {
  if (!localStream || callMode !== 'video') return;
  facingMode = facingMode === 'user' ? 'environment' : 'user';
  try {
    const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
    const newTrack = newStream.getVideoTracks()[0];
    const sender = pc?.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (sender) await sender.replaceTrack(newTrack);
    localStream.getVideoTracks().forEach((t) => t.stop());
    localStream.removeTrack(localStream.getVideoTracks()[0]);
    localStream.addTrack(newTrack);
    document.getElementById('local-video').srcObject = localStream;
    SFX.tap();
  } catch { toast('Could not switch camera'); }
}

function sendInCallFx(kind) {
  if (socket) socket.emit('call_fx', { kind });
}

function endActiveCall() {
  if (socket) socket.emit('call_end');
  cleanupCall();
}

function cleanupCall() {
  SFX.ringStop();
  clearInterval(callTimerIv);
  if (pc) { pc.close(); pc = null; }
  if (localStream) { localStream.getTracks().forEach((t) => t.stop()); localStream = null; }
  isMicMuted = false; isCamOff = false;
  document.getElementById('call-mute-btn').classList.remove('muted');
  document.getElementById('call-cam-btn').classList.remove('muted');
  document.getElementById('remote-video').srcObject = null;
  document.getElementById('local-video').srcObject = null;
  document.getElementById('call-overlay').classList.remove('active');
}

/* ========= LIVE DRAW & ARCADE ========= */
function showGame(id, btn) {
  SFX.tap();
  document.querySelectorAll('.game-pane').forEach((p) => p.style.display = 'none');
  document.getElementById('game-' + id).style.display = 'block';
  document.querySelectorAll('.subtabs button').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
}

const liveCanvas = document.getElementById('live-draw-canvas');
const liveCtx = liveCanvas.getContext('2d');
let livePen = '#ff4d8d', liveDrawing = false, lastPt = null;

function drawRemoteStroke({ x1, y1, x2, y2, color }) {
  liveCtx.beginPath(); liveCtx.moveTo(x1, y1); liveCtx.lineTo(x2, y2);
  liveCtx.strokeStyle = color; liveCtx.lineWidth = 4; liveCtx.lineCap = 'round'; liveCtx.stroke();
}
liveCanvas.addEventListener('pointerdown', (e) => { liveDrawing = true; lastPt = cPos(liveCanvas, e); });
liveCanvas.addEventListener('pointermove', (e) => {
  if (!liveDrawing || !lastPt) return;
  const pt = cPos(liveCanvas, e);
  const stroke = { x1: lastPt.x, y1: lastPt.y, x2: pt.x, y2: pt.y, color: livePen };
  drawRemoteStroke(stroke);
  if (socket) socket.emit('draw_stroke', stroke);
  lastPt = pt;
});

/* ========= SAHIL EXCLUSIVE ADMIN CONTROLS ========= */
function adminLaunchFireworks() {
  if (!socket || currentUser !== 'sahil') return;
  const duration = Number(document.getElementById('adm-fw-dur').value || 60);
  const intensity = document.getElementById('adm-fw-mode').value;
  const message = document.getElementById('adm-fw-msg').value.trim() || '✨ 11:11 For My Khushi ✨';
  socket.emit('admin_trigger_fireworks', { duration, intensity, message });
  toast('Launched Grand Fireworks live on both screens! 🎆');
}

function adminSendTakeover() {
  if (!socket || currentUser !== 'sahil') return;
  const title = document.getElementById('adm-tk-title').value.trim() || '💌 From Sahil';
  const message = document.getElementById('adm-tk-msg').value.trim();
  if (!message) return toast('Write a message first');
  socket.emit('admin_send_takeover', { title, message });
  document.getElementById('adm-tk-msg').value = '';
  SFX.send();
  toast('Full-Screen Love Takeover sent to Khushi 💌');
}

function adminToggleSetting(key, val) {
  if (!socket || currentUser !== 'sahil') return;
  socket.emit('admin_update_settings', { [key]: val });
  SFX.tap();
  toast('Admin setting updated 👑');
}

function adminSetTheme(theme) {
  if (!socket || currentUser !== 'sahil') return;
  socket.emit('admin_update_settings', { theme });
  SFX.tap();
  toast('Global app theme switched 🎨');
}

function adminToggleLockTab(tabName, locked) {
  if (!socket || currentUser !== 'sahil' || !state) return;
  const set = new Set(state.admin?.lockedTabs || []);
  if (locked) set.add(tabName); else set.delete(tabName);
  socket.emit('admin_update_settings', { lockedTabs: Array.from(set) });
  toast(`${tabName.toUpperCase()} tab ${locked ? 'locked 🔒' : 'unlocked 🔓'}`);
}

function renderAdminTelemetry(tel, isOnline) {
  const el = document.getElementById('adm-telemetry');
  if (!el || !tel) return;
  el.innerHTML = `
    <div class="row" style="justify-content:space-between; margin-bottom:6px;">
      <span>Status: <b>${isOnline ? '🟢 Online Now' : '⚪ Offline'}</b></span>
      <span>Active Tab: <b>${esc(tel.activeTab || 'home').toUpperCase()}</b></span>
    </div>
    <div class="row" style="justify-content:space-between; font-size:12px; color:var(--muted);">
      <span>Screen: <b>${tel.visible ? 'Open 👀' : 'Background'}</b></span>
      <span>Battery: <b>${tel.battery !== null ? tel.battery + '%' : '--'}</b></span>
      <span>GPS: <b>${tel.gpsActive ? 'Active 🛰️' : 'Off'}</b></span>
    </div>
  `;
}

/* ========= RENDER ALL UI ========= */
function renderStickerBubble(stickerId) {
  const st = BUILTIN_STICKERS.find((x) => x.id === stickerId) || BUILTIN_STICKERS[0];
  return `<div class="sticker-card"><div class="sticker-emoji">${st.emoji}</div><div class="sticker-label">${esc(st.label)}</div></div>`;
}

function renderAll() {
  if (!state) return;
  const partner = currentUser === 'sahil' ? 'khushi' : 'sahil';

  // Home
  document.getElementById('partner-mood-pill').textContent =
    `${partner === 'sahil' ? 'Sahil' : 'Khushi'}: ${state.moods[partner] || 'No mood'}`;
  document.getElementById('wish-list').innerHTML = state.wishes.slice(-3).reverse().map((w) =>
    `<div style="padding:5px 0; border-top:1px solid rgba(255,255,255,0.06);">✨ <b>${w.by === 'sahil' ? 'Sahil' : 'Khushi'}:</b> ${esc(w.text)} <span style="opacity:0.6;">(${w.time})</span></div>`
  ).join('');

  document.getElementById('dq-prompt').textContent = state.dailyQ.prompt;
  const aS = state.dailyQ.answers.sahil, aK = state.dailyQ.answers.khushi;
  if (aS && aK) {
    document.getElementById('dq-status').textContent = 'Unlocked 🔓';
    document.getElementById('dq-reveal').innerHTML = `<div>💙 <b>Sahil:</b> ${esc(aS)}</div><div style="margin-top:4px;">💖 <b>Khushi:</b> ${esc(aK)}</div>`;
  } else {
    document.getElementById('dq-status').textContent = `${(aS ? 1 : 0) + (aK ? 1 : 0)}/2`;
    document.getElementById('dq-reveal').textContent = 'Answers unlock automatically once both reply.';
  }

  document.getElementById('song-display').innerHTML = `🎶 <b>${esc(state.songOfDay.title)}</b> <small style="color:var(--muted);">— ${state.songOfDay.by === 'sahil' ? 'Sahil' : 'Khushi'}</small>`;
  document.getElementById('bucket-list').innerHTML = state.bucketList.map((b) =>
    `<div style="display:flex; align-items:center; gap:8px; padding:5px 0; font-size:13px; cursor:pointer;" onclick="socket.emit('bucket_toggle',{id:${b.id}})">
      <span>${b.done ? '✅' : '⬜'}</span>
      <span style="${b.done ? 'text-decoration:line-through; opacity:0.6;' : ''}">${esc(b.text)}</span>
    </div>`
  ).join('');

  // Chat
  const cBox = document.getElementById('chat-messages');
  cBox.innerHTML = state.messages.map((m) => {
    const mine = m.from === currentUser;
    const receipt = mine ? (m.seenAt ? `✓✓ Seen ${m.seenAt}` : '✓ Sent') : '';
    const isMedia = m.type === 'image' || m.type === 'gif' || m.type === 'sticker';
    let bodyHtml = '';
    if (m.type === 'sticker') bodyHtml = renderStickerBubble(m.stickerId);
    else if (m.type === 'image' || m.type === 'gif') {
      bodyHtml = `<img class="msg-media" src="${esc(m.media)}" alt="media" />` + (m.text ? `<div style="margin-top:5px;">${esc(m.text)}</div>` : '');
    } else {
      bodyHtml = `<div>${esc(m.text)}</div>`;
    }
    const delBtn = currentUser === 'sahil'
      ? `<span class="msg-del" onclick="event.stopPropagation(); socket.emit('admin_delete_msg',{id:${m.id}})">🗑️</span>` : '';
    return `<div class="msg ${mine ? 'mine' : 'theirs'} ${isMedia ? 'media-bubble' : ''}" onclick="socket.emit('react_message',{id:${m.id}})">
      ${bodyHtml}
      <div class="msg-meta"><span>${m.time}</span><span>${receipt}</span>${delBtn}</div>
      ${m.react ? `<span class="msg-react">${m.react}</span>` : ''}
    </div>`;
  }).join('');
  cBox.scrollTop = cBox.scrollHeight;

  // Snaps
  document.getElementById('streak-pill').textContent = `🔥 ${state.streak} Day Streak`;
  document.getElementById('freeze-btn').textContent = `❄️ Freeze: ${state.freezeOn ? 'ON' : 'OFF'}`;
  const sList = document.getElementById('snaps-list');
  sList.innerHTML = state.snaps.length ? state.snaps.map((s) => {
    const label = s.viewOnce ? (s.opened ? '💨 Expired' : '🔴 View Once') : '💜 Saved';
    return `<div class="snap-item">
      <div><b>${s.from === 'sahil' ? '💙 Sahil' : '💖 Khushi'}</b> • <small style="color:var(--muted);">${s.time}</small>
      <div style="font-size:12px; color:var(--muted);">${esc(s.caption)}</div></div>
      <button class="btn small ${s.opened && s.viewOnce ? 'secondary' : ''}" onclick="openSnap(${s.id})">${label}</button>
    </div>`;
  }).join('') : '<small style="color:var(--muted);">No snaps yet — take a photo or doodle above!</small>';

  // Map
  if (activeTab === 'map') renderMap(false);

  // Connect 4
  const c4 = state.c4;
  document.getElementById('c4-status').textContent = c4.winner
    ? `🏆 ${c4.winner === 'sahil' ? 'Sahil' : 'Khushi'} Wins!`
    : `${c4.turn === 'sahil' ? 'Sahil' : 'Khushi'}'s Turn`;
  const c4El = document.getElementById('c4-board');
  c4El.innerHTML = '';
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      const cell = document.createElement('div');
      cell.className = 'c4-cell ' + (c4.board[r][c] || '');
      cell.onclick = () => { SFX.drop(); socket.emit('c4_move', { col: c }); };
      c4El.appendChild(cell);
    }
  }

  // Hearts vs Stars
  const ttt = state.ttt;
  document.getElementById('ttt-status').textContent = ttt.winner === 'draw' ? '🤝 Draw!' :
    ttt.winner ? `🏆 ${ttt.winner === 'sahil' ? 'Sahil' : 'Khushi'} Wins!` :
    `${ttt.turn === 'sahil' ? 'Sahil (⭐)' : 'Khushi (💖)'} Turn`;
  document.getElementById('ttt-score').textContent = `Sahil ${ttt.score.sahil} — ${ttt.score.khushi} Khushi`;
  document.getElementById('ttt-board').innerHTML = ttt.board.map((v, i) =>
    `<div class="ttt-cell" onclick="SFX.tap(); socket.emit('ttt_move',{idx:${i}})">${v === 'sahil' ? '⭐' : v === 'khushi' ? '💖' : ''}</div>`
  ).join('');

  // Wheel & MLT
  document.getElementById('wheel-result').textContent = state.wheelResult;
  document.getElementById('mlt-question').textContent = state.mlt.question;
  const v = state.mlt.votes;
  document.getElementById('mlt-reveal').innerHTML = (v.sahil && v.khushi)
    ? `<b>${v.sahil === v.khushi ? '🎉 IT\'S A MATCH!' : '😂 Split Vote!'}</b><br/>Sahil: <b>${v.sahil}</b> • Khushi: <b>${v.khushi}</b>`
    : `${(v.sahil ? 1 : 0) + (v.khushi ? 1 : 0)}/2 voted — reveals once both vote!`;

  // Admin Panel Controls (Sahil only)
  if (currentUser === 'sahil' && state.admin) {
    document.getElementById('adm-stealth-loc').checked = !!state.admin.stealthLocation;
    document.getElementById('adm-stealth-pres').checked = !!state.admin.stealthPresence;
    document.getElementById('adm-stealth-rec').checked = !!state.admin.stealthReceipts;
    document.getElementById('adm-lock-map').checked = state.admin.lockedTabs.includes('map');
    document.getElementById('adm-lock-arcade').checked = state.admin.lockedTabs.includes('arcade');
    document.getElementById('adm-theme-select').value = state.theme || 'cyber-aurora';
    if (state.telemetry) renderAdminTelemetry(state.telemetry, !!presence.khushi);
  }

  // Badges
  const unreadMsgs = state.messages.filter((m) => m.from !== currentUser && !m.seenAt).length;
  const bChat = document.getElementById('chat-badge');
  bChat.textContent = unreadMsgs; bChat.classList.toggle('show', unreadMsgs > 0);
  const unreadSnaps = state.snaps.filter((s) => s.from !== currentUser && !s.opened).length;
  const bSnap = document.getElementById('snap-badge');
  bSnap.textContent = unreadSnaps; bSnap.classList.toggle('show', unreadSnaps > 0);
}

function renderMap(shouldFit = false) {
  if (!state) return;
  const s = state.coords.sahil, k = state.coords.khushi;
  const partner = currentUser === 'sahil' ? 'khushi' : 'sahil';

  if (s && k) {
    const km = haversineKm(s, k);
    document.getElementById('distance-readout').textContent = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`;
    const mins = Math.max(2, Math.round((km / 34) * 60));
    document.getElementById('drive-readout').textContent = `~${mins} min apart • Sahil: ${s.place} (${s.updatedAt}) • Khushi: ${k.place} (${k.updatedAt})`;
  } else {
    document.getElementById('distance-readout').textContent = 'Private 🔒';
    document.getElementById('drive-readout').textContent = k ? `Your pin: ${k.place} (${k.updatedAt})` : 'Share GPS to see exact pin';
  }

  const pBat = state.coords[partner]?.battery;
  document.getElementById('partner-bat-pill').textContent = pBat !== null && pBat !== undefined ? `🔋 Partner ${pBat}%` : 'Live Map';

  if (map) {
    if (s) {
      markerSahil.setLatLng([s.lat, s.lng]).setOpacity(1);
      circleSahil.setLatLng([s.lat, s.lng]).setRadius(Math.max(25, s.accuracy || 40));
    } else {
      markerSahil.setOpacity(0);
      circleSahil.setRadius(0);
    }
    if (k) {
      markerKhushi.setLatLng([k.lat, k.lng]).setOpacity(1);
      circleKhushi.setLatLng([k.lat, k.lng]).setRadius(Math.max(25, k.accuracy || 40));
    }
    if (s && k) {
      routeLine.setLatLngs([[s.lat, s.lng], [k.lat, k.lng]]);
    } else {
      routeLine.setLatLngs([]);
    }
    if (shouldFit) centerMap();
  }
}

/* ========= CLOCKS & 11:11 WATCHER ========= */
function updateClocks() {
  const now = new Date();
  if (state) {
    const target = new Date(state.meetupDate + 'T18:00:00');
    const diff = Math.max(0, target - now);
    document.getElementById('cd-days').textContent = Math.floor(diff / 86400000);
    document.getElementById('cd-hours').textContent = Math.floor((diff % 86400000) / 3600000);
    document.getElementById('cd-mins').textContent = Math.floor((diff % 3600000) / 60000);
  }
  const slots = [
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 11, 0),
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 11, 0),
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 11, 0)
  ];
  const rem = slots.find((s) => s > now) - now;
  document.getElementById('next-1111-pill').textContent = `Next 11:11 in ${Math.floor(rem / 3600000)}h ${Math.floor((rem % 3600000) / 60000)}m`;

  const h = now.getHours(), m = now.getMinutes();
  if (optIn1111 && currentUser && (h === 11 || h === 23) && m === 11) {
    const key = `${now.toISOString().slice(0, 10)}-${h}:11`;
    if (last1111Key !== key) {
      last1111Key = key;
      localStorage.setItem('khushil_last_1111', key);
      FireworksEngine.launch(60, '✨ 11:11 For My Khushi ✨', 'grand');
    }
  }
}
setInterval(updateClocks, 1000);

function toggle1111(checked) {
  optIn1111 = checked;
  localStorage.setItem('khushil_optin_1111', checked ? '1' : '0');
  toast(checked ? '11:11 Grand Fireworks Enabled 🎆' : '11:11 Auto Show Paused');
}

function copyRoutineLink() {
  const url = location.origin + '/?fireworks=1';
  if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('Copied Samsung Routine link! 🔗'));
  else prompt('Copy this link for Samsung Modes & Routines:', url);
}

function save1111Wish() {
  const inp = document.getElementById('fw-wish-input');
  const text = inp.value.trim();
  if (!text || !socket) return;
  socket.emit('save_wish', { text });
  inp.value = '';
  SFX.send();
  toast('11:11 Wish saved to your shared jar ✨');
}
