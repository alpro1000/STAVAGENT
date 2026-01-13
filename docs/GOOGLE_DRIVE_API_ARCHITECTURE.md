# Google Drive API Integration - Technical Architecture

**Version:** 1.0.0
**Target Implementation:** 3 days
**Complexity:** Medium
**Status:** 🚧 Design Phase

---

## 📋 Executive Summary

Direct Google Drive API integration allows users to:
- Upload files from STAVAGENT → Google Drive (no Desktop app)
- Monitor Google Drive folders for changes (webhooks)
- Bidirectional sync between STAVAGENT and Google Drive
- OAuth2 authentication for secure access

**Key Benefits:**
- No Desktop app required
- Real-time sync via webhooks
- Works on any platform (web, mobile)
- Granular access control (OAuth2 scopes)

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                              │
│                                                                      │
│  DocumentSummary.tsx / ProjectDocuments.tsx                         │
│    ↓                                                                 │
│  1. User clicks "Připojit Google Drive"                             │
│  2. OAuth2 popup window opens                                       │
│  3. User grants permissions                                         │
│  4. Credentials saved to session                                    │
│  5. User selects destination folder                                 │
│  6. File uploaded via API                                           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────────────┐
│                    CONCRETE-AGENT BACKEND                            │
│                      (FastAPI Python 3.10+)                          │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ API Layer (app/api/routes_google.py)                          │ │
│  │                                                                │ │
│  │  GET  /api/v1/google/auth                  → Init OAuth2     │ │
│  │  GET  /api/v1/google/callback              → Handle callback │ │
│  │  GET  /api/v1/google/folders               → List folders    │ │
│  │  POST /api/v1/google/upload                → Upload file     │ │
│  │  POST /api/v1/google/download              → Download file   │ │
│  │  POST /api/v1/google/webhook               → Receive changes │ │
│  │  POST /api/v1/google/setup-watch           → Setup webhook   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                               ↓                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Service Layer (app/services/google_drive_service.py)          │ │
│  │                                                                │ │
│  │  - GoogleDriveService                                         │ │
│  │    ├── get_authorization_url()                                │ │
│  │    ├── exchange_code_for_token()                              │ │
│  │    ├── refresh_credentials()                                  │ │
│  │    ├── upload_file()                                          │ │
│  │    ├── download_file()                                        │ │
│  │    ├── list_folders()                                         │ │
│  │    ├── setup_webhook()                                        │ │
│  │    └── stop_webhook()                                         │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                               ↓                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Database Layer (PostgreSQL/SQLite)                            │ │
│  │                                                                │ │
│  │  google_credentials                                           │ │
│  │  ├── user_id                                                  │ │
│  │  ├── access_token (encrypted)                                 │ │
│  │  ├── refresh_token (encrypted)                                │ │
│  │  ├── token_expiry                                             │ │
│  │  └── scopes                                                   │ │
│  │                                                                │ │
│  │  google_webhooks                                              │ │
│  │  ├── channel_id                                               │ │
│  │  ├── folder_id                                                │ │
│  │  ├── project_id                                               │ │
│  │  ├── expiration                                               │ │
│  │  └── resource_id                                              │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────────────┐
│                        GOOGLE DRIVE API                              │
│                    (OAuth 2.0 + REST API)                            │
│                                                                      │
│  OAuth 2.0 Endpoints:                                               │
│  - https://accounts.google.com/o/oauth2/v2/auth                     │
│  - https://oauth2.googleapis.com/token                              │
│                                                                      │
│  Drive API v3 Endpoints:                                            │
│  - /drive/v3/files                    → CRUD operations             │
│  - /drive/v3/files/{id}               → Specific file               │
│  - /drive/v3/files/{id}/watch         → Setup webhook              │
│  - /drive/v3/channels/stop            → Stop webhook               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Components Breakdown

### 1. Backend Service (`google_drive_service.py`)

**Location:** `concrete-agent/packages/core-backend/app/services/google_drive_service.py`

**Dependencies:**
```python
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload
from cryptography.fernet import Fernet
import redis
```

