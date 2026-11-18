import { expect, test, type Page } from '@playwright/test';

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
  await page.keyboard.press('Enter'); await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: '编辑', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '更多操作 Y:', exact: true })).toBeFocused();
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '添加网络驱动器', exact: true }).click();
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '添加网络驱动器', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.tools/qa/long-address-high-contrast.png' });
});
