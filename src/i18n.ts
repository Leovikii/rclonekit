import { AppError, type ErrorCode } from './model.ts';

const zh = {
  drives: '网络驱动器', settings: '设置', back: '返回网络驱动器', add: '添加网络驱动器',
  mounted: '已挂载', unmounted: '未挂载', mounting: '正在挂载', disconnecting: '正在断开',
  connect: '连接', disconnect: '断开', open: '打开', more: '更多操作', edit: '编辑', remove: '删除配置',
  cancel: '取消', close: '关闭', save: '保存', retry: '重试', checking: '正在检查组件',
  setupTitle: '完成安装后即可连接网络驱动器', setupHint: '在设置中安装所需组件。', goSettings: '前往设置',
  appearance: '外观', language: '语言', theme: '主题', system: '跟随系统', light: '浅色', dark: '深色',
  components: '所需组件', installed: '已安装', missing: '未安装', install: '安装所需组件',
  installAction: '安装', installPrompt: '将安装以下缺失组件：', installing: '正在安装所需组件',
  installDone: '所需组件已就绪。', start: '开始连接', restart: '重启后继续',
  restartHint: '组件需要重启后才能使用，请重启系统后重新打开应用。',
  address: 'WebDAV 地址', drive: '盘符', auth: '身份验证（可选）', username: '用户名', password: '密码',
  advanced: '高级选项', readOnly: '只读', editTitle: '编辑网络驱动器', reconnectTitle: '连接网络驱动器',
  httpWarning: '此地址使用未加密的 HTTP 连接。', noDrive: '没有可用盘符，请先释放一个盘符。',
  deleteTitle: '删除配置？', deleteHint: '远端文件和本地缓存将保留。', disconnectFirst: '请先断开后编辑或删除。',
  readFailed: '暂时无法读取挂载状态，请重试。', saved: '已保存配置。', removed: '已删除配置。',
  connected: '挂载完成。', disconnected: '已断开。', opened: '模拟操作：将在文件资源管理器中打开此驱动器。',
  demo: '交互开发版 · 模拟数据，不执行安装或挂载', scenario: '示例场景', repository: '项目仓库',
  ready: '已有挂载', empty: '没有挂载', setup: '首次使用', upload: '断开受阻', network: '网络错误',
  'read-error': '读取失败', 'install-error': '安装部分失败', restartScenario: '安装后需重启',
  preferencesFailed: '偏好无法保存，下次打开可能恢复原设置。',
};
const en: Record<keyof typeof zh, string> = {
  drives: 'Network drives', settings: 'Settings', back: 'Back to network drives', add: 'Add network drive',
  mounted: 'Mounted', unmounted: 'Not mounted', mounting: 'Mounting', disconnecting: 'Disconnecting',
  connect: 'Connect', disconnect: 'Disconnect', open: 'Open', more: 'More actions', edit: 'Edit', remove: 'Delete configuration',
  cancel: 'Cancel', close: 'Close', save: 'Save', retry: 'Retry', checking: 'Checking components',
  setupTitle: 'Install components to connect network drives', setupHint: 'Install the required components in Settings.', goSettings: 'Go to Settings',
  appearance: 'Appearance', language: 'Language', theme: 'Theme', system: 'System', light: 'Light', dark: 'Dark',
  components: 'Required components', installed: 'Installed', missing: 'Not installed', install: 'Install required components',
  installAction: 'Install', installPrompt: 'Install the following missing components:', installing: 'Installing required components',
  installDone: 'Required components are ready.', start: 'Start connecting', restart: 'Restart required',
  restartHint: 'Restart your system and reopen the application to use these components.',
  address: 'WebDAV address', drive: 'Drive letter', auth: 'Authentication (optional)', username: 'Username', password: 'Password',
  advanced: 'Advanced options', readOnly: 'Read only', editTitle: 'Edit network drive', reconnectTitle: 'Connect network drive',
  httpWarning: 'This address uses an unencrypted HTTP connection.', noDrive: 'No drive letters available. Free a drive letter first.',
  deleteTitle: 'Delete configuration?', deleteHint: 'Remote files and local cache will be kept.', disconnectFirst: 'Disconnect before editing or deleting.',
  readFailed: 'Cannot read mount status right now. Please retry.', saved: 'Configuration saved.', removed: 'Configuration deleted.',
  connected: 'Drive mounted.', disconnected: 'Drive disconnected.', opened: 'Simulated action: open this drive in File Explorer.',
  demo: 'Interactive development build · simulated data, no system changes', scenario: 'Example scenario', repository: 'Project repository',
  ready: 'Existing mounts', empty: 'No mounts', setup: 'First launch', upload: 'Disconnect blocked', network: 'Network error',
  'read-error': 'Status read failure', 'install-error': 'Partial installation failure', restartScenario: 'Restart after installation',
  preferencesFailed: 'Could not save preferences. They may reset next time.',
};
const errors: Record<ErrorCode, [string, string]> = {
  invalid_url: ['请输入 HTTP 或 HTTPS 地址，不要在地址中包含凭据或片段。', 'Enter an HTTP or HTTPS address without credentials or a fragment.'],
  unsupported_type: ['此版本仅支持 WebDAV。', 'This version supports WebDAV only.'],
  invalid_drive: ['请选择有效盘符。', 'Select a valid drive letter.'],
  drive_in_use: ['盘符已被占用，请选择其他盘符。', 'This drive letter is in use. Choose another one.'],
  invalid_credentials: ['请检查用户名和密码。', 'Check the username and password.'],
  invalid_input: ['请检查输入内容。', 'Check the input values.'],
  not_found: ['找不到此挂载配置，请刷新后重试。', 'Mount configuration not found. Refresh and retry.'],
  busy: ['操作正在进行，请稍候。', 'An operation is in progress. Please wait.'],
  not_ready: ['请先安装所需组件。', 'Install the required components first.'],
  already_mounted: ['请先断开后再操作。', 'Disconnect the drive first.'],
  not_mounted: ['此驱动器尚未挂载。', 'This drive is not mounted.'],
  pending_uploads: ['仍有文件待上传，请稍后再断开。', 'Files are still waiting to upload. Disconnect later.'],
  status_unavailable: ['暂时无法读取挂载状态，请重试。', 'Cannot read mount status right now. Please retry.'],
  network_error: ['地址无法连接，请检查地址和网络。', 'Cannot connect. Check the address and network.'],
  install_failed: ['WinFsp 安装失败，已安装的 rclone 已保留。', 'WinFsp installation failed. rclone remains installed.'],
  restart_required: ['请重启系统后继续。', 'Restart your system to continue.'],
  operation_failed: ['操作失败，请重试。', 'The operation failed. Please retry.'],
};
export type Language = 'zh' | 'en';
export type TextKey = keyof typeof zh;
export const translator = (language: Language) => (key: TextKey) => (language === 'zh' ? zh : en)[key];
export function errorText(error: unknown, language: Language): string {
  const code = error instanceof AppError ? error.code : 'operation_failed';
  return errors[code][language === 'zh' ? 0 : 1];
}
