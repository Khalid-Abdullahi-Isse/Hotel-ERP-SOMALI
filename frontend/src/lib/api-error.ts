import axios from "axios";
import type { ApiErrorPayload } from "@/types/api";

const STATUS_MESSAGES: Record<number, string> = {
  400: "Please review the information and try again.",
  401: "Your session has expired. Please sign in again.",
  403: "You do not have permission to perform this action.",
  404: "The requested record could not be found.",
  409: "This change conflicts with an existing record.",
  422: "Some information is invalid. Please review the form.",
  429: "Too many requests. Please wait a moment and try again.",
  500: "The server could not complete the request. Please try again.",
};

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

export function getApiError(error: unknown): ApiError {
  console.error(error);
  if (error instanceof ApiError) return error;
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    if (!error.response) {
      return new ApiError("We could not reach the hotel server. Check your connection and try again.");
    }
    const { status, data } = error.response;
    const backendMessage = Array.isArray(data?.message) ? data.message[0] : data?.message;
    return new ApiError(backendMessage || STATUS_MESSAGES[status] || "Something went wrong. Please try again.", status);
  }
  if (error instanceof Error) return new ApiError(error.message);
  return new ApiError("Something went wrong. Please try again.");
}

export async function toApiError(response: Response): Promise<ApiError> {
  let payload: ApiErrorPayload | undefined;
  try { payload = (await response.json()) as ApiErrorPayload; } catch { payload = undefined; }
  const backendMessage = Array.isArray(payload?.message) ? payload.message[0] : payload?.message;
  return new ApiError(
    backendMessage || STATUS_MESSAGES[response.status] || "Something went wrong. Please try again.",
    response.status,
  );
}