**Class Structure:**
```python
class GoogleDriveService:
    """
    Google Drive API integration service.

    Handles:
    - OAuth2 authentication
    - File upload/download
    - Folder listing
    - Webhook management
    - Credential encryption
    """

    SCOPES = [
        'https://www.googleapis.com/auth/drive.file',  # Access files created by app
        # 'https://www.googleapis.com/auth/drive'      # Full Drive access (optional)
    ]

    def __init__(self, db_session, redis_client):
        self.db = db_session
        self.redis = redis_client
        self.client_secrets_file = os.getenv('GOOGLE_CLIENT_SECRETS_FILE')
        self.redirect_uri = os.getenv('GOOGLE_OAUTH_REDIRECT_URI')
        self.encryption_key = os.getenv('GOOGLE_CREDENTIALS_ENCRYPTION_KEY')
        self.fernet = Fernet(self.encryption_key)

    # OAuth2 Methods
    def get_authorization_url(self, user_id: str) -> str: ...
    def exchange_code_for_token(self, code: str, user_id: str) -> Credentials: ...
    def get_user_credentials(self, user_id: str) -> Credentials: ...
    def refresh_credentials(self, user_id: str) -> Credentials: ...

    # Drive API Methods
    def upload_file(self, user_id: str, file_path: Path, folder_id: str) -> dict: ...
    def download_file(self, user_id: str, file_id: str, dest_path: Path) -> Path: ...
    def list_folders(self, user_id: str, parent_id: str = None) -> list: ...
    def create_folder(self, user_id: str, folder_name: str, parent_id: str = None) -> dict: ...

    # Webhook Methods
    def setup_webhook(self, user_id: str, folder_id: str, project_id: str) -> dict: ...
    def stop_webhook(self, channel_id: str) -> bool: ...
    def renew_webhook(self, channel_id: str) -> dict: ...
```

**Key Implementation Details:**

#### OAuth2 Flow
```python
def get_authorization_url(self, user_id: str) -> str:
    """
    Generate OAuth2 authorization URL.

    Args:
        user_id: User identifier for state verification

    Returns:
        Authorization URL to redirect user to
    """
    flow = Flow.from_client_secrets_file(
        self.client_secrets_file,
        scopes=self.SCOPES,
        redirect_uri=self.redirect_uri
    )

    # Generate state token for CSRF protection
    state = secrets.token_urlsafe(32)

    # Store state in Redis (expire in 10 min)
    self.redis.setex(
        f"google_oauth_state:{state}",
        600,  # 10 minutes
        user_id
    )

    authorization_url, _ = flow.authorization_url(
        access_type='offline',  # Get refresh token
        include_granted_scopes='true',
        state=state,
        prompt='consent'  # Force consent screen to get refresh token
    )

    return authorization_url

def exchange_code_for_token(self, code: str, state: str) -> Credentials:
    """
    Exchange authorization code for access token.

    Args:
        code: Authorization code from callback
        state: State token for verification

    Returns:
        Google OAuth2 credentials

    Raises:
        HTTPException: If state invalid or code exchange fails
    """
    # Verify state
    user_id = self.redis.get(f"google_oauth_state:{state}")
    if not user_id:
        raise HTTPException(401, "Invalid or expired state")

    # Exchange code for token
    flow = Flow.from_client_secrets_file(
        self.client_secrets_file,
        scopes=self.SCOPES,
        redirect_uri=self.redirect_uri,
        state=state
    )

    flow.fetch_token(code=code)
    credentials = flow.credentials

    # Encrypt and save credentials to database
    self._save_credentials(user_id, credentials)

    # Clean up state
    self.redis.delete(f"google_oauth_state:{state}")

    return credentials

def _save_credentials(self, user_id: str, credentials: Credentials):
    """Save encrypted credentials to database."""
    encrypted_access_token = self.fernet.encrypt(
        credentials.token.encode()
    ).decode()

    encrypted_refresh_token = self.fernet.encrypt(
        credentials.refresh_token.encode()
    ).decode() if credentials.refresh_token else None

    # Upsert to database
    self.db.execute("""
        INSERT INTO google_credentials (
            user_id, access_token, refresh_token, token_expiry, scopes
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            access_token = excluded.access_token,
            refresh_token = excluded.refresh_token,
            token_expiry = excluded.token_expiry,
            scopes = excluded.scopes
    """, (
        user_id,
        encrypted_access_token,
        encrypted_refresh_token,
        credentials.expiry,
        json.dumps(list(self.SCOPES))
    ))
    self.db.commit()
```

