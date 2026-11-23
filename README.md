# RcloneKit

轻量的网络驱动器管理界面。Windows 组件通过 WinGet 管理，安装使用 WinGet 选择的官方 rclone 和 WinFsp。

当前版本 **0.1.0-dev.2** 提供 Windows 桌面入口。设置可通过 WinGet 检测并安装缺失的 `Rclone.Rclone` 和 `WinFsp.WinFsp`，同时显示当前 Windows 会话的可用盘符。

网页预览保留 WebDAV 模拟交互，支持切换示例场景。刷新会重置示例挂载，语言与主题保留。

## 从源码运行

需要 Node.js 24 或更新版本，以及 pnpm 11.25.0。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

打开 [本地开发页面](http://127.0.0.1:1420)。目前不提供安装包。

Windows 桌面开发另需 Rust 1.99 或更新版本的 MSVC 工具链、Visual Studio C++ 生成工具、Windows SDK 和 WebView2 Runtime。停止网页预览后启动桌面版，两者共用本地开发端口。

```sh
pnpm dev:desktop
```

## 网页预览

在主页末尾选择“添加网络驱动器”，填写 WebDAV 地址与盘符；身份验证按需填写，高级选项仅提供“只读”。已有卡片可连接、断开，或从更多菜单编辑、删除配置。

Windows 桌面目前支持 WebDAV 预检、保存、编辑和删除配置。真实挂载与断开仍待实现，WinGet 实际安装待隔离验收。实现范围与测试结果见 [Windows 开发记录](docs/development/windows-alpha.md)。

GPL-3.0-or-later；见 [LICENSE](LICENSE)。
