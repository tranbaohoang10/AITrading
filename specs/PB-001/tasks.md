# PB-001 task and evidence map — Refs #4

| Task | Scope | AC | Verification |
| --- | --- | --- | --- |
| T01 | Inventory/provenance/backlog; restore frontend only | 01 | Branch/blob checks; diff excludes protected records |
| T02 | npm lockfile, maintained compatible fixes | 02 | npm ci --ignore-scripts; npm audit; lint/build/tests |
| T03 | Shell/nav/modal/tabs/branding/theme | 03,04,07 | Original regression + new boundary/focus tests; browser screenshots |
| T04 | Prompt/duplicate/timers/clipboard safeguards | 05,06 | Negative/edge/security tests; browser error/keyboard flows |
| T05 | Docs and publication | all | Complete test-cases, diff/scope review, commit Refs #4, push/verify/close |

Required frontend commands: npm run lint; npm run build; npm test;
npm audit --audit-level=high. Actual browser inspection via Browser skill at
390/1024/1440 plus breakpoint unit cases. No backend build applies yet.
