import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";
  const targetPath = "/api/v1/orders/operator/create";

  try {
    // Read incoming body (assume JSON)
    const body = await request.json().catch(() => null);

    // Forward cookie so NestJS can read httpOnly access_token
    const cookieHeader = request.headers.get("cookie") || "";

    // Forward some useful headers (User-Agent, X-Request-Id if present)
    const forwardedHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const ua = request.headers.get("user-agent");
    if (ua) forwardedHeaders["user-agent"] = ua;

    const xRequestId = request.headers.get("x-request-id");
    if (xRequestId) forwardedHeaders["x-request-id"] = xRequestId;

    if (cookieHeader) forwardedHeaders["cookie"] = cookieHeader;

    const resp = await fetch(`${backendUrl}${targetPath}`, {
      method: "POST",
      headers: forwardedHeaders,
      body: JSON.stringify(body),
      // Note: not using credentials here because this is a server-side fetch
    });

    const text = await resp.text();
    let payload: any = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      // Backend returned non-JSON (plain text) — return raw text under `.raw`
      payload = { raw: text };
    }

    return NextResponse.json(payload ?? {}, { status: resp.status });
  } catch (error: any) {
    console.error("[Proxy] error forwarding create order:", error);
    // If network/fetch error (backend unreachable)
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return NextResponse.json(
        {
          success: false,
          error: "Backend service unavailable",
          message: "Unable to connect to backend service. Please try again later.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: error?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}