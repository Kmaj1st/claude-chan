import { AGENT_STATES, EXPRESSIONS, MOODS, MOTIONS, applyState, parseCommand, runCommand, type ActRequest, type AgentState, type ClaudeChanElement } from '../src/index';
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
 write('> claude_chan_set_state ' + s);
 if (el.controller) applyState(el.controller, s as AgentState);
 });
 states.appendChild(b);
}

// Raw tool-call console: accepts {tool, args} or a bare act request; validated like the real bridge.
function runCall(raw: string): void {
 const v = JSON.parse(raw) as Record<string, unknown>;
 const wrapped = typeof v.tool === 'string';
 const args = wrapped ? v.args : v;
 const parsed = parseCommand(wrapped ? v.tool : 'claude_chan_act', args);
 if (!parsed.ok) {
 write('! ' + parsed.error);
 return;
 }
 write('> ' + parsed.command.tool + ' ' + JSON.stringify(args ?? {}));
 const res = el.controller ? runCommand(el.controller, parsed.command) : undefined;
 write('< ' + JSON.stringify(res ?? null));
}

const text = document.getElementById('text') as HTMLInputElement;
document.getElementById('say')?.addEventListener('click', () => act({ say: text.value }));
document.getElementById('stop')?.addEventListener('click', () => el.controller?.stop());
document.getElementById('run')?.addEventListener('click', () => {
 try {
 runCall((document.getElementById('call') as HTMLInputElement).value);
 } catch (e) {
 write('! invalid JSON: ' + String(e));
 }
});

// Live2D: model and core-url are read at mount; changing them remounts the element.
const modelIn = document.getElementById('model') as HTMLInputElement;
const coreIn = document.getElementById('core') as HTMLInputElement;
const exprIn = document.getElementById('expr') as HTMLInputElement;
const loadModel = (model: string, core: string, expr = ''): void => {
 if (expr) el.setAttribute('expressions', expr);
 else el.removeAttribute('expressions');
 if (core) el.setAttribute('core-url', core);
 else el.removeAttribute('core-url');
 if (model) el.setAttribute('model', model);
 else el.removeAttribute('model');
 write(model ? 'model = ' + model + (core ? ' (core ' + core + ')' : '') : 'model cleared');
};
document.getElementById('load-model')?.addEventListener('click', () => loadModel(modelIn.value.trim(), coreIn.value.trim(), exprIn.value.trim()));
document.getElementById('clear-model')?.addEventListener('click', () => {
 modelIn.value = '';
 loadModel('', coreIn.value.trim(), exprIn.value.trim());
});
// Deep link: ?model=...&core=...&expressions={"smile":"f01"}
const q = new URLSearchParams(location.search);
if (q.get('model')) {
 modelIn.value = q.get('model') as string;
 coreIn.value = q.get('core') ?? '';
 exprIn.value = q.get('expressions') ?? '';
 loadModel(modelIn.value, coreIn.value, exprIn.value);
}

// Switching the renderer remounts the element (attributes are read once at mount).
document.getElementById('renderer')?.addEventListener('change', (e) => {
 el.setAttribute('renderer', (e.target as HTMLSelectElement).value);
 write('renderer = ' + (e.target as HTMLSelectElement).value);
});

// Layout: position, size and draggable are attributes of the element.
const setAttr = (name: string, value: string): void => {
 el.setAttribute(name, value);
 write(name + ' = ' + value);
};
document.getElementById('position')?.addEventListener('change', (e) => setAttr('position', (e.target as HTMLSelectElement).value));
document.getElementById('size')?.addEventListener('change', (e) => setAttr('size', (e.target as HTMLInputElement).value));
document.getElementById('draggable')?.addEventListener('change', (e) => setAttr('draggable', String((e.target as HTMLInputElement).checked)));

// Element events (re-dispatched by <claude-chan> on every mount): shows model load and mount failures.
const errText = (d: { message?: string; cause?: unknown } | undefined): string => {
 const c = d?.cause;
 return (d?.message ?? 'error') + (c ? ': ' + (c instanceof Error ? c.message : String(c)) : '');
};
el.addEventListener('ready', () => write('* ready'));
el.addEventListener('error', (e) => write('! error ' + errText((e as unknown as CustomEvent).detail)));
el.addEventListener('motionstart', (e) => write('* motionstart ' + JSON.stringify((e as CustomEvent).detail)));
el.addEventListener('motionend', (e) => write('* motionend ' + JSON.stringify((e as CustomEvent).detail)));

// Lip-sync: the mouth follows the level of the chosen audio file; the button returns to text-length lip-sync.
const audio = document.getElementById('audio') as HTMLAudioElement;
document.getElementById('audio-file')?.addEventListener('change', (e) => {
 const f = (e.target as HTMLInputElement).files?.[0];
 if (!f) return;
 if (audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src);
 audio.src = URL.createObjectURL(f);
 write('> lipSync(audio) ' + f.name);
 el.controller?.lipSync(audio);
 void audio.play().catch(() => write('! press play on the audio control'));
});
document.getElementById('lip-stop')?.addEventListener('click', () => {
 audio.pause();
 write('> lipSync(null)');
 el.controller?.lipSync(null);
});
