/**
 * Minimal MCP (Model Context Protocol) streamable-HTTP client for NSE's
 * official MCP servers. All traffic stays server-side — never import this
 * module (or the endpoint URLs) into client components.
 *
 * Verified handshake (see workspace/research_notes/nse-mcp/report.md):
 *  1. POST initialize -> 200, plain-JSON body + `Mcp-Session-Id` response header
 *  2. POST notifications/initialized with session header -> 202
 *  3. POST tools/call with session header -> 200, SSE body (`event:message` /
 *     `data:{...}`); the result's content[0].text is itself a JSON string,
 *     so it must be parsed a second time. `isError: true` means a tool error.
 * Sessions expire; on any 4xx we re-handshake once and retry the call.
 */

const PROTOCOL_VERSION = "2025-06-18";
const REQUEST_TIMEOUT_MS = 30_000;

export class McpError extends Error {
  constructor(
    message: string,
    public readonly code: "timeout" | "unreachable" | "tool" | "protocol" | "session",
    public readonly status?: number,
  ) {
    super(message);
    this.name = "McpError";
  }
}

interface JsonRpcResponse {
  jsonrpc: string;
  id?: number | string;
  result?: {
    content?: Array<{ type: string; text?: string }>;
    isError?: boolean;
    [k: string]: unknown;
  };
  error?: { code: number; message: string; data?: unknown };
}

function parseBody(body: string): JsonRpcResponse {
  const trimmed = body.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed) as JsonRpcResponse;
  for (const line of trimmed.split("\n")) {
    const t = line.trim();
    if (t.startsWith("data:")) return JSON.parse(t.slice(5)) as JsonRpcResponse;
  }
  throw new McpError("MCP response had no parseable body", "protocol");
}

async function post(
  url: string,
  payload: unknown,
  sessionId?: string,
): Promise<{ sessionId?: string; body: string; status: number }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const body = await res.text();
    return {
      sessionId: res.headers.get("mcp-session-id") ?? undefined,
      body,
      status: res.status,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new McpError(`MCP request timed out after ${REQUEST_TIMEOUT_MS}ms`, "timeout");
    }
    throw new McpError(
      `MCP server unreachable: ${err instanceof Error ? err.message : String(err)}`,
      "unreachable",
    );
  } finally {
    clearTimeout(timer);
  }
}

let requestId = 1;

export class McpClient {
  private sessionId: string | null = null;
  private handshakePromise: Promise<void> | null = null;

  constructor(
    private readonly url: string,
    private readonly clientName = "nse-intelligence",
  ) {}

  private async handshake(): Promise<void> {
    if (this.handshakePromise) return this.handshakePromise;
    this.handshakePromise = (async () => {
      const { sessionId, body, status } = await post(this.url, {
        jsonrpc: "2.0",
        id: requestId++,
        method: "initialize",
        params: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: this.clientName, version: "1.0.0" },
        },
      });
      if (status !== 200 || !sessionId) {
        throw new McpError(`MCP initialize failed (HTTP ${status})`, "protocol", status);
      }
      // Validate the initialize payload parses (plain JSON, not SSE).
      parseBody(body);
      this.sessionId = sessionId;
      const init2 = await post(
        this.url,
        { jsonrpc: "2.0", method: "notifications/initialized" },
        sessionId,
      );
      if (init2.status !== 200 && init2.status !== 202) {
        throw new McpError(
          `MCP initialized notification failed (HTTP ${init2.status})`,
          "protocol",
          init2.status,
        );
      }
    })();
    try {
      await this.handshakePromise;
    } finally {
      this.handshakePromise = null;
    }
  }

  private async ensureSession(): Promise<string> {
    if (!this.sessionId) await this.handshake();
    return this.sessionId as string;
  }

  private invalidateSession() {
    this.sessionId = null;
  }

  /**
   * Call a tool and return the inner parsed payload (double JSON-parse applied).
   * Retries once with a fresh handshake when the session has expired (4xx).
   */
  async callTool<T = unknown>(tool: string, args: Record<string, unknown> = {}): Promise<T> {
    const attempt = async (sid: string): Promise<T> => {
      const { body, status } = await post(
        this.url,
        {
          jsonrpc: "2.0",
          id: requestId++,
          method: "tools/call",
          params: { name: tool, arguments: args },
        },
        sid,
      );
      if (status >= 400 && status < 500) {
        throw new McpError(`MCP session rejected (HTTP ${status})`, "session", status);
      }
      if (status !== 200) {
        throw new McpError(`MCP tools/call failed (HTTP ${status})`, "protocol", status);
      }
      const rpc = parseBody(body);
      if (rpc.error) {
        throw new McpError(`MCP error: ${rpc.error.message}`, "tool");
      }
      const result = rpc.result;
      if (!result) throw new McpError("MCP response had no result", "protocol");
      if (result.isError) {
        const text = result.content?.[0]?.text ?? "unknown tool error";
        // Surface "not found"-style errors so routes can map them to 404s.
        throw new McpError(text.slice(0, 500), "tool");
      }
      const text = result.content?.find((c) => c.type === "text")?.text;
      if (typeof text !== "string") throw new McpError("MCP tool returned no text", "protocol");
      return JSON.parse(text) as T;
    };

    const sid = await this.ensureSession();
    try {
      return await attempt(sid);
    } catch (err) {
      if (err instanceof McpError && err.code === "session") {
        this.invalidateSession();
        const fresh = await this.ensureSession();
        return await attempt(fresh);
      }
      throw err;
    }
  }
}

const CM_URL = process.env.NSE_CM_MCP_URL ?? "https://mcp.nseindia.in/cmmkt/mcp";
const BHAV_URL = process.env.NSE_BHAVCOPY_MCP_URL ?? "https://mcp.nseindia.in/bhavcopy/cm/mcp";

/** Live cash-market data (quotes, indices, gainers/losers). */
export const cmClient = new McpClient(CM_URL, "nse-intelligence-cm");
/** Historical EOD bhavcopy data (OHLCV history, breadth, comparisons). */
export const bhavClient = new McpClient(BHAV_URL, "nse-intelligence-bhavcopy");
