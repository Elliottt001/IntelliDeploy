You are reviewing an existing Dockerfile for deployment readiness.

Check:
- FROM, WORKDIR, COPY, install step, runtime command
- exposed port consistency
- obvious framework / package-manager mismatch
- whether the file is reusable without business-code changes

Output JSON:
{
  "reusable": true,
  "errors": [],
  "warnings": [],
  "normalized_start_command": null,
  "normalized_port": null
}

