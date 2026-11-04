import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  convertImageSchema,
  analyzeSpatialLayoutSchema,
  handleConvertImage,
  handleAnalyzeSpatialLayout,
  handleGetPresets
} from './tools';

/**
 * Creates and configures the HexPic Model Context Protocol (MCP) server.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'hexpic',
    version: '0.2.0'
  });

  server.tool(
    'convert_image',
    'Converts an image (file path, URL, or base64 data URI) into ASCII art with studio-quality error-diffusion dithering, edge convolution, and color HTML support.',
    convertImageSchema,
    async (args) => handleConvertImage(args)
  );

  server.tool(
    'analyze_spatial_layout',
    'Analyzes image visual composition, returning an ASCII contour map and spatial density distribution across quadrants to help LLMs understand image structure without high vision token costs.',
    analyzeSpatialLayoutSchema,
    async (args) => handleAnalyzeSpatialLayout(args)
  );

  server.tool(
    'get_presets',
    'Lists available character sets, dithering algorithms, and use-case recommendations for HexPic.',
    {},
    async () => handleGetPresets()
  );

  return server;
}

