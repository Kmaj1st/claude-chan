import { AGENT_STATES, EXPRESSIONS, MOODS, MOTIONS, applyState, type ActRequest, type AgentState, type ClaudeChanElement } from '../src/index';
import '../src/index';

const el = document.getElementById('cc') as unknown as ClaudeChanElement;
const log = document.getElementById('log') as HTMLElement;
const write = (line: string): void => {
 log.textContent += line + String.fromCharCode(10);
 log.scrollTop = log.scrollHeight;
};
const act = (req: ActRequest): void => {
 write('> claude_chan_act ' + JSON.stringify(req));
 el.controller?.act(req);
};

function buttons(id: string, names: readonly string[], make: (n: string) => ActRequest): void {
 const box = document.getElementById(id) as HTMLElement;
 for (const n of names) {
 const b = document.createElement('button');
 b.textContent = n;
 b.addEventListener('click', () => act(make(n)));
 box.appendChild(b);
 }
}
buttons('motions', MOTIONS, (n) => ({ motion: n as ActRequest['motion'], priority: 'high' }));
buttons('expressions', EXPRESSIONS, (n) => ({ expression: n as ActRequest['expression'] }));

const moods = document.getElementById('moods') as HTMLElement;
for (const m of MOODS) {
 const b = document.createElement('button');
 b.textContent = m;
 b.addEventListener('click', () => {
 write('> claude_chan_set_mood ' + m);
 el.controller?.setMood(m);
 });
 moods.appendChild(b);
}

const states = document.getElementById('states') as HTMLElement;
for (const s of AGENT_STATES) {
 const b = document.createElement('button');
 b.textContent = s;
 b.addEventListener('click', () => {
 write('> applyState ' + s);
 if (el.controller) applyState(el.controller, s as AgentState);
 });
 states.appendChild(b);
}

const text = document.getElementById('text') as HTMLInputElement;
document.getElementById('say')?.addEventListener('click', () => act({ say: text.value }));
document.getElementById('stop')?.addEventListener('click', () => el.controller?.stop());
document.getElementById('run')?.addEventListener('click', () => {
 try {
 act(JSON.parse((document.getElementById('call') as HTMLInputElement).value) as ActRequest);
 } catch (e) {
 write('! invalid JSON: ' + String(e));
 }
});

// Live2D: model and core-url are read at mount; changing them remounts the element.
const modelIn = document.getElementById('model') as HTMLInputElement;
const coreIn = document.getElementById('core') as HTMLInputElement;
const loadModel = (model: string, core: string): void => {
 if (core) el.setAttribute('core-url', core);
 else el.removeAttribute('core-url');
 if (model) el.setAttribute('model', model);
 else el.removeAttribute('model');
 write(model ? 'model = ' + model + (core ? ' (core ' + core + ')' : '') : 'model cleared');
};
document.getElementById('load-model')?.addEventListener('click', () => loadModel(modelIn.value.trim(), coreIn.value.trim()));
document.getElementById('clear-model')?.addEventListener('click', () => {
 modelIn.value = '';
 loadModel('', coreIn.value.trim());
});
// Deep link: ?model=...&core=...
const q = new URLSearchParams(location.search);
if (q.get('model')) {
 modelIn.value = q.get('model') as string;
 coreIn.value = q.get('core') ?? '';
 loadModel(modelIn.value, coreIn.value);
}

// Switching the renderer remounts the element (attributes are read once at mount).
document.getElementById('renderer')?.addEventListener('change', (e) => {
 el.setAttribute('renderer', (e.target as HTMLSelectElement).value);
 write('renderer = ' + (e.target as HTMLSelectElement).value);
});
