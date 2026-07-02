# Rozpočet Registry Backend

Multi-user backend для Registry Rozpočtů с PostgreSQL на Google Cloud SQL.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Database
Cloud SQL (managed via Cloud Build / gcloud)

### 3. Configure Environment
```bash
cp .env.example .env
# Отредактировать DATABASE_URL
```

### 4. Run Locally
```bash
npm run dev
```

### 5. Test
```bash
curl http://localhost:3002/health
# (local dev only — production URL is the Cloud Run service, europe-west3)
```

## API Endpoints

### Projects
- `GET /api/registry/projects?user_id=1` - List projects
- `POST /api/registry/projects` - Create project
- `GET /api/registry/projects/:id` - Get project
- `DELETE /api/registry/projects/:id` - Delete project

### Sheets
- `GET /api/registry/projects/:id/sheets` - List sheets
- `POST /api/registry/projects/:id/sheets` - Create sheet
- `DELETE /api/registry/sheets/:id` - Delete sheet

### Items
- `GET /api/registry/sheets/:id/items` - List items
- `POST /api/registry/sheets/:id/items` - Create item
- `PUT /api/registry/items/:id` - Update item
- `DELETE /api/registry/items/:id` - Delete item
- `PATCH /api/registry/items/:id/tov` - Update TOV data

## Deployment

### Cloud Run (europe-west3)
1. Cloud Build deploys the `rozpocet-registry-backend` service
2. Build: `npm install`
3. Start: `npm start`
4. Add env var (Secret Manager): `DATABASE_URL`

## Database Schema

See [schema.sql](./schema.sql)

## Cost

- Google Cloud SQL (europe-west3)

## Support

- Database: Cloud SQL (managed via Cloud Build / gcloud)
- Issues: https://github.com/alpro1000/STAVAGENT/issues
