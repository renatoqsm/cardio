// Canonical provider responses are simulated; persistence uses local PostgreSQL only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {Module,createRequire}=require('node:module');const {Pool}=require('pg');
process.loadEnvFile(path.join(__dirname,'../.env.local'));
const url=new URL(process.env.DATABASE_URL);
if(!['localhost','127.0.0.1'].includes(url.hostname)) throw new Error('Local database required');
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:4});
const originalFetch=global.fetch,names=['BILLING_ENABLED','ASAAS_API_KEY','ASAAS_ENVIRONMENT'];
const saved=Object.fromEntries(names.map(k=>[k,process.env[k]]));
const modules={};
function load(name){if(modules[name])return modules[name];const file=path.join(__dirname,'../lib/billing',name+'.ts'),m=new Module(file);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));const req=createRequire(file);m.require=x=>x==='server-only'?{}:x==='@/lib/db'?{getDatabase:()=>({pool})}:x.startsWith('./')?load(x.slice(2)):req(x);m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);return modules[name]=m.exports;}
const billing=load('store');let checks=0;const check=(v,label)=>{assert(v,label);checks++;console.log('PASS:',label)};
const prefix='test_'+crypto.randomUUID().replaceAll('-',''),orderId=prefix+'_order',challengeId=prefix+'_challenge',checkoutId=prefix+'_checkout',subId=prefix+'_sub',payId=prefix+'_pay';
const due=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const subscription={id:subId,customer:prefix+'_customer',checkoutSession:checkoutId,cycle:'MONTHLY',value:9.9,status:'ACTIVE',deleted:false,nextDueDate:due};
const payment={id:payId,customer:subscription.customer,subscription:subId,checkoutSession:checkoutId,value:9.9,billingType:'CREDIT_CARD',status:'PENDING',dueDate:due,deleted:false};
const payments=new Map([[payId,payment]]);let requests=0;
async function event(id,kind,payload){return billing.processBillingEvent({id:prefix+'_'+id,event:kind,...payload})}
async function main(){
process.env.BILLING_ENABLED='true';process.env.ASAAS_API_KEY='dummy-local-test-key';process.env.ASAAS_ENVIRONMENT='sandbox';
global.fetch=async(resource,options={})=>{requests++;const u=new URL(resource);assert.equal(u.hostname,'api-sandbox.asaas.com');let body,status=200;
if(u.pathname==='/v3/subscriptions/'+subId){if(options.method==='DELETE'){subscription.deleted=true;body={id:subId,deleted:true}}else body=subscription;}
else if(u.pathname.startsWith('/v3/payments/')){body=payments.get(u.pathname.split('/').at(-1));if(!body)status=404;}
else if(u.pathname==='/v3/payments')body={data:[...payments.values()],hasMore:false};
else if(u.pathname==='/v3/checkouts/'+checkoutId+'/cancel')body={id:checkoutId,status:'CANCELED'};
else throw new Error('Unexpected mock provider path');return Response.json(body||{}, {status});};
await pool.query(`INSERT INTO billing_order (id,"challengeId","ownerId",plan,status,"checkoutId","createdAt","expiresAt") VALUES ($1,$2,$3,'monthly','pending',$4,now(),now()+interval '1 hour')`,[orderId,challengeId,prefix,checkoutId]);
await event('pending','PAYMENT_CONFIRMED',{payment:{id:payId,value:9.9,status:'CONFIRMED'}});
check(!(await billing.accessForChallenge(challengeId,'cardio',1)).premium,'Forged payload status cannot grant access while canonical payment is pending');
payment.status='CONFIRMED';await event('paid','CHECKOUT_PAID',{checkout:{id:checkoutId}});
check((await billing.accessForChallenge(challengeId,'cardio',1)).premium,'Checkout reconciles actual confirmed invoice');
const countBefore=requests;await event('paid','CHECKOUT_PAID',{checkout:{id:checkoutId}});
check(requests===countBefore&&(await pool.query('SELECT count(*)::int AS n FROM billing_payment WHERE "orderId"=$1',[orderId])).rows[0].n===1,'Duplicate webhook is idempotent in durable ledger');
payment.status='REFUNDED';await event('refund','PAYMENT_REFUNDED',{payment:{id:payId}});
check(!(await billing.accessForChallenge(challengeId,'cardio',1)).premium,'Canonical refund revokes access');
await event('stale','PAYMENT_CONFIRMED',{payment:{id:payId,status:'CONFIRMED'}});
check(!(await billing.accessForChallenge(challengeId,'cardio',1)).premium,'Out-of-order confirmation cannot undo refund');
payment.status='CONFIRMED';payment.value=0.99;await event('wrong-price','PAYMENT_CONFIRMED',{payment:{id:payId}});
check(!(await billing.accessForChallenge(challengeId,'cardio',1)).premium,'Incorrect canonical amount fails closed');
payment.value=9.9;await event('restored','PAYMENT_RECEIVED',{payment:{id:payId}});
check((await billing.accessForChallenge(challengeId,'strength',200)).canTrain,'Paid challenge accepts strength up to 200');
check(!(await billing.accessForChallenge(prefix+'_other','cardio',1)).canTrain,'Premium stays scoped to its challenge');
const future={...payment,id:prefix+'_future',dueDate:'2090-01-01',status:'CONFIRMED',checkoutSession:null};payments.set(future.id,future);
await event('future','PAYMENT_CONFIRMED',{payment:{id:future.id}});
payment.status='REFUNDED';await event('refunded-current','PAYMENT_REFUNDED',{payment:{id:payId}});
check(!(await billing.accessForChallenge(challengeId,'cardio',1)).premium,'Future paid invoice cannot grant current access');
payment.status='CONFIRMED';await event('restore-current','PAYMENT_CONFIRMED',{payment:{id:payId}});
payments.delete(payId);await event('canonical-delete','PAYMENT_DELETED',{payment:{id:payId}});
check(!(await billing.accessForChallenge(challengeId,'cardio',1)).premium,'Canonical 404 revokes a known deleted payment');
payments.set(payId,payment);await event('repaid-current','PAYMENT_CONFIRMED',{payment:{id:payId}});
await Promise.all([event('concurrent','PAYMENT_CONFIRMED',{payment:{id:payId}}),event('concurrent','PAYMENT_CONFIRMED',{payment:{id:payId}})]);
check((await pool.query('SELECT count(*)::int AS n FROM billing_event WHERE id=$1',[prefix+'_concurrent'])).rows[0].n===1,'Concurrent webhook retries commit one event');
await billing.cancelChallengeBilling(challengeId);
const canceled=await billing.accessForChallenge(challengeId,'cardio',1);
check(canceled.premium&&!canceled.renewal&&subscription.deleted,'Cancellation stops renewal and retains paid period');
await event('deleted','SUBSCRIPTION_DELETED',{subscription:{id:subId}});
check((await billing.accessForChallenge(challengeId,'cardio',1)).premium,'Subscription deletion does not erase paid invoice');
await pool.query(`UPDATE billing_payment SET "endsAt"=now()-interval '1 second',"startsAt"=now()-interval '1 month' WHERE "orderId"=$1`,[orderId]);
check(!(await billing.accessForChallenge(challengeId,'cardio',1)).canTrain,'Expired cardio is read-only');
check(!(await billing.accessForChallenge(challengeId,'strength',6)).canTrain,'Expired oversized strength group is read-only');
check((await billing.accessForChallenge(challengeId,'strength',5)).canTrain,'Expired small strength group continues free');
await event('unrelated','PAYMENT_CONFIRMED',{payment:{id:prefix+'_unrelated'}}).then(()=>{throw new Error('Expected provider error')},e=>check(e.status===404,'Provider failure is not acknowledged as successful payment'));
console.log(`${checks} billing lifecycle checks passed with local database and simulated provider. No real charges.`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(async()=>{global.fetch=originalFetch;for(const name of names)if(saved[name]===undefined)delete process.env[name];else process.env[name]=saved[name];await pool.query('DELETE FROM billing_event WHERE id LIKE $1',[prefix+'%']);await pool.query('DELETE FROM billing_payment WHERE "orderId"=$1',[orderId]);await pool.query('DELETE FROM billing_order WHERE id=$1',[orderId]);await pool.end();});
