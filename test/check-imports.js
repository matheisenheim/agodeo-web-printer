import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const jsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'js');
const files = readdirSync(jsDir).filter((f) => f.endsWith('.js'));
let errors = 0;

for (const f of files) {
  const src = readFileSync(join(jsDir, f), 'utf8');
  const importRe = /import\s+(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRe.exec(src))) {
    const target = m[3];
    if (!target.startsWith('.')) continue;
    const targetPath = join(jsDir, target);
    if (!existsSync(targetPath)) {
      console.log(`FAIL ${f}: module introuvable ${target}`);
      errors++;
      continue;
    }
    const targetSrc = readFileSync(targetPath, 'utf8');
    const exportRe = /export\s+(?:async\s+)?(?:const|function|class|let|var)\s+([A-Za-z_$][\w$]*)/g;
    const exports = new Set();
    let em;
    while ((em = exportRe.exec(targetSrc))) exports.add(em[1]);
    if (/export\s+default/.test(targetSrc)) exports.add('default');
    if (m[1]) {
      if (!exports.has('default')) {
        console.log(`FAIL ${f}: '${m[1]}' importe en default depuis ${target} qui n'a pas de export default`);
        errors++;
      }
    }
    if (m[2]) {
      for (const name of m[2].split(',').map((s) => s.trim()).filter(Boolean)) {
        const clean = name.split(/\s+as\s+/)[0].trim();
        if (!exports.has(clean)) {
          console.log(`FAIL ${f}: '${clean}' importe depuis ${target} mais n'y est pas exporte`);
          errors++;
        }
      }
    }
  }
}

if (errors) {
  console.log(`${errors} erreur(s) d'import`);
  process.exit(1);
}
console.log(`imports/exports OK (${files.length} fichiers scannes)`);
