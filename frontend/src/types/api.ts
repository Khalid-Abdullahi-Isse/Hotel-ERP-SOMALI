export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
export interface ApiErrorPayload { code?: string; message?: string | string[]; error?: string; statusCode?: number; details?: unknown }
