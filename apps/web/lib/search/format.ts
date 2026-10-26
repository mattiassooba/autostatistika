// Decoder for the /otsing search files written by
// ingestion/publishing/register_index.py:
//   u32 header length | UTF-8 JSON header | 4-byte aligned column buffers.
// Text columns hold dictionary codes; number columns hold integers × scale
// with the type's maximum as the "missing" sentinel.

export type ColumnType = "u8" | "u16" | "u32";
export type ColumnData = Uint8Array | Uint16Array | Uint32Array;

export type Column = {
  name: string;
  kind: "text" | "number";
  type: ColumnType;
  data: ColumnData;
  dict?: string[];
  missing?: number;
  scale?: number;
};

export type Table = { rows: number; columns: Record<string, Column> };

type HeaderColumn = Omit<Column, "data"> & { offset: number };

const ARRAYS = { u8: Uint8Array, u16: Uint16Array, u32: Uint32Array } as const;

export function decodeTable(buffer: ArrayBuffer): Table {
  const headerLength = new DataView(buffer).getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, headerLength))) as {
    rows: number;
    columns: HeaderColumn[];
  };
  const base = 4 + headerLength;
  const columns: Record<string, Column> = {};
  for (const column of header.columns) {
    const ArrayType = ARRAYS[column.type];
    // Copy so the typed array is aligned regardless of the header length.
    const bytes = new Uint8Array(buffer, base + column.offset, header.rows * ArrayType.BYTES_PER_ELEMENT).slice();
    columns[column.name] = { ...column, data: new ArrayType(bytes.buffer) };
  }
  return { rows: header.rows, columns };
}

/** A number column's value for a row in display units, or null when missing. */
export function numberAt(column: Column | undefined, row: number): number | null {
  if (!column) return null;
  const raw = column.data[row];
  if (raw === column.missing) return null;
  return column.scale ? raw / column.scale : raw;
}

/** A text column's value for a row; "" when the source cell was empty. */
export function textAt(column: Column | undefined, row: number): string {
  if (!column?.dict) return "";
  return column.dict[column.data[row]] ?? "";
}

/** Test helper and fixture builder: encode rows the way the Python writer does. */
export function encodeTable(
  rows: Array<Record<string, string | number | null>>,
  spec: Array<{ name: string; kind: "text" | "number"; scale?: number }>,
): ArrayBuffer {
  const columns: HeaderColumn[] = [];
  const buffers: Uint8Array[] = [];
  let offset = 0;
  for (const { name, kind, scale } of spec) {
    let data: ColumnData;
    let meta: Omit<HeaderColumn, "offset">;
    if (kind === "text") {
      const dict = [...new Set(rows.map((row) => String(row[name] ?? "")))].sort();
      data = Uint16Array.from(rows.map((row) => dict.indexOf(String(row[name] ?? ""))));
      meta = { name, kind, type: "u16", dict };
    } else {
      const missing = 0xffffffff;
      data = Uint32Array.from(rows.map((row) => (row[name] == null ? missing : Math.round(Number(row[name]) * (scale ?? 1)))));
      meta = { name, kind, type: "u32", missing, ...(scale ? { scale } : {}) };
    }
    const bytes = new Uint8Array(data.buffer.slice(0));
    const padded = new Uint8Array(Math.ceil(bytes.length / 4) * 4);
    padded.set(bytes);
    columns.push({ ...meta, offset });
    buffers.push(padded);
    offset += padded.length;
  }
  let header = new TextEncoder().encode(JSON.stringify({ rows: rows.length, columns }));
  const pad = (4 - (header.length % 4)) % 4;
  if (pad) header = Uint8Array.from([...header, ...new Array(pad).fill(32)]);
  const out = new Uint8Array(4 + header.length + offset);
  new DataView(out.buffer).setUint32(0, header.length, true);
  out.set(header, 4);
  let at = 4 + header.length;
  for (const buffer of buffers) {
    out.set(buffer, at);
    at += buffer.length;
  }
  return out.buffer;
}
