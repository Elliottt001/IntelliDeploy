# IntelliDeploy 移动端视觉未完成快照

**整体状态：FAIL**

本目录冻结 2026-11-12 当前实现的人工复核材料，用于下期继续修改。它不是批准后的视觉基线，也不能被报告为 Task 12 完成。

2026-11-12 用户明确授权：本次修改可作为“视觉仍为 FAIL 的阶段性版本”提交并合并；16 个失败项转入本目录的下期规划。该授权允许合并，不会把视觉状态改成 PASS，也不批准基线。

## 当前结论

- 原始严格比较：`10 PASS / 16 FAIL`，整体 `FAIL`。
- 阈值保持不变：`MAE <= 0.08` 且 `changedPixelRatio <= 0.03`，`channelDelta = 32`。
- 原始 reference、mask、比较器均未修改。
- 原生 iOS/Android：`NOT_RUN`，缺少 Maestro、已启动并安装匹配构建的设备；React Native SVG 的 morphology 支持仍需真实设备核验。
- `/register`、`/billing`、`/app-detail/[id]` 次级面板、`/community/[id]` 仍为 `VISUAL_PENDING`。
- 真实 API 数据、鉴权、SecureStore、草稿、幂等键、401/402/409、轮询与恢复语义不能为了截图匹配而替换成 Figma 示例事实。

## 目录内容

- `manual-comparison.html`：26 组实现图、参考图及叠图；顶部明确标记 `OVERALL FAIL`，可筛选 PASS/FAIL。
- `visual-report.json`：本轮逐图指标、哈希、阈值、原生和 pending 状态。
- `actual/`：当前代码实现的 26 张 `375x812` 截图。
- `reference/`：原始 26 张 Figma 参考图。
- `overlays/`：当前实现与参考图的 50% 叠图。
- `implementation-plan.md`：下期 TDD 修改和复核计划。

## 当前 FAIL 页面

| 页面 | MAE | changed | 下期首要边界 |
| --- | ---: | ---: | --- |
| store 03 | 0.053356 | 15.336% | 区分静态设计插画与真实 Publication 内容；不得伪造评分/下载量 |
| home 32 | 0.021051 | 3.848% | 展开 Gallery 的材质、袋口和静态装饰 |
| home 33 | 0.019499 | 4.229% | 展开产品卡的表面、图标和效果 |
| home 34 | 0.023060 | 3.937% | 展开社区卡的表面与装饰；不得伪造通知数 |
| home 35 | 0.026994 | 8.360% | “我的”展开材质；不得伪造资料完成度 |
| store 40 | 0.046700 | 12.692% | 排行页静态布局与 shader；排序继续使用真实口径 |
| chatbot 50 | 0.018106 | 3.382% | 真实状态/回复与示例文案分离，排查静态表面残差 |
| chatbot 51 | 0.017356 | 3.311% | 同上 |
| chatbot 52 | 0.019185 | 3.747% | 同上 |
| chatbot 53 | 0.018398 | 3.547% | 同上 |
| chatbot 54 | 0.018317 | 3.522% | 同上 |
| chatbot 55 | 0.017353 | 3.854% | 完整原始回复必须保留，不复制安装示例 |
| chatbot 58 | 0.020826 | 4.369% | 真实 DeliveryResult 与示例成功文案分离 |
| products 57 | 0.038052 | 13.157% | 展开文件夹材质与真实 App 列表 |
| community 59 | 0.043019 | 8.876% | Publication 卡材质；不得伪造点赞、评论、在线数 |
| community 60 | 0.036761 | 7.544% | 同上，并验证真实横向滚动状态 |

## 已通过但仍需保护的页面

`login 01`、`home 02/29/30/31`、`chatbot 46/47/48/49`、`products 56`。下期修改不得使这些页面回归。
