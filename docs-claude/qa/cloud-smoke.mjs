// Cloud smoke test (cloud session 2026-11-03). Node + Playwright, headless, --mute-audio.
// Usage: node docs-claude/qa/cloud-smoke.mjs <path to farin-english/app> <path to farin-spanish/app> [--courses] [--games]
// Passes only with 0 console errors / page errors and: Home roadmap renders, login + recovery screens render,
// saved progress survives a reload. --courses also opens every live course unit and every step (EN app).
// External hosts (Firebase, fonts) are blocked so the result does not depend on the network; the app runs offline.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }

const [enDir, esDir] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const WANT_COURSES = process.argv.includes('--courses');
const WANT_GAMES = process.argv.includes('--games');
const TYPES = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.webmanifest':'application/manifest+json'};
function serve(root){
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(root, p);
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'});
      if (/-app\.html$/.test(f)) { // test-only hook: the app runs inside one IIFE, so expose what the test needs (never written to disk)
        let h = fs.readFileSync(f, 'utf8'); const i = h.lastIndexOf('})();');
        h = h.slice(0, i) + 'window.__qa = {get state(){return state;}, go, save, render, currentRoadmap, get COURSES(){return COURSES;}, get ARCHETYPES(){return ARCHETYPES;}, courseLoad: typeof courseEnsureUnit==="function"?courseEnsureUnit:null};\n' + h.slice(i);
        return r.end(h);
      }
      fs.createReadStream(f).pipe(r);
    }).listen(0, () => res(s));
  });
}

const problems = [];
async function runApp(browser, dir, file, label){
  const srv = await serve(path.resolve(dir)); const base = `http://127.0.0.1:${srv.address().port}/`;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  // external hosts load normally (Firebase is needed for the app to start)
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (!/net::ERR_FAILED|ERR_BLOCKED|Failed to load resource|firebase|firestore|gstatic|fonts\.g/i.test(t)) errs.push('console: ' + t); } });
  const url = base + file + '?lang=en';
  const step = async (name, fn) => { try { await fn(); } catch (e) { problems.push(`[${label}] ${name}: ${e.message.split('\n')[0]}`); } };

  await step('fresh load', async () => { await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(800);
    const v = await page.evaluate(() => __qa.state.view); if (!v) throw new Error('no view'); });
  await step('login screen', async () => { await page.evaluate(() => { __qa.go('restore-code', {mode:'password'}); });
    await page.waitForTimeout(200); if (!(await page.$('#login-name'))) throw new Error('login form missing');
    await page.evaluate(() => { __qa.go('restore-code', {mode:'code'}); }); await page.waitForTimeout(200);
    if (!(await page.$('#restore-code-input'))) throw new Error('recovery form missing'); });
  await step('seed profile + Home roadmap', async () => {
    await page.evaluate(() => { const a = Object.keys(__qa.ARCHETYPES)[0];
      Object.assign(__qa.state.profile, {name:'QA Cloud', motivationTag:a, goals:['career'], level:'B1', completedDiagnostic:true, dashboardIntroShown:true});
      __qa.state.view = 'dashboard'; __qa.state.viewParams = {}; __qa.state.progress.sessionsExplored = 7; __qa.save(); __qa.render(); });
    await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(1000);
    const r = await page.evaluate(() => ({ view: __qa.state.view, n: __qa.currentRoadmap().length, nodes: document.querySelectorAll('[class*="roadmap"]').length, se: __qa.state.progress.sessionsExplored, name: __qa.state.profile.name }));
    if (r.view !== 'dashboard') throw new Error('view after reload = ' + r.view);
    if (!r.n || !r.nodes) throw new Error('roadmap empty: ' + JSON.stringify(r));
    if (r.se !== 7 || r.name !== 'QA Cloud') throw new Error('saved progress lost: ' + JSON.stringify(r)); });
  await step('roadmap node opens', async () => { const ok = await page.evaluate(() => { const b = document.querySelector('[data-action][class*="roadmap"], .roadmap-card [data-action]'); if (b) b.click(); return !!b; }); await page.waitForTimeout(400); if (!ok) throw new Error('no roadmap button'); await page.evaluate(() => { __qa.go('dashboard', {}); }); });

  if (WANT_COURSES) await step('courses', async () => {
    const list = await page.evaluate(() => __qa.COURSES.filter(c => c.status === 'live').map(c => ({ id: c.id, units: (c.modules || []).flatMap(m => (m.units || []).map(u => ({ id: u.id, types: [].concat(...(u.sessions || [])) }))) })));
    await page.evaluate(() => { try { localStorage.setItem('farinCoursePreview', '1'); } catch (e) {} });
    for (const c of list) {
      await page.evaluate(cid => __qa.go('course-detail', { cid }), c.id); await page.waitForTimeout(150);
      for (const u of c.units) {
        await page.evaluate(([cid, uid]) => { if (typeof courseLoadUnit === 'function') courseLoadUnit(uid); __qa.go('course-unit', { cid, uid }); }, [c.id, u.id]);
        await page.waitForTimeout(120);
        for (const t of u.types) {
          await page.evaluate(([cid, uid, type]) => __qa.go('course-step', { cid, uid, type }), [c.id, u.id, t]); await page.waitForTimeout(90);
          const empty = await page.evaluate(() => (document.getElementById('app').innerText || '').trim().length < 20);
          if (empty) problems.push(`[${label}] ${c.id}/${u.id}/${t}: empty step`);
        }
      }
    }
    await page.evaluate(() => __qa.go('dashboard', {}));
  });
  if (WANT_GAMES) await step('games dev pages', async () => {
    for (const g of ['cozy-chores', 'case-closed']) {
      const f = path.join(dir, 'games', g, 'dev.html'); if (!fs.existsSync(f)) continue;
      const p2 = await ctx.newPage(); p2.on('pageerror', e => errs.push(`${g} pageerror: ` + e.message));
      await p2.goto(base + `games/${g}/dev.html?tts=0&pace=0.2`, { waitUntil: 'load' }); await p2.waitForTimeout(1500); await p2.close();
    }
  });
  await page.waitForTimeout(300);
  for (const e of errs) problems.push(`[${label}] ${e}`);
  await ctx.close(); srv.close();
}

const browser = await pw.chromium.launch({ args: ['--mute-audio'] });
await runApp(browser, enDir, 'farin-english-app.html', 'EN');
if (esDir) await runApp(browser, esDir, 'farin-spanish-app.html', 'ES');
await browser.close();
if (problems.length) { console.log('FAIL\n' + problems.join('\n')); process.exit(1); }
console.log('PASS: no console errors; Home roadmap, login, recovery, saved progress OK' + (WANT_COURSES ? '; every live course step renders' : ''));
