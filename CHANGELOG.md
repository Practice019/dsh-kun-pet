# Changelog

本文件从 v1.0.5 开始记录。

## [1.0.5] - 2026-08-17

### Fixed

- 修复 `ask_user_question` 提问瞬间已播放提示音后，同一回合停止输出时重复播放的问题。
- 清理每轮 `turnFlags` 残留，避免跨回合 `played`/`errored` 状态污染。
