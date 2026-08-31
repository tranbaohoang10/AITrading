"""Adversarial verifier tests with SYNTHETIC LOG TEXT, not MQL execution evidence."""
import json
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts'))
from verify_mql5_trace import expected_rows, verify


class TraceVerifierTests(unittest.TestCase):
    def setUp(self):
        self.fixture=json.loads((ROOT/'backend/src/test/resources/pine/hand-next-open.json').read_text(encoding='utf-8'))
        self.rows=expected_rows(self.fixture)
        lines=[f"AITRADING_START|mql5-research-1.0.0|dslHash={self.fixture['reference']['runCard']['dslHash']}|bars={len(self.rows)}"]
        for i,(exact,numbers) in enumerate(self.rows):
            fields={**exact,**{k:'null' if v is None else v for k,v in numbers.items()}}
            lines.append('AITRADING_BAR|'+str(i)+'|'+ '|'.join(f'{k}={v}' for k,v in fields.items()))
        last=self.rows[-1]
        lines.append(f"AITRADING_END|cancelledPending={last[0]['signal']}|openSide={last[0]['side']}|balance={last[1]['balance']}|equity={last[1]['equity']}")
        self.log='\n'.join(lines)

    def test_synthetic_parser_fixture_accepts_complete_matching_trace_only(self):
        self.assertEqual(verify(self.fixture,self.log)['bars'],4)
        self.assertIn('does not execute',verify(self.fixture,self.log)['scope'])

    def test_missing_duplicate_wrong_identity_event_and_accounting_are_rejected(self):
        lines=self.log.splitlines()
        invalid=[self.log.replace(self.fixture['reference']['runCard']['dslHash'],'a'*64),
            '\n'.join(lines[1:]),'\n'.join(lines[:-1]),self.log+'\n'+lines[1],
            self.log.replace('AITRADING_BAR|1|','AITRADING_BAR|7|'),
            self.log.replace('|longEntry=1','|longEntry=0',1),
            self.log.replace('|entryFill=100','|entryFill=101',1),
            self.log.replace('|entryFill=100','|entryFill=NaN',1),
            self.log.replace('|entryFill=null','|entryFill=0',1),
            self.log.replace('|quantity=10','|quantity=999',1),
            self.log.replace('|time=1704067200','|time=1704067200|time=1704067200',1),
            self.log.replace('|longEntry=1','',1),self.log+'\nERROR: CSV_INVALID',
            self.log.replace('cancelledPending=1','cancelledPending=0'),
            self.log+'\n'+lines[0]]
        for index,log in enumerate(invalid):
            with self.subTest(index=index):
                with self.assertRaises(ValueError): verify(self.fixture,log)


if __name__=='__main__':unittest.main()
