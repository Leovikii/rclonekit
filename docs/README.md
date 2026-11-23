# RcloneKit 设计与开发入口

当前开发版本 **0.1.0-dev.2** 提供 Windows 环境检测、WinGet 安装流程与 WebDAV 配置管理。网页继续通过独立模拟接口预览 WebDAV 交互。原生验收进度见 [Windows 开发记录](development/windows-alpha.md)。

Windows 组件的查询和安装统一交给 WinGet，使用官方发行版和默认安装设置。挂载方案以官方接口及已验证行为为准。开发约束见 [AGENTS.md](../AGENTS.md)。

| 文档 | 用途 |
| --- | --- |
| [原型方案](design/prototype-plan.md) | 已确认需求、页面流程、状态、平台边界及实施顺序 |
| [界面规范](design/ui-guidelines.md) | 从 MpvKit 继承的视觉与交互规则，以及本项目的调整 |
| [验收记录](design/verification.md) | 本轮检查结果与后续原生验收条件 |
| [开发交接](development/0.1.0-dev.2.md) | Windows 桌面入口、检测范围、测试命令、下一阶段 |
| [Windows 开发记录](development/windows-alpha.md) | WinGet 组件管理、实际功能与隔离验收条件 |
| [0.1.0-dev.1 交接](development/0.1.0-dev.1.md) | 网页模拟前端的初始实现和验收记录 |

需求从卡片主页、设置安装、地址与盘符式连接展开。后台挂载应能独立于 GUI 继续运行，采用哪种官方 Windows 机制仍待验收。主页只显示挂载状态，操作错误按需反馈。 [规划 rclone GUI 原型](codex://threads/01a1ce79-8337-79f0-ba1b-0a6e8fe2e9a4)

挂载先按验收时所安装的官方组件默认值测试。局域网与 TCP VPN 共用 WebDAV 地址，首版范围内保持已建立的挂载。 [默认值与超时](design/prototype-plan.md#默认值与超时) · [原生测试基线](design/verification.md#默认参数与移动场景测试基线)

参考项目固定为 [mpvkit / 5c03d9e](https://github.com/Leovikii/mpvkit/tree/5c03d9e928a8a592621d43043d2ebc11091004c8)，核对日期 2026-11-12。只继承适用设计规则，不继承其发布授权、历史测试结论或 MPV 专属行为。
