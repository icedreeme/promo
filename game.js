// =====================================================================
//  dreeme — «воздушный шар»  ·  мини-игра для Telegram
// =====================================================================

// ---------- КОНФИГ: все тексты и ссылки правятся здесь ----------
const CFG = {
  artist: 'dreeme',
  track: 'воздушный шар',
  listenUrl: 'https://soundcloud.com/icedreeme/vozdushniyshar',// ← ссылка на трек в SoundCloud
  shareUrl: 'https://t.me/dreeme_shar_bot/shar_promo',         // ← ссылка на саму игру (t.me/имя_бота/имя_приложения)
  botUrl: 'https://t.me/dreeme_shar_bot',  // ← бот: запасной способ получить mp3 (/start mp3)
  claimUrl:'https://dreeme-mp3.jimmy19work.workers.dev',                      // ← адрес Cloudflare Worker (bot-worker.js), который присылает mp3
  intro: [
    'привет. я dreeme.',
    'это мой новый трек — «воздушный шар».',
    'но пока он звучит совсем тихо, давай это исправим.',
    'пройдёшь до конца — заберёшь mp3шку ;)',
    'для начала надуй шар.'
  ],
  howto: [
    'держи палец на экране — шар поднимается. отпустишь — опускается.',
    'собирай ноты и не врезайся в птиц.'
  ],
  mid1: [
    'неплохо. дальше облака и ветер — собирай цветы.'
  ],
  mid2: [
    'а теперь последний уровень. собирай строчки из припева — удачи!'
  ],
  // припев: каждая строка разбита на 2 кусочка
  lyrics: ['я поднимаюсь в небо', 'как воздушный шар', 'набираю высоту', 'в моей груди пожар',
           'я больше не хочу', 'от себя бежать', 'сейчас будет песня', 'сиди тихо не мешай'],
  // Трек играет без остановок. До 3 уровня — глухо, «за стеной», по кругу. На 3 уровне — чисто,
  // строчки подлетают к шару ровно тогда, когда их поют в треке. Если не совпадает — поправь цифры (секунды):
  chorus: {
    starts: [32.2],                    // где в треке начинается припев (на 3 уровне трек переходит сюда)
    lines: [0.2, 4.5, 8.8, 13.1],      // когда начинается каждая из 4 строк — от начала припева
    half: 2.0                          // через сколько секунд после начала строки поётся её вторая половина
  },
  wallCutoff: 650,                     // насколько глухо «за стеной» (меньше = глуше; ниже 500 на телефоне почти не слышно)
  levelTime: 50
};

// ---------- Telegram ----------
const tg = window.Telegram && window.Telegram.WebApp;
if (tg) {
  try { tg.ready(); tg.expand(); } catch (e) {}
  try { tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } catch (e) {}
  try { tg.setHeaderColor('#ffffff'); tg.setBackgroundColor('#ffffff'); } catch (e) {}
}
let lastHaptic = 0;
function haptic(kind) {
  if (!tg || !tg.HapticFeedback) return;
  const now = performance.now();
  if (kind === 'light' && now - lastHaptic < 70) return;
  lastHaptic = now;
  try {
    if (kind === 'error' || kind === 'success') tg.HapticFeedback.notificationOccurred(kind);
    else tg.HapticFeedback.impactOccurred(kind);
  } catch (e) {}
}
function openLink(url) {
  try { if (tg && tg.openLink) return tg.openLink(url); } catch (e) {}
  window.open(url, '_blank');
}

// ---------- canvas ----------
const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
let W = 0, H = 0, S = 1, TOP = 0;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  S = Math.max(0.75, Math.min(1.5, Math.min(W / 390, H / 740)));
  let t = 0;
  if (tg) {
    const a = tg.safeAreaInset, b = tg.contentSafeAreaInset;
    t = ((a && a.top) || 0) + ((b && b.top) || 0);
  }
  TOP = t + 8 * S;
}
window.addEventListener('resize', resize);
if (tg) { try { tg.onEvent('viewportChanged', resize); } catch (e) {} }
resize();

// ---------- utils ----------
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function hsh(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; }
let BOIL = 0;                       // «дрожание» карандашных линий
function J(seed, i) { return hsh(seed * 13.37 + i * 7.13 + BOIL * 3.71); }
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

// ---------- карандаш ----------
function pen(w = 1.6, a = 0.88) {
  ctx.lineWidth = w * S; ctx.strokeStyle = `rgba(28,28,28,${a})`;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
}
function curve(pts) {
  if (pts.length < 2) return;
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const l = pts[pts.length - 1]; ctx.lineTo(l[0], l[1]);
}
function sPoly(pts, seed, amp = 1.1, passes = 2) {
  const a = amp * S;
  for (let k = 0; k < passes; k++) {
    ctx.beginPath();
    curve(pts.map((p, i) => [p[0] + J(seed, i * 3 + k * 101) * a, p[1] + J(seed, i * 3 + 1 + k * 101) * a]));
    ctx.stroke();
  }
}
function sLine(x1, y1, x2, y2, seed, amp = 1.1, passes = 2) {
  const a = amp * S;
  for (let k = 0; k < passes; k++) {
    ctx.beginPath();
    ctx.moveTo(x1 + J(seed, k * 9) * a, y1 + J(seed, k * 9 + 1) * a);
    ctx.quadraticCurveTo((x1 + x2) / 2 + J(seed, k * 9 + 2) * a * 1.6, (y1 + y2) / 2 + J(seed, k * 9 + 3) * a * 1.6,
      x2 + J(seed, k * 9 + 4) * a, y2 + J(seed, k * 9 + 5) * a);
    ctx.stroke();
  }
}
function ellPts(cx, cy, rx, ry, over = 0.35, n = 0) {
  n = n || Math.max(12, Math.round((rx + ry) / (3 * S)));
  const a0 = -Math.PI / 2, pts = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (Math.PI * 2 + over) * i / n; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return pts;
}
function sEll(cx, cy, rx, ry, seed, amp = 1, passes = 2) { sPoly(ellPts(cx, cy, rx, ry), seed, amp, passes); }
function txt(s, x, y, size, align = 'center', alpha = 0.9, weight = 500) {
  ctx.font = `${weight} ${size * S}px Caveat, cursive`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillStyle = `rgba(28,28,28,${alpha})`;
  ctx.fillText(s, x, y);
}

