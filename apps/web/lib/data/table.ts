// Compact columnar encoding for row arrays sent from server to client.
// String columns are dictionary-encoded, so a row like
// {reporting_period: "2026-09", category_code: "passenger_car", ...} travels as
// [212, 3, ...]. Decoding restores plain objects, so view code never changes.

export type EncodedTable = {
  /** column names */
  c: string[];
  /** dictionaries for string columns, keyed by column index */
  d: Record<number, Array<string | null>>;
  /** rows; dictionary columns hold indices */
  r: Array<Array<string | number | boolean | null>>;
};

type Row = Record<string, unknown>;

export function encodeTable<T extends Row>(rows: T[], columns?: string[]): EncodedTable {
  const cols = columns ?? (rows.length ? Object.keys(rows[0]) : []);
  const dictionaries: Record<number, Array<string | null>> = {};
  const lookup: Record<number, Map<string | null, number>> = {};
  cols.forEach((name, index) => {
    const sample = rows.find((row) => row[name] != null)?.[name];
    if (typeof sample === "string") {
      dictionaries[index] = [];
      lookup[index] = new Map();
    }
  });
  const encoded = rows.map((row) =>
    cols.map((name, index) => {
      const value = (row[name] ?? null) as string | number | boolean | null;
      const map = lookup[index];
      if (!map) return value;
      const key = value as string | null;
      let id = map.get(key);
      if (id === undefined) {
        id = dictionaries[index].length;
        dictionaries[index].push(key);
        map.set(key, id);
      }
      return id;
    }),
  );
  return { c: cols, d: dictionaries, r: encoded };
}

export function decodeTable<T>(table: EncodedTable | undefined): T[] {
  if (!table) return [];
  const { c, d, r } = table;
  return r.map((row) => {
    const out: Record<string, unknown> = {};
    for (let i = 0; i < c.length; i++) {
      const dict = d[i];
      out[c[i]] = dict ? dict[row[i] as number] : row[i];
    }
    return out as T;
  });
}
