You are reflecting on a failed fallback repair attempt.

Given:
- previous patch plan
- validation errors
- repository context

Task:
- identify why the prior patch failed
- propose a narrower correction
- do not broaden scope unless required by an explicit error

Output JSON:
{
  "failure_reason": "",
  "next_patch_focus": [],
  "should_regenerate": false
}

