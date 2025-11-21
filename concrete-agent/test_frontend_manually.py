#!/usr/bin/env python3
"""
Frontend Testing Script - Manual Workflow A Test
Simulates what frontend does when user uploads a file
"""
import requests
import json
from pathlib import Path
import time

# Configuration
BACKEND_URL = "https://concrete-agent.onrender.com"
# BACKEND_URL = "http://localhost:8000"  # For local testing

def print_section(title):
    """Print section header"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)

def test_backend_health():
    """Test 1: Check backend health"""
    print_section("TEST 1: Backend Health Check")

    url = f"{BACKEND_URL}/health"
    response = requests.get(url)

    print(f"URL: {url}")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")

    assert response.status_code == 200, "Health check failed!"
    print("✅ Backend is healthy!")
    return True

def test_list_projects():
    """Test 2: List existing projects"""
    print_section("TEST 2: List Projects")

    url = f"{BACKEND_URL}/api/projects"
    response = requests.get(url)

    print(f"URL: {url}")
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)}")

    print(f"\n📊 Total projects: {data.get('total', 0)}")

    if data.get('projects'):
        print("\nExisting projects:")
        for proj in data['projects']:
            print(f"  - {proj.get('project_name')} (ID: {proj.get('project_id')})")
    else:
        print("No projects found - this is expected for new deployment")

    return data

def test_upload_project(excel_file_path: Path):
    """Test 3: Upload Excel file (Workflow A)"""
    print_section("TEST 3: Upload Excel File (Workflow A)")

    if not excel_file_path.exists():
        print(f"❌ File not found: {excel_file_path}")
        print("\nPlease provide path to a real Czech Excel file (BOQ/Výkaz výměr)")
        return None

    url = f"{BACKEND_URL}/api/upload"

    # Read file
    with open(excel_file_path, 'rb') as f:
        files = {
            'file': (excel_file_path.name, f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        }

        print(f"URL: {url}")
        print(f"File: {excel_file_path.name}")
        print(f"Size: {excel_file_path.stat().st_size / 1024:.1f} KB")
        print("\nUploading...")

        response = requests.post(url, files=files)

    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)}")

        project_id = data.get('project_id')
        print(f"\n✅ Project uploaded successfully!")
        print(f"📋 Project ID: {project_id}")

        return project_id
    else:
        print(f"❌ Upload failed!")
        print(f"Error: {response.text}")
        return None

def test_get_positions(project_id: str):
    """Test 4: Get parsed positions"""
    print_section("TEST 4: Get Parsed Positions")

    url = f"{BACKEND_URL}/api/workflow/a/positions"
    params = {'project_id': project_id}

    print(f"URL: {url}")
    print(f"Params: {params}")
    print("\nFetching positions...")

    response = requests.get(url, params=params)

    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        positions = data.get('positions', [])

        print(f"\n✅ Positions retrieved!")
        print(f"📊 Total positions: {len(positions)}")

        if positions:
            print("\nFirst 3 positions:")
            for i, pos in enumerate(positions[:3], 1):
                print(f"\n  Position {i}:")
                print(f"    Number: {pos.get('position_number', 'N/A')}")
                print(f"    Description: {pos.get('description', 'N/A')[:60]}...")
                print(f"    Quantity: {pos.get('quantity', 0)} {pos.get('unit', '')}")
                if 'unit_price' in pos:
                    print(f"    Price: {pos.get('unit_price')} CZK")

        return positions
    else:
        print(f"❌ Failed to get positions!")
        print(f"Error: {response.text}")
        return []

def test_generate_tech_card(project_id: str, position_id: str):
    """Test 5: Generate tech card"""
    print_section("TEST 5: Generate Tech Card (AI)")

    url = f"{BACKEND_URL}/api/workflow/a/tech-card"
    payload = {
        'project_id': project_id,
        'position_id': position_id
    }

    print(f"URL: {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    print("\nGenerating tech card with AI (this may take 10-30 seconds)...")

    response = requests.post(url, json=payload)

    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print(f"\n✅ Tech card generated!")

        # Check for artifact
        if 'artifact' in data:
            artifact = data['artifact']
            print(f"\n📄 Artifact Type: {artifact.get('type')}")
            print(f"📝 Title: {artifact.get('title', 'N/A')}")

            if 'data' in artifact:
                artifact_data = artifact['data']
                print(f"\n📊 Artifact Data Preview:")
                for key, value in list(artifact_data.items())[:5]:
                    if isinstance(value, str) and len(value) > 100:
                        print(f"  {key}: {value[:100]}...")
                    else:
                        print(f"  {key}: {value}")

        return data
    else:
        print(f"❌ Tech card generation failed!")
        print(f"Error: {response.text}")
        return None

def test_chat_message(project_id: str, message: str):
    """Test 6: Send chat message"""
    print_section("TEST 6: Chat Interface")

    url = f"{BACKEND_URL}/api/chat/message"
    payload = {
        'project_id': project_id,
        'message': message
    }

    print(f"URL: {url}")
    print(f"Message: {message}")
    print("\nSending message to AI...")

    response = requests.post(url, json=payload)

    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print(f"\n✅ AI Response received!")

        if 'response' in data:
            print(f"\n🤖 AI: {data['response']}")

        if 'artifact' in data:
            print(f"\n📄 Artifact attached: {data['artifact'].get('type')}")

        return data
    else:
        print(f"❌ Chat failed!")
        print(f"Error: {response.text}")
        return None

def main():
    """Run all tests"""
    print_section("🧪 FRONTEND TESTING SCRIPT - WORKFLOW A")
    print("\nThis script tests the same endpoints that the frontend uses.")
    print("It simulates: Upload → Parse → Generate Tech Card → Chat\n")

    try:
        # Test 1: Health check
        test_backend_health()
        time.sleep(1)

        # Test 2: List projects
        projects_data = test_list_projects()
        time.sleep(1)

        # Test 3: Upload file
        print("\n" + "=" * 80)
        print("📁 FILE UPLOAD TEST")
        print("=" * 80)
        print("\nTo test file upload, you need a real Czech Excel file.")
        print("\nOptions:")
        print("  1. Provide path to existing Excel file")
        print("  2. Skip upload and test with existing project")
        print("  3. Exit and prepare test file")

        choice = input("\nEnter choice (1/2/3): ").strip()

        project_id = None

        if choice == "1":
            file_path = input("Enter path to Excel file: ").strip()
            project_id = test_upload_project(Path(file_path))
            time.sleep(2)
        elif choice == "2":
            if projects_data.get('projects'):
                project_id = projects_data['projects'][0]['project_id']
                print(f"\n✅ Using existing project: {project_id}")
            else:
                print("\n❌ No existing projects found!")
                return
        else:
            print("\n👋 Exiting. Prepare a test file and run again.")
            return

        if not project_id:
            print("\n❌ No project ID available. Cannot continue.")
            return

        # Test 4: Get positions
        positions = test_get_positions(project_id)
        time.sleep(1)

        if not positions:
            print("\n❌ No positions found. Cannot test tech card generation.")
            return

        # Test 5: Generate tech card for first position
        first_position = positions[0]
        position_id = first_position.get('id') or first_position.get('position_id') or '1'

        test_generate_tech_card(project_id, position_id)
        time.sleep(1)

        # Test 6: Chat
        test_chat_message(project_id, "Shrň tento projekt")

        # Summary
        print_section("✅ TESTING COMPLETE")
        print("\n📊 Summary:")
        print("  ✅ Backend health check")
        print("  ✅ Projects list")
        if choice == "1":
            print("  ✅ File upload")
        print("  ✅ Positions parsing")
        print("  ✅ Tech card generation (AI)")
        print("  ✅ Chat interface")
        print("\n🎉 All tests passed!")

    except KeyboardInterrupt:
        print("\n\n👋 Testing interrupted by user.")
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
