const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
process.loadEnvFile(path.join(__dirname, '../.env.local'));
if (process.env.SUPABASE_URL || process.env.STORAGE_BACKEND === 'supabase') throw new Error('Run smoke tests against local storage only; remote cleanup is not supported.');
const base = process.env.SMOKE_URL || process.env.BETTER_AUTH_URL;
const users = [];
const challenges = [];
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; console.log('PASS:', message); }
async function request(url, options = {}, cookie) {
  const headers = new Headers(options.headers);
  headers.set('Origin', base);
  if (cookie) headers.set('Cookie', cookie);
  return fetch(new URL(url, base), { ...options, headers });
}
const post = (url, body, cookie) => request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, cookie);
async function signup(name) {
  const email = `smoke-${crypto.randomUUID()}@example.test`;
  const password = crypto.randomBytes(18).toString('hex');
  const response = await post('/api/auth/sign-up/email', { name, email, password });
  check(response.status === 200, 'Signup ' + name);
  const json = await response.json();
  const user = { id: json.user.id, email, password, cookie: response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ') };
  users.push(user);
  return user;
}
async function main() {
  const page = await request('/');
  check(page.ok && (await page.text()).includes('Entre no seu ritmo.'), 'Login page rendered');
  check((await request('/api/challenges')).status === 401, 'Anonymous challenges denied');
  const owner = await signup('Owner');
  const member = await signup('Member');
  const outsider = await signup('Outsider');
  const login = await post('/api/auth/sign-in/email', { email: owner.email, password: owner.password });
  check(login.ok, 'Email/password login');
  owner.cookie = login.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  const created = await post('/api/challenges', { action: 'create', name: 'Smoke test', goalType: 'km', startDate: '2020-01-01', endDate: '2099-12-31' }, owner.cookie);
  check(created.ok, 'Challenge creation');
  const challenge = (await created.json()).challenge;
  challenges.push(challenge.id);
  check((await post('/api/challenges', { action: 'join', joinCode: challenge.joinCode }, member.cookie)).ok, 'Join by invitation code');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  const form = new FormData(); form.set('file', new Blob([png], { type: 'image/png' }), 'proof.png');
  check((await request('/api/upload', { method: 'POST', body: form })).status === 401, 'Anonymous upload denied');
  const invalid = new FormData(); invalid.set('file', new Blob(['not an image'], { type: 'image/png' }), 'fake.png');
  check((await request('/api/upload', { method: 'POST', body: invalid }, owner.cookie)).status === 400, 'Disguised non-image rejected');
  const upload = await request('/api/upload', { method: 'POST', body: form }, owner.cookie);
  check(upload.ok, 'Local image upload');
  const { pathname } = await upload.json();
  const record = { action: 'record', recordDate: '2026-10-07', minutes: 30, kilometers: 5, proofPathname: pathname };
  const saved = await post('/api/challenges', record, owner.cookie);
  check(saved.ok, `Cardio record saved${saved.ok ? '' : ': ' + (await saved.json()).error}`);
  check((await post('/api/challenges', { ...record, minutes: 40 }, owner.cookie)).ok, 'Daily record updated');
  check((await post('/api/challenges', record, member.cookie)).status === 400, 'Another user cannot claim proof');
  const feed = await request('/api/challenges?challengeId=' + challenge.id, {}, member.cookie);
  const data = await feed.json();
  check(feed.ok && data.feed.length === 1 && data.feed[0].minutes === 40, `Member feed contains updated record exactly once (status ${feed.status}, records ${data.feed?.length}, minutes ${data.feed?.[0]?.minutes})`);
  check(data.leaderboard.find(p => p.id === owner.id)?.kilometers === 5, 'Leaderboard totals match record');
  for (const [label, cookie, status] of [['Owner', owner.cookie, 200], ['Member', member.cookie, 200], ['Outsider', outsider.cookie, 404], ['Anonymous', undefined, 401]]) {
    const proof = await request(pathname, {}, cookie);
    check(proof.status === status, label + ' image access');
    if (status === 200) check(Buffer.from(await proof.arrayBuffer()).equals(png), label + ' image bytes preserved');
  }
  check((await request(`/api/proofs/${owner.id}/invalid.png`, {}, owner.cookie)).status === 404, 'Invalid proof filename rejected');
  check((await request('/api/challenges?challengeId=' + challenge.id, { method: 'DELETE' }, member.cookie)).status === 403, 'Member cannot delete owner challenge');
  check((await request('/api/challenges?challengeId=' + challenge.id, { method: 'DELETE' }, owner.cookie)).ok, 'Owner can delete challenge');
  const logout = await post('/api/auth/sign-out', {}, owner.cookie);
  check(logout.ok && (await request('/api/challenges', {}, owner.cookie)).status === 401, 'Logout invalidates session');
  console.log(`${checks} functional checks passed.`);
}
async function cleanup() {
  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const ids = users.map(u => u.id);
    await client.query('DELETE FROM cardio_record WHERE "userId"=ANY($1)', [ids]);
    await client.query('DELETE FROM challenge_member WHERE "userId"=ANY($1) OR "challengeId"=ANY($2)', [ids, challenges]);
    await client.query('DELETE FROM challenge WHERE id=ANY($1)', [challenges]);
    for (const table of ['session', 'account']) await client.query(`DELETE FROM "${table}" WHERE "userId"=ANY($1)`, [ids]);
    await client.query('DELETE FROM "user" WHERE id=ANY($1)', [ids]);
    for (const id of ids) {
      assert.match(id, /^[A-Za-z0-9_-]+$/);
      await fs.rm(path.join(process.env.UPLOAD_DIR || path.join(__dirname, '../.data/uploads'), id), { recursive: true, force: true });
    }
  } finally { await client.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => cleanup().catch(error => { console.error('Cleanup failed:', error.message); process.exitCode = 1; }));
