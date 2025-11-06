# Credential Management & Proxy Service - Technical Specification

**Created:** 2025-11-06
**Status:** 🟡 Implementation Pending
**Priority:** ⭐⭐⭐ MEDIUM (Enhanced Features)
**Phase:** 4 - Backend Infrastructure

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Proxy Service Architecture](#proxy-service-architecture)
4. [Supported Paid Services](#supported-paid-services)
5. [Credential Storage](#credential-storage)
6. [Authentication Flow](#authentication-flow)
7. [Usage Tracking](#usage-tracking)
8. [Security Measures](#security-measures)
9. [Implementation Details](#implementation-details)
10. [Testing Strategy](#testing-strategy)

---

## Executive Summary

### Problem Statement

**User's challenge:**
```
I want to access paid construction databases:
- ÚRS (Jednotné rozpočtové standardy) - Czech pricing database
- Cenovamapa.cz - Equipment and material prices
- CSN Online - Czech technical standards full texts
- RozpočetPRO database - Competitor's proprietary data

But I don't want to:
❌ Expose my login credentials to AI
❌ Hard-code passwords in .env files
❌ Share credentials across all users
❌ Allow unlimited access (cost control)
```

### Our Solution: Credential Proxy Service

**Architecture:**
```
User's Perplexity Query
    ↓
Knowledge Router (smart routing)
    ↓
Needs paid data? → Credential Proxy Service
    ↓
    ├─ Fetch encrypted credentials from PostgreSQL
    ├─ Decrypt using Fernet (symmetric encryption)
    ├─ Authenticate with paid service
    ├─ Fetch data
    ├─ Cache response (Redis)
    ├─ Track usage (PostgreSQL)
    └─ Return data (credentials never exposed)
```

**Benefits:**
- ✅ Credentials encrypted at rest
- ✅ Never exposed to AI or frontend
- ✅ Per-user or shared credentials
- ✅ Usage tracking and limits
- ✅ Automatic cache to reduce costs
- ✅ Audit trail of all accesses
- ✅ Easy credential rotation

---

## Problem Statement

### Use Cases

**1. Individual User Credentials**
```
User: "I have ÚRS subscription. Let me use it in my projects."
System: Stores encrypted credentials → Only accessible by this user
```

**2. Shared Company Credentials**
```
Admin: "Our company has CSN Online subscription. Share with all users."
System: Stores credentials → Available to all users in organization
```

**3. Cost Control**
```
Admin: "Limit each user to 100 ÚRS queries/month"
System: Tracks usage → Blocks when limit reached
```

### Security Requirements

**CRITICAL:**
- ❌ NEVER store passwords in plaintext
- ❌ NEVER log passwords (even encrypted)
- ❌ NEVER send credentials to AI models
- ❌ NEVER expose credentials in API responses
- ✅ Encrypt at rest (database)
- ✅ Encrypt in transit (HTTPS)
- ✅ Audit all access
- ✅ Allow credential rotation

---

## Proxy Service Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User Query: "Current ÚRS price for Beton C25/37"        │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 2. Knowledge Router                                         │
│    - Classifies as CURRENT_PRICE                            │
│    - Checks: Does user have ÚRS credentials?                │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴──────────────┐
        │ YES                       │ NO
        │                           │
┌───────▼────────┐         ┌────────▼────────┐
│ 3a. Proxy      │         │ 3b. Fallback    │
│     Service    │         │     Perplexity  │
│                │         │     (no login)  │
│ - Get creds    │         └─────────────────┘
│ - Decrypt      │
│ - Login to ÚRS │
│ - Fetch data   │
│ - Cache result │
└───────┬────────┘
        │
┌───────▼────────────────────────────────────────────────────┐
│ 4. Return Data (credentials never exposed)                 │
│    {                                                        │
│      "answer": "Beton C25/37: 2,450 Kč/m³",               │
│      "source": "urs_database",                             │
│      "timestamp": "2024-11-06T10:30:00Z",                 │
│      "cached": false                                       │
│    }                                                        │
└─────────────────────────────────────────────────────────────┘
```

### Components

```
┌─────────────────────────────────────────────────────────────┐
│ PostgreSQL: user_credentials table                          │
│ - id, user_id, service_name, encrypted_username,           │
│   encrypted_password, scope (personal/shared)              │
└─────────────────────────────────────────────────────────────┘
                     ↕
┌─────────────────────────────────────────────────────────────┐
│ CredentialManager Service                                   │
│ - encrypt_credential()                                      │
│ - decrypt_credential()                                      │
│ - get_credentials_for_user()                               │
└─────────────────────────────────────────────────────────────┘
                     ↕
┌─────────────────────────────────────────────────────────────┐
│ ProxyService (per external service)                         │
│ - URSProxy, CenovamapaProxy, CSNOnlineProxy                │
│ - authenticate()                                            │
│ - query()                                                   │
└─────────────────────────────────────────────────────────────┘
                     ↕
┌─────────────────────────────────────────────────────────────┐
│ External Services (ÚRS, Cenovamapa, CSN Online)            │
└─────────────────────────────────────────────────────────────┘
```

---

## Supported Paid Services

### 1. ÚRS (Jednotné rozpočtové standardy)

**What it is:** Czech construction pricing database

**Authentication:** Username + Password

**API/Scraping:** Web scraping (no official API)

**Cost:** ~15,000 Kč/year per license

**Data Provided:**
- Material prices (updated quarterly)
- Labor rates by region
- Equipment rental costs
- Standard constructions costs

**Integration:**
```python
class URSProxy:
    async def authenticate(self, username: str, password: str):
        """Login to ÚRS"""
        # Web scraping or API if available
        pass

    async def get_price(self, item_code: str, region: str = "Praha") -> dict:
        """Get price for JKSO/KROS code"""
        pass
```

---

### 2. Cenovamapa.cz

**What it is:** Equipment and material price comparison

**Authentication:** Email + Password

**API/Scraping:** REST API available

**Cost:** Free tier + Premium (~5,000 Kč/year)

**Data Provided:**
- Equipment prices from multiple suppliers
- Material costs (aggregated)
- Historical price trends

**Integration:**
```python
class CenovamapaProxy:
    async def authenticate(self, email: str, password: str):
        """Login via API"""
        pass

    async def search_equipment(self, query: str) -> dict:
        """Search equipment prices"""
        pass
```

---

### 3. CSN Online (Czech Standards)

**What it is:** Full texts of Czech technical standards

**Authentication:** Username + Password

**API/Scraping:** Web interface only

**Cost:** ~50,000 Kč/year for company license

**Data Provided:**
- ČSN standards full texts
- EN standards (European)
- ISO standards

**Integration:**
```python
class CSNOnlineProxy:
    async def authenticate(self, username: str, password: str):
        """Login to CSN Online"""
        pass

    async def get_standard(self, csn_code: str) -> dict:
        """Get full text of standard"""
        # Note: May have copyright restrictions!
        pass
```

---

### 4. RozpočetPRO API (Competitor)

**What it is:** Competitor's pricing database

**Authentication:** API Key

**API/Scraping:** REST API

**Cost:** Unknown (competitor)

**Data Provided:**
- JKSO classifications
- Price estimates
- Material specifications

**Integration:**
```python
class RozpocetPROProxy:
    async def authenticate(self, api_key: str):
        """Authenticate with API key"""
        pass

    async def get_classification(self, description: str) -> dict:
        """Get JKSO classification"""
        pass
```

---

## Credential Storage

### Database Schema

```sql
CREATE TABLE user_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id),  -- For shared creds
    service_name VARCHAR(100) NOT NULL,  -- 'urs', 'cenovamapa', 'csn_online'
    credential_type VARCHAR(50) NOT NULL,  -- 'username_password', 'api_key'

    -- Encrypted fields
    encrypted_username TEXT,  -- Fernet encrypted
    encrypted_password TEXT,  -- Fernet encrypted
    encrypted_api_key TEXT,   -- Fernet encrypted

    -- Metadata
    scope VARCHAR(20) NOT NULL DEFAULT 'personal',  -- 'personal' or 'shared'
    status VARCHAR(20) DEFAULT 'active',  -- 'active', 'expired', 'revoked'

    -- Usage limits
    monthly_query_limit INTEGER DEFAULT 1000,
    monthly_queries_used INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,  -- Optional expiry

    -- Security
    encryption_key_version INTEGER DEFAULT 1,  -- For key rotation

    UNIQUE(user_id, service_name),  -- One credential per service per user
    CHECK (scope IN ('personal', 'shared'))
);

-- Index for fast lookups
CREATE INDEX idx_user_credentials_user_service
    ON user_credentials(user_id, service_name);

CREATE INDEX idx_user_credentials_org_service
    ON user_credentials(organization_id, service_name);
```

### Encryption with Fernet

```python
from cryptography.fernet import Fernet
import os

class EncryptionService:
    """Encrypt/decrypt credentials using Fernet"""

    def __init__(self):
        # Load encryption key from environment
        # IMPORTANT: Store this in environment variable, NOT in code!
        self.key = os.getenv('CREDENTIAL_ENCRYPTION_KEY')

        if not self.key:
            raise ValueError("CREDENTIAL_ENCRYPTION_KEY not set!")

        self.cipher = Fernet(self.key.encode())

    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt plaintext string.

        Args:
            plaintext: The credential to encrypt

        Returns:
            Base64-encoded encrypted string
        """
        if not plaintext:
            return None

        encrypted = self.cipher.encrypt(plaintext.encode())
        return encrypted.decode()

    def decrypt(self, ciphertext: str) -> str:
        """
        Decrypt ciphertext string.

        Args:
            ciphertext: The encrypted credential

        Returns:
            Decrypted plaintext string
        """
        if not ciphertext:
            return None

        decrypted = self.cipher.decrypt(ciphertext.encode())
        return decrypted.decode()

# Generate encryption key (DO THIS ONCE, store in .env):
# >>> from cryptography.fernet import Fernet
# >>> key = Fernet.generate_key()
# >>> print(key.decode())
# Then add to .env:
# CREDENTIAL_ENCRYPTION_KEY=<generated_key>
```

### SQLAlchemy Model

```python
from sqlalchemy import Column, String, Integer, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime

class UserCredential(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "user_credentials"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    service_name = Column(String(100), nullable=False)
    credential_type = Column(String(50), nullable=False)

    # Encrypted fields
    encrypted_username = Column(String)
    encrypted_password = Column(String)
    encrypted_api_key = Column(String)

    # Metadata
    scope = Column(String(20), default="personal")
    status = Column(String(20), default="active")

    # Usage limits
    monthly_query_limit = Column(Integer, default=1000)
    monthly_queries_used = Column(Integer, default=0)

    # Timestamps
    last_used_at = Column(DateTime)
    expires_at = Column(DateTime)

    # Security
    encryption_key_version = Column(Integer, default=1)

    # Relationships
    user = relationship("User", back_populates="credentials")
    organization = relationship("Organization", back_populates="credentials")

    __table_args__ = (
        CheckConstraint(scope.in_(['personal', 'shared'])),
    )

    def decrypt_username(self, encryption_service: EncryptionService) -> str:
        """Decrypt username"""
        return encryption_service.decrypt(self.encrypted_username)

    def decrypt_password(self, encryption_service: EncryptionService) -> str:
        """Decrypt password"""
        return encryption_service.decrypt(self.encrypted_password)

    def decrypt_api_key(self, encryption_service: EncryptionService) -> str:
        """Decrypt API key"""
        return encryption_service.decrypt(self.encrypted_api_key)
```

---

## Authentication Flow

### 1. User Adds Credentials

```
Frontend (React)
    ↓
POST /api/credentials
{
  "service_name": "urs",
  "username": "myuser@example.com",  ← Sent over HTTPS
  "password": "MySecurePassword123",  ← Sent over HTTPS
  "scope": "personal"
}
    ↓
Backend
    ↓
1. Validate inputs
2. Encrypt username and password using Fernet
3. Store in PostgreSQL (encrypted)
4. Return success (WITHOUT credentials in response)
    ↓
Response:
{
  "id": "cred-uuid-123",
  "service_name": "urs",
  "status": "active",
  "created_at": "2024-11-06T10:30:00Z"
  // NO username or password in response!
}
```

### 2. System Uses Credentials

```
User Query: "Current ÚRS price for Beton C25/37"
    ↓
Knowledge Router
    ↓
Needs ÚRS data → Get credentials
    ↓
CredentialManager.get_credentials(user_id, "urs")
    ↓
1. Fetch from PostgreSQL (encrypted)
2. Decrypt username and password
3. Pass to URSProxy (in memory only!)
4. URSProxy authenticates
5. URSProxy fetches data
6. Clear credentials from memory
7. Cache result
8. Return data
    ↓
Credentials NEVER logged or stored decrypted!
```

---

## Usage Tracking

### Track Every Query

```sql
CREATE TABLE credential_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id UUID REFERENCES user_credentials(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    service_name VARCHAR(100),
    query_type VARCHAR(100),  -- 'price_lookup', 'standard_fetch', etc.

    -- Request details
    query_params JSONB,  -- What was queried (NOT credentials!)

    -- Response details
    success BOOLEAN,
    response_time_ms INTEGER,
    cached BOOLEAN DEFAULT false,

    -- Cost tracking
    estimated_cost DECIMAL(10, 4),  -- If service charges per query

    -- Timestamp
    timestamp TIMESTAMP DEFAULT NOW(),

    -- IP address (for security auditing)
    ip_address INET
);

CREATE INDEX idx_credential_usage_user_time
    ON credential_usage(user_id, timestamp DESC);

CREATE INDEX idx_credential_usage_credential
    ON credential_usage(credential_id, timestamp DESC);
```

### Usage Limiter

```python
from datetime import datetime, timedelta

class UsageLimiter:
    """Track and enforce usage limits"""

    async def check_limit(
        self,
        credential_id: str,
        user_id: str
    ) -> dict:
        """
        Check if user is within usage limits.

        Returns:
            {
                'allowed': bool,
                'used_this_month': int,
                'limit': int,
                'remaining': int,
                'resets_at': datetime
            }
        """
        # Get credential
        credential = await db.fetch_one(
            "SELECT * FROM user_credentials WHERE id = $1",
            credential_id
        )

        # Count usage this month
        start_of_month = datetime.now().replace(day=1, hour=0, minute=0, second=0)
        used_count = await db.fetch_val("""
            SELECT COUNT(*)
            FROM credential_usage
            WHERE credential_id = $1
              AND timestamp >= $2
              AND success = true
        """, credential_id, start_of_month)

        limit = credential['monthly_query_limit']
        remaining = max(0, limit - used_count)

        # Calculate reset date (first day of next month)
        if datetime.now().month == 12:
            resets_at = datetime(datetime.now().year + 1, 1, 1)
        else:
            resets_at = datetime(datetime.now().year, datetime.now().month + 1, 1)

        return {
            'allowed': used_count < limit,
            'used_this_month': used_count,
            'limit': limit,
            'remaining': remaining,
            'resets_at': resets_at
        }

    async def track_usage(
        self,
        credential_id: str,
        user_id: str,
        service_name: str,
        query_type: str,
        query_params: dict,
        success: bool,
        response_time_ms: int,
        cached: bool = False,
        ip_address: str = None
    ):
        """Track credential usage"""

        await db.execute("""
            INSERT INTO credential_usage (
                credential_id, user_id, service_name, query_type,
                query_params, success, response_time_ms, cached, ip_address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """, credential_id, user_id, service_name, query_type,
            query_params, success, response_time_ms, cached, ip_address)

        # Update monthly counter in user_credentials
        if success:
            await db.execute("""
                UPDATE user_credentials
                SET monthly_queries_used = monthly_queries_used + 1,
                    last_used_at = NOW()
                WHERE id = $1
            """, credential_id)
```

---

## Security Measures

### 1. Encryption at Rest ✅

```python
# All credentials encrypted in PostgreSQL using Fernet
# Encryption key stored in environment variable
# Key never committed to git
```

### 2. Encryption in Transit ✅

```python
# All API calls over HTTPS
# TLS 1.3 required for production
```

### 3. No Logging of Credentials ✅

```python
import logging

logger = logging.getLogger(__name__)

# ❌ BAD - Never do this!
logger.info(f"Logging in with password: {password}")

# ✅ GOOD
logger.info(f"Authenticating user {user_id} with service {service_name}")
```

### 4. Audit Trail ✅

```sql
-- Every credential access logged
SELECT
    u.email,
    cu.service_name,
    cu.query_type,
    cu.timestamp,
    cu.ip_address
FROM credential_usage cu
JOIN users u ON cu.user_id = u.id
WHERE cu.timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY cu.timestamp DESC;
```

### 5. Credential Rotation ✅

```python
async def rotate_encryption_key():
    """
    Rotate encryption key.

    Process:
    1. Generate new encryption key
    2. Fetch all credentials with old key
    3. Decrypt with old key
    4. Re-encrypt with new key
    5. Update database
    6. Update encryption_key_version
    """
    old_encryption = EncryptionService(old_key)
    new_encryption = EncryptionService(new_key)

    credentials = await db.fetch_all(
        "SELECT * FROM user_credentials WHERE encryption_key_version = 1"
    )

    for cred in credentials:
        # Decrypt with old key
        username = old_encryption.decrypt(cred['encrypted_username'])
        password = old_encryption.decrypt(cred['encrypted_password'])

        # Re-encrypt with new key
        new_username = new_encryption.encrypt(username)
        new_password = new_encryption.encrypt(password)

        # Update
        await db.execute("""
            UPDATE user_credentials
            SET encrypted_username = $1,
                encrypted_password = $2,
                encryption_key_version = 2
            WHERE id = $3
        """, new_username, new_password, cred['id'])
```

### 6. Rate Limiting ✅

```python
# Prevent brute force attacks on external services
# Limit: 10 failed authentication attempts per hour per credential

from datetime import datetime, timedelta

async def check_auth_rate_limit(credential_id: str) -> bool:
    """Check if too many failed auth attempts"""

    one_hour_ago = datetime.now() - timedelta(hours=1)

    failed_count = await db.fetch_val("""
        SELECT COUNT(*)
        FROM credential_usage
        WHERE credential_id = $1
          AND timestamp >= $2
          AND success = false
          AND query_type = 'authentication'
    """, credential_id, one_hour_ago)

    return failed_count < 10
```

### 7. Access Control ✅

```python
async def can_use_credential(user_id: str, credential_id: str) -> bool:
    """Check if user can use this credential"""

    credential = await db.fetch_one(
        "SELECT * FROM user_credentials WHERE id = $1",
        credential_id
    )

    if not credential:
        return False

    # Personal credentials: Only owner can use
    if credential['scope'] == 'personal':
        return credential['user_id'] == user_id

    # Shared credentials: Anyone in same organization
    if credential['scope'] == 'shared':
        user_org = await db.fetch_val(
            "SELECT organization_id FROM users WHERE id = $1",
            user_id
        )
        return user_org == credential['organization_id']

    return False
```

---

## Implementation Details

### API Endpoints

```python
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

router = APIRouter(prefix="/api/credentials", tags=["credentials"])

class AddCredentialRequest(BaseModel):
    service_name: str  # 'urs', 'cenovamapa', 'csn_online'
    credential_type: str  # 'username_password' or 'api_key'
    username: str = None
    password: str = None
    api_key: str = None
    scope: str = "personal"  # 'personal' or 'shared'
    monthly_query_limit: int = 1000

@router.post("/")
async def add_credential(
    request: AddCredentialRequest,
    user_id: str = Depends(get_current_user)
) -> dict:
    """
    Add user credentials for a paid service.

    Example:
        POST /api/credentials
        {
            "service_name": "urs",
            "credential_type": "username_password",
            "username": "myuser@example.com",
            "password": "MySecurePassword123",
            "scope": "personal"
        }

    Returns:
        {
            "id": "cred-uuid-123",
            "service_name": "urs",
            "status": "active",
            "created_at": "2024-11-06T10:30:00Z"
        }
    """
    encryption = EncryptionService()

    # Encrypt credentials
    encrypted_username = encryption.encrypt(request.username) if request.username else None
    encrypted_password = encryption.encrypt(request.password) if request.password else None
    encrypted_api_key = encryption.encrypt(request.api_key) if request.api_key else None

    # Store in database
    credential_id = await db.fetch_val("""
        INSERT INTO user_credentials (
            user_id, service_name, credential_type,
            encrypted_username, encrypted_password, encrypted_api_key,
            scope, monthly_query_limit
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
    """, user_id, request.service_name, request.credential_type,
        encrypted_username, encrypted_password, encrypted_api_key,
        request.scope, request.monthly_query_limit)

    # Return metadata (NOT credentials!)
    return {
        "id": str(credential_id),
        "service_name": request.service_name,
        "status": "active",
        "created_at": datetime.now().isoformat()
    }

@router.get("/")
async def list_credentials(
    user_id: str = Depends(get_current_user)
) -> dict:
    """List user's credentials (metadata only, no actual credentials)"""

    credentials = await db.fetch_all("""
        SELECT
            id, service_name, credential_type, scope, status,
            monthly_query_limit, monthly_queries_used,
            created_at, last_used_at, expires_at
        FROM user_credentials
        WHERE user_id = $1 OR (scope = 'shared' AND organization_id = (
            SELECT organization_id FROM users WHERE id = $1
        ))
        ORDER BY created_at DESC
    """, user_id)

    return {
        "credentials": [dict(row) for row in credentials]
    }

@router.delete("/{credential_id}")
async def delete_credential(
    credential_id: str,
    user_id: str = Depends(get_current_user)
):
    """Delete credential"""

    # Check ownership
    if not await can_use_credential(user_id, credential_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.execute(
        "DELETE FROM user_credentials WHERE id = $1",
        credential_id
    )

    return {"status": "deleted"}

@router.get("/{credential_id}/usage")
async def get_credential_usage(
    credential_id: str,
    user_id: str = Depends(get_current_user)
) -> dict:
    """Get usage statistics for credential"""

    if not await can_use_credential(user_id, credential_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    limiter = UsageLimiter()
    usage = await limiter.check_limit(credential_id, user_id)

    # Get recent usage
    recent = await db.fetch_all("""
        SELECT
            query_type,
            success,
            timestamp,
            cached
        FROM credential_usage
        WHERE credential_id = $1
        ORDER BY timestamp DESC
        LIMIT 50
    """, credential_id)

    return {
        "limit": usage,
        "recent_queries": [dict(row) for row in recent]
    }
```

### Proxy Service Base Class

```python
from abc import ABC, abstractmethod

class BaseProxy(ABC):
    """Base class for all proxy services"""

    def __init__(self, credential_manager, cache):
        self.credential_manager = credential_manager
        self.cache = cache

    @abstractmethod
    async def authenticate(self, username: str, password: str) -> bool:
        """Authenticate with external service"""
        pass

    @abstractmethod
    async def query(self, params: dict) -> dict:
        """Execute query on external service"""
        pass

    async def execute_with_auth(
        self,
        user_id: str,
        service_name: str,
        query_params: dict
    ) -> dict:
        """
        Execute query with authentication.

        Process:
        1. Get credentials
        2. Authenticate
        3. Execute query
        4. Track usage
        5. Return result
        """
        # Get credentials
        credentials = await self.credential_manager.get_credentials(
            user_id,
            service_name
        )

        if not credentials:
            raise ValueError(f"No credentials found for {service_name}")

        # Check usage limit
        limiter = UsageLimiter()
        usage = await limiter.check_limit(credentials['id'], user_id)

        if not usage['allowed']:
            raise ValueError(
                f"Monthly limit exceeded. "
                f"Used: {usage['used_this_month']}/{usage['limit']}. "
                f"Resets: {usage['resets_at']}"
            )

        # Decrypt credentials
        encryption = EncryptionService()
        username = encryption.decrypt(credentials['encrypted_username'])
        password = encryption.decrypt(credentials['encrypted_password'])

        try:
            # Authenticate
            authenticated = await self.authenticate(username, password)

            if not authenticated:
                await limiter.track_usage(
                    credentials['id'], user_id, service_name,
                    'authentication', {}, success=False, response_time_ms=0
                )
                raise ValueError("Authentication failed")

            # Execute query
            start_time = datetime.now()
            result = await self.query(query_params)
            response_time_ms = (datetime.now() - start_time).total_seconds() * 1000

            # Track usage
            await limiter.track_usage(
                credentials['id'], user_id, service_name,
                'query', query_params, success=True,
                response_time_ms=int(response_time_ms)
            )

            return result

        finally:
            # Clear credentials from memory
            del username
            del password
```

### Example: ÚRS Proxy

```python
import aiohttp

class URSProxy(BaseProxy):
    """Proxy for ÚRS database"""

    BASE_URL = "https://www.urs.cz"  # Example URL

    def __init__(self, credential_manager, cache):
        super().__init__(credential_manager, cache)
        self.session = None

    async def authenticate(self, username: str, password: str) -> bool:
        """Login to ÚRS"""

        async with aiohttp.ClientSession() as session:
            # Example login (adjust based on actual ÚRS API/website)
            async with session.post(
                f"{self.BASE_URL}/login",
                data={'username': username, 'password': password}
            ) as response:
                if response.status == 200:
                    self.session = session
                    return True
                return False

    async def query(self, params: dict) -> dict:
        """
        Query ÚRS database.

        params:
            {
                'code': 'JKSO code or KROS code',
                'region': 'Praha',
                'year': 2024,
                'quarter': 'Q4'
            }
        """
        if not self.session:
            raise ValueError("Not authenticated")

        # Example query (adjust based on actual ÚRS API)
        async with self.session.get(
            f"{self.BASE_URL}/api/prices",
            params=params
        ) as response:
            data = await response.json()

            return {
                'source': 'urs',
                'code': params['code'],
                'price': data['price'],
                'unit': data['unit'],
                'region': params['region'],
                'valid_from': data['valid_from'],
                'valid_to': data['valid_to']
            }
```

---

## Testing Strategy

### Unit Tests

```python
import pytest
from cryptography.fernet import Fernet

@pytest.mark.asyncio
async def test_encryption():
    """Test credential encryption"""
    encryption = EncryptionService()

    plaintext = "MySecurePassword123"
    encrypted = encryption.encrypt(plaintext)

    # Should be different from plaintext
    assert encrypted != plaintext

    # Should decrypt correctly
    decrypted = encryption.decrypt(encrypted)
    assert decrypted == plaintext

@pytest.mark.asyncio
async def test_add_credential():
    """Test adding credential"""
    response = await client.post("/api/credentials", json={
        "service_name": "urs",
        "credential_type": "username_password",
        "username": "test@example.com",
        "password": "TestPassword123",
        "scope": "personal"
    })

    assert response.status_code == 200
    data = response.json()

    # Should return metadata
    assert "id" in data
    assert data["service_name"] == "urs"

    # Should NOT return credentials
    assert "username" not in data
    assert "password" not in data

@pytest.mark.asyncio
async def test_usage_limit():
    """Test usage limits"""
    limiter = UsageLimiter()

    # Create credential with limit of 5
    credential_id = await create_test_credential(monthly_limit=5)

    # Use 5 times (should succeed)
    for i in range(5):
        usage = await limiter.check_limit(credential_id, user_id)
        assert usage['allowed'] == True
        await limiter.track_usage(
            credential_id, user_id, 'urs', 'query', {}, True, 100
        )

    # 6th attempt should fail
    usage = await limiter.check_limit(credential_id, user_id)
    assert usage['allowed'] == False
    assert usage['used_this_month'] == 5
```

### Security Tests

```python
@pytest.mark.asyncio
async def test_no_credential_leakage():
    """Ensure credentials never leak in responses"""

    # Add credential
    await client.post("/api/credentials", json={
        "service_name": "urs",
        "username": "secret_user",
        "password": "secret_pass"
    })

    # List credentials
    response = await client.get("/api/credentials")
    data = response.json()

    # Check response doesn't contain credentials
    response_text = str(data)
    assert "secret_user" not in response_text
    assert "secret_pass" not in response_text

@pytest.mark.asyncio
async def test_credential_isolation():
    """Users can't access other users' credentials"""

    # User A adds credential
    cred_id = await add_credential(user_a_id, "urs", "userA", "passA")

    # User B tries to use it
    with pytest.raises(HTTPException) as exc:
        await proxy.execute_with_auth(
            user_b_id, "urs", {'code': '123'}
        )

    assert exc.value.status_code == 403
```

---

## Migration Plan

### Phase 1: Infrastructure (Week 1)

**Day 1-2:**
- [ ] Create `user_credentials` table
- [ ] Create `credential_usage` table
- [ ] Implement `EncryptionService`
- [ ] Generate encryption key for production

**Day 3-4:**
- [ ] Implement `CredentialManager`
- [ ] Implement `UsageLimiter`
- [ ] Create API endpoints
- [ ] Write unit tests

**Day 5:**
- [ ] Security review
- [ ] Deploy to staging

### Phase 2: Proxy Services (Week 2)

**Day 1-2:**
- [ ] Implement `URSProxy` (if API available)
- [ ] Implement `CenovamapaProxy`
- [ ] Test authentication flows

**Day 3-4:**
- [ ] Implement `CSNOnlineProxy`
- [ ] Integrate with `KnowledgeRouter`
- [ ] End-to-end testing

**Day 5:**
- [ ] Production deployment
- [ ] Monitoring setup

### Phase 3: Advanced Features (Week 3+)

- [ ] Credential sharing (organization-level)
- [ ] Credential expiry notifications
- [ ] Automatic credential validation
- [ ] Usage analytics dashboard

---

## Success Metrics

**After 1 Month:**

- ✅ 100% of credentials encrypted at rest
- ✅ Zero credential leaks in logs or responses
- ✅ <5% authentication failures
- ✅ 95%+ uptime for proxy services
- ✅ Users can manage credentials via UI
- ✅ Complete audit trail of all credential usage

---

**Document Status:** ✅ Complete
**Next Steps:** Implement after perplexity_routing.md
**Dependencies:** PostgreSQL (storage), Redis (caching), Encryption library (cryptography)

**Security Note:** This specification handles sensitive credentials. Review with security team before implementation.

---

**Last Updated:** 2025-11-06
**Author:** Claude Code (AI Development Assistant)
**Reviewed By:** [Pending - Security Review Required]
