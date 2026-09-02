"""PB-025 owned system journey; synthetic loopback test data only.

Run only against ``scripts/test_backend.py --serve`` and its explicit owned
``tmp/pg-test-*`` directory. The smoke never contacts a provider, target or broker.
"""
from __future__ import annotations

import argparse
import hashlib
import http.cookiejar
import json
from pathlib import Path
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

from smoke_image_analysis import png as synthetic_png


ROOT = Path(__file__).resolve().parents[1]
BASE = "http://127.0.0.1:8080/api"
MAX_RESPONSE = 34 * 1024 * 1024


def validate_paths(owned_value: str, report_value: str) -> tuple[Path, Path]:
    owned = Path(owned_value).resolve()
    report = Path(report_value).resolve()
    expected_parent = (ROOT / "tmp").resolve()
    if (owned.parent != expected_parent or not owned.name.startswith("pg-test-")
            or not (owned / "data/PG_VERSION").is_file()
            or not (owned / "password").is_file()):
        raise RuntimeError("An active test-harness-owned cluster is required")
    if not report.is_relative_to(ROOT) or report.suffix != ".json":
        raise RuntimeError("JSON report must stay inside the repository")
    return owned, report


def snapshot_hash(value: object) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True,
                     separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


class Actor:
    def __init__(self) -> None:
        jar = http.cookiejar.CookieJar()
        self.client = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(jar))
        self.account: str | None = None

    def call(self, method: str, route: str, body: object = None,
             expected: int = 200, *, form: bool = False,
             binding: str | None = None, csrf: bool = True) -> object:
        headers = {}
        account = binding if binding is not None else self.account
        if account:
            headers["X-Workspace-User"] = account
        if csrf and method not in {"GET", "HEAD"}:
            token = self.call("GET", "/auth/csrf")
            headers[token["headerName"]] = token["token"]
        raw = None
        if body is not None:
            headers["Content-Type"] = (
                "application/x-www-form-urlencoded" if form else "application/json")
            raw = (urllib.parse.urlencode(body).encode("utf-8") if form else
                   json.dumps(body, ensure_ascii=False).encode("utf-8"))
        return self._send(method, route, raw, headers, expected)

    def multipart(self, route: str, fields: dict[str, str], filename: str,
                  media_type: str, data: bytes, expected: int = 200,
                  *, binding: str | None = None, csrf: bool = True) -> object:
        boundary = "----AITradingPB025" + secrets.token_hex(12)
        parts: list[bytes] = []
        for name, value in fields.items():
            parts += [f"--{boundary}\r\n".encode(),
                      f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode(),
                      value.encode(), b"\r\n"]
        parts += [f"--{boundary}\r\n".encode(),
                  f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode(),
                  f"Content-Type: {media_type}\r\n\r\n".encode(), data, b"\r\n",
                  f"--{boundary}--\r\n".encode()]
        account = binding if binding is not None else self.account
        headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
        if account:
            headers["X-Workspace-User"] = account
        if csrf:
            token = self.call("GET", "/auth/csrf")
            headers[token["headerName"]] = token["token"]
        return self._send("POST", route, b"".join(parts), headers, expected)

    def _send(self, method: str, route: str, raw: bytes | None,
              headers: dict[str, str], expected: int) -> object:
        request = urllib.request.Request(BASE + route, data=raw,
                                         headers=headers, method=method)
        try:
            response = self.client.open(request, timeout=35)
        except urllib.error.HTTPError as failure:
            if failure.code != expected:
                raise RuntimeError(
                    f"Unexpected HTTP {failure.code}, expected {expected}; body suppressed") from None
            response = failure
        with response:
            data = response.read(MAX_RESPONSE + 1)
            if response.status != expected or len(data) > MAX_RESPONSE:
                raise RuntimeError("Unexpected status or response bound")
            try:
                return json.loads(data) if data else None
            except (ValueError, UnicodeError):
                raise RuntimeError("Malformed API JSON; body suppressed") from None

    def register(self, label: str) -> None:
        email = f"pb025-{uuid.uuid4().hex}@example.test"
        password = secrets.token_urlsafe(32)
        self.call("POST", "/auth/register",
                  {"email": email, "displayName": label, "password": password}, 202)
        self.call("POST", "/auth/login", {"email": email, "password": password},
                  204, form=True)
        del password
        self.account = self.call("GET", "/auth/me")["id"]


