/* 终端彩蛋：连续敲 fish 唤起
   内容实时读自页面 DOM，改了页面文案终端里跟着变 */

import {
  setTheme, burst, clockNow, visitorNote, resetStickers, toggleXray, stats,
} from './ui.js';

/* source 能读的文件白名单。这站没有构建步骤，
   浏览器拿到的就是仓库里那一份，所以打印出来的确实是源码本身 */
const SOURCES = [
  'index.html',
  'assets/css/style.css',
  'assets/js/main.js',
  'assets/js/ui.js',
  'assets/js/terminal.js',
];

const GH_USER = 'FishDuM';
const GH_CACHE = 'ljx.gh';
const GH_TTL = 30 * 60 * 1000;

const KEY = ['f', 'i', 's', 'h'];

const FISH = String.raw`
      ______
    _/      \__
  _/            \__
 /      ___         \___
|      /   \             \_
|      \___/               >
 \_                    ___/
   \__            ____/
      \__________/
`;

export function initTerminal() {
  const el = document.querySelector('.term');
  const body = el?.querySelector('.term__body');
  const input = el?.querySelector('.term__input');
  if (!el || !body || !input) return;

  let buffer = [];
  const history = [];
  let cursor = -1;

  addEventListener('keydown', (e) => {
    if (el.classList.contains('is-open')) {
      if (e.key === 'Escape') close();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.matches?.('input, textarea')) return;
    if (!/^[a-z]$/i.test(e.key)) return;

    buffer.push(e.key.toLowerCase());
    if (buffer.length > KEY.length) buffer.shift();
    if (buffer.join('') === KEY.join('')) { buffer = []; open(); }
  });

  el.querySelector('.term__x')?.addEventListener('click', close);

  input.addEventListener('keydown', (e) => {
    /* 输入法合成态里的回车是选词，不是提交 */
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') {
      const line = input.value;
      input.value = '';
      if (line.trim()) { history.push(line); cursor = history.length; }
      run(line);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cursor > 0) input.value = history[--cursor] ?? '';
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (cursor < history.length - 1) input.value = history[++cursor] ?? '';
      else { cursor = history.length; input.value = ''; }
    }
  });

  /* 打开时把页面其余部分整体屏蔽，否则键盘会 Tab 到看不见的元素上 */
  const outside = () => [...document.body.children].filter((n) => n !== el);
  let restoreFocus = null;

  function open() {
    restoreFocus = document.activeElement;
    el.classList.add('is-open');
    document.body.classList.add('is-locked');
    for (const n of outside()) n.inert = true;

    if (!body.childElementCount) {
      print('你找到了。这里可以敲命令，<b>help</b> 看有哪些，<b>exit</b> 出去。');
      print('');
    }
    setTimeout(() => input.focus(), 60);
    burst(innerWidth / 2, innerHeight / 2, 18);
  }

  function close() {
    el.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    for (const n of outside()) n.inert = false;
    restoreFocus?.focus?.();
    restoreFocus = null;
  }

  /* 焦点在对话框内循环 */
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const stops = el.querySelectorAll('button, input');
    if (!stops.length) return;
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  function print(html = '') {
    const line = document.createElement('span');
    line.className = 'term__line';
    line.innerHTML = html;
    body.appendChild(line);
    body.scrollTop = body.scrollHeight;
  }

  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  const ago = (iso) => {
    const d = (Date.now() - new Date(iso).getTime()) / 1000;
    if (!Number.isFinite(d) || d < 0) return '刚刚';
    if (d < 3600) return `${Math.max(1, Math.round(d / 60))} 分钟前`;
    if (d < 86400) return `${Math.round(d / 3600)} 小时前`;
    return `${Math.round(d / 86400)} 天前`;
  };

  const sections = () =>
    [...document.querySelectorAll('section[id], header[id]')].map((s) => ({
      id: s.id,
      title: (s.querySelector('.head__title') || s.querySelector('.contact__title'))
        ?.textContent?.trim() || s.id,
      node: s,
    }));

  /* innerText 只在已渲染的节点上才按版式换行，所以先把副本临时挂进文档 */
  function textOf(node) {
    const clone = node.cloneNode(true);
    clone.querySelectorAll('svg, script, .sticker').forEach((n) => n.remove());
    clone.style.cssText = 'position:absolute;left:-9999px;top:0;width:600px';
    document.body.appendChild(clone);
    const text = clone.innerText;
    clone.remove();
    return text.split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
  }

  /* 用无原型对象，避免 toString / constructor 这类输入命中原型链 */
  const commands = Object.assign(Object.create(null), {
    help() {
      print('  <b>ls</b>              列出页面上的章节');
      print('  <b>cat</b> &lt;章节&gt;      打印该章节的全部文字');
      print('  <b>open</b> &lt;名字&gt;     在新标签打开某个仓库');
      print('  <b>whoami</b>          我是谁');
      print('  <b>time</b>            两边各自几点');
      print('  <b>source</b> [文件]   打印这个站自己的源码');
      print('  <b>git</b>             我最近推了什么');
      print('  <b>stats</b>           你在这页干了些什么');
      print('  <b>xray</b>            透视模式（也可以直接按 ~）');
      print('  <b>fish</b>            画条鱼');
      print('  <b>theme</b>           换配色');
      print('  <b>reset</b>           把贴纸放回原位');
      print('  <b>clear</b>           清屏');
      print('  <b>exit</b>            出去（或按 Esc）');
    },

    ls() {
      const list = sections();
      /* 404 这类页面一个带 id 的章节都没有，不能只回一个空行 */
      if (!list.length) return print('这一页没有可以列的章节，回首页试试。');
      for (const s of list) print(`  <i>${esc(s.id.padEnd(10))}</i> <u>${esc(s.title)}</u>`);
    },

    cat(arg) {
      if (!arg) return print('用法：cat &lt;章节&gt;，先用 <b>ls</b> 看有哪些');
      const s = sections().find((x) => x.id === arg);
      if (!s) return print(`没有叫 <i>${esc(arg)}</i> 的章节`);
      print(esc(textOf(s.node)));
    },

    open(arg) {
      const links = [...document.querySelectorAll('a[data-repo]')];
      if (!arg) {
        for (const a of links) print(`  <i>${esc(a.dataset.repo.padEnd(14))}</i> <u>${esc(a.href)}</u>`);
        return;
      }
      const hit = links.find((a) => a.dataset.repo.toLowerCase() === arg.toLowerCase());
      if (!hit) return print(`没有叫 <i>${esc(arg)}</i> 的东西`);
      print(`打开 <u>${esc(hit.href)}</u>`);
      window.open(hit.href, '_blank', 'noopener');
    },

    whoami() {
      const now = clockNow();
      const info = [
        ['名字', '会飞的鱼 · FISH'],
        ['学校', '广东理工学院 · 计算机科学与技术'],
        ['年级', '大四'],
        ['主力', 'Java'],
        ['也写', 'Vue / React / TypeScript / Python'],
        ['最近', '在折腾 Agent'],
        ['此刻', `${now.hhmm}，${now.mood}`],
        ['代码', 'github.com/FishDuM'],
        ['这个站', '手写，没有界面框架'],
      ];
      for (const [k, v] of info) print(`  <b>${esc(k.padEnd(6))}</b> <u>${esc(v)}</u>`);
    },

    time() {
      const now = clockNow();
      print(`  我这边 <b>${esc(now.hhmm)}</b>，${esc(now.mood)}。`);
      print(`  你那边 <b>${esc(now.theirHhmm)}</b>，${now.gap ? `和我差 ${esc(String(Math.abs(now.gap)))} 个钟头。` : '和我同一个钟点。'}`);
      const note = visitorNote(now);
      if (note) print(`  <i>${esc(note)}</i>`);
      if (now.awake === 'no') print('  这个点发消息，大概要等一会儿才有回音。');
    },

    async source(arg) {
      if (!arg) {
        print('这个站没有构建步骤，你现在下载到的就是我写的那份文件。');
        print('能读的有：');
        for (const f of SOURCES) print(`  <i>${esc(f)}</i>`);
        print('用法：source &lt;文件&gt;');
        return;
      }
      const file = SOURCES.find((f) => f === arg || f.endsWith(`/${arg}`) || f === `assets/js/${arg}`);
      if (!file) return print(`只能读这几个：<i>${esc(SOURCES.join('  '))}</i>`);

      print(`读取 <u>${esc(file)}</u> …`);
      try {
        /* 必须用根路径：GitHub Pages 会拿 404.html 去应付任意深度的地址，
           那时 baseURI 是访客瞎敲的那个路径，相对路径会解析到不存在的地方 */
        const res = await fetch(`/${file}`, { cache: 'no-cache' });
        if (!res.ok) throw new Error(String(res.status));
        const text = await res.text();
        const lines = text.split('\n');
        print(`  <i>${lines.length} 行，${new Blob([text]).size} 字节</i>`);
        print('');
        /* 行号右对齐，读起来像个正经的分页器 */
        const w = String(lines.length).length;
        for (let i = 0; i < lines.length; i++) {
          print(`<u>${String(i + 1).padStart(w)}</u>  ${esc(lines[i])}`);
        }
      } catch (err) {
        print(`读不到：<i>${esc(String(err.message || err))}</i>`);
      }
    },

    async git() {
      /* 缓存的是已经解析好的那几行，不是原始响应——
         否则每次敲 git 都要把下面那几个提交请求重打一遍 */
      let rows = null;
      try {
        const hit = JSON.parse(localStorage.getItem(GH_CACHE) || 'null');
        if (hit && Date.now() - hit.t < GH_TTL && Array.isArray(hit.rows)) rows = hit.rows;
      } catch { /* 缓存坏了就当没有 */ }

      if (!rows) {
        print('问一下 GitHub …');
        try {
          const res = await fetch(`https://api.github.com/users/${GH_USER}/events/public`);
          if (!res.ok) throw new Error(res.status === 403 ? '被限流了，等会儿再试' : String(res.status));
          const events = await res.json();

          const pushes = (Array.isArray(events) ? events : [])
            .filter((e) => e.type === 'PushEvent' && e.payload?.head && e.repo?.name);
          if (!pushes.length) return print('最近没有公开的提交记录。');

          /* 事件流里只给 head 的 sha，不给提交信息，得逐个再问一次。
             一个仓库只问最近那一次，最多四个请求，别把匿名额度烧光 */
          const seen = new Set();
          const picks = [];
          for (const e of pushes) {
            if (seen.has(e.repo.name)) continue;
            seen.add(e.repo.name);
            picks.push({
              repo: e.repo.name,
              sha: e.payload.head,
              at: e.created_at,
              ref: String(e.payload.ref || '').split('/').pop(),
            });
            if (picks.length >= 4) break;
          }

          const msgs = await Promise.all(picks.map((p) => fetch(
            `https://api.github.com/repos/${p.repo}/commits/${p.sha}`,
          ).then((r) => (r.ok ? r.json() : null))
            .then((j) => String(j?.commit?.message || '').split('\n')[0])
            .catch(() => '')));

          rows = picks.map((p, i) => ({
            at: p.at,
            name: p.repo.split('/').pop(),
            /* 拿不到提交信息就退回分支名，总比空一行强 */
            msg: msgs[i] ? msgs[i].slice(0, 50) : `推到 ${p.ref}`,
          }));

          try {
            localStorage.setItem(GH_CACHE, JSON.stringify({ t: Date.now(), rows }));
          } catch { /* 存不下无所谓 */ }
        } catch (err) {
          print(`没问到：<i>${esc(String(err.message || err))}</i>`);
          print(`直接看这儿吧：<u>github.com/${GH_USER}</u>`);
          return;
        }
      }

      for (const r of rows) {
        print(`  <i>${esc(ago(r.at))}</i>  <b>${esc(r.name)}</b>  ${esc(r.msg)}`);
      }
      print('');
      print('  <i>这几行来自 GitHub 接口，不是写死在页面里的。</i>');
    },

    stats() {
      const sec = Math.round((performance.now() - stats.t0) / 1000);
      const min = Math.floor(sec / 60);
      /* CSS 像素名义上是 1/96 英寸，换算出来的"米"当然不严谨，图一乐 */
      const metres = (stats.scrolled / 3779.5).toFixed(1);
      print(`  你在这页待了 <b>${min ? `${min} 分 ` : ''}${sec % 60} 秒</b>`);
      print(`  一共滚了 <b>${metres}</b> 米`);
      print(`  迸出 <b>${stats.bits}</b> 片纸屑，戳过 <b>${stats.hits}</b> 个字`);
      print(`  这是你第 <b>${stats.visits}</b> 次来`);
    },

    xray() {
      if (!toggleXray(true)) return print('这一页没有可以拆的东西。');
      close();
      print('');
    },

    reset() {
      if (resetStickers()) print('贴纸都回原位了。');
      else print('这页没有贴纸可以复位。');
    },

    fish() {
      print(esc(FISH));
      print('  <i>FishDuM</i>');
    },

    theme(arg) {
      const next = arg === 'cream' || arg === 'dusk'
        ? arg
        : document.documentElement.dataset.theme === 'dusk' ? 'cream' : 'dusk';
      setTheme(next);
      print(`换成 <i>${next === 'dusk' ? '夜色' : '奶油'}</i> 了`);
    },

    clear() { body.innerHTML = ''; },
    exit() { close(); },
    sudo() { print('这儿没什么需要提权的。'); },
  });

  /* source 和 git 要发请求，所以整条链路是异步的；
     命令没跑完就打空行的话，输出会出现在提示符后面 */
  async function run(raw) {
    const line = raw.trim();
    print(`<i>&gt;</i> ${esc(raw)}`);
    if (!line) return;
    const [name, ...rest] = line.split(/\s+/);
    const key = name.toLowerCase();
    const fn = typeof commands[key] === 'function' ? commands[key] : null;
    if (!fn) print(`不认识 <i>${esc(name)}</i>，敲 <b>help</b> 看看`);
    else {
      try {
        await fn(rest.join(' ').trim());
      } catch (err) {
        print(`出错了：<i>${esc(String(err && err.message || err))}</i>`);
      }
    }
    print('');
  }
}
