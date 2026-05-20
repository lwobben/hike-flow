import huts from "../../../../data/huts.json";

export async function GET() {
  return Response.json(huts);
}