// облако как на референсах: волнистый верх + пунктирный низ
function cloudPts(x, y, w, h, nb) {
  const pts = [];
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = Math.PI + t * Math.PI;
    const r = 0.78 + 0.28 * Math.abs(Math.sin(t * Math.PI * nb));
    pts.push([x + Math.cos(a) * w / 2 * (0.9 + 0.1 * r), y + Math.sin(a) * h * r]);
  }
  return pts;
}
function drawCloud(x, y, w, h, seed, opts = {}) {
  const nb = 3 + (Math.abs(Math.floor(seed)) % 3);
  const pts = cloudPts(x, y, w, h, nb);
  if (opts.fill !== false) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); curve(pts); ctx.closePath(); ctx.fill();
  }
  pen(1.3, opts.alpha || 0.7);
  sPoly(pts, seed, 1, 1);
  // пунктирное «дно»
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const x1 = x - w / 2 + (i / segs) * w, x2 = x1 + w / segs * 0.6;
    sLine(x1, y, x2, y, seed + i, 0.6, 1);
  }
}
function drawStormCloud(x, y, w, h, seed) {
  const blobs = [[-0.3, 0.1, 0.32], [0, -0.15, 0.4], [0.3, 0.05, 0.33], [0.05, 0.25, 0.35]];
  // сначала контуры всех «бугров», потом белая заливка поверх — остаётся только внешний контур
  pen(2.4, 0.85);
  blobs.forEach((b, i) => sEll(x + b[0] * w, y + b[1] * h, b[2] * w, b[2] * h * 1.25, seed + i * 5, 1, 1));
  const inset = 2.2 * S;
  ctx.save();
  ctx.beginPath();
  blobs.forEach(b => { ctx.moveTo(x + b[0] * w + b[2] * w - inset, y + b[1] * h); ctx.ellipse(x + b[0] * w, y + b[1] * h, b[2] * w - inset, b[2] * h * 1.25 - inset, 0, 0, Math.PI * 2); });
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.clip();
  pen(1.1, 0.5);
  for (let i = -w; i < w * 1.2; i += 7 * S) sLine(x - w / 2 + i, y - h, x - w / 2 + i - h * 0.9, y + h, seed + i, 0.8, 1);
  ctx.restore();
}
function drawDust(x, y, r, seed) {
  pen(1.3, 0.75);
  const pts = [];
  for (let i = 0; i < 46; i++) {
    const a = i * 0.62 + seed, rr = r * (0.45 + 0.55 * Math.abs(Math.sin(i * 1.7 + seed)));
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  sPoly(pts, seed, 1.6, 1);
}
function drawBird(x, y, sz, phase, seed) {
  const f = Math.sin(phase) * 6 * sz;
  pen(1.8, 0.9);
  for (let k = 0; k < 2; k++) {
    const j = J(seed, k) * 0.8 * S;
    ctx.beginPath();
    ctx.moveTo(x - 14 * sz, y - 4 * sz + f + j);
    ctx.quadraticCurveTo(x - 6 * sz, y - 9 * sz + f * 0.3, x, y + j);
    ctx.quadraticCurveTo(x + 6 * sz, y - 9 * sz + f * 0.3, x + 14 * sz, y - 4 * sz + f - j);
    ctx.stroke();
  }
}
function drawNote(x, y, sz, seed) {
  pen(1.8, 0.92);
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(28,28,28,0.85)';
  ctx.beginPath(); ctx.ellipse(-4 * sz, 7 * sz, 6 * sz, 4.4 * sz, -0.45, 0, Math.PI * 2); ctx.fill();
  sEll(-4 * sz, 7 * sz, 6.2 * sz, 4.6 * sz, seed, 0.6, 1);
  sLine(1.6 * sz, 6 * sz, 1.6 * sz, -14 * sz, seed + 1, 0.6);
  sPoly([[1.6 * sz, -14 * sz], [7 * sz, -10 * sz], [9 * sz, -4 * sz], [6 * sz, 1 * sz]], seed + 2, 0.6);
  ctx.restore();
}
function drawFlower(x, y, sz, seed) {
  pen(1.5, 0.9);
  sLine(x, y + 4 * sz, x + 1 * sz, y + 17 * sz, seed + 9, 0.6);
  sPoly([[x + 0.5 * sz, y + 12 * sz], [x + 6 * sz, y + 9 * sz], [x + 8 * sz, y + 11 * sz], [x + 1 * sz, y + 14 * sz]], seed + 7, 0.5, 1);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 - Math.PI / 2;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 6.5 * sz, y + Math.sin(a) * 6.5 * sz, 4.6 * sz, 4.6 * sz, 0, 0, Math.PI * 2); ctx.fill();
    sEll(x + Math.cos(a) * 6.5 * sz, y + Math.sin(a) * 6.5 * sz, 4.6 * sz, 4.6 * sz, seed + i, 0.6, 1);
  }
  ctx.fillStyle = 'rgba(28,28,28,0.8)';
  ctx.beginPath(); ctx.arc(x, y, 3 * sz, 0, Math.PI * 2); ctx.fill();
}
function drawStar(x, y, sz, seed) {
  pen(1.2, 0.6);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI / 3 + seed;
    sLine(x - Math.cos(a) * sz, y - Math.sin(a) * sz, x + Math.cos(a) * sz, y + Math.sin(a) * sz, seed + i, 0.4, 1);
  }
}
function drawMoon(x, y, r, seed) {
  pen(1.6, 0.85);
  const pts = [];
  for (let i = 0; i <= 20; i++) { const a = -Math.PI * 0.75 + i / 20 * Math.PI * 1.5; pts.push([x + Math.cos(a + Math.PI) * r, y + Math.sin(a + Math.PI) * r]); }
  for (let i = 20; i >= 0; i--) { const a = -Math.PI * 0.75 + i / 20 * Math.PI * 1.5; pts.push([x - r * 0.35 + Math.cos(a + Math.PI) * r * 0.78, y + Math.sin(a + Math.PI) * r * 0.85]); }
  ctx.fillStyle = '#fff'; ctx.beginPath(); curve(pts); ctx.closePath(); ctx.fill();
  sPoly(pts, seed, 1, 2);
}

