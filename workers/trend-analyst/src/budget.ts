// Daily budget of model calls, as one Durable Object. A Durable Object handles one
// request at a time and its storage reads and writes are not interleaved, so
// "read the count, refuse or add one" is atomic: the cap holds under parallel
// requests from anywhere, unlike a KV counter.

type Storage = {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T>(options?: { prefix?: string }): Promise<Map<string, T>>;
};

export class DailyBudget {
  constructor(private state: { storage: Storage }) {}

  async fetch(request: Request): Promise<Response> {
    const { day, limit } = (await request.json()) as { day: string; limit: number };
    const key = `calls:${day}`;
    const used = (await this.state.storage.get<number>(key)) ?? 0;
    if (!(limit > 0) || used >= limit) return Response.json({ ok: false, used });
    await this.state.storage.put(key, used + 1);
    // Keep a week of counts for `wrangler tail`-free inspection; drop older days.
    const old = await this.state.storage.list<number>({ prefix: "calls:" });
    for (const name of old.keys()) if (name < `calls:${weekBefore(day)}`) await this.state.storage.delete(name);
    return Response.json({ ok: true, used: used + 1 });
  }
}

function weekBefore(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 7);
  return date.toISOString().slice(0, 10);
}

/** The Durable Object namespace methods the handler uses. */
export type BudgetNamespace = {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(input: string, init?: RequestInit): Promise<Response> };
};

/** Take one call from today's budget; false when it is used up (or the budget cannot be reached). */
export async function takeCall(budget: BudgetNamespace, limit: number, now = new Date()): Promise<{ ok: boolean; used: number }> {
  const stub = budget.get(budget.idFromName("daily"));
  const response = await stub.fetch("https://budget/take", {
    method: "POST",
    body: JSON.stringify({ day: now.toISOString().slice(0, 10), limit }),
  });
  if (!response.ok) return { ok: false, used: -1 };
  return (await response.json()) as { ok: boolean; used: number };
}
