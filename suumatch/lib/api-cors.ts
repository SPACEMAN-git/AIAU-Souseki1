const DEFAULT_FRONTEND_ORIGIN = "https://jiahuicui394-alt.github.io";

function allowedOrigins() {
  return new Set([
    DEFAULT_FRONTEND_ORIGIN,
    "http://localhost:3000",
    ...(process.env.FRONTEND_ORIGIN ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ]);
}

export function withCors<T extends Response>(request: Request, response: T): T {
  const origin = request.headers.get("origin");
  if (origin && allowedOrigins().has(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Access-Control-Max-Age", "86400");
  response.headers.set("Vary", "Origin");
  return response;
}

export function corsPreflight(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins().has(origin)) {
    return new Response(null, { status: 403 });
  }

  return withCors(request, new Response(null, { status: 204 }));
}
