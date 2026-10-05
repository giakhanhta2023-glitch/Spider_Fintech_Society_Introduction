/* A level numbered 10.1 sits between 10 and 11 without moving anything.
   =====================================================================
   Run:  node tools/check_asides.mjs

   The point of a decimal number is that no existing level is renumbered and no
   sentence citing one goes stale. That only holds if four separate things stay
   true at once, and three of them are easy to break by accident:

     the sort puts 10.1 after 10 and before 11
     positionOf counts along the spine, so level 11 is still called level 11
     the rank ladder still has twenty rungs, so clearing an aside is not 11/20
     level 11 waits for level 10, never for the optional level in between

   This loads the real core.js and storage.js against a fake window, registers
   twenty levels plus two asides, and asserts all four. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const store = {};
const win = {
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  },
  addEventListener() {}, dispatchEvent() {}, location: { hash: '' }
};
win.window = win;
const ctx = vm.createContext(win);
vm.runInContext(readFileSync(ROOT + 'assets/js/config.js', 'utf8'), ctx);
vm.runInContext(readFileSync(ROOT + 'assets/js/core.js', 'utf8'), ctx);
vm.runInContext(readFileSync(ROOT + 'assets/js/storage.js', 'utf8'), ctx);

const FQ = win.FQ;

/* The real shape, minus the prose: twenty numbered levels and two asides. */
for (let i = 1; i <= 20; i++) FQ.registerLevel({ id: i, title: 'level ' + i, quiz: [], project: {} });
FQ.registerLevel({ id: 10.1, position: '10.1', aside: true, title: 'TypeScript aside', quiz: [], project: {} });
FQ.registerLevel({ id: 20.1, position: '20.1', aside: true, title: 'Ruby aside', quiz: [], project: {} });
FQ.registerTrack({ id: 'eng', name: 'engineering', ranks: win.FQ_CONFIG.ranks });

const S = win.FQ.store;
let failed = 0;
const is = (got, want, what) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { failed++; console.log('FAIL ' + what + '\n  got  ' + JSON.stringify(got) + '\n  want ' + JSON.stringify(want)); }
  else console.log('ok   ' + what);
};

/* ---------------------------------------------------------------- order */
is(FQ.levelsIn('eng').map((l) => l.id).slice(8, 13), [9, 10, 10.1, 11, 12],
   '10.1 sorts between 10 and 11');
is(FQ.levelsIn('eng').map((l) => l.id).slice(-2), [20, 20.1],
   '20.1 sorts after 20');
is(FQ.levelsIn('eng').length, 22, 'levelsIn counts every level');
is(FQ.spineIn('eng').length, 20, 'the spine is still twenty');

/* -------------------------------------------------------------- lookup */
is(FQ.level(10.1).title, 'TypeScript aside', 'level(10.1) finds the aside');
is(FQ.level('10.1').title, 'TypeScript aside', 'level("10.1") from the URL');
is(FQ.level(10).title, 'level 10', 'level(10) is still level 10');
is(FQ.labelOf(10.1), 'level 10.1', 'it is called level 10.1');
is(FQ.labelOf(11), 'level 11', 'level 11 keeps its number');

/* ------------------------------------------------------------ unlocking */
is(S.total(), 20, 'the ladder is twenty rungs');
is(S.isUnlocked(1), true, 'level 1 is open');
is(S.isUnlocked(10.1), false, 'the aside is shut before level 10');
is(S.isUnlocked(11), false, 'level 11 is shut at the start');

/* Clear a level the way the interface does: pass the drill, finish the build. */
const mark = (id) => { S.recordQuiz(id, 15, 15, []); S.completeProject(id); };
for (let i = 1; i <= 10; i++) mark(i);

is(S.isUnlocked(10.1), true, 'clearing level 10 opens the aside');
is(S.isUnlocked(11), true, 'level 11 opens on level 10, NOT on the aside');
is(S.isCleared(10.1), false, 'the aside is not cleared by accident');
is(S.clearedCount(), 10, 'ten of twenty, the aside does not inflate it');

mark(10.1);
is(S.clearedCount(), 10, 'clearing the aside does not make it 11 of 20');
is(S.previousIn(11).id, 10, 'level 11 waits for level 10');
is(S.previousIn(10.1).id, 10, 'the aside waits for level 10');
is(S.previousIn(20.1).id, 20, 'the Ruby aside waits for the capstone');

console.log(failed ? '\n' + failed + ' FAILED' : '\nall assertions hold');
process.exit(failed ? 1 : 0);
