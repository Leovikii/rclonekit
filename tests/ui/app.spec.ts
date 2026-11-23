import { expect, test, type Page } from '@playwright/test';
import type { EnvironmentSnapshot } from '../../src/api.ts';

const x = (page: Page) => page.getByRole('article', { name: 'X: · dav.example.com', exact: true });
const y = (page: Page) => page.getByRole('article', { name: 'Y: · nas.example.com', exact: true });
async function more(page: Page, drive: 'X:' | 'Y:') {
  await page.getByRole('button', { name: `更多操作 ${drive}`, exact: true }).click();
}
async function installDialog(page: Page) {
  await page.getByRole('button', { name: '前往设置', exact: true }).click();
  await page.getByRole('button', { name: '安装所需组件', exact: true }).click();
  return page.getByRole('dialog');
}
const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { window.addEventListener('unhandledrejection', () => { document.documentElement.dataset.rejected = 'true'; }); });
});
test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([]);
  await expect(page.locator('html')).not.toHaveAttribute('data-rejected', 'true');
});
test('home shows two management states, and only the last card adds a drive', async ({ page }) => {
  await page.goto('/');
  await expect(x(page).getByRole('status')).toHaveText('已挂载');
  await expect(y(page).getByRole('status')).toHaveText('未挂载');
  await expect(page.getByRole('button', { name: '添加网络驱动器', exact: true })).toHaveCount(1);
  await expect(page.getByText('远端健康')).toHaveCount(0);
  await more(page, 'X:');
  await expect(page.getByRole('menuitem', { name: '编辑', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await x(page).getByRole('button', { name: '断开', exact: true }).click();
  await expect(x(page).getByRole('status')).toHaveText('未挂载');
});
test('setup executes confirmation and completion in one dialog', async ({ page }) => {
  await page.goto('/?scenario=setup');
  const dialog = await installDialog(page);
  await expect(dialog.getByText('rclone、WinFsp', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '安装', exact: true }).click();
  await expect(dialog.getByText('所需组件已就绪。')).toBeVisible();
  await dialog.getByRole('button', { name: '关闭', exact: true }).last().click();
  await page.getByRole('button', { name: '开始连接', exact: true }).click();
  await expect(page.getByRole('button', { name: '添加网络驱动器', exact: true })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
});
test('partial installation keeps successful component and retries failure', async ({ page }) => {
  await page.goto('/?scenario=install-error');
  const dialog = await installDialog(page);
  await expect(dialog.getByText('WinFsp', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '安装', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('已安装的 rclone 已保留');
  await dialog.getByRole('button', { name: '重试', exact: true }).click();
  await expect(dialog.getByText('所需组件已就绪。')).toBeVisible();
});
test('restart requirement does not pretend components are usable', async ({ page }) => {
  await page.goto('/?scenario=restart');
  const dialog = await installDialog(page);
  await dialog.getByRole('button', { name: '安装', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('重启');
  await dialog.getByRole('button', { name: '关闭', exact: true }).last().click();
  await expect(page.getByRole('button', { name: '开始连接', exact: true })).toHaveCount(0);
});
test('failed connect retains values; advanced has only read-only', async ({ page }) => {
  await page.goto('/?scenario=network');
  await page.getByRole('button', { name: '添加网络驱动器', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'WebDAV 地址', exact: true }).fill('http://example.com/dav/');
  await expect(dialog.getByText('此地址使用未加密的 HTTP 连接。')).toBeVisible();
  await dialog.getByRole('button', { name: '高级选项', exact: true }).click();
  await expect(dialog.getByRole('checkbox')).toHaveCount(1);
  await dialog.getByRole('checkbox', { name: '只读', exact: true }).check();
  await dialog.getByRole('button', { name: '身份验证（可选）', exact: true }).click();
  await dialog.getByLabel('用户名', { exact: true }).fill('user');
  await dialog.getByLabel('密码', { exact: true }).fill('do-not-persist');
  await dialog.getByRole('button', { name: '连接', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('地址无法连接');
  await expect(dialog.getByRole('textbox', { name: 'WebDAV 地址', exact: true })).toHaveValue('http://example.com/dav/');
  await expect(dialog.getByLabel('密码', { exact: true })).toHaveValue('do-not-persist');
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('do-not-persist');
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '添加网络驱动器', exact: true }).click();
  await dialog.getByRole('button', { name: '身份验证（可选）', exact: true }).click();
  await expect(dialog.getByLabel('密码', { exact: true })).toHaveValue('');
});
test('add, edit, delete and cancellation preserve expected configuration', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '添加网络驱动器', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'WebDAV 地址', exact: true }).fill('https://new.example.com/dav/');
  await dialog.getByRole('button', { name: '连接', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('article')).toHaveCount(3);
  await more(page, 'Y:'); await page.getByRole('menuitem', { name: '编辑', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'WebDAV 地址', exact: true }).fill('https://changed.example.com/');
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(y(page)).toBeVisible();
  await more(page, 'Y:'); await page.getByRole('menuitem', { name: '编辑', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'WebDAV 地址', exact: true }).fill('https://edited.example.com/dav/');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Y: · edited.example.com' })).toBeVisible();
  await more(page, 'Y:'); await page.getByRole('menuitem', { name: '删除配置', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '取消', exact: true })).toBeFocused();
  await dialog.getByRole('button', { name: '删除配置', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '添加网络驱动器', exact: true })).toBeFocused();
});
test('unsafe disconnect only shows a local error and retains mounted state', async ({ page }) => {
  await page.goto('/?scenario=upload');
  await expect(page.getByText('仍有文件待上传，请稍后再断开。')).toHaveCount(0);
  await x(page).getByRole('button', { name: '断开', exact: true }).click();
  await expect(x(page).getByRole('alert')).toContainText('仍有文件待上传');
  await expect(x(page).getByRole('status')).toHaveText('已挂载');
  await expect(x(page).getByRole('button', { name: '断开', exact: true })).toBeEnabled();
});
test('reading failure has retry and never reports unmounted', async ({ page }) => {
  await page.goto('/?scenario=read-error');
  await expect(page.getByRole('alert')).toContainText('暂时无法读取挂载状态');
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(x(page).getByRole('status')).toHaveText('已挂载');
});
test('desktop reads and refreshes the Windows environment', async ({ page }) => {
  await page.addInitScript(() => {
    let checks = 0;
    Object.assign(window, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        async invoke(command: string) {
          if (command === 'list_mount_configs') return [];
          if (command !== 'read_environment') throw new Error(`Unexpected command: ${command}`);
          if (++checks === 1) throw 'drive_query_failed';
          return {
            components: [
              { id: 'rclone', status: 'unknown' },
              { id: 'winfsp', status: checks === 2 ? 'notDetected' : 'unknown' },
              { id: 'winget', status: checks === 2 ? 'detected' : 'notDetected' },
            ],
            availableDrives: checks === 2 ? ['Z:', 'D:'] : [],
            installCandidates: [],
          };
        },
      },
    });
  });
  await page.goto('/?scenario=ready');
  await expect(page.getByText('Windows 开发版', { exact: true })).toBeVisible();
  await expect(page.getByLabel('示例场景')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('暂时无法读取系统环境');
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await expect(page.getByText('rclone', { exact: true })).toBeVisible();
  await expect(page.getByText('无法确认', { exact: true })).toBeVisible();
  await expect(page.getByText('WinGet 未能确认组件安装状态，请重新检测。')).toBeVisible();
  await expect(page.getByRole('button', { name: '安装所需组件', exact: true })).toHaveCount(0);
  await expect(page.getByText('Z: · D:', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重新检测', exact: true }).click();
  await expect(page.getByText('没有可用盘符', { exact: true })).toBeVisible();
  await expect(page.getByText('WinGet 无法使用。请检查 Windows 的应用安装程序，然后重新检测。')).toBeVisible();
  await expect(page.getByRole('button', { name: '安装所需组件', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '返回网络驱动器', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '添加网络驱动器', exact: true })).toBeVisible();
});
test('desktop installs missing components and retries only WinFsp after a partial failure', async ({ page }) => {
  await page.addInitScript(() => {
    let attempts = 0;
    Object.assign(window, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        async invoke(command: string) {
          if (command === 'list_mount_configs') return [];
          if (command === 'install_components') {
            if (++attempts === 1) throw 'winfsp_install_failed';
            return { restartRequired: true };
          }
          if (command !== 'read_environment') throw new Error(`Unexpected command: ${command}`);
          return {
            components: [
              { id: 'rclone', status: attempts ? 'detected' : 'notDetected' },
              { id: 'winfsp', status: 'notDetected' },
              { id: 'winget', status: 'detected' },
            ],
            availableDrives: ['Z:'],
            installCandidates: attempts ? ['winfsp'] : ['rclone', 'winfsp'],
          };
        },
      },
    });
  });
  await page.goto('/');
  const dialog = await installDialog(page);
  await expect(dialog.getByText('rclone、WinFsp', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '安装', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('WinGet 未能完成 WinFsp 安装');
  await expect(dialog.getByText('WinFsp', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '重试', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('重启');
  await dialog.getByRole('button', { name: '关闭', exact: true }).last().click();
  await expect(page.getByRole('button', { name: '安装所需组件', exact: true })).toHaveCount(0);
  await expect(page.getByText('已检出', { exact: true })).toHaveCount(2);
});
test('desktop edits and deletes only configurations with confirmed unmounted state', async ({ page }) => {
  await page.addInitScript(() => {
    const configurations: EnvironmentSnapshot['configurations'] = [{
      id: 'unknown-mount', connection: { kind: 'webdav', url: 'https://nas.example.com/dav/', username: '' },
      target: { kind: 'driveLetter', value: 'Y:' }, mounted: null, readOnly: false,
    }];
    let removalAttempts = 0;
    Object.assign(window, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        async invoke(command: string, parameters?: { id?: string; input?: { connection: { kind: 'webdav'; url: string; username: string }; drive: string; readOnly: boolean } }) {
          if (command === 'read_environment') return { components: [], availableDrives: ['Y:', 'Z:'], installCandidates: [] };
          if (command === 'list_mount_configs') return structuredClone(configurations);
          if (command === 'prepare_mount' && parameters?.input) {
            const { connection, drive, readOnly } = parameters.input;
            const config = {
              id: 'saved-mount', connection: { kind: connection.kind, url: connection.url, username: connection.username },
              target: { kind: 'driveLetter' as const, value: drive }, mounted: false, readOnly,
            };
            if (parameters.id === 'saved-mount') configurations[1] = config;
            else if (parameters.id === undefined) configurations.push(config);
            else throw 'not_found';
            return;
          }
          if (command === 'remove_mount_config' && parameters?.id === 'saved-mount') {
            if (++removalAttempts === 1) throw 'status_unavailable';
            configurations.pop();
            return;
          }
          throw new Error(`Unexpected command: ${command}`);
        },
      },
    });
  });
  await page.goto('/');
  const unknown = page.getByRole('article', { name: 'Y: · nas.example.com', exact: true });
  await expect(unknown.getByRole('alert')).toContainText('暂时无法读取挂载状态');
  await expect(unknown.getByRole('status')).toHaveCount(0);
  await expect(unknown.getByRole('button', { name: '更多操作 Y:' })).toHaveCount(0);
  await unknown.getByRole('button', { name: '重试', exact: true }).click();
  await page.getByRole('button', { name: '添加网络驱动器', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('盘符')).toHaveValue('Z:');
  await dialog.getByRole('textbox', { name: 'WebDAV 地址', exact: true }).fill('https://new.example.com/dav/');
  await dialog.getByRole('button', { name: '保存配置', exact: true }).click();
  const saved = page.getByRole('article', { name: 'Z: · new.example.com', exact: true });
  await expect(saved.getByRole('status')).toHaveText('未挂载');
  await expect(saved.getByRole('button', { name: '打开', exact: true })).toHaveCount(0);
  await saved.getByRole('button', { name: '更多操作 Z:', exact: true }).click();
  await page.getByRole('menuitem', { name: '编辑', exact: true }).click();
  await expect(dialog.getByLabel('盘符')).toHaveValue('Z:');
  await dialog.getByRole('textbox', { name: 'WebDAV 地址', exact: true }).fill('https://edited.example.com/dav/');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  const edited = page.getByRole('article', { name: 'Z: · edited.example.com', exact: true });
  await edited.getByRole('button', { name: '更多操作 Z:', exact: true }).click();
  await page.getByRole('menuitem', { name: '删除配置', exact: true }).click();
  const confirm = dialog.getByRole('button', { name: '删除配置', exact: true });
  await confirm.click();
  await expect(dialog.getByRole('alert')).toContainText('暂时无法读取挂载状态');
  await confirm.click();
  await expect(edited).toHaveCount(0);
  await expect(unknown).toBeVisible();
});
test('one card operation does not prevent an unrelated card operation', async ({ page }) => {
  await page.goto('/');
  await x(page).getByRole('button', { name: '断开', exact: true }).click();
  await expect(y(page).getByRole('button', { name: '连接', exact: true })).toBeEnabled();
  await y(page).getByRole('button', { name: '连接', exact: true }).click();
  await expect(x(page).getByRole('status')).toHaveText('未挂载');
  await expect(y(page).getByRole('status')).toHaveText('已挂载');
});
test('modal traps keyboard focus and Escape returns to the trigger', async ({ page }) => {
  await page.goto('/');
  const add = page.getByRole('button', { name: '添加网络驱动器', exact: true });
  await add.click();
  await expect(page.getByRole('textbox', { name: 'WebDAV 地址', exact: true })).toBeFocused();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(add).toBeFocused();
});
test('language and theme survive reload and translated controls work', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByLabel('语言', { exact: true }).selectOption('en');
  await page.getByLabel('Theme', { exact: true }).selectOption('dark');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Network drives');
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark');
  await page.getByRole('button', { name: 'Add network drive', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('WebDAV address');
});
test('layouts fit widths, themes, English and 200% text without horizontal overflow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(x(page)).toBeVisible();
  await page.screenshot({ path: '.tools/qa/home-light-760.png' });
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByLabel('语言', { exact: true }).selectOption('en');
  for (const theme of ['light', 'dark']) {
    await page.getByLabel('Theme', { exact: true }).selectOption(theme);
    for (const width of [1024, 760, 480, 320]) {
      await page.setViewportSize({ width, height: 760 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  await page.setViewportSize({ width: 480, height: 600 });
  await page.getByRole('button', { name: 'Back to network drives', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 640 });
  await page.screenshot({ path: '.tools/qa/home-dark-en-320.png' });
  await page.setViewportSize({ width: 480, height: 600 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Add network drive', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Connect', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Connect', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await page.setViewportSize({ width: 760, height: 760 });
  await page.screenshot({ path: '.tools/qa/home-dark-en-760.png' });
});
test('long addresses, menu keyboard and high contrast preserve usable controls', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '添加网络驱动器', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'WebDAV 地址', exact: true }).fill('https://long.example.com/' + 'long-directory-name/'.repeat(12));
  await dialog.getByRole('button', { name: '连接', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Z: · long.example.com', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 480, height: 600 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '更多操作 Y:', exact: true }).focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect.poll(() => menu.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: '编辑', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '更多操作 Y:', exact: true })).toBeFocused();
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '添加网络驱动器', exact: true }).click();
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '添加网络驱动器', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.tools/qa/long-address-high-contrast.png' });
});
