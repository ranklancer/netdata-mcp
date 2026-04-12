# @ranklancer/netdata-mcp

MCP server for [Netdata](https://www.netdata.cloud/) monitoring.

## Tools

- `get_system_info` — System version, OS, host details
- `list_alarms` — All alarms with current status
- `get_alarm_history` — Alarm history log
- `list_charts` — Available charts/metrics catalog
- `get_chart_data` — Time-series data for a specific chart
- `get_all_metrics` — Current values of all metrics
- `get_system_overview` — CPU, RAM, disk, network in one call

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NETDATA_URL` | `http://localhost:19999` | Netdata API base URL |

## Usage (stdio)

```bash
npm install && npm run build
node dist/index.js
```

## Usage (StreamableHTTP via supergateway)

```bash
npx supergateway --stdio "node dist/index.js" --port 8000 --healthEndpoint /health --outputTransport streamableHttp
```

## License

MIT
