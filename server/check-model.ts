import { checkModel } from './modelcheck';

const dir = process.argv[2];
if (!dir) {
 console.error('usage: npm run check:model -- <model-folder>');
 process.exit(2);
}
const r = checkModel(dir);
for (const w of r.warnings) console.log('WARN ' + w);
for (const e of r.errors) console.log('ERROR ' + e);
console.log(r.errors.length ? 'FAIL: ' + r.errors.length + ' error(s)' : 'OK: model folder passes');
process.exit(r.errors.length ? 1 : 0);
