// Bundles the game into one self-contained pin-high.html that opens straight
// from disk (browsers won't load ES modules from file:// pages).
// Run from the project folder with: node tools/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';

// Dependencies first. Top-level names must be unique across these files.
const ORDER = ['gen/course-generator', 'gen/course-map', 'gen/terrain', 'gen/course', 'gen/weather', 'gen/course-list',
  'assets', 'font', 'logo', 'styles', 'world', 'render', 'physics', 'sprites', 'audio', 'main'];

const code = ORDER.map((name) => {
  const src = readFileSync(`src/${name}.js`, 'utf8')
    .replace(/^import [\s\S]*? from .*;\n/gm, '')
    .replace(/^export \{[^}]*\};\n/gm, '')
    .replace(/^export /gm, '');
  return `// ---- ${name}.js ----\n${src}`;
}).join('\n');

const html = readFileSync('index.html', 'utf8')
  .replace('<script type="module" src="src/main.js"></script>', () => `<script>\n(() => {\n${code}\n})();\n</script>`);
writeFileSync('pin-high.html', html);
console.log(`pin-high.html: ${(html.length / 1024).toFixed(0)} KB`);