// ---------- воздушный шар (как на обложке) ----------
// (x, y) — верх корзины. sq — «надутость» оболочки 0..1
function balloonHalfW(u, r) {
  if (u <= 0.35) return r * Math.sqrt(Math.max(0, 1 - u * u));
  const t = (u - 0.35) / 0.9;
  return lerp(r * 0.937, r * 0.28, Math.pow(t, 0.85));
}
function drawBalloon(x, y, r, opts = {}) {
  const sq = opts.sq == null ? 1 : opts.sq, seed = opts.seed || 3, rx = r * (opts.wide || 1);
  ctx.save();
  ctx.translate(x, y); ctx.rotate(opts.tilt || 0);
  const neck = -0.42 * r, cy = neck - 1.25 * r * sq;
  const R = [], L = [];
  for (let i = 0; i <= 26; i++) {
    const u = -1 + 2.25 * i / 26;
    const hw = balloonHalfW(u, rx), yy = cy + u * r * sq;
    R.push([hw, yy]); L.push([-hw, yy]);
  }
  const outline = R.concat(L.slice().reverse());
  ctx.fillStyle = '#fff'; ctx.beginPath(); curve(outline); ctx.closePath(); ctx.fill();
  pen(1.9, 0.92); sPoly(outline, seed, 1.1, 2);
  pen(1.3, 0.75);
  [-0.62, -0.25, 0.25, 0.62].forEach((f, k) => sPoly(R.map(p => [p[0] * f, p[1]]), seed + 10 + k, 0.8, 1));
  // стропы
  pen(1.2, 0.8);
  sLine(-0.27 * r, neck, -0.36 * r, 0, seed + 20, 0.5, 1);
  sLine(0.27 * r, neck, 0.36 * r, 0, seed + 21, 0.5, 1);
  sLine(-0.09 * r, neck, -0.13 * r, 0, seed + 22, 0.5, 1);
  sLine(0.09 * r, neck, 0.13 * r, 0, seed + 23, 0.5, 1);
  // голова dreeme в корзине
  if (opts.head && SPR.head) {
    const hw = r * 1.15, hh = hw * SPR.head.height / SPR.head.width;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 0.2 * r - hh * 0.45, hw * 0.36, hh * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(SPR.head, -hw / 2, 0.25 * r - hh, hw, hh);
  }
  // корзина
  const bw = 0.4 * r, bh = 0.42 * r;
  const bas = [[-bw, 0], [bw, 0], [bw * 0.85, bh], [-bw * 0.85, bh], [-bw, 0]];
  ctx.fillStyle = '#fff'; ctx.beginPath(); bas.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.fill();
  pen(1.7, 0.9); sPoly(bas, seed + 30, 0.7, 2);
  pen(1, 0.6);
  for (let i = -2; i <= 2; i++) sLine(i * bw * 0.36, 2 * S, i * bw * 0.3, bh - 2 * S, seed + 40 + i, 0.4, 1);
  sLine(-bw * 0.95, bh * 0.25, bw * 0.95, bh * 0.25, seed + 50, 0.4, 1);
  ctx.restore();
}

// ---------- картинки → «чернила» на прозрачном фоне ----------
const IMG = {}, SPR = {};
function loadImg(k, src) {
  return new Promise(res => { const i = new Image(); i.onload = () => { IMG[k] = i; res(); }; i.onerror = () => res(); i.src = src; });
}
function ink(img, fx0, fy0, fx1, fy1, mask) {
  const sx = Math.round(img.width * fx0), sy = Math.round(img.height * fy0);
  const sw = Math.round(img.width * (fx1 - fx0)), sh = Math.round(img.height * (fy1 - fy0));
  const c = document.createElement('canvas'); c.width = sw; c.height = sh;
  const x = c.getContext('2d'); x.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  const d = x.getImageData(0, 0, sw, sh), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const l = 0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2];
    let a = clamp((245 - l) / 190, 0, 1);
    if (mask) { const px = (i / 4) % sw, py = Math.floor(i / 4 / sw); if (mask((sx + px) / img.width, (sy + py) / img.height)) a = 0; }
    p[i] = p[i + 1] = p[i + 2] = 28; p[i + 3] = a * 255;
  }
  x.putImageData(d, 0, 0);
  return c;
}
function cropURL(img, fx0, fy0, fx1, fy1) {
  const sw = Math.round(img.width * (fx1 - fx0)), sh = Math.round(img.height * (fy1 - fy0));
  const c = document.createElement('canvas'); c.width = sw; c.height = sh;
  c.getContext('2d').drawImage(img, img.width * fx0, img.height * fy0, sw, sh, 0, 0, sw, sh);
  return c.toDataURL('image/jpeg', 0.85);
}

// ---------- звук: трек через фильтр, который «открывается» ----------
const A = { ctx: null, raw: null, buf: null, src: null, filt: null, gain: null, want: false, f: 650, g: 0, startAt: null };
const rawPromise = fetch('assets/track.mp3').then(r => r.arrayBuffer()).then(b => (A.raw = b)).catch(() => null);
function audioInit() {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  A.ctx = new AC();
  A.filt = A.ctx.createBiquadFilter(); A.filt.type = 'lowpass'; A.filt.Q.value = 0.8; A.filt.frequency.value = A.f;
  A.gain = A.ctx.createGain(); A.gain.gain.value = 0;
  A.filt.connect(A.gain); A.gain.connect(A.ctx.destination);
  const b = A.ctx.createBuffer(1, 1, 22050), s = A.ctx.createBufferSource(); s.buffer = b; s.connect(A.ctx.destination); s.start(0);
  rawPromise.then(raw => {
    if (!raw) return;
    A.ctx.decodeAudioData(raw.slice(0), buf => { A.buf = buf; }, () => {});
  });
}
// Трек играет одним потоком. Меняется фильтр:
//   G.clean = false → глухо, «за стеной»;  G.clean = true → чисто (3 уровень)
// Перемотка одна: на старте 3 уровня — к началу припева (с плавным появлением звука).
function playFromStart(offset = 0) {
  if (!A.ctx || !A.buf) { A.restart = true; A.restartAt = offset; return; }
  if (A.src) { A.src.onended = null; try { A.src.stop(); } catch (e) {} A.src.disconnect(); }
  A.src = A.ctx.createBufferSource(); A.src.buffer = A.buf; A.src.loop = true;
  A.src.connect(A.filt); A.src.start(0, offset);
  A.src.onended = () => { A.ended = true; };
  A.startAt = A.ctx.currentTime - offset; A.restart = false; A.ended = false;
  A.g = 0;   // мягкое появление, без щелчка
}
// позиция в треке (сек), с учётом повторов по кругу
function trackPos() {
  if (!A.ctx || !A.buf || A.startAt == null) return null;
  return (A.ctx.currentTime - A.startAt) % A.buf.duration;
}
// финал: дать треку доиграть до конца и остановиться
function playToEnd() { if (A.src) A.src.loop = false; }
function resumeAudio() { if (A.ctx && A.ctx.state !== 'running') A.ctx.resume().catch(() => {}); }
function updateMusic(dt) {
  if (!A.ctx) return;
  if (A.want && A.buf && (!A.src || A.restart)) playFromStart(A.restart ? A.restartAt || 0 : 0);
  G.dip = Math.max(0, G.dip - dt * 1.1);
  const tf = G.clean ? 20000 : CFG.wallCutoff * (1 - 0.35 * G.dip);
  // плавно, в логарифмической шкале — переход «из-за стены» в чистый звук за ~1.5 с
  A.f = Math.exp(lerp(Math.log(A.f), Math.log(tf), Math.min(1, dt * 2.2)));
  A.filt.frequency.value = A.f;
  const tg_ = A.src ? 0.9 : 0;
  A.g += (tg_ - A.g) * Math.min(1, dt * 1.5);
  A.gain.gain.value = A.g;
}
document.addEventListener('visibilitychange', () => {
  if (!A.ctx) return;
  if (document.hidden) A.ctx.suspend(); else resumeAudio();
});
// телефон мог «усыпить» звук (свернули телеграм, открыли ссылку) — будим при любом касании
document.addEventListener('pointerdown', resumeAudio, true);

// ---------- состояние ----------
const G = { p: 0.02, dip: 0, notes: 0, flowers: 0, lyrics: [], clean: false };
function resetGame() { G.p = 0.04; G.dip = 0; G.notes = 0; G.flowers = 0; G.lyrics = []; G.clean = false; }

