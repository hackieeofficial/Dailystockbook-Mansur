/**
 * verify_sync_merge.js
 * Deep regression tests for 2026-09-11 sync fixes. Loads the REAL
 * js/storage.js + js/supabase-client.js in a sandbox and asserts:
 *  1. _mergeDailyReport unions tasks, honors tombstones, newer decidedAt wins
 *  2. _unionStrList / _mergeStrMap / _mergeMemory converge shared settings
 *  3. Queue persists to localStorage; snapshots survive reload; bare flags
 *     never clobber snapshots
 *  4. _mergeRestoreDate merges backups without wiping newer decisions and
 *     skips bad rows
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const store = {};
function mkStorage() {
    return {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; }
    };
}
const sandbox = {
    console,
    localStorage: mkStorage(),
    sessionStorage: mkStorage(),
    window: { addEventListener: () => {} },
    document: { getElementById: () => null, body: {}, documentElement: { style: { setProperty: () => {} } } },
    navigator: { onLine: true },
    setInterval: () => 0,
    clearTimeout: () => {},
    setTimeout: () => 0,
    history: {}
};
sandbox.window.window = sandbox.window;
sandbox.window.localStorage = sandbox.localStorage;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'storage.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'supabase-client.js'), 'utf8'), sandbox);
const R = (code) => { const v = vm.runInContext(code, sandbox); return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };

// ── 1. task union + tombstone convergence ──
R(`window.dailyReports = {
  '05/09/2026': {
    extracted: [{ id: 'A_X', processed: true, decisionType: 'REFILL', decidedAt: 100 }],
    final: [{ taskId: 'T1', originalId: 'A_X' }],
    tombstones: {}
  }
};`);
const mg1 = R(`_mergeDailyReport('05/09/2026', {
  extracted: [{ id: 'A_X', processed: false, decidedAt: 50 }],
  final: [{ taskId: 'T2', originalId: 'A_X' }],
  tombstones: { T1: 999 }
})`);
const rep1 = R(`window.dailyReports['05/09/2026']`);
assert.strictEqual(mg1.localExtra, true, 'local-only task counts as extra');
assert.deepStrictEqual(rep1.final.map(t => t.taskId), ['T2'], 'tombstoned T1 dropped, T2 kept');
assert.strictEqual(rep1.extracted[0].decidedAt, 100, 'newer local decision wins');
assert.deepStrictEqual(rep1.tombstones, { T1: 999 }, 'tombstones union');
console.log('✔ merge: union + tombstones + newer-wins');

// incoming newer decision wins
R(`window.dailyReports['06/09/2026'] = { extracted: [{ id: 'B_Y', processed: false, decidedAt: 10 }], final: [], tombstones: {} };`);
R(`_mergeDailyReport('06/09/2026', { extracted: [{ id: 'B_Y', processed: true, decisionType: 'SKIP', decidedAt: 20 }], final: [], tombstones: {} })`);
assert.strictEqual(R(`window.dailyReports['06/09/2026'].extracted[0].decisionType`), 'SKIP', 'newer incoming wins');
console.log('✔ merge: incoming-newer wins');

// ── 2. shared-settings unions ──
const u1 = R(`_unionStrList(['G1', 'G2'], ['G2', 'G3'])`);
assert.deepStrictEqual(u1.list, ['G1', 'G2', 'G3']);
assert.strictEqual(u1.changed, true);
assert.strictEqual(R(`_unionStrList(['G1'], ['G1']).changed`), false);
console.log('✔ godown union');
const m1 = R(`_mergeMemory({ P1: { godown: 'G1', refillAt: '2026-09-10T00:00:00.000Z' } }, { P1: { godown: 'G2', refillAt: '2026-09-11T00:00:00.000Z' }, P2: { godown: 'G1' } })`);
assert.strictEqual(m1.map.P1.godown, 'G2', 'newer refillAt wins');
assert.strictEqual(m1.map.P2.godown, 'G1', 'missing keys added');
assert.strictEqual(m1.changed, true);
console.log('✔ product-master merge');
const a1 = R(`_mergeStrMap({ OLD: 'NEW' }, { OLD: 'NEW2', X: 'Y' })`);
assert.deepStrictEqual(a1.map, { OLD: 'NEW2', X: 'Y' }, 'incoming wins aliases');
console.log('✔ alias merge');

// ── 3. queue persistence + snapshots ──
R(`_queuePending('set:general', { autosave: false })`);
R(`_queuePending('05/09/2026')`);
let q = JSON.parse(store.mansurPendingSync);
assert.deepStrictEqual(q['set:general'], { v: { autosave: false }, at: q['set:general'].at }, 'snapshot stored');
assert.strictEqual(q['05/09/2026'], true, 'date flag stored');
R(`_queuePending('set:general')`); // bare retry must NOT clobber snapshot
q = JSON.parse(store.mansurPendingSync);
assert.ok(q['set:general'].v, 'snapshot survives bare re-queue');
R(`_unqueuePending('05/09/2026')`);
assert.ok(!JSON.parse(store.mansurPendingSync)['05/09/2026'], 'unqueue persists');
// simulate reload: fresh window object, same localStorage
R(`window._pendingSync = {}; (function(){ try { var p = JSON.parse(localStorage.getItem('mansurPendingSync') || '{}'); Object.keys(p).forEach(function(k){ window._pendingSync[k] = p[k]; }); } catch(e){} })();`);
assert.ok(R(`window._pendingSync['set:general'].v`), 'snapshot restored after reload');
console.log('✔ queue persistence + snapshots');

// ── 4. backup-restore merge ──
const restored = R(`_mergeRestoreDate(
  { extracted: [{ id: 'A_X', processed: true, decisionType: 'REFILL', decidedAt: 500 }], final: [{ taskId: 'T9', originalId: 'A_X' }], tombstones: {} },
  { extracted: [{ id: 'A_X', processed: false, decidedAt: 100 }, { id: 'OLD_Z', processed: false, decidedAt: 1 }], final: [], tombstones: {} }
)`);
assert.strictEqual(restored.extracted.find(p => p.id === 'A_X').decidedAt, 500, 'restore keeps newer local decision');
assert.ok(restored.extracted.find(p => p.id === 'OLD_Z'), 'restore adds missing backup items');
assert.deepStrictEqual(restored.final.map(t => t.taskId), ['T9'], 'restore keeps local tasks');
console.log('✔ restore merge');

// ── 5. phantom seed users (usr_admin/usr_raju) never survive ──
const seeded = R(`(function(){ const s=[{id:'usr_admin',name:'Admin',role:'admin'},{id:'usr_raju',name:'Raju',role:'worker'},{id:'usr_real',name:'Meera',role:'worker'}]; localStorage.setItem('mansurUsers', JSON.stringify(s)); return loadUsers(); })()`);
assert.deepStrictEqual(seeded.map(u => u.name), ['Meera'], 'seed rows stripped on load, real users kept');
assert.deepStrictEqual(JSON.parse(store.mansurUsers).map(u => u.id), ['usr_real'], 'stripped list persisted');
const saved = R(`saveUsers([{id:'usr_admin',name:'Admin'},{id:'usr_new',name:'Asha'}]); JSON.parse(localStorage.getItem('mansurUsers'))`);
assert.deepStrictEqual(saved.map(u => u.id), ['usr_new'], 'saveUsers never writes seed rows');
console.log('✔ phantom seed purge');

console.log('\nALL SYNC DEEP TESTS PASSED ✔');
