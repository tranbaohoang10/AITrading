"""Real child-process limits; never apply resource limits to the test runner."""
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
ENTRY = ROOT / 'python/run_supervised_backtest.py'


class SupervisedWorkerTests(unittest.TestCase):
    def environment(self):
        return {**{k: os.environ[k] for k in ('SystemRoot', 'WINDIR') if k in os.environ}, 'LANG': 'C.UTF-8'}

    def probe(self, tail, seconds=20):
        code = f"import sys;sys.path.insert(0,{str(ROOT / 'python')!r});from worker_limits import apply_limits;apply_limits(128*1024*1024,{seconds});" + tail
        return subprocess.run([sys.executable, '-I', '-c', code], env=self.environment(),
                              capture_output=True, timeout=8)

    def test_actual_supervised_engine_matches_offline_bytes(self):
        raw = (ROOT / 'python/examples/long-next-open.json').read_bytes()
        bounded = subprocess.run([sys.executable, '-I', str(ENTRY)], input=raw,
                                 env=self.environment(), capture_output=True, timeout=25)
        offline = subprocess.run([sys.executable, '-I', str(ROOT / 'python/run_backtest.py')],
                                 input=raw, capture_output=True, timeout=25)
        self.assertEqual(bounded.returncode, 0, bounded.stdout)
        self.assertEqual(bounded.stderr, b'')
        self.assertEqual(bounded.stdout, offline.stdout)
        self.assertEqual(json.loads(bounded.stdout)['result']['metrics']['netProfit'], '100')

    def test_actual_os_memory_limit_denies_large_allocation(self):
        result = self.probe("\ntry:\n value=bytearray(256*1024*1024)\n print('LIMIT_FAILED')\nexcept MemoryError:\n print('MEMORY_LIMIT_ENFORCED')")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), b'MEMORY_LIMIT_ENFORCED')

    def test_actual_cpu_limit_terminates_own_busy_child(self):
        result = self.probe("print('CPU_LIMIT_ARMED',flush=True)\nwhile True: pass", seconds=1)
        self.assertIn(b'CPU_LIMIT_ARMED', result.stdout)
        self.assertNotEqual(result.returncode, 0)

    def test_entrypoint_rejects_arguments_and_invalid_input(self):
        for args, raw, code in ((['untrusted'], b'{}', 'ARGUMENTS_NOT_SUPPORTED'),
                                ([], b'{}', 'REQUEST_FIELDS')):
            result = subprocess.run([sys.executable, '-I', str(ENTRY), *args], input=raw,
                                    env=self.environment(), capture_output=True, timeout=8)
            self.assertEqual(result.returncode, 2)
            self.assertEqual(json.loads(result.stdout), {'ok': False, 'error': {'code': code}})
            self.assertEqual(result.stderr, b'')

    def test_clean_child_environment_and_windows_process_count(self):
        result = self.probe("import os;print(sorted(k for k in os.environ if k not in ('SystemRoot','SYSTEMROOT','WINDIR','windir','LANG','LC_CTYPE')))")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), b'[]')
        if os.name == 'nt':
            result = self.probe("import subprocess\ntry:\n child=subprocess.run([sys.executable,'-I','-c',\"print('CHILD_RAN')\"],capture_output=True,timeout=3)\n assert b'CHILD_RAN' not in child.stdout\n print('NO_CHILD')\nexcept OSError:\n print('NO_CHILD')")
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout.strip(), b'NO_CHILD')
