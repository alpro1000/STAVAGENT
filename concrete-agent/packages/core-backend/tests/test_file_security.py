"""
Security tests for file path leakage vulnerability fix
Tests that API endpoints do NOT expose server paths
"""
import logging
import pytest
import tempfile
import shutil
from pathlib import Path
from datetime import datetime
from fastapi.testclient import TestClient
from io import BytesIO

# Import the app and helpers
from app.main import app
from app.api.routes import create_safe_file_metadata, project_store


@pytest.fixture
def client():
    """Create FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def temp_project_dir():
    """Create temporary project directory for testing"""
    temp_dir = Path(tempfile.mkdtemp())
    yield temp_dir
    # Cleanup
    if temp_dir.exists():
        shutil.rmtree(temp_dir)


@pytest.fixture
def sample_file():
    """Create a sample file for testing"""
    content = b"Sample file content for testing"
    return BytesIO(content)


class TestSafeFileMetadata:
    """Test the create_safe_file_metadata helper function"""
    
    def test_creates_safe_metadata_without_paths(self, temp_project_dir):
        """Test that metadata does NOT contain server paths"""
        # Create a test file
        test_file = temp_project_dir / "test.xml"
        test_file.write_text("test content")
        
        # Create safe metadata
        metadata = create_safe_file_metadata(
            file_path=test_file,
            file_type="vykaz_vymer",
            project_id="proj_test123"
        )
        
        # Verify structure
        assert "file_id" in metadata
        assert "filename" in metadata
        assert "size" in metadata
        assert "file_type" in metadata
        assert "uploaded_at" in metadata
        
        # CRITICAL: Verify NO server paths
        assert "path" not in metadata
        assert str(temp_project_dir) not in str(metadata)
        assert "/opt" not in str(metadata)
        assert "/home" not in str(metadata)
    
    def test_file_id_format(self, temp_project_dir):
        """Test that file_id has correct format"""
        test_file = temp_project_dir / "document.pdf"
        test_file.write_text("test")
        
        metadata = create_safe_file_metadata(
            file_path=test_file,
            file_type="vykresy",
            project_id="proj_abc789"
        )
        
        # file_id should be: "project_id:file_type:filename"
        expected_file_id = "proj_abc789:vykresy:document.pdf"
        assert metadata["file_id"] == expected_file_id
    
    def test_includes_all_required_fields(self, temp_project_dir):
        """Test that all required fields are present"""
        test_file = temp_project_dir / "test.xlsx"
        test_file.write_text("data" * 100)
        
        now = datetime.now()
        metadata = create_safe_file_metadata(
            file_path=test_file,
            file_type="rozpocet",
            project_id="proj_xyz",
            uploaded_at=now
        )
        
        assert metadata["filename"] == "test.xlsx"
        assert metadata["file_type"] == "rozpocet"
        assert metadata["size"] > 0
        assert now.isoformat() in metadata["uploaded_at"]


class TestUploadEndpointSecurity:
    """Test that upload endpoint does NOT leak paths"""
    
    def test_upload_response_has_no_paths(self, client, monkeypatch):
        """Test that upload response contains no server paths"""
        # Mock settings to use temp directory
        import tempfile
        temp_data_dir = Path(tempfile.mkdtemp())
        
        from app.core import config
        monkeypatch.setattr(config.settings, 'DATA_DIR', temp_data_dir)
        
        try:
            # Create test files
            vykaz_content = b"Test vykaz vymer content"
            vykres_content = b"Test drawing content"
            
            # Upload project
            response = client.post(
                "/api/upload",
                data={
                    "project_name": "Test Security Project",
                    "workflow": "A",
                    "auto_start_audit": "false"
                },
                files={
                    "vykaz_vymer": ("test_vykaz.xml", BytesIO(vykaz_content), "application/xml"),
                    "vykresy": ("test_drawing.pdf", BytesIO(vykres_content), "application/pdf"),
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            
            # CRITICAL: Verify response structure
            assert "files" in data
            assert isinstance(data["files"], list)
            assert len(data["files"]) > 0
            
            # CRITICAL: Check each file in response
            for file_info in data["files"]:
                # Should have safe metadata fields
                assert "file_id" in file_info
                assert "filename" in file_info
                assert "size" in file_info
                assert "file_type" in file_info
                
                # Should NOT have server paths
                assert "path" not in file_info or not file_info["path"].startswith("/")
                
                # Should not contain absolute path indicators
                response_str = str(file_info)
                assert "/opt" not in response_str
                assert "/home" not in response_str
                assert "/tmp" not in response_str or "tempfile" not in response_str
                assert str(temp_data_dir) not in response_str
        
        finally:
            # Cleanup
            if temp_data_dir.exists():
                shutil.rmtree(temp_data_dir)

    def test_upload_rejects_traversal_filename(self, client, monkeypatch, caplog):
        """Ensure crafted filenames with traversal sequences are rejected."""
        temp_data_dir = Path(tempfile.mkdtemp())

        from app.core import config
        monkeypatch.setattr(config.settings, 'DATA_DIR', temp_data_dir)

        try:
            caplog.set_level(logging.WARNING, logger="app.api.routes")

            response = client.post(
                "/api/upload",
                data={
                    "project_name": "Traversal Test",
                    "workflow": "A",
                    "auto_start_audit": "false"
                },
                files={
                    "vykaz_vymer": ("../../escape.txt", BytesIO(b"malicious"), "text/plain"),
                }
            )

            assert response.status_code == 400
            detail = response.json()["detail"].lower()
            assert "invalid filename" in detail or "filename" in detail

            assert any(
                "Rejected unsafe filename" in record.getMessage()
                for record in caplog.records
            )
        finally:
            if temp_data_dir.exists():
                shutil.rmtree(temp_data_dir)


class TestDownloadEndpointSecurity:
    """Test download endpoint security protections"""
    
    def test_path_traversal_protection(self, client):
        """Test that path traversal attacks are blocked"""
        # Attempt path traversal in file_id
        malicious_file_ids = [
            "proj_test123:vykresy:../../etc/passwd",
            "proj_test123:vykresy:../../../etc/shadow",
            "proj_test123:vykresy:..%2F..%2Fetc%2Fpasswd",
            "proj_test123:vykresy:....//....//etc/passwd",
        ]
        
        for file_id in malicious_file_ids:
            response = client.get(f"/api/projects/proj_test123/files/{file_id}/download")
            
            # Should be rejected (403 Forbidden or 404 Not Found)
            assert response.status_code in [403, 404], \
                f"Path traversal attack not blocked for: {file_id}"
    
    def test_cross_project_access_denied(self, client):
        """Test that accessing files from different project is blocked"""
        # Try to access project_B file using project_A id
        file_id = "proj_B:vykresy:sensitive.pdf"
        
        response = client.get(f"/api/projects/proj_A/files/{file_id}/download")
        
        # Should be 403 Forbidden (cross-project access) or 404 (project not found)
        # Both are acceptable as they prevent access
        assert response.status_code in [403, 404]
        if response.status_code == 403:
            detail = response.json()["detail"].lower()
            assert "nepatří" in detail or "access" in detail or "projekt" in detail
    
    def test_invalid_file_id_format(self, client):
        """Test that invalid file_id formats are rejected"""
        invalid_file_ids = [
            "invalid",
            "proj_test:only_two_parts",
            "",
            "proj_test:",
            ":vykresy:file.pdf",
        ]
        
        for file_id in invalid_file_ids:
            response = client.get(f"/api/projects/proj_test/files/{file_id}/download")
            
            # Should be 400 Bad Request or 404 Not Found
            # Both are acceptable as they prevent invalid access
            assert response.status_code in [400, 404], \
                f"Invalid file_id not rejected: {file_id}"


class TestFileListingSecurity:
    """Test file listing endpoint security"""
    
    def test_file_listing_has_no_paths(self, client, monkeypatch):
        """Test that file listing does NOT expose server paths"""
        import tempfile
        temp_data_dir = Path(tempfile.mkdtemp())
        
        from app.core import config
        monkeypatch.setattr(config.settings, 'DATA_DIR', temp_data_dir)
        
        try:
            # First upload a project
            response = client.post(
                "/api/upload",
                data={
                    "project_name": "Test Listing Project",
                    "workflow": "A",
                    "auto_start_audit": "false"
                },
                files={
                    "vykaz_vymer": ("list_test.xml", BytesIO(b"content"), "application/xml"),
                    "vykresy": ("drawing1.pdf", BytesIO(b"content"), "application/pdf"),
                }
            )
            
            assert response.status_code == 200
            project_id = response.json()["project_id"]
            
            # Now get file listing
            response = client.get(f"/api/projects/{project_id}/files")
            
            assert response.status_code == 200
            data = response.json()
            
            assert "files" in data
            assert "total_files" in data
            
            # Check each file
            for file_info in data["files"]:
                # Should have safe fields
                assert "file_id" in file_info
                assert "filename" in file_info
                
                # Should NOT have paths
                assert "path" not in file_info or not file_info["path"].startswith("/")
                
                # Verify no absolute paths in any field
                for key, value in file_info.items():
                    if isinstance(value, str):
                        assert not value.startswith("/opt")
                        assert not value.startswith("/home")
                        assert str(temp_data_dir) not in value
        
        finally:
            if temp_data_dir.exists():
                shutil.rmtree(temp_data_dir)


class TestIntegrationSecurity:
    """Integration tests for complete upload → list → download flow"""
    
    def test_complete_secure_flow(self, client, monkeypatch):
        """Test complete flow: upload file, list files, download file"""
        import tempfile
        temp_data_dir = Path(tempfile.mkdtemp())
        
        from app.core import config
        monkeypatch.setattr(config.settings, 'DATA_DIR', temp_data_dir)
        
        try:
            # Clear project store
            project_store.clear()
            
            # 1. Upload project
            test_content = b"Secret data that should be downloadable"
            drawing_content = b"Drawing content for workflow A"
            upload_response = client.post(
                "/api/upload",
                data={
                    "project_name": "Integration Test",
                    "workflow": "A",
                    "auto_start_audit": "false"
                },
                files={
                    "vykaz_vymer": ("integration.xml", BytesIO(test_content), "application/xml"),
                    "vykresy": ("drawing.pdf", BytesIO(drawing_content), "application/pdf"),
                }
            )
            
            assert upload_response.status_code == 200
            upload_data = upload_response.json()
            project_id = upload_data["project_id"]
            
            # Verify no paths in upload response
            assert len(upload_data["files"]) > 0
            file_info = upload_data["files"][0]
            assert "file_id" in file_info
            assert "path" not in file_info or not file_info["path"].startswith("/")
            
            # 2. List files
            list_response = client.get(f"/api/projects/{project_id}/files")
            assert list_response.status_code == 200
            list_data = list_response.json()
            
            # Verify no paths in listing
            assert list_data["total_files"] > 0
            listed_file = list_data["files"][0]
            assert "file_id" in listed_file
            
            # 3. Download file using file_id
            file_id = listed_file["file_id"]
            download_response = client.get(
                f"/api/projects/{project_id}/files/{file_id}/download"
            )
            
            assert download_response.status_code == 200
            assert download_response.content == test_content
            
            # 4. Try to download with wrong project_id (should fail)
            wrong_response = client.get(
                f"/api/projects/wrong_proj/files/{file_id}/download"
            )
            assert wrong_response.status_code in [403, 404]
        
        finally:
            if temp_data_dir.exists():
                shutil.rmtree(temp_data_dir)
            project_store.clear()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