// ---------- ввод ----------
const pointers = new Set();
const holding = () => pointers.size > 0;
let paused = false;
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  pointers.add(e.pointerId);
  if (!paused && scene && scene.down) scene.down(e);
});
['pointerup', 'pointercancel'].forEach(t => window.addEventListener(t, e => pointers.delete(e.pointerId)));
window.addEventListener('blur', () => pointers.clear());
// отладка с клавиатуры: пробел = держать
window.addEventListener('keydown', e => { if (e.code === 'Space') { pointers.add('kb'); if (!paused && scene && scene.down && !e.repeat) scene.down(e); } });
window.addEventListener('keyup', e => { if (e.code === 'Space') pointers.delete('kb'); });

// ---------- диалог ----------
const dlg = $('dlg'), dlgText = $('dlgText');
function dialog(lines, done) {
  paused = true; pointers.clear();
  let i = 0, shown = 0, full = '', timer = null;
  dlg.classList.remove('hidden');
  function show() {
    full = lines[i]; shown = 0; dlgText.textContent = '';
    clearInterval(timer);
    timer = setInterval(() => {
      shown++; dlgText.textContent = full.slice(0, shown);
      if (shown >= full.length) clearInterval(timer);
    }, 32);
  }
  function tap(e) {
    e.preventDefault(); e.stopPropagation();
    if (shown < full.length) { shown = full.length; dlgText.textContent = full; clearInterval(timer); return; }
    i++;
    if (i < lines.length) { show(); haptic('light'); return; }
    dlg.removeEventListener('pointerdown', tap);
    dlg.classList.add('hidden');
    paused = false;
    done();
  }
  dlg.addEventListener('pointerdown', tap);
  show();
}

// ---------- сцены ----------
let scene = null;
function go(sc) { scene = sc; if (sc.enter) sc.enter(); }

const FLOW = [
  () => go(Title),
  () => dialog(CFG.intro, next),
  () => go(Inflate),
  () => dialog(CFG.howto, next),
  () => go(makeLevel(1)),
  () => dialog(CFG.mid1, next),
  () => go(makeLevel(2)),
  () => dialog(CFG.mid2, next),
  () => go(makeLevel(3)),
  () => go(Finale)
];
let step = -1;
function next() { step++; FLOW[step](); }

// — фон с облаками —
function makeSky(n) {
  const arr = [];
  for (let i = 0; i < n; i++) arr.push({ x: rnd(0, W * 1.4), y: rnd(TOP + 70 * S, H * 0.75), w: rnd(90, 160) * S, h: rnd(22, 34) * S, par: rnd(0.25, 0.5), seed: rnd(1, 999) });
  return arr;
}
function drawSky(sky, move) {
  sky.forEach(c => {
    if (move) { c.x -= move * c.par; if (c.x < -c.w) { c.x = W + c.w * rnd(0.5, 2); c.y = rnd(TOP + 70 * S, H * 0.75); } }
    drawCloud(c.x, c.y, c.w, c.h, c.seed, { alpha: 0.45 });
  });
}

// ===== титульный экран =====
const Title = {
  enter() { this.sky = makeSky(4); this.t = 0; },
  update(dt) { this.t += dt; },
  draw() {
    drawSky(this.sky, 12 * S * 0.016);
    const bob = Math.sin(this.t * 1.4) * 8 * S;
    drawBalloon(W / 2, H * 0.47 + bob, 66 * S, { seed: 7, tilt: Math.sin(this.t * 0.9) * 0.04 });
    drawBird(W / 2 + 95 * S, H * 0.3 + Math.sin(this.t * 2) * 5 * S, S * 0.8, this.t * 7, 3);
    drawBird(W / 2 + 125 * S, H * 0.33 + Math.sin(this.t * 2 + 1) * 5 * S, S * 0.65, this.t * 7 + 2, 4);
    txt(CFG.artist, W / 2, H * 0.66, 64, 'center', 0.92, 700);
    txt('— ' + CFG.track + ' —', W / 2, H * 0.66 + 46 * S, 34);
    txt('нажми, чтобы начать', W / 2, H * 0.84, 27, 'center', 0.4 + 0.4 * Math.abs(Math.sin(this.t * 2)));
    txt('🎧 лучше в наушниках', W / 2, H * 0.84 + 34 * S, 20, 'center', 0.5);
  },
  down() { audioInit(); A.want = true; haptic('medium'); next(); }
};

// ===== надуваем шар =====
const Inflate = {
  enter() { this.taps = 0; this.inf = 0; this.wob = 0; this.rise = 0; this.done = false; this.t = 0; this.need = 12; this.dust = Array.from({ length: 14 }, () => ({ x: rnd(0, W), y: rnd(H * 0.2, H * 0.9), s: rnd(1, 999) })); },
  update(dt) {
    this.t += dt; this.wob *= Math.pow(0.01, dt);
    this.inf += (Math.min(1, this.taps / this.need) - this.inf) * Math.min(1, dt * 8);
    if (this.done) { this.rise += dt; if (this.rise > 2.4 && !this.left) { this.left = true; next(); } }
    this.dust.forEach(d => { d.y -= 8 * S * dt; d.x += Math.sin(this.t + d.s) * 6 * S * dt; if (d.y < H * 0.15) d.y = H * 0.9; });
  },
  draw() {
    const gy = H * 0.64;
    pen(1.4, 0.7);
    sPoly([[0, gy + 4 * S], [W * 0.3, gy - 2 * S], [W * 0.6, gy + 3 * S], [W, gy - 1 * S]], 5, 1, 1);
    // пыль
    this.dust.forEach(d => { pen(1.2, 0.35); sEll(d.x, d.y, 1.4 * S, 1.4 * S, d.s, 0.3, 1); });
    // шар
    const bx = W * 0.66, r = 52 * S;
    const ry = this.done ? -Math.pow(this.rise, 2) * 70 * S : 0;
    const wob = Math.sin(this.t * 30) * this.wob;
    drawBalloon(bx, gy - 0.42 * r + ry, r, { sq: 0.18 + 0.82 * this.inf, wide: 1 + (1 - this.inf) * 0.25 + wob * 0.06, seed: 9, head: this.done, tilt: wob * 0.05 });
    // dreeme на переднем плане
    if (SPR.me && !this.done) {
      const h = Math.min(H * 0.42, W * 0.78), w = h;
      ctx.drawImage(SPR.me, -w * 0.12, H - h * 0.98, w, h);
    }
    if (!this.done) {
      txt('тапай, чтобы надуть шар', W / 2, TOP + 50 * S, 30);
      const n = this.need, dw = Math.min(16 * S, (W - 60 * S) / n);
      for (let i = 0; i < n; i++) {
        const x = W / 2 + (i - (n - 1) / 2) * dw;
        pen(1.3, 0.8); sEll(x, TOP + 86 * S, 4 * S, 4 * S, i + 1, 0.5, 1);
        if (i < this.taps) { ctx.fillStyle = 'rgba(28,28,28,.85)'; ctx.beginPath(); ctx.arc(x, TOP + 86 * S, 3 * S, 0, 7); ctx.fill(); }
      }
    } else txt('полетели!', W / 2, TOP + 50 * S, 34, 'center', clamp(1.6 - this.rise * 0.6, 0, 0.9));
  },
  down() {
    if (this.done) return;
    this.taps++; this.wob = 1; G.p = Math.min(0.14, G.p + 0.009);
    haptic('light');
    if (this.taps >= this.need) { this.done = true; haptic('success'); }
  }
};

