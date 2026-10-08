const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { createRequire, Module } = require('node:module');
const project = path.resolve(__dirname, '..');
const local = path.join(project, '.local');
const req = createRequire(path.join(project, 'package.json'));
fs.mkdirSync(local, { recursive: true, mode: 0o700 });
const envFile = path.join(project, '.env.local');
if (!fs.existsSync(envFile)) {
  const password = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(path.join(local, 'pg-password'), password, { mode: 0o600 });
  fs.writeFileSync(envFile, `DATABASE_URL=postgresql://cardio:${password}@127.0.0.1:54329/cardio\nBETTER_AUTH_URL=http://localhost:3000\nBETTER_AUTH_SECRET=${crypto.randomBytes(48).toString('hex')}\nNEXT_TELEMETRY_DISABLED=1\n`, { mode: 0o600 });
}
process.loadEnvFile(envFile);
const database = new URL(process.env.DATABASE_URL);
const managed = database.hostname === '127.0.0.1' && database.port === '54329';
function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(binary)} failed (${result.status})`);
}
async function main() {
  if (managed) {
    const bin = path.join(local, 'tools/node_modules/@embedded-postgres/linux-x64/native/bin');
    const data = path.join(local, 'postgres');
    const passwordFile = path.join(local, 'pg-password');
    if (!fs.existsSync(path.join(data, 'PG_VERSION'))) {
      if (!fs.existsSync(passwordFile)) fs.writeFileSync(passwordFile, decodeURIComponent(database.password), { mode: 0o600 });
      run(path.join(bin, 'initdb'), ['-D', data, '-U', decodeURIComponent(database.username), '--pwfile=' + passwordFile, '--auth=scram-sha-256', '--locale=C', '--encoding=UTF8']);
    }
    if (spawnSync(path.join(bin, 'pg_ctl'), ['-D', data, 'status'], { stdio: 'ignore' }).status !== 0) {
      run(path.join(bin, 'pg_ctl'), ['-D', data, '-l', path.join(local, 'postgres.log'), '-o', `-h 127.0.0.1 -p 54329 -k ${local}`, '-w', 'start']);
    }
  }
  const { Client } = req('pg');
  if (managed) {
    const adminUrl = new URL(database); adminUrl.pathname = '/postgres';
    const admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    const name = database.pathname.slice(1);
    if (!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount) await admin.query('CREATE DATABASE "' + name.replaceAll('"', '""') + '"');
    await admin.end();
  }
  const ts = req('typescript');
  const schemaPath = path.join(project, 'lib/db/schema.ts');
  const compiled = ts.transpileModule(fs.readFileSync(schemaPath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = new Module(schemaPath); mod.filename = schemaPath; mod.paths = Module._nodeModulePaths(path.dirname(schemaPath)); mod._compile(compiled, schemaPath);
  const { getTableConfig, PgTable } = req('drizzle-orm/pg-core');
  const { is } = req('drizzle-orm');
  const quote = x => '"' + x.replaceAll('"', '""') + '"';
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const table of Object.values(mod.exports).filter(x => is(x, PgTable))) {
      const config = getTableConfig(table);
      const columns = config.columns.map(c => `${quote(c.name)} ${c.getSQLType()}${c.primary ? ' PRIMARY KEY' : ''}${c.notNull ? ' NOT NULL' : ''}${c.isUnique ? ' UNIQUE' : ''}`);
      for (const constraint of config.uniqueConstraints) columns.push(`UNIQUE (${constraint.columns.map(c => quote(c.name)).join(', ')})`);
      await client.query(`CREATE TABLE IF NOT EXISTS ${quote(config.name)} (${columns.join(', ')});`);
    }
    for (const file of fs.readdirSync(path.join(project, 'supabase/migrations')).filter(file => file.endsWith('.sql')).sort()) {
      await client.query(fs.readFileSync(path.join(project, 'supabase/migrations', file), 'utf8'));
    }
    await client.query('COMMIT');
    console.log('PostgreSQL ready; application schema and migrations applied. Existing data preserved.');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { await client.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
