// Fetch and decode the /otsing search files. Files are gzip-compressed on disk
// (GitHub Pages does not compress binary types) and decompressed here.

import { decodeTable, type Table } from "./format";

export type Manifest = {
  snapshot: string;
  source: string;
  licence: string;
  vehicles: number;
  variants: number;
  families: Record<string, { vehicles: number; registered: number; lite: string }>;
  makes: Array<{ slug: string; name: string; vehicles: number; families: Record<string, number>; file: string }>;
  /** Share of vehicles with a value, per family and column (0-1). */
  fill: Record<string, Record<string, number>>;
  files: Record<string, number>;
};

export function registerBase(snapshot: string): string {
  return `/register/${snapshot}/`;
}

/** The files are gzip on disk; whether the browser already undid that depends on the
 * server's headers, so the magic bytes decide. */
async function gunzip(response: Response): Promise<ArrayBuffer> {
  const bytes = await response.arrayBuffer();
  const head = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
  if (head[0] !== 0x1f || head[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

const tables = new Map<string, Promise<Table>>();

export function loadTable(base: string, file: string): Promise<Table> {
  const url = base + file;
  let pending = tables.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${url}`);
        return gunzip(response);
      })
      .then(decodeTable);
    pending.catch(() => tables.delete(url));
    tables.set(url, pending);
  }
  return pending;
}

export async function loadManifest(base: string): Promise<Manifest> {
  const response = await fetch(`${base}manifest.json`);
  if (!response.ok) throw new Error(`${response.status} manifest`);
  return response.json();
}
