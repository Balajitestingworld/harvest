// Copies packages/core/src into supabase/functions/_shared/core so the Deno
// edge functions use exactly the same parser/schema as the app.
// Run after editing anything in packages/core:  npm run sync:core
import { cpSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'packages/core/src');
const dest = join(root, 'supabase/functions/_shared/core');

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
writeFileSync(
  join(dest, 'README.md'),
  '# Generated — do not edit\n\nCopied from packages/core/src by `npm run sync:core`.\n',
);
console.log(`Synced core → ${dest}`);
