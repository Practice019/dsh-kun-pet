# Changelog

本文件从 v1.0.5 开始记录。

## [1.0.7] - 2026-09-01

### Fixed

- **修复改名残留导致加载崩溃**：`cordis.patch.yml` 的 entry `name` 与 `lib/client.js` 的模块注册 `id` 仍指向旧包名 `dsh-kun-like-pet`，DSH 按新包名 `dsh-kun-pet` import 时找不到包（`ERR_MODULE_NOT_FOUND`）或 bundle 注册 ID 不匹配（`loaded without registering`），导致整个插件树加载失败、`dsh web` 崩溃。
- 同步修正 `package.json` 的 `repository.url` 与 README 中的 GitHub 仓库链接、安装命令，统一指向 `dsh-kun-pet`。

## [1.0.6] - 2026-08-24

### Changed

- **npm 包名改为 `dsh-kun-pet`**：原包名 `dsh-kun-like-pet` 与 liyupi 原版（85★）撞名，DSH 插件市场按 pkg_name 去重时隐藏低星同名仓库；改名后市场可正常收录。插件 id（`kun-like-pet`）与 GitHub 仓库名不变。
- README 安装/更新/卸载命令、npm 徽章与 node_modules 路径同步更新为新包名。

## [1.0.5] - 2026-08-17

### Fixed

- 修复 `ask_user_question` 提问瞬间已播放提示音后，同一回合停止输出时重复播放的问题。
- 清理每轮 `turnFlags` 残留，避免跨回合 `played`/`errored` 状态污染。
