# Google Drive Integration Guide

**Version:** 1.0.0
**Last Updated:** 2026-01-13
**Status:** ✅ Folder Sync Ready, 🚧 API Integration In Progress

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Method 1: Google Drive Desktop Sync](#method-1-google-drive-desktop-sync) ⭐ READY
3. [Method 2: Manual Export](#method-2-manual-export) ✅ WORKS NOW
4. [Method 3: Google Drive API](#method-3-google-drive-api) 🚧 IN PROGRESS
5. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

STAVAGENT offers **3 ways** to work with Google Drive:

| Method | Setup Time | Auto-Sync | Technical Level | Status |
|--------|------------|-----------|-----------------|--------|
| **Desktop Sync** | 5 min | ✅ Yes | Easy | ✅ Ready |
| **Manual Export** | 0 min | ❌ No | Very Easy | ✅ Works |
| **API Integration** | 2-3 days | ✅ Yes | Advanced | 🚧 Dev |

---

## 📂 Method 1: Google Drive Desktop Sync ⭐

**Best for:** Teams with shared Google Drive folders containing construction documents.

### Prerequisites

1. **Google Drive Desktop** installed
   - Windows: https://www.google.com/drive/download/
   - macOS: https://www.google.com/drive/download/
   - Linux: Use `rclone` or `insync`

2. **Google Drive folder synced locally**
   - Example paths:
     - Windows: `G:\Můj disk\Projekty`
     - macOS: `/Users/name/Google Drive/Projekty`
     - Linux: `/home/user/GoogleDrive/Projekty`

### Setup Steps

#### Step 1: Install Google Drive Desktop

```bash
# Windows
# Download installer from https://www.google.com/drive/download/
# Run installer, sign in with Google account

# macOS
brew install --cask google-drive

# Linux (using rclone)
sudo apt install rclone
rclone config  # Configure Google Drive
rclone mount gdrive: ~/GoogleDrive --daemon
```

#### Step 2: Configure Sync Folder

1. Open Google Drive Desktop
2. Click Settings → Preferences
3. Select "Mirror files" or "Stream files"
   - **Mirror:** Full local copy (recommended for construction docs)
   - **Stream:** Files downloaded on-demand (saves disk space)

4. Choose folders to sync:
   - ✅ Projekty
   - ✅ Výkazy výměr
   - ✅ Technické zprávy

#### Step 3: Add Folder in STAVAGENT

1. Open STAVAGENT Portal → **📁 Akumulace dokumentů**

2. Create or select a project

3. Click **"Přidat složku"** button

4. Enter **folder path**:
   ```
   Windows example:
   G:\Můj disk\Projekty\Most přes Biokoridor

   macOS example:
   /Users/name/Google Drive/Projekty/Most přes Biokoridor

   Linux example:
   /home/user/GoogleDrive/Projekty/Most přes Biokoridor
   ```

5. Select **folder type:** `google_drive`

6. Click **"Přidat"**

#### Step 4: Background Processing

STAVAGENT automatically:
1. ✅ **Scans folder** for supported files (PDF, Excel, XML)
2. ✅ **Parses documents** using SmartParser (background task)
3. ✅ **Extracts positions** (concrete, reinforcement, formwork)
4. ✅ **Saves to database** with version tracking
5. ✅ **Generates summary** (Multi-Role AI analysis)

**Monitor progress:**
- Watch the **"Background Tasks"** panel
- Status updates in real-time via WebSocket
- See file count: `5 parsed / 12 total`

### Folder Structure Recommendations

```
Google Drive/
└── Projekty/
    ├── Most přes Biokoridor/
    │   ├── Výkaz výměr/
    │   │   ├── Výkaz_SO201.xlsx       ✅ Auto-parsed
    │   │   ├── Výkaz_SO202.xlsx       ✅ Auto-parsed
    │   │   └── Změny_2024-12.xlsx     ✅ Auto-parsed
    │   ├── Technická zpráva/
    │   │   ├── TZ_Most.pdf             ✅ Auto-parsed
    │   │   └── Přílohy.pdf             ✅ Auto-parsed
    │   └── KROS/
    │       └── Rozpočet_KROS.xml       ✅ Auto-parsed
    └── Bytový dům Brno/
        └── ... (similar structure)
```

### Automatic Sync Behavior

**When you add/modify files in Google Drive:**

```mermaid
User adds file to Google Drive
    ↓
Google Drive Desktop syncs file to local folder
    ↓
STAVAGENT background task scans folder (every 5 min)
    ↓
New file detected → Added to database (status: pending)
    ↓
SmartParser parses file (background)
    ↓
Positions extracted and saved
    ↓
Summary regenerated with new data
```

**Frequency:**
- Folder scan: Every **5 minutes** (configurable)
- File parsing: **Immediate** (queued, processed in background)
- Summary update: **On-demand** (click "Generovat shrnutí")

---

## 📤 Method 2: Manual Export

**Best for:** Quick one-time exports or users without Google Drive Desktop.

### Steps

1. **Open** STAVAGENT Portal → **🔍 Shrnutí dokumentu**

2. **Upload file** (PDF, Excel, XML, DOCX)

3. **Wait** for analysis (5-30 seconds)

4. **Save to project:**
   - Select project from dropdown
   - Click **"Uložit do projektu"**
   - File saved to database + parsed

5. **Export to CSV:**
   - Click **"Export CSV"**
   - Open Google Drive in browser
   - **Drag-drop** CSV file to desired folder

**OR:**

5. **Manual upload to Google Drive:**
   - Open Google Drive in browser
   - Navigate to project folder
   - Click **"New" → "File upload"**
   - Select exported CSV

### Limitations

- ❌ No automatic sync
- ❌ Manual upload required for each file
- ❌ No real-time updates

---

## 🚀 Method 3: Google Drive API Integration 🚧

**Status:** 🚧 In Development (2-3 days)

### Planned Features

1. **OAuth2 Authentication**
   - Sign in with Google account
   - Authorize STAVAGENT to access Drive

2. **Direct Upload**
   - Click **"Nahrát do Google Drive"** button
   - Select destination folder (from Google Drive)
   - File uploaded directly via API

3. **Folder Monitoring**
   - STAVAGENT monitors Google Drive folder
   - No Desktop app required
   - Uses webhooks for real-time notifications

4. **Bidirectional Sync**
   - Upload from STAVAGENT → Google Drive
   - Download from Google Drive → STAVAGENT
   - Conflict resolution

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        STAVAGENT PORTAL                              │
│                                                                      │
│  User clicks "Nahrát do Google Drive"                               │
│    ↓                                                                 │
│  OAuth2 Flow (if not authenticated)                                 │
│    ↓                                                                 │
│  Select destination folder (Google Drive Picker)                    │
│    ↓                                                                 │
│  POST /api/v1/google/upload                                         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────────────┐
│                    CONCRETE-AGENT BACKEND                            │
│                                                                      │
│  GoogleDriveService.upload_file()                                   │
│    ↓                                                                 │
│  1. Get OAuth2 credentials from session                             │
│  2. Build Google Drive API client                                   │
│  3. Upload file using MediaFileUpload                               │
│  4. Return file_id and web_url                                      │
│                                                                      │
│  Dependencies:                                                       │
│  - google-auth-oauthlib                                             │
│  - google-api-python-client                                         │
└─────────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────────────┐
│                        GOOGLE DRIVE API                              │
│                                                                      │
│  files.create() → Upload file                                       │
│  files.list() → List folder contents                                │
│  files.watch() → Set up webhook for changes                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Implementation Plan

#### Phase 1: OAuth2 Setup (Day 1)

**Tasks:**
1. Create Google Cloud Project
2. Enable Google Drive API
3. Configure OAuth2 consent screen
4. Create OAuth2 credentials
5. Add authorized redirect URIs

**Backend:**
```python
# concrete-agent/packages/core-backend/app/services/google_drive.py

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

class GoogleDriveService:
    SCOPES = ['https://www.googleapis.com/auth/drive.file']

    def __init__(self):
        self.client_secrets_file = os.getenv('GOOGLE_CLIENT_SECRETS_FILE')
        self.redirect_uri = os.getenv('GOOGLE_OAUTH_REDIRECT_URI')

    def get_authorization_url(self, state: str) -> str:
        """Generate OAuth2 authorization URL."""
        flow = Flow.from_client_secrets_file(
            self.client_secrets_file,
            scopes=self.SCOPES,
            redirect_uri=self.redirect_uri
        )
        flow.state = state
        authorization_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true'
        )
        return authorization_url

    def exchange_code_for_token(self, code: str) -> Credentials:
        """Exchange authorization code for access token."""
        flow = Flow.from_client_secrets_file(
            self.client_secrets_file,
            scopes=self.SCOPES,
            redirect_uri=self.redirect_uri
        )
        flow.fetch_token(code=code)
        return flow.credentials
```

**API Routes:**
```python
# concrete-agent/packages/core-backend/app/api/routes_google.py

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import RedirectResponse

router = APIRouter(prefix="/api/v1/google", tags=["Google Drive"])

@router.get("/auth")
async def google_auth(session_id: str):
    """Initiate OAuth2 flow."""
    service = GoogleDriveService()
    auth_url = service.get_authorization_url(state=session_id)
    return RedirectResponse(auth_url)

@router.get("/callback")
async def google_callback(code: str, state: str):
    """Handle OAuth2 callback."""
    service = GoogleDriveService()
    credentials = service.exchange_code_for_token(code)

    # Save credentials to session
    # (use Redis or database)
    save_user_credentials(state, credentials)

    return {"success": True, "message": "Authorized"}
```

#### Phase 2: Upload Functionality (Day 2)

**Backend:**
```python
# google_drive.py (continued)

def upload_file(
    self,
    credentials: Credentials,
    file_path: Path,
    folder_id: str,
    file_name: str = None
) -> dict:
    """Upload file to Google Drive."""
    service = build('drive', 'v3', credentials=credentials)

    file_metadata = {
        'name': file_name or file_path.name,
        'parents': [folder_id]
    }

    media = MediaFileUpload(
        str(file_path),
        resumable=True
    )

    file = service.files().create(
        body=file_metadata,
        media_body=media,
        fields='id, webViewLink'
    ).execute()

    return {
        'file_id': file.get('id'),
        'web_url': file.get('webViewLink')
    }

def list_folders(self, credentials: Credentials) -> list:
    """List all folders in user's Drive."""
    service = build('drive', 'v3', credentials=credentials)

    results = service.files().list(
        q="mimeType='application/vnd.google-apps.folder'",
        pageSize=100,
        fields="files(id, name)"
    ).execute()

    return results.get('files', [])
```

**API Route:**
```python
@router.post("/upload")
async def upload_to_google_drive(
    file_id: str,
    drive_folder_id: str,
    session_id: str
):
    """Upload file from STAVAGENT to Google Drive."""
    # 1. Get user credentials from session
    credentials = get_user_credentials(session_id)
    if not credentials:
        raise HTTPException(401, "Not authorized")

    # 2. Get file from database
    file_path = get_file_path_from_db(file_id)

    # 3. Upload to Google Drive
    service = GoogleDriveService()
    result = service.upload_file(
        credentials,
        file_path,
        drive_folder_id
    )

    return {
        "success": True,
        "file_id": result['file_id'],
        "web_url": result['web_url']
    }
```

#### Phase 3: Frontend Integration (Day 2-3)

**DocumentSummary.tsx:**
```tsx
// Add Google Drive button
const [isGoogleAuthorized, setIsGoogleAuthorized] = useState(false);
const [googleFolders, setGoogleFolders] = useState<Array<{id: string, name: string}>>([]);

const handleGoogleAuth = async () => {
  const sessionId = generateSessionId();
  const authUrl = `${CORE_API_URL}/api/v1/google/auth?session_id=${sessionId}`;

  // Open popup
  const popup = window.open(authUrl, 'GoogleAuth', 'width=600,height=700');

  // Listen for callback
  window.addEventListener('message', (event) => {
    if (event.data.type === 'google_auth_success') {
      setIsGoogleAuthorized(true);
      loadGoogleFolders();
    }
  });
};

const handleUploadToGoogleDrive = async () => {
  if (!selectedGoogleFolder) {
    alert('Vyberte složku Google Drive');
    return;
  }

  const response = await fetch(`${CORE_API_URL}/api/v1/google/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_id: savedFileId,
      drive_folder_id: selectedGoogleFolder,
      session_id: sessionStorage.getItem('google_session_id')
    })
  });

  const data = await response.json();

  if (data.success) {
    alert(`✅ Soubor nahrán do Google Drive!\n${data.web_url}`);
  }
};