def wait_job(actor: Actor, job_id: str) -> dict[str, object]:
    deadline = time.monotonic() + 40
    while time.monotonic() < deadline:
        job = actor.call("GET", "/backtests/" + job_id)
        if job["state"] not in {"QUEUED", "RUNNING"}:
            return job
        time.sleep(0.2)
    raise RuntimeError("Backtest did not reach a terminal state")


def restart_api(actor: Actor, owned: Path) -> bool:
    (owned / "restart-api").touch(exist_ok=False)
    deadline, saw_down = time.monotonic() + 60, False
    while time.monotonic() < deadline:
        try:
            actor.call("GET", "/health")
            if saw_down:
                return True
        except (OSError, RuntimeError):
            saw_down = True
        time.sleep(0.2)
    raise RuntimeError("Actual API down/up was not observed")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--owned", required=True)
    parser.add_argument("--report", required=True)
    args = parser.parse_args()
    owned, report_path = validate_paths(args.owned, args.report)
    first, second = Actor(), Actor()
    first.call("GET", "/health")
    first.register("Synthetic integrated researcher A")
    second.register("Synthetic integrated researcher B")
    marker = "PB025-SYNTHETIC-" + uuid.uuid4().hex
    try:
        assert first.call("GET", "/ai/capabilities") == {
            "configured": False, "provider": "gemini", "model": None}

        conversation_request = str(uuid.uuid4())
        conversation = first.call("POST", "/conversations",
                                  {"requestId": conversation_request})
        conversation_route = "/conversations/" + conversation["id"]
        message_request = str(uuid.uuid4())
        message_body = {"requestId": message_request,
                        "content": marker + " private synthetic research note"}
        message = first.call("POST", conversation_route + "/messages", message_body)
        assert first.call("POST", conversation_route + "/messages", message_body) == message
        second.call("GET", conversation_route + "/messages", expected=404)
        first.call("GET", conversation_route + "/messages", expected=401,
                   binding=second.account)
        first.call("POST", conversation_route + "/messages",
                   {"requestId": str(uuid.uuid4()), "content": "blocked"},
                   expected=403, csrf=False)
        ai_failure = first.call("POST", conversation_route + "/ai-turns",
                                {"requestId": str(uuid.uuid4()),
                                 "expectedVersion": 2, "sourceSequence": 1},
                                expected=503)
        assert ai_failure["code"] == "AI_UNCONFIGURED"
        messages = first.call("GET", conversation_route + "/messages")
        assert len(messages["items"]) == 1 and messages["items"][0]["role"] == "user"

        sample = json.loads((ROOT / "python/examples/long-next-open.json").read_text(
            encoding="utf-8"))
        strategy = first.call("POST", "/strategies",
                              {"requestId": str(uuid.uuid4()),
                               "title": "PB025 synthetic integrated strategy"})
        strategy_route = "/strategies/" + strategy["strategyId"]
        revision = first.call("POST", strategy_route + "/versions",
                              {"requestId": str(uuid.uuid4()), "expectedRevision": 1,
                               "title": "PB025 synthetic integrated strategy",
                               "draftText": json.dumps(sample["dsl"]),
                               "mode": "VALIDATED"})
        generation_failure = first.call(
            "POST", strategy_route + "/generations",
            {"requestId": str(uuid.uuid4()), "expectedRevision": 2,
             "conversationId": conversation["id"],
             "expectedConversationVersion": 2, "sourceSequence": 1}, expected=503)
        assert generation_failure["code"] == "AI_UNCONFIGURED"
        assert first.call("GET", strategy_route)["revision"] == 2

        columns = ("timestamp", "open", "high", "low", "close", "volume")
        csv_text = ",".join(columns) + "\n" + "".join(
            ",".join(c[key] for key in columns) + "\n"
            for c in sample["dataset"]["candles"])
        dataset = first.call("POST", "/datasets/import",
                             {"requestId": str(uuid.uuid4()),
                              "name": "PB025 synthetic integrated data",
                              "symbol": "TEST_USD", "timeframe": "1h",
                              "sourceKind": "SYNTHETIC",
                              "sourceLabel": "PB025 local fixture", "csv": csv_text})
        second.call("GET", "/datasets/" + dataset["id"], expected=404)

        pine_route = strategy_route + "/versions/2/pine"
        mql_route = strategy_route + "/versions/2/mql5"
        pine = first.call("POST", pine_route, {})
        mql5 = first.call("POST", mql_route, {})
        assert pine == first.call("GET", pine_route) == first.call("POST", pine_route, {})
        assert mql5 == first.call("GET", mql_route) == first.call("POST", mql_route, {})
        assert pine["dslHash"] == mql5["dslHash"] == revision["hash"]
        assert hashlib.sha256(pine["code"].encode()).hexdigest() == pine["codeHash"]
        assert hashlib.sha256(mql5["code"].encode()).hexdigest() == mql5["codeHash"]
        assert "OrderSend(" not in mql5["code"] and "CTrade" not in mql5["code"]

        job_request = {"requestId": str(uuid.uuid4()),
                       "strategyId": strategy["strategyId"], "revision": 2,
                       "datasetId": dataset["id"]}
        job = first.call("POST", "/backtests", job_request)
        done = wait_job(first, job["id"])
        assert done["state"] == "SUCCEEDED"
        result = first.call("GET", "/backtests/" + job["id"] + "/result")
        candles = first.call("GET", "/backtests/" + job["id"] + "/candles?start=0&limit=100")
        assert result["resultHash"] == done["resultHash"]
        assert result["metrics"]["netProfit"] == "100"
        assert first.call("POST", "/backtests", job_request)["id"] == job["id"]
        second.call("GET", "/backtests/" + job["id"], expected=404)
        notifications = first.call("GET", "/backtests/notifications")
        matching = [item for item in notifications["items"] if item["jobId"] == job["id"]]
        assert len(matching) == 1

        journal_input = {"symbol": "TEST_USD", "timeframe": "1h",
                         "settlementCurrency": "USD", "side": "LONG",
                         "state": "CLOSED", "quantity": "1", "entryPrice": "100",
                         "exitPrice": "110", "entryFee": "1", "exitFee": "1",
                         "entryTime": "2024-01-01T01:00:00Z",
                         "exitTime": "2024-01-01T03:00:00Z",
                         "entryReason": marker + " synthetic reason",
                         "notes": "Synthetic only; inert <script> marker.",
                         "datasetId": dataset["id"]}
        journal_request = {"requestId": str(uuid.uuid4()), "expectedVersion": 0,
                           "entry": journal_input}
        saved_journal = first.call("POST", "/journal", journal_request)
        assert first.call("POST", "/journal", journal_request) == saved_journal
        journal_id = saved_journal["entry"]["id"]
        second.call("GET", "/journal/" + journal_id, expected=404)
        evaluation_failure = first.call(
            "POST", "/journal/" + journal_id + "/evaluations",
            {"requestId": str(uuid.uuid4()), "expectedVersion": 1}, expected=503)
        assert evaluation_failure["code"] == "AI_UNCONFIGURED"
        journal_summary = first.call(
            "GET", "/journal/summary?from=2024-01-01&to=2024-01-02&zone=UTC&currency=USD")
        assert journal_summary["totals"]["netPnl"] == "8"

        document_request = str(uuid.uuid4())
        document_fields = {"requestId": document_request, "expectedVersion": "0",
                           "title": "PB025 synthetic integration evidence"}
        document_bytes = (marker + ": synthetic breakout evidence only.").encode()
        document = first.multipart("/documents", document_fields,
                                   "pb025-synthetic.txt", "text/plain", document_bytes)
        assert first.multipart("/documents", document_fields, "pb025-synthetic.txt",
                               "text/plain", document_bytes) == document
        second.call("GET", "/documents", expected=200)
        rag_failure = first.call("POST", "/documents/rag",
                                 {"question": "What confirms " + marker + "?"},
                                 expected=503)
        assert rag_failure["code"] == "AI_UNCONFIGURED"

        image_failure = first.multipart(
            "/image-analyses", {"requestId": str(uuid.uuid4()),
                                "question": "Synthetic image only"},
            "synthetic.png", "image/png", synthetic_png(), expected=503)
        assert image_failure["code"] == "AI_UNCONFIGURED"
        assert first.call("GET", "/image-analyses") == []

        audit_before = first.call("GET", "/audit?limit=50")
        assert audit_before["items"] and marker not in json.dumps(audit_before)

        before = {
            "messages": messages,
            "strategy": first.call("GET", strategy_route),
            "dataset": first.call("GET", "/datasets/" + dataset["id"]),
            "job": done, "result": result, "candles": candles,
            "journal": first.call("GET", "/journal/" + journal_id),
            "pine": pine, "mql5": mql5, "documents": first.call("GET", "/documents"),
            "notifications": notifications,
        }
        assert restart_api(first, owned)
        assert first.call("GET", "/auth/me")["id"] == first.account
        after = {
            "messages": first.call("GET", conversation_route + "/messages"),
            "strategy": first.call("GET", strategy_route),
            "dataset": first.call("GET", "/datasets/" + dataset["id"]),
            "job": first.call("GET", "/backtests/" + job["id"]),
            "result": first.call("GET", "/backtests/" + job["id"] + "/result"),
            "candles": first.call("GET", "/backtests/" + job["id"] + "/candles?start=0&limit=100"),
            "journal": first.call("GET", "/journal/" + journal_id),
            "pine": first.call("GET", pine_route), "mql5": first.call("GET", mql_route),
            "documents": first.call("GET", "/documents"),
            "notifications": first.call("GET", "/backtests/notifications"),
        }
        assert after == before
        assert first.call("POST", "/backtests", job_request)["id"] == job["id"]
        assert len([item for item in first.call("GET", "/backtests/notifications")["items"]
                    if item["jobId"] == job["id"]]) == 1
        second.call("GET", conversation_route + "/messages", expected=404)
        second.call("GET", strategy_route, expected=404)
        assert second.call("GET", "/documents", expected=200) == []

        report = {
            "passed": True, "syntheticDataOnly": True,
            "realHttpPostgresPython": True, "externalTargetsContacted": False,
            "providerConfigured": False, "unconfiguredAiEntryPoints": 5,
            "fakeAiObjectsCreated": False, "actualApiDownUpObserved": True,
            "sessionAndAllSnapshotsSurvivedRestart": True,
            "ownerIsolationAndBinding": True, "csrfDenied": True,
            "idempotentReplay": True, "singleTerminalNotification": True,
            "snapshotSha256": snapshot_hash(after),
            "resultHash": done["resultHash"], "inputHash": done["inputHash"],
            "pineCodeHash": pine["codeHash"], "mql5CodeHash": mql5["codeHash"],
            "documentContentHash": document["version"]["contentHash"],
        }
    finally:
        for actor in (first, second):
            if actor.account:
                actor.call("POST", "/auth/logout", {}, 204)
                actor.call("GET", "/auth/me", expected=401)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n",
                           encoding="utf-8")
    print("PASS: PB-025 owned system journey, failure boundaries, isolation and restart")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
