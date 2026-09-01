# PB-023 security review

## Scope and method

Codex reviewed the composed request filters, Spring Security chain, authentication,
owner-scoped repositories, AI HTTP transport, Python worker, uploads and React
rendering/storage surfaces. The review combined source inspection, existing feature
regression and a new actual HTTP/PostgreSQL two-owner adversarial smoke. Test input
was synthetic and the smoke contacted no external target.

## Findings

### F-001 — incomplete defense-in-depth response headers (Low, resolved)

The API already returned CSP, frame, MIME-sniffing and cache controls, but omitted
explicit referrer, browser capability, cross-origin resource and cross-domain
policy headers. The centralized security chain now emits `Referrer-Policy`,
`Permissions-Policy`, `Cross-Origin-Resource-Policy` and
`X-Permitted-Cross-Domain-Policies`; automated and actual HTTP checks cover them.

### F-002 — deployment Secure-cookie switch was implicit (Low, resolved)

Local HTTP needs a non-Secure session cookie, while a deployment behind TLS must
mark it Secure. README deployment guidance now requires Spring Boot's standard
`SERVER_SERVLET_SESSION_COOKIE_SECURE=true` setting with TLS. With no override,
the servlet continues to derive Secure from an HTTPS request. Existing tests cover
that HTTPS path; the local smoke checks HttpOnly and SameSite.

## Dispositions and limitations

- SQL concatenation is limited to fixed server-selected clauses, sort orders and
  lock modes. Request values remain JDBC parameters. No dynamic identifier or raw
  user fragment enters SQL.
- The frontend has no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, dynamic
  function, `document.write`, JavaScript URL, localStorage or sessionStorage sink.
- External HTTP targets are fixed provider configuration and redirects are disabled.
  The backtest subprocess uses a fixed executable and entry point, isolated mode,
  clean environment and bounded input/output/time.
- Browser writes remain same-origin through the Vite proxy. Hostile Origins are
  denied and the API does not return a cross-origin read grant.
- Credit/payment, broker orders, live trading and privileged/admin roles are absent
  from the prototype, so attacks specific to those surfaces are not applicable.
- This is evidence for the current prototype build, not a production penetration
  test or security certification. No unresolved high or critical finding remains.
