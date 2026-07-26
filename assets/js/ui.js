/* 交互层：配色、逐字、进场、导航、拖拽贴纸、点击迸色片
   全部原生实现，无第三方依赖 */

const root = document.documentElement;

/* 系统的「减弱动效」开关可以随时改，所以要持续跟踪而不是只读一次 */
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
export const env = { get reduced() { return motionQuery.matches; } };

/* 隐私模式下 localStorage 会抛异常，不能让它掀翻整个脚本 */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* 记不住就算了 */ } },
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const hoverable = () => matchMedia('(hover: hover)').matches;

/* 各处把自己的实时状态写进来，透视模式只负责读和显示，
   不去反推任何东西——显示的必须就是页面此刻真的在用的数 */
export const probe = {
  marqueeSpeed: 0,
  lift: 0,
  parallaxY: 0,
  chars: 0,
};

/* 纯属好玩的计数，终端 stats 用 */
export const stats = {
  t0: performance.now(),
  scrolled: 0,
  bits: 0,
  hits: 0,
  visits: 1,
};

/* --- 配色 ------------------------------------------------------------------ */

const THEME_KEY = 'ljx.theme';
const watchers = [];

export function setTheme(name, { persist = true } = {}) {
  root.dataset.theme = name;
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', name === 'dusk' ? '#1C1814' : '#F2E3CF');
  const btn = document.querySelector('[data-theme-toggle]');
  if (btn) {
    btn.setAttribute('aria-pressed', name === 'dusk' ? 'true' : 'false');
    btn.setAttribute('aria-label', name === 'dusk' ? '切换到浅色配色' : '切换到深色配色');
  }
  if (persist) store.set(THEME_KEY, name);
  for (const fn of watchers) fn(name);
}

export function initTheme(onChange) {
  if (onChange) watchers.push(onChange);
  /* 首屏绘制前 head 里的内联脚本已经定过一次，这里只做补齐 */
  setTheme(root.dataset.theme === 'dusk' ? 'dusk' : 'cream', { persist: false });

  document.querySelector('[data-theme-toggle]')?.addEventListener('click', (e) => {
    setTheme(root.dataset.theme === 'dusk' ? 'cream' : 'dusk');
    burstFrom(e);
  });
}

/* --- 首屏那行小字：走的是广东的真实时间 ------------------------------------ */

/* 中国全境不做夏令时，直接把时间戳推 8 小时再读 UTC 就是本地时间，
   比依赖 Intl 的时区数据库稳，老浏览器也不会掉链子 */
const BANDS = [
  [5, 'late', '还醒着，多半在写东西'],
  [9, 'no', '刚睡下没多久'],
  [12, 'yes', '醒了，但没完全醒'],
  [14, 'yes', '大概在吃饭'],
  [19, 'yes', '在写代码'],
  [24, 'yes', '一天里最清醒的时候'],
];

const pad2 = (n) => String(n).padStart(2, '0');
const hhmm = (h, m) => `${pad2(h)}:${pad2(m)}`;

export function clockNow() {
  const now = Date.now();
  const mine = new Date(now + 8 * 3600e3);
  const h = mine.getUTCHours();
  const band = BANDS.find(([until]) => h < until) || BANDS[BANDS.length - 1];

  /* 访客那边几点，全在他自己的浏览器里算，什么都不往外发 */
  const theirs = new Date(now);
  const gap = Math.round((-theirs.getTimezoneOffset() / 60 - 8) * 10) / 10;

  return {
    hhmm: hhmm(h, mine.getUTCMinutes()),
    year: mine.getUTCFullYear(),
    awake: band[1],
    mood: band[2],
    theirHhmm: hhmm(theirs.getHours(), theirs.getMinutes()),
    theirHour: theirs.getHours(),
    gap,
  };
}

/* 有话可说就说访客那边的事，没有就说我这边的 */
export function visitorNote(n) {
  /* 凌晨还在逛的人，先冲他来一句，这句比时差有意思得多 */
  if (n.theirHour < 5) return n.gap ? `你那儿 ${n.theirHhmm}，你也没睡` : '你也没睡';
  if (!n.gap) return null;
  return `你那儿 ${n.theirHhmm}，差 ${Math.abs(n.gap)} 个钟头`;
}

export function initClock() {
  /* 页脚年份跟着走。跨年那天全世界不是同时翻页，用我这边的年份才说得通 */
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = String(clockNow().year);

  const el = document.querySelector('[data-clock]');
  const time = el?.querySelector('[data-clock-time]');
  const mood = el?.querySelector('[data-clock-mood]');
  if (!el || !time || !mood) return;

  let timer = 0;

  function tick() {
    const now = clockNow();
    time.textContent = now.hhmm;
    mood.textContent = visitorNote(now) || now.mood;
    el.dataset.awake = now.awake;
    /* 对齐到下一个整分再跳，省得每秒空转一次 */
    clearTimeout(timer);
    timer = setTimeout(tick, 60000 - (Date.now() % 60000) + 200);
  }

  tick();
  /* 标签页在后台时定时器会被压到最低频，回到前台先补一次 */
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
}

/* --- 点击迸出的小色片 ------------------------------------------------------ */

const CONFETTI = ['--red', '--green', '--yellow', '--blue', '--ink'];
const MAX_BITS = 90;
let live = 0;

