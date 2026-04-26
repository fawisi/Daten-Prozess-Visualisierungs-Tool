/**
 * URL aliasing for the Vite plugin's middleware. v1.1.2 introduces the
 * `/__viso-api/erd/*` namespace so ERD endpoints line up with the
 * already-namespaced `/bpmn/*` and `/landscape/*` routes. The old
 * unprefixed URLs (`/__viso-api/source`, `/positions`, `/schema`) stay
 * functional — this helper rewrites the new canonical form back to the
 * legacy URL the existing handlers still match against.
 *
 * Once all downstream consumers (Hub adapter, MCP tools, manual curl
 * users) emit the canonical `/erd/*` URLs we can flip the handlers and
 * delete the legacy aliases.
 */
export function rewriteCanonicalErdUrl(
  url: string | undefined
): string | undefined {
  if (url === '/__viso-api/erd/source') return '/__viso-api/source';
  if (url === '/__viso-api/erd/positions') return '/__viso-api/positions';
  if (url === '/__viso-api/erd/schema') return '/__viso-api/schema';
  return url;
}
