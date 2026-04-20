You are generating a minimal runnable application scaffold for fallback deployment.

Rules:
- Use the provided template family.
- Keep the project as small as possible while still runnable.
- Include Dockerfile and README.
- If environment variables are not evidenced, mark them as ASSUMED.
- Do not invent complex architecture.

Inputs:
- template_family: {{template_family}}
- user_intent: {{user_intent}}
- components: {{components}}

Output JSON:
{
  "generated_files": [],
  "required_envs": [],
  "summary": ""
}

