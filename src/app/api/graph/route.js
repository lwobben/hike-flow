import { readFile } from "fs/promises";
import { buildGraph } from "@/lib/buildGraph";

export async function GET() {
  let data;
  try {
    data = await readFile("graph.json", "utf8");
  } catch {
    const edges = await buildGraph();
    data = JSON.stringify(edges);
  }
  return new Response(data, { headers: { "Content-Type": "application/json" } });
}
