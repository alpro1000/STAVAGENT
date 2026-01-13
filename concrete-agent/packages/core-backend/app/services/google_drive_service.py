"""
Google Drive Service - OAuth2 and File Operations

Handles:
- OAuth2 authentication flow
- Credential encryption and storage
- File upload/download
- Folder listing
- Webhook management

Dependencies:
    pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client cryptography

Version: 1.0.0
"""

import os
import json
import logging
import secrets
import hashlib
import hmac
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from urllib.parse import urlencode

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload
from googleapiclient.errors import HttpError
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)


class GoogleDriveService:
    """
    Google Drive API integration service.

    Features:
    - OAuth2 authentication with refresh tokens
    - Encrypted credential storage
    - File upload with progress tracking
    - Folder operations
    - Webhook setup for change notifications
    """

    # OAuth2 scopes - use minimal permissions
    SCOPES = [
        'https://www.googleapis.com/auth/drive.file',  # Access files created by app only
        # 'https://www.googleapis.com/auth/drive',     # Full Drive access (optional)
    ]

    def __init__(self, db_session=None, redis_client=None):
        """
        Initialize Google Drive service.

        Args:
            db_session: Database session for credential storage
            redis_client: Redis client for state management
        """
        self.db = db_session
        self.redis = redis_client

        # OAuth2 configuration from environment
        self.client_id = os.getenv('GOOGLE_CLIENT_ID')
        self.client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
        self.redirect_uri = os.getenv('GOOGLE_OAUTH_REDIRECT_URI')

        # Encryption for credentials
        encryption_key = os.getenv('GOOGLE_CREDENTIALS_ENCRYPTION_KEY')
        if encryption_key:
            self.fernet = Fernet(encryption_key.encode())
        else:
            logger.warning("GOOGLE_CREDENTIALS_ENCRYPTION_KEY not set - credentials will not be encrypted!")
            self.fernet = None

        # Webhook configuration
        self.webhook_secret = os.getenv('GOOGLE_WEBHOOK_SECRET_KEY', secrets.token_hex(32))
        self.public_url = os.getenv('PUBLIC_URL', 'https://concrete-agent.onrender.com')

    # ==================== OAuth2 Methods ====================

    def get_authorization_url(self, user_id: str) -> str:
        """
        Generate OAuth2 authorization URL.

        Args:
            user_id: User identifier for state verification

        Returns:
            Authorization URL to redirect user to

        Example:
            url = service.get_authorization_url('user_123')
            # Redirect user to this URL
        """
        # Create OAuth2 flow
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [self.redirect_uri]
                }
            },
            scopes=self.SCOPES,
            redirect_uri=self.redirect_uri
        )

        # Generate state token for CSRF protection
        state = secrets.token_urlsafe(32)

        # Store state in Redis with user_id (expire in 10 min)
        if self.redis:
            self.redis.setex(
                f"google_oauth_state:{state}",
                600,  # 10 minutes
                user_id
            )

        # Generate authorization URL
        authorization_url, _ = flow.authorization_url(
            access_type='offline',  # Get refresh token
            include_granted_scopes='true',
            state=state,
            prompt='consent'  # Force consent screen to ensure refresh token
        )

        logger.info(f"Generated OAuth2 URL for user: {user_id}")
        return authorization_url

    def exchange_code_for_token(self, code: str, state: str) -> tuple[str, Credentials]:
        """
        Exchange authorization code for access token.

        Args:
            code: Authorization code from callback
            state: State token for verification

        Returns:
            Tuple of (user_id, credentials)

        Raises:
            ValueError: If state invalid or code exchange fails
        """
        # Verify state token
        if self.redis:
            user_id = self.redis.get(f"google_oauth_state:{state}")
            if not user_id:
                raise ValueError("Invalid or expired state token")
            user_id = user_id.decode() if isinstance(user_id, bytes) else user_id
        else:
            # For testing without Redis
            user_id = "test_user"

        # Create flow and fetch token
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [self.redirect_uri]
                }
            },
            scopes=self.SCOPES,
            redirect_uri=self.redirect_uri,
            state=state
        )

        try:
            flow.fetch_token(code=code)
            credentials = flow.credentials
        except Exception as e:
            logger.error(f"Failed to exchange code for token: {e}")
            raise ValueError(f"Token exchange failed: {str(e)}")

        # Save credentials to database
        self._save_credentials(user_id, credentials)

        # Clean up state token
        if self.redis:
            self.redis.delete(f"google_oauth_state:{state}")

        logger.info(f"OAuth2 successful for user: {user_id}")
        return user_id, credentials

    def get_user_credentials(self, user_id: str) -> Optional[Credentials]:
        """
        Get user credentials from database.

        Args:
            user_id: User identifier

        Returns:
            Google OAuth2 credentials or None if not found
        """
        if not self.db:
            return None

        # Query credentials from database
        result = self.db.execute(
            "SELECT access_token, refresh_token, token_expiry, scopes FROM google_credentials WHERE user_id = ?",
            (user_id,)
        ).fetchone()

        if not result:
            return None

        # Decrypt tokens
        access_token = self._decrypt(result[0]) if self.fernet else result[0]
        refresh_token = self._decrypt(result[1]) if self.fernet and result[1] else result[1]

        # Create credentials object
        credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=self.client_id,
            client_secret=self.client_secret,
            scopes=json.loads(result[3]) if result[3] else self.SCOPES
        )

        # Check if expired and refresh if needed
        if credentials.expired and credentials.refresh_token:
            credentials = self._refresh_credentials(user_id, credentials)

        return credentials

    def _refresh_credentials(self, user_id: str, credentials: Credentials) -> Credentials:
        """
        Refresh expired credentials.

        Args:
            user_id: User identifier
            credentials: Expired credentials with refresh token

        Returns:
            Refreshed credentials
        """
        try:
            from google.auth.transport.requests import Request
            credentials.refresh(Request())

            # Save refreshed credentials
            self._save_credentials(user_id, credentials)

            logger.info(f"Refreshed credentials for user: {user_id}")
            return credentials
        except Exception as e:
            logger.error(f"Failed to refresh credentials for user {user_id}: {e}")
            raise

    def _save_credentials(self, user_id: str, credentials: Credentials):
        """
        Save encrypted credentials to database.

        Args:
            user_id: User identifier
            credentials: Google OAuth2 credentials
        """
        if not self.db:
            logger.warning("No database connection - credentials not saved")
            return

        # Encrypt tokens
        access_token = self._encrypt(credentials.token) if self.fernet else credentials.token
        refresh_token = (
            self._encrypt(credentials.refresh_token) if self.fernet and credentials.refresh_token
            else credentials.refresh_token
        )

        # Upsert to database
        self.db.execute(
            """
            INSERT OR REPLACE INTO google_credentials
            (user_id, access_token, refresh_token, token_expiry, scopes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            """,
            (
                user_id,
                access_token,
                refresh_token,
                credentials.expiry.isoformat() if credentials.expiry else None,
                json.dumps(list(credentials.scopes)) if credentials.scopes else json.dumps(self.SCOPES)
            )
        )
        self.db.commit()

        logger.info(f"Saved credentials for user: {user_id}")

    def _encrypt(self, data: str) -> str:
        """Encrypt data using Fernet."""
        if not self.fernet or not data:
            return data
        return self.fernet.encrypt(data.encode()).decode()

    def _decrypt(self, data: str) -> str:
        """Decrypt data using Fernet."""
        if not self.fernet or not data:
            return data
        return self.fernet.decrypt(data.encode()).decode()

    # ==================== Drive API Methods ====================

    def list_folders(self, user_id: str, parent_id: Optional[str] = None) -> List[Dict[str, str]]:
        """
        List folders in Google Drive.

        Args:
            user_id: User identifier
            parent_id: Parent folder ID (optional, defaults to root)

        Returns:
            List of folders: [{'id': str, 'name': str}, ...]
        """
        credentials = self.get_user_credentials(user_id)
        if not credentials:
            raise ValueError("User not authorized with Google Drive")

        service = build('drive', 'v3', credentials=credentials)

        # Query for folders only
        query = "mimeType='application/vnd.google-apps.folder'"
        if parent_id:
            query += f" and '{parent_id}' in parents"

        try:
            results = service.files().list(
                q=query,
                pageSize=100,
                fields="files(id, name)",
                orderBy="name"
            ).execute()

            folders = results.get('files', [])
            logger.info(f"Listed {len(folders)} folders for user: {user_id}")
            return folders

        except HttpError as e:
            logger.error(f"Failed to list folders: {e}")
            raise

    def upload_file(
        self,
        user_id: str,
        file_path: Path,
        folder_id: str,
        file_name: Optional[str] = None
    ) -> Dict[str, Any]:
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
        if not credentials:
            raise ValueError("User not authorized with Google Drive")

        service = build('drive', 'v3', credentials=credentials)

        # Prepare file metadata
        file_metadata = {
            'name': file_name or file_path.name,
            'parents': [folder_id]
        }

        # Detect MIME type
        import mimetypes
        mime_type, _ = mimetypes.guess_type(str(file_path))

        # Create media upload
        media = MediaFileUpload(
            str(file_path),
            mimetype=mime_type,
            resumable=True
        )

        try:
            # Upload with progress tracking
            request = service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, webViewLink, webContentLink, size'
            )

            response = None
            while response is None:
                status, response = request.next_chunk()
                if status:
                    progress = int(status.progress() * 100)
                    logger.info(f"Upload progress: {progress}%")

            result = {
                'file_id': response.get('id'),
                'web_view_link': response.get('webViewLink'),
                'web_content_link': response.get('webContentLink'),
                'size': int(response.get('size', 0))
            }

            logger.info(f"Uploaded file to Google Drive: {file_name or file_path.name}")
            return result

        except HttpError as e:
            logger.error(f"Failed to upload file: {e}")
            raise

    # ==================== Webhook Methods ====================

    def setup_webhook(
        self,
        user_id: str,
        folder_id: str,
        project_id: str
    ) -> Dict[str, Any]:
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
        if not credentials:
            raise ValueError("User not authorized with Google Drive")

        service = build('drive', 'v3', credentials=credentials)

        channel_id = secrets.token_urlsafe(16)
        webhook_url = f"{self.public_url}/api/v1/google/webhook"

        # Webhooks expire after 7 days (max allowed by Google)
        expiration = int((datetime.now() + timedelta(days=7)).timestamp() * 1000)

        # Generate verification token
        token = self._generate_webhook_token(channel_id)

        # Setup webhook
        body = {
            'id': channel_id,
            'type': 'web_hook',
            'address': webhook_url,
            'expiration': expiration,
            'token': token
        }

        try:
            response = service.files().watch(
                fileId=folder_id,
                body=body
            ).execute()

            # Save webhook to database
            if self.db:
                self.db.execute(
                    """
                    INSERT INTO google_webhooks
                    (channel_id, folder_id, project_id, user_id, resource_id, expiration, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                    """,
                    (
                        channel_id,
                        folder_id,
                        project_id,
                        user_id,
                        response['resourceId'],
                        expiration
                    )
                )
                self.db.commit()

            result = {
                'channel_id': channel_id,
                'resource_id': response['resourceId'],
                'expiration': expiration
            }

            logger.info(f"Setup webhook for folder: {folder_id}")
            return result

        except HttpError as e:
            logger.error(f"Failed to setup webhook: {e}")
            raise

    def _generate_webhook_token(self, channel_id: str) -> str:
        """Generate HMAC token for webhook verification."""
        return hmac.new(
            self.webhook_secret.encode(),
            channel_id.encode(),
            hashlib.sha256
        ).hexdigest()

    def verify_webhook_token(self, channel_id: str, token: str) -> bool:
        """Verify webhook token."""
        expected_token = self._generate_webhook_token(channel_id)
        return hmac.compare_digest(expected_token, token)
