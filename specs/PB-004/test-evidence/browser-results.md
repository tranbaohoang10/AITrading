# PB-004 real browser evidence — 31/08/2026, Refs #7

Actual in-app browser at127.0.0.1:5173, Vite proxy to owned Java API8080 and
disposable pg-test-b4t3ha88. Synthetic accounts only; no real user DB/service.
This is executed UI evidence, separate from mocked Vitest contracts.

- A registered/signed in; authenticated chat displayed empty persisted list and
  explicit "AI replies not connected yet", no generated/canned assistant messages.
- New Chat created first conversation; renamed "Wyckoff and RSI research" and
  saved two-line research text. Actual list preview/timestamps updated.
- Created "Trend research B" with different text. Opening each showed only that
  conversation's messages; original context survived switching.
- Desktop1280x720 screenshot reviewed: independent chat/chart panes, dense neutral
  styling, saved-message state distinct from clearly-labelled chart mock.
- Mobile390x844: navigated via drawer to AI Chat; same selected conversation and
  content persisted through responsive renderer change. DOM scrollWidth390 equals
  viewport390; screenshot reviewed, composer/list/title controls reachable.
- Selected disposable second conversation, opened delete Modal, cancelled and
  verified focus returned to Delete. Opened again and confirmed deletion; second
  item/messages disappeared while the first remained. Only task-created test data.
- Restarted owned API process12328 to23272 against same DB via harness sentinel.
  Browser reload preserved authentication and first conversation; deleted second
  remained absent. Opened first and saved another message after restart; old/new
  messages coexisted in correct chronological context. Tablet900x900 drawer
  screenshot reviewed; viewport explicitly restored after testing.
- Signed A out; registered/signed in synthetic B in same browser. B had empty list,
  no A title/message. Created and saved a B-only conversation. Signed B out and
  returned to login. API-level owner attacks are separately covered by JUnit.
- Stopped owned API/DB through stop-api; harness exit0 confirms server stopped and
  temporary password removed. Existing PostgreSQL user service was not controlled.

Screenshots: chat-desktop.png; chat-mobile.png; chat-tablet-after-restart.png;
chat-user-b-empty.png. No password/token or browser session storage was inspected.
Large-page boundaries and concurrency use real HTTP/DB automated tests, while
late-response/uncertain-network cases use explicitly mocked frontend tests.
