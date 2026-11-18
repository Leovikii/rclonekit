import type { Draft, Mount } from './model.ts';

export type Component = { id: 'rclone' | 'winfsp'; installed: boolean };
export type Snapshot = {
  components: Component[];
  mounts: Mount[];
  availableDrives: string[];
  capabilities: { target: 'driveLetter'; connections: ['webdav']; systemOperations: boolean };
  restartRequired: boolean;
};

// The desktop implementation will invoke Rust commands; pages use no OS or rclone APIs.
export interface Backend {
  snapshot(): Promise<Snapshot>;
  add(draft: Draft): Promise<Mount>;
  update(id: string, draft: Draft): Promise<Mount>;
  connect(id: string, password?: string): Promise<void>;
  disconnect(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  installMissing(): Promise<void>;
  openMount(id: string): Promise<void>;
}