export function burst(x, y, count = 12) {
  if (env.reduced) return;
  /* 连点不该堆出上百个节点 */
  count = Math.min(count, MAX_BITS - live);
  if (count <= 0) return;

  const styles = getComputedStyle(root);
  const colors = CONFETTI.map((v) => styles.getPropertyValue(v).trim());
  const frag = document.createDocumentFragment();
  const bits = [];

  for (let i = 0; i < count; i++) {
    const bit = document.createElement('i');
    bit.className = 'confetti';
    bit.style.left = `${x}px`;
    bit.style.top = `${y}px`;
    bit.style.background = colors[i % colors.length];
    frag.appendChild(bit);
    bits.push(bit);
  }
  document.body.appendChild(frag);
  live += count;
  stats.bits += count;

  bits.forEach((bit, i) => {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const dist = 40 + Math.random() * 90;
    const spin = (Math.random() - 0.5) * 720;
    bit.animate([
      { transform: 'translate(-50%, -50%) rotate(0deg) scale(1)', opacity: 1 },
      {
        transform: `translate(${Math.cos(angle) * dist - 50}%, ${Math.sin(angle) * dist + 60}%) rotate(${spin}deg) scale(0.4)`,
        opacity: 0,
      },
    ], {
      duration: 700 + Math.random() * 450,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'forwards',
    }).onfinish = () => { bit.remove(); live--; };
  });
}

/* 键盘触发的事件没有坐标，会让色片从屏幕左上角飞出来 */
function burstFrom(e, count = 12) {
  let { clientX: x, clientY: y } = e;
  if (!x && !y) {
    const box = (e.currentTarget || e.target)?.getBoundingClientRect?.();
    if (!box) return;
    x = box.left + box.width / 2;
    y = box.top + box.height / 2;
  }
  burst(x, y, count);
}

/* --- 逐字 ------------------------------------------------------------------ */

export function splitAll() {
  document.querySelectorAll('[data-split]').forEach((el, block) => {
    const text = el.textContent.trim();
    el.textContent = '';
    /* 整行已有 aria-label，逐字的 span 要对读屏隐藏，否则人名会被一个字一个字念 */
    [...text].forEach((c, i) => {
      const span = document.createElement('span');
      span.className = 'ch';
      span.setAttribute('aria-hidden', 'true');
      span.style.setProperty('--d', `${block * 220 + i * 62}ms`);
      /* 只有拉丁字母走我们自己那份带字重轴的子集，中文交给系统字体，调不动 */
      if (/[A-Za-z0-9]/.test(c)) span.dataset.latin = '';
      span.textContent = c === ' ' ? ' ' : c;
      el.appendChild(span);
    });
  });

  probe.chars = document.querySelectorAll('.ch').length;

  document.addEventListener('pointerdown', (e) => {
    const ch = e.target.closest?.('.ch');
    if (!ch) return;
    ch.classList.remove('is-hit');
    void ch.offsetWidth;
    ch.classList.add('is-hit');
    stats.hits++;
    burst(e.clientX, e.clientY, 7);
  });
}

export function playHero() {
  const show = () => document.querySelectorAll('[data-split] .ch').forEach((c) => c.classList.add('is-in'));
  /* 后台标签页里 rAF 会被挂起，加一道定时兜底，标题绝不能一直隐形 */
  requestAnimationFrame(show);
  setTimeout(show, 400);
}

/* --- 光标扫过标题时，附近的字依次让路 -------------------------------------- */

export function initWave() {
  const title = document.querySelector('.hero__title');
  /* 触屏没有"经过"这个动作，指针一按下就已经是点击了 */
  if (!title || env.reduced || !hoverable()) return;

  const chars = [...title.querySelectorAll('.ch')].filter((c) => c.textContent.trim());
  if (!chars.length) return;

  const RANGE = 130;
  const LIFT = 16;
  let raf = 0;
  let mx = 0;
  let my = 0;
  let on = false;

  title.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    mx = e.clientX;
    my = e.clientY;
    on = true;
    if (!raf) raf = requestAnimationFrame(apply);
  });

  title.addEventListener('pointerleave', () => {
    on = false;
    if (!raf) raf = requestAnimationFrame(apply);
  });

  function apply() {
    raf = 0;
    let peak = 0;
    for (const ch of chars) {
      if (!on) {
        ch.style.setProperty('--lift', '0px');
        ch.style.setProperty('--wght', '700');
        continue;
      }
      const b = ch.getBoundingClientRect();
      const dx = (b.left + b.width / 2 - mx) / RANGE;
      /* 竖直方向的影响范围压窄，另一行的字才不会被隔行带起来 */
      const dy = (b.top + b.height / 2 - my) / (RANGE * 0.6);
      const d = Math.hypot(dx, dy);
      const k = d >= 1 ? 0 : (1 - d * d) ** 2;
      ch.style.setProperty('--lift', `${(-LIFT * k).toFixed(2)}px`);
      /* 字重轴 700→960，只有 [data-latin] 的 CSS 会去读它 */
      ch.style.setProperty('--wght', String(Math.round(700 + 260 * k)));
      if (k > peak) peak = k;
    }
    probe.lift = Math.round(LIFT * peak);
  }
}

/* --- 进场 ------------------------------------------------------------------ */

export function initReveal() {
  const items = [...document.querySelectorAll('.rise')];

  /* 老浏览器没有 IntersectionObserver，直接全部显示，绝不留白 */
  if (!('IntersectionObserver' in window)) {
    for (const el of items) el.classList.add('is-in');
    return;
  }

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    }
  }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });

  items.forEach((el, i) => {
    el.style.setProperty('--delay', `${(i % 4) * 90}ms`);
    io.observe(el);
  });

  /* 兜底：视口内的元素若因故没被点亮，四秒后强制显示 */
  setTimeout(() => {
    for (const el of items) {
      if (el.classList.contains('is-in')) continue;
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) el.classList.add('is-in');
    }
  }, 4000);
}

