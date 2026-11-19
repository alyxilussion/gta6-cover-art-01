// Vice Cover Studio — the entry program (Node 22, standard library only).
//
// The app itself is plain static files in app/ (index.html + ES modules,
// OFL fonts, sample photos; no build step, no network request). This program
// hands it in: it copies app/ and screenshots/ beside this file into the
// output directory and writes /output/dossier.json with the vendored
// make.fun library, which is the summary the judge reads.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader MAKEFUN_OUTPUT_DIR is unset and /output is used.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Clear the output directory's CONTENTS only — never the directory itself,
// so a read-only parent or a mounted /output cannot break the run.
function clearContents(dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const entry of readdirSync(dir)) {
    rmSync(join(dir, entry), { recursive: true, force: true });
  }
}

function copyTree(from: string, to: string): void {
  if (!existsSync(from)) return;
  cpSync(from, to, { recursive: true });
}

clearContents(outDir);
copyTree(join(repoRoot, 'app'), join(outDir, 'app'));
copyTree(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));

// The scorer's own caps (reference/gate.json): text_max_bytes shapes the
// dossier text; the rest refuse an entry the scorer would refuse — at most
// 4 screenshots, each at most 256 KiB; app/ at most 993 files and 48 MiB
// in all, no path under app/ over 1000 bytes.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
