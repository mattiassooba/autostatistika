import { getGeneration, getTrendFile, trendCategories } from "@/lib/data/store";
import { generationId } from "@/lib/data/slices";

// GET /data/<generation>/trend/<category>.json: the rows and wording the
// trend-analyst Worker needs to rebuild the page's trend statements (see
// lib/analysis/trend-file.ts). Static files, one per category with brand lists.
export const dynamic = "force-static";
export const dynamicParams = false;

type Params = { generation: string; file: string };

export async function generateStaticParams(): Promise<Params[]> {
  const generation = generationId(await getGeneration());
  return (await trendCategories()).map((category) => ({ generation, file: `${category}.json` }));
}

export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const { file } = await params;
  const trend = await getTrendFile(file.replace(/\.json$/, ""));
  if (!trend) return Response.json({ error: "Unknown category" }, { status: 404 });
  return Response.json(trend);
}
