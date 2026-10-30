import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDispatcher } from '../server/dispatch';

describe('dispatcher', () => {
 beforeEach(() => {
 vi.useFakeTimers();
 vi.setSystemTime(1000000);
 });
 afterEach(() => vi.useRealTimers());

 function make(rate?: number) {
 const sent: any[] = [];
 const d = createDispatcher({ broadcast: (m: unknown) => (sent.push(m), 2) }, rate);
 return { d, sent };
 }

 it('broadcasts valid calls with increasing ids and reports delivered', () => {
 const { d, sent } = make();
 expect(d('claude_chan_say', { text: 'a' })).toEqual({ ok: true, result: { delivered: 2 } });
 d('claude_chan_say', { text: 'b' });
 expect(sent.map((m) => m.id)).toEqual([1, 2]);
 expect(sent[0].type).toBe('claude-chan');
 });

 it('list_motions answers locally without broadcasting or rate use', () => {
 const { d, sent } = make(1);
 for (let i = 0; i < 5; i++) expect(d('claude_chan_list_motions', {}).ok).toBe(true);
 expect(sent).toHaveLength(0);
 expect(d('claude_chan_say', { text: 'x' }).ok).toBe(true);
 });

 it('rejects unknown tools and invalid args', () => {
 const { d, sent } = make();
 expect(d('nope', {}).ok).toBe(false);
 expect(d('claude_chan_say', { text: '' }).ok).toBe(false);
 expect(sent).toHaveLength(0);
 });

 it('rate limits per second and recovers after the window', () => {
 const { d, sent } = make(3);
 for (let i = 0; i < 3; i++) expect(d('claude_chan_say', { text: 'x' }).ok).toBe(true);
 const r = d('claude_chan_say', { text: 'x' });
 expect(r).toEqual({ ok: false, error: 'rate limit exceeded' });
 expect(sent).toHaveLength(3);
 vi.advanceTimersByTime(1001);
 expect(d('claude_chan_say', { text: 'x' }).ok).toBe(true);
 });
});
