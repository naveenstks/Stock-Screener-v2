const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchScanStatus() {
  const res = await fetch(`${API}/api/scan/status`);
  return res.json();
}

export async function fetchScanResults() {
  const res = await fetch(`${API}/api/scan/results`);
  return res.json();
}

export async function startScan(filters: Record<string, unknown>) {
  const params = new URLSearchParams(filters as Record<string, string>);
  const res = await fetch(`${API}/api/scan/start?${params}`, { method: "POST" });
  return res.json();
}

export async function fetchChartData(ticker: string) {
  const res = await fetch(`${API}/api/chart/${ticker}`);
  return res.json();
}

export async function fetchHistory(days = 7) {
  const res = await fetch(`${API}/api/history?days=${days}`);
  return res.json();
}

export async function fetchTickerHistory(ticker: string, days = 30) {
  const res = await fetch(`${API}/api/history/${ticker}?days=${days}`);
  return res.json();
}
