你现在要实现 `validators/dockerfile_validator.py`。

功能
- 校验 Dockerfile 是否满足云部署最小要求。

上游信息接口
- 输入：dockerfile_content 或 dockerfile_path、FallbackPlan。
- 来源：A 复用/生成、B/C 后处理。

下游信息接口
- 输出：ValidationCheck 列表。
- 供 validation_pipeline 使用。

实现
- 检查 FROM、WORKDIR、COPY、RUN、EXPOSE、CMD/ENTRYPOINT。
- 检查基础镜像与 package manager、语言栈是否冲突。
- 检查 EXPOSE 与 plan 端口是否一致。
- 对多阶段构建允许通过，但要保证最终阶段可启动。

不接受的实现方式
- 不要只做字符串 contains。
- 不要忽略 CMD/ENTRYPOINT 缺失。

验收标准
- 能识别结构性缺陷和端口冲突。
