"""Pinned reference fixtures and artifact integrity; never reports Pine execution."""
import hashlib
import json
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'python'))
from aitrading_engine.engine import run

class PineReferenceTests(unittest.TestCase):
    def test_eight_pinned_event_and_indicator_references_still_match_real_python_engine(self):
        files=sorted((ROOT/'backend/src/test/resources/pine').glob('*.json'))
        self.assertEqual(len(files),8)
        for path in files:
            with self.subTest(fixture=path.stem):
                fixture=json.loads(path.read_text(encoding='utf-8'))
                actual=run(json.dumps(fixture['request'],ensure_ascii=False,separators=(',',':')).encode('utf-8'))
                self.assertEqual(actual,fixture['reference'])
                self.assertTrue(fixture['targetStatus'].startswith('NOT_RUN'))

    def test_target_preparation_manifest_cannot_masquerade_as_runtime_evidence(self):
        folder=ROOT/'specs/PB-015/test-evidence/target-fixtures'
        manifest=json.loads((folder/'manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(len(manifest),8)
        for item in manifest:
            with self.subTest(fixture=item['name']):
                self.assertEqual(item['targetStatus'],'NOT_RUN')
                for suffix,key in [('-export.pine','exportCodeHash'),('.pine','targetFixtureHash')]:
                    code=(folder/(item['name']+suffix)).read_text(encoding='utf-8')
                    self.assertEqual(hashlib.sha256(code.encode('utf-8')).hexdigest(),item[key])
                    self.assertNotIn('strategy.entry(',code)
                    self.assertNotIn('request.security(',code)
                    self.assertIn('EXPERIMENTAL',code)

if __name__=='__main__':unittest.main()
