"""
Tests for empty file parameter validation
Reproduces and validates the fix for empty string file parameters
"""
import pytest
from fastapi.testclient import TestClient
from io import BytesIO

from app.main import app
from app.api.routes import project_store
from app.core.config import settings


@pytest.fixture
def client():
    """Create FastAPI test client"""
    return TestClient(app)


@pytest.fixture(autouse=True)
def clear_project_store():
    """Clear project store before each test"""
    project_store.clear()
    yield
    project_store.clear()


@pytest.fixture
def enable_workflow_b(monkeypatch):
    """Temporarily enable Workflow B"""
    original = settings.ENABLE_WORKFLOW_B
    monkeypatch.setattr(settings, "ENABLE_WORKFLOW_B", True)
    yield
    monkeypatch.setattr(settings, "ENABLE_WORKFLOW_B", original)


class TestEmptyFileParameters:
    """Test that empty file parameters are handled correctly"""
    
    def test_empty_rozpocet_parameter(self, client):
        """Test that empty rozpocet parameter doesn't cause validation error"""
        # Create a dummy drawing file
        drawing_content = b"PDF content for testing"
        
        # Simulate curl -F 'rozpocet=' (empty value)
        response = client.post(
            "/api/upload",
            data={
                "project_name": "Test Project",
                "workflow": "A",
                "rozpocet": "",  # Empty string
                "auto_start_audit": "false",  # Don't start background processing
            },
            files={
                "vykaz_vymer": ("vykaz.xml", BytesIO(b"<xml>test</xml>"), "application/xml"),
                "vykresy": ("drawing.pdf", BytesIO(drawing_content), "application/pdf"),
            }
        )
        
        # Should not return validation error
        assert response.status_code != 422, f"Validation error: {response.json()}"
        assert response.status_code == 200, f"Upload failed: {response.json()}"
    
    def test_empty_zmeny_list_parameter(self, client):
        """Test that empty zmeny list doesn't cause validation error"""
        drawing_content = b"PDF content for testing"
        
        response = client.post(
            "/api/upload",
            data={
                "project_name": "Test Project",
                "workflow": "A",
                "zmeny": [""],  # List with empty string
                "auto_start_audit": "false",
            },
            files={
                "vykaz_vymer": ("vykaz.xml", BytesIO(b"<xml>test</xml>"), "application/xml"),
                "vykresy": ("drawing.pdf", BytesIO(drawing_content), "application/pdf"),
            }
        )
        
        assert response.status_code != 422, f"Validation error: {response.json()}"
        assert response.status_code == 200, f"Upload failed: {response.json()}"
    
    def test_all_optional_files_empty(self, client):
        """Test with all optional files as empty strings"""
        drawing_content = b"PDF content for testing"
        
        response = client.post(
            "/api/upload",
            data={
                "project_name": "Test Project",
                "workflow": "A",
                "rozpocet": "",
                "dokumentace": [""],
                "zmeny": [""],
                "auto_start_audit": "false",
            },
            files={
                "vykaz_vymer": ("vykaz.xml", BytesIO(b"<xml>test</xml>"), "application/xml"),
                "vykresy": ("drawing.pdf", BytesIO(drawing_content), "application/pdf"),
            }
        )
        
        assert response.status_code != 422, f"Validation error: {response.json()}"
        assert response.status_code == 200, f"Upload failed: {response.json()}"
        
        # Verify response structure
        result = response.json()
        assert "project_id" in result
        assert result["status"] in ["uploaded", "processing"]
    
    def test_workflow_b_with_empty_optional_files(self, client, enable_workflow_b):
        """Test Workflow B with empty optional file parameters"""
        drawing_content = b"PDF content for testing"

        response = client.post(
            "/api/upload",
            data={
                "project_name": "Test Project",
                "workflow": "B",
                "rozpocet": "",
                "dokumentace": [""],
                "zmeny": [""],
                "auto_start_audit": "false",
            },
            files={
                "vykresy": ("drawing.pdf", BytesIO(drawing_content), "application/pdf"),
            }
        )

        assert response.status_code != 422, f"Validation error: {response.json()}"
        assert response.status_code == 200, f"Upload failed: {response.json()}"

    def test_workflow_b_rejected_when_disabled(self, client, monkeypatch):
        """Workflow B uploads should be rejected when feature is disabled"""
        monkeypatch.setattr(settings, "ENABLE_WORKFLOW_B", False)

        drawing_content = b"PDF content for testing"

        response = client.post(
            "/api/upload",
            data={
                "project_name": "Test Project",
                "workflow": "B",
                "auto_start_audit": "false",
            },
            files={
                "vykresy": ("drawing.pdf", BytesIO(drawing_content), "application/pdf"),
            }
        )

        assert response.status_code == 503
        assert response.json() == {
            "detail": (
                "Workflow B is currently disabled. Please contact the system "
                "administrator to enable it or try Workflow A."
            )
        }


class TestNewFileExtensions:
    """Test support for new file extensions (.csv, .txt)"""
    
    def test_csv_vykaz_file(self, client):
        """Test that .csv files are accepted for vykaz"""
        csv_content = b"column1,column2\nvalue1,value2"
        drawing_content = b"PDF content"
        
        response = client.post(
            "/api/upload",
            data={
                "project_name": "CSV Test",
                "workflow": "A",
                "auto_start_audit": "false",
            },
            files={
                "vykaz_vymer": ("vykaz.csv", BytesIO(csv_content), "text/csv"),
                "vykresy": ("drawing.pdf", BytesIO(drawing_content), "application/pdf"),
            }
        )
        
        assert response.status_code == 200, f"CSV upload failed: {response.json()}"
    
    def test_txt_vykresy_file(self, client):
        """Test that .txt files are accepted for vykresy"""
        txt_content = b"Text drawing description"
        vykaz_content = b"<xml>test</xml>"
        
        response = client.post(
            "/api/upload",
            data={
                "project_name": "TXT Test",
                "workflow": "A",
                "auto_start_audit": "false",
            },
            files={
                "vykaz_vymer": ("vykaz.xml", BytesIO(vykaz_content), "application/xml"),
                "vykresy": ("drawing.txt", BytesIO(txt_content), "text/plain"),
            }
        )
        
        assert response.status_code == 200, f"TXT upload failed: {response.json()}"
    
    def test_txt_dokumentace_file(self, client):
        """Test that .txt files are accepted for dokumentace"""
        vykaz_content = b"<xml>test</xml>"
        drawing_content = b"PDF content"
        txt_content = b"Documentation text"
        
        response = client.post(
            "/api/upload",
            data={
                "project_name": "TXT Dokumentace Test",
                "workflow": "A",
                "auto_start_audit": "false",
            },
            files={
                "vykaz_vymer": ("vykaz.xml", BytesIO(vykaz_content), "application/xml"),
                "vykresy": ("drawing.pdf", BytesIO(drawing_content), "application/pdf"),
                "dokumentace": ("doc.txt", BytesIO(txt_content), "text/plain"),
            }
        )
        
        assert response.status_code == 200, f"TXT dokumentace upload failed: {response.json()}"
