import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";

  // Ambil cookie dari request browser
  const cookie = request.headers.get("cookie") || "";

  const response = await fetch(`${backendUrl}/api/v1/orders/operator/drivers?${request.nextUrl.searchParams}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      cookie, // ⬅️ forward cookie ke backend
    },
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
