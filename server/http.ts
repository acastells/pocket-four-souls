import type { IncomingMessage, ServerResponse } from "node:http";
import { ApiError, roomRequestSchema } from "./contracts";
import { RoomService } from "./room-service";
const MAX_BODY_BYTES = 16 * 1024;

export async function handleRoomRequest(
  req: IncomingMessage,
  res: ServerResponse,
  service: RoomService,
): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      throw new ApiError(405, "Usa POST");
    }
    if (req.headers.origin) {
      let origin: URL;
      try {
        origin = new URL(req.headers.origin);
      } catch {
        throw new ApiError(403, "Origen no válido");
      }
      if (
        !["http:", "https:"].includes(origin.protocol) ||
        origin.host !== req.headers.host
      )
        throw new ApiError(403, "Origen no válido");
    }
    if (!req.headers["content-type"]?.startsWith("application/json"))
      throw new ApiError(415, "Se requiere JSON");
    const token =
      /^Bearer (.+)$/.exec(req.headers.authorization || "")?.[1] || "";
    let length = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      const bytes = Buffer.from(chunk);
      length += bytes.length;
      if (length <= MAX_BODY_BYTES) chunks.push(bytes);
    }
    if (length > MAX_BODY_BYTES)
      throw new ApiError(413, "Petición demasiado grande");
    let body: unknown;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new ApiError(400, "JSON no válido");
    }
    const parsed = roomRequestSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, "Petición no válida");
    send(res, 200, service.execute(parsed.data, token));
  } catch (error) {
    if (error instanceof ApiError)
      send(res, error.status, { error: error.message });
    else {
      console.error("Room request failed:", error);
      send(res, 500, { error: "Error interno del servidor" });
    }
  }
}
function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}
