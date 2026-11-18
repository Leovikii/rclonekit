import { ActionIcon, Alert, Button, Group, Loader, Menu, Modal, NativeSelect, Paper, ScrollArea, Stack, Text, Title, Tooltip, Transition } from '@mantine/core';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Backend, Snapshot } from './api.ts';
import { errorText, translator, type Language } from './i18n.ts';
import { Icon } from './icons.tsx';
import { MountEditor, type Editor } from './MountEditor.tsx';
import { mountTitle, type Draft, type Mount } from './model.ts';
import type { Preferences } from './preferences.ts';

function PageEntrance({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => setVisible(true), []);
  return <Transition mounted={visible} transition="fade-up" duration={200} timingFunction="ease-out">
    {styles => <div className="page-content" style={styles}>{children}</div>}
  </Transition>;
}

export function App({ backend, preferences, savePreferences }: {
  backend: Backend; preferences: Preferences; savePreferences: (preferences: Preferences) => void;
}) {
  const t = translator(preferences.language);
  const [page, setPage] = useState<'home' | 'settings'>('home');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [reading, setReading] = useState(true);
  const [readError, setReadError] = useState(false);
  const [notice, setNotice] = useState('');
  const [cardErrors, setCardErrors] = useState<Record<string, unknown>>({});
  const [busyCards, setBusyCards] = useState<Record<string, string>>({});
  const [editor, setEditor] = useState<Editor | null>(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const [deleting, setDeleting] = useState<Mount | null>(null);
  const [deleteError, setDeleteError] = useState<unknown>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [installBusy, setInstallBusy] = useState(false);
  const [installDone, setInstallDone] = useState(false);
  const [installError, setInstallError] = useState<unknown>(null);
  const revision = useRef(0);
  const alive = useRef(true);
  const cardLocks = useRef(new Set<string>());
  const navigation = useRef<HTMLButtonElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const modalOrigin = useRef<HTMLElement | null>(null);
  const ready = !!snapshot && snapshot.components.every(component => component.installed) && !snapshot.restartRequired;
  const blocked = readError || reading || installBusy;
  async function refresh(foreground = true) {
    const token = ++revision.current;
    if (foreground) setReading(true);
    try {
      const result = await backend.snapshot();
      if (alive.current && token === revision.current) { setSnapshot(result); setReadError(false); }
    } catch (cause) {
      if (alive.current && token === revision.current) setReadError(true);
      throw cause;
    } finally { if (alive.current && token === revision.current) setReading(false); }
  }
  useEffect(() => {
    alive.current = true;
    void refresh().catch(() => {});
    return () => { alive.current = false; revision.current++; };
  }, [backend]);
  useEffect(() => { navigation.current?.focus({ preventScroll: true }); }, [page]);
  function navigate(next: typeof page) { if (next !== page) { setPage(next); setNotice(''); } }
  function rememberOrigin(mount?: Mount) {
    modalOrigin.current = mount ? document.getElementById(`mount-more-${mount.id}`) : addButton.current;
  }
  function restoreFocus() {
    const target = modalOrigin.current;
    if (target?.isConnected && !target.matches(':disabled')) target.focus({ preventScroll: true });
    else (addButton.current ?? navigation.current)?.focus({ preventScroll: true });
  }
  function openEditor(mode: Editor['mode'], mount?: Mount) {
    rememberOrigin(mount); setEditor({ mode, mount }); setNotice('');
  }
  async function saveDraft(draft: Draft) {
    if (!editor) return;
    if (editor.mode === 'new') await backend.add(draft);
    else if (editor.mode === 'edit') await backend.update(editor.mount!.id, draft);
    else await backend.connect(editor.mount!.id, draft.password);
    setNotice(editor.mode === 'edit' ? t('saved') : t('connected'));
    await refresh(false).catch(() => {});
    setEditor(null);
  }
  async function act(mount: Mount, action: 'connect' | 'disconnect' | 'open') {
    if (cardLocks.current.has(mount.id)) return;
    cardLocks.current.add(mount.id);
    setBusyCards(previous => ({ ...previous, [mount.id]: action }));
    setCardErrors(previous => ({ ...previous, [mount.id]: null })); setNotice('');
    try {
      if (action === 'open') await backend.openMount(mount.id);
      else if (action === 'connect') await backend.connect(mount.id);
      else await backend.disconnect(mount.id);
      await refresh(false);
      setNotice(t(action === 'open' ? 'opened' : action === 'connect' ? 'connected' : 'disconnected'));
    } catch (cause) { setCardErrors(previous => ({ ...previous, [mount.id]: cause })); }
    finally {
      cardLocks.current.delete(mount.id);
      setBusyCards(previous => ({ ...previous, [mount.id]: '' }));
    }
  }
  async function remove() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true); setDeleteError(null);
    try {
      await backend.remove(deleting.id); setNotice(t('removed'));
      await refresh(false).catch(() => {});
      setDeleting(null);
    } catch (cause) { setDeleteError(cause); }
    finally { setDeleteBusy(false); }
  }
  async function install() {
    if (installBusy) return;
    setInstallBusy(true); setInstallError(null);
    try { await backend.installMissing(); await refresh(); setInstallDone(true); }
    catch (cause) { setInstallError(cause); await refresh().catch(() => {}); }
    finally { setInstallBusy(false); }
  }
  const setting = (label: string, control: ReactNode) => <div className="setting-row"><Text>{label}</Text><div className="row-control">{control}</div></div>;
  const card = (mount: Mount) => {
    const busy = busyCards[mount.id];
    return <Paper key={mount.id} component="article" withBorder p={16} className="mount-card" aria-label={mountTitle(mount)}>
      <div className="card-heading"><Icon name="drive" /><Title order={2} className="mount-title">{mountTitle(mount)}</Title>
        <Text size="xs" c="dimmed" role="status">{busy === 'connect' ? t('mounting') : busy === 'disconnect' ? t('disconnecting') : t(mount.mounted ? 'mounted' : 'unmounted')}</Text></div>
      <Text size="xs" c="dimmed" className="address">{mount.connection.url}</Text>
      {cardErrors[mount.id] != null && <Alert color="red">{errorText(cardErrors[mount.id], preferences.language)}</Alert>}
      <Group justify="space-between" gap={8} mt="auto">
        <Menu position="bottom-start" width={220} shadow="sm"><Menu.Target>
          <ActionIcon id={`mount-more-${mount.id}`} type="button" variant="subtle" color="gray" size="lg" aria-label={`${t('more')} ${mount.target.value}`} disabled={blocked || !!busy}><Icon name="more" /></ActionIcon>
        </Menu.Target><Menu.Dropdown>
          {mount.mounted && <Menu.Label>{t('disconnectFirst')}</Menu.Label>}
          <Menu.Item disabled={mount.mounted} onClick={() => openEditor('edit', mount)}>{t('edit')}</Menu.Item>
          <Menu.Item color="red" disabled={mount.mounted} onClick={() => { rememberOrigin(mount); setDeleteError(null); setDeleting(mount); }}>{t('remove')}</Menu.Item>
        </Menu.Dropdown></Menu>
        <Group gap={8} className="card-actions">
          {mount.mounted && <Button type="button" variant="default" disabled={blocked || !!busy} onClick={() => void act(mount, 'open')}>{t('open')}</Button>}
          <Button type="button" variant={mount.mounted ? 'default' : 'filled'} disabled={blocked || !!busy}
            onClick={() => mount.mounted ? void act(mount, 'disconnect') : mount.connection.username ? openEditor('reconnect', mount) : void act(mount, 'connect')}>
            {t(mount.mounted ? 'disconnect' : 'connect')}
          </Button>
        </Group>
      </Group>
    </Paper>;
  };
  return <>
    <div className="app-surface">
      <PageEntrance key={page}>
        <ScrollArea className="page-scroll" type="auto" scrollbarSize={8} scrollbars="y" viewportProps={{ 'aria-label': t(page === 'home' ? 'drives' : 'settings'), tabIndex: 0 }}>
          <main className="page-padding">
            <Group className="page-heading" gap={8} wrap="nowrap">
              {page === 'settings' && <Tooltip label={t('back')}><ActionIcon ref={navigation} type="button" variant="subtle" color="gray" size="lg" aria-label={t('back')} onClick={() => navigate('home')}><Icon name="back" /></ActionIcon></Tooltip>}
              <Title order={1}>{t(page === 'home' ? 'drives' : 'settings')}</Title>
              {page === 'home' && <Tooltip label={t('settings')}><ActionIcon ref={navigation} type="button" variant="subtle" color="gray" size="lg" aria-label={t('settings')} onClick={() => navigate('settings')}><Icon name="settings" /></ActionIcon></Tooltip>}
            </Group>
            {readError && <Alert color="red" mb={16}><Stack gap={8}><Text>{t('readFailed')}</Text><Button type="button" variant="default" disabled={reading} onClick={() => void refresh().catch(() => {})}>{t('retry')}</Button></Stack></Alert>}
            {!snapshot && reading && <Group gap={12} role="status"><Loader size="sm" aria-hidden="true" /><Text>{t('checking')}</Text></Group>}
            {page === 'home' && snapshot && <>
              {!ready ? <Stack gap={16} className="onboarding"><Icon name="drive" /><Title order={2}>{t(snapshot.restartRequired ? 'restart' : 'setupTitle')}</Title>
                <Text size="sm" c="dimmed">{t(snapshot.restartRequired ? 'restartHint' : 'setupHint')}</Text><div><Button type="button" onClick={() => navigate('settings')}>{t('goSettings')}</Button></div></Stack>
                : <section className="mount-grid" aria-label={t('drives')}>
                  {snapshot.mounts.map(card)}
                  <Button ref={addButton} type="button" variant="default" className="add-card" leftSection={<Icon name="plus" />} disabled={blocked}
                    onClick={() => openEditor('new')}>{t('add')}</Button>
                </section>}
            </>}
            {page === 'settings' && <Stack gap={24}>
              <section><Title order={2} mb={8}>{t('appearance')}</Title><Paper withBorder>
                {setting(t('language'), <NativeSelect id="app-language" aria-label={t('language')} value={preferences.language} data={[{ value: 'zh', label: '简体中文' }, { value: 'en', label: 'English' }]}
                  onChange={e => savePreferences({ ...preferences, language: e.currentTarget.value as Language })} />)}
                {setting(t('theme'), <NativeSelect id="app-theme" aria-label={t('theme')} value={preferences.theme} data={['system', 'light', 'dark'].map(value => ({ value, label: t(value as 'system' | 'light' | 'dark') }))}
                  onChange={e => savePreferences({ ...preferences, theme: e.currentTarget.value as Preferences['theme'] })} />)}
              </Paper></section>
              {snapshot && <section><Title order={2} mb={8}>{t('components')}</Title><Paper withBorder>
                {snapshot.components.map(component => <div className="setting-row" key={component.id}><Text>{component.id === 'rclone' ? 'rclone' : 'WinFsp'}</Text><Text size="xs" c="dimmed">{t(component.installed ? 'installed' : 'missing')}</Text></div>)}
              </Paper>
                {snapshot.restartRequired && <Text mt={16} role="status">{t('restartHint')}</Text>}
                <Group justify="flex-end" mt={16} gap={8}>
                  {!ready && !snapshot.restartRequired && <Button type="button" disabled={blocked} onClick={() => { modalOrigin.current = document.activeElement as HTMLElement; setInstallError(null); setInstallDone(false); setInstallOpen(true); }}>{t('install')}</Button>}
                  {ready && <Button type="button" onClick={() => navigate('home')}>{t('start')}</Button>}
                </Group>
              </section>}
              <Group justify="flex-end"><Button component="a" variant="subtle" href="https://github.com/Leovikii/rclonekit" target="_blank" rel="noreferrer">{t('repository')}</Button></Group>
            </Stack>}
            <Text className="notice" size="xs" c="dimmed" role="status" aria-live="polite">{notice}</Text>
          </main>
        </ScrollArea>
      </PageEntrance>
    </div>
    <Modal opened={editor !== null} onClose={() => { if (!editorBusy) setEditor(null); }} title={t(editor?.mode === 'edit' ? 'editTitle' : editor?.mode === 'reconnect' ? 'reconnectTitle' : 'add')}
      size={480} closeButtonProps={{ 'aria-label': t('close') }} withCloseButton={!editorBusy} closeOnEscape={!editorBusy} closeOnClickOutside={false}
      scrollAreaComponent={ScrollArea.Autosize} onExitTransitionEnd={restoreFocus}>
      {editor && <MountEditor editor={editor} drives={snapshot?.availableDrives ?? []} language={preferences.language}
        onSave={saveDraft} onCancel={() => setEditor(null)} onBusy={setEditorBusy} />}
    </Modal>
    <Modal opened={deleting !== null} onClose={() => { if (!deleteBusy) setDeleting(null); }} title={t('deleteTitle')} size={480}
      closeButtonProps={{ 'aria-label': t('close') }} withCloseButton={!deleteBusy} closeOnEscape={!deleteBusy} closeOnClickOutside={false} scrollAreaComponent={ScrollArea.Autosize} onExitTransitionEnd={restoreFocus}>
      <Stack gap={16}><Text className="address">{deleting && mountTitle(deleting)}</Text><Text>{t('deleteHint')}</Text>
        {deleteError !== null && <Alert color="red">{errorText(deleteError, preferences.language)}</Alert>}
        <Group justify="flex-end" gap={8}><Button type="button" color="red" disabled={deleteBusy} onClick={() => void remove()}>{t('remove')}</Button>
          <Button type="button" variant="default" data-autofocus disabled={deleteBusy} onClick={() => setDeleting(null)}>{t('cancel')}</Button></Group>
      </Stack>
    </Modal>
    <Modal opened={installOpen} onClose={() => { if (!installBusy) setInstallOpen(false); }} title={t('install')} size={480}
      closeButtonProps={{ 'aria-label': t('close') }} withCloseButton={!installBusy} closeOnEscape={!installBusy} closeOnClickOutside={false} scrollAreaComponent={ScrollArea.Autosize} onExitTransitionEnd={restoreFocus}>
      <Stack gap={16}>
        {!installDone && <><Text>{t('installPrompt')}</Text><Text>{snapshot?.components.filter(c => !c.installed).map(c => c.id === 'winfsp' ? 'WinFsp' : 'rclone').join('、')}</Text></>}
        {installBusy && <Group gap={12} role="status"><Loader size="sm" aria-hidden="true" /><Text>{t('installing')}</Text></Group>}
        {installError !== null && <Alert color="red">{errorText(installError, preferences.language)}</Alert>}
        {installDone && <Text role="status">{t(snapshot?.restartRequired ? 'restartHint' : 'installDone')}</Text>}
        <Group justify="flex-end" gap={8}>
          {!installDone && <Button type="button" disabled={installBusy} onClick={() => void install()}>{t(installError ? 'retry' : 'installAction')}</Button>}
          <Button type="button" variant="default" disabled={installBusy} onClick={() => setInstallOpen(false)}>{t(installDone ? 'close' : 'cancel')}</Button>
        </Group>
      </Stack>
    </Modal>
  </>;
}
