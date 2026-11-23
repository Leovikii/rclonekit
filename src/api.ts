import type { Draft, Mount } from './model.ts';

export type Component = { id: 'rclone' | 'winfsp'; installed: boolean };
export type Snapshot = {
  components: Component[];
  mounts: Mount[];
  availableDrives: string[];
  capabilities: { target: 'driveLetter'; connections: ['webdav']; systemOperations: boolean };
  restartRequired: boolean;
};

export type EnvironmentSnapshot = {
  components: { id: 'rclone' | 'winfsp' | 'winget'; status: 'detected' | 'notDetected' | 'unknown' }[];
  availableDrives: string[];
  installCandidates: Component['id'][];
  configurations: (Omit<Mount, 'mounted'> & { mounted: boolean | null })[];
};

export interface DesktopBackend {
  mode: 'desktop';
  snapshot(): Promise<EnvironmentSnapshot>;
  prepare(draft: Draft, id?: string): Promise<void>;
  remove(id: string): Promise<void>;
  installMissing(): Promise<{ restartRequired: boolean }>;
}

export interface DemoBackend {
  mode: 'demo';
  snapshot(): Promise<Snapshot>;
  add(draft: Draft): Promise<Mount>;
  update(id: string, draft: Draft): Promise<Mount>;
  connect(id: string, password?: string): Promise<void>;
  disconnect(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  installMissing(): Promise<void>;
  openMount(id: string): Promise<void>;
}

export type Backend = DemoBackend | DesktopBackend;