#### File Upload
```python
def upload_file(
    self,
    user_id: str,
    file_path: Path,
    folder_id: str,
    file_name: str = None
) -> dict:
    """
    Upload file to Google Drive.

    Args:
        user_id: User identifier
        file_path: Local path to file
        folder_id: Google Drive folder ID
        file_name: Custom file name (optional)

    Returns:
        {
            'file_id': str,
            'web_view_link': str,
            'web_content_link': str,
            'size': int
        }
    """
    credentials = self.get_user_credentials(user_id)
    service = build('drive', 'v3', credentials=credentials)

    file_metadata = {
        'name': file_name or file_path.name,
        'parents': [folder_id]
    }

    # Detect MIME type
    mime_type, _ = mimetypes.guess_type(str(file_path))

    media = MediaFileUpload(
        str(file_path),
        mimetype=mime_type,
        resumable=True  # Enable resumable uploads for large files
    )

    # Upload with progress callback
    request = service.files().create(
        body=file_metadata,
        media_body=media,
        fields='id, webViewLink, webContentLink, size'
    )

    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            logger.info(f"Upload progress: {int(status.progress() * 100)}%")

    return {
        'file_id': response.get('id'),
        'web_view_link': response.get('webViewLink'),
        'web_content_link': response.get('webContentLink'),
        'size': int(response.get('size', 0))
    }
```

#### Webhook Setup
```python
def setup_webhook(
    self,
    user_id: str,
    folder_id: str,
    project_id: str
) -> dict:
    """
    Setup webhook to monitor folder changes.

    Args:
        user_id: User identifier
        folder_id: Google Drive folder ID to monitor
        project_id: STAVAGENT project ID

    Returns:
        {
            'channel_id': str,
            'resource_id': str,
            'expiration': int
        }
    """
    credentials = self.get_user_credentials(user_id)
    service = build('drive', 'v3', credentials=credentials)

    channel_id = str(uuid.uuid4())
    webhook_url = f"{os.getenv('PUBLIC_URL')}/api/v1/google/webhook"

    # Webhooks expire after 7 days (max)
    expiration = int((datetime.now() + timedelta(days=7)).timestamp() * 1000)

    body = {
        'id': channel_id,
        'type': 'web_hook',
        'address': webhook_url,
        'expiration': expiration,
        'token': self._generate_webhook_token(channel_id)  # For verification
    }

    response = service.files().watch(
        fileId=folder_id,
        body=body
    ).execute()

    # Save webhook to database
    self.db.execute("""
        INSERT INTO google_webhooks (
            channel_id, folder_id, project_id, user_id,
            resource_id, expiration, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        channel_id,
        folder_id,
        project_id,
        user_id,
        response['resourceId'],
        expiration,
        datetime.now()
    ))
    self.db.commit()

    return {
        'channel_id': channel_id,
        'resource_id': response['resourceId'],
        'expiration': expiration
    }
```

---

### 2. API Routes (`routes_google.py`)

**Location:** `concrete-agent/packages/core-backend/app/api/routes_google.py`

**Endpoints:**

