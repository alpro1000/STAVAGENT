"""
Google Drive API Routes

Endpoints:
- GET  /api/v1/google/auth           - Initiate OAuth2 flow
- GET  /api/v1/google/callback       - Handle OAuth2 callback
- GET  /api/v1/google/folders        - List Google Drive folders
- POST /api/v1/google/upload         - Upload file to Google Drive
- POST /api/v1/google/webhook        - Receive change notifications
- POST /api/v1/google/setup-watch    - Setup folder monitoring

Version: 1.0.0
"""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Query, Form
from fastapi.responses import RedirectResponse, HTMLResponse
from pydantic import BaseModel

from app.services.google_drive_service import GoogleDriveService
from app.core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/google", tags=["Google Drive"])


# ==================== Request/Response Models ====================

class UploadRequest(BaseModel):
    """Request model for file upload."""
    user_id: str
    file_id: str  # STAVAGENT file ID
    folder_id: str  # Google Drive folder ID
    file_name: Optional[str] = None


class SetupWatchRequest(BaseModel):
    """Request model for webhook setup."""
    user_id: str
    folder_id: str
    project_id: str


# ==================== Helper Functions ====================

def get_drive_service() -> GoogleDriveService:
    """Get Google Drive service instance."""
    db = get_db()
    # TODO: Add Redis client
    return GoogleDriveService(db_session=db, redis_client=None)


# ==================== OAuth2 Endpoints ====================

@router.get("/auth")
async def google_auth(user_id: str = Query(..., description="User identifier")):
    """
    Initiate OAuth2 flow.

    Query Parameters:
        user_id: User identifier for session tracking

    Returns:
        Redirect to Google authorization page

    Example:
        GET /api/v1/google/auth?user_id=user_123
    """
    try:
        service = get_drive_service()
        auth_url = service.get_authorization_url(user_id)
        return RedirectResponse(auth_url)

    except Exception as e:
        logger.error(f"Failed to initiate OAuth2: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/callback")
