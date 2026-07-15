import type { ClientRequest } from "http";

export function forwardJsonBody(proxyReq: ClientRequest, request: any) {
  const method = String(request.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") {
    return;
  }

  const body = request.body;
  if (!body || typeof body !== "object") {
    return;
  }

  const bodyData = JSON.stringify(body);
  proxyReq.setHeader("Content-Type", "application/json");
  proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
  proxyReq.write(bodyData);
}
