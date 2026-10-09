import { readFileSync, writeFileSync } from 'node:fs';
const [inp, out] = process.argv.slice(2);
writeFileSync(out, readFileSync(inp, 'utf8').replace(/%%(.+?)%%/g, (_, p) => readFileSync(p).toString('base64')));
