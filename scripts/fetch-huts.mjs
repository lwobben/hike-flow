import { fetch as undiciFetch, Agent } from "undici";
import { writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const agent = new Agent({ connect: { rejectUnauthorized: false } });

export async function fetchHuts() {
  const res = await undiciFetch(
    "https://www.alpenverein.at/huetten/finder/huettendata.js",
    { dispatcher: agent }
  );
  const jsText = await res.text();
  await writeFile(resolve(ROOT, "huettendata.js"), jsText, "utf8");
  console.log("huettendata.js written");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await fetchHuts();
}