// UI
<button onClick={handleGoogleAuth} disabled={isGoogleAuthorized}>
  {isGoogleAuthorized ? '✅ Připojeno' : '🔗 Připojit Google Drive'}
</button>

{isGoogleAuthorized && (
  <>
    <select value={selectedGoogleFolder} onChange={e => setSelectedGoogleFolder(e.target.value)}>
      <option value="">Vyberte složku...</option>
      {googleFolders.map(folder => (
        <option key={folder.id} value={folder.id}>{folder.name}</option>
      ))}
    </select>

    <button onClick={handleUploadToGoogleDrive}>
      <CloudUpload size={16} />
      Nahrát do Google Drive
    </button>
  </>
)}
```

#### Phase 4: Webhook Monitoring (Day 3)

**Backend:**
```python
def setup_webhook(self, credentials: Credentials, folder_id: str, callback_url: str):
    """Set up webhook to monitor folder changes."""
    service = build('drive', 'v3', credentials=credentials)

    channel_id = str(uuid.uuid4())

    body = {
        'id': channel_id,
        'type': 'web_hook',
        'address': callback_url,
        'expiration': int((datetime.now() + timedelta(days=7)).timestamp() * 1000)
    }

    response = service.files().watch(
        fileId=folder_id,
        body=body
    ).execute()

    return response

