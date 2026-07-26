/* 引导：每一步单独兜底，任何一处出问题都不该让后面的全部停摆 */

import {
  initTheme, initClock, splitAll, initWave, playHero, initReveal, initMarquee,
  initNav, initStickers, initPress, initCopy, initParallax, initStats, initXray,
  initGeese, initFolds, initMarks, initClip, initThread,
} from './ui.js';
import { initTerminal } from './terminal.js';

function run(label, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`[${label}] 初始化失败`, err);
  }
}

function boot() {
  run('theme', initTheme);
  run('clock', initClock);
  run('split', splitAll);
  run('wave', initWave);      /* 必须排在 split 之后，它靠的就是拆出来的那些字 */
  run('reveal', initReveal);
  run('marquee', initMarquee);
  run('nav', initNav);
  run('stickers', initStickers);
  run('press', initPress);
  run('folds', initFolds);
  run('marks', initMarks);
  run('clip', initClip);
  run('copy', initCopy);
  run('parallax', initParallax);
  run('geese', initGeese);
  run('thread', initThread);  /* 要量整页的高度，排在会改变布局的那些之后 */
  run('stats', initStats);
  run('xray', initXray);      /* 要排在 split 之后，标签里报的是拆出来的字数 */
  run('terminal', initTerminal);

  /* 字体就位后再放首屏动画以免字形跳动，但绝不能被卡住的字体请求无限期扣押 */
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    playHero();
  };
  setTimeout(start, 900);
  document.fonts?.ready.then(() => setTimeout(start, 60)).catch(start);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