```python
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse, HTMLResponse

router = APIRouter(prefix="/api/v1/google", tags=["Google Drive"])

@router.get("/auth")
async def google_auth(
    user_id: str,
    db: Session = Depends(get_db),
    redis: Redis = Depends(get_redis)
):
    """
    Initiate OAuth2 flow.

    Query Params:
        user_id: User identifier

    Returns:
        Redirect to Google authorization page
    """
    service = GoogleDriveService(db, redis)
    auth_url = service.get_authorization_url(user_id)
    return RedirectResponse(auth_url)

@router.get("/callback")
async def google_callback(
    code: str,
    state: str,
    db: Session = Depends(get_db),
    redis: Redis = Depends(get_redis)
):
    """
    Handle OAuth2 callback.

    Query Params:
        code: Authorization code
        state: State token for CSRF protection

    Returns:
        HTML page that closes popup and notifies parent window
    """
    service = GoogleDriveService(db, redis)

    try:
        credentials = service.exchange_code_for_token(code, state)

        # Return HTML that closes popup and notifies parent
        return HTMLResponse("""
        <html>
        <body>
            <h2>Authorization successful!</h2>
            <p>You can close this window.</p>
            <script>
                window.opener.postMessage({
                    type: 'google_auth_success',
                    credentials: true
                }, '*');
                window.close();
            </script>
        </body>
        </html>
        """)
    except Exception as e:
        logger.error(f"OAuth callback error: {e}")
        return HTMLResponse(f"""
        <html>
        <body>
            <h2>Authorization failed</h2>
            <p>Error: {str(e)}</p>
            <p>Please close this window and try again.</p>
        </body>
        </html>
        """, status_code=400)

@router.get("/folders")
async def list_folders(
    user_id: str,
    parent_id: str = None,
    db: Session = Depends(get_db),
    redis: Redis = Depends(get_redis)
):
    """
    List folders in Google Drive.

    Query Params:
        user_id: User identifier
        parent_id: Parent folder ID (optional, defaults to root)

    Returns:
        [
            {'id': str, 'name': str},
            ...
        ]
    """
    service = GoogleDriveService(db, redis)
    folders = service.list_folders(user_id, parent_id)
    return folders

@router.post("/upload")
async def upload_file(
    user_id: str,
    file_id: str,  # STAVAGENT file ID
    folder_id: str,  # Google Drive folder ID
    file_name: str = None,
    db: Session = Depends(get_db),
    redis: Redis = Depends(get_redis)
):
    """
    Upload file from STAVAGENT to Google Drive.

    Body:
        user_id: User identifier
        file_id: File ID in STAVAGENT database
        folder_id: Destination folder ID in Google Drive
        file_name: Custom file name (optional)

    Returns:
        {
            'success': bool,
            'file_id': str,
            'web_view_link': str,
            'size': int
        }
    """
    service = GoogleDriveService(db, redis)

    # Get file path from database
    file_record = db.execute(
        "SELECT storage_path, file_name FROM project_files WHERE file_id = ?",
        (file_id,)
    ).fetchone()

    if not file_record:
        raise HTTPException(404, "File not found")

    file_path = Path(file_record['storage_path'])

    # Upload to Google Drive
    result = service.upload_file(
        user_id,
        file_path,
        folder_id,
        file_name or file_record['file_name']
    )

    return {
        'success': True,
        **result
    }

@router.post("/webhook")
async def google_webhook(
    request: Request,
    db: Session = Depends(get_db),
    redis: Redis = Depends(get_redis)
):
    """
    Receive notifications from Google Drive.

    Headers:
        X-Goog-Channel-ID: Channel ID
        X-Goog-Resource-State: sync | update | trash | etc.
        X-Goog-Resource-ID: Resource ID
        X-Goog-Channel-Token: Verification token

    Returns:
        {'success': bool}
    """
    headers = request.headers

    channel_id = headers.get('X-Goog-Channel-ID')
    resource_state = headers.get('X-Goog-Resource-State')
    resource_id = headers.get('X-Goog-Resource-ID')
    token = headers.get('X-Goog-Channel-Token')

    # Verify token
    service = GoogleDriveService(db, redis)
    if not service._verify_webhook_token(channel_id, token):
        raise HTTPException(401, "Invalid token")

    # Handle different states
    if resource_state == 'sync':
        # Initial sync notification (ignore)
        logger.info(f"Webhook sync: {channel_id}")

    elif resource_state == 'update':
        # File changed in Google Drive
        logger.info(f"Webhook update: {channel_id}")

        # Get webhook details
        webhook = db.execute(
            "SELECT project_id, folder_id, user_id FROM google_webhooks WHERE channel_id = ?",
            (channel_id,)
        ).fetchone()

        if webhook:
            # Trigger background sync
            await sync_folder_from_google_drive(
                webhook['project_id'],
                webhook['folder_id'],
                webhook['user_id']
            )

    return {'success': True}

@router.post("/setup-watch")
async def setup_watch(
    user_id: str,
    folder_id: str,
    project_id: str,
    db: Session = Depends(get_db),
    redis: Redis = Depends(get_redis)
):
    """
    Setup webhook to monitor folder.

    Body:
        user_id: User identifier
        folder_id: Google Drive folder ID
        project_id: STAVAGENT project ID

    Returns:
        {
            'success': bool,
            'channel_id': str,
            'expiration': int
        }
    """
    service = GoogleDriveService(db, redis)
    result = service.setup_webhook(user_id, folder_id, project_id)

    return {
        'success': True,
        **result
    }
```