@router.post("/webhook")
async def google_drive_webhook(request: Request):
    """Receive notifications about file changes."""
    headers = request.headers

    if headers.get('X-Goog-Resource-State') == 'update':
        # File updated in Google Drive
        folder_id = headers.get('X-Goog-Resource-ID')

        # Trigger sync
        await sync_folder_from_google_drive(folder_id)

    return {"success": True}
```

### Environment Variables Required

```env
# Google Cloud Console → APIs & Services → Credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=https://concrete-agent.onrender.com/api/v1/google/callback

# Path to client_secrets.json file
GOOGLE_CLIENT_SECRETS_FILE=/path/to/client_secrets.json
```

### Security Considerations

1. **OAuth2 Scopes:**
   - Use minimal scope: `https://www.googleapis.com/auth/drive.file`
   - Only access files created by STAVAGENT (not entire Drive)

2. **Credentials Storage:**
   - Store refresh tokens encrypted in database
   - Use Redis for short-term session storage
   - Never commit credentials to git

3. **Webhook Verification:**
   - Verify `X-Goog-Channel-Token` header
   - Use HTTPS only for webhooks
   - Set expiration for channels (7 days)

---

## 🛠️ Troubleshooting

### Google Drive Desktop Not Syncing

**Problem:** Files not appearing in STAVAGENT after adding to Drive.