// ===== уровни =====
function makeLevel(n) {
  const L = {
    n, t: 0, dur: CFG.levelTime, dist: 0,
    speed: [0, 150, 170, 215][n],
    by: H * 0.55, vy: 0, inv: 0, shake: 0,
    items: [], obs: [], fx: [], sky: [], stars: [],
    spawnT: 1.2, obsT: 3, windT: 9, wind: 0, windDir: 1, windLines: [],
    lyricW: [], prevAhead: [], lastLyricY: null, allCaught: false, active: true,
    girl: null, girlDone: false, finished: false, endT: 0
  };
  // уровень 3: трек продолжает играть как играл (уже чисто), строчка подлетает к шару в тот момент,
  // когда её поют в треке. Уровень длится, пока не собраны все строчки.
  const CH = CFG.chorus;
  const trackLen = () => (A.buf ? A.buf.duration : 98.5);
  const singTimes = i => [CH.starts[0] + CH.lines[Math.floor(i / 2)] + (i % 2 ? CH.half : 0)];
  // без звука (например, при отладке) — делаем вид, что припев начнётся через 4 с
  // уровень начинается за LEAD секунд до припева и заканчивается, когда припев отыграл
  const LEAD = Math.min(3, CH.starts[0]);
  if (n === 3) L.dur = LEAD + CH.lines[CH.lines.length - 1] + CH.half + 2.5;
  // без звука (например, при отладке) — считаем позицию по времени уровня
  const songPos = () => { const p = trackPos(); return p != null ? p : (L.t + CH.starts[0] - LEAD) % trackLen(); };
  const r = () => 30 * S;
  const bx = () => Math.max(W * 0.27, 95 * S);
  const groundY = x => H - 44 * S - 14 * S * Math.sin((x + L.dist) * 0.008 / S) - 7 * S * Math.sin((x + L.dist) * 0.021 / S + 1);
  const yMin = () => TOP + 60 * S;
  const yMax = () => (n === 1 ? H - 90 * S : H - 40 * S);

  L.enter = function () {
    L.sky = makeSky(n === 3 ? 2 : 4);
    if (n === 3) L.stars = Array.from({ length: 22 }, () => ({ x: rnd(0, W), y: rnd(TOP + 40 * S, H * 0.85), s: rnd(3, 6) * S, seed: rnd(0, 6) }));
    L.by = H * 0.55; L.vy = -40 * S;
    if (n === 3) {
      G.clean = true;                        // звук выходит «из-за стены»
      playFromStart(CH.starts[0] - LEAD);    // и припев играет с самого начала
      ctx.font = `600 ${23 * S}px Caveat, cursive`;
      L.lyricW = CFG.lyrics.map(text => ctx.measureText(text).width + 22 * S);
    }
  };
  // проверяем, не пора ли выпустить строчку: она должна долететь до шара ровно к моменту, когда её поют
  function scheduleLyrics() {
    const pos = songPos(), len = trackLen();
    CFG.lyrics.forEach((text, i) => {
      const w = L.lyricW[i], travel = (W + w / 2 + 10 * S - bx()) / (L.speed * S);
      const ahead = (pos + travel) % len, prev = L.prevAhead[i];
      L.prevAhead[i] = ahead;
      if (prev == null) return;
      const step = (ahead - prev + len) % len;
      if (step > 0.5) return;                // был перерыв (свернули игру) — не выпускаем «опоздавшие» строчки
      if (G.lyrics.includes(i) || L.items.some(it => it.kind === 'lyric' && it.idx === i)) return;
      const crossed = s => (prev <= ahead ? s > prev && s <= ahead : s > prev || s <= ahead);
      if (singTimes(i).some(s => crossed(s % len))) spawnLyric({ i, text, w });
    });
  }

  // предмет внутри/впритык к грозовой туче — собрать его без штрафа нельзя
  function inStorm(ix, iy, o) {
    return Math.abs(ix - o.x) < o.w * 0.75 + 34 * S && Math.abs(iy - o.y) < o.h * 1.5 + 34 * S;
  }
  const storms = () => L.obs.filter(o => o.type === 'storm');
  function spawnPattern() {
    const kind = n === 2 ? 'flower' : 'note';
    const cnt = 3 + Math.floor(Math.random() * 3);
    const yc = rnd(yMin() + 40 * S, yMax() - 40 * S), type = Math.random(), dir = Math.random() < 0.5 ? -1 : 1;
    for (let i = 0; i < cnt; i++) {
      let y = yc;
      if (type < 0.33) y = yc + Math.sin(i * 0.9) * 38 * S;
      else if (type < 0.66) y = yc + (i - cnt / 2) * 24 * S * dir;
      const it = { kind, x: W + 30 * S + i * 46 * S, y: clamp(y, yMin(), yMax()), rad: 15 * S, seed: rnd(1, 999), bob: rnd(0, 6) };
      if (!storms().some(o => inStorm(it.x, it.y, o))) L.items.push(it);
    }
  }
  function spawnObstacle() {
    const y = rnd(yMin() + 20 * S, yMax() - 20 * S);
    if (n === 1) {
      const flock = Math.random() < 0.4 ? 3 : 1;
      for (let i = 0; i < flock; i++) L.obs.push({ type: 'bird', x: W + 30 * S + i * 26 * S, y: y + (i % 2) * 18 * S - (i ? 9 * S : 0), vx: rnd(60, 110) * S, rad: 14 * S, ph: rnd(0, 6), seed: rnd(1, 99) });
    } else if (n === 2) {
      // ищем высоту, где туча не накроет цветы; если не нашли — пропускаем тучу
      const o = { type: 'storm', x: W + 70 * S, y, w: rnd(90, 120) * S, h: rnd(34, 44) * S, vx: 0, seed: rnd(1, 99) };
      for (let tries = 0; tries < 12; tries++) {
        if (!L.items.some(it => !it.got && inStorm(it.x, it.y, o))) { L.obs.push(o); return; }
        o.y = rnd(yMin() + 20 * S, yMax() - 20 * S);
      }
    } else {
      // пыль не ставим на пути строчек
      const lyr = L.items.filter(it => it.kind === 'lyric');
      let yy = y;
      for (let tries = 0; tries < 10 && lyr.some(it => Math.abs(it.y - yy) < 80 * S); tries++) yy = rnd(yMin() + 20 * S, yMax() - 20 * S);
      if (lyr.some(it => Math.abs(it.y - yy) < 80 * S)) return;
      L.obs.push({ type: 'dust', x: W + 40 * S, y0: yy, y: yy, vx: rnd(10, 30) * S, rad: 25 * S, ph: rnd(0, 6), seed: rnd(1, 99) });
    }
  }
  function spawnLyric(ev) {
    let y = L.lastLyricY == null ? rnd(yMin() + 90 * S, yMax() - 40 * S) : L.lastLyricY + rnd(-90, 90) * S;
    y = clamp(y, yMin() + 90 * S, yMax() - 40 * S);
    L.lastLyricY = y;
    L.items.push({ kind: 'lyric', idx: ev.i, text: ev.text, w: ev.w, x: W + ev.w / 2 + 10 * S, y, rad: 16 * S, seed: rnd(1, 999), bob: rnd(0, 6) });
  }
  function burst(x, y) {
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + rnd(0, 0.5); L.fx.push({ type: 'spark', x, y, a, life: 0.45 }); }
  }
  function float(text, x, y) { L.fx.push({ type: 'text', text, x, y, life: 0.9 }); }

  function bodyHits(cx, cy, rad) {
    const R = r(), ex = bx(), ey = L.by - 1.6 * R;
    const d1 = Math.hypot(cx - ex, cy - ey), d2 = Math.hypot(cx - ex, cy - (L.by + 0.2 * R));
    return d1 < rad + R * 0.92 || d2 < rad + R * 0.42;
  }

  L.update = function (dt) {
    L.t += dt;
    const mv = L.speed * S * dt;
    L.dist += mv;
    const R = r();

    // физика шара
    let acc = holding() ? -560 * S : 330 * S;
    if (L.wind > 0) { L.wind -= dt; acc += L.windDir * 420 * S; }
    L.vy += acc * dt; L.vy *= (1 - 1.3 * dt);
    L.vy = clamp(L.vy, -300 * S, 320 * S);
    L.by += L.vy * dt;
    const minY = TOP + 46 * S + 2.7 * R;
    const maxY = (n === 1 ? groundY(bx()) : H - 6 * S) - 0.45 * R;
    if (L.by < minY) { L.by = minY; L.vy = Math.max(0, L.vy); }
    if (L.by > maxY) { L.by = maxY; L.vy = -Math.abs(L.vy) * 0.35; }

    // 3 уровень — пока не собраны все строчки (страховка: если тайминг припева указан неверно, не больше 3 кругов трека)
    const active = L.t < L.dur;
    L.active = active;
    if (active) {
      L.spawnT -= dt; if (L.spawnT <= 0) { spawnPattern(); L.spawnT = n === 3 ? rnd(2.8, 3.4) : rnd(1.9, 2.5); }
      L.obsT -= dt; if (L.obsT <= 0) { spawnObstacle(); L.obsT = [0, 1.7, 1.6, 1.7][n] + rnd(-0.3, 0.4); }
      if (n === 2) {
        L.windT -= dt;
        if (L.windT <= 0) { L.wind = 1.8; L.windDir = Math.random() < 0.6 ? 1 : -1; L.windT = rnd(7, 10); L.windLines = Array.from({ length: 9 }, () => ({ x: rnd(W * 0.3, W * 1.4), y: rnd(yMin(), yMax()), l: rnd(40, 90) * S, s: rnd(1, 99) })); }
        if (!L.girl && L.t > 22) L.girl = { x: W + 110 * S, y: H * 0.7 };
      }
      if (n === 3) scheduleLyrics();
    } else if (n === 3 && !L.wallAgain) {
      // все строчки собраны: звук снова «за стеной», трек доигрывает до конца и останавливается
      L.wallAgain = true; G.clean = false; playToEnd();
    }

    // предметы
    L.items.forEach(it => {
      it.x -= mv;
      const iy = it.y + Math.sin(L.t * 3 + it.bob) * 4 * S;
      let hit;
      if (it.kind === 'lyric') {
        const ex = bx(), ey = L.by - 1.6 * R;
        const nx = clamp(ex, it.x - it.w / 2, it.x + it.w / 2), ny = clamp(ey, iy - it.rad, iy + it.rad);
        hit = Math.hypot(ex - nx, ey - ny) < R * 0.95 || bodyHits(clamp(ex, it.x - it.w / 2, it.x + it.w / 2), iy, it.rad);
      } else hit = bodyHits(it.x, iy, it.rad);
      if (hit && !it.got) {
        it.got = true; burst(it.x, iy); haptic('light');
        if (it.kind === 'note') { G.notes++; G.p = Math.min(0.97, G.p + 0.0055); }
        if (it.kind === 'flower') { G.flowers++; G.p = Math.min(0.97, G.p + 0.0055); }
        if (it.kind === 'lyric') {
          G.lyrics.push(it.idx); haptic('success'); float(it.text, it.x, iy - 26 * S);
        }
      }
    });
    L.items = L.items.filter(it => !it.got && it.x > -(it.w || 40 * S));

    // препятствия
    L.obs.forEach(o => {
      o.x -= mv + o.vx * dt;
      if (o.type === 'bird') o.ph += dt * 9;
      if (o.type === 'dust') { o.ph += dt * 2; o.y = o.y0 + Math.sin(o.ph) * 40 * S; }
      if (L.inv <= 0) {
        let hit;
        if (o.type === 'storm') hit = bodyHits(o.x, o.y, o.h * 0.8) || bodyHits(o.x - o.w * 0.28, o.y, o.h * 0.6) || bodyHits(o.x + o.w * 0.28, o.y, o.h * 0.6);
        else hit = bodyHits(o.x, o.y, o.rad);
        if (hit) {
          L.inv = 1.3; L.shake = 0.35; G.dip = 1; haptic('error');
          L.vy = (o.y > L.by - 1.6 * R ? -1 : 1) * 160 * S;
          const k = n === 2 ? 'flowers' : 'notes';
          const lost = Math.min(3, G[k]); G[k] -= lost;
          if (lost) float('-' + lost, bx() + 30 * S, L.by - 3 * R);
        }
      }
    });
    L.obs = L.obs.filter(o => o.x > -160 * S);
    L.inv = Math.max(0, L.inv - dt); L.shake = Math.max(0, L.shake - dt);

    L.windLines.forEach(w => { w.x -= (L.speed * 2.6) * S * dt; });
    if (L.girl) L.girl.x -= mv * 0.55;
    L.fx.forEach(f => { f.life -= dt; if (f.type === 'text') f.y -= 30 * S * dt; });
    L.fx = L.fx.filter(f => f.life > 0);

    if (!active) { L.endT += dt; if (L.endT > 2.6 && !L.finished) { L.finished = true; next(); } }
  };

  L.draw = function () {
    const R = r();
    ctx.save();
    if (L.shake > 0) ctx.translate(rnd(-5, 5) * S * L.shake * 3, rnd(-5, 5) * S * L.shake * 3);

    if (n === 3) {
      L.stars.forEach(s => { s.x -= L.speed * S * 0.016 * 0.08; if (s.x < -10) s.x = W + 10; drawStar(s.x, s.y, s.s, s.seed); });
      drawMoon(W * 0.8, TOP + 175 * S, 26 * S, 4);
    }
    drawSky(L.sky, paused ? 0 : L.speed * S * 0.016);

    // девочка на облаке (уровень 2)
    if (L.girl && SPR.girl) {
      const g = L.girl, gh = 150 * S, gw = gh * SPR.girl.width / SPR.girl.height;
      ctx.drawImage(SPR.girl, g.x - gw / 2, g.y - gh + 6 * S, gw, gh);
      drawCloud(g.x, g.y + 22 * S, 190 * S, 26 * S, 77, { alpha: 0.6 });
    }

    // земля и дом (уровень 1)
    if (n === 1) {
      const hx = W * 0.1 - L.dist;
      if (hx > -140 * S) {
        const gy = groundY(hx), hw = 90 * S, hh = 70 * S;
        ctx.fillStyle = '#fff'; ctx.fillRect(hx - hw / 2, gy - hh, hw, hh);
        pen(1.7, 0.85);
        sPoly([[hx - hw / 2, gy], [hx - hw / 2, gy - hh], [hx + hw / 2, gy - hh], [hx + hw / 2, gy]], 31, 0.9);
        sPoly([[hx - hw / 2 - 10 * S, gy - hh], [hx, gy - hh - 50 * S], [hx + hw / 2 + 10 * S, gy - hh]], 32, 0.9);
        pen(1.3, 0.7);
        sPoly([[hx - 30 * S, gy - 45 * S], [hx - 6 * S, gy - 45 * S], [hx - 6 * S, gy - 22 * S], [hx - 30 * S, gy - 22 * S], [hx - 30 * S, gy - 45 * S]], 33, 0.6, 1);
        sPoly([[hx + 12 * S, gy], [hx + 12 * S, gy - 40 * S], [hx + 32 * S, gy - 40 * S], [hx + 32 * S, gy]], 34, 0.6, 1);
        for (let i = 0; i < 6; i++) { pen(1, 0.35); sEll(hx - 20 * S + i * 9 * S, gy - 60 * S - (i % 3) * 10 * S, 1.4 * S, 1.4 * S, i, 0.4, 1); }
      }
      const pts = [];
      for (let x = -10; x <= W + 10; x += 14) pts.push([x, groundY(x)]);
      ctx.fillStyle = '#fff'; ctx.beginPath(); curve(pts); ctx.lineTo(W + 10, H); ctx.lineTo(-10, H); ctx.fill();
      pen(1.6, 0.8); sPoly(pts, 41, 0.8, 1);
      pen(1, 0.45);
      for (let i = 0; i < 9; i++) {
        const gx = ((i * 97 - L.dist * 1) % (W + 60) + W + 60) % (W + 60) - 30;
        const gy = groundY(gx);
        sLine(gx, gy + 2, gx - 3 * S, gy - 7 * S, i, 0.3, 1); sLine(gx + 3 * S, gy + 2, gx + 5 * S, gy - 6 * S, i + 20, 0.3, 1);
      }
    }

    // ветер (уровень 2)
    if (L.wind > 0) {
      pen(1.4, 0.55);
      L.windLines.forEach(w => {
        const yy = w.y + (L.windDir > 0 ? 1 : -1) * (W - w.x) * 0.08;
        sPoly([[w.x, w.y], [w.x + w.l * 0.5, yy - L.windDir * 4 * S], [w.x + w.l, yy]], w.s, 0.8, 1);
      });
      txt(L.windDir > 0 ? 'ветер тянет вниз!' : 'ветер тянет вверх!', W / 2, H - 70 * S, 26, 'center', 0.75);
    }

    // предметы
    L.items.forEach(it => {
      const iy = it.y + Math.sin(L.t * 3 + it.bob) * 4 * S;
      if (it.kind === 'note') drawNote(it.x, iy, S * 1.05, it.seed);
      else if (it.kind === 'flower') drawFlower(it.x, iy, S * 1.05, it.seed);
      else {
        const hw = it.w / 2, hh = 17 * S;
        ctx.fillStyle = '#fff'; ctx.fillRect(it.x - hw, iy - hh, it.w, hh * 2);
        pen(1.6, 0.85);
        sPoly([[it.x - hw, iy - hh], [it.x + hw, iy - hh + 2 * S], [it.x + hw - 3 * S, iy + hh], [it.x - hw + 2 * S, iy + hh - 1 * S], [it.x - hw, iy - hh]], it.seed, 0.9, 2);
        txt(it.text, it.x, iy + 1 * S, 23, 'center', 0.95, 600);
      }
    });

    // препятствия
    L.obs.forEach(o => {
      if (o.type === 'bird') drawBird(o.x, o.y, S * 1.1, o.ph, o.seed);
      else if (o.type === 'storm') drawStormCloud(o.x, o.y, o.w, o.h, o.seed);
      else drawDust(o.x, o.y, o.rad, o.seed);
    });

    // шар
    if (!(L.inv > 0 && Math.floor(L.inv * 10) % 2 === 0)) {
      drawBalloon(bx(), L.by, R, { seed: 9, head: true, tilt: clamp(L.vy / (300 * S), -1, 1) * 0.08 });
    }

    // эффекты
    L.fx.forEach(f => {
      if (f.type === 'spark') {
        const k = 1 - f.life / 0.45, d1 = (10 + 18 * k) * S, d2 = (16 + 26 * k) * S;
        pen(1.4, f.life * 2);
        sLine(f.x + Math.cos(f.a) * d1, f.y + Math.sin(f.a) * d1, f.x + Math.cos(f.a) * d2, f.y + Math.sin(f.a) * d2, f.a * 10, 0.3, 1);
      } else txt(f.text, f.x, f.y, 24, 'center', Math.min(1, f.life * 1.5), 700);
    });
    ctx.restore();

    drawHUD();

    // подсказка в начале уровня
    if (L.t < 3.5) {
      const a = L.t < 3 ? 0.9 : (3.5 - L.t) * 1.8;
      const hint = ['', 'держи палец — вверх, отпусти — вниз', 'берегись туч и ветра', 'лови строчки, пока их поют'][n];
      txt(hint, W / 2, H * 0.42, 27, 'center', a, 600);
    }
    if (!L.active) txt(n === 3 && G.lyrics.length === CFG.lyrics.length ? 'припев собран!' : 'отлично!', W / 2, H * 0.42, 40, 'center', Math.min(0.9, L.endT * 2), 700);
  };

  function drawHUD() {
    // прогресс уровня
    const y = TOP + 20 * S, x0 = 20 * S, x1 = W - 20 * S;
    pen(1.3, 0.55); sLine(x0, y, x1, y, 61, 0.6, 1);
    const k = clamp(L.t / L.dur, 0, 1), px = lerp(x0, x1, k);
    pen(2.2, 0.9); sLine(x0, y, px, y, 62, 0.5, 1);
    ctx.save(); ctx.translate(px, y + 4 * S); ctx.scale(0.28, 0.28); ctx.translate(-px, -(y + 4 * S));
    drawBalloon(px, y + 4 * S, 30 * S, { seed: 4 });
    ctx.restore();
    // счёт
    const cy = y + 26 * S;
    if (n === 2) { drawFlower(x0 + 10 * S, cy, S * 0.8, 5); txt(String(G.flowers), x0 + 26 * S, cy + 1 * S, 28, 'left', 0.9, 700); }
    else { drawNote(x0 + 10 * S, cy, S * 0.8, 5); txt(String(G.notes), x0 + 26 * S, cy + 1 * S, 28, 'left', 0.9, 700); }
    txt('ур. ' + n + '/3', x1, cy + 1 * S, 24, 'right', 0.6);
    // собранный припев
    if (n === 3) {
      for (let line = 0; line < CFG.lyrics.length / 2; line++) {
        const parts = [line * 2, line * 2 + 1].map(i => G.lyrics.includes(i) ? CFG.lyrics[i] : '· · ·');
        const got = [line * 2, line * 2 + 1].filter(i => G.lyrics.includes(i)).length;
        txt(parts.join(' '), W / 2, cy + (26 + line * 22) * S, 21, 'center', 0.35 + got * 0.3);
      }
    }
  }
  return L;
}

