const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const project = path.resolve(__dirname, '..');
const safe = 'export const production = {};\nexport const development = {};\nexport const test = {};\n';
const file = path.join(project, '.open-next/cloudflare/next-env.mjs');
if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== safe) {
  console.error('Run pnpm build:cloudflare before deploying. Embedded environment defaults are not allowed.');
  process.exit(1);
}
const result = spawnSync(process.execPath, [path.join(path.dirname(require.resolve('@opennextjs/cloudflare')), '../cli/index.js'), 'deploy'], { cwd: project, stdio: 'inherit' });
process.exit(result.status ?? 1);
