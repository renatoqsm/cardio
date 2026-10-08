const assert=require('node:assert/strict'),path=require('node:path'),{Pool}=require('pg');
process.loadEnvFile(path.join(__dirname,'../.env.local'));
const url=new URL(process.env.DATABASE_URL);if(!['127.0.0.1','localhost'].includes(url.hostname))throw new Error('Local database required');
const pool=new Pool({connectionString:process.env.DATABASE_URL});const base=process.env.SMOKE_URL||'http://localhost:3000';
const fs=require('node:fs/promises');const people=[],groups=[],orders=[],proofs=[];let checks=0;
const check=(v,label)=>{assert(v,label);checks++;console.log('PASS:',label)};
async function post(endpoint,body,cookie,extra={}){return fetch(new URL(endpoint,base),{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...extra},body:JSON.stringify(body)});}
async function signup(i){const response=await post('/api/auth/sign-up/email',{name:'Premium fixture '+i,email:'premium-'+crypto.randomUUID()+'@example.test',password:crypto.randomUUID()});assert.equal(response.status,200);const data=await response.json(),person={id:data.user.id,cookie:response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};people.push(person);return person;}
async function create(owner,modality){const r=await post('/api/challenges',{action:'create',modality,name:'Premium test '+crypto.randomUUID(),goalType:modality==='strength'?'checkins':'km',startDate:'2020-01-01',endDate:'2099-12-31'},owner.cookie);assert(r.ok);const group=(await r.json()).challenge;groups.push(group.id);return group;}
const join=(g,p)=>post('/api/challenges',{action:'join',joinCode:g.joinCode},p.cookie);
async function hub(p,g){const r=await fetch(base+'/api/challenges?challengeId='+g.id,{headers:{Cookie:p.cookie}});assert(r.ok);return r.json();}
async function main(){
const owner=await signup('owner'),a=await signup('a'),b=await signup('b'),c=await signup('c'),d=await signup('d'),e=await signup('e');
const group=await create(owner,'strength');for(const p of [a,b,c])assert((await join(group,p)).ok);
const results=await Promise.all([join(group,d),join(group,e)]);check(results.filter(r=>r.ok).length===1&&results.filter(r=>r.status===409).length===1,'Simultaneous joins share the final free slot');
check((await hub(owner,group)).challenges[0].memberCount===5,'Administrator included in five-person limit');
check((await join(group,a)).ok,'Existing member can retry joining a full group idempotently');
check((await post('/api/billing',{action:'checkout',challengeId:group.id,plan:'monthly'},a.cookie)).status===403,'Participant cannot purchase on administrator behalf');
const forged=await post('/api/billing',{action:'checkout',challengeId:group.id,plan:'monthly'},owner.cookie,{Origin:'https://untrusted.example'});check(forged.status===403,'Cross-origin billing request rejected');
check((await post('/api/billing/webhook',{id:'fake_event',event:'PAYMENT_CONFIRMED',payment:{id:'fake'}},null,{'asaas-access-token':'wrong'})).status===401,'Forged webhook token rejected at HTTP boundary');
const cardio=await create(owner,'cardio');check((await join(cardio,a)).status===409,'Unpaid cardio rejects invitation joins');
const daily=await (await fetch(base+'/api/capture',{headers:{Cookie:owner.cookie}})).json();
const form=new FormData();form.set('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'proof.png');form.set('purpose','training');form.set('captureDay',daily.gesture.captureDay);form.set('gestureId',daily.gesture.id);
const upload=await fetch(base+'/api/upload',{method:'POST',headers:{Cookie:owner.cookie,Origin:base},body:form});assert(upload.ok);const proof=await upload.json();proofs.push(proof.pathname);
const record={action:'record',modality:'cardio',recordDate:daily.gesture.captureDay,minutes:30,kilometers:5,pace:'',proofPathname:proof.pathname,captureToken:proof.captureToken,submissionKey:crypto.randomUUID()};
check((await post('/api/challenges',record,owner.cookie)).status===403,'Server rejects a genuine cardio proof without eligible paid challenge');
let data=await hub(owner,cardio);check(data.challenges.find(x=>x.id===cardio.id).billing.canTrain===false,'Cardio appears read-only before payment');
const orderId=crypto.randomUUID();orders.push(orderId);await pool.query(`INSERT INTO billing_order (id,"challengeId","ownerId",plan,status,"createdAt","expiresAt") VALUES ($1,$2,$3,'monthly','canceled',now(),now())`,[orderId,cardio.id,owner.id]);await pool.query(`INSERT INTO billing_payment VALUES ($1,$2,990,'paid',now()-interval '1 hour',now()+interval '1 month',now())`,[orderId+'_pay',orderId]);
const other=await create(owner,'cardio');
const firstResponse=await post('/api/challenges',record,owner.cookie);assert(firstResponse.ok);const first=await firstResponse.json();
check(first.countedChallengeIds.includes(cardio.id)&&!first.countedChallengeIds.includes(other.id),'One global cardio counts only in eligible paid challenges');
const otherOrder=crypto.randomUUID();orders.push(otherOrder);await pool.query(`INSERT INTO billing_order (id,"challengeId","ownerId",plan,status,"createdAt","expiresAt") VALUES ($1,$2,$3,'monthly','canceled',now(),now())`,[otherOrder,other.id,owner.id]);await pool.query(`INSERT INTO billing_payment VALUES ($1,$2,990,'paid',now()-interval '1 hour',now()+interval '1 month',now())`,[otherOrder+'_pay',otherOrder]);
check((await hub(owner,other)).feed.length===0,'Subscribing later cannot retroactively score a blocked record');
const second=await (await post('/api/challenges',{...record,submissionKey:crypto.randomUUID()},owner.cookie)).json();
check(second.countedChallengeIds.includes(cardio.id)&&second.countedChallengeIds.includes(other.id),'One global cardio counts across every eligible paid challenge');
check((await join(cardio,a)).ok,'Paid cardio accepts invited member without participant purchase');
const fakeIds=[];for(let i=0;i<197;i++)fakeIds.push('premium-capacity-'+orderId+'-'+i);
await pool.query(`INSERT INTO challenge_member (id,"challengeId","userId","joinedAt") SELECT x,$1,x,now() FROM unnest($2::text[]) x`,[cardio.id,fakeIds]);
const paidResults=await Promise.all([join(cardio,b),join(cardio,c)]);check(paidResults.filter(r=>r.ok).length===1&&paidResults.filter(r=>r.status===409).length===1,'Simultaneous Premium joins stop at 200');
data=await hub(owner,cardio);check(data.challenges.find(x=>x.id===cardio.id).memberCount===200,'Premium capacity counts administrator and every participant');
await pool.query(`UPDATE billing_payment SET "endsAt"=now()-interval '1 second' WHERE "orderId"=$1`,[orderId]);
data=await hub(owner,cardio);check(data.challenges.find(x=>x.id===cardio.id).memberCount===200&&!data.challenges.find(x=>x.id===cardio.id).billing.canTrain,'Expiry preserves all members and makes cardio read-only');
const third=await (await post('/api/challenges',{...record,submissionKey:crypto.randomUUID()},owner.cookie)).json();
check(third.countedChallengeIds.includes(other.id)&&!third.countedChallengeIds.includes(cardio.id),'New global record excludes expired challenge while counting in another paid one');
check((await hub(owner,cardio)).feed.length===2&&(await hub(owner,other)).feed.length===2,'Expired feed preserves its past ranking and ignores subsequent records');
check((await post('/api/challenges',{action:'leave',challengeId:cardio.id},a.cookie)).ok,'Participant can leave expired challenge');
check((await pool.query('SELECT 1 FROM challenge WHERE id=$1',[cardio.id])).rowCount===1,'Expiry and leaving never delete the challenge');
console.log(`${checks} Premium HTTP access checks passed. No real provider requests or charges.`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(async()=>{await pool.query('DELETE FROM cardio_record WHERE "userId"=ANY($1::text[])',[people.map(p=>p.id)]);for(const proof of proofs){const parts=proof.split('/');await fs.rm(path.join(__dirname,'../.data/uploads',parts[3],parts[4]),{force:true});}await pool.query('DELETE FROM record_challenge WHERE "challengeId"=ANY($1::text[])',[groups]);await pool.query('DELETE FROM billing_payment WHERE "orderId"=ANY($1::text[])',[orders]);await pool.query('DELETE FROM billing_order WHERE id=ANY($1::text[])',[orders]);await pool.query('DELETE FROM challenge_member WHERE "challengeId"=ANY($1::text[])',[groups]);await pool.query('DELETE FROM challenge WHERE id=ANY($1::text[])',[groups]);const ids=people.map(p=>p.id);await pool.query('DELETE FROM session WHERE "userId"=ANY($1::text[])',[ids]);await pool.query('DELETE FROM account WHERE "userId"=ANY($1::text[])',[ids]);await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])',[ids]);await pool.end();});
