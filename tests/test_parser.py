import subprocess
import json
import unittest
import tempfile
import os

SCRATCH_DIR = os.path.join(os.path.dirname(__file__), ".tmp")

class TestFrontendParserLogic(unittest.TestCase):
    """Test frontend parsing logic using Node.js to verify actual JS behavior."""

    def _eval_js_file(self, js_code: str) -> str:
        os.makedirs(SCRATCH_DIR, exist_ok=True)
        tmp_name = os.path.join(SCRATCH_DIR, "test_eval_tmp.js")
        with open(tmp_name, "w", encoding="utf-8") as f:
            f.write(js_code)
        try:
            proc = subprocess.run(["node", tmp_name], capture_output=True, text=True)
            if proc.returncode != 0:
                print("Node Error:", proc.stderr)
            self.assertEqual(proc.returncode, 0, f"Node exited with error: {proc.stderr}")
            return proc.stdout.strip()
        finally:
            if os.path.exists(tmp_name):
                os.remove(tmp_name)

    def test_safe_cell_split_preserves_code_blocks(self):
        js = """
function splitDocumentIntoCells(content) {
    if (!content || !content.includes('<!-- cell -->')) {
        return content && content.trim().length > 0 ? [content] : [''];
    }

    const lines = content.replace(/\\r\\n/g, '\\n').split('\\n');
    const cells = [];
    let currentCellLines = [];
    let inCodeFence = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
            inCodeFence = !inCodeFence;
        }

        if (!inCodeFence && trimmed === '<!-- cell -->') {
            cells.push(currentCellLines.join('\\n').trim());
            currentCellLines = [];
        } else {
            currentCellLines.push(line);
        }
    }

    if (currentCellLines.length > 0 || cells.length > 0) {
        cells.push(currentCellLines.join('\\n').trim());
    }

    return cells.length > 0 ? cells : [''];
}

const input = "# Cell 1\\n```bash\\necho '<!-- cell --> inside code'\\n```\\n<!-- cell -->\\n# Cell 2";
const result = splitDocumentIntoCells(input);
console.log(JSON.stringify(result));
"""
        output = self._eval_js_file(js)
        cells = json.loads(output)
        self.assertEqual(len(cells), 2)
        self.assertIn("<!-- cell --> inside code", cells[0])
        self.assertEqual(cells[1], "# Cell 2")

    def test_code_block_math_protection(self):
        js = """
let text = "Here is `$INLINE_CODE$` and:\\n```bash\\necho $PATH and $HOME\\n```\\nAnd real math: $x = 1$";

const codePlaceholders = [];
text = text.replace(/(```[\\s\\S]*?```|`[^`\\n]+`)/g, (match) => {
    const id = `CODEBLOCKPH${codePlaceholders.length}END`;
    codePlaceholders.push({ id, content: match });
    return id;
});

const mathPlaceholders = [];
text = text.replace(/\\$([^\\$\\n]+?)\\$/g, (match, formula) => {
    const id = `MATHINLINEPH${mathPlaceholders.length}END`;
    mathPlaceholders.push({ id, formula: formula.trim() });
    return id;
});

codePlaceholders.forEach(cp => {
    text = text.replace(cp.id, () => cp.content);
});

console.log(JSON.stringify({
    codeBlocks: codePlaceholders.map(c => c.content),
    mathFormulas: mathPlaceholders.map(m => m.formula),
    restoredText: text
}));
"""
        output = self._eval_js_file(js)
        data = json.loads(output)
        self.assertEqual(len(data["codeBlocks"]), 2)
        self.assertIn("echo $PATH and $HOME", data["codeBlocks"][1])
        # Only the actual math should be extracted
        self.assertEqual(data["mathFormulas"], ["x = 1"])
        self.assertIn("echo $PATH and $HOME", data["restoredText"])


if __name__ == "__main__":
    unittest.main()
