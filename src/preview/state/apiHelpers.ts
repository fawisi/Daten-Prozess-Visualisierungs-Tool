/**
 * Tiny helpers shared between the ERD + BPMN sync hooks to forward the
 * Authorization header from ApiConfig and resolve same-origin WebSocket
 * paths into absolute URLs when the hub proxy returns a full URL.
 */
export function authInit(authHeader: string | undefined): RequestInit | undefined {
  if (!authHeader) return undefined;
  return { headers: { Authorization: authHeader } };
}

export function resolveWsUrl(
  wsPath: string,
  pageProtocol: string
): string {
  if (/^wss?:\/\//.test(wsPath)) return wsPath;
  if (/^https?:\/\//.test(wsPath)) return wsPath.replace(/^http/, 'ws');
  const protocol = pageProtocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${wsPath}`;
}
