export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
export interface ApiErrorPayload { code?: string; message?: string | string[]; error?: string; statusCode?: number; details?: unknown }
