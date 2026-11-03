// Engine (both apps): a Learn key point may carry wrong + right = the Common mistake pair, shown as a ✗ line and a ✓ line
// above the point's tip (the tip explains why). Safe to re-run.
import fs from 'node:fs';
const files = process.argv.slice(2);
const A = '  const tip = p.tip ? `<div class="cx-tip" dir="${courseTD()}">${isoHtml(cl(p.tip))}</div>` : \'\';\n  return `<div class="lx-card cx-card">${body}${steps}${table}${phrases}${tip}</div>`;';
const B = '  const tip = p.tip ? `<div class="cx-tip" dir="${courseTD()}">${isoHtml(cl(p.tip))}</div>` : \'\';\n' +
  '  // Common mistake (cloud 2026-11-03): the typical learner error and its fix; the tip below it says why.\n' +
  '  const mk = p.wrong && p.right ? `<div class="cx-mk"><div class="lx-eyebrow">${CL(\'Common mistake\',\'Sık yapılan hata\',\'اشتباه رایج\',\'Error frecuente\')}</div><p class="cx-mk-l bad" dir="ltr" translate="no"><span aria-hidden="true">✗</span> ${esc(p.wrong)}</p><p class="cx-mk-l ok" dir="ltr" translate="no"><span aria-hidden="true">✓</span> ${esc(p.right)}</p></div>` : \'\';\n' +
  '  return `<div class="lx-card cx-card">${body}${steps}${table}${phrases}${mk}${tip}</div>`;';
const CA = '  .cx-tip{padding:10px 12px; border-radius:12px; background:var(--bg-sunken); font-size:13px; line-height:1.5; color:var(--ink-soft);}';
const CB = CA + '\n  .cx-mk{margin:10px 0 8px;} .cx-mk .lx-eyebrow{margin-bottom:6px;}\n  .cx-mk-l{margin:0 0 6px; padding:9px 12px; border-radius:12px; font-size:14.5px; line-height:1.45; font-weight:700;}\n  .cx-mk-l span{display:inline-block; width:18px; font-weight:800;}\n  .cx-mk-l.bad{background:var(--cat-gram-soft); color:var(--ink); text-decoration:line-through; text-decoration-color:color-mix(in srgb, var(--cat-gram) 70%, transparent);} .cx-mk-l.bad span{text-decoration:none;}\n  .cx-mk-l.ok{background:var(--cat-voc-soft); color:var(--ink);}';
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes('Common mistake (cloud 2026-11-03)')) { console.log('already', f); continue; }
  if (!s.includes(A) || !s.includes(CA)) throw new Error('anchor missing in ' + f);
  s = s.replace(A, B).replace(CA, CB); fs.writeFileSync(f, s); console.log('patched', f);
}
