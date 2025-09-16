import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";

    // Log for debugging
    console.log(`🔍 [API Route] Backend URL: ${backendUrl}`);
    console.log(`🔍 [API Route] Request params: ${request.nextUrl.searchParams.toString()}`);

    // Ambil cookie dari request browser
    const cookie = request.headers.get("cookie") || "";

    const fullUrl = `${backendUrl}/api/v1/orders/operator/drivers?${request.nextUrl.searchParams}`;
    console.log(`🔍 [API Route] Full URL: ${fullUrl}`);

    // Add timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds

    const response = await fetch(fullUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        cookie, // ⬅️ forward cookie ke backend
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log(`🔍 [API Route] Backend response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [API Route] Backend error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `Backend error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`✅ [API Route] Success: ${JSON.stringify(data).substring(0, 200)}...`);

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("❌ [API Route] Fetch error:", error);

    // Handle timeout error
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        {
          error: "Request timeout",
          details: "Backend request timed out after 30 seconds",
          timestamp: new Date().toISOString()
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to fetch drivers",
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
