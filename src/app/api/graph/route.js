import { readFile } from "fs/promises";

export async function GET() {
  const data = await readFile("graph.json", "utf8");
  return new Response(data, { headers: { "Content-Type": "application/json" } });
}
