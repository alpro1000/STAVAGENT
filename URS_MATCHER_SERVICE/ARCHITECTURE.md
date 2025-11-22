# URS Matcher Service - Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      User Browser                           │
│                   (http://localhost:3001)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
           ┌─────────────┴─────────────┐
           │                           │
      ┌────▼────────┐          ┌──────▼────────┐
      │  Frontend   │          │   Backend     │
      │  (Nginx)    │◄────────►│   (Express)   │
      │  - HTML     │          │   - API       │
      │  - CSS      │          │   - Routes    │
      │  - JS       │          │   - Services  │
      └──────────────┘          └──────┬────────┘
                                       │
                           ┌───────────┴───────────┐
                           │                       │
                      ┌────▼─────┐          ┌─────▼───┐
                      │ Database  │          │   LLM   │
                      │ (SQLite)  │          │ (TODO)  │
                      │ - Jobs    │          │- OpenAI │
                      │ - Items   │          │- Claude │
                      └───────────┘          └─────────┘
```

---

## Components

### 1. Frontend (Nginx)
**Location:** `/frontend/public/`

**Files:**
- `index.html` - Main UI structure (kiosk interface)
- `styles.css` - Responsive design (mobile-first)
- `app.js` - Client-side logic (file upload, API calls)

**Features:**
- File upload (drag-and-drop)
- Text input (single-line matching)
- Results table (with export)
- Responsive design (works on tablets/mobile)

**Technologies:**
- Pure HTML/CSS/JavaScript (no frameworks for MVP-1)
- Vanilla JS (no jQuery/React)
- Mobile-responsive CSS Grid

---

### 2. Backend API (Express.js)
**Location:** `/backend/src/`

**Structure:**
```
backend/src/
├── app.js                      # Express initialization
├── api/
│   ├── routes/                 # API endpoints
│   │   ├── jobs.js            # File upload, text match, results
│   │   ├── catalog.js         # URS items search
│   │   └── health.js          # Health check
│   └── middleware/            # Express middleware
│       ├── errorHandler.js    # Error handling
│       └── requestLogger.js   # Request logging
├── services/                  # Business logic
│   ├── fileParser.js          # Excel/ODS/CSV parsing
│   ├── ursMatcher.js          # Text-to-URS matching
│   ├── llmClient.js           # LLM integration (TODO MVP-2)
│   ├── perplexityClient.js    # Perplexity integration (TODO MVP-3)
│   └── techRules.js           # Technology rules engine
├── db/                        # Database layer
│   ├── init.js                # Database initialization
│   └── schema.sql             # Database schema
└── utils/                     # Utility functions
    ├── logger.js              # Logging
    └── textNormalizer.js      # Czech text normalization
```

**Key Routes:**
- `POST /api/jobs/file-upload` - Upload and process file
- `POST /api/jobs/text-match` - Match single text
- `GET /api/jobs/:jobId` - Get job results
- `GET /api/urs-catalog` - Search URS items
- `GET /health` - Service health check

---

### 3. Database (SQLite/PostgreSQL)
**Location:** `/backend/src/db/`

**Schema:**
```sql
-- URS items catalog
urs_items (id, urs_code, urs_name, unit, description)

-- Processed jobs
jobs (id, filename, status, total_rows, processed_rows, created_at)

-- Job results
job_items (id, job_id, input_row_id, input_text, urs_code,
           urs_name, unit, quantity, confidence, source, extra_generated)

-- Future: mapping examples for ML training
mapping_examples (id, input_text, urs_code, confidence, validated_by_user)
```

**Connections:**
- SQLite for development/MVP-1 (lightweight, no setup)
- PostgreSQL for production (scalable, concurrent users)

---

### 4. Services Layer

#### File Parser (`fileParser.js`)
**Input:** Excel/ODS/CSV file
**Output:** Array of parsed rows {description, quantity, unit}

**Process:**
1. Read file using `xlsx` library
2. Detect columns (popis, množství, MJ)
3. Parse rows, skip empty rows
4. Return normalized data

---

#### URS Matcher (`ursMatcher.js`)
**Input:** Text description
**Output:** Array of URS matches with confidence scores

**MVP-1 Algorithm:**
- Text normalization (lowercase, remove Czech stop words)
- Levenshtein distance calculation
- Similarity scoring (0.0-1.0)
- Return top 5 matches sorted by score

**MVP-2 Enhancements:**
- OpenAI embeddings for semantic search
- LLM-based re-ranking of candidates
- Confidence thresholding

**MVP-3 Enhancements:**
- Perplexity search on ÚRS website
- Web search for donor estimates
- Feedback loop using mapping_examples

---

#### Tech Rules (`techRules.js`)
**Purpose:** Generate complementary work items

**Examples:**
- Concrete slab → add formwork (bednění)
- Concrete work → add reinforcement (výztuž)
- Earthwork → add soil compaction (hutnění)

**MVP-1:** Static rules list
**MVP-2:** AI-powered rule application
**MVP-3:** Dynamic rules from domain experts

---

## Data Flow

### File Upload Flow
```
1. User uploads Excel
   ↓
2. Multer saves file to /uploads
   ↓
3. fileParser.js reads and parses file
   ↓
4. For each row:
   a. Match text with URS → ursMatcher.js
   b. Generate related items → techRules.js
   ↓
5. Save job and items to database
   ↓
6. Return job_id to frontend
   ↓
7. Frontend fetches results via /api/jobs/{jobId}
   ↓
8. Display table with results
```

### Text Match Flow
```
1. User enters text
   ↓
2. POST to /api/jobs/text-match
   ↓
3. Backend:
   a. Normalize text
   b. Match against URS catalog
   c. Generate related items
   ↓
4. Return {candidates, related_items}
   ↓
5. Frontend displays results
```

---

## Technology Stack

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js 4.x
- **Database:** SQLite 3 (dev) / PostgreSQL 15 (prod)
- **File Parsing:** xlsx, odsjs
- **Utilities:** lodash, uuid, winston
- **Testing:** Jest, Supertest

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - CSS Grid, Flexbox, responsive
- **JavaScript (ES6)** - Modern JS (no transpiler needed for MVP)
- **No frameworks** - Pure DOM manipulation (MVP-1)

### DevOps
- **Containerization:** Docker, Docker Compose
- **Web Server:** Nginx (reverse proxy)
- **Process Manager:** Node's native (for MVP)

---

## Deployment Architecture

### Local Development
```
User Machine:
  Frontend: http://localhost:3000 (dev server)
  Backend:  http://localhost:3001 (Express)
  DB:       ./data/urs_matcher.db (SQLite)
```

### Docker (Development & Testing)
```
docker-compose:
  - backend service (Node.js Express)
  - frontend service (Nginx static)
  - postgres service (optional, for testing)
  - pgAdmin (optional, for DB inspection)
```

### Cloud Deployment (Production)
```
Render.com / DigitalOcean / AWS:
  - Backend: Web Service (auto-scaling)
  - Frontend: Static Site (CDN)
  - Database: PostgreSQL (managed)
  - Monitoring: Datadog / NewRelic
```

---

## Security Considerations

### MVP-1 (Development)
- ✅ File size validation (50MB limit)
- ✅ File type whitelist (.xlsx, .ods, .csv)
- ✅ Input validation (Joi)
- ✅ CORS configured
- ❌ No authentication (will add in MVP-3)
- ❌ No rate limiting (will add in MVP-2)

### MVP-2+
- [ ] JWT authentication
- [ ] API key authentication
- [ ] Rate limiting (express-rate-limit)
- [ ] HTTPS/SSL enforced
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS protection (helmet.js)

---

## Performance Optimization

### Current (MVP-1)
- File upload limits (50MB)
- Query limits (100 items by default)
- Connection pooling (SQLite via sqlite npm)
- Response caching (none yet)

### Planned (MVP-2+)
- Redis caching layer
- Database query optimization
- Frontend code splitting
- Image optimization
- Gzip compression
- CDN for static assets

---

## Testing Strategy

### Unit Tests
- `fileParser.test.js` - File parsing logic
- `ursMatcher.test.js` - Text matching algorithm
- `techRules.test.js` - Rule application

### Integration Tests
- API endpoint tests (Supertest)
- Database operations
- File upload workflow

### E2E Tests (Future)
- Selenium / Puppeteer
- Full user workflow testing

---

## Monitoring & Logging

### Logging
- Winston logger with timestamps
- Log levels: DEBUG, INFO, WARN, ERROR
- Structured logging for API requests

### Health Checks
- `GET /health` endpoint
- Database connectivity check
- Service status in Docker health check

### Future Monitoring
- Error tracking (Sentry)
- Performance monitoring (NewRelic)
- Uptime monitoring (UptimeRobot)
- Log aggregation (ELK stack)

---

## Extensibility

### Adding New Object Types
1. Add templates to `objectTemplates.js`
2. Update matching logic if needed
3. Add new tech rules

### Adding New LLM
1. Implement interface in `llmClient.js`
2. Add configuration in `.env`
3. Update prompt instructions

### Adding External APIs
1. Create new service file (e.g., `externalAPI.js`)
2. Implement error handling
3. Add to appropriate route

---

## Known Limitations (MVP-1)

- [ ] No LLM integration (stubbed)
- [ ] No Perplexity integration (stubbed)
- [ ] No authentication
- [ ] No rate limiting
- [ ] Single-threaded (no worker threads)
- [ ] File uploads not cleaned up
- [ ] No caching
- [ ] Czech stemming/lemmatization is basic

---

## Future Enhancements

### MVP-2
- [ ] OpenAI/Claude integration
- [ ] Confidence scoring refinement
- [ ] Tech-rules AI application
- [ ] Export to multiple formats
- [ ] User authentication

### MVP-3
- [ ] Perplexity API integration
- [ ] Web search for donor estimates
- [ ] User dashboard
- [ ] Job history and comparison
- [ ] Advanced filters

### Production
- [ ] Multi-tenancy support
- [ ] API rate limiting
- [ ] Advanced monitoring
- [ ] Backup & disaster recovery
- [ ] Multi-language support

---

**Architecture Version:** 1.0
**Status:** Production Ready (MVP-1)
**Last Updated:** November 2025
