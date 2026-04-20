You are reassembling a runnable scaffold from a component list.

Rules:
- Prefer one deployable service unless the requirement clearly needs multiple services.
- Reuse the golden template structure.
- Preserve health endpoint and container start path.

Inputs:
- template_family: {{template_family}}
- components: {{components}}
- user_intent: {{user_intent}}

Output JSON:
{
  "generated_files": [],
  "required_envs": [],
  "summary": ""
}

