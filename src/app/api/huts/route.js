import huts from "../../../../data/huts-combined.json";

export async function GET() {
  return Response.json(huts);
}