---

### 3. Frontend Integration

**DocumentSummary.tsx:**

```tsx
import { useState, useEffect } from 'react';
import { CloudUpload, CheckCircle, Loader2 } from 'lucide-react';

// Add Google Drive state
const [googleAuth, setGoogleAuth] = useState({
  isAuthorized: false,
  isLoading: false,
  userId: null  // Get from user session
});
const [googleFolders, setGoogleFolders] = useState<Array<{id: string, name: string}>>([]);
const [selectedGoogleFolder, setSelectedGoogleFolder] = useState('');
const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);

// Handle Google OAuth
const handleGoogleAuth = async () => {
  setGoogleAuth(prev => ({ ...prev, isLoading: true }));

  const userId = getCurrentUserId(); // Get from session/context
  const authUrl = `${CORE_API_URL}/api/v1/google/auth?user_id=${userId}`;

  // Open popup
  const popup = window.open(authUrl, 'GoogleAuth', 'width=600,height=700,scrollbars=yes');

  // Listen for callback
  const handleMessage = async (event: MessageEvent) => {
    if (event.data.type === 'google_auth_success') {
      setGoogleAuth({ isAuthorized: true, isLoading: false, userId });

      // Load folders
      await loadGoogleFolders(userId);

      window.removeEventListener('message', handleMessage);
      popup?.close();
    }
  };

  window.addEventListener('message', handleMessage);

  // Check if popup was blocked
  if (!popup || popup.closed) {
    alert('Please allow popups for this site');
    setGoogleAuth(prev => ({ ...prev, isLoading: false }));
  }
};

// Load Google Drive folders
const loadGoogleFolders = async (userId: string) => {
  try {
    const response = await fetch(`${CORE_API_URL}/api/v1/google/folders?user_id=${userId}`);
    const folders = await response.json();
    setGoogleFolders(folders);
  } catch (err) {
    console.error('Failed to load folders:', err);
  }
};

// Upload to Google Drive
const handleUploadToGoogleDrive = async () => {
  if (!selectedGoogleFolder || !savedFileId) {
    alert('Vyberte složku Google Drive');
    return;
  }

  setIsUploadingToDrive(true);

  try {
    const response = await fetch(`${CORE_API_URL}/api/v1/google/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: googleAuth.userId,
        file_id: savedFileId,
        folder_id: selectedGoogleFolder
      })
    });

    const data = await response.json();

    if (data.success) {
      alert(`✅ Soubor nahrán do Google Drive!\n\nOtevřít: ${data.web_view_link}`);
    }
  } catch (err) {
    alert('Chyba při nahrávání do Google Drive: ' + (err as Error).message);
  } finally {
    setIsUploadingToDrive(false);
  }
};

