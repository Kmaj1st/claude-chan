import { defineClaudeChan } from './element';
import { mount } from './mount';

export * from './types';
export { mount, defineClaudeChan };
export { ClaudeChanElement } from './element';

// Vanilla namespace: ClaudeChan.mount(el, options).
export const ClaudeChan = { mount };

defineClaudeChan();
