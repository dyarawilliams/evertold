import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Express } from "express";

export async function withServer(
  app: Express,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("Expected the test server to listen on a TCP port.");
  }

  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}
