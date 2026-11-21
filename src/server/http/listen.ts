import type { Express } from "express";
import type { Server } from "node:http";

export function listenLocalOnly(
  app: Express,
  port: number,
  callback?: () => void,
): Server {
  return app.listen(port, "127.0.0.1", callback);
}
