import { invoke } from '@tauri-apps/api/core';
import type { DesktopBackend, EnvironmentSnapshot } from './api.ts';
import { AppError } from './model.ts';

async function editConfiguration(command: string, args: Record<string, unknown>) {
  try {
    await invoke(command, args);
  } catch (error) {
    switch (error) {
      case 'invalid_url':
      case 'invalid_credentials':
      case 'drive_in_use':
      case 'network_error':
      case 'connection_check_timeout':
      case 'configuration_unavailable':
      case 'status_unavailable':
      case 'not_found':
        throw new AppError(error);
      default:
        throw new AppError('operation_failed');
    }
  }
}

export const desktopBackend: DesktopBackend = {
  mode: 'desktop',
  async snapshot() {
    const [environment, configurations] = await Promise.all([
      invoke<Omit<EnvironmentSnapshot, 'configurations'>>('read_environment'),
      invoke<EnvironmentSnapshot['configurations']>('list_mount_configs'),
    ]);
    return { ...environment, configurations };
  },
  prepare({ kind, url, username, password, drive, readOnly }, id) {
    return editConfiguration('prepare_mount', { id, input: { connection: { kind, url, username, password }, drive, readOnly } });
  },
  remove(id) {
    return editConfiguration('remove_mount_config', { id });
  },
  async installMissing() {
    try {
      return await invoke('install_components');
    } catch (error) {
      switch (error) {
        case 'busy':
        case 'component_install_failed':
        case 'rclone_install_failed':
        case 'winfsp_install_failed':
        case 'winget_unavailable':
        case 'component_detection_failed':
        case 'install_cancelled':
          throw new AppError(error);
        default:
          throw new AppError('operation_failed');
      }
    }
  },
};
