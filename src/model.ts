export type Connection = { kind: 'webdav'; url: string; username: string };
export type MountTarget = { kind: 'driveLetter'; value: string };
export type Mount = {
  id: string;
  connection: Connection;
  target: MountTarget;
  readOnly: boolean;
  mounted: boolean;
};
export type Draft = {
  kind: 'webdav';
  url: string;
  drive: string;
  username: string;
  password: string;
  readOnly: boolean;
};
export type ErrorCode =
  | 'invalid_url' | 'unsupported_type' | 'invalid_drive' | 'drive_in_use'
  | 'invalid_credentials' | 'invalid_input' | 'not_found' | 'busy' | 'not_ready'
  | 'already_mounted' | 'not_mounted' | 'pending_uploads' | 'status_unavailable'
  | 'network_error' | 'install_failed' | 'restart_required' | 'operation_failed';

export class AppError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode) {
    super(code);
    this.name = 'AppError';
    this.code = code;
  }
}

// Project choices only; omitted rclone options inherit the pinned version's defaults.
export const mountDefaults = Object.freeze({
  networkMode: true,
  cacheMode: 'full',
  cacheTargetGiB: 10,
  autoConnect: false,
});

export function validateDraft(draft: Draft): Draft {
  if (!draft || typeof draft !== 'object') throw new AppError('invalid_input');
  if (draft.kind !== 'webdav') throw new AppError('unsupported_type');
  if (typeof draft.url !== 'string' || typeof draft.drive !== 'string'
    || typeof draft.username !== 'string' || typeof draft.password !== 'string'
    || typeof draft.readOnly !== 'boolean') throw new AppError('invalid_input');
  const address = draft.url.trim();
  if (/[\u0000-\u0020\u007f]/.test(address)) throw new AppError('invalid_url');
  let url: URL;
  try { url = new URL(address); } catch { throw new AppError('invalid_url'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname
    || url.username || url.password || url.hash || address.includes('#')
    || address.includes('\\')) throw new AppError('invalid_url');
  if (!/^[D-Z]:$/.test(draft.drive)) throw new AppError('invalid_drive');
  if (/[\r\n\0]/.test(draft.username) || /[\r\n\0]/.test(draft.password)
    || (!draft.username.trim() && draft.password)) throw new AppError('invalid_credentials');
  return { ...draft, url: url.href, username: draft.username.trim() };
}

export function draftFor(mount?: Mount, availableDrives: string[] = []): Draft {
  return {
    kind: 'webdav',
    url: mount?.connection.url ?? '',
    drive: mount?.target.value ?? availableDrives[0] ?? '',
    username: mount?.connection.username ?? '',
    password: '',
    readOnly: mount?.readOnly ?? false,
  };
}

export function mountTitle(mount: Mount): string {
  return `${mount.target.value} · ${new URL(mount.connection.url).hostname}`;
}
