/**
 * Cloudflare Pages Functions Types
 * These types are provided at runtime by Cloudflare
 */

interface Env {
  PRERENDER_TOKEN?: string;
}

type PagesFunction<E = unknown> = (context: EventContext<E>) => Response | Promise<Response>;

interface EventContext<E = unknown> {
  request: Request;
  functionPath: string;
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  env: E;
  params: Record<string, string>;
  data: unknown;
}
