import os
import shutil
import tempfile
import unittest
from fastapi import HTTPException

from md_editor.main import (
    safe_join_path,
    to_posix_relpath,
    get_files,
    create_file,
    create_folder,
    save_file,
    load_file,
    delete_item,
    rename_item,
    copy_file_item,
    CreateFileRequest,
    CreateFolderRequest,
    SaveRequest,
    RenameRequest,
    CopyRequest
)
import md_editor.main as main_module


class TestBackendSecurityAndAPI(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix="md_editor_test_")
        self.orig_base_dir = main_module.BASE_DIR
        main_module.BASE_DIR = os.path.realpath(self.test_dir)

    def tearDown(self):
        main_module.BASE_DIR = self.orig_base_dir
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_safe_join_path_normal(self):
        p = safe_join_path(self.test_dir, "sub", "test.md")
        expected = os.path.realpath(os.path.join(self.test_dir, "sub", "test.md"))
        self.assertEqual(p, expected)

    def test_safe_join_path_traversal_blocked(self):
        with self.assertRaises(HTTPException) as cm:
            safe_join_path(self.test_dir, "..", "secret.txt")
        self.assertEqual(cm.exception.status_code, 400)

        with self.assertRaises(HTTPException) as cm2:
            safe_join_path(self.test_dir, "sub/../../secret.txt")
        self.assertEqual(cm2.exception.status_code, 400)

    def test_safe_join_path_null_byte_blocked(self):
        with self.assertRaises(HTTPException) as cm:
            safe_join_path(self.test_dir, "test\0evil.md")
        self.assertEqual(cm.exception.status_code, 400)

    def test_to_posix_relpath(self):
        target = os.path.join(self.test_dir, "subfolder", "note.md")
        posix = to_posix_relpath(target, self.test_dir)
        self.assertEqual(posix, "subfolder/note.md")
        self.assertNotIn("\\", posix)

    def test_create_file_and_load(self):
        res = create_file(CreateFileRequest(path="", filename="hello.md"))
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["filename"], "hello.md")
        self.assertEqual(res["rel_path"], "hello.md")

        # Save content
        res_save = save_file(SaveRequest(filename="hello.md", content="# Hello World"))
        self.assertEqual(res_save["status"], "success")

        # Load content
        res_load = load_file("hello.md")
        self.assertEqual(res_load["content"], "# Hello World")
        self.assertEqual(res_load["rel_path"], "hello.md")

    def test_create_folder_and_list(self):
        res = create_folder(CreateFolderRequest(path="", name="my_notes"))
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["folder_name"], "my_notes")
        self.assertEqual(res["rel_path"], "my_notes")

        # List files
        res_list = get_files("")
        self.assertIn("my_notes", res_list["directories"])

    def test_rename_item(self):
        create_file(CreateFileRequest(path="", filename="old_name.md"))
        res = rename_item(RenameRequest(old_path="old_name.md", new_path="new_name.md"))
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["new_filename"], "new_name.md")
        self.assertEqual(res["new_path"], "new_name.md")

        # Confirm old doesn't exist, new exists
        with self.assertRaises(HTTPException):
            load_file("old_name.md")
        res_new = load_file("new_name.md")
        self.assertEqual(res_new["filename"], "new_name.md")

    def test_copy_file_item(self):
        create_file(CreateFileRequest(path="", filename="source.md"))
        save_file(SaveRequest(filename="source.md", content="original content"))
        res = copy_file_item(CopyRequest(src_path="source.md", dest_dir=""))
        self.assertEqual(res["status"], "success")
        copy_filename = res["filename"]
        self.assertTrue(copy_filename.startswith("source_copy"))

        res_load_copy = load_file(copy_filename)
        self.assertEqual(res_load_copy["content"], "original content")

    def test_delete_item(self):
        create_file(CreateFileRequest(path="", filename="to_delete.md"))
        res = delete_item("to_delete.md")
        self.assertEqual(res["status"], "success")
        with self.assertRaises(HTTPException):
            load_file("to_delete.md")

    def test_cannot_delete_or_rename_root(self):
        with self.assertRaises(HTTPException) as cm_del:
            delete_item("", is_dir=True)
        self.assertEqual(cm_del.exception.status_code, 400)

        with self.assertRaises(HTTPException) as cm_ren:
            rename_item(RenameRequest(old_path="", new_path="renamed_root"))
        self.assertEqual(cm_ren.exception.status_code, 400)

    def test_encoding_fallback_cp932(self):
        sjis_text = "日本語テスト：Shift_JIS形式のテキスト"
        target_path = os.path.join(self.test_dir, "sjis_note.md")
        with open(target_path, "wb") as f:
            f.write(sjis_text.encode("cp932"))

        res = load_file("sjis_note.md")
        self.assertEqual(res["content"], sjis_text)

    def test_convert_images_base64_endpoint_removed(self):
        # Confirm convert_images_base64 is not present on app routes
        route_paths = [route.path for route in main_module.app.routes]
        self.assertNotIn("/api/convert-images-base64", route_paths)

    def test_upload_file_path_traversal_sanitized(self):
        import asyncio
        from starlette.requests import Request

        async def dummy_stream():
            yield b"dummy content"

        scope = {
            "type": "http",
            "method": "POST",
            "path": "/api/upload-file",
            "headers": []
        }
        req = Request(scope)
        # Mock stream
        req.stream = dummy_stream

        # Try uploading with ../filename
        res = asyncio.run(main_module.upload_file(req, path="", filename="../../evil.png"))
        self.assertEqual(res["filename"], "evil.png")
        self.assertEqual(res["rel_path"], "evil.png")
        self.assertTrue(os.path.exists(os.path.join(self.test_dir, "evil.png")))
        self.assertFalse(os.path.exists(os.path.join(self.test_dir, "..", "evil.png")))


if __name__ == "__main__":
    unittest.main()