async def google_callback(
    code: str = Query(..., description="Authorization code"),
    state: str = Query(..., description="State token for verification")
):
    """
    Handle OAuth2 callback from Google.

    Query Parameters:
        code: Authorization code from Google
        state: State token for CSRF protection

    Returns:
        HTML page that closes popup and notifies parent window

    Example:
        GET /api/v1/google/callback?code=xxx&state=yyy
    """
    try:
        service = get_drive_service()
        user_id, credentials = service.exchange_code_for_token(code, state)

        # Return HTML that closes popup and notifies parent
        return HTMLResponse(
            content="""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Authorization Successful</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    }
                    .container {
                        background: white;
                        padding: 48px;
                        border-radius: 16px;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                        text-align: center;
                        max-width: 400px;
                    }
                    .success-icon {
                        width: 80px;
                        height: 80px;
                        margin: 0 auto 24px;
                        background: #10b981;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .checkmark {
                        width: 40px;
                        height: 40px;
                        border: 4px solid white;
                        border-top: none;
                        border-left: none;
                        transform: rotate(45deg);
                        margin-top: -10px;
                    }
                    h1 {
                        color: #1f2937;
                        font-size: 24px;
                        margin: 0 0 12px;
                    }
                    p {
                        color: #6b7280;
                        font-size: 16px;
                        margin: 0;
                    }
                    .countdown {
                        margin-top: 24px;
                        color: #9ca3af;
                        font-size: 14px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="success-icon">
                        <div class="checkmark"></div>
                    </div>
                    <h1>✅ Autorizace úspěšná!</h1>
                    <p>Google Drive je připojen k STAVAGENT.</p>
                    <p class="countdown">Zavírání za <span id="countdown">3</span> sekund...</p>
                </div>
                <script>
                    // Notify parent window
                    if (window.opener) {
                        window.opener.postMessage({
                            type: 'google_auth_success',
                            user_id: '""" + user_id + """',
                            credentials: true
                        }, '*');
                    }

                    // Countdown and auto-close
                    let seconds = 3;
                    const countdownElement = document.getElementById('countdown');

                    const interval = setInterval(() => {
                        seconds--;
                        countdownElement.textContent = seconds;

                        if (seconds === 0) {
                            clearInterval(interval);
                            window.close();
                        }
                    }, 1000);

                    // Fallback: close after 5 seconds even if countdown fails
                    setTimeout(() => {
                        window.close();
                    }, 5000);
                </script>
            </body>
            </html>
            """,
            status_code=200
        )

    except ValueError as e:
        logger.error(f"OAuth callback error: {e}")
        return HTMLResponse(
            content=f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Authorization Failed</title>
                <style>
                    body {{
                        font-family: sans-serif;
                        text-align: center;
                        padding: 48px;
                        background: #fee;
                    }}
                    .error {{
                        background: white;
                        padding: 32px;
                        border-radius: 8px;
                        box-shadow: 0 4px 16px rgba(0,0,0,0.1);
                        max-width: 400px;
                        margin: 0 auto;
                    }}
                    h1 {{ color: #ef4444; }}
                    p {{ color: #6b7280; }}
                </style>
            </head>
            <body>
                <div class="error">
                    <h1>❌ Autorizace selhala</h1>
                    <p>Error: {str(e)}</p>
                    <p>Zavřete toto okno a zkuste to znovu.</p>
                </div>
            </body>
            </html>
            """,
            status_code=400
        )

    except Exception as e:
        logger.error(f"OAuth callback error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Drive API Endpoints ====================

@router.get("/folders")
async def list_folders(
    user_id: str = Query(..., description="User identifier"),
    parent_id: Optional[str] = Query(None, description="Parent folder ID")
):
    """
    List folders in Google Drive.

    Query Parameters:
        user_id: User identifier
        parent_id: Parent folder ID (optional, defaults to root)

    Returns:
        [
            {"id": "folder_id_1", "name": "Folder 1"},
            {"id": "folder_id_2", "name": "Folder 2"},
            ...
        ]

    Example:
        GET /api/v1/google/folders?user_id=user_123
        GET /api/v1/google/folders?user_id=user_123&parent_id=folder_456
    """
    try:
        service = get_drive_service()
        folders = service.list_folders(user_id, parent_id)
        return folders

    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    except Exception as e:
        logger.error(f"Failed to list folders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload_file(request: UploadRequest):
    """
    Upload file from STAVAGENT to Google Drive.

    Request Body:
        {
            "user_id": "user_123",
            "file_id": "stavagent_file_id",
            "folder_id": "google_folder_id",
            "file_name": "custom_name.pdf"  // optional
        }

    Returns:
        {
            "success": true,
            "file_id": "google_file_id",
            "web_view_link": "https://drive.google.com/...",
            "size": 1234567
        }

    Example:
        POST /api/v1/google/upload
        {
            "user_id": "user_123",
            "file_id": "abc-def-ghi",
            "folder_id": "1A2B3C4D5E6F",
            "file_name": "Bridge_Report.pdf"
        }
    """
    try:
        service = get_drive_service()
        db = get_db()

        # Get file path from STAVAGENT database
        file_record = db.execute(
            "SELECT storage_path, file_name FROM project_files WHERE file_id = ?",
            (request.file_id,)
        ).fetchone()

        if not file_record:
            raise HTTPException(status_code=404, detail="File not found in STAVAGENT")

        from pathlib import Path
        file_path = Path(file_record[0])

        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found on disk")

        # Upload to Google Drive
        result = service.upload_file(
            request.user_id,
            file_path,
            request.folder_id,
            request.file_name or file_record[1]
        )

        return {
            "success": True,
            **result
        }

    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Failed to upload file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Webhook Endpoints ====================

@router.post("/webhook")
async def google_webhook(request: Request):
    """
    Receive notifications from Google Drive.

    Headers:
        X-Goog-Channel-ID: Channel ID
        X-Goog-Resource-State: sync | update | trash | etc.
        X-Goog-Resource-ID: Resource ID
        X-Goog-Channel-Token: Verification token

    Returns:
        {"success": true}

    Example:
        POST /api/v1/google/webhook
        Headers:
            X-Goog-Channel-ID: abc123
            X-Goog-Resource-State: update
            X-Goog-Channel-Token: verification_token
    """
    headers = request.headers

    channel_id = headers.get('x-goog-channel-id')
    resource_state = headers.get('x-goog-resource-state')
    resource_id = headers.get('x-goog-resource-id')
    token = headers.get('x-goog-channel-token')

    if not channel_id or not token:
        raise HTTPException(status_code=400, detail="Missing required headers")

    # Verify token
    service = get_drive_service()
    if not service.verify_webhook_token(channel_id, token):
        logger.warning(f"Invalid webhook token for channel: {channel_id}")
        raise HTTPException(status_code=401, detail="Invalid token")

    # Handle different states
    if resource_state == 'sync':
        # Initial sync notification (ignore)
        logger.info(f"Webhook sync: {channel_id}")

    elif resource_state == 'update':
        # File changed in Google Drive
        logger.info(f"Webhook update: {channel_id}")

        # Get webhook details from database
        db = get_db()
        webhook = db.execute(
            "SELECT project_id, folder_id, user_id FROM google_webhooks WHERE channel_id = ?",
            (channel_id,)
        ).fetchone()

        if webhook:
            # TODO: Trigger background sync
            # await sync_folder_from_google_drive(
            #     webhook[0],  # project_id
            #     webhook[1],  # folder_id
            #     webhook[2],  # user_id
            # )
            logger.info(f"Triggered sync for project: {webhook[0]}")

    return {"success": True}


@router.post("/setup-watch")
async def setup_watch(request: SetupWatchRequest):
    """
    Setup webhook to monitor folder.

    Request Body:
        {
            "user_id": "user_123",
            "folder_id": "google_folder_id",
            "project_id": "stavagent_project_id"
        }

    Returns:
        {
            "success": true,
            "channel_id": "webhook_channel_id",
            "expiration": 1234567890000
        }

    Example:
        POST /api/v1/google/setup-watch
        {
            "user_id": "user_123",
            "folder_id": "1A2B3C4D5E6F",
            "project_id": "project_789"
        }
    """
    try:
        service = get_drive_service()
        result = service.setup_webhook(
            request.user_id,
            request.folder_id,
            request.project_id
        )

        return {
            "success": True,
            **result
        }

    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    except Exception as e:
        logger.error(f"Failed to setup webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Health Check ====================

@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "google_drive",
        "version": "1.0.0"
    }
