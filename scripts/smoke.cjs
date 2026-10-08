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
  const manifest = await (await request('/manifest.webmanifest')).json();
  check(manifest.display === 'standalone' && manifest.start_url === '/' && manifest.scope === '/', 'Install manifest opens app in standalone mode');
  for (const icon of manifest.icons) {
    const image = await request(icon.src);
    check(image.ok && image.headers.get('content-type')?.includes('image/png'), 'Install icon available: ' + icon.sizes + ' ' + icon.purpose);
  }
  const worker = await request('/sw.js');
  check(worker.ok && worker.headers.get('cache-control')?.includes('no-store'), 'Service worker available without stale caching');
  check((await request('/offline.html')).ok, 'Public offline page available');
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
  check((await request('/api/capture')).status === 401, 'Anonymous daily gesture denied');
  const daily = await (await request('/api/capture', {}, owner.cookie)).json();
  const memberDaily = await (await request('/api/capture', {}, member.cookie)).json();
  check(daily.gesture.id === memberDaily.gesture.id && daily.gesture.captureDay === memberDaily.gesture.captureDay, 'Daily gesture is shared across members');
  form.set('purpose', 'training'); form.set('captureDay', daily.gesture.captureDay); form.set('gestureId', daily.gesture.id);
  const invalid = new FormData(); invalid.set('file', new Blob(['not an image'], { type: 'image/png' }), 'fake.png');
  check((await request('/api/upload', { method: 'POST', body: invalid }, owner.cookie)).status === 400, 'Disguised non-image rejected');
  const upload = await request('/api/upload', { method: 'POST', body: form }, owner.cookie);
  check(upload.ok, 'Local image upload');
  const { pathname, captureToken } = await upload.json(); proofs.push(pathname);
  const record = { captureToken, submissionKey: crypto.randomUUID(), action: 'record', recordDate: '2026-10-07', minutes: 30, kilometers: '5,0', pace: '6:30', proofPathname: pathname };
  const saved = await post('/api/challenges', record, owner.cookie);
  check(saved.ok, `Cardio record saved${saved.ok ? '' : ': ' + (await saved.json()).error}`);
  const publication = await saved.json();
  const first = publication.record;
  check(first.captureDay === daily.gesture.captureDay && first.gestureId === daily.gesture.id, 'Capture day and gesture stored with the workout');
  check((await post('/api/challenges', { ...record, submissionKey: crypto.randomUUID(), captureToken: undefined }, owner.cookie)).status === 400, 'Generic gallery upload cannot be used without capture proof');
  check((await post('/api/challenges', { ...record, submissionKey: crypto.randomUUID(), captureToken: captureToken + 'tampered' }, owner.cookie)).status === 400, 'Tampered capture proof rejected');
  const expiredForm = new FormData(); expiredForm.set('file', new Blob([png], { type: 'image/png' }), 'proof.png'); expiredForm.set('purpose', 'training'); expiredForm.set('captureDay', '2000-01-01'); expiredForm.set('gestureId', daily.gesture.id);
  check((await request('/api/upload', { method: 'POST', body: expiredForm }, owner.cookie)).status === 409, 'Old daily gesture cannot be submitted as current capture');
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
  const foreignCapture = await foreign.json(); const foreignPath = foreignCapture.pathname; proofs.push(foreignPath);
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
  const cardioGroups = [], strengthGroups = [];
  for (let i = 0; i < 5; i++) {
    const result = await post('/api/challenges', { action: 'create', modality: 'cardio', name: 'Cardio ' + i, goalType: 'km', startDate: '2026-10-08', endDate: '2026-10-15' }, owner.cookie);
    check(result.ok, 'Cardio challenge created ' + i); const c = (await result.json()).challenge; challenges.push(c.id); cardioGroups.push(c);
  }
  for (let i = 0; i < 3; i++) {
    const result = await post('/api/challenges', { action: 'create', modality: 'strength', name: 'Musculação ' + i, goalType: 'checkins', startDate: i === 2 ? '2026-10-16' : '2026-10-08', endDate: '2026-10-20' }, owner.cookie);
    check(result.ok, 'Strength challenge created ' + i); const c = (await result.json()).challenge; challenges.push(c.id); strengthGroups.push(c);
    check(c.modality === 'strength' && c.goalType === 'checkins', 'Strength has fixed check-in ranking ' + i);
  }
  check((await post('/api/challenges', { action: 'create', modality: 'strength', name: 'Invalid', goalType: 'km', startDate: '2026-10-08', endDate: '2026-10-15' }, owner.cookie)).status === 400, 'Strength rejects distance ranking');
  check((await post('/api/challenges', { ...settings, modality: 'strength', goalType: 'checkins' }, owner.cookie)).status === 400, 'Existing challenge modality cannot be switched');
  for (const [minutes, kilometers] of [[5, 2], [10, 3]]) {
    const response = await post('/api/challenges', { ...record, modality: 'cardio', submissionKey: crypto.randomUUID(), recordDate: '2026-10-10', minutes, kilometers }, owner.cookie);
    check(response.ok, 'Additional same-day cardio saved'); const result = await response.json();
    check(cardioGroups.every(c => result.countedChallengeIds.includes(c.id)) && strengthGroups.every(c => !result.countedChallengeIds.includes(c.id)), 'One cardio counts in all five cardio challenges and no strength challenge');
  }
  const strengthUpload = await request('/api/upload', { method: 'POST', body: form }, owner.cookie);
  check(strengthUpload.ok, 'Strength proof uploaded'); const strengthCapture = await strengthUpload.json(); const strengthPath = strengthCapture.pathname; proofs.push(strengthPath);
  check((await post('/api/challenges', { ...record, submissionKey: crypto.randomUUID(), captureToken, proofPathname: strengthPath }, owner.cookie)).status === 400, 'Capture proof bound to its exact uploaded photo');
  const strengthRecord = { captureToken: strengthCapture.captureToken, action: 'record', modality: 'strength', recordDate: '2026-10-10', proofPathname: strengthPath, description: 'Treino de pernas', minutes: 999, kilometers: 999 };
  const concurrent = await Promise.all(Array.from({ length: 3 }, () => post('/api/challenges', { ...strengthRecord, submissionKey: crypto.randomUUID() }, owner.cookie)));
  const concurrentBodies = await Promise.all(concurrent.map(r => r.json()));
  check(concurrent.filter(r => r.ok).length === 1 && concurrent.filter(r => r.status === 409).length === 2 && new Set(concurrentBodies.map(r => r.record?.id ?? r.existingRecord?.id)).size === 1, 'Concurrent strength submissions create one check-in and ask confirmation for duplicates');
  check(concurrentBodies.filter(r => r.record).every(r => strengthGroups.slice(0, 2).every(c => r.countedChallengeIds.includes(c.id)) && !r.countedChallengeIds.includes(strengthGroups[2].id) && cardioGroups.every(c => !r.countedChallengeIds.includes(c.id))), 'Strength counts in all eligible strength challenges only');
  check(concurrentBodies.filter(r => r.record).every(r => r.record.minutes === 0 && Number(r.record.kilometers) === 0 && r.record.pace === null), 'Cardio metrics cannot influence strength ranking');
  const duplicateResponse = await post('/api/challenges', { ...strengthRecord, submissionKey: crypto.randomUUID(), description: 'Must not replace' }, owner.cookie);
  const duplicate = await duplicateResponse.json();
  check(duplicateResponse.status === 409 && duplicate.code === 'STRENGTH_CHECKIN_EXISTS' && duplicate.existingRecord.id === concurrentBodies.find(r => r.record).record.id, 'Second daily check-in requires explicit replacement confirmation');
  check((await request(strengthPath, {}, member.cookie)).status === 404, 'Cardio membership does not grant strength-only proof access');
  check((await post('/api/challenges', { action: 'join', joinCode: strengthGroups[0].joinCode }, member.cookie)).ok, 'Member joins strength challenge');
  check((await request(strengthPath, {}, member.cookie)).status === 200, 'Strength membership grants strength proof access');
  const nextDay = await post('/api/challenges', { ...strengthRecord, recordDate: '2026-10-11', submissionKey: crypto.randomUUID() }, owner.cookie);
  check(nextDay.ok && !(await nextDay.json()).alreadyPublished, 'Next day permits another strength check-in');
  const memberUpload = await request('/api/upload', { method: 'POST', body: form }, member.cookie);
  check(memberUpload.ok, 'Member own strength proof upload'); const memberCapture = await memberUpload.json(); const memberPath = memberCapture.pathname; proofs.push(memberPath);
  const memberCheckin = await post('/api/challenges', { ...strengthRecord, captureToken: memberCapture.captureToken, proofPathname: memberPath, submissionKey: crypto.randomUUID() }, member.cookie);
  check(memberCheckin.ok && !(await memberCheckin.json()).alreadyPublished, 'Daily strength limit is per person');
  for (const c of strengthGroups.slice(0, 2)) {
    const data = await (await request('/api/challenges?challengeId=' + c.id, {}, owner.cookie)).json();
    const ownerRank = data.leaderboard.find(m => m.id === owner.id);
    check(ownerRank.checkIns === 2 && ownerRank.workouts === 2 && ownerRank.kilometers === 0 && ownerRank.minutes === 0 && data.feed.every(r => r.modality === 'strength'), 'Strength feed and ranking use only daily check-ins for ' + c.name);
    check(data.leaderboard[0].id === owner.id, 'Most check-ins ranks first for ' + c.name);
  }
  for (const c of cardioGroups) {
    const data = await (await request('/api/challenges?challengeId=' + c.id, {}, owner.cookie)).json();
    check(data.feed.length === 4 && data.feed.every(r => r.modality === 'cardio') && data.leaderboard[0].kilometers === 8, 'Cardio retains multiple workouts and ignores strength for ' + c.name);
  }
  const outsideStrength = await (await request('/api/challenges?challengeId=' + strengthGroups[2].id, {}, owner.cookie)).json();
  check(outsideStrength.feed.length === 0 && outsideStrength.leaderboard[0].checkIns === 0, 'Strength honors challenge period');
  check((await request('/api/records?recordDate=2026-10-10')).status === 401, 'Anonymous daily lookup denied');
  check((await request('/api/records?recordDate=2026-02-30', {}, owner.cookie)).status === 400, 'Daily lookup rejects invalid dates');
  const lookup = await (await request('/api/records?recordDate=2026-10-10', {}, owner.cookie)).json();
  check(lookup.existingRecord.id === duplicate.existingRecord.id, 'Daily lookup works independently of challenges');
  const ownMemberLookup = await (await request('/api/records?recordDate=2026-10-10', {}, member.cookie)).json();
  check(ownMemberLookup.existingRecord.id !== lookup.existingRecord.id, 'Daily lookup returns only own check-in');
  const noRecord = await (await request('/api/records?recordDate=2026-10-12', {}, owner.cookie)).json();
  check(noRecord.existingRecord === null, 'Other date does not trigger replacement');
  const replacement = { ...strengthRecord, submissionKey: crypto.randomUUID(), description: 'Treino substituído com confirmação', captureToken, proofPathname: pathname, replaceExisting: true, replaceRecordId: lookup.existingRecord.id, expectedSubmissionKey: lookup.existingRecord.submissionKey };
  const replacedResponse = await post('/api/challenges', replacement, owner.cookie);
  check(replacedResponse.ok, 'Confirmed replacement saved'); const replaced = await replacedResponse.json();
  check(replaced.record.gestureId === daily.gesture.id && replaced.record.captureDay === daily.gesture.captureDay, 'Replacement keeps new photo daily-gesture metadata');
  check(replaced.replaced && replaced.record.id === lookup.existingRecord.id && replaced.record.description === replacement.description && replaced.record.proofPathname === pathname, 'Replacement updates photo/description and preserves check-in identity/date');
  const retriedReplacement = await (await post('/api/challenges', replacement, owner.cookie)).json();
  check(retriedReplacement.replaced && retriedReplacement.alreadyPublished && retriedReplacement.record.id === replaced.record.id, 'Confirmed replacement retry is idempotent');
  const staleReplacement = await post('/api/challenges', { ...replacement, submissionKey: crypto.randomUUID(), description: 'Stale overwrite' }, owner.cookie);
  const stale = await staleReplacement.json();
  check(staleReplacement.status === 409 && stale.existingRecord.submissionKey === replacement.submissionKey, 'Stale confirmation cannot overwrite newer replacement');
  const conflicting = await Promise.all([1, 2].map(i => post('/api/challenges', { ...replacement, submissionKey: crypto.randomUUID(), description: 'Concurrent replacement ' + i, expectedSubmissionKey: replacement.submissionKey }, owner.cookie)));
  check(conflicting.filter(r => r.ok).length === 1 && conflicting.filter(r => r.status === 409).length === 1, 'Concurrent replacements require fresh consent after first update');
  const foreignReplace = await post('/api/challenges', { ...replacement, submissionKey: crypto.randomUUID(), replaceRecordId: ownMemberLookup.existingRecord.id, expectedSubmissionKey: ownMemberLookup.existingRecord.submissionKey }, owner.cookie);
  check(foreignReplace.status === 409, 'Cannot replace another person check-in');
  const memberAfter = await (await request('/api/records?recordDate=2026-10-10', {}, member.cookie)).json();
  check(memberAfter.existingRecord.submissionKey === ownMemberLookup.existingRecord.submissionKey, 'Another person check-in remains unchanged');
  check((await post('/api/challenges', { ...record, replaceExisting: true, replaceRecordId: lookup.existingRecord.id, expectedSubmissionKey: replacement.submissionKey }, owner.cookie)).status === 400, 'Cardio cannot use strength replacement');
  for (const c of strengthGroups.slice(0, 2)) {
    const data = await (await request('/api/challenges?challengeId=' + c.id, {}, owner.cookie)).json();
    check(data.leaderboard.find(m => m.id === owner.id).checkIns === 2 && data.feed.filter(r => r.userId === owner.id && r.recordDate === '2026-10-10').length === 1, 'Replacement preserves daily total in ' + c.name);
  }
  const noChallenge = await post('/api/challenges', { ...strengthRecord, captureToken: foreignCapture.captureToken, proofPathname: foreignPath, submissionKey: crypto.randomUUID() }, outsider.cookie);
  check(noChallenge.ok, 'Global strength record allowed without any challenge');
  check((await noChallenge.json()).countedChallengeIds.length === 0, 'No-challenge publication does not leak or count in other groups');
  const globalLookup = await (await request('/api/records?recordDate=2026-10-10', {}, outsider.cookie)).json();
  check(globalLookup.existingRecord?.recordDate === '2026-10-10', 'Daily duplicate lookup works without challenge membership');
  check((await post('/api/challenges', { ...record, modality: 'invalid', submissionKey: crypto.randomUUID() }, owner.cookie)).status === 400, 'Unknown record modality rejected');
  check((await post('/api/challenges', { ...strengthRecord, proofPathname: foreignPath, submissionKey: crypto.randomUUID() }, owner.cookie)).status === 400, 'Strength cannot claim another person proof');
  check((await post('/api/challenges', strengthRecord)).status === 401, 'Anonymous strength check-in denied');
  check((await request('/api/challenges?challengeId=' + challenge.id, { method: 'DELETE' }, member.cookie)).status === 403, 'Member cannot delete owner challenge');
  const leave = { action: 'leave', challengeId: challenge.id };
  check((await post('/api/challenges', leave)).status === 401, 'Anonymous cannot leave challenges');
  check((await post('/api/challenges', { action: 'leave' }, member.cookie)).status === 400, 'Leave requires a challenge');
  check((await post('/api/challenges', leave, outsider.cookie)).status === 403, 'Outsider cannot remove another membership');
  check((await post('/api/challenges', leave, owner.cookie)).status === 409, 'Administrator cannot abandon own challenge');
  check((await post('/api/challenges', leave, member.cookie)).ok, 'Participant can leave challenge');
  const afterLeave = await (await request('/api/challenges?challengeId=' + challenge.id, {}, owner.cookie)).json();
  check(afterLeave.challenges.find(c => c.id === challenge.id).memberCount === 1 && !afterLeave.members.some(m => m.id === member.id), 'Leaving removes participant from members and ranking');
  const memberGroups = await (await request('/api/challenges', {}, member.cookie)).json();
  check(!memberGroups.challenges.some(c => c.id === challenge.id) && memberGroups.challenges.some(c => c.id === strengthGroups[0].id), 'Leaving affects only selected challenge');
  check((await request(photos[0], {}, member.cookie)).status === 404, 'Former participant loses access to private challenge photo');
  check((await request(memberPath, {}, member.cookie)).ok, 'Leaving preserves participant own photo');
  check((await post('/api/challenges', { action: 'leave', challengeId: strengthGroups[0].id }, member.cookie)).ok, 'Participant can leave strength challenge');
  const retainedCheckin = await (await request('/api/records?recordDate=2026-10-10', {}, member.cookie)).json();
  check(retainedCheckin.existingRecord?.id === ownMemberLookup.existingRecord.id, 'Leaving preserves existing personal strength check-in');
  check((await request(strengthPath, {}, member.cookie)).status === 404, 'Former participant loses access to other members strength photos');
  check((await post('/api/challenges', { action: 'join', joinCode: challenge.joinCode }, member.cookie)).ok, 'Former participant can rejoin with challenge key');
  const beforeDelete = await (await request('/api/challenges?challengeId=' + cardioGroups[0].id, {}, owner.cookie)).json();
  check((await request('/api/challenges?challengeId=' + challenge.id, { method: 'DELETE' }, owner.cookie)).ok, 'Owner can delete challenge');
  const afterDelete = await (await request('/api/challenges?challengeId=' + cardioGroups[0].id, {}, owner.cookie)).json();
  check(!afterDelete.challenges.some(c => c.id === challenge.id) && afterDelete.feed.length === beforeDelete.feed.length, 'Deleting a challenge preserves workouts in other challenges');
  check((await request(pathname, {}, owner.cookie)).ok, 'Deleting a challenge preserves author photo');

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
