# Windows 开发记录

2026-11-19，适用于 0.1.0-dev.2。当前桌面版提供 WinGet 组件检测和安装，以及 WebDAV 配置管理。

## 实现范围

| 功能 | 当前实现 |
| --- | --- |
| 组件检测 | 运行 Windows 应用安装程序提供的 `winget.exe --version`。通过 `winget list --id <ID> --exact --source winget --disable-interactivity` 查询 `Rclone.Rclone` 和 `WinFsp.WinFsp`。区分查到、查无匹配和查询失败。查到只表示存在 WinGet 可识别的安装记录。 |
| 组件安装 | 由用户从设置发起。重新查询两项，结果都明确后才将缺失项交给 `winget install --id <ID> --exact --source winget --no-upgrade`。WinGet 选择默认版本、架构、安装范围和安装器，并负责下载、校验及所需交互。成功后复查安装记录，部分成功保留已安装项，需重启时在当前窗口提示。 |
| 盘符 | 用 Windows `GetLogicalDrives` 读取当前会话的可用 D: 至 Z:。保存配置时复查盘符与已有记录。 |
| WebDAV 配置 | 保存前发送一次标准只读 `PROPFIND`，使用 `Depth: 0`、系统 TLS 和 15 秒总预算，拒绝重定向。通过后原子写入应用本地配置。密码仅用于预检，连接与挂载有独立 UUID。 |
| 旧服务记录 | 只读查询 Windows 服务控制管理器。只有系统明确报告对应服务不存在时，才将该配置显示为未挂载并允许编辑或删除。查询失败或已存在登记时提示无法确认状态。 |
| 网页预览 | 继续由独立模拟接口演示安装、连接、断开和错误反馈。 |

## 组件维护边界

WinGet 是 Windows 组件管理的唯一入口。应用内实现检测和安装缺失项，升级与卸载仍由 WinGet 命令提供。代码已移除直接下载 ZIP / MSI、向应用目录或服务目录复制 rclone、固定组件版本与摘要，以及试验性的服务部署、提权与凭据交接、rclone 配置加密和 RC 认证材料生成。[开发约定](../../AGENTS.md)

[WinGet 查询](https://learn.microsoft.com/en-us/windows/package-manager/winget/list) · [WinGet 安装](https://learn.microsoft.com/en-us/windows/package-manager/winget/install) · [Windows 服务访问权限](https://learn.microsoft.com/en-us/windows/win32/services/service-security-and-access-rights)

## 本轮验证

- Windows x64 下 10 项 Rust 源码测试通过，桌面开发构建通过。测试覆盖包查询结果区分、盘符、只读服务查询、配置竞争与 WebDAV 回环预检。
- `pnpm check` 通过类型检查、13 项模型／模拟接口测试、网页构建及 16 项 Edge 浏览器测试。桌面安装部分失败、重试和重启提示使用模拟 IPC。
- 实际 WebView2 设置页接通 WinGet 1.30.310，首次与再次检测均报告 rclone 和 WinFsp 未检出。直接执行相同 WinGet 查询也得到查无匹配的返回码。本轮只查询组件状态。

## 后续验收

当前没有可回滚的 Windows 测试虚拟机。WinGet 实际安装、权限提示、重启后驱动就绪与真实 WebDAV 挂载留待隔离环境。挂载、断开和开机连接尚未接入。后续从官方 Windows 服务机制与组件默认值开始，记录实测版本，验证服务权限、跨会话盘符、打开文件及写回行为，再确定界面可承诺的操作范围。[rclone 官方服务集成](https://rclone.org/install/#mount-command-built-in-service-integration)
