const esbuild = require('esbuild');
const { readdirSync, statSync } = require('fs');
const { join } = require('path');

function findTsFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...findTsFiles(full));
    } else if (full.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

esbuild.buildSync({
  entryPoints: findTsFiles('src'),
  outdir: 'dist',
  outbase: 'src',
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
});

console.log('Backend build complete');
