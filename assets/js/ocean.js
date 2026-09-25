/* 海洋层：一条固定在视口上的透明画布，画所有活的东西。
   鱼是程序化生成的：一条脊柱 + 逐节跟随 + 沿脊柱传递的正弦波，
   没有贴图，没有第三方库。所有粒子都有硬上限，切后台就停手。 */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = document.querySelector('[data-sea]');
const ctx = canvas?.getContext('2d', { alpha: true }) || null;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

/* 对外暴露的小统计，声呐终端的 stats 命令用 */
export const seaStats = { bubbles: 0, pings: 0, leaps: 0 };

/* 初始化之前先给一组空实现，别的模块随便调，不会炸 */
export const sea = {
  burst: () => {},
  ping: () => {},
};

let W = 0;
let H = 0;
let dpr = 1;
let raf = 0;
let last = 0;
let running = false;

let scrollYNow = 0;
let depthF = 0;          // 0 水面 → 1 深渊
let docH = 1;

/* 场景里的所有居民 */
const bubbles = [];
const drops = [];
const snow = [];
const motes = [];
const rings = [];
let rays = [];
let twinkles = [];

let hero = null;
let heroBottom = 1;      // 水线在文档里的高度
let companion = null;
let leaper = null;

let nextLeap = 0;
let nextAmbient = 0;

/* 滚动速度抹平之后的"水流"（px/s），粒子、鱼、洋流都读它 */
let flow = 0;
let lastRawY = 0;

const pointer = { x: -1e4, y: -1e4, t: 0, moved: 0 };

const isNarrow = () => W < 720;

/* --------------------------------------------------------------------------
   水色：深度直接决定颜色
   -------------------------------------------------------------------------- */

/* 深度表（米）到水色的映射。这些数同时是页面上标称的深度，
   刻度盘显示多少米，那片水就是什么颜色，两边永远对得上 */
const WATER = [
  [0, [19, 48, 63]],       // #13303F  刚没入水面
  [200, [14, 37, 52]],     // #0E2534  阳光带底
  [1000, [11, 28, 42]],    // #0B1C2A  暮光带底
  [4000, [8, 21, 35]],     // #081523  午夜带底
  [10909, [2, 5, 10]],     // #02050A  海床
];

function waterColor(meters) {
  if (meters <= WATER[0][0]) return WATER[0][1];
  for (let i = 1; i < WATER.length; i++) {
    if (meters <= WATER[i][0]) {
      const [d0, c0] = WATER[i - 1];
      const [d1, c1] = WATER[i];
      /* 深度跨度从 200 到 4000，按对数插值颜色过渡才均匀 */
      const t = (Math.log(meters + 1) - Math.log(d0 + 1))
        / (Math.log(d1 + 1) - Math.log(d0 + 1));
      return [
        c0[0] + (c1[0] - c0[0]) * t,
        c0[1] + (c1[1] - c0[1]) * t,
        c0[2] + (c1[2] - c0[2]) * t,
      ];
    }
  }
  return WATER[WATER.length - 1][1];
}

/* 各区的标称深度取自页面上真正写着深度的那几个节点，
   页面加一节、改一次深度，水色跟着变 */
const depthAnchors = [];

function measureDepths() {
  depthAnchors.length = 0;
  for (const el of document.querySelectorAll('[data-depth]')) {
    depthAnchors.push({
      y: el.getBoundingClientRect().top + scrollY,
      d: parseFloat(el.dataset.depth) || 0,
    });
  }
  depthAnchors.sort((a, b) => a.y - b.y);
}

/* 文档纵坐标 → 水深。深度表（site.js）读的是同一个函数，
   所以指针指的米数和眼前的水色一定是同一套数 */
