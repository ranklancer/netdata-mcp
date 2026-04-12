#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const NETDATA_URL = process.env.NETDATA_URL || "http://localhost:19999";

async function fetchNetdata(endpoint: string): Promise<any> {
  const url = `${NETDATA_URL}${endpoint}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

const server = new Server(
  { name: "netdata-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_system_info",
      description: "Get Netdata system information including version, OS, and host details",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "list_alarms",
      description: "List all alarms and alerts with their current status",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "get_alarm_history",
      description: "Get alarm history log",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "list_charts",
      description: "List all available charts and metrics in the Netdata instance",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "get_chart_data",
      description: "Get metric data for a specific chart. Use negative 'after' for relative time (e.g., -3600 for last hour).",
      inputSchema: {
        type: "object",
        properties: {
          chart: { type: "string", description: "Chart ID (e.g., 'system.cpu', 'system.ram', 'disk_space._')" },
          after: { type: "number", description: "Start time: negative = seconds ago (e.g., -3600), positive = unix timestamp" },
          before: { type: "number", description: "End time (optional, default: 0 = now)" },
          points: { type: "number", description: "Number of data points (optional)" },
          dimensions: { type: "string", description: "Comma-separated dimension names to filter (optional)" },
        },
        required: ["chart", "after"],
      },
    },
    {
      name: "get_all_metrics",
      description: "Get current values of all metrics (large response). Use sparingly.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "get_system_overview",
      description: "Get CPU, RAM, disk, and network stats in one call",
      inputSchema: {
        type: "object",
        properties: {
          seconds_ago: { type: "number", description: "How many seconds of history (default: 300 = 5min)" },
          points: { type: "number", description: "Data points per chart (default: 10)" },
        },
        required: [],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_system_info": {
        const data = await fetchNetdata("/api/v1/info");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "list_alarms": {
        const data = await fetchNetdata("/api/v1/alarms?all=1");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "get_alarm_history": {
        const data = await fetchNetdata("/api/v1/alarm_log?source=*");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "list_charts": {
        const data = await fetchNetdata("/api/v1/charts");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "get_chart_data": {
        const { chart, after, before, points, dimensions } = args as any;
        const params = new URLSearchParams({ chart, after: String(after), format: "json" });
        if (before !== undefined) params.append("before", String(before));
        if (points !== undefined) params.append("points", String(points));
        if (dimensions) params.append("dimensions", dimensions);
        const data = await fetchNetdata(`/api/v1/data?${params}`);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "get_all_metrics": {
        const data = await fetchNetdata("/api/v1/allmetrics?format=json");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "get_system_overview": {
        const secs = (args as any)?.seconds_ago || 300;
        const pts = (args as any)?.points || 10;
        const q = (c: string) => `/api/v1/data?chart=${c}&after=-${secs}&points=${pts}&format=json`;
        const [cpu, ram, disk, net] = await Promise.all([
          fetchNetdata(q("system.cpu")).catch((e: Error) => ({ error: e.message })),
          fetchNetdata(q("system.ram")).catch((e: Error) => ({ error: e.message })),
          fetchNetdata(q("disk_space._")).catch((e: Error) => ({ error: e.message })),
          fetchNetdata(q("system.net")).catch((e: Error) => ({ error: e.message })),
        ]);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ cpu, ram, disk, network: net, seconds_ago: secs, points: pts }, null, 2),
          }],
        };
      }

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Netdata MCP server started (Netdata URL: ${NETDATA_URL})`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
