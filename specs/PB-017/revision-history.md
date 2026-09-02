# PB-017 revision history

- 01/09/2026: Issue #26 created before code. Defined strict repository-evidence
  comparison with explicit raw-compact versus assertion-certified Pine modes;
  no target rerun, broker/network access, database or UI change.
- 02/09/2026: Recovered the interrupted uncommitted work without reset, clean or
  recreation. The bounded verifier and negative tests PASS all eight fixtures:
  51 bars, 1,359 Pine assertion values, 764 retained Pine raw fields and 1,410
  MQL5 actual fields, with zero unexplained divergence. Applicable local
  regression/security checks PASS; publication, exact GitHub SHA and CI remain.
- 02/09/2026: First clean-checkout CI run 33583344695 exposed that negative
  tests assumed an ignored repository `tmp` directory existed. Changed only the
  test-copy location to the operating-system temporary directory; verifier and
  evidence semantics are unchanged. The failed run remains part of the record.