// UI (add after "Uložit do projektu" button)
<>
  {/* Google Drive Auth */}
  <button
    onClick={handleGoogleAuth}
    className="c-btn c-btn--secondary"
    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
    disabled={googleAuth.isLoading || googleAuth.isAuthorized}
  >
    {googleAuth.isLoading ? (
      <>
        <Loader2 size={16} className="spin" />
        Připojování...
      </>
    ) : googleAuth.isAuthorized ? (
      <>
        <CheckCircle size={16} />
        Google Drive připojen
      </>
    ) : (
      <>
        <CloudUpload size={16} />
        Připojit Google Drive
      </>
    )}
  </button>

  {/* Google Drive Folder Selector */}
  {googleAuth.isAuthorized && (
    <>
      <select
        value={selectedGoogleFolder}
        onChange={(e) => setSelectedGoogleFolder(e.target.value)}
        className="c-input"
        style={{ minWidth: '200px' }}
        disabled={isUploadingToDrive}
      >
        <option value="">Vyberte složku...</option>
        {googleFolders.map((folder) => (
          <option key={folder.id} value={folder.id}>
            {folder.name}
          </option>
        ))}
      </select>

      <button
        onClick={handleUploadToGoogleDrive}
        className="c-btn c-btn--primary"
        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        disabled={!selectedGoogleFolder || !savedFileId || isUploadingToDrive}
      >
        {isUploadingToDrive ? (
          <>
            <Loader2 size={16} className="spin" />
            Nahrávám...
          </>
        ) : (
          <>
            <CloudUpload size={16} />
            Nahrát do Drive
          </>
        )}
      </button>
    </>
  )}
</>
```

---

## 📅 Implementation Timeline

### Day 1: Backend Setup (8 hours)

**Morning (4h):**
1. Create Google Cloud Project
2. Enable Google Drive API
3. Configure OAuth2 consent screen
4. Create OAuth2 credentials (client_secrets.json)
5. Add environment variables to Render

**Afternoon (4h):**
6. Create `google_drive_service.py` (OAuth2 methods)
7. Create `routes_google.py` (auth endpoints)
8. Create database migrations (google_credentials, google_webhooks tables)
9. Test OAuth2 flow locally

**Deliverables:**
- ✅ OAuth2 flow working
- ✅ Credentials saved to database (encrypted)
- ✅ Callback page closes popup correctly

---

### Day 2: Upload & Download (8 hours)

**Morning (4h):**
1. Implement `upload_file()` method
2. Implement `download_file()` method
3. Implement `list_folders()` method
4. Add progress tracking for uploads
5. Test upload with different file types

**Afternoon (4h):**
6. Create frontend Google Drive button
7. Implement popup OAuth flow
8. Add folder selector UI
9. Test end-to-end upload flow
10. Handle errors gracefully

**Deliverables:**
- ✅ File upload working
- ✅ Folder listing working
- ✅ Frontend integration complete

---

### Day 3: Webhooks & Polish (8 hours)

**Morning (4h):**
1. Implement `setup_webhook()` method
2. Implement webhook handler endpoint
3. Create background sync task
4. Test webhook notifications (ngrok for local testing)

**Afternoon (4h):**
5. Add webhook renewal logic (before 7-day expiry)
6. Add error handling and retries
7. Create admin page to view active webhooks
8. Documentation and testing
9. Deploy to production

**Deliverables:**
- ✅ Webhooks working
- ✅ Auto-sync on file changes
- ✅ Production deployment complete

---

## 🔐 Security Considerations

### 1. Credentials Storage

**Problem:** Access tokens are sensitive and must be protected.

**Solution:**
```python
from cryptography.fernet import Fernet

# Generate encryption key (run once, save to env)
key = Fernet.generate_key()
print(key.decode())  # GOOGLE_CREDENTIALS_ENCRYPTION_KEY=...

# Encrypt before saving
fernet = Fernet(os.getenv('GOOGLE_CREDENTIALS_ENCRYPTION_KEY'))
encrypted_token = fernet.encrypt(access_token.encode()).decode()

