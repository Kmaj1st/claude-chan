import { afterEach, describe, expect, it, vi } from 'vitest';

const shellDestroy = vi.fn();
const createPuppet = vi.fn();

vi.mock('../src/host', () => ({
 createShell: () => ({
 stage: { appendChild: vi.fn() },
 setBubble: vi.fn(),
 destroy: shellDestroy,
 }),
}));
vi.mock('../src/renderer-select', () => ({ createPuppet: (...a: unknown[]) => createPuppet(...a) }));

import { mount } from '../src/mount';

describe('mount cleanup', () => {
 afterEach(() => {
 vi.unstubAllGlobals();
 shellDestroy.mockClear();
 createPuppet.mockReset();
 });

 it('destroys the shell and rethrows when createPuppet throws', () => {
 vi.stubGlobal('document', {});
 createPuppet.mockImplementation(() => {
 throw new Error('no model');
 });
 expect(() => mount({} as HTMLElement, { renderer: 'live2d' })).toThrow('no model');
 expect(shellDestroy).toHaveBeenCalledTimes(1);
 });
});
