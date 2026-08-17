import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

/**
 * Compile un module TypeScript réel du dossier `src/` (avec ses imports relatifs
 * bundlés) et l'importe tel quel, afin que les tests exercent le VRAI code
 * source de l'extension plutôt qu'une réimplémentation simplifiée.
 *
 * @param {string} relativeSrcPath chemin relatif depuis chrome-extension/, ex: 'src/content/form-fingerprint.ts'
 */
export async function loadRealModule(relativeSrcPath) {
  const entryPoint = path.join(projectRoot, relativeSrcPath);

  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false,
    logLevel: 'silent',
  });

  const code = result.outputFiles[0].text;
  const dataUrl = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
  return import(dataUrl);
}
