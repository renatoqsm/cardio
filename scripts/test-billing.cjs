const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { Module, createRequire } = require('node:module');
const project = path.resolve(__dirname, '..');
function load(name) {
  const file = path.join(project, 'lib/billing', name + '.ts');
  const m = new Module(file); m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file));
  const original = createRequire(file);
  m.require = value => value === 'server-only' ? {} : value.startsWith('./') ? load(value.slice(2)) : original(value);
  m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
  return m.exports;
}
const { premiumPlan, challengeAccess, hasPaidAccess } = load('plans');
const asaas = load('asaas');
const { invoicePeriod, paymentGrantsAccess } = load('periods');
const { validWebhookToken } = load('webhook-auth');
const names = ['ASAAS_API_KEY', 'ASAAS_ENVIRONMENT', 'BETTER_AUTH_URL'];
const saved = Object.fromEntries(names.map(k => [k, process.env[k]]));
const originalFetch = global.fetch;
let calls = [], response = { id: 'checkout_test', link: 'https://untrusted.example' }, status = 200, checks = 0;
const check = (condition, label) => { assert(condition, label); checks++; console.log('PASS:', label); };
async function rejects(fn, predicate, label) { await assert.rejects(async () => fn(), predicate); checks++; console.log('PASS:', label); }
async function main() {
  check(invoicePeriod('2026-01-31','monthly').endsAt.toISOString()==='2026-02-28T03:00:00.000Z','Month-end invoice clamps to last calendar day');
  check(invoicePeriod('2024-02-29','annual').endsAt.toISOString()==='2025-02-28T03:00:00.000Z','Annual leap-day invoice clamps safely');
  assert.throws(()=>invoicePeriod('2026-02-30','monthly'));checks++;
  const invoice={status:'CONFIRMED',deleted:false,value:9.9,billingType:'CREDIT_CARD'};
  check(paymentGrantsAccess(invoice,'monthly'),'Canonical confirmed card payment grants access');
  for(const status of ['PENDING','OVERDUE','REFUNDED','REFUND_REQUESTED','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL']) check(!paymentGrantsAccess({...invoice,status},'monthly'),'No access for '+status);
  check(!paymentGrantsAccess({...invoice,refunds:[{value:1}]},'monthly'),'Partial refunds revoke the invoice entitlement');
  check(!paymentGrantsAccess({...invoice,value:0.99},'monthly')&&!paymentGrantsAccess({...invoice,deleted:true},'monthly'),'Tampered amount and deleted payment never grant access');
  const token='local-webhook-test-token-32-characters';
  check(validWebhookToken(token,token)&&!validWebhookToken('incorrect',token)&&!validWebhookToken(null,token)&&!validWebhookToken(token,undefined),'Webhook authentication fails closed');
  const now = new Date('2026-10-08T15:00:00Z'), period = { startsAt: new Date('2026-10-01T03:00:00Z'), endsAt: new Date('2026-11-01T03:00:00Z') };
  check(premiumPlan('monthly').amountCents === 990 && premiumPlan('annual').amountCents === 4990, 'Prices fixed in centavos');
  assert.throws(() => premiumPlan({ amount: 1 })); checks++;
  check(challengeAccess('strength', 4, [], now).canJoin && !challengeAccess('strength', 5, [], now).canJoin, 'Free membership boundary includes administrator');
  check(challengeAccess('strength', 5, [], now).canTrain && !challengeAccess('strength', 6, [], now).canTrain, 'Existing oversized group is read-only without deleting members');
  check(!challengeAccess('cardio', 1, [], now).canTrain, 'Cardio requires paid access');
  for (const modality of ['cardio', 'strength']) {
    check(challengeAccess(modality, 199, [period], now).canJoin && !challengeAccess(modality, 200, [period], now).canJoin, 'Premium joins stop at 200 for ' + modality);
    check(challengeAccess(modality, 200, [period], now).canTrain && !challengeAccess(modality, 201, [period], now).canTrain, 'Premium activity capacity for ' + modality);
  }
  check(hasPaidAccess([period], period.startsAt) && !hasPaidAccess([period], period.endsAt), 'Paid window starts inclusively and expires exactly');
  check(!hasPaidAccess([period], new Date('2026-09-30')) && !hasPaidAccess([{ startsAt: new Date('invalid'), endsAt: new Date('invalid') }], now), 'Future and invalid periods never grant access');
  check(challengeAccess('strength', 5, [period], period.endsAt).canTrain && !challengeAccess('cardio', 1, [period], period.endsAt).canTrain, 'Expired small strength group returns to free access');
  global.fetch = async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify(response), { status }); };
  delete process.env.ASAAS_API_KEY;
  await rejects(() => asaas.readPayment('pay_1'), e => e.status === 503, 'Missing credentials fail closed without provider request');
  check(calls.length === 0, 'No request without API key');
  process.env.ASAAS_API_KEY = 'dummy-key-for-local-tests';
  process.env.ASAAS_ENVIRONMENT = 'production';
  process.env.BETTER_AUTH_URL = 'https://pulso.example';
  const input = { reference: 'reference_1', challengeId: 'challenge_1', plan: 'monthly', imageBase64: 'dGVzdA==' };
  const checkout = await asaas.createRecurringCheckout(input);
  let body = JSON.parse(calls.at(-1).options.body);
  check(body.items[0].value === 9.9 && body.subscription.cycle === 'MONTHLY', 'Monthly hosted checkout uses server price and recurrence');
  check(body.billingTypes[0] === 'CREDIT_CARD' && body.chargeTypes[0] === 'RECURRENT' && body.externalReference === input.reference, 'Card recurrence and immutable order reference');
  check(body.callback.successUrl.includes('checkout=returned') && !body.callback.successUrl.includes('paid=true'), 'Callback is navigation only');
  check(checkout.url === 'https://asaas.com/checkoutSession/show?id=checkout_test', 'Hosted redirect built from trusted Asaas origin');
  check(calls.at(-1).options.redirect === 'error' && calls.at(-1).options.cache === 'no-store', 'No credential-bearing redirects or caching');
  await asaas.createRecurringCheckout({ ...input, plan: 'annual' }); body = JSON.parse(calls.at(-1).options.body);
  check(body.items[0].value === 49.9 && body.subscription.cycle === 'YEARLY', 'Annual hosted checkout uses server price and recurrence');
  process.env.ASAAS_ENVIRONMENT = 'sandbox'; await asaas.createRecurringCheckout(input);
  check(calls.at(-1).url === 'https://api-sandbox.asaas.com/v3/checkouts', 'Sandbox and production endpoints separated');
  await rejects(() => asaas.readPayment('../transfers'), e => e.status === 400, 'Provider resource IDs reject traversal');
  process.env.ASAAS_ENVIRONMENT = 'production'; process.env.BETTER_AUTH_URL = 'http://localhost:3000';
  await rejects(() => asaas.createRecurringCheckout(input), e => e.status === 503, 'Production callbacks require HTTPS');
  process.env.BETTER_AUTH_URL = 'https://pulso.example'; response = {};
  await rejects(() => asaas.createRecurringCheckout(input), e => e.status === 502, 'Missing checkout ID cannot become an undefined payment link');
  status = 401; response = { errors: [{ description: 'Private provider detail' }] };
  await rejects(() => asaas.readPayment('pay_1'), e => e.status === 401 && !e.message.includes('Private'), 'Provider details not exposed in errors');
  console.log(`${checks} billing foundation checks passed. No real provider requests or charges.`);
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => {
  global.fetch = originalFetch;
  for (const name of names) if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name];
});