/* --- 跑马灯：常速漂移 + 跟着滚动加速，反向滚就倒着跑 ----------------------- */

export function initMarquee() {
  const box = document.querySelector('.marquee');
  const track = box?.querySelector('.marquee__track');
  if (!box || !track) return;

  /* 关掉 CSS 那条匀速动画，从这里开始由脚本逐帧推。
     写在最前面：万一下面出错，至少不会出现两套动画同时推同一个元素 */
  track.style.animation = 'none';
  if (env.reduced) return;
  track.style.willChange = 'transform';

  const BASE = 46;    // px/s，什么都不做时的漂移速度
  const KICK = 2.2;   // 每滚动一像素折算成的附加速度
  const DECAY = 0.9;  // 附加速度每帧衰减（按 60fps 归一）
  const MAX = 1800;

  let half = 1;
  let pos = 0;
  let extra = 0;
  let lastScroll = scrollY;
  let lastTime = 0;
  let raf = 0;
  let visible = true;
  let paused = false;

  /* 两组内容完全相同，走完一组的宽度就等于回到原点 */
  const measure = () => { half = track.scrollWidth / 2 || 1; };
  measure();
  document.fonts?.ready.then(measure).catch(() => {});
  addEventListener('resize', measure);

  function kick() {
    if (raf || !visible || paused) return;
    lastTime = 0;
    raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    /* 切回前台时 now 会跳很大一截，夹住 dt 否则跑马灯会瞬移 */
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
    lastTime = now;

    probe.marqueeSpeed = Math.round(BASE + extra);
    pos = (pos + (BASE + extra) * dt) % half;
    if (pos < 0) pos += half;
    track.style.transform = `translateX(${-pos}px)`;

    extra *= DECAY ** (dt * 60);
    if (Math.abs(extra) < 0.5) extra = 0;

    raf = visible && !paused ? requestAnimationFrame(frame) : 0;
  }

  addEventListener('scroll', () => {
    extra = clamp(extra + (scrollY - lastScroll) * KICK, -MAX, MAX);
    lastScroll = scrollY;
    kick();
  }, { passive: true });

  /* 滚出视口就停手，没必要一直占着合成器 */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) kick();
      else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }, { threshold: 0 }).observe(box);
  }

  if (hoverable()) {
    box.addEventListener('pointerenter', () => { paused = true; });
    box.addEventListener('pointerleave', () => { paused = false; kick(); });
  }

  kick();
}

/* --- 首屏拱形随滚动做视差 -------------------------------------------------- */

export function initParallax() {
  const mark = document.querySelector('[data-parallax]');
  if (!mark || env.reduced) return;

  let raf = 0;
  const apply = () => {
    raf = 0;
    /* 只在首屏这一屏内响应，滚过去之后它早已被裁掉，再算就是白费 */
    const y = Math.min(scrollY, innerHeight);
    probe.parallaxY = Math.round(y * 0.18);
    mark.style.setProperty('--py', `${(y * 0.18).toFixed(1)}px`);
    mark.style.setProperty('--pr', `${(y * 0.012).toFixed(2)}deg`);
  };

  addEventListener('scroll', () => {
    if (!raf) raf = requestAnimationFrame(apply);
  }, { passive: true });

  apply();
}

/* --- 纸雁群：排成人字飞过首屏，光标凑近会被冲散 --------------------------- */

