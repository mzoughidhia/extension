import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWatch = process.argv.includes('--watch');

const entryPoints = [
  'src/background/service-worker.ts',
  'src/content/content-script.ts',
  'src/sidepanel/sidepanel.ts',
  'src/popup/popup.ts',
];

async function copyStaticAssets() {
  const dirs = ['sidepanel', 'popup'];
  for (const dir of dirs) {
    const srcDir = path.join(__dirname, 'src', dir);
    const destDir = path.join(__dirname, 'dist', dir);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    const files = fs.readdirSync(srcDir);
    for (const file of files) {
      if (file.endsWith('.html') || file.endsWith('.css')) {
        fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
      }
    }
  }

  // Copier le manifest.json à la racine de dist ou vérifier sa présence
  const manifestSrc = path.join(__dirname, 'manifest.json');
  const manifestDest = path.join(__dirname, 'dist', 'manifest.json');
  if (!fs.existsSync(path.join(__dirname, 'dist'))) {
    fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
  }
  fs.copyFileSync(manifestSrc, manifestDest);
  console.log('✅ Assets statiques copiés.');
}

async function build() {
  await copyStaticAssets();

  const ctx = await esbuild.context({
    entryPoints,
    bundle: true,
    outdir: 'dist',
    format: 'esm',
    target: 'es2022',
    sourcemap: true,
    platform: 'browser',
  });

  if (isWatch) {
    await ctx.watch();
    console.log('👀 En attente de modifications (mode watch)...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log('🚀 Build de l\'extension Chrome terminé avec succès dans chrome-extension/dist/.');
  }
}

build().catch((err) => {
  console.error('❌ Erreur de build :', err);
  process.exit(1);
});
