/** Claude call used by the ingest job for banners the regex parser can't read. */
const KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = Deno.env.get('LLM_MODEL') ?? 'claude-haiku-5-5';

export const llmAvailable = !!KEY;

export async function callClaude(system: string, user: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 400, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}`);
  const data = await res.json();
  return String(data?.content?.[0]?.text ?? '');
}