export function initGeese() {
  const flock = document.querySelector('[data-geese]');
  const hero = document.querySelector('.hero');
  const seed = flock?.querySelector('.goose');
  if (!flock || !hero || !seed || env.reduced) return;

  const AVOID = 165;        // 光标多近开始炸群
  const geese = [];
  let raf = 0;
  let timer = 0;
  let lastTime = 0;
  let flying = false;
  let visible = true;

  let dir = 1;              // 1 往右飞，-1 往左
  let span = 0;
  let elapsed = 0;
  let dur = 0;
  let baseY = 0;
  let amp = 0;
  let waves = 0;
  let gapX = 0;
  let gapY = 0;
  let tail = 0;
  let maxBack = 0;
  let size = 42;
  let prevX = NaN;
  let prevY = NaN;
  let mx = -1e4;
  let my = -1e4;

  /* 屏幕越宽，雁越多，连续算不分档。上限压在 21，再多就成一片噪点了 */
  function flockSize() {
    return Math.round(clamp(innerWidth / 112, 5, 21));
  }

  /* 纵向张开用次线性——越靠后张得越慢。
     不然雁一多，人字会竖着把整个首屏撑满，看着就不像雁群了 */
  const spreadOf = (step) => step ** 0.82;

  /* 人字形，而且每条臂上并排几只，队伍是有厚度的：
     领头一只在尖上，往后每一档在左右两臂各放 rows 只，
     同一档里的后几只依次再往后错半格、往外挪一点，
     于是臂不是一条线，是一条带 */
  function layout(n) {
    const rows = n >= 15 ? 3 : n >= 9 ? 2 : 1;
    const slots = [{ back: 0, cross: 0 }];
    let step = 1;
    while (slots.length < n) {
      for (let row = 0; row < rows && slots.length < n; row++) {
        for (const side of [-1, 1]) {
          if (slots.length >= n) break;
          slots.push({
            back: step + row * 0.6,
            cross: side * (spreadOf(step) + row * 0.7),
          });
        }
      }
      step++;
    }
    return slots;
  }

  function build(n) {
    while (geese.length < n) {
      const el = geese.length === 0 ? seed : seed.cloneNode(true);
      if (geese.length) flock.appendChild(el);
      geese.push({ el, dx: 0, dy: 0 });
    }
    const slots = layout(n);
    maxBack = 0;

    geese.forEach((g, i) => {
      const on = i < n;
      g.el.style.display = on ? '' : 'none';
      if (!on) return;
      g.back = slots[i].back;
      g.cross = slots[i].cross;
      if (g.back > maxBack) maxBack = g.back;
      /* 领头的略大，往后依次收一点，队形就有了纵深 */
      g.scale = 1 - Math.min(g.back, 6) * 0.055;
      g.el.style.setProperty('--w', `${(size * g.scale).toFixed(1)}px`);
      /* 扇翅膀的相位顺着队列往后推迟，看着像一道波从头传到尾 */
      g.el.style.setProperty('--phase', `${(-0.06 * i).toFixed(2)}s`);
      g.el.style.setProperty('--flap', `${(0.58 + g.back * 0.012).toFixed(2)}s`);
      /* 真雁的队形是毛的，给每只一点固定的偏移和自己的浮沉节奏 */
      g.jx = (Math.random() - 0.5) * size * 0.55;
      g.jy = (Math.random() - 0.5) * size * 0.4;
      g.bob = Math.random() * Math.PI * 2;
      g.dx = 0;
      g.dy = 0;
    });
  }

  addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });

  function schedule(min = 6000, extra = 9000) {
    clearTimeout(timer);
    timer = setTimeout(start, min + Math.random() * extra);
  }

  function start() {
    if (!visible) return schedule(4000, 4000);
    const r = hero.getBoundingClientRect();

    size = clamp(r.width * 0.026, 24, 42);
    gapX = size * 1.5;
    gapY = size * 0.75;
    build(flockSize());
    /* 整队要完整飞进来又完整飞出去，行程得把队尾那一截也算上 */
    tail = gapX * maxBack + size * 2;

    dir = Math.random() < 0.5 ? 1 : -1;
    span = r.width + 240 + tail;
    /* 压在上半屏，免得整群从大标题脸上碾过去 */
    baseY = r.height * (0.12 + Math.random() * 0.26);
    amp = 18 + Math.random() * 30;
    waves = 1.4 + Math.random() * 1.2;
    dur = span / (105 + Math.random() * 65);
    elapsed = 0;
    prevX = prevY = NaN;
    flying = true;
    flock.classList.add('is-flying');
    if (!raf) { lastTime = 0; raf = requestAnimationFrame(frame); }
  }

  function stop() {
    flying = false;
    flock.classList.remove('is-flying');
    schedule();
  }

  function frame(now) {
    raf = 0;
    if (!flying) return;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
    lastTime = now;
    elapsed += dt;

    const p = elapsed / dur;
    if (p >= 1) { stop(); return; }

    const r = hero.getBoundingClientRect();
    const travel = -140 - tail + p * span;
    const leadX = dir === 1 ? travel : r.width - travel;
    const leadY = baseY + Math.sin(p * Math.PI * waves) * amp;

    /* 朝向取领头那只的真实速度方向，全队共用，队形才是整的。
       往左飞时整只镜像，角度得跟着换算 */
    let deg = 0;
    if (Number.isFinite(prevX)) {
      const h = (Math.atan2(leadY - prevY, leadX - prevX) * 180) / Math.PI;
      deg = dir === 1 ? h : 180 - h;
    }
    prevX = leadX;
    prevY = leadY;

    for (const g of geese) {
      if (g.el.style.display === 'none') continue;
      const w = size * g.scale;
      /* 人字：沿飞行方向往后退，同时朝两侧张开。
         再叠上各自的固定偏移和慢速浮沉，队形才不是死板的几何图形 */
      const sx = leadX - dir * g.back * gapX + g.jx;
      const sy = leadY + g.cross * gapY + g.jy
        + Math.sin(elapsed * 2.1 + g.bob) * size * 0.1;

      /* 光标靠近就被冲散，走远了各自归队 */
      const cx = sx + g.dx + w / 2;
      const cy = sy + g.dy + w * 0.34 + r.top;
      const d = Math.hypot(cx - mx, cy - my);
      let tx = 0;
      let ty = 0;
      if (d < AVOID) {
        const k = (AVOID - d) / AVOID;
        const len = d || 1;
        tx = ((cx - mx) / len) * k * 120;
        ty = ((cy - my) / len) * k * 120;
      }
      g.dx += (tx - g.dx) * 0.12;
      g.dy += (ty - g.dy) * 0.12;

      g.el.style.transform =
        `translate(${(sx + g.dx).toFixed(1)}px, ${(sy + g.dy).toFixed(1)}px) `
        + `scaleX(${dir}) rotate(${deg.toFixed(1)}deg)`;
    }

    raf = requestAnimationFrame(frame);
  }

  /* 戳中哪只，哪只惊起一小片纸屑并窜开 */
  addEventListener('pointerdown', (e) => {
    if (!flying) return;
    for (const g of geese) {
      if (g.el.style.display === 'none') continue;
      const b = g.el.getBoundingClientRect();
      const cx = b.left + b.width / 2;
      const cy = b.top + b.height / 2;
      if (Math.hypot(e.clientX - cx, e.clientY - cy) > 30) continue;
      g.dx += (cx - e.clientX) * 2.2;
      g.dy += (cy - e.clientY) * 2.2 - 40;
      burst(cx, cy, 7);
      return;
    }
  });

  /* 首屏滚出去就别飞了 */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible && flying) { flying = false; flock.classList.remove('is-flying'); }
    }, { threshold: 0 }).observe(hero);
  }

  schedule(2400, 2600);
}

