const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const objects = new Map();
const server = http.createServer(async (request, response) => {
  assert.equal(request.headers.apikey, 'test-only');
  assert.equal(request.headers.authorization, 'Bearer test-only');
  const key = request.url.replace('/storage/v1/object/', '').replace('authenticated/', '');
  if (request.method === 'POST') {
    assert.equal(request.headers['content-type'], 'image/png');
    assert.equal(request.headers['x-upsert'], 'false');
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    objects.set(key, Buffer.concat(chunks));
    response.end('{}');
  } else if (objects.has(key)) response.end(objects.get(key));
  else { response.statusCode = 404; response.end('{}'); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  process.env.SUPABASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.SUPABASE_SECRET_KEY = 'test-only';
  process.env.STORAGE_BACKEND = 'supabase';
  const filename = path.resolve(__dirname, '../lib/storage.ts');
  const mod = new Module(filename); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
  const { saveProof, readProof, imageType } = mod.exports;
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  assert.equal(imageType(image).mime, 'image/png');
  const pathname = await saveProof('test-owner', image, 'png');
  const name = pathname.split('/').at(-1);
  assert.deepEqual(await readProof('test-owner', name), image);
  assert.equal(await readProof('other-owner', name), null);
  assert.equal(await readProof('../escape', name), null);
  assert.equal(await readProof('test-owner', '../escape.png'), null);
  await assert.rejects(saveProof('../escape', image, 'png'));
  await assert.rejects(saveProof('test-owner', image, '../../escape'));
  delete process.env.SUPABASE_SECRET_KEY;
  await assert.rejects(readProof('test-owner', name), /incomplete/);
  delete process.env.SUPABASE_URL;
  await assert.rejects(readProof('test-owner', name), /missing/);
  console.log('9 Supabase storage checks passed against a local HTTP mock; no live Supabase access tested.');
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => server.close());
