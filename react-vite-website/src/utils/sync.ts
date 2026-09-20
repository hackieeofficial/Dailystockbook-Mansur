import type { DailyReport, ExtractedItem, FinalTask } from '../types';
import { logger } from '../lib/logger';

/**
 * Normalizes a DailyReport to ensure it has all required arrays/objects.
 */
export function normRep(d: any): DailyReport {
  if (!d || typeof d !== 'object') {
    return { extracted: [], final: [], tombstones: {}, _by: '?', _at: Date.now() };
  }
  const rep: DailyReport = {
    extracted: Array.isArray(d.extracted) ? d.extracted : [],
    final: Array.isArray(d.final) ? d.final : [],
    tombstones: (d.tombstones && typeof d.tombstones === 'object') ? d.tombstones : {},
    _by: d._by || '?',
    _at: d._at || Date.now()
  };
  if (d.stats) rep.stats = d.stats;
  return rep;
}

/**
 * Merge an incoming cloud copy of ONE date into what this device holds.
 */
export function mergeDailyReport(
  localObj: any,
  incomingObj: any,
  dsBuild: string
): { merged: DailyReport; localExtra: boolean } {
  const local = normRep(localObj);
  const incoming = normRep(incomingObj);

  let localExtra = false;

  // TOMBSTONES
  const tombs: Record<string, number> = { ...incoming.tombstones };
  Object.keys(local.tombstones).forEach(k => {
    if (!tombs[k]) {
      tombs[k] = local.tombstones[k];
      localExtra = true;
    }
  });

  // FINAL
  const byTask: Record<string, FinalTask> = {};
  incoming.final.forEach(t => {
    if (t && t.taskId && !tombs[t.taskId]) {
      byTask[t.taskId] = t;
    }
  });
  local.final.forEach(t => {
    if (!t || !t.taskId) return;
    if (tombs[t.taskId]) {
      localExtra = true;
      return;
    }
    if (!byTask[t.taskId]) {
      byTask[t.taskId] = t;
      localExtra = true;
    } else {
      const incT = byTask[t.taskId];
      const lt = t.updatedAt || new Date(t.refillAt || 0).getTime() || 0;
      const it = incT.updatedAt || new Date(incT.refillAt || 0).getTime() || 0;
      if (lt > it) {
        byTask[t.taskId] = t;
        localExtra = true;
      }
    }
  });
  const mergedFinal = Object.values(byTask);

  // EXTRACTED
  const localById: Record<string, ExtractedItem> = {};
  local.extracted.forEach(p => {
    if (p && p.id) localById[p.id] = p;
  });

  const incomingIds: Record<string, boolean> = {};
  const mergedExtract: ExtractedItem[] = [];

  incoming.extracted.forEach(p => {
    if (p && p.id) incomingIds[p.id] = true;
    const lp = (p && p.id) ? localById[p.id] : null;
    if (!lp) {
      mergedExtract.push(p);
      return;
    }
    const lt = lp.decidedAt || 0;
    const it = p.decidedAt || 0;
    if (lt > it) {
      localExtra = true;
      mergedExtract.push(lp);
    } else {
      mergedExtract.push(p);
    }
  });

  local.extracted.forEach(p => {
    if (p && p.id && !incomingIds[p.id]) {
      mergedExtract.push(p);
      localExtra = true;
    }
  });

  const merged: DailyReport = {
    extracted: mergedExtract,
    final: mergedFinal,
    tombstones: tombs,
    stats: mergedExtract.length > 0 ? {
      totalSkus: mergedExtract.length,
      processedSkus: mergedExtract.filter(item => item && item.processed).length,
      zeroStockSkus: mergedExtract.filter(item => item && (item.balanceQty || 0) <= 0).length
    } : (incoming.stats || local.stats),
    _by: dsBuild,
    _at: Date.now()
  };

  return { merged, localExtra };
}

/** Union merge for string lists (e.g. godowns) */
export function unionStrList(cur: any, inc: any) {
  const out: string[] = [];
  const seen: Record<string, boolean> = {};
  let changed = false;

  (Array.isArray(cur) ? cur : []).forEach(g => {
    const k = String(g);
    if (!seen[k]) { seen[k] = true; out.push(k); }
  });
  (Array.isArray(inc) ? inc : []).forEach(g => {
    const k = String(g);
    if (!seen[k]) { seen[k] = true; out.push(k); changed = true; }
  });
  if (!Array.isArray(cur)) changed = true;
  return { list: out, changed };
}

/** Merge for string maps (godown aliases) */
export function mergeStrMap(cur: any, inc: any) {
  const out: Record<string, string> = {};
  let changed = false;
  cur = (cur && typeof cur === 'object' && !Array.isArray(cur)) ? cur : {};
  inc = (inc && typeof inc === 'object' && !Array.isArray(inc)) ? inc : {};

  for (const key in cur) {
    if (Object.prototype.hasOwnProperty.call(cur, key)) {
      out[key] = cur[key];
    }
  }
  for (const key in inc) {
    if (!Object.prototype.hasOwnProperty.call(inc, key)) continue;
    if (out[key] !== inc[key]) {
      out[key] = inc[key];
      changed = true;
    }
  }
  return { map: out, changed };
}

/** Merge memory (product_master) based on refillAt timestamp */
export function mergeMemory(cur: any, inc: any) {
  const out: Record<string, any> = {};
  let changed = false;
  cur = (cur && typeof cur === 'object') ? cur : {};
  inc = (inc && typeof inc === 'object') ? inc : {};

  const getTime = (v: any) => {
    try {
      return (v && v.refillAt) ? new Date(v.refillAt).getTime() || 0 : 0;
    } catch (e) {
      logger.debug('sync', 'mergeMemory:getTime', 'Failed to parse refillAt timestamp', e);
      return 0;
    }
  };

  for (const key in cur) {
    if (Object.prototype.hasOwnProperty.call(cur, key)) {
      out[key] = cur[key];
    }
  }
  for (const key in inc) {
    if (!Object.prototype.hasOwnProperty.call(inc, key)) continue;
    if (!out[key]) {
      out[key] = inc[key];
      changed = true;
    } else if (getTime(inc[key]) > getTime(out[key])) {
      out[key] = inc[key];
      changed = true;
    }
  }
  return { map: out, changed };
}
