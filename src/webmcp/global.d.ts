/**
 * Global type declarations for the WebMCP polyfill.
 * Extends Navigator with modelContext and modelContextTesting.
 */

import type { ModelContextCore, ModelContextTesting } from '@mcp-b/webmcp-types';

declare global {
  interface Navigator {
    modelContext: ModelContextCore;
    modelContextTesting: ModelContextTesting;
  }
}