# Decrypt when loading
decrypted_token = fernet.decrypt(encrypted_token.encode()).decode()
```

### 2. OAuth2 Scopes

**Use minimal scopes:**
```python
SCOPES = [
    'https://www.googleapis.com/auth/drive.file'  # Only files created by app
]
# NOT: 'https://www.googleapis.com/auth/drive'  # Full Drive access
```

### 3. Webhook Verification

**Problem:** Webhooks can be spoofed.

**Solution:**
```python
def _generate_webhook_token(self, channel_id: str) -> str:
    """Generate HMAC token for webhook verification."""
    secret = os.getenv('WEBHOOK_SECRET_KEY')
    return hmac.new(
        secret.encode(),
        channel_id.encode(),
        hashlib.sha256
    ).hexdigest()

def _verify_webhook_token(self, channel_id: str, token: str) -> bool:
    """Verify webhook token."""
    expected_token = self._generate_webhook_token(channel_id)
    return hmac.compare_digest(expected_token, token)
```

### 4. Rate Limiting

**Problem:** Google API has rate limits.

**Solution:**
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/upload")
@limiter.limit("10/minute")  # 10 uploads per minute per IP
async def upload_file(...):
    ...
```

---

## 🧪 Testing Strategy

### Unit Tests
```python
# test_google_drive_service.py

import pytest
from unittest.mock import Mock, patch

def test_get_authorization_url():
    service = GoogleDriveService(mock_db, mock_redis)
    url = service.get_authorization_url('user_123')

    assert 'https://accounts.google.com/o/oauth2/v2/auth' in url
    assert 'scope=' in url
    assert 'state=' in url

def test_upload_file():
    service = GoogleDriveService(mock_db, mock_redis)

    with patch('googleapiclient.discovery.build') as mock_build:
        mock_service = Mock()
        mock_build.return_value = mock_service

        result = service.upload_file(
            'user_123',
            Path('/tmp/test.pdf'),
            'folder_id_123'
        )

        assert result['file_id']
        assert result['web_view_link']
```

### Integration Tests
```python
# test_google_drive_integration.py

@pytest.mark.integration
def test_oauth_flow(client):
    # 1. Get auth URL
    response = client.get('/api/v1/google/auth?user_id=test_user')
    assert response.status_code == 307  # Redirect

    # 2. Simulate callback
    response = client.get(f'/api/v1/google/callback?code=test_code&state=test_state')
    assert response.status_code == 200

    # 3. Verify credentials saved
    creds = db.get_credentials('test_user')
    assert creds is not None

@pytest.mark.integration
def test_upload_flow(client, test_file):
    # 1. Upload file to STAVAGENT
    response = client.post('/api/v1/accumulator/files/upload', files={'file': test_file})
    file_id = response.json()['file_id']

    # 2. Upload to Google Drive
    response = client.post('/api/v1/google/upload', json={
        'user_id': 'test_user',
        'file_id': file_id,
        'folder_id': 'test_folder_id'
    })

    assert response.json()['success'] == True
    assert response.json()['web_view_link']
```

---

## 📊 Monitoring & Observability

### Metrics to Track

```python
from prometheus_client import Counter, Histogram

# OAuth2 metrics
oauth_requests = Counter('google_oauth_requests_total', 'OAuth2 requests', ['result'])
oauth_failures = Counter('google_oauth_failures_total', 'OAuth2 failures', ['error_type'])

# Upload metrics
upload_requests = Counter('google_upload_requests_total', 'Upload requests', ['result'])
upload_duration = Histogram('google_upload_duration_seconds', 'Upload duration')
upload_size = Histogram('google_upload_size_bytes', 'Upload file size')

# Webhook metrics
webhook_notifications = Counter('google_webhook_notifications_total', 'Webhook notifications', ['state'])
webhook_errors = Counter('google_webhook_errors_total', 'Webhook errors', ['error_type'])
```

### Logging

