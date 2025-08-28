import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const limit = searchParams.get("limit") ?? "10";

  if (!q) {
    return NextResponse.json(
      { error: "Missing query" },
      { status: 400 }
    );
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      q
    )}&limit=${limit}&countrycodes=id&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "TaxiGo/1.0 (bagus@example.com)", // ganti emailmu
      },
      cache: "no-store", // jangan cache hasil
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch from Nominatim" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("search-places error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
