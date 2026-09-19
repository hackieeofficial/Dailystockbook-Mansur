import { describe, it, expect } from 'vitest';
import { mergeDailyReport, normRep, unionStrList } from './sync';

describe('sync utility', () => {
  describe('normRep', () => {
    it('normalizes empty objects', () => {
      const res = normRep(null);
      expect(res.extracted).toEqual([]);
      expect(res.final).toEqual([]);
      expect(res.tombstones).toEqual({});
    });
  });

  describe('mergeDailyReport', () => {
    it('merges extracted lists by decidedAt, newer wins', () => {
      const local = {
        extracted: [{ id: '1', decidedAt: 200, refillStatus: 'REFILLED' }]
      };
      const incoming = {
        extracted: [{ id: '1', decidedAt: 100, refillStatus: 'SKIPPED' }]
      };
      
      const { merged, localExtra } = mergeDailyReport(local, incoming, 'v1');
      expect(merged.extracted[0].refillStatus).toBe('REFILLED');
      expect(localExtra).toBe(true);
    });

    it('incoming wins if tied', () => {
      const local = {
        extracted: [{ id: '1', decidedAt: 100, refillStatus: 'SKIPPED' }]
      };
      const incoming = {
        extracted: [{ id: '1', decidedAt: 100, refillStatus: 'REFILLED' }]
      };
      
      const { merged, localExtra } = mergeDailyReport(local, incoming, 'v1');
      expect(merged.extracted[0].refillStatus).toBe('REFILLED');
      expect(localExtra).toBe(false);
    });

    it('filters out tombstoned final tasks', () => {
      const local = {
        final: [{ taskId: 't1', status: 'Pending' }],
        tombstones: { t1: 1000 }
      };
      const incoming = {
        final: [{ taskId: 't1', status: 'Completed' }], // trying to update a deleted task
        tombstones: {}
      };

      const { merged, localExtra } = mergeDailyReport(local, incoming, 'v1');
      expect(merged.final.length).toBe(0); // t1 stays dead
      expect(merged.tombstones['t1']).toBe(1000); // tombstone is preserved
      expect(localExtra).toBe(true); // because local had tombstone that incoming didn't
    });
  });

  describe('unionStrList', () => {
    it('unions two lists without duplicates', () => {
      const res = unionStrList(['A', 'B'], ['B', 'C']);
      expect(res.list).toEqual(['A', 'B', 'C']);
      expect(res.changed).toBe(true);
    });
  });
});
