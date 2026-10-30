export async function saveAttempt(
  payload: Record<string, unknown>, fetcher: typeof fetch = fetch,
  delay: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
): Promise<void> {
  const body = JSON.stringify({ ...payload, submissionId: crypto.randomUUID() });
  let lastError: unknown;
  for (let retry = 0; retry < 3; retry++) {
    try {
      const response = await fetcher("/api/attempts", {
        method: "POST", headers: { "Content-Type": "application/json" }, body,
      });
      if (response.ok) return;
      if (![409, 429, 500, 502, 503, 504].includes(response.status)) throw new Error(`Answer save rejected (${response.status})`);
      lastError = new Error(`Answer save failed (${response.status})`);
    } catch (caught) {
      lastError = caught;
      if (caught instanceof Error && caught.message.startsWith("Answer save rejected")) throw caught;
    }
    if (retry < 2) await delay(400 * 2 ** retry);
  }
  throw lastError;
}
