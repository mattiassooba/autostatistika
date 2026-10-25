import { allSliceKeys, getGeneration, getSlice } from "@/lib/data/store";
import { generationId, isSliceKey } from "@/lib/data/slices";

// GET /data/<generation>/<kind>/<arg>.json, written as static files at build
// time (one per slice key, see allSliceKeys). The generation segment changes
// with every published bundle, so cached files never mix two generations.
export const dynamic = "force-static";
export const dynamicParams = false;

type Params = { generation: string; kind: string; file: string };

export async function generateStaticParams(): Promise<Params[]> {
  const generation = generationId(await getGeneration());
  return (await allSliceKeys()).map((key) => {
    const [kind, arg] = key.split(":");
    return { generation, kind, file: `${arg}.json` };
  });
}

export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const { kind, file } = await params;
  const key = `${kind}:${file.replace(/\.json$/, "")}`;
  const slice = isSliceKey(key) ? await getSlice(key) : null;
  if (!slice) return Response.json({ error: "Unknown slice" }, { status: 404 });
  return Response.json(slice);
}
