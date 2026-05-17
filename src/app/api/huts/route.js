import { readFile } from "fs/promises";
import { resolve } from "path";

export async function GET() {
  const data = await readFile(resolve(process.cwd(), "data/huts.json"), "utf8");
  return new Response(data, { headers: { "Content-Type": "application/json" } });
}
