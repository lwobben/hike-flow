import { readFile } from "fs/promises";
import { resolve } from "path";

export async function GET() {
  const data = await readFile(resolve(process.cwd(), "data/graph.json"), "utf8");
  return new Response(data, { headers: { "Content-Type": "application/json" } });
}
