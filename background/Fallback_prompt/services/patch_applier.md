你现在要实现 `services/patch_applier.py`。

功能
- 将 plan 中的 GeneratedFile / ModifiedFile 真正写入 workspace。
- 提供 patch 落盘与变更清单生成能力。

上游信息接口
- 输入：workspace_path、generated_files、modified_files、patch_plan。
- 来源：A/B/C 的 solve 输出。

下游信息接口
- 输出：PatchApplyResult，至少包含 created_files、updated_files、skipped_files、conflicts、logs。
- 供 workspace_manager、artifact_builder 使用。

实现
- 支持新增文件、覆盖文件、目录自动创建。
- 修改前生成 before/after 摘要，便于写入 manifest。
- 对 ModifiedFile 必须校验目标路径存在性和路径安全。
- 支持 dry_run 模式用于预检。
- 文件写入统一编码 UTF-8。
- 对二进制文件或未知类型要明确拒绝或单独处理。

不接受的实现方式
- 不要只返回 patch plan，不做真实落盘。
- 不要允许相对路径跳出 workspace 根目录。

验收标准
- plan 中的改动能真实反映到 workspace 文件系统。
- 变更清单完整可追溯。