/* --- 导航：下滚收起，上滚露出 ---------------------------------------------- */

export function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  let last = scrollY;
  let ticking = false;

  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY;
      nav.classList.toggle('is-stuck', y > 40);
      nav.classList.toggle('is-hidden', y > last && y > 260);
      last = y;
      ticking = false;
    });
  }, { passive: true });
}

/* --- 贴纸：可拖、可甩、会撞墙。位置只活在这一次访问里，刷新即复位 -------- */

/* 终端里的 reset 要能把贴纸叫回来，但状态都锁在 initStickers 的闭包里，
   只好由它自己往外挂一个把手 */
let seatApi = null;

export function resetStickers() {
  if (!seatApi) return false;
  seatApi.reset();
  return true;
}

export function initStickers() {
  const stickers = [...document.querySelectorAll('[data-sticker]')];
  if (!stickers.length) return;

  const state = new Map();

  for (const el of stickers) {
    const s = { x: 0, y: 0, vx: 0, vy: 0 };
    state.set(el, s);
    paint(el);

    let id = null;
    let ox = 0;
    let oy = 0;
    let startX = 0;
    let startY = 0;
    let moved = false;
    let bounds = null;
    let lastT = 0;

    el.addEventListener('pointerdown', (e) => {
      id = e.pointerId;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      const s = state.get(el);
      /* 抓住一张正在飞的贴纸就该立刻停住，不能边拖边飘 */
      flying.delete(el);
      s.vx = 0;
      s.vy = 0;
      lastT = 0;
      ox = e.clientX - s.x;
      oy = e.clientY - s.y;
      bounds = limitsFor(el);
      try { el.setPointerCapture(id); } catch { /* 指针已消失时忽略 */ }
      el.classList.add('is-dragging');
    });

    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const s = state.get(el);
      /* 夹在首屏范围内：容器是 overflow:hidden，拖出去等于弄丢 */
      const nx = clamp(e.clientX - ox, bounds.minX, bounds.maxX);
      const ny = clamp(e.clientY - oy, bounds.minY, bounds.maxY);

      const t = e.timeStamp || performance.now();
      if (lastT) {
        /* 指数平滑：只取最后一帧的话，松手前手抖一下就能决定整个甩出方向 */
        const dt = Math.max(t - lastT, 1);
        s.vx = s.vx * 0.65 + ((nx - s.x) / dt) * 350;
        s.vy = s.vy * 0.65 + ((ny - s.y) / dt) * 350;
      }
      lastT = t;

      s.x = nx;
      s.y = ny;
      /* 判定用本次手势的位移，否则贴纸被拖走一次后就再也点不响 */
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 5) moved = true;
      paint(el);
    });

    const release = (e) => {
      if (id === null || (e && e.pointerId !== id)) return;
      el.classList.remove('is-dragging');
      id = null;
      if (moved) {
        const s = state.get(el);
        /* 甩得够快就让它飞出去撞墙，慢慢挪到位的就地停住 */
        if (!env.reduced && Math.hypot(s.vx, s.vy) > 240) launch(el, bounds);
        else { s.vx = 0; s.vy = 0; }
        return;
      }
      el.classList.remove('is-hit');
      void el.offsetWidth;
      el.classList.add('is-hit');
      const box = el.getBoundingClientRect();
      burst(box.left + box.width / 2, box.top + box.height / 2, 9);
    };

    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
  }

  seatApi = {
    moved: () => stickers.some((el) => { const s = state.get(el); return s.x || s.y; }),
    reset() {
      for (const el of stickers) {
        const s = state.get(el);
        s.x = 0;
        s.y = 0;
        /* 加一段过渡让它们飞回去，直接改 transform 会是瞬移 */
        el.classList.add('is-homing');
        paint(el);
        setTimeout(() => el.classList.remove('is-homing'), 700);
      }
    },
  };

  /* 只写位移，角度整个交给 CSS 的 --rot。
     脚本不再碰 rotate，点击时的 wobble 关键帧才好接管；
     滚动也就不会再把贴纸带歪 */
  function paint(el) {
    const s = state.get(el);
    el.style.transform = `translate(${s.x}px, ${s.y}px)`;
  }

  /* 算出贴纸还能往各方向挪多少。
     全部走布局尺寸(offsetLeft/offsetWidth)，不碰 getBoundingClientRect——
     贴纸是转着角度的，外接矩形会随滚动倾斜不停胀缩，拿它当边界会让
     停在边上的贴纸每帧被夹到不同的值，看上去就是在两个位置抽搐。
     布局尺寸不受 transform 和 rotate 影响，是稳定的。 */
  function limitsFor(el) {
    const host = el.offsetParent;
    /* 窄屏下多出来的那几张是 display:none，没有 offsetParent，别拿它算 */
    if (!host) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };

    const pad = 6;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const restLeft = el.offsetLeft;
    const restTop = el.offsetTop;

    /* 导航是 fixed 的，贴纸钻到它底下就会被按钮挡住、再也点不着。
       但光按布局盒子留白不够：贴纸是斜着的，转过角之后视觉上会比布局盒子
       高出一截，滚动带得越歪探得越多。按最歪的角度把这一截算进来。 */
    const rot = (Math.abs(parseFloat(getComputedStyle(el).getPropertyValue('--rot'))) || 0)
      * Math.PI / 180;
    const overhang = Math.max(0, (w * Math.sin(rot) + h * Math.cos(rot) - h) / 2);
    const nav = document.querySelector('.nav');
    const topInset = Math.max(pad, (nav ? nav.offsetHeight : 0) + 8 + overhang);

    const lim = {
      minX: pad - restLeft,
      maxX: host.clientWidth - pad - w - restLeft,
      minY: topInset - restTop,
      maxY: host.clientHeight - pad - h - restTop,
    };
    /* 容器小到放不下时两头会交叉，交叉了就退化成一个点，
       否则下面的碰壁判断会同时命中两边，来回弹个没完 */
    if (lim.minX > lim.maxX) lim.minX = lim.maxX = (lim.minX + lim.maxX) / 2;
    if (lim.minY > lim.maxY) lim.minY = lim.maxY = (lim.minY + lim.maxY) / 2;
    return lim;
  }

  /* --- 甩出去的惯性，以及手机倾斜时的重力 --- */

  const flying = new Map();
  let physRaf = 0;
  let physLast = 0;
  let gx = 0;
  let gy = 0;

  function launch(el, b) {
    flying.set(el, b || limitsFor(el));
    startPhysics();
  }

  function startPhysics() {
    if (physRaf) return;
    physLast = 0;
    physRaf = requestAnimationFrame(physics);
  }

  function physics(now) {
    const dt = physLast ? Math.min((now - physLast) / 1000, 0.05) : 0;
    physLast = now;
    const drag = 0.94 ** (dt * 60);
    let alive = false;

    for (const el of stickers) {
      const s = state.get(el);
      let b = flying.get(el);
      if (!b) {
        /* 没在飞、又没有重力的贴纸不用管 */
        if (!gx && !gy) continue;
        b = limitsFor(el);
        flying.set(el, b);
      }

      s.vx = (s.vx + gx * dt) * drag;
      s.vy = (s.vy + gy * dt) * drag;
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      /* 撞到首屏边界就弹回来，能量留一半。
         两头必须 else if：万一同时命中，位置会每帧在两端之间来回跳 */
      if (s.x <= b.minX) { s.x = b.minX; s.vx = Math.abs(s.vx) * 0.5; }
      else if (s.x >= b.maxX) { s.x = b.maxX; s.vx = -Math.abs(s.vx) * 0.5; }
      if (s.y <= b.minY) { s.y = b.minY; s.vy = Math.abs(s.vy) * 0.5; }
      else if (s.y >= b.maxY) { s.y = b.maxY; s.vy = -Math.abs(s.vy) * 0.5; }
      paint(el);

      if (!gx && !gy && Math.hypot(s.vx, s.vy) < 18) {
        s.vx = 0;
        s.vy = 0;
        flying.delete(el);
      } else {
        alive = true;
      }
    }

    physRaf = alive ? requestAnimationFrame(physics) : 0;
  }

  /* 手机倾斜，贴纸顺着滑下去。
     iOS 要显式调 requestPermission 才会推事件——这里不弹那个权限框，
     一个个人主页没必要为了小彩蛋吓人一跳。给得到就动，给不到就当没有。 */
  if (!hoverable() && !env.reduced) {
    let base = null;
    addEventListener('deviceorientation', (e) => {
      if (e.beta == null && e.gamma == null) return;
      /* 首屏都滚过去了就别再算，省电 */
      if (scrollY > innerHeight) { gx = 0; gy = 0; return; }
      /* 第一次读到的姿势当作水平，否则「正常握持」本身就是一直在倾斜 */
      if (!base) { base = { b: e.beta || 0, g: e.gamma || 0 }; return; }
      gx = clamp(((e.gamma || 0) - base.g) / 35, -1, 1) * 1200;
      gy = clamp(((e.beta || 0) - base.b) / 35, -1, 1) * 1200;
      if (gx || gy) startPhysics();
    });
  }

}

