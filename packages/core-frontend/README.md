# Stav Agent Frontend

Modern React frontend for the Stav Agent assistant. The UI consumes the public API hosted at
`https://concrete-agent.onrender.com` (configurable via environment variables) and renders chat
responses together with structured artifacts.

## Getting Started

```bash
npm install
npm run dev
```

Create an `.env` file (or use `.env.example`) with the API base URL:

```bash
cp .env.example .env
# Edit .env if you want to target a different backend
```

The Vite dev server proxies `/api` requests to the configured backend when `npm run dev` is used.

## Environment variables

| Name           | Description                                       | Default                               |
| -------------- | ------------------------------------------------- | ------------------------------------- |
| `VITE_API_URL` | Base URL of the backend FastAPI service (HTTPS).  | `https://concrete-agent.onrender.com` |

## API contract

The frontend talks to the backend exclusively through the following endpoints. All requests are
sent to `${VITE_API_URL}`.

### Project endpoints

- `GET /api/projects` – list available projects (`projects: [{ project_id, project_name, positions_total }]`).
- `GET /api/projects/{project_id}/status` – current pipeline status (`{ status: string }`).
- `GET /api/projects/{project_id}/results` – latest project results, optionally including an artifact (`{ artifact?: {...} }`).
- `GET /api/projects/{project_id}/files` – uploaded files for the project (`{ files: [...] }`).
- `POST /api/upload?project_id=...` – multipart file upload (`files[]`).

### Chat endpoints

- `POST /api/chat/message` – send a free-form chat message.
- `POST /api/chat/action` – trigger one of the predefined quick actions (see below).

Every chat-related endpoint returns the same payload shape:

```json
{
  "response": "Text reply from the assistant",
  "artifact": {
    "title": "Optional artifact title",
    "type": "audit_result | materials_summary | resources_calc | position_breakdown",
    "data": { "...": "Arbitrary artifact payload" }
  }
}
```

The UI renders the `response` inside the chat history and, when present, the `artifact` in the
right-hand panel. New artifact types can be mapped by adding an entry to
`src/components/layout/ArtifactPanel.jsx`.

### Quick actions

The quick actions available in the UI map to backend actions as follows:

| UI button        | API `action` value      |
| ---------------- | ----------------------- |
| Audit pozice     | `audit_positions`       |
| Materiály        | `materials_summary`     |
| Zdroje           | `calculate_resources`   |
| Rozebrat         | `position_breakdown`    |

## Artifacts

Artifacts are rendered by dedicated components in `src/components/artifacts`. The mapping from
artifact `type` to renderer lives in `src/components/layout/ArtifactPanel.jsx`. Extend this mapping
when new artifact types are introduced on the backend.
