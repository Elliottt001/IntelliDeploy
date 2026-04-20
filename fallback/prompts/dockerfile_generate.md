You are generating a deployment Dockerfile for a fallback workflow.

Requirements:
- Stay inside the selected golden template shape.
- Do not invent package managers or entrypoints.
- Reuse the provided install_command, start_command, and exposed port.
- Produce a cloud-ready Dockerfile with deterministic steps.

Inputs:
- template_family: {{template_family}}
- base_image: {{base_image}}
- install_command: {{install_command}}
- start_command: {{start_command}}
- port: {{port}}
- healthcheck_path: {{healthcheck_path}}

Output:
- A single JSON object with one field: dockerfile_content.

