from __future__ import annotations

from fallback.schemas.response import ClassifyResponse

# ---------------------------------------------------------------------------
# Missing-component 分类(全局唯一定义点)
#
# 设计意图: 把 "缺什么" 按部署语义分桶,而不是在求解器里写死一个白名单做反向
# 判定 ("不在白名单 == 阻塞部署") —— 那种写法会让任何"白名单未覆盖"的合法
# 缺失也阻塞部署,本质上违反零信任用户代码原则。
#
# 扩展规则: 新增 missing 类型只需把名字加入下面三个集合中的一个;不要在调用方
# (patch_generate / solve / 任何 validator)再写额外白名单。任何不在三类中的
# 名字会进入 UNKNOWN 桶,触发 warning 提醒维护者补全分类规则,但不会阻塞部署。
# ---------------------------------------------------------------------------

# 缺失意味着 IntelliDeploy 无法生成可部署产物 —— 必须真正修补到位才允许部署。
REPAIR_REQUIRED: frozenset[str] = frozenset({"Dockerfile"})

# Decision B 直接能生成补丁覆盖的组件(Dockerfile 同时属于 REQUIRED 和 SUPPORTED:
# 既必修又能修)。
REPAIR_SUPPORTED: frozenset[str] = frozenset(
    {"Dockerfile", ".env.example", "env_example", "start_script"}
)

# 缺失对部署不是必要条件:
#   docker_compose      —— 有 Dockerfile 就足够,单容器部署不需要 compose
#   healthcheck         —— 由 k8s readinessProbe 默认 / Dockerfile HEALTHCHECK 指令兜底
#   build_script        —— 静态语言或不需要构建步骤的项目(Go / Python wheel-only)
#   entry_file          —— 探针对 main/index 等命名匹配失败时,Dockerfile 已确定入口
#   dependency_file     —— 语言/工具差异(go.mod / Cargo.toml / pom.xml)导致名称匹配不到
OPTIONAL_OR_INFORMATIONAL: frozenset[str] = frozenset(
    {
        "docker_compose",
        "healthcheck",
        "build_script",
        "entry_file",
        "dependency_file",
    }
)


def classify_missing_component(name: str) -> str:
    """返回 missing component 的语义类别: REPAIR_REQUIRED / REPAIR_SUPPORTED /
    OPTIONAL_OR_INFORMATIONAL / UNKNOWN。同名既必修又能修时优先返回 REPAIR_REQUIRED。
    """
    if name in REPAIR_REQUIRED:
        return "REPAIR_REQUIRED"
    if name in REPAIR_SUPPORTED:
        return "REPAIR_SUPPORTED"
    if name in OPTIONAL_OR_INFORMATIONAL:
        return "OPTIONAL_OR_INFORMATIONAL"
    return "UNKNOWN"


def collect_missing_components(classify_response: ClassifyResponse) -> list[str]:
    ordered: list[str] = []
    for item in (
        list(classify_response.evaluation_result.repair_targets)
        + list(classify_response.repo_fact_summary.missing_components)
        + list(classify_response.repo_fact_summary.missing_items)
    ):
        if item and item not in ordered:
            ordered.append(item)

    if not ordered and not classify_response.repo_fact_summary.has_valid_dockerfile:
        ordered.append("Dockerfile")
    return ordered
