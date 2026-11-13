import pytest
from algorithm_plan_fixtures import profile, route, source
from app.agent.packaging import plan_packaging, apply_packaging_plan


def test_packaging_replaces_only_evidenced_start_command(tmp_path):
    text = ('FROM node:20-alpine\nWORKDIR /app\nCOPY . .\n'
            'RUN npm ci && npm run build\nEXPOSE 3000\nCMD ["npm", "run", "dev"]\n')
    (tmp_path / "Dockerfile").write_text(text)
    (tmp_path / "package.json").write_text(
        '{"scripts":{"dev":"next dev","build":"next build","start":"next start"}}')
    (tmp_path / "package-lock.json").write_text("{}")
    planned = plan_packaging(str(tmp_path), profile(source()), route())
    assert planned.action == "NORMALIZE"
    apply_packaging_plan(str(tmp_path), planned)
    assert (tmp_path / "Dockerfile").read_text() == text.replace(
        '["npm", "run", "dev"]', '["npm", "run", "start"]')
    assert plan_packaging(str(tmp_path), profile(source()), route()).safe_edits == []


def test_no_production_build_cannot_rewrite_next_dev(tmp_path):
    (tmp_path / "Dockerfile").write_text('FROM node:20\nCOPY . .\nCMD ["next", "dev"]\n')
    (tmp_path / "package.json").write_text('{"scripts":{"start":"next start"}}')
    plan = plan_packaging(str(tmp_path), profile(source()), route())
    assert plan.action == "BLOCKED"
    assert not plan.safe_edits


def test_changed_input_and_symlink_are_rejected(tmp_path):
    (tmp_path / "Dockerfile").write_text('FROM scratch\nCMD ["/server"]\n')
    planned = plan_packaging(str(tmp_path), None, route())
    (tmp_path / "Dockerfile").write_text('FROM scratch\nCMD ["/other"]\n')
    with pytest.raises(ValueError, match="input changed"):
        apply_packaging_plan(str(tmp_path), planned)
    (tmp_path / "Dockerfile").unlink()
    (tmp_path / "Dockerfile").symlink_to(tmp_path / "elsewhere")
    with pytest.raises(ValueError, match="symbolic link"):
        plan_packaging(str(tmp_path), None, route())


def test_expose_is_not_overridden_by_profile_guess(tmp_path):
    (tmp_path / "Dockerfile").write_text('FROM nginx:1.27\nEXPOSE 80\nCMD ["nginx", "-g", "daemon off;"]\n')
    plan = plan_packaging(str(tmp_path), profile(source()), route())
    assert plan.action == "BLOCKED"
    assert any(f.code == "PORT_CONFLICT" for f in plan.findings)
    assert not plan.safe_edits


def test_missing_cmd_can_use_proven_production_script(tmp_path):
    (tmp_path / "Dockerfile").write_text('FROM node:20\nWORKDIR /app\nCOPY . .\nRUN npm ci && npm run build\nEXPOSE 3000\n')
    (tmp_path / "package.json").write_text('{"scripts":{"start":"next start","build":"next build"}}')
    (tmp_path / "package-lock.json").write_text('{}')
    plan = plan_packaging(str(tmp_path), profile(source()), route())
    assert plan.action == "NORMALIZE"
    assert plan.start_command == ["npm", "run", "start"]
    apply_packaging_plan(str(tmp_path), plan)
    assert 'CMD ["npm", "run", "start"]' in (tmp_path / "Dockerfile").read_text()


def test_repeated_apply_does_not_ignore_changed_package_inputs(tmp_path):
    (tmp_path / "Dockerfile").write_text('FROM scratch\nCMD ["/server"]\n')
    (tmp_path / "package.json").write_text('{}')
    applied = apply_packaging_plan(str(tmp_path), plan_packaging(str(tmp_path), None, route()))
    (tmp_path / "package.json").write_text('{"scripts":{"start":"different"}}')
    with pytest.raises(ValueError, match="input changed"):
        apply_packaging_plan(str(tmp_path), applied)
