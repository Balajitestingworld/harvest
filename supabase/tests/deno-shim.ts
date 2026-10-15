/**
 * Lets the Deno edge functions run under Node for tests: provides Deno.env and
 * a Deno.serve that just remembers the handler so tests can call it directly.
 */
export type Handler = (req: Request) => Response | Promise<Response>;
let last: Handler | null = null;

(globalThis as any).Deno = {
  env: { get: (k: string) => process.env[k] },
  serve: (h: Handler) => {
    last = h;
    return {};
  },
};

/** Import a function module and return the handler it registered. */
export async function loadFunction(path: string): Promise<Handler> {
  last = null;
  await import(path);
  if (!last) throw new Error(`${path} did not call Deno.serve`);
  return last;
}
