# Changelog

本文件从 v1.0.5 开始记录。

## [1.0.6] - 2026-08-24

### Changed

- **npm 包名改为 `dsh-kun-pet`**：原包名 `dsh-kun-like-pet` 与 liyupi 原版（85★）撞名，DSH 插件市场按 pkg_name 去重时隐藏低星同名仓库；改名后市场可正常收录。插件 id（`kun-like-pet`）与 GitHub 仓库名不变。
- README 安装/更新/卸载命令、npm 徽章与 node_modules 路径同步更新为新包名。

## [1.0.5] - 2026-08-17

### Fixed

- 修复 `ask_user_question` 提问瞬间已播放提示音后，同一回合停止输出时重复播放的问题。
- 清理每轮 `turnFlags` 残留，避免跨回合 `played`/`errored` 状态污染。
