const fs = require('fs');
const path = require('path');
const { buildIndex } = require('./lib/fileIndex');
const { renderLayout } = require('./lib/layout');

const rootDir = __dirname;
const dataRoot = path.join(rootDir, 'data');
const outDir = path.join(rootDir, 'dist');
const viewDir = path.join(outDir, 'view');
const rawDir = path.join(outDir, 'raw');

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function getSortTimeMs(file) {
  return Number(file?.nameTimeMs) || Number(file?.modifiedTimeMs) || 0;
}

function getLatestFile(files) {
  return files
    .slice()
    .sort((a, b) => {
      const diff = getSortTimeMs(b) - getSortTimeMs(a);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, 'zh-CN');
    })[0];
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeViewPage({ file, files, getFileById, targetPath, buildViewHref, buildRawHref }) {
  const html = renderLayout({
    files,
    getFileById,
    selectedId: file ? file.id : undefined,
    buildViewHref,
    buildRawHref,
    modeLabel: 'Static',
    previewLabel: 'GitHub Pages',
  });

  ensureParentDir(targetPath);
  fs.writeFileSync(targetPath, html, 'utf8');
}

function copyRawFiles(files) {
  for (const file of files) {
    const src = path.join(dataRoot, file.relPath);
    const dest = path.join(rawDir, `${file.id}.html`);
    ensureParentDir(dest);
    fs.copyFileSync(src, dest);
  }
}

function build() {
  const { files, getFileById } = buildIndex(dataRoot);

  cleanDir(outDir);
  fs.mkdirSync(viewDir, { recursive: true });
  fs.mkdirSync(rawDir, { recursive: true });

  fs.writeFileSync(path.join(outDir, '.nojekyll'), '', 'utf8');

  if (!files.length) {
    const emptyHtml = '<!doctype html><html><head><meta charset="utf-8"><title>AI_TEXT</title></head><body><h1>data 目录下没有找到任何 HTML 文件</h1></body></html>';
    fs.writeFileSync(path.join(outDir, 'index.html'), emptyHtml, 'utf8');
    console.log('No HTML files found in data/, created empty dist/index.html');
    return;
  }

  copyRawFiles(files);

  const latestFile = getLatestFile(files);

  writeViewPage({
    file: latestFile,
    files,
    getFileById,
    targetPath: path.join(outDir, 'index.html'),
    buildViewHref: (f) => `view/${f.id}.html`,
    buildRawHref: (f) => f.preferredPreviewUrl || `raw/${f.id}.html`,
  });

  for (const file of files) {
    writeViewPage({
      file,
      files,
      getFileById,
      targetPath: path.join(viewDir, `${file.id}.html`),
      buildViewHref: (f) => `${f.id}.html`,
      buildRawHref: (f) => f.preferredPreviewUrl || `../raw/${f.id}.html`,
    });
  }

  console.log(`Build complete: ${files.length} files exported to dist/`);
}

build();
