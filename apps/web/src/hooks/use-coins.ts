"use client"

import { useQuery } from "@tanstack/react-query"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "3001"

async function fetchCoins(): Promise<number> {
  const url = API_BASE
    ? `${API_BASE}/coins/balance`
    : "/coins/balance" // fallback kalau sudah diproxy
  const res = await fetch(url, {
    credentials: "include", // kalau backend pakai cookie; kalau pakai Bearer token, ganti header
    headers: { Accept: "application/json" },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Failed fetching coins: ${res.status} ${text}`)
  }

  const json = await res.json().catch(() => null)
  console.debug("[useCoins] raw response:", url, json)

  const candidate =
    json?.data?.balance ??
    json?.data?.wallet?.balance ??
    json?.balance ??
    json?.data ??
    0

  let balanceNum = 0
  if (typeof candidate === "string") {
    const digits = candidate.replace(/[^\d-]/g, "")
    balanceNum = digits ? parseInt(digits, 10) : 0
  } else if (typeof candidate === "number") {
    balanceNum = candidate
  } else if (candidate && typeof candidate === "object" && typeof candidate.balance === "string") {
    const digits = candidate.balance.replace(/[^\d-]/g, "")
    balanceNum = digits ? parseInt(digits, 10) : 0
  } else {
    balanceNum = 0
  }

  return Number.isNaN(balanceNum) ? 0 : balanceNum
}

export function useCoins() {
  return useQuery({
    queryKey: ["coins", "balance"],
    queryFn: fetchCoins,
    staleTime: 30_000,
    retry: 1,
  })
}