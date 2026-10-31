import { describe, expect, it } from 'vitest';
import { definedOnly } from '../src/mount';

describe('definedOnly', () => {
 it('drops undefined values so defaults survive a spread', () => {
 const defaults = { size: 220, position: 'bottom-left', draggable: true };
 const merged = { ...defaults, ...definedOnly({ size: undefined, position: 'top-right' }) };
 expect(merged).toEqual({ size: 220, position: 'top-right', draggable: true });
 });

 it('keeps falsy but defined values', () => {
 const merged = { draggable: true, storageKey: 'k', ...definedOnly({ draggable: false, storageKey: false }) };
 expect(merged).toEqual({ draggable: false, storageKey: false });
 });

 it('returns an empty object for empty input', () => {
 expect(definedOnly({})).toEqual({});
 });
});
