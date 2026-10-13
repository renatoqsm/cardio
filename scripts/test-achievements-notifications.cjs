const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');
process.loadEnvFile(path.join(__dirname, '../.env.local'));
if (!['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)) throw Error('Local database required');
if (process.env.PUSH_DELIVERY_ENABLED !== 'false') throw Error('Disable local push delivery before using fixture endpoints');
const pool = new Pool({ connectionString: process.env.DATABASE_URL }), base = 'http://localhost:3000';
const people = [], groups = [], photos = [];
let checks = 0;
const check = (value, label) => { assert(value, label); checks++; console.log('PASS:', label); };
const request = (route, person, body, origin = base) => fetch(base + route, {
  method: body ? 'POST' : 'GET', headers: { Origin: origin, Cookie: person?.cookie ?? '', 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}),
});
async function signup(name) {
  const r = await request('/api/auth/sign-up/email', null, { name, email: crypto.randomUUID() + '@example.test', password: crypto.randomUUID() }); assert(r.ok);
  const person = { id: (await r.json()).user.id, cookie: r.headers.getSetCookie().map(c => c.split(';')[0]).join('; ') }; people.push(person); return person;
}
const subscription = () => { const pair = crypto.createECDH('prime256v1'); pair.generateKeys(); return { endpoint: 'https://fcm.googleapis.com/fcm/send/' + crypto.randomUUID(), keys: { p256dh: pair.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } }; };
async function main() {
  check((await request('/api/achievements')).status === 401, 'Certifications require login');
  check((await request('/api/notifications')).status === 401, 'Preferences require login');
  check((await request('/api/internal/push', null, {})).status === 401, 'Internal dispatch requires its job secret');
  const owner = await signup('Medal owner'), peer = await signup('Medal peer'), outsider = await signup('Medal outsider');
  let data = await (await request('/api/achievements', owner)).json();
  check(data.totalCount === 40 && data.earnedCount === 0 && data.medals.length === 0, 'Forty certifications start locked');
  const cardioId = crypto.randomUUID(), strengthId = crypto.randomUUID();
  for (const [id, mode, date, minutes, km] of [[cardioId, 'cardio', '2026-10-01', 120, 25], [strengthId, 'strength', '2026-10-01', 0, 0], [crypto.randomUUID(), 'cardio', '2099-10-01', 12000, 1000]]) {
    await pool.query(`INSERT INTO cardio_record (id,"userId",modality,"recordDate",minutes,kilometers,"activityType","proofPathname","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$3,'fixture',now())`, [id, owner.id, mode, date, minutes, km]);
  }
  data = await (await request('/api/achievements?userId=' + outsider.id, owner)).json();
  check(data.medals.length === 2 && data.medals.find(m => m.modality === 'cardio').level === 3, 'Only highest medal of each modality is worn; future records excluded');
  check(data.achievements.find(a => a.id === 'cardioSessions-1').earned, 'First cardio session earns a certification');
  check(data.achievements.find(a => a.id === 'strengthWeeks-1').earned, 'Active strength week certified without daily streak pressure');
  check((await (await request('/api/achievements', peer)).json()).earnedCount === 0, 'Certifications never expose another account history');
  const profile = await (await request('/api/profile', owner)).json();
  check(profile.achievements.earnedCount === data.earnedCount, 'Profile includes complete certification gallery');
  for (let i = 0; i < 2; i++) {
    const response = await request('/api/challenges', owner, { action: 'create', name: 'Notification fixture ' + i, modality: 'cardio', goalType: 'km', startDate: '2020-01-01', endDate: '2099-12-31' }); assert(response.ok);
    const group = (await response.json()).challenge; groups.push(group.id); assert((await request('/api/challenges', peer, { action: 'join', joinCode: group.joinCode })).ok);
  }
  let hub = await (await request('/api/challenges?challengeId=' + groups[0], peer)).json();
  check(hub.members.find(m => m.id === owner.id).medals.length === 2 && hub.feed.find(r => r.id === cardioId).medals.length === 2, 'Feed and members show at most two personal medals');
  const ownerSub = subscription(), peerSub = subscription(), outsiderSub = subscription();
  check((await request('/api/notifications', peer, { action: 'subscribe', subscription: peerSub })).ok, 'Installed browser subscription persists');
  check((await request('/api/notifications', peer, { action: 'subscribe', subscription: peerSub })).ok && (await pool.query('SELECT 1 FROM push_subscription WHERE "userId"=$1', [peer.id])).rowCount === 1, 'Repeated registration keeps one device');
  check((await request('/api/notifications', peer, { action: 'preferences', cardio: true, strength: false }, 'https://untrusted.example')).status === 403, 'Cross-origin notification changes rejected');
  for (const endpoint of ['http://fcm.googleapis.com/fcm/send/x', 'https://127.0.0.1/api', 'https://fcm.googleapis.com.evil.test/x', 'https://user:pass@fcm.googleapis.com/x', 'https://fcm.googleapis.com:444/x']) {
    check((await request('/api/notifications', peer, { action: 'subscribe', subscription: { ...peerSub, endpoint } })).status === 400, 'Unsafe push destination rejected: ' + new URL(endpoint).hostname);
  }
  check((await request('/api/notifications', peer, { action: 'subscribe', subscription: { ...peerSub, keys: { auth: peerSub.keys.auth, p256dh: 'bad' } } })).status === 400, 'Invalid encryption key rejected');
  assert((await request('/api/notifications', owner, { action: 'subscribe', subscription: ownerSub })).ok);
  assert((await request('/api/notifications', outsider, { action: 'subscribe', subscription: outsiderSub })).ok);
  const daily = (await (await request('/api/capture', owner)).json()).gesture;
  const form = new FormData(); form.set('file', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'notification.png');
  form.set('purpose', 'training'); form.set('captureDay', daily.captureDay); form.set('gestureId', daily.id);
  const uploaded = await fetch(base + '/api/upload', { method: 'POST', headers: { Origin: base, Cookie: owner.cookie }, body: form }); assert(uploaded.ok); const proof = await uploaded.json(); photos.push(proof.pathname);
  const body = { action: 'record', modality: 'cardio', recordDate: daily.captureDay, minutes: 30, kilometers: 5, proofPathname: proof.pathname, captureToken: proof.captureToken, submissionKey: crypto.randomUUID() };
  let response = await request('/api/challenges', owner, body); assert(response.ok, JSON.stringify(await response.clone().json())); const saved = (await response.json()).record;
  let jobs = (await pool.query('SELECT j.*,s."userId" FROM notification_outbox j JOIN push_subscription s ON s.id=j."subscriptionId" WHERE j."recordId"=$1', [saved.id])).rows;
  check(jobs.length === 1 && jobs[0].userId === peer.id, 'One notification across two shared challenges; author and outsiders excluded');
  assert((await request('/api/challenges', owner, body)).ok);
  check((await pool.query('SELECT 1 FROM notification_outbox WHERE "recordId"=$1', [saved.id])).rowCount === 1, 'Retry does not duplicate notification');
  check((await request('/api/notifications', peer, { action: 'preferences', cardio: false, strength: true })).ok, 'Cardio and strength preferences save separately');
  response = await request('/api/challenges', owner, { ...body, submissionKey: crypto.randomUUID() }); assert(response.ok); const mutedId = (await response.json()).record.id;
  check((await pool.query('SELECT 1 FROM notification_outbox WHERE "recordId"=$1', [mutedId])).rowCount === 0, 'Muted modality creates no notifications');
  check((await (await request('/api/notifications', owner)).json()).preferences.cardio === true, 'Notification preferences private to each account');
  check((await request('/api/notifications', outsider, { action: 'unsubscribe', endpoint: peerSub.endpoint })).ok && (await pool.query('SELECT 1 FROM push_subscription WHERE "userId"=$1', [peer.id])).rowCount === 1, 'Another account cannot unsubscribe someone else device');
  assert((await request('/api/notifications', outsider, { action: 'subscribe', subscription: peerSub })).ok);
  check((await pool.query('SELECT 1 FROM notification_outbox WHERE "recordId"=$1', [saved.id])).rowCount === 0, 'Switching account on a device drops old queued messages');
  assert((await request('/api/notifications', outsider, { action: 'unsubscribe', endpoint: peerSub.endpoint })).ok);
  check((await pool.query('SELECT 1 FROM push_subscription WHERE endpoint=$1', [peerSub.endpoint])).rowCount === 0, 'Disabling device removes subscription');
  const removed = await fetch(base + '/api/records?recordId=' + cardioId, { method: 'DELETE', headers: { Origin: base, Cookie: owner.cookie } }); assert(removed.ok);
  data = await (await request('/api/achievements', owner)).json();
  check(data.medals.find(m => m.modality === 'cardio').level === 2, 'Deleting training recalculates certification from remaining valid records');
  console.log(`${checks} achievement and notification checks passed.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  const ids = people.map(p => p.id);
  await pool.query('DELETE FROM record_challenge WHERE "challengeId"=ANY($1::text[])', [groups]);
  await pool.query('DELETE FROM cardio_record WHERE "userId"=ANY($1::text[])', [ids]);
  await pool.query('DELETE FROM challenge_member WHERE "challengeId"=ANY($1::text[])', [groups]);
  await pool.query('DELETE FROM challenge WHERE id=ANY($1::text[])', [groups]);
  await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [ids]);
  for (const photo of photos) { const parts = photo.split('/'); await fs.rm(path.join(__dirname, '../.data/uploads', parts[3], parts[4]), { force: true }); }
  await pool.end();
});
