# Golden Cases

Purpose:
- Lock prompt input/output contracts for high-frequency main flow intents.
- Prevent format drift when prompt text is updated.

How to extend:
1. Add a new case to `main_flow_cases.json`.
2. Include complete `input` fields required by prompt metadata.
3. Provide expected `golden_output` that conforms to bound schema.
4. Run `pytest tests/prompts -q`.
