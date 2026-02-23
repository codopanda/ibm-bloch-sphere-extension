import { build, context } from 'esbuild';
import { cp, mkdir } from 'fs/promises';
import { watch } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outdir = path.join(projectRoot, 'dist');
const watchMode = process.argv.includes('--watch');

const entryPoints = {
  'content/index': path.join(projectRoot, 'src/content/index.ts'),
  'background': path.join(projectRoot, 'src/background.ts'),
  'popup/index': path.join(projectRoot, 'src/popup/index.ts')
};

const staticEntries = [
  { from: path.join(projectRoot, 'manifest.json'), to: path.join(outdir, 'manifest.json') },
  { from: path.join(projectRoot, 'src/popup/index.html'), to: path.join(outdir, 'popup/index.html') },
  { from: path.join(projectRoot, 'icons'), to: path.join(outdir, 'icons') }
];

const buildOptions = {
  entryPoints,
  bundle: true,
  sourcemap: true,
  target: 'chrome114',
  format: 'esm',
  outdir,
  loader: { '.ts': 'ts' },
  logLevel: 'info'
};

async function copyStatic() {
  await mkdir(outdir, { recursive: true });
  for (const { from, to } of staticEntries) {
    await mkdir(path.dirname(to), { recursive: true });
    await cp(from, to, { recursive: true });
  }
}

function watchStaticFiles() {
  for (const entry of staticEntries) {
    watch(entry.from, {}, debounce(() => {
      cp(entry.from, entry.to, { recursive: true }).catch((error) => {
        console.error('Failed to copy static asset', entry.from, error);
      });
    }));
  }
}

function debounce(fn, delay = 100) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

async function run() {
  if (watchMode) {
    const ctx = await context(buildOptions);
    await ctx.watch();
    await copyStatic();
    watchStaticFiles();
    console.log('Watching for changes...');
  } else {
    await build(buildOptions);
    await copyStatic();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
