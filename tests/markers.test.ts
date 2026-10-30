import { describe, expect, it, vi } from 'vitest';
import { createMarkerStream, parseMarkers } from '../src/markers';

describe('parseMarkers', () => {
 it('strips valid tags and returns acts', () => {
 const r = parseMarkers('Hello [motion:wave]there[expression:smile]!');
 expect(r.text).toBe('Hello there!');
 expect(r.acts).toEqual([{ motion: 'wave' }, { expression: 'smile' }]);
 });
 it('keeps invalid tags', () => {
 expect(parseMarkers('a [motion:dance] b').text).toBe('a [motion:dance] b');
 });
 it('collects moods', () => {
 expect(parseMarkers('[mood:shy]hi').moods).toEqual(['shy']);
 });
 it('applies a trailing priority to the last act', () => {
 const r = parseMarkers('[motion:bow][priority:high]');
 expect(r.acts).toEqual([{ motion: 'bow', priority: 'high' }]);
 });
});

describe('createMarkerStream', () => {
 it('handles tags split across chunks', () => {
 const onAct = vi.fn();
 const s = createMarkerStream(onAct);
 const out = [s.push('Hi [mot'), s.push('ion:no'), s.push('d]ok'), s.flush()].join('');
 expect(out).toBe('Hi ok');
 expect(onAct).toHaveBeenCalledWith({ motion: 'nod' });
 });
 it('flushes a dangling bracket as text', () => {
 const s = createMarkerStream(() => {});
 expect(s.push('a [mot') + s.flush()).toBe('a [mot');
 });
});
