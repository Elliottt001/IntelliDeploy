from app.agent.contracts import EvidenceRef, RepositoryProfile
from app.agent.ranking import rank_candidate
from app.core.types import AcceptanceItem, CompatibilityReport, Requirement


def notes_requirement() -> Requirement:
    return Requirement(
        prompt="创建可保存的私人笔记应用",
        acceptance=[
            AcceptanceItem(
                id="create-note", action="创建笔记", expected="笔记可见"
            ),
            AcceptanceItem(
                id="persist-note", action="保存笔记", expected="刷新后仍存在"
            ),
        ],
    )


def profile(
    name: str,
    *,
    stars: int = 0,
    project_type: str = "web_app",
    covers=(),
    license_status: str = "ALLOWED",
    compatibility: str = "SUPPORTED",
    missing_entry: bool = False,
) -> RepositoryProfile:
    evidence = [
        EvidenceRef(
            kind="REPOSITORY",
            reference=f"coverage:{acceptance_id}",
            digest=(str(index + 1) * 64)[:64],
            access="PRIVATE",
        )
        for index, acceptance_id in enumerate(covers)
    ]
    evidence.append(
        EvidenceRef(
            kind="PROFILE",
            reference=f"profile:{name}:stars={stars}",
            digest="f" * 64,
            access="PRIVATE",
        )
    )
    return RepositoryProfile(
        repo_url=f"https://github.com/example/{name}",
        commit="a" * 40,
        languages=["typescript"],
        frameworks=[] if project_type == "library" else ["Next.js"],
        project_type=project_type,
        dependency_files=["package.json"],
        lock_files=["pnpm-lock.yaml"],
        package_manager="pnpm",
        entrypoints=[] if missing_entry else ["app/page.tsx"],
        start_commands=[] if missing_entry else ["npm start"],
        build_commands=["npm run build"],
        license_status=license_status,
        compatibility=CompatibilityReport(
            status=compatibility,
            reasons=[],
            runtime="node" if compatibility == "SUPPORTED" else None,
        ),
        evidence_refs=evidence,
    )


def test_matching_application_beats_popular_framework_library():
    app = rank_candidate(
        profile(
            "notes-app",
            stars=50,
            project_type="web_app",
            covers=["create-note", "persist-note"],
        ),
        notes_requirement(),
    )
    framework = rank_candidate(
        profile("ui-library", stars=50000, project_type="library", covers=[]),
        notes_requirement(),
    )

    assert app.total > framework.total
    assert "not_complete_application" in framework.rejection_reasons


def test_unknown_license_and_runtime_prevent_route_a_eligibility():
    result = rank_candidate(
        profile(
            "notes",
            covers=["create-note", "persist-note"],
            license_status="UNKNOWN",
            compatibility="UNKNOWN",
        ),
        notes_requirement(),
    )

    assert result.eligible_a is False
    assert {"license", "runtime_compatibility"} <= set(result.unknown_fields)


def test_low_stars_do_not_reject_a_complete_match():
    result = rank_candidate(
        profile(
            "small-notes",
            stars=0,
            covers=["create-note", "persist-note"],
        ),
        notes_requirement(),
    )

    assert result.eligible_a is True
    assert "low_popularity" not in result.rejection_reasons


def test_missing_core_cannot_be_offset_by_quality_and_all_dimensions_have_evidence():
    result = rank_candidate(
        profile("polished-notes", stars=100000, covers=["create-note"]),
        notes_requirement(),
    )

    assert result.missing_core == ["persist-note"]
    assert result.eligible_a is False
    assert set(result.evidence) >= {
        "match",
        "deploy",
        "quality",
        "change_cost",
        "evidence_confidence",
    }
    assert result.change_cost > 0
    assert 0 <= result.evidence_confidence <= 100
