# Project Structure Guide

This project is intentionally split into explicit client/server areas.

## Where to look

- `src/client`
  - Browser-side code only.
  - UI components, React hooks, browser upload parsing, API clients.
  - Main UI entry: `src/client/components/TeacherIdeWorkspace.tsx`
  - Student dashboard (per-exercise status, totals): `src/client/components/StudentDashboard.tsx`

- `src/server`
  - Server-side logic only.
  - API orchestration helpers, grading services, server utilities.
  - Main grading service: `src/server/services/llmGradingService.ts`

- `src/app`
  - Next.js routes.
  - Page routes and API routes connect client and server modules.
  - API endpoint: `src/app/api/grade/route.ts`

- `src/types`
  - Shared strict TypeScript domain types between client and server.

## Request Flow

1. UI in `src/client/components/TeacherIdeWorkspace.tsx` gathers rubric + uploads.
2. Hook in `src/client/hooks/useTeacherUploadFlow.ts` parses files and sends request.
3. API route `src/app/api/grade/route.ts` runs bounded-concurrency grading jobs.
4. Server grading logic in `src/server/services/llmGradingService.ts` returns typed draft results.
5. UI renders the drafts in the results pane.
