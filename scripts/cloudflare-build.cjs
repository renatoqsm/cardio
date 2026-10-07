const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const project = path.resolve(__dirname, '..');
const cli = path.join(path.dirname(require.resolve('@opennextjs/cloudflare')), '../cli/index.js');
const local = path.join(project, '.local');
fs.mkdirSync(local, { recursive: true });
const result = spawnSync(process.execPath, [cli, 'build'], {
  cwd: project, stdio: 'inherit', env: {
    ...process.env,
    XDG_CONFIG_HOME: path.join(local, 'config'),
    WRANGLER_LOG_PATH: path.join(local, 'wrangler.log'),
    WRANGLER_SEND_METRICS: 'false',
  },
});
if (result.status !== 0 || result.error) process.exit(result.status || 1);
// OpenNext copies .env file values into this generated module. Credentials
// must come exclusively from Worker runtime secrets, never from build files.
const file = path.join(project, '.open-next/cloudflare/next-env.mjs');
fs.writeFileSync(file, 'export const production = {};\nexport const development = {};\nexport const test = {};\n');
console.log('Worker built; embedded environment defaults removed. Configure runtime variables in Cloudflare.');