// ===== финал =====
const Finale = {
  enter() { this.t = 0; this.card = false; this.sky = makeSky(6); G.clean = false; playToEnd(); haptic('success'); },
  update(dt) {
    this.t += dt;
    if (this.t > 5.2 && !this.card) { this.card = true; showCard(); }
  },
  draw() {
    const t = this.t;
    if (!paused) this.sky.forEach(c => { c.y += 160 * S * 0.016 * (1 + Math.min(t, 4.5) * 0.4) * c.par * 2; if (c.y > H + 40 * S) { c.y = -30 * S; c.x = rnd(0, W); } });
    drawSky(this.sky, 0);
    const k = Math.max(0, t - 1.4) / 3;
    drawBalloon(W / 2, H * 0.62 - k * k * H * 0.95, 44 * S, { seed: 9, head: true, tilt: Math.sin(t * 2) * 0.04 });
    txt('полёт окончен. трек твой.', W / 2, H * 0.85, 30, 'center', clamp(1.6 - Math.abs(t - 2.2) * 0.8, 0, 0.9), 600);
  }
};

function showCard() {
  $('cArtist').textContent = CFG.artist;
  $('cTrack').textContent = CFG.track;
  const n = G.notes, f = G.flowers, l = G.lyrics.length;
  $('cStats').innerHTML = `ты собрал(а) ${n} ${plural(n, 'ноту', 'ноты', 'нот')}, ${f} ${plural(f, 'цветок', 'цветка', 'цветов')}<br>и ${l} из ${CFG.lyrics.length} строчек припева`;
  $('card').classList.remove('hidden');
  paused = true;
}
$('bListen').addEventListener('click', () => { haptic('medium'); openLink(CFG.listenUrl); });
// mp3 в личку: бот присылает трек тому, кто прошёл игру
// запасной путь: открыть чат с ботом командой /start mp3 — трек пришлёт сам бот (через webhook)
function claimViaBot(b) {
  b.textContent = 'открываю чат с ботом — трек придёт туда';
  const url = CFG.botUrl + '?start=mp3';
  try { if (tg && tg.openTelegramLink) return tg.openTelegramLink(url); } catch (e) {}
  window.open(url, '_blank');
}
$('bMp3').addEventListener('click', async () => {
  const b = $('bMp3');
  if (b.dataset.busy || b.dataset.done) return;
  if (!tg || !tg.initData || !CFG.claimUrl) { haptic('medium'); claimViaBot(b); return; }
  b.dataset.busy = 1; b.textContent = 'отправляю…'; haptic('medium');
  // боту нужно разрешение писать в личку (если человек ещё не запускал бота)
  const allowed = await new Promise(res => {
    try {
      if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.9')) tg.requestWriteAccess(ok => res(ok));
      else res(true);
    } catch (e) { res(true); }
  });
  if (!allowed) { b.textContent = 'разреши боту писать тебе и нажми ещё раз'; delete b.dataset.busy; return; }
  let r = null;
  try {
    // text/plain — «простой» запрос без предварительной проверки CORS, так надёжнее во встроенных браузерах
    r = await fetch(CFG.claimUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ initData: tg.initData }) });
  } catch (e) {
    delete b.dataset.busy; claimViaBot(b); return;   // сервер недоступен из этого браузера → через бота
  }
  try {
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || ('http ' + r.status));
    b.textContent = 'готово! трек уже в чате с ботом ✓'; b.dataset.done = 1; haptic('success');
  } catch (e) {
    delete b.dataset.busy; claimViaBot(b); return;
  }
  delete b.dataset.busy;
});
$('bShare').addEventListener('click', () => {
  haptic('medium');
  const text = `я поднял воздушный шар dreeme и забрал новый трек раньше всех. попробуй ты 🎈`;
  const url = 'https://t.me/share/url?url=' + encodeURIComponent(CFG.shareUrl) + '&text=' + encodeURIComponent(text);
  try { if (tg && tg.openTelegramLink) return tg.openTelegramLink(url); } catch (e) {}
  if (navigator.share) navigator.share({ text, url: CFG.shareUrl }).catch(() => {}); else window.open(url, '_blank');
});
$('bAgain').addEventListener('click', () => {
  haptic('medium');
  $('card').classList.add('hidden'); paused = false;
  resetGame(); resumeAudio(); playFromStart(); step = 1; next();   // новая игра — трек с начала
});

