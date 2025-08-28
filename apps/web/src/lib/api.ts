export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
        credentials: 'include',
        body: options?.body,
    });
    const data = await res.json().catch(() => ({}));;
    if (!res.ok) {
        throw new Error(data?.message || 'Gagal masuk');
    }
    return data as T;
}