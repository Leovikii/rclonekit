import { Accordion, Alert, Button, Checkbox, Group, NativeSelect, Stack, Text, TextInput } from '@mantine/core';
import { useState } from 'react';
import { AppError, draftFor, validateDraft, type Draft, type Mount } from './model.ts';
import { errorText, translator, type Language } from './i18n.ts';

export type Editor = { mode: 'new' | 'edit' | 'reconnect' | 'prepare'; mount?: Mount };
export function MountEditor({ editor, drives, language, onSave, onCancel, onBusy }: {
  editor: Editor; drives: string[]; language: Language;
  onSave: (draft: Draft) => Promise<void>; onCancel: () => void; onBusy: (busy: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => draftFor(editor.mount, drives));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const t = translator(language);
  const reconnect = editor.mode === 'reconnect';
  const options = [...new Set([...(editor.mount ? [editor.mount.target.value] : []), ...drives])];
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    try {
      const validated = validateDraft(draft);
      if (!options.includes(validated.drive)) throw new AppError('drive_in_use');
      setBusy(true); onBusy(true);
      await onSave(validated);
    } catch (cause) { setError(cause); }
    finally { setBusy(false); onBusy(false); }
  }
  return <form onSubmit={submit}>
    <Stack gap="md">
      <TextInput id="webdav-url" label={t('address')} type="url" placeholder="https://dav.example.com/dav/" required data-autofocus
        value={draft.url} onChange={e => setDraft({ ...draft, url: e.currentTarget.value })} disabled={busy || reconnect} autoComplete="off" />
      {draft.url.trim().toLowerCase().startsWith('http:') && <Text size="xs" c="dimmed">{t('httpWarning')}</Text>}
      <NativeSelect id="drive-letter" label={t('drive')} required data={options.length ? options : [{ value: '', label: t('noDrive') }]}
        value={draft.drive} onChange={e => setDraft({ ...draft, drive: e.currentTarget.value })} disabled={busy || reconnect || !options.length} />
      <Accordion multiple defaultValue={draft.username ? ['auth'] : []} order={3}>
        <Accordion.Item value="auth"><Accordion.Control>{t('auth')}</Accordion.Control><Accordion.Panel>
          <Stack gap="md"><TextInput id="webdav-user" label={t('username')} value={draft.username} disabled={busy || reconnect}
            onChange={e => setDraft({ ...draft, username: e.currentTarget.value })} autoComplete="off" />
            <TextInput id="webdav-password" type="password" label={t('password')} value={draft.password} disabled={busy} autoComplete="off"
              onChange={e => setDraft({ ...draft, password: e.currentTarget.value })} /></Stack>
        </Accordion.Panel></Accordion.Item>
        <Accordion.Item value="advanced"><Accordion.Control>{t('advanced')}</Accordion.Control><Accordion.Panel>
          <Checkbox id="mount-readonly" label={t('readOnly')} checked={draft.readOnly} disabled={busy || reconnect}
            onChange={e => setDraft({ ...draft, readOnly: e.currentTarget.checked })} />
        </Accordion.Panel></Accordion.Item>
      </Accordion>
      {error !== null && <Alert color="red">{errorText(error, language)}</Alert>}
      {busy && <Text role="status" size="sm">{t(editor.mode === 'prepare' ? 'checkingConnection' : editor.mode === 'edit' ? 'save' : 'mounting')}…</Text>}
      <Group justify="flex-end" gap={8}>
        <Button type="submit" disabled={busy || !options.length}>{t(editor.mode === 'prepare' ? 'saveConfiguration' : editor.mode === 'edit' ? 'save' : 'connect')}</Button>
        <Button type="button" variant="default" onClick={onCancel} disabled={busy}>{t('cancel')}</Button>
      </Group>
    </Stack>
  </form>;
}
