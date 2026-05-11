import { buildGraph } from "@/lib/buildGraph";

export async function GET() {
  const edges = await buildGraph();
  return new Response(
    JSON.stringify({ done: true, edges: edges.length }),
    { headers: { "Content-Type": "application/json" } }
  );
}