**Solutions:**
1. Check Google Drive Desktop sync status (icon in system tray)
2. Verify folder is set to "Mirror files" (not "Stream")
3. Check disk space (sync pauses if disk full)
4. Restart Google Drive Desktop

### Folder Path Not Found

**Problem:** Error "Folder path not found" when adding folder.

**Solutions:**
1. Copy-paste path from File Explorer (don't type manually)
2. Check path separator:
   - Windows: Use `\` or `/`
   - macOS/Linux: Use `/`
3. Ensure folder is fully synced (check Drive icon)

### Files Not Being Parsed

**Problem:** Files uploaded but status stuck on "pending".

**Solutions:**
1. Check file format (must be PDF, Excel, XML, or DOCX)
2. Check file size (max 100MB for free tier)
3. Check backend logs for parsing errors
4. Try re-uploading file

### OAuth2 Errors

**Problem:** "Error 400: redirect_uri_mismatch" during Google auth.

**Solutions:**
1. Add redirect URI to Google Cloud Console:
   - Go to: APIs & Services → Credentials
   - Edit OAuth 2.0 Client
   - Add: `https://concrete-agent.onrender.com/api/v1/google/callback`
2. Ensure HTTPS (not HTTP)
3. Check environment variable `GOOGLE_OAUTH_REDIRECT_URI`

---

## 📊 Comparison Table

| Feature | Desktop Sync | Manual Export | API Integration |
|---------|--------------|---------------|-----------------|
| **Auto-sync** | ✅ Every 5 min | ❌ Manual | ✅ Real-time (webhooks) |
| **Setup time** | 5 min | 0 min | 2-3 days (dev) |
| **Desktop app required** | ✅ Yes | ❌ No | ❌ No |
| **Disk space** | Medium (mirrored files) | None | None |
| **Internet required** | For initial sync | Always | Always |
| **Cost** | Free | Free | Free (Google API) |
| **Best for** | Team collaboration | Quick exports | Automated workflows |
| **Status** | ✅ Ready now | ✅ Works now | 🚧 In development |

---

## 📞 Support

**Issues?**
- Check [Troubleshooting](#troubleshooting) section
- Open issue: https://github.com/alpro1000/STAVAGENT/issues
- Email: support@stavagent.com

**Feature requests?**
- Vote on existing: https://github.com/alpro1000/STAVAGENT/discussions
- Suggest new: Create discussion with `[Feature Request]` prefix

---

**Last Updated:** 2026-01-13
**Next Update:** API Integration completion (ETA: 2026-01-16)
