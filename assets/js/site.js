/* 站点交互：真实时钟、深度表、进场点亮、数字滚动、导航、复制。
   全部原生实现，无第三方依赖 */

import { sea, docDepthAt } from './ocean.js';

const root = document.documentElement;

const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
export const env = { get reduced() { return motionQuery.matches; } };

/* 隐私模式下 localStorage 会抛异常，不能让它掀翻整个脚本 */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* 记不住就算了 */ } },
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pad2 = (n) => String(n).padStart(2, '0');

/* --- 时钟：走的是广东的真实时间 ------------------------------------------ */

/* 中国全境不做夏令时，把时间戳推 8 小时再读 UTC 就是本地时间，
   不依赖 Intl 的时区库，老浏览器也不会掉链子 */
const BANDS = [
  [5, 'late', '还醒着，多半在写东西'],
  [9, 'no', '刚睡下没多久'],
  [12, 'yes', '醒了，但没完全醒'],
  [14, 'yes', '大概在吃饭'],
  [19, 'yes', '在写代码'],
  [24, 'yes', '一天里最清醒的时候'],
];

export function clockNow() {
  const now = Date.now();
  const mine = new Date(now + 8 * 3600e3);
  const h = mine.getUTCHours();
  const band = BANDS.find(([until]) => h < until) || BANDS[BANDS.length - 1];

  const theirs = new Date(now);
  const gap = Math.round((-theirs.getTimezoneOffset() / 60 - 8) * 10) / 10;

  return {
    hhmm: `${pad2(h)}:${pad2(mine.getUTCMinutes())}`,
    year: mine.getUTCFullYear(),
    awake: band[1],
    mood: band[2],
    theirHhmm: `${pad2(theirs.getHours())}:${pad2(theirs.getMinutes())}`,
    theirHour: theirs.getHours(),
    gap,
  };
}

export function visitorNote(n) {
  if (n.theirHour < 5) return n.gap ? `你那儿 ${n.theirHhmm}，你也没睡` : '你也没睡';
  if (!n.gap) return null;
  return `你那儿 ${n.theirHhmm}，差 ${Math.abs(n.gap)} 个钟头`;
}

export function initClock() {
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
    /* 对齐到下一个整分再跳，省得每秒空转 */
    clearTimeout(timer);
    timer = setTimeout(tick, 60000 - (Date.now() % 60000) + 200);
  }

  tick();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
}

/* --- 深度表：滚动位置换算成水深 ------------------------------------------ */

/* 锚点按区块算：每个区块的顶就是它的标称深度，
   两锚之间线性插值，页面增删一节也不用改代码 */
const ZONES = [
  [1, '水面'], [200, '阳光带'], [1000, '暮光带'], [4000, '午夜带'], [Infinity, '深渊带'],
];

export function initGauge() {
  const sections = [...document.querySelectorAll('[data-depth]')];
  const gauge = document.querySelector('[data-gauge]');
  const mini = document.querySelector('[data-gauge-mini]');
  if (!sections.length || (!gauge && !mini)) return;

  let ends = [0, 1];   // 首尾两节的文档位置，只给刻度针定位用
  let raf = 0;

  function measure() {
    const ys = sections
      .map((el) => el.getBoundingClientRect().top + scrollY)
      .sort((a, b) => a - b);
    ends = [ys[0] || 0, ys[ys.length - 1] || 1];
    paint();
  }

  /* 水深本身由 ocean.js 算：那边要用同一个数决定水色。
     两边共用一份，刻度盘上的米数就永远等于眼前这片水的深度 */
  function paint() {
    raf = 0;
    const probeY = scrollY + innerHeight * 0.55;
    const d = docDepthAt(probeY);
    const zone = ZONES.find(([max]) => d < max) || ZONES[ZONES.length - 1];
    const text = d < 1 ? '0' : String(Math.round(d));

    for (const box of [gauge, mini]) {
      if (!box) continue;
      const num = box.querySelector('[data-gauge-depth], [data-gauge-depth-mini]');
      const label = box.querySelector('[data-gauge-zone], [data-gauge-zone-mini]');
      if (num) num.textContent = text;
      if (label) label.textContent = d < 1 ? ' · 水面' : ` · ${zone[1]}`;
    }

    const pin = gauge?.querySelector('[data-gauge-pin]');
    if (pin) {
      const k = clamp((probeY - ends[0]) / Math.max(1, ends[1] - ends[0]), 0, 1);
      pin.style.setProperty('--p', k.toFixed(4));
    }
  }

  addEventListener('scroll', () => {
    if (!raf) raf = requestAnimationFrame(paint);
  }, { passive: true });
  addEventListener('resize', measure);
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(document.body);
  document.fonts?.ready.then(measure).catch(() => {});

  measure();
}

