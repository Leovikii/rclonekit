import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError, draftFor, mountDefaults, validateDraft, type Draft } from '../src/model.ts';
import { errorText } from '../src/i18n.ts';
import { parsePreferences } from '../src/preferences.ts';

const valid: Draft = { kind: 'webdav', url: 'https://DAV.example.com/a/b/', drive: 'Z:', username: '', password: '', readOnly: false };
test('WebDAV normalization preserves path, query and explicit target', () => {
  const draft = validateDraft({ ...valid, url: '  https://DAV.example.com/a/b/?key=value  ' });
  assert.equal(draft.url, 'https://dav.example.com/a/b/?key=value');
  assert.equal(draft.drive, 'Z:');
  assert.equal(validateDraft({ ...valid, url: 'http://localhost:8080/dav/' }).url, 'http://localhost:8080/dav/');
});
test('rejects unsupported protocols, embedded credentials and ambiguous URLs', () => {
  for (const url of ['', 'example.com', 'ftp://example.com', 'file:///C:/', 'https://user:secret@example.com/', 'https://example.com/#', 'https://example.com/#fragment', 'https://example.com/a\nb', 'https://example.com/a b', 'https://example.com/\\server']) {
    assert.throws(() => validateDraft({ ...valid, url }), { code: 'invalid_url' }, url);
  }
  assert.throws(() => validateDraft({ ...valid, kind: 'sftp' } as unknown as Draft), { code: 'unsupported_type' });
});
test('validates drive, credential and runtime input boundaries', () => {
  assert.throws(() => validateDraft(null as unknown as Draft), { code: 'invalid_input' });
  for (const drive of ['C:', 'z:', 'Z:\\', 'ZZ:', '', '../']) assert.throws(() => validateDraft({ ...valid, drive }), { code: 'invalid_drive' });
  assert.throws(() => validateDraft({ ...valid, password: 'secret' }), { code: 'invalid_credentials' });
  assert.throws(() => validateDraft({ ...valid, username: 'user\nname' }), { code: 'invalid_credentials' });
  assert.throws(() => validateDraft({ ...valid, readOnly: 'false' } as unknown as Draft), { code: 'invalid_input' });
});
test('empty drive list does not invent an available target or default credentials', () => {
  assert.equal(draftFor().drive, '');
  assert.equal(draftFor(undefined, ['W:', 'Z:']).drive, 'W:');
  assert.equal(draftFor().password, '');
  assert.equal(mountDefaults.autoConnect, false);
  assert(Object.isFrozen(mountDefaults));
});
test('preferences accept only the two supported languages and three themes', () => {
  assert.deepEqual(parsePreferences('{"language":"en","theme":"dark","password":"secret"}'), { language: 'en', theme: 'dark' });
  for (const value of [null, 'invalid', 'null', '{}', '{"language":"fr","theme":"dark"}']) assert.deepEqual(parsePreferences(value), { language: 'zh', theme: 'system' });
});
test('unexpected failures cannot echo credentials or raw system output into UI', () => {
  assert.equal(errorText(new Error('secret password'), 'zh'), '操作失败，请重试。');
  assert.match(errorText(new AppError('pending_uploads'), 'en'), /upload/);
});
