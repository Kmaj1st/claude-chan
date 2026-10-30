import { describe, expect, it, vi } from 'vitest';
import { createMarkerStream, parseMarkers } from '../src/markers';

describe('parseMarkers edge cases', () => {
 it('applies a leading priority to the next act', () => {
 const r = parseMarkers('[priority:high][motion:bow]');
 expect(r.acts).toEqual([{ priority: 'high', motion: 'bow' }]);
 });
 it('strips a priority tag with no act and emits nothing', () => {
 const r = parseMarkers('hi [priority:high]');
 expect(r.text).toBe('hi ');
 expect(r.acts).toEqual([]);
 });
 it('leaves uppercase and unknown keys untouched', () => {
 const s = 'a [Motion:wave] b [color:red] c';
 expect(parseMarkers(s)).toEqual({ text: s, acts: [], moods: [] });
 });
 it('keeps order of several acts and moods', () => {
 const r = parseMarkers('[motion:wave][mood:shy][motion:nod][mood:happy]');
 expect(r.acts).toEqual([{ motion: 'wave' }, { motion: 'nod' }]);
 expect(r.moods).toEqual(['shy', 'happy']);
 expect(r.text).toBe('');
 });
 it('does not treat markdown links as tags', () => {
 const s = 'see docs and [1]';
 expect(parseMarkers(s).text).toBe(s);
 });
});

describe('createMarkerStream edge cases', () => {
 it('releases a long unterminated bracket as text', () => {
 const s = createMarkerStream(() => {});
 const long = '[' + 'x'.repeat(60);
 expect(s.push(long) + s.flush()).toBe(long);
 });
 it('emits acts exactly once per tag', () => {
 const onAct = vi.fn();
 const s = createMarkerStream(onAct);
 s.push('[motion:wave]'); s.push('text'); s.flush();
 expect(onAct).toHaveBeenCalledTimes(1);
 });
 it('forwards moods to the mood callback', () => {
 const onMood = vi.fn();
 const s = createMarkerStream(() => {}, onMood);
 expect(s.push('a[mood:shy]b')).toBe('ab');
 expect(onMood).toHaveBeenCalledWith('shy');
 });
 it('handles one character per chunk', () => {
 const onAct = vi.fn();
 const s = createMarkerStream(onAct);
 const out = Array.from('Hi [motion:wave]!').map((c) => s.push(c)).join('') + s.flush();
 expect(out).toBe('Hi !');
 expect(onAct).toHaveBeenCalledWith({ motion: 'wave' });
 });
});