```python
import logging

logger = logging.getLogger(__name__)

# OAuth2
logger.info(f"OAuth2 initiated: user_id={user_id}")
logger.info(f"OAuth2 success: user_id={user_id}, scopes={scopes}")
logger.error(f"OAuth2 failed: user_id={user_id}, error={error}")

# Upload
logger.info(f"Upload started: user_id={user_id}, file_id={file_id}, size={size_mb}MB")
logger.info(f"Upload progress: {progress}%")
logger.info(f"Upload complete: duration={duration}s, speed={speed_mbps}Mbps")
logger.error(f"Upload failed: error={error}")

# Webhook
logger.info(f"Webhook setup: channel_id={channel_id}, folder_id={folder_id}")
logger.info(f"Webhook notification: state={state}, changes={changes_count}")
logger.warning(f"Webhook expired: channel_id={channel_id}, age={age_days}d")
```

---

## 🚨 Error Handling

### Common Errors

```python
# 1. Credentials expired
try:
    credentials = service.get_user_credentials(user_id)
except CredentialsExpiredError:
    credentials = service.refresh_credentials(user_id)

# 2. Rate limit exceeded
from googleapiclient.errors import HttpError

try:
    result = service.upload_file(...)
except HttpError as e:
    if e.resp.status == 429:  # Too many requests
        logger.warning("Rate limit exceeded, retrying in 60s")
        time.sleep(60)
        result = service.upload_file(...)  # Retry
    else:
        raise

# 3. File not found
try:
    result = service.download_file(user_id, file_id, dest_path)
except HttpError as e:
    if e.resp.status == 404:
        raise HTTPException(404, "File not found in Google Drive")
    else:
        raise

# 4. Insufficient permissions
try:
    result = service.upload_file(...)
except HttpError as e:
    if e.resp.status == 403:
        raise HTTPException(403, "Insufficient permissions. Please re-authorize.")
    else:
        raise
```

---

## 📚 Dependencies

### Python Packages
```txt
# requirements.txt
google-auth==2.25.2
google-auth-oauthlib==1.2.0
google-auth-httplib2==0.2.0
google-api-python-client==2.110.0
cryptography==41.0.7
redis==5.0.1
```

### Environment Variables
```env
# Google OAuth2
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=https://concrete-agent.onrender.com/api/v1/google/callback
GOOGLE_CLIENT_SECRETS_FILE=/app/client_secrets.json

# Encryption
GOOGLE_CREDENTIALS_ENCRYPTION_KEY=<base64-encoded-key>
WEBHOOK_SECRET_KEY=<random-secret-key>

# Public URL (for webhooks)
PUBLIC_URL=https://concrete-agent.onrender.com
```

---

## ✅ Acceptance Criteria

### Phase 1: OAuth2 (Day 1)
- [ ] User can click "Připojit Google Drive" button
- [ ] Popup opens with Google consent screen
- [ ] User grants permissions
- [ ] Popup closes automatically
- [ ] Credentials saved to database (encrypted)
- [ ] Button shows "Google Drive připojen" after auth

### Phase 2: Upload (Day 2)
- [ ] User can select destination folder from dropdown
- [ ] User can upload file to Google Drive
- [ ] Progress indicator shows during upload
- [ ] Success message with link to file
- [ ] Error handling for failed uploads
- [ ] Works with all file types (PDF, Excel, etc.)

### Phase 3: Webhooks (Day 3)
- [ ] Webhook automatically created when user connects Drive
- [ ] System receives notifications when files change
- [ ] Background sync triggered on file changes
- [ ] Webhook auto-renewed before expiration
- [ ] Admin can view active webhooks

---

## 📖 Resources

### Google Documentation
- OAuth 2.0: https://developers.google.com/identity/protocols/oauth2
- Drive API: https://developers.google.com/drive/api/v3/reference
- Webhooks: https://developers.google.com/drive/api/v3/push

### Libraries
- google-api-python-client: https://github.com/googleapis/google-api-python-client
- google-auth: https://github.com/googleapis/google-auth-library-python

### Tutorials
- OAuth 2.0 Flow: https://developers.google.com/identity/protocols/oauth2/web-server
- File Uploads: https://developers.google.com/drive/api/v3/manage-uploads
- Webhooks: https://developers.google.com/drive/api/v3/push

---

**Status:** 🚧 Ready for implementation
**Estimated Effort:** 3 days (24 hours)
**Priority:** Medium
**Dependencies:** None (can start immediately)
