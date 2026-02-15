# Rozpočet Registry Backend

Multi-user backend для Registry Rozpočtů с PostgreSQL на AWS RDS.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Database
Следуй инструкциям в [AWS_RDS_SETUP.md](./AWS_RDS_SETUP.md)

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

### Render
1. Connect GitHub repo
2. Root Directory: `rozpocet-registry-backend`
3. Build: `npm install`
4. Start: `npm start`
5. Add env var: `DATABASE_URL`

## Database Schema

See [schema.sql](./schema.sql)

## Cost

- AWS RDS Free Tier: $0/month (12 months)
- After Free Tier: ~$17/month
- Render Free Tier: $0/month (sleeps after 15 min)

## Support

- AWS RDS Setup: [AWS_RDS_SETUP.md](./AWS_RDS_SETUP.md)
- Issues: https://github.com/alpro1000/STAVAGENT/issues
