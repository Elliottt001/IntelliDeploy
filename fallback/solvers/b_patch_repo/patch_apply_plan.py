from __future__ import annotations

from fallback.schemas.plan import GeneratedFile, ModifiedFile


def build_modified_file(path: str, content: str, rationale: str) -> ModifiedFile:
    patch = f"Apply the following content to `{path}`:\n\n{content}"
    return ModifiedFile(path=path, patch=patch, rationale=rationale)


def split_patch_outputs(items: list[tuple[str, str, str]], existing_paths: set[str]) -> tuple[list[GeneratedFile], list[ModifiedFile]]:
    generated_files: list[GeneratedFile] = []
    modified_files: list[ModifiedFile] = []
    for path, content, rationale in items:
        if path in existing_paths:
            modified_files.append(build_modified_file(path, content, rationale))
        else:
            generated_files.append(GeneratedFile(path=path, content=content))
    return generated_files, modified_files