/* --- 折角 / 划线：两处翻书式的小彩蛋 --------------------------------------- */

export function initFolds() {
  /* 桌面靠 :hover 掀开，这里管的是触屏和键盘 */
  for (const fold of document.querySelectorAll('[data-fold]')) {
    const toggle = () => {
      if (!fold.classList.toggle('is-open')) return;
      const r = fold.getBoundingClientRect();
      burst(r.right - 16, r.bottom - 16, 5);
    };
    fold.addEventListener('click', toggle);
    fold.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      toggle();
    });
  }
}

/* 点「关于」里加粗的那些词，像有人拿笔在书上划了一道 */
export function initMarks() {
  const text = document.querySelector('.about__text');
  if (!text) return;

  text.addEventListener('click', (e) => {
    const b = e.target.closest('b');
    if (!b || !text.contains(b)) return;
    b.classList.toggle('is-marked');
    if (!b.classList.contains('is-marked')) return;
    const r = b.getBoundingClientRect();
    burst(r.left + r.width / 2, r.bottom, 5);
  });
}

/* 夹着「做过的东西」那张纸的回形针，取下来就掉了 */
export function initClip() {
  const clip = document.querySelector('[data-clip]');
  if (!clip) return;

  const drop = () => {
    if (clip.classList.contains('is-off')) return;
    clip.classList.add('is-off');
    const r = clip.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, 8);
  };

  clip.addEventListener('click', drop);
  clip.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    drop();
  });
}

