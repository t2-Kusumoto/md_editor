import io
import os
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

from md_editor.main import parse_args_and_setup_workspace


class TestCLIArgsParsing(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix="md_cli_test_")
        self.orig_cwd = os.getcwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        os.chdir(self.orig_cwd)
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_no_args(self):
        base_dir, initial_file = parse_args_and_setup_workspace(["md-editor"])
        self.assertEqual(os.path.realpath(base_dir), os.path.realpath(self.test_dir))
        self.assertIsNone(initial_file)

    def test_valid_file_in_cwd(self):
        target = os.path.join(self.test_dir, "document.md")
        with open(target, "w", encoding="utf-8") as f:
            f.write("# Hello")

        base_dir, initial_file = parse_args_and_setup_workspace(["md-editor", "document.md"])
        self.assertEqual(os.path.realpath(base_dir), os.path.realpath(self.test_dir))
        self.assertEqual(initial_file, "document.md")

    def test_valid_file_in_subfolder(self):
        sub_dir = os.path.join(self.test_dir, "notes")
        os.makedirs(sub_dir, exist_ok=True)
        target = os.path.join(sub_dir, "meeting.md")
        with open(target, "w", encoding="utf-8") as f:
            f.write("# Meeting Notes")

        base_dir, initial_file = parse_args_and_setup_workspace(["md-editor", "notes/meeting.md"])
        self.assertEqual(os.path.realpath(base_dir), os.path.realpath(self.test_dir))
        self.assertEqual(initial_file, "notes/meeting.md")

    def test_valid_file_outside_cwd_os_association(self):
        other_dir = tempfile.mkdtemp(prefix="md_other_dir_")
        try:
            target = os.path.join(other_dir, "external.md")
            with open(target, "w", encoding="utf-8") as f:
                f.write("# External File")

            # Simulate OS 'Open with...' or double-click passing absolute path
            base_dir, initial_file = parse_args_and_setup_workspace(["md-editor", target])
            self.assertEqual(os.path.realpath(base_dir), os.path.realpath(other_dir))
            self.assertEqual(initial_file, "external.md")
        finally:
            if os.path.exists(other_dir):
                shutil.rmtree(other_dir, ignore_errors=True)

    def test_case_insensitive_md_extension(self):
        target = os.path.join(self.test_dir, "UPPERCASE.MD")
        with open(target, "w", encoding="utf-8") as f:
            f.write("# Test")

        base_dir, initial_file = parse_args_and_setup_workspace(["md-editor", "UPPERCASE.MD"])
        self.assertEqual(initial_file, "UPPERCASE.MD")

    def test_non_md_extension_fails(self):
        target = os.path.join(self.test_dir, "photo.png")
        with open(target, "w") as f:
            f.write("dummy")

        stderr_buf = io.StringIO()
        with patch("sys.stderr", stderr_buf):
            with self.assertRaises(SystemExit) as cm:
                parse_args_and_setup_workspace(["md-editor", "photo.png"])
            self.assertEqual(cm.exception.code, 1)
        self.assertIn("must have a .md extension", stderr_buf.getvalue())

    def test_nonexistent_file_fails(self):
        stderr_buf = io.StringIO()
        with patch("sys.stderr", stderr_buf):
            with self.assertRaises(SystemExit) as cm:
                parse_args_and_setup_workspace(["md-editor", "nonexistent.md"])
            self.assertEqual(cm.exception.code, 1)
        self.assertIn("File not found", stderr_buf.getvalue())

    def test_directory_arg_fails(self):
        sub_dir = os.path.join(self.test_dir, "my_folder")
        os.makedirs(sub_dir, exist_ok=True)

        stderr_buf = io.StringIO()
        with patch("sys.stderr", stderr_buf):
            with self.assertRaises(SystemExit) as cm:
                parse_args_and_setup_workspace(["md-editor", "my_folder"])
            self.assertEqual(cm.exception.code, 1)
        self.assertIn("must have a .md extension", stderr_buf.getvalue())

    def test_directory_named_with_md_extension_fails(self):
        sub_dir = os.path.join(self.test_dir, "fake_doc.md")
        os.makedirs(sub_dir, exist_ok=True)

        stderr_buf = io.StringIO()
        with patch("sys.stderr", stderr_buf):
            with self.assertRaises(SystemExit) as cm:
                parse_args_and_setup_workspace(["md-editor", "fake_doc.md"])
            self.assertEqual(cm.exception.code, 1)
        self.assertIn("is a directory, not a file", stderr_buf.getvalue())

    def test_multiple_args_fails(self):
        stderr_buf = io.StringIO()
        with patch("sys.stderr", stderr_buf):
            with self.assertRaises(SystemExit) as cm:
                parse_args_and_setup_workspace(["md-editor", "file1.md", "file2.md"])
            self.assertEqual(cm.exception.code, 1)
        self.assertIn("Only one file can be specified", stderr_buf.getvalue())


if __name__ == "__main__":
    unittest.main()


class TestServerInitialFileIntegration(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix="md_server_test_")
        self.orig_cwd = os.getcwd()
        os.chdir(self.test_dir)

    def tearDown(self):
        os.chdir(self.orig_cwd)
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_initial_file_served_in_html_and_status(self):
        import asyncio
        from starlette.requests import Request
        import md_editor.main as main_mod

        target = os.path.join(self.test_dir, "welcome.md")
        with open(target, "w", encoding="utf-8") as f:
            f.write("# Welcome Note\nThis is a test.")

        base_dir, initial_file = parse_args_and_setup_workspace(["md-editor", "welcome.md"])
        orig_base = main_mod.BASE_DIR
        orig_init = main_mod.INITIAL_FILE
        try:
            main_mod.BASE_DIR = base_dir
            main_mod.INITIAL_FILE = initial_file

            # Create mock Request
            scope = {
                "type": "http",
                "method": "GET",
                "path": "/",
                "headers": [],
            }
            req = Request(scope)

            # Test HTML response contains data-initial-file
            response = asyncio.run(main_mod.read_index(req))
            html_body = response.body.decode("utf-8")
            self.assertEqual(response.status_code, 200)
            self.assertIn('data-initial-file="welcome.md"', html_body)

            # Test /api/status contains initial_file
            status_data = asyncio.run(main_mod.get_status())
            self.assertEqual(status_data.get("initial_file"), "welcome.md")

            # Test loading the file content via load_file
            load_data = main_mod.load_file("welcome.md")
            self.assertEqual(load_data.get("filename"), "welcome.md")
            self.assertIn("# Welcome Note", load_data.get("content"))
        finally:
            main_mod.BASE_DIR = orig_base
            main_mod.INITIAL_FILE = orig_init


