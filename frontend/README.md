# Hudheel ERP Frontend

A lightweight Next.js App Router frontend for hotel operations. The NestJS backend remains a separate sibling project (for example, `../Backend`) and is never embedded in this application.

## Start locally

```bash
npm install
npm run dev
```

The frontend runs at `http://localhost:3000`. Configure the separate backend URL in `.env.local`:

```env
API_URL=http://localhost:3005/api/v1
NEXT_PUBLIC_API_URL=http://localhost:3005/api/v1
```

The backend Docker stack exposes the API on port `3005` to avoid `EADDRINUSE` conflicts from common local services already using `3001`.

## Expected backend contract

Authentication uses a Next.js backend-for-frontend layer. Access and refresh credentials remain in HttpOnly frontend-origin cookies; the refresh token is sent only to the backend refresh endpoint. The NestJS backend must expose:

- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `POST /auth/refresh`
- `GET /auth/me`
- `GET /rooms?page=1&pageSize=20&search=&status=`
- `POST /rooms`
- `GET /rooms/:id`
- `PATCH /rooms/:id`
- `DELETE /rooms/:id` (soft-delete/deactivate is recommended)
- `PATCH /rooms/:id/status`
- `PATCH /rooms/:id/restore`
- `GET /room-types`
- `GET /floors`

Paginated backend endpoints return `{ data, pagination: { page, pageSize, total, pageCount } }`; adapters translate this into the frontend view model.

## Architecture

- Server Components perform protected initial reads and forward the request cookie to NestJS.
- Axios is centralized for interactive browser mutations with `withCredentials: true`.
- TanStack Query is reserved for mutations and interactive invalidation.
- React Hook Form and Zod handle user-friendly form validation; NestJS remains the source of truth.
- Route-group layout protection checks `/auth/me`; unauthorized browser requests return users to `/login`.
- Navigation and actions are hidden according to role and permission data, while backend authorization remains mandatory.

There is no demo-mode bypass or frontend mock dataset. Application screens use standard HTTP requests to the NestJS REST API and display saved backend records.
