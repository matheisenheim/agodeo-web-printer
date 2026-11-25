import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const jsDir = new URL('../js/', import.meta.url).pathname;
const files = readdirSync(jsDir)
  .filter((f) => f.endsWith('.js'))
  .map((f) => `${jsDir}${f}`);

for (const f of files) {
  execFileSync(process.execPath, ['--check', f], { stdio: 'inherit' });
  console.log(`syntaxe OK : ${f}`);
}
console.log(`${files.length} fichiers verifies`);
