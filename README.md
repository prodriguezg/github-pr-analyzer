# GitHub PR Analyzer

A minimal monorepo that analyzes GitHub pull request diffs using OpenAI. It includes a NestJS backend that returns structured JSON reviews and a Vite + React frontend for submitting diffs and viewing results.

<img width="1184" height="1052" alt="image" src="https://github.com/user-attachments/assets/1d5082aa-4654-486d-9c90-cc597eb8d47b" />


## Architecture
- `src/backend`: NestJS API (`POST /reviews`, `GET /health`)
- `src/frontend`: Vite React UI
- `docker-compose.yml`: runs backend and frontend in separate containers

## Local Development

### Backend
```bash
cd src/backend
npm install
npm run start:dev
```
The backend runs on `http://localhost:3000`.

### Frontend
```bash
cd src/frontend
npm install
npm run dev
```
The frontend runs on `http://localhost:5173`.

## Docker Compose
```bash
docker-compose up --build
```
- Backend: `http://localhost:3000`
- Frontend: `http://localhost:5173`

*NOTE:* Must run `npm install` on both projects before trying to build the containers in order to get package-lock.json files
  

## Environment Variables
Create a `.env` file at the repo root (see `.env.example`):

- `OPENAI_API_KEY` (required)
- `OPENAI_MODEL` (optional, default `gpt-4.1-mini`)
- `FRONTEND_ORIGIN` (optional, default `http://localhost:5173`)
- `MAX_DIFF_LENGTH` (optional, default: `200_000`)
- `VITE_API_BASE_URL` (frontend build-time, default `http://localhost:3000`)

## Example Request
```bash
curl -X POST http://localhost:3000/reviews \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix pagination edge case",
    "repoContext": "API service for reporting",
    "language": "typescript",
    "reviewProfile": "balanced",
    "diff": "diff --git a/src/pager.ts b/src/pager.ts\nindex 123..456 100644\n--- a/src/pager.ts\n+++ b/src/pager.ts\n@@ -10,6 +10,10 @@ export function paginate(items: string[], page: number) {\n   if (page < 1) return [];\n+  if (items.length === 0) {\n+    return [];\n+  }\n   const start = (page - 1) * 10;\n   return items.slice(start, start + 10);\n }"
  }'
```

