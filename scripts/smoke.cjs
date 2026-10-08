const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
process.loadEnvFile(path.join(__dirname, '../.env.local'));
if (process.env.SUPABASE_URL || process.env.STORAGE_BACKEND === 'supabase') throw new Error('Run smoke tests against local storage only; remote cleanup is not supported.');
const base = process.env.SMOKE_URL || process.env.BETTER_AUTH_URL;
const users = [];
const challenges = [];
const proofs = [];
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
  check(page.ok && (await page.text()).includes('Preparando seu espaço'), 'Application shell rendered');
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
  const { pathname } = await upload.json(); proofs.push(pathname);
  const record = { submissionKey: crypto.randomUUID(), action: 'record', recordDate: '2026-10-07', minutes: 30, kilometers: '5,0', pace: '6:30', proofPathname: pathname };
  const saved = await post('/api/challenges', record, owner.cookie);
  check(saved.ok, `Cardio record saved${saved.ok ? '' : ': ' + (await saved.json()).error}`);
  const publication = await saved.json();
  const first = publication.record;
  check(publication.countedChallengeIds.includes(challenge.id), 'Publication confirms challenge inclusion');
  check(Number(first.pace) === 6.5, 'Pace in minutes/seconds stored correctly');
  const retries = await Promise.all([post('/api/challenges', record, owner.cookie), post('/api/challenges', record, owner.cookie)]);
  const retried = await Promise.all(retries.map(r => r.json()));
  check(retries.every(r => r.ok) && retried.every(r => r.alreadyPublished && r.record.id === first.id), 'Concurrent retries preserve one workout');
  const second = await post('/api/challenges', { ...record, submissionKey: crypto.randomUUID(), minutes: 40, kilometers: 2, pace: '' }, owner.cookie);
  check(second.ok && (await second.json()).record.id !== first.id, 'Second same-day workout saved separately with blank pace');
  check((await post('/api/challenges', { ...record, minutes: '' }, owner.cookie)).status === 400, 'Missing minutes rejected');
  check((await post('/api/challenges', { ...record, kilometers: 'invalid' }, owner.cookie)).status === 400, 'Invalid distance rejected');
  check((await post('/api/challenges', { ...record, pace: '6:90' }, owner.cookie)).status === 400, 'Invalid pace rejected');
  check((await post('/api/challenges', record, member.cookie)).status === 400, 'Another user cannot claim proof');
  const feed = await request('/api/challenges?challengeId=' + challenge.id, {}, member.cookie);
  const data = await feed.json();
  check(feed.ok && data.feed.length === 2, 'Feed retains both same-day workouts without retry duplicates');
  const totals = data.leaderboard.find(p => p.id === owner.id);
  check(totals?.kilometers === 7 && totals.minutes === 70, 'Ranking sums both workouts: 7 km and 70 minutes');
  check(totals.workouts === 2 && totals.activeDays === 1, 'Member shows two workouts on one active day');
  check(Math.abs(totals.pace - (6.5 * 5 + 40) / 7) < 0.00001, 'Average pace weighted by distance; empty pace derived from duration');
  check(data.feed.some(r => r.pace === null) && data.feed.some(r => Number(r.pace) === 6.5), 'Both original and blank pace preserved');
  check(data.members.length === 2 && data.members.every(m => m.joinedAt) && data.members.find(m => m.id === owner.id).isOwner, 'Members include join date and administrator');
  const photos = [];
  for (let i = 0; i < 2; i++) {
    const photo = await request('/api/upload', { method: 'POST', body: form }, owner.cookie);
    check(photo.ok, 'Challenge photo upload ' + (i + 1));
    const uploaded = (await photo.json()).pathname; photos.push(uploaded); proofs.push(uploaded);
  }
  const settings = { action: 'update', challengeId: challenge.id, name: 'Nossa turma', description: 'Um passo de cada vez.', goalType: 'time', startDate: '2020-01-01', endDate: '2099-12-31', profilePathname: photos[0], coverPathname: photos[1] };
  check((await post('/api/challenges', settings, member.cookie)).status === 403, 'Only administrator can personalize challenge');
  check((await post('/api/challenges', settings, owner.cookie)).ok, 'Administrator saves avatar, cover and description');
  const personalized = await (await request('/api/challenges?challengeId=' + challenge.id, {}, member.cookie)).json();
  const c = personalized.challenges.find(c => c.id === challenge.id);
  check(c.name === settings.name && c.description === settings.description && c.profilePathname === photos[0] && c.coverPathname === photos[1], 'Members receive personalized challenge');
  check(personalized.leaderboard[0].minutes === 70 && c.memberCount === 2, 'Changing challenge metric retains correct totals and member count');
  check((await post('/api/challenges', { ...settings, startDate: '2026-02-30' }, owner.cookie)).status === 400, 'Invalid challenge calendar date rejected');
  for (const photo of photos) {
    check((await request(photo, {}, member.cookie)).status === 200, 'Member can view challenge image that is not a workout proof');
    check((await request(photo, {}, outsider.cookie)).status === 404, 'Outsider cannot view private challenge image');
    check((await request(photo)).status === 401, 'Anonymous cannot view private challenge image');
  }
  const foreign = await request('/api/upload', { method: 'POST', body: form }, outsider.cookie);
  check(foreign.ok, 'Outsider own image upload');
  const foreignPath = (await foreign.json()).pathname; proofs.push(foreignPath);
  check((await post('/api/challenges', { ...settings, profilePathname: foreignPath }, owner.cookie)).status === 400, 'Administrator cannot claim another account image');
  for (const [label, cookie, status] of [['Owner', owner.cookie, 200], ['Member', member.cookie, 200], ['Outsider', outsider.cookie, 404], ['Anonymous', undefined, 401]]) {
    const proof = await request(pathname, {}, cookie);
    check(proof.status === status, label + ' image access');
    if (status === 200) check(Buffer.from(await proof.arrayBuffer()).equals(png), label + ' image bytes preserved');
  }
  check((await request(`/api/proofs/${owner.id}/invalid.png`, {}, owner.cookie)).status === 404, 'Invalid proof filename rejected');
  const windowResponse = await post('/api/challenges', { action: 'create', name: 'Date boundaries', goalType: 'km', startDate: '2026-10-08', endDate: '2026-10-15' }, owner.cookie);
  check(windowResponse.ok, 'Date-limited challenge created');
  const windowChallenge = (await windowResponse.json()).challenge; challenges.push(windowChallenge.id);
  const before = await (await request('/api/challenges?challengeId=' + windowChallenge.id, {}, owner.cookie)).json();
  check(before.feed.length === 0 && before.leaderboard[0].kilometers === 0, 'October 7 workouts excluded from October 8 challenge');
  const retriedOutside = await (await post('/api/challenges', { ...record, recordDate: '2026-10-08' }, owner.cookie)).json();
  check(retriedOutside.alreadyPublished && !retriedOutside.countedChallengeIds.includes(windowChallenge.id), 'Retry reports inclusion using persisted workout date');
  for (const [recordDate, minutes, kilometers, included] of [['2026-10-08', 10, 1, true], ['2026-10-15', 20, 2, true], ['2026-10-16', 30, 3, false]]) {
    const result = await post('/api/challenges', { ...record, submissionKey: crypto.randomUUID(), recordDate, minutes, kilometers, pace: '' }, owner.cookie);
    check(result.ok, 'Workout saved on ' + recordDate);
    const body = await result.json();
    check(body.countedChallengeIds.includes(windowChallenge.id) === included && body.countedChallengeIds.includes(challenge.id), 'Accurate inclusion per challenge on ' + recordDate);
  }
  const bounded = await (await request('/api/challenges?challengeId=' + windowChallenge.id, {}, owner.cookie)).json();
  check(bounded.feed.length === 2 && bounded.leaderboard[0].kilometers === 3 && bounded.leaderboard[0].minutes === 30, 'Start/end inclusive; before/after dates excluded from ranking');
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
