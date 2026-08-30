"""Fault-injection tests: incomplete scans/cleanup must never produce a green build."""
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch

import check_dependencies as audit
import test_backend as harness


class DependencyAuditTests(unittest.TestCase):
    def test_partial_response_and_package_errors_fail_closed(self):
        for response in (None, {}, {"results": []}, {"results": [None]},
                         {"results": [{"error": "upstream failure"}]},
                         {"results": [{"vulns": None}]},
                         {"results": [{"vulns": [{}]}]},
                         {"results": [{"next_page_token": 42}]}):
            with self.subTest(response=response), patch.object(audit, "query", return_value=response):
                with self.assertRaises(RuntimeError):
                    audit.scan(["org.example:library:1.0"])

    def test_later_page_finding_is_not_lost(self):
        with patch.object(audit, "query", side_effect=[
                {"results": [{"next_page_token": "page2"}, {}]},
                {"results": [{"vulns": [{"id": "SYNTHETIC-TEST-1"}]}]}]) as query:
            found = audit.scan(["org.example:a:1.0", "org.example:b:2.0"])
        self.assertEqual(found, [{"coordinate": "org.example:a:1.0",
                                 "vulnerabilities": [{"id": "SYNTHETIC-TEST-1"}]}])
        self.assertEqual(query.call_args.args[0]["queries"][0]["page_token"], "page2")
        self.assertEqual(len(query.call_args.args[0]["queries"]), 1)

    def test_cyclic_pagination_and_transport_failure_do_not_pass(self):
        with patch.object(audit, "query", return_value={"results": [{"next_page_token": "same"}]}):
            with self.assertRaises(RuntimeError):
                audit.scan(["org.example:a:1"])
        with patch.object(audit, "query", side_effect=TimeoutError):
            with self.assertRaises(TimeoutError):
                audit.scan(["org.example:a:1"])

    def test_batch_boundary_and_invalid_coordinate(self):
        with patch.object(audit, "query", side_effect=lambda body: {"results": [{} for _ in body["queries"]]}) as query:
            self.assertEqual(audit.scan([f"org.example:a{i}:1" for i in range(101)]), [])
            self.assertEqual([len(call.args[0]["queries"]) for call in query.call_args_list], [100, 1])
        with patch.object(audit, "query") as query:
            with self.assertRaises(ValueError):
                audit.scan(["not-a-coordinate"])
            query.assert_not_called()


class CleanupTests(unittest.TestCase):
    def test_already_stopped_cluster_needs_no_stop_command(self):
        with patch.object(harness.subprocess, "run", return_value=subprocess.CompletedProcess([], 3)) as run:
            harness.stop_owned_cluster("pg_ctl", Path("owned/data"))
            self.assertEqual(run.call_count, 1)

    def test_failed_shutdown_and_unknown_status_fail_build(self):
        for codes in ([4], [0, 0, 0]):
            with self.subTest(codes=codes), patch.object(harness.subprocess, "run", side_effect=[
                    subprocess.CompletedProcess([], code) for code in codes]):
                with self.assertRaises(RuntimeError):
                    harness.stop_owned_cluster("pg_ctl", Path("owned/data"))
        with patch.object(harness.subprocess, "run", side_effect=[subprocess.CompletedProcess([], 0),
                         subprocess.CalledProcessError(1, "pg_ctl")]):
            with self.assertRaises(subprocess.CalledProcessError):
                harness.stop_owned_cluster("pg_ctl", Path("owned/data"))


if __name__ == "__main__":
    unittest.main()
