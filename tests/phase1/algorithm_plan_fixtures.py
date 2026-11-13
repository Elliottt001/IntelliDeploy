from app.agent.contracts import EvidenceRef, RepositoryProfile
from app.core.types import AcceptanceItem, CompatibilityReport, RepoSource, Requirement, RoutePlan


def source(role="principal", char="a"):
    return RepoSource(url=f"https://github.com/example/{role}", commit=char * 40, role=role)


def requirement():
    return Requirement(prompt="保存笔记并搜索来源", acceptance=[
        AcceptanceItem(id="save", action="保存笔记", expected="刷新保留"),
        AcceptanceItem(id="search", action="搜索", expected="显示来源"),
    ])


def profile(item, covered=(), license_status="ALLOWED"):
    return RepositoryProfile(
        repo_url=item.url, commit=item.commit, project_type="web_app",
        frameworks=["Next.js"], dependency_files=["package.json"],
        lock_files=["package-lock.json"], package_manager="npm",
        entrypoints=["app/page.tsx"], start_commands=["npm run start"],
        build_commands=["npm run build"], ports=[3000],
        license_status=license_status,
        compatibility=CompatibilityReport(status="SUPPORTED", runtime="node"),
        evidence_refs=[EvidenceRef(kind="PROFILE", reference=f"coverage:{acceptance_id}",
                                   digest="f" * 64, access="PRIVATE") for acceptance_id in covered],
    )


def route(name="MODIFY_EXISTING", items=None):
    return RoutePlan(route=name, sources=items if items is not None else [source()],
                     steps=["prepare"], reason="fixture", confidence="HIGH")