export function docDepthAt(y) {
  /* 画布没跑起来的时候（减弱动效）没人量过锚点，第一问补量一次 */
  if (!depthAnchors.length) measureDepths();
  if (!depthAnchors.length) return 0;
  if (y <= depthAnchors[0].y) return 0;
  for (let i = 1; i < depthAnchors.length; i++) {
    const b = depthAnchors[i];
    if (y < b.y) {
      const a = depthAnchors[i - 1];
      const k = clamp((y - a.y) / Math.max(1, b.y - a.y), 0, 1);
      return a.d + (b.d - a.d) * (k * k * (3 - 2 * k));  // 平滑一下
    }
  }
  return depthAnchors[depthAnchors.length - 1].d;
}

/* 整屏铺一层水。逐行取色，水色就永远跟当前位置的深度一致，
   区块之间也不会再出现拼接的接缝 */
const WATER_STOPS = 14;

function paintWater() {
  const top = scrollYNow;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  for (let i = 0; i <= WATER_STOPS; i++) {
    const k = i / WATER_STOPS;
    const [r, gg, b] = waterColor(docDepthAt(top + k * H));
    g.addColorStop(k, `rgb(${Math.round(r)} ${Math.round(gg)} ${Math.round(b)})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/* --------------------------------------------------------------------------
   鱼：脊柱式
   -------------------------------------------------------------------------- */

class Fish {
  constructor(len, maxW) {
    this.n = 11;
    this.seg = len / this.n;
    this.maxW = maxW;
    this.phase = Math.random() * Math.PI * 2;
    this.spine = [];
    let x = 0;
    for (let i = 0; i < this.n; i++) {
      this.spine.push({ x, y: 0 });
      x -= this.seg;
    }
  }

  place(x, y) {
    const dx = x - this.spine[0].x;
    const dy = y - this.spine[0].y;
    for (const p of this.spine) { p.x += dx; p.y += dy; }
  }

  /* 头部已经被人挪到新位置，脊柱逐节跟上，正弦波往尾部传。
     amp 随游速变：加速的时候尾巴甩得更狠 */
  follow(speed) {
    const amp = clamp(0.10 + speed * 0.00045, 0.1, 0.34);
    this.phase += 0.115 + speed * 0.00048;
    for (let i = 1; i < this.n; i++) {
      const prev = this.spine[i - 1];
      const cur = this.spine[i];
      const wave = Math.sin(this.phase - i * 0.72) * amp * (0.35 + (0.65 * i) / this.n);
      const a = Math.atan2(cur.y - prev.y, cur.x - prev.x) + wave;
      cur.x = prev.x + Math.cos(a) * this.seg;
      cur.y = prev.y + Math.sin(a) * this.seg;
    }
  }

  /* 体宽沿脊柱的分布：头窄一点，前 1/5 最肥，往尾收细 */
  widthAt(t) {
    const pts = [[0, 0.5], [0.2, 1], [0.55, 0.7], [1, 0.16]];
    for (let i = 1; i < pts.length; i++) {
      if (t <= pts[i][0]) {
        const [t0, w0] = pts[i - 1];
        const [t1, w1] = pts[i];
        return w0 + (w1 - w0) * ((t - t0) / (t1 - t0));
      }
    }
    return pts[pts.length - 1][1];
  }

  draw(c, palette) {
    const s = this.spine;
    const n = this.n;

    /* 每节的切线和法线 */
    const tang = [];
    for (let i = 0; i < n; i++) {
      const a = s[Math.max(0, i - 1)];
      const b = s[Math.min(n - 1, i + 1)];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      tang.push({ x: dx / len, y: dy / len });
    }

    const L = [];
    const R = [];
    for (let i = 0; i < n; i++) {
      const w = this.widthAt(i / (n - 1)) * this.maxW;
      const nx = -tang[i].y;
      const ny = tang[i].x;
      L.push({ x: s[i].x + nx * w, y: s[i].y + ny * w });
      R.push({ x: s[i].x - nx * w, y: s[i].y - ny * w });
    }

    /* 身体在深水里带一点荧光轮廓，越深越亮 */
    if (palette.glow > 0.02) {
      c.shadowColor = `rgba(84, 230, 210, ${(0.8 * palette.glow).toFixed(3)})`;
      c.shadowBlur = 22 * palette.glow;
    }

    /* 尾鳍：两条张开随相位扇动 */
    const tail = s[n - 1];
    const td = tang[n - 1];
    const flare = 0.5 + Math.sin(this.phase - n * 0.72) * 0.22;
    const flen = this.maxW * 2.1;
    const rot = (vx, vy, a) => ({ x: vx * Math.cos(a) - vy * Math.sin(a), y: vx * Math.sin(a) + vy * Math.cos(a) });
    const tipA = rot(td.x, td.y, flare);
    const tipB = rot(td.x, td.y, -flare);
    c.fillStyle = palette.fin;
    c.beginPath();
    c.moveTo(tail.x - td.x * this.seg, tail.y - td.y * this.seg);
    c.quadraticCurveTo(tail.x + tipA.x * flen * 0.6, tail.y + tipA.y * flen * 0.6,
      tail.x + tipA.x * flen, tail.y + tipA.y * flen);
    c.quadraticCurveTo(tail.x + td.x * flen * 0.42, tail.y + td.y * flen * 0.42,
      tail.x + tipB.x * flen, tail.y + tipB.y * flen);
    c.quadraticCurveTo(tail.x + tipB.x * flen * 0.6, tail.y + tipB.y * flen * 0.6,
      tail.x - td.x * this.seg, tail.y - td.y * this.seg);
    c.fill();

    /* 背鳍 */
    c.beginPath();
    c.moveTo(L[3].x, L[3].y);
    c.quadraticCurveTo(
      (L[3].x + L[6].x) / 2 - tang[4].y * this.maxW * 1.1,
      (L[3].y + L[6].y) / 2 + tang[4].x * this.maxW * 1.1,
      L[6].x, L[6].y);
    c.closePath();
    c.fill();

    /* 身体：沿左轮廓下去、右轮廓回来，中点二次曲线保证顺滑 */
    const grad = c.createLinearGradient(
      s[2].x + tang[2].y * this.maxW, s[2].y - tang[2].x * this.maxW,
      s[2].x - tang[2].y * this.maxW, s[2].y + tang[2].x * this.maxW);
    grad.addColorStop(0, palette.back);
    grad.addColorStop(0.62, palette.mid);
    grad.addColorStop(1, palette.belly);
    c.fillStyle = grad;
    c.beginPath();
    const nose = {
      x: s[0].x + tang[0].x * this.maxW * 1.15,
      y: s[0].y + tang[0].y * this.maxW * 1.15,
    };
    c.moveTo(nose.x, nose.y);
    for (let i = 0; i < n - 1; i++) {
      const mx = (L[i].x + L[i + 1].x) / 2;
      const my = (L[i].y + L[i + 1].y) / 2;
      c.quadraticCurveTo(L[i].x, L[i].y, mx, my);
    }
    c.lineTo(s[n - 1].x, s[n - 1].y);
    for (let i = n - 1; i > 0; i--) {
      const mx = (R[i].x + R[i - 1].x) / 2;
      const my = (R[i].y + R[i - 1].y) / 2;
      c.quadraticCurveTo(R[i].x, R[i].y, mx, my);
    }
    c.closePath();
    c.fill();

    c.shadowBlur = 0;

    /* 眼睛：钉在头部前上方（屏幕系），加一点高光 */
    const ex = s[0].x + tang[0].x * this.seg * 0.5;
    const ey = s[0].y + tang[0].y * this.seg * 0.5 - this.maxW * 0.26;
    c.fillStyle = palette.eye;
    c.beginPath();
    c.arc(ex, ey, Math.max(1.6, this.maxW * 0.16), 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.beginPath();
    c.arc(ex - this.maxW * 0.05, ey - this.maxW * 0.05, Math.max(0.6, this.maxW * 0.05), 0, Math.PI * 2);
    c.fill();

    /* 鳃线 */
    c.strokeStyle = palette.gill;
    c.lineWidth = Math.max(1, this.maxW * 0.09);
    c.beginPath();
    const gx = s[1].x + tang[1].x * this.seg * 0.1;
    const gy = s[1].y + tang[1].y * this.seg * 0.1;
    c.arc(gx, gy, this.maxW * 0.62, -1.1, 1.1);
    c.stroke();
  }
}

const PALETTE = {
  back: '#E85A38',
  mid: '#FF7A50',
  belly: '#FFC9A8',
  fin: 'rgba(224, 78, 47, 0.9)',
  eye: '#1B0E14',
  gill: 'rgba(27, 14, 20, 0.35)',
  glow: 0,
};

/* --------------------------------------------------------------------------
   伴游鱼：陪你从水线一路游到深渊
   -------------------------------------------------------------------------- */

function initCompanion() {
  companion = {
    fish: new Fish(isNarrow() ? 62 : 104, isNarrow() ? 8.5 : 13.5),
    /* 直接生在座位上：show 是 0 起步淡入的，不必再从屏外游进来。
       从屏外游进来要好几秒，快速下潜的人那几秒里什么都陪不了他 */
    x: W * 0.12,
    y: H * 0.45,
    vx: 40,
    vy: 0,
    homeX: W * 0.12,     // 这一趟想去的落点
    homeY: H * 0.45,
    tx: W * 0.12,        // 实际在追的目标（会被光标和滚动顶开）
    ty: H * 0.45,
    nextWander: 0,
    boost: 0,            // 滚动带来的加速，几秒内衰减掉
    show: 0,             // 0 隐藏 → 1 完全出现
  };
}

/* 鱼能待的地方。水线以上是天、不是水，所以上边界取"水线的屏幕位置"——
   这样它一入水就在你正看着的那片水里，而不是先在水线上面隐身淡入。
   左右压在左侧三分之一，不跟正文抢地盘；下边界留出底部那块小读数 */
function companionBand() {
  const waterline = heroBottom - scrollYNow;
  const y0 = Math.max(H * 0.17, waterline + 30);
  const y1 = H * 0.78;
  if (y0 >= y1) return null;       // 水线还在屏幕下方，没有水给鱼待
  return {
    x0: W * 0.05,
    x1: W * (isNarrow() ? 0.42 : 0.24),
    y0,
    y1,
  };
}

function stepCompanion(dt, now) {
  const m = companion;
  const band = companionBand();
  /* 有一片水就露头，没有就沉下去 */
  m.show = clamp(m.show + (band ? dt * 1.4 : -dt * 2), 0, 1);
  if (m.show <= 0.01 || !band) return;

  /* 隔几秒换一个落点 */
  if (now > m.nextWander) {
    m.nextWander = now + rand(2800, 5200);
    m.homeX = rand(band.x0, band.x1);
    m.homeY = rand(band.y0 + (band.y1 - band.y0) * 0.12, band.y1 - (band.y1 - band.y0) * 0.12);
  }

  /* 目标点自己往落点漂。滚动和光标都只是把它顶开一点，
     顶开的量每帧又被这条弹簧收回去——
     鱼永远在朝一个看得见的地方游，不会像被推着那样撞到边上贴住不动 */
  const ease = Math.min(1, dt * 1.6);
  m.tx += (m.homeX - m.tx) * ease;
  m.ty += (m.homeY - m.ty) * ease;

  /* 光标凑太近就往反方向让 */
  const d = Math.hypot(m.x - pointer.x, m.y - pointer.y);
  if (d < 170 && d > 1) {
    const k = (1 - d / 170) * 420;
    m.tx += ((m.x - pointer.x) / d) * k * dt;
    m.ty += ((m.y - pointer.y) / d) * k * dt;
  }

  m.tx = clamp(m.tx, band.x0, band.x1);
  m.ty = clamp(m.ty, band.y0, band.y1);

  /* 弹簧：略欠阻尼，游到位时轻轻荡一下，看着才像活的 */
  m.vx = clamp(m.vx + ((m.tx - m.x) * 3.4 - m.vx * 2.4) * dt, -520, 520);
  m.vy = clamp(m.vy + ((m.ty - m.y) * 3.4 - m.vy * 2.4) * dt, -520, 520);
  m.x += m.vx * dt;
  m.y += m.vy * dt;

  /* 兜底：万一被极端帧率算出屏，拉回来（正常情况下不会走到这） */
  m.x = clamp(m.x, 40, W * 0.6);
  m.y = clamp(m.y, band.y0 - 40, band.y1 + 40);

  /* 滚动越快，尾巴摆得越起劲——滑下去的时候它像在跟着你一起冲 */
  m.boost = Math.max(0, m.boost - dt * 900);
  m.fish.place(m.x, m.y);
  m.fish.follow(Math.hypot(m.vx, m.vy) + m.boost);

  const c = ctx;
  c.save();
  c.globalAlpha = m.show * (isNarrow() ? 0.86 : 0.96);
  PALETTE.glow = depthF;
  m.fish.draw(c, PALETTE);
  c.restore();
}

/* --------------------------------------------------------------------------
   跃出水面的鱼：首屏的招牌动作
   -------------------------------------------------------------------------- */

function scheduleLeap(now) {
  nextLeap = now + rand(4200, 9500);
}

function stepLeap(dt, now) {
  const waterline = heroBottom - scrollYNow;
  if (!leaper && now > nextLeap && waterline > 40 && waterline < H * 0.95) {
    const size = isNarrow() ? 0.62 : 1;
    leaper = {
      fish: new Fish(74 * size, 10 * size),
      t: 0,
      dur: rand(1.15, 1.5),
      x0: W * rand(0.5, 0.74),
      dir: Math.random() < 0.5 ? 1 : -1,
      apexH: H * rand(0.22, 0.32),
      splashed: false,
    };
  }
  if (!leaper) return;

  const L = leaper;
  L.t += dt / L.dur;
  const t = L.t;
  if (t >= 1) { leaper = null; scheduleLeap(now); return; }

  const x = L.x0 + L.dir * W * 0.09 * t;
  const y = waterline - Math.sin(Math.PI * t) * L.apexH;
  L.fish.place(x, y);
  L.fish.follow(260);

  if (t > 0.04 && !L.splashed) {
    L.splashed = true;
    splash(x, waterline, 1);
  }

  PALETTE.glow = 0;
  L.fish.draw(ctx, PALETTE);
}

function splash(x, y, k) {
  for (let i = 0; i < 12 * k && drops.length < 70; i++) {
    drops.push({
      x, y,
      vx: rand(-160, 160),
      vy: rand(-460, -140),
      r: rand(1.2, 3),
      life: rand(0.5, 0.9),
    });
  }
  burst(x, y, Math.round(8 * k), true);
  seaStats.leaps++;
}

/* --------------------------------------------------------------------------
   气泡 / 水珠 / 雪 / 浮游生物 / 光柱 / 声呐环
   -------------------------------------------------------------------------- */

function burst(x, y, count = 12, quiet = false) {
  for (let i = 0; i < count && bubbles.length < 150; i++) {
    bubbles.push({
      x: x + rand(-6, 6),
      y: y + rand(-6, 6),
      r: rand(1.4, quiet ? 3.4 : 4.6),
      vy: rand(-120, -40),
      ph: Math.random() * Math.PI * 2,
      a: 1,
    });
  }
  seaStats.bubbles += count;
}

function ping(x, y, big = false) {
  for (let i = 0; i < 3; i++) {
    rings.push({
      x, y,
      r: big ? 12 : 6,
      v: big ? 460 : 300,
      a: 0.85,
      delay: i * 0.16,
      max: big ? Math.min(W, H) * 0.42 : 110,
    });
  }
  seaStats.pings++;
}

function stepParticles(dt, now) {
  /* 气泡：上浮 + 左右摆，到水面就散 */
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.vy -= 26 * dt;
    b.y += b.vy * dt;
    b.ph += dt * 5;
    b.x += Math.sin(b.ph) * 22 * dt;
    b.a -= dt * 0.35;
    if (b.y < -12 || b.a <= 0) { bubbles.splice(i, 1); continue; }
    ctx.strokeStyle = `rgba(214, 238, 242, ${(0.5 * b.a).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  /* 水珠：受重力，掉回水里就没了 */
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.vy += 1500 * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.life -= dt;
    if (d.life <= 0 || d.y > heroBottom - scrollYNow + 6) { drops.splice(i, 1); continue; }
    ctx.fillStyle = 'rgba(255, 201, 168, 0.75)';
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }

  /* 声呐环 */
  ctx.globalCompositeOperation = 'lighter';
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    if (r.delay > 0) { r.delay -= dt; continue; }
    r.r += r.v * dt;
    r.a -= dt * 0.9;
    if (r.a <= 0 || r.r > r.max) { rings.splice(i, 1); continue; }
    ctx.strokeStyle = `rgba(84, 230, 210, ${(r.a * 0.7).toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';

  /* 深处的雪：只在 depthF 过半之后出现，越深越密 */
  const wantSnow = depthF > 0.45 ? Math.round(70 * ((depthF - 0.45) / 0.55)) : 0;
  while (snow.length < wantSnow) {
    snow.push({ x: Math.random() * W, y: Math.random() * H, r: rand(0.6, 1.7), vy: rand(7, 20), vx: rand(-4, 4), a: rand(0.15, 0.5) });
  }
  if (snow.length > wantSnow) snow.length = wantSnow;
  /* 水流留下的余劲：手停下之后水还会往上走一会儿，才像在往下沉 */
  const current = flow * 0.02;
  ctx.fillStyle = 'rgba(196, 224, 232, 1)';
  for (const p of snow) {
    p.y += (p.vy - current) * dt;
    p.x += p.vx * dt;
    if (p.y > H + 4) { p.y = -4; p.x = Math.random() * W; }
    ctx.globalAlpha = p.a * (0.5 + 0.5 * depthF);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* 浮游生物：深渊里光标划过会点亮一串，平时自己微微地闪 */
  const abyss = depthF > 0.68;
  if (abyss && pointer.moved && now - pointer.moved < 70 && motes.length < 130) {
    for (let i = 0; i < 2; i++) {
      motes.push({
        x: pointer.x + rand(-8, 8), y: pointer.y + rand(-8, 8),
        vx: rand(-14, 14), vy: rand(-20, 4),
        r: rand(0.8, 2.4), life: rand(1, 2.2), t: 0,
        gold: Math.random() < 0.25,
      });
    }
  }
  ctx.globalCompositeOperation = 'lighter';
  for (let i = motes.length - 1; i >= 0; i--) {
    const m = motes[i];
    m.t += dt;
    if (m.t > m.life) { motes.splice(i, 1); continue; }
    m.x += m.vx * dt;
    m.y += (m.vy - current) * dt;
    const k = Math.sin((m.t / m.life) * Math.PI);
    ctx.fillStyle = m.gold ? `rgba(255, 196, 107, ${(k * 0.8).toFixed(3)})`
      : `rgba(84, 230, 210, ${(k * 0.85).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    ctx.fill();
  }
  /* 深渊里原本就在的微光：一片慢慢闪的浮游点 */
  if (abyss) {
    ctx.globalCompositeOperation = 'lighter';
    for (const t of twinkles) {
      ctx.fillStyle = `rgba(120, 220, 205, ${(0.12 + 0.16 * (0.5 + 0.5 * Math.sin(now * 0.001 * t.sp + t.ph))).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.globalCompositeOperation = 'source-over';

  /* 光柱：只在浅水，天色从头顶斜下来 */
  if (rays.length && depthF < 0.42) {
    const fade = 1 - depthF / 0.42;
    ctx.globalCompositeOperation = 'lighter';
    for (const ray of rays) {
      const sway = Math.sin(now * 0.001 * ray.speed + ray.phase) * 46;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgba(255, 208, 138, ${(0.085 * fade * ray.a).toFixed(3)})`);
      g.addColorStop(0.75, 'rgba(255, 208, 138, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(ray.x - ray.w / 2 + sway * 0.2, -20);
      ctx.lineTo(ray.x + ray.w / 2 + sway * 0.2, -20);
      ctx.lineTo(ray.x + ray.w * 1.4 + sway, H);
      ctx.lineTo(ray.x - ray.w * 1.4 + sway, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

/* --------------------------------------------------------------------------
   主循环
   -------------------------------------------------------------------------- */

function frame(now) {
  raf = running ? requestAnimationFrame(frame) : 0;
  const dt = last ? clamp((now - last) / 1000, 0, 0.05) : 0.016;
  last = now;

  docH = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  scrollYNow = window.scrollY;

  /* 水流跟着滚动速度走，松手后慢慢停下 */
  flow *= 0.9 ** (dt * 60);
  if (Math.abs(flow) < 4) flow = 0;
  depthF = clamp(scrollYNow / docH, 0, 1);

  paintWater();
  stepParticles(dt, now);
  stepLeap(dt, now);
  stepCompanion(dt, now);
  stepStream(dt);

  /* 环境气泡：隔一阵从底下冒一串 */
  if (now > nextAmbient) {
    nextAmbient = now + rand(2400, 5200);
    const x = Math.random() * W;
    for (let i = 0; i < (isNarrow() ? 3 : 5); i++) {
      bubbles.push({ x: x + rand(-30, 30), y: H + 10 + i * 24, r: rand(1.4, 3.4), vy: rand(-70, -36), ph: Math.random() * 6, a: 0.8 });
    }
  }
}

/* --------------------------------------------------------------------------
   洋流：常速漂移，滚动时加速，反向滚就倒着走
   -------------------------------------------------------------------------- */

let streamEl = null;
let streamHalf = 1;
let streamPos = 0;
let streamExtra = 0;
let streamPaused = false;
let streamSeen = false;

function initStream() {
  streamEl = document.querySelector('.stream');
  if (!streamEl || REDUCED) return;

  /* 关掉 CSS 那条匀速动画，改由这里逐帧推。
     写在最前面：万一下面出错，至少不会两套动画同时推同一个元素 */
  streamEl.style.animation = 'none';

  /* 两组内容完全一样，走完一组的宽度就等于回到原点 */
  const measure = () => { streamHalf = streamEl.scrollWidth / 2 || 1; };
  measure();
  document.fonts?.ready.then(measure).catch(() => {});
  addEventListener('resize', measure);

  if (matchMedia('(hover: hover)').matches) {
    streamEl.addEventListener('pointerenter', () => { streamPaused = true; });
    streamEl.addEventListener('pointerleave', () => { streamPaused = false; });
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { streamSeen = e.isIntersecting; }, { threshold: 0 })
      .observe(streamEl);
  } else {
    streamSeen = true;
  }
}

function stepStream(dt) {
  if (!streamEl || streamPaused || !streamSeen) return;
  /* 位移走 translate 属性，跟 CSS 里那点旋转缩放互不干扰 */
  streamPos = (streamPos + (46 + streamExtra) * dt) % streamHalf;
  if (streamPos < 0) streamPos += streamHalf;
  streamEl.style.translate = `${-streamPos.toFixed(1)}px 0`;
  streamExtra *= 0.9 ** (dt * 60);
  if (Math.abs(streamExtra) < 0.5) streamExtra = 0;
}

function start() {
  if (running || REDUCED) return;
  running = true;
  last = 0;
  raf = requestAnimationFrame(frame);
}

function stop() {
  running = false;
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
}

/* --------------------------------------------------------------------------
   装配
   -------------------------------------------------------------------------- */

export function initOcean() {
  if (!ctx || REDUCED) return;

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth;
    H = innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    rays = [0.14, 0.36, 0.6, 0.84].map((f, i) => ({
      x: W * f,
      w: W * rand(0.04, 0.075),
      a: 0.7 + i * 0.1,
      speed: rand(0.16, 0.34),
      phase: Math.random() * 6,
    }));

    twinkles = Array.from({ length: 22 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: rand(0.5, 1.4), ph: Math.random() * 6, sp: rand(0.6, 1.6),
    }));

    if (companion) {
      companion.fish = new Fish(isNarrow() ? 62 : 104, isNarrow() ? 8.5 : 13.5);
      companion.x = W * 0.12;
      companion.homeX = W * 0.12;
      companion.tx = W * 0.12;
    }
  };

  resize();
  hero = document.getElementById('hero');
  const measureHero = () => {
    if (!hero) return;
    heroBottom = hero.offsetTop + hero.offsetHeight;
  };
  measureHero();

  measureDepths();
  addEventListener('resize', () => { resize(); measureHero(); measureDepths(); });
  if ('ResizeObserver' in window) new ResizeObserver(measureHero).observe(hero);
  document.fonts?.ready.then(measureHero).catch(() => {});

  /* 页面长高变矮（字体到位、手机地址栏收起）水色的锚点都得跟着重算 */
  if ('ResizeObserver' in window) new ResizeObserver(measureDepths).observe(document.body);

  addEventListener('pointermove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.moved = performance.now();
  }, { passive: true });

  /* 点哪儿哪儿冒泡；深水里顺手点亮一圈浮游生物 */
  addEventListener('pointerdown', (e) => {
    burst(e.clientX, e.clientY, isNarrow() ? 7 : 11);
    if (depthF > 0.68) ping(e.clientX, e.clientY, false);
  }, { passive: true });

  /* 滚动就是水流。三件事一起做：
     抹平出滚动速度给粒子和鱼用；把粒子往反方向推一点做出视差；
     洋流带跟着加速。增量在这里自己记账，夹住单次增量——
     惯性滚动一次会连发好几个事件，用帧里那份旧的 scrollY 算增量会被成倍放大 */
  lastRawY = window.scrollY;
  addEventListener('scroll', () => {
    const dy = window.scrollY - lastRawY;
    lastRawY = window.scrollY;
    if (!dy) return;

    flow = clamp(flow + dy * 14, -5200, 5200);

    /* 视差：你往下潜，周围的水相对你往上走，粒子就飘起来了 */
    const shift = clamp(dy, -200, 200) * 0.35;
    for (const p of bubbles) p.y -= shift;
    for (const p of snow) p.y -= shift * 0.8;
    for (const p of motes) p.y -= shift * 0.8;

    streamExtra = clamp(streamExtra + dy * 2.0, -1500, 1500);
    if (companion && companion.show > 0.05) {
      companion.boost = clamp(companion.boost + Math.abs(dy) * 2.2, 0, 900);
      /* 鱼的目标点被水体顶开一点点，随后自己游回去 */
      companion.ty -= clamp(dy, -160, 160) * 0.5;
    }
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  initStream();
  scheduleLeap(performance.now());
  nextAmbient = performance.now() + 1200;
  initCompanion();
  start();

  /* 起循环之后再把真实现挂到对外门面上 */
  sea.burst = burst;
  sea.ping = ping;
}
