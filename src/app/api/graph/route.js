import graph from "../../../../data/graph.json";

export async function GET() {
  return Response.json(graph);
}