/* --- 书脊：一根随滚动画出来的线，四节各打一个结 ----------------------------- */

export function initThread() {
  const thread = document.querySelector('[data-thread]');
  const main = document.querySelector('main');
  const first = document.querySelector('#beliefs');
  const last = document.querySelector('#say');
  if (!thread || !main || !first || !last) return;

  const svg = thread.querySelector('svg');
  const ink = thread.querySelector('.thread__ink');
  const paths = [...thread.querySelectorAll('.thread__track, .thread__ink')];
  const knots = [...thread.querySelectorAll('.thread__knot')];
  if (!svg || !ink || paths.length < 2) return;

  const W = 40;                 // 和 .thread 一样宽，于是 viewBox 里一格就是一像素
  const wide = matchMedia('(min-width: 1340px)');
  const seats = new Map();      // 结 → 它落在这根线上的高度
  let height = 0;
  let raf = 0;

  /* 线的形状就这一个式子。画线和摆结共用它，结才永远落在线上 */
  const xAt = (t) => W / 2
    + Math.sin(t * Math.PI * 4.4) * 7.5
    + Math.sin(t * Math.PI * 11.7) * 2.2;

  function build() {
    if (!wide.matches) return;

    const base = main.getBoundingClientRect().top + scrollY;
    const top = first.getBoundingClientRect().top + scrollY - base;
    const h = Math.round(last.getBoundingClientRect().bottom + scrollY - base - top);
    if (h < 200) return;

    thread.style.top = `${Math.round(top)}px`;

    if (h !== height) {
      height = h;
      svg.setAttribute('viewBox', `0 0 ${W} ${height}`);
      svg.setAttribute('height', String(height));

      /* 采样密到看不出折线就够了，再密只是把 d 撑长 */
      const step = clamp(height / 260, 5, 14);
      let d = `M${xAt(0).toFixed(2)} 0`;
      for (let y = step; y < height; y += step) {
        d += `L${xAt(y / height).toFixed(2)} ${y.toFixed(1)}`;
      }
      d += `L${xAt(1).toFixed(2)} ${height}`;
      for (const p of paths) p.setAttribute('d', d);
    }

    seats.clear();
    for (const knot of knots) {
      const head = document.querySelector(knot.dataset.to)
        ?.querySelector('.head__title, .contact__title');
      if (!head) { knot.style.display = 'none'; continue; }
      const r = head.getBoundingClientRect();
      const y = clamp(r.top + r.height / 2 + scrollY - base - top, 0, height);
      seats.set(knot, y);
      knot.style.display = '';
      knot.style.top = `${y.toFixed(1)}px`;
      knot.style.left = `${xAt(y / height).toFixed(2)}px`;
    }

    tick();
  }

  function tick() {
    raf = 0;
    if (!height || !wide.matches) return;
    /* 视口六成高的地方当笔尖，线一路跟到那儿 */
    const p = env.reduced ? 1
      : clamp((innerHeight * 0.6 - thread.getBoundingClientRect().top) / height, 0, 1);
    ink.style.strokeDashoffset = (1 - p).toFixed(4);
    const drawn = p * height;
    for (const [knot, y] of seats) knot.classList.toggle('is-lit', y <= drawn + 2);
  }

  for (const knot of knots) {
    knot.addEventListener('click', () => {
      document.querySelector(knot.dataset.to)?.scrollIntoView({ block: 'start' });
    });
  }

  build();
  /* 字体到位、窗口变化、内容自己长高，任何一样都要重新量 */
  document.fonts?.ready.then(build).catch(() => {});
  addEventListener('resize', build);
  wide.addEventListener('change', build);
  if ('ResizeObserver' in window) new ResizeObserver(build).observe(main);

  if (!env.reduced) {
    addEventListener('scroll', () => {
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
  }
}

/* --- 卡片按下的手感 -------------------------------------------------------- */

export function initPress() {
  for (const el of document.querySelectorAll('.work')) {
    const on = () => el.classList.add('is-pressed');
    const off = () => el.classList.remove('is-pressed');
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointerleave', off);
    el.addEventListener('pointercancel', off);
  }
}

/* --- 复制 ------------------------------------------------------------------ */

/* 剪贴板 API 在非安全上下文和部分内置浏览器里不可用，退回旧接口 */
async function copyText(text) {
  try {
    if (navigator.clipboard && isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* 落到下面的兜底 */ }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/* --- 无用但好玩的计数 ------------------------------------------------------ */

export function initStats() {
  const KEY = 'ljx.visits';
  const seen = parseInt(store.get(KEY) || '0', 10);
  stats.visits = (Number.isFinite(seen) && seen > 0 ? seen : 0) + 1;
  store.set(KEY, String(stats.visits));

  let last = scrollY;
  addEventListener('scroll', () => {
    stats.scrolled += Math.abs(scrollY - last);
    last = scrollY;
  }, { passive: true });
}

/* --- 透视模式：让页面自己讲自己是怎么做出来的 ------------------------------ */

/* <n>…</n> 里的部分会被染成高亮色，标的都是此刻真实的运行值 */
const XRAY_TEXT = {
  nav: () => '下滚收起，上滚露出',
  clock: () => '真实时间 · 每分钟自己走一格',
  title: () => `逐字拆成 <n>${probe.chars}</n> 个 span · 光标附近抬起 <n>${probe.lift}</n>px 并加粗`,
  mark: () => `内联 SVG，四条 path · 视差位移 <n>${probe.parallaxY}</n>px`,
  sticker: () => '可拖、可甩、会撞墙 · 刷新就回原位',
  geese: () => '排人字飞过 · 扇翅膀的节奏顺着队形往后传 · 光标凑近会炸群',
  marquee: () => `跟着滚动速度走 · 此刻 <n>${probe.marqueeSpeed}</n> px/s`,
  belief: () => '右下角折起来了 · 掀开压着一句话',
  scrib: () => '一条 path · 把虚线的空档从满推到零，笔迹就自己写出来了',
  clip: () => '夹着这张纸 · 点一下就掉了，刷新又回来',
  thread: () => '随滚动一点点画出来 · 四个结也是目录，点了就跳过去',
  works: (el) => {
    const cards = [...el.children];
    const stuck = cards.filter((c) => {
      const cs = getComputedStyle(c);
      return cs.position === 'sticky'
        && Math.abs(c.getBoundingClientRect().top - parseFloat(cs.top)) < 1.5;
    }).length;
    return `position: sticky · 已钉住 <n>${stuck}</n> / ${cards.length}`;
  },
};

let xrayApi = null;

export function toggleXray(on) {
  if (!xrayApi) return false;
  xrayApi(on);
  return true;
}

export function initXray() {
  const targets = [...document.querySelectorAll('[data-xray]')];
  if (!targets.length) return;

  let layer = null;
  let items = [];
  let raf = 0;
  let on = false;

  function build() {
    layer = document.createElement('div');
    layer.className = 'xray';
    items = targets.map((el) => {
      const box = document.createElement('div');
      box.className = 'xray__box';
      const tag = document.createElement('span');
      tag.className = 'xray__tag';
      box.appendChild(tag);
      layer.appendChild(box);
      return { el, box, tag, key: el.dataset.xray, last: '' };
    });
    const hint = document.createElement('div');
    hint.className = 'xray__hint';
    hint.textContent = '透视模式 · 再按 ~ 或 Esc 退出';
    layer.appendChild(hint);
    document.body.appendChild(layer);
  }

  function frame() {
    raf = 0;
    if (!on) return;

    for (const it of items) {
      const r = it.el.getBoundingClientRect();
      const shown = r.width > 0 && r.bottom > 0 && r.top < innerHeight;
      it.box.style.display = shown ? 'block' : 'none';
      if (!shown) continue;

      it.box.style.left = `${Math.round(r.left)}px`;
      it.box.style.top = `${Math.round(r.top)}px`;
      it.box.style.width = `${Math.round(r.width)}px`;
      it.box.style.height = `${Math.round(r.height)}px`;
      /* 贴着视口顶端的元素上方没地方挂标签，翻进框里 */
      const flip = r.top < 30;
      it.box.toggleAttribute('data-flip', flip);
      /* 框比视口还高时(书脊、作品区)，标签得留在屏幕里，不能跟着框顶跑出去 */
      it.tag.style.top = flip
        ? `${clamp(8 - r.top, 2, Math.max(2, r.height - 26))}px`
        : '';

      const make = XRAY_TEXT[it.key];
      const text = make ? make(it.el) : it.key;
      if (text !== it.last) {
        it.last = text;
        it.tag.innerHTML = text
          .replace(/<n>/g, '<i class="xray__num">')
          .replace(/<\/n>/g, '</i>');
      }

      /* 标签会顶出右边缘时改成右对齐 */
      const overflowsRight = r.left + it.tag.offsetWidth > innerWidth - 8;
      it.tag.style.left = overflowsRight ? 'auto' : '-2px';
      it.tag.style.right = overflowsRight ? '-2px' : 'auto';
    }

    raf = requestAnimationFrame(frame);
  }

  function toggle(next) {
    const want = next === undefined ? !on : !!next;
    if (want === on) return;
    on = want;
    if (on) {
      if (!layer) build();
      layer.style.display = '';
      if (!raf) raf = requestAnimationFrame(frame);
    } else if (layer) {
      layer.style.display = 'none';
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }
  }

  xrayApi = toggle;

  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    /* 在终端里敲 ~ 是在打字，不是在切模式 */
    if (e.target.matches?.('input, textarea')) return;
    if (e.key === '`' || e.key === '~') {
      e.preventDefault();
      toggle();
    } else if (e.key === 'Escape' && on) {
      toggle(false);
    }
  });
}

export function initCopy() {
  const stamp = document.querySelector('[data-stamp]');
  const stampDate = stamp?.querySelector('[data-stamp-date]');

  /* 邮戳只盖一次就留在那儿，反复复制不该反复弹 */
  function stampIt() {
    if (!stamp || stamp.classList.contains('is-stamped')) return;
    if (stampDate) {
      const t = new Date(Date.now() + 8 * 3600e3);
      stampDate.textContent =
        `${t.getUTCFullYear()}.${pad2(t.getUTCMonth() + 1)}.${pad2(t.getUTCDate())}`;
    }
    stamp.classList.add('is-stamped');
  }

  document.querySelectorAll('[data-copy]').forEach((el) => {
    const hint = el.querySelector('[data-copy-hint]');
    let timer = 0;

    el.addEventListener('click', async (e) => {
      const ok = await copyText(el.dataset.copy);
      if (ok) { burstFrom(e); stampIt(); }
      if (!hint) return;
      clearTimeout(timer);
      /* 失败也要给反馈，否则用户点了完全不知道发生了什么 */
      hint.textContent = ok ? '已复制' : '请长按选中';
      timer = setTimeout(() => { hint.textContent = '复制'; }, 1800);
    });
  });
}
