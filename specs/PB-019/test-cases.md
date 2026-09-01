# PB-019 test cases

- Provider switching and exact Gemini/OpenAI multimodal wire shapes; tools disabled,
  fixed endpoint, bounded output, timeout/429/5xx/refusal/malformed handling.
- PNG/JPEG success and canonical hash; MIME/magic mismatch, corrupt/truncated,
  polyglot/trailing bytes, metadata, byte/dimension/pixel and text bounds.
- Strict result fields, confidence finite 0..1, item/list/text bounds and every
  inference evidence reference valid or empty with an explicit missing-data item.
- Anonymous, CSRF, Origin, expected-account, owner IDOR, replay-different-intent,
  quota/rate, credential/provider race, database failure and actual API restart.
- Frontend loading/error/empty/list/detail, account reset/late response, file guards,
  inert hostile provider text, disclaimer, desktop/mobile and regression.
- Real Gemini uses only a generated synthetic chart; validate structured output,
  persistence, owner isolation, restart and absence of secret/data leakage.
