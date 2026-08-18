export function hasTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export function untrustedOriginResponse(): Response {
  return Response.json(
    { code: "UNTRUSTED_ORIGIN", message: "The request origin is not allowed." },
    { status: 403 },
  );
}
