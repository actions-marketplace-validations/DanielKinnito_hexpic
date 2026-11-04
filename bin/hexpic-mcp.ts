#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from '../src/mcp/server';

async function main() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('HexPic MCP server running on stdio\n');
}

main().catch((error) => {
  process.stderr.write(`Fatal error in HexPic MCP server: ${error}\n`);
  process.exit(1);
});
