import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoBackend } from '../src/demo.ts';
import type { Draft } from '../src/model.ts';

const draft: Draft = { kind: 'webdav', url: 'https://example.com/dav/', drive: 'Z:', username: '', password: '', readOnly: false };
test('add / disconnect / edit / reconnect / remove preserve ID and never retain passwords', async () => {
  const backend = createDemoBackend('ready', 0);
  const mount = await backend.add({ ...draft, username: 'user', password: 'credential-not-to-store' });
  assert(!JSON.stringify(await backend.snapshot()).includes('credential-not-to-store'));
  assert.equal(mount.mounted, true);
  await assert.rejects(backend.remove(mount.id), { code: 'already_mounted' });
  await assert.rejects(backend.update(mount.id, draft), { code: 'already_mounted' });
  await backend.disconnect(mount.id);
  const edited = await backend.update(mount.id, { ...draft, drive: 'W:', username: 'user' });
  assert.equal(edited.id, mount.id);
  assert.equal(edited.target.value, 'W:');
  await assert.rejects(backend.connect(mount.id), { code: 'invalid_credentials' });
  await backend.connect(mount.id, 'credential-not-to-store');
  await backend.disconnect(mount.id); await backend.remove(mount.id);
  assert(!(await backend.snapshot()).mounts.some(m => m.id === mount.id));
  assert(!JSON.stringify(backend).includes('credential-not-to-store'));
});
test('snapshots and returned models are detached from backend state', async () => {
  const backend = createDemoBackend('ready', 0);
  const snapshot = await backend.snapshot(); snapshot.mounts[0].mounted = false;
  snapshot.mounts[0].connection.url = 'https://changed.example.com';
  const actual = await backend.snapshot();
  assert.equal(actual.mounts[0].mounted, true);
  assert.equal(actual.mounts[0].connection.url, 'https://dav.example.com/dav/');
});
test('target conflicts are checked at the mutation boundary, including races', async () => {
  const backend = createDemoBackend('ready', 0);
  await assert.rejects(backend.add({ ...draft, drive: 'X:' }), { code: 'drive_in_use' });
  await assert.rejects(backend.add({ ...draft, drive: 'D:' }), { code: 'drive_in_use' });
  const attempts = await Promise.allSettled([backend.add(draft), backend.add(draft)]);
  assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await backend.snapshot()).mounts.filter(m => m.target.value === 'Z:').length, 1);
});
test('duplicate operations reject while unrelated card can still be operated', async () => {
  const backend = createDemoBackend('ready', 10);
  const first = backend.disconnect('example-x');
  await assert.rejects(backend.disconnect('example-x'), { code: 'busy' });
  await backend.connect('example-y'); await first;
  assert.deepEqual((await backend.snapshot()).mounts.map(m => m.mounted), [false, true]);
});
test('unsafe disconnect retains mounted state, and failures do not mutate config', async () => {
  const backend = createDemoBackend('upload', 0);
  await assert.rejects(backend.disconnect('example-x'), { code: 'pending_uploads' });
  assert.equal((await backend.snapshot()).mounts[0].mounted, true);
  const network = createDemoBackend('network', 0);
  await assert.rejects(network.add(draft), { code: 'network_error' });
  assert.equal((await network.snapshot()).mounts.length, 2);
  await assert.rejects(network.connect('example-y'), { code: 'network_error' });
  assert.equal((await network.snapshot()).mounts[1].mounted, false);
});
test('missing components gate mounting, partial install retries only missing component', async () => {
  const backend = createDemoBackend('setup', 0);
  await assert.rejects(backend.add(draft), { code: 'not_ready' });
  await backend.installMissing(); assert((await backend.snapshot()).components.every(c => c.installed));
  const partial = createDemoBackend('install-error', 0);
  await assert.rejects(partial.installMissing(), { code: 'install_failed' });
  assert.deepEqual((await partial.snapshot()).components.map(c => c.installed), [true, false]);
  await partial.installMissing(); assert((await partial.snapshot()).components.every(c => c.installed));
});
test('restart is not installation ready and read failure is not unmounted', async () => {
  const restart = createDemoBackend('restart', 0); await restart.installMissing();
  assert.equal((await restart.snapshot()).restartRequired, true);
  await assert.rejects(restart.add(draft), { code: 'restart_required' });
  const backend = createDemoBackend('read-error', 0);
  await assert.rejects(backend.snapshot(), { code: 'status_unavailable' });
  assert.equal((await backend.snapshot()).mounts[0].mounted, true);
});