/* --- 进场 ------------------------------------------------------------------ */

export function initReveal() {
  const items = [...document.querySelectorAll('.rise')];

  if (!('IntersectionObserver' in window) || env.reduced) {
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

  items.forEach((el) => {
    /* HTML 里行内写好的 --delay 优先（首屏的节奏是手工排的），
       其余的按同屏顺序错开 */
    if (!el.style.getPropertyValue('--delay')) {
      el.style.setProperty('--delay', `${(items.indexOf(el) % 4) * 80}ms`);
    }
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

/* --- 数字滚动 -------------------------------------------------------------- */

function startCounts(instant = false) {
  for (const el of document.querySelectorAll('[data-count]')) {
    const target = parseInt(el.dataset.count, 10);
    if (!Number.isFinite(target)) continue;
    if (instant || env.reduced) { el.textContent = String(target); continue; }

    const t0 = performance.now();
    const dur = 900;
    const step = (now) => {
      const k = clamp((now - t0) / dur, 0, 1);
      const eased = 1 - (1 - k) ** 3;
      el.textContent = String(Math.round(target * eased));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

export function initCounts() {
  const els = [...document.querySelectorAll('[data-count]')];
  if (!els.length) return;
  /* 脚本跑不了或要求减弱动效时，保留 HTML 里的静态真值 */
  if (!('IntersectionObserver' in window) || env.reduced) return;

  const animate = (el) => {
    /* 目标值必须从 data-count 读，不能从 textContent 读——
       上面刚把它清零了，从文本读永远只能读到自己写的那个 0 */
    const target = parseInt(el.dataset.count, 10);
    if (!Number.isFinite(target) || target === 0) return;
    const t0 = performance.now();
    const dur = 950;
    const step = (now) => {
      const k = clamp((now - t0) / dur, 0, 1);
      el.textContent = String(Math.round(target * (1 - (1 - k) ** 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  els.forEach((el) => { el.textContent = '0'; });

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      io.unobserve(entry.target);
      animate(entry.target);
    }
  }, { threshold: 0.4 });
  els.forEach((el) => io.observe(el));
}

/* --- 导航：下滚收起，上滚露出 ---------------------------------------------- */

export function initNav() {
  const nav = document.querySelector('[data-nav]');
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

/* --- 复制 ------------------------------------------------------------------ */

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

export function initCopy() {
  document.querySelectorAll('[data-copy]').forEach((el) => {
    const hint = el.querySelector('[data-copy-hint]');
    let timer = 0;

    el.addEventListener('click', async (e) => {
      const ok = await copyText(el.dataset.copy);
      if (ok) {
        let { clientX: x, clientY: y } = e;
        if (!x && !y) {
          const box = el.getBoundingClientRect();
          x = box.left + box.width / 2;
          y = box.top + box.height / 2;
        }
        sea.ping(x, y, true);
        el.classList.add('is-sent');
      }
      if (!hint) return;
      clearTimeout(timer);
      hint.textContent = ok ? '信号已发出' : '请长按选中';
      timer = setTimeout(() => {
        hint.textContent = '复制';
        el.classList.remove('is-sent');
      }, 2200);
    });
  });
}