// ---------- главный цикл ----------
let last = performance.now(), T = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
  BOIL = Math.floor(T * 7);
  if (scene) {
    if (!paused && scene.update) scene.update(dt);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    scene.draw();
  }
  updateMusic(dt);
  requestAnimationFrame(frame);
}

// ---------- старт ----------
Promise.all([
  loadImg('me', 'assets/me.jpg'),
  loadImg('girl', 'assets/girl.jpg'),
  Promise.race([document.fonts ? document.fonts.load('500 20px Caveat') : Promise.resolve(), new Promise(r => setTimeout(r, 2500))])
]).then(() => {
  if (IMG.me) {
    SPR.me = ink(IMG.me, 0, 0, 1, 1);
    SPR.head = ink(IMG.me, 0.07, 0.03, 0.75, 0.6);
    $('dlgFace').src = cropURL(IMG.me, 0.1, 0.06, 0.72, 0.68);
  }
  if (IMG.girl) {
    // убираем облака по краям рисунка, оставляем только девочку
    SPR.girl = ink(IMG.girl, 0.24, 0.1, 0.78, 1, (x, y) => (x > 0.66 && y < 0.5) || (x < 0.3 && y > 0.36 && y < 0.5));
  }
  $('loading').classList.add('hidden');
  next();
  requestAnimationFrame(frame);
});
