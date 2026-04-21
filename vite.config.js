import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/**
 * Copy the version-locked PDF.js cmaps and standard fonts from
 * `node_modules/pdfjs-dist` into a known location so the runtime can fetch
 * them without depending on a public CDN. Runs in both `vite dev` (writes
 * to `public/`) and `vite build` (writes to `dist/`).
 */
function copyPdfJsAssets() {
  const pdfjsRoot = dirname(require.resolve('pdfjs-dist/package.json'));
  const cmapsSrc = resolve(pdfjsRoot, 'cmaps');
  const fontsSrc = resolve(pdfjsRoot, 'standard_fonts');

  const copyInto = (targetRoot) => {
    const cmapsDest = resolve(targetRoot, 'pdfjs', 'cmaps');
    const fontsDest = resolve(targetRoot, 'pdfjs', 'standard_fonts');

    if (existsSync(cmapsSrc)) {
      mkdirSync(cmapsDest, { recursive: true });
      cpSync(cmapsSrc, cmapsDest, { recursive: true });
    }
    if (existsSync(fontsSrc)) {
      mkdirSync(fontsDest, { recursive: true });
      cpSync(fontsSrc, fontsDest, { recursive: true });
    }
  };

  return {
    name: 'copy-pdfjs-assets',
    apply: () => true,
    buildStart() {
      // Always make assets available under `public/pdfjs/...` so dev server
      // serves them; Vite then also includes them in `dist/` automatically.
      copyInto(resolve(__dirname, 'public'));
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), copyPdfJsAssets()],
  build: {
    target: 'es2022',
    // Vite's default minifier is esbuild, which already strips whitespace,
    // removes dead code, and mangles local variable names. Set explicitly
    // here for clarity.
    minify: 'esbuild',
    // 'hidden' generates sourcemaps for error tracking but doesn't append
    // the `//# sourceMappingURL=` reference, so the shipped JS stays clean.
    // Use `true` to expose maps in the browser, or `false` to skip them.
    sourcemap: 'hidden',
  },
  optimizeDeps: {
    // pdfjs-dist ships a worker entry that Vite must not pre-bundle.
    exclude: ['pdfjs-dist/build/pdf.worker.min.mjs'],
  },
});
