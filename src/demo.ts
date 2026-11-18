import type { Backend, Snapshot } from './api.ts';
import { AppError, validateDraft, type Draft, type Mount } from './model.ts';

export const scenarios = ['ready', 'empty', 'setup', 'upload', 'network', 'read-error', 'install-error', 'restart'] as const;
export type Scenario = typeof scenarios[number];

export function createDemoBackend(scenario: Scenario = 'ready', delayMs = 350): Backend {
  const mounts: Mount[] = scenario === 'empty' || scenario === 'setup' ? [] : [
    { id: 'example-x', connection: { kind: 'webdav', url: 'https://dav.example.com/dav/', username: '' }, target: { kind: 'driveLetter', value: 'X:' }, readOnly: false, mounted: true },
    { id: 'example-y', connection: { kind: 'webdav', url: 'https://nas.example.com/webdav/documents/', username: '' }, target: { kind: 'driveLetter', value: 'Y:' }, readOnly: true, mounted: false },
  ];
  let installedCore = scenario !== 'setup';
  let installedDriver = !['setup', 'install-error', 'restart'].includes(scenario);
  let restartRequired = false;
  let installAttempts = 0;
  let readAttempts = 0;
  let nextId = 1;
  const locks = new Set<string>();
  const wait = () => new Promise<void>(resolve => setTimeout(resolve, delayMs));
  const get = (id: string) => {
    const mount = mounts.find(item => item.id === id);
    if (!mount) throw new AppError('not_found');
    return mount;
  };
  const freeDrives = () => Array.from({ length: 23 }, (_, i) => `${String.fromCharCode(90 - i)}:`)
    .filter(drive => !['D:', 'E:'].includes(drive) && !mounts.some(m => m.target.value === drive));
  function checkTarget(draft: Draft, current?: Mount) {
    if (draft.drive !== current?.target.value && !freeDrives().includes(draft.drive)) throw new AppError('drive_in_use');
  }
  function checkReady() {
    if (restartRequired) throw new AppError('restart_required');
    if (!installedCore || !installedDriver) throw new AppError('not_ready');
  }
  async function locked<T>(id: string, action: () => T | Promise<T>): Promise<T> {
    if (locks.has(id) || (id !== 'install' && locks.has('install')) || (id === 'install' && locks.size)) throw new AppError('busy');
    locks.add(id);
    try { await wait(); return await action(); } finally { locks.delete(id); }
  }
  const detached = (mount: Mount) => structuredClone(mount);
  function connection(draft: Draft): Mount['connection'] {
    return { kind: draft.kind, url: draft.url, username: draft.username };
  }
  return {
    async snapshot(): Promise<Snapshot> {
      await wait();
      if (scenario === 'read-error' && readAttempts++ === 0) throw new AppError('status_unavailable');
      return {
        components: [{ id: 'rclone', installed: installedCore }, { id: 'winfsp', installed: installedDriver }],
        mounts: mounts.map(detached), availableDrives: freeDrives(), restartRequired,
        capabilities: { target: 'driveLetter', connections: ['webdav'], systemOperations: false },
      };
    },
    async add(input) {
      const draft = validateDraft(input);
      return locked('configuration', () => {
        checkReady(); checkTarget(draft);
        if (scenario === 'network') throw new AppError('network_error');
        if (draft.username && !draft.password) throw new AppError('invalid_credentials');
        const mount: Mount = { id: `example-new-${nextId++}`, connection: connection(draft), target: { kind: 'driveLetter', value: draft.drive }, readOnly: draft.readOnly, mounted: true };
        mounts.push(mount);
        return detached(mount);
      });
    },
    async update(id, input) {
      const draft = validateDraft(input);
      return locked(id, () => {
        const mount = get(id);
        if (mount.mounted) throw new AppError('already_mounted');
        checkTarget(draft, mount);
        Object.assign(mount, { connection: connection(draft), target: { kind: 'driveLetter', value: draft.drive }, readOnly: draft.readOnly });
        return detached(mount);
      });
    },
    async connect(id, password = '') {
      return locked(id, () => {
        checkReady();
        const mount = get(id);
        if (mount.mounted) throw new AppError('already_mounted');
        if (scenario === 'network') throw new AppError('network_error');
        if (mount.connection.username && !password) throw new AppError('invalid_credentials');
        mount.mounted = true;
      });
    },
    async disconnect(id) {
      return locked(id, () => {
        const mount = get(id);
        if (!mount.mounted) throw new AppError('not_mounted');
        if (scenario === 'upload') throw new AppError('pending_uploads');
        mount.mounted = false;
      });
    },
    async remove(id) {
      return locked(id, () => {
        const mount = get(id);
        if (mount.mounted) throw new AppError('already_mounted');
        mounts.splice(mounts.indexOf(mount), 1);
      });
    },
    async installMissing() {
      return locked('install', () => {
        if (restartRequired) throw new AppError('restart_required');
        installedCore = true;
        if (scenario === 'install-error' && installAttempts++ === 0) throw new AppError('install_failed');
        installedDriver = true;
        if (scenario === 'restart') restartRequired = true;
      });
    },
    async openMount(id) {
      await wait();
      if (!get(id).mounted) throw new AppError('not_mounted');
      if (scenario === 'network') throw new AppError('network_error');
      // Demo intentionally opens no local folders or network locations.
    },
  };
}
