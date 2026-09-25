/* 引导：每一步单独兜底，任何一处出问题都不该让后面的全部停摆 */

import { initOcean } from './ocean.js';
import { initClock, initGauge, initReveal, initCounts, initNav, initCopy } from './site.js';
import { initSonar, trackScroll } from './sonar.js';

function run(label, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`[${label}] 初始化失败`, err);
  }
}

function boot() {
  run('ocean', initOcean);   /* 先把画布跑起来，别的模块要往里冒泡 */
  run('clock', initClock);
  run('gauge', initGauge);
  run('reveal', initReveal);
  run('counts', initCounts);
  run('nav', initNav);
  run('copy', initCopy);
  run('scroll-stat', trackScroll);
  run('sonar', initSonar);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
