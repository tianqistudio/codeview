"""Build a tiny isolated checkout fixture without machine-local release metadata."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
ASSETS = (
    'refine.py', 'localize.py', 'theme.css', 'ui.js', 'sn-icon.svg',
    'neighbor.js', 'sn-header.js', 'import-core.js', 'import-ui.js', 'import.css',
    'scanner.css', 'scanner.html', 'scanner.js', 'scanner-worker.js',
    'i18n.js', 'locales.json', 'vendor/zxing.js', 'vendor/zxing_full.wasm',
    'vendor/ZXING-LICENSE.txt', 'vendor/ZXING-CPP-LICENSE.txt', 'vendor/ZINT-LICENSE.txt',
)
DEPLOYED = Path('交付/SN连续出码/SN_连续出码工具_v1.4.html')
BASELINE = Path('source/SN_连续出码工具_v1.1.html')
CANDIDATE = Path('交付/SN连续出码/SN_连续出码工具_v1.4.1-candidate.html')


class BuildOutputTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='codeview-build-fixture-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        for relative in (BASELINE, *(Path('tools/sn-viewer') / name for name in ASSETS)):
            destination = self.root / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / relative, destination)

    def build(self, *arguments):
        return subprocess.run(
            [sys.executable, '-B', '-X', 'utf8', str(self.root / 'tools/sn-viewer/refine.py'), *arguments],
            cwd=self.root, capture_output=True, text=True, encoding='utf-8', check=False,
        )

    def test_checkout_without_release_metadata_builds_candidate(self):
        self.assertFalse((self.root / 'release.json').exists())
        before = (self.root / BASELINE).read_bytes()
        result = self.build()
        self.assertEqual(result.returncode, 0, result.stderr)
        candidate = (self.root / CANDIDATE).read_text(encoding='utf-8')
        self.assertIn('id="importProgress"', candidate)
        self.assertIn('CodeViewImport.readTextFile', candidate)
        self.assertEqual((self.root / BASELINE).read_bytes(), before)
        self.assertFalse((self.root / 'release.json').exists())

    def test_missing_metadata_still_protects_deployed_html_and_baseline(self):
        deployed = self.root / DEPLOYED
        deployed.parent.mkdir(parents=True, exist_ok=True)
        deployed.write_bytes(b'deployed sentinel')
        current = self.root / '交付/SN连续出码/SN_连续出码工具_v1.4.1.html'
        current.write_bytes(b'current release sentinel')
        for relative in (DEPLOYED, current.relative_to(self.root), BASELINE):
            before = (self.root / relative).read_bytes()
            result = self.build('--output', str(relative))
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('cannot be overwritten', result.stderr)
            self.assertEqual((self.root / relative).read_bytes(), before)

    def test_available_metadata_adds_current_pointer_to_protected_paths(self):
        (self.root / 'release.json').write_text(json.dumps({'html': 'custom-current.html'}), encoding='utf-8')
        current = self.root / 'custom-current.html'
        current.write_bytes(b'current sentinel')
        result = self.build('--output', str(current))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('cannot be overwritten', result.stderr)
        self.assertEqual(current.read_bytes(), b'current sentinel')


if __name__ == '__main__':
    unittest.main(verbosity=2)
