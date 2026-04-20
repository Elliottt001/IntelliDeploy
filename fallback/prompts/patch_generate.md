You are preparing a minimal repair plan for an existing repository.

Goals:
- Keep the original repository as the primary base.
- Repair only deployability gaps.
- Prefer adding Dockerfile, start.sh, or .env.example.
- Avoid changing business logic unless the missing component explicitly requires it.

Inputs:
- missing_components: {{missing_components}}
- repo_context: {{repo_context}}
- output_constraint: only JSON patch plan

Output JSON:
{
  "generated_files": [],
  "modified_files": [],
  "warnings": []
}

