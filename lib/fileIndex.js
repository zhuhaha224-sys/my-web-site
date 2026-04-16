const fs = require('fs');
const path = require('path');

/**
 * 扫描指定目录下的所有 HTML 文件，生成统一索引。
 * 返回：
 * - files: [{ id, relPath, group, name, nameTimeMs, modifiedTimeMs }]
 * - getFileById: (id) => file | undefined
 */
function parseTimeFromFileName(fileName) {
  const matches = [...fileName.matchAll(/(\d{8})_(\d{6})(?:_(\d{1,3}))?/g)];
  if (!matches.length) return 0;

  const [, ymd, hms, msRaw] = matches[matches.length - 1];
  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(4, 6)) - 1;
  const day = Number(ymd.slice(6, 8));
  const hour = Number(hms.slice(0, 2));
  const minute = Number(hms.slice(2, 4));
  const second = Number(hms.slice(4, 6));
  const ms = Number((msRaw || '0').padEnd(3, '0').slice(0, 3));

  const time = new Date(year, month, day, hour, minute, second, ms).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function extractPreferredPreviewUrl(filePath) {
  try {
    const html = fs.readFileSync(filePath, 'utf8');
    const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (!iframeMatch) return '';

    const src = iframeMatch[1].replace(/&amp;/g, '&').trim();
    if (/^https?:\/\//i.test(src)) return src;
    return '';
  } catch {
    return '';
  }
}

function buildIndex(rootDir) {
  const files = [];
  let id = 0;

  function walk(currentDir, baseDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(currentDir, entry.name);
      const rel = path.relative(baseDir, full);
      if (entry.isDirectory()) {
        walk(full, baseDir);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
        const parts = rel.split(path.sep);
        const group = parts.length > 1 ? parts[0] : '';
        const name = entry.name;
        const stat = fs.statSync(full);
        files.push({
          id: id++,
          relPath: rel,
          group,
          name,
          nameTimeMs: parseTimeFromFileName(name),
          modifiedTimeMs: stat.mtimeMs,
          preferredPreviewUrl: extractPreferredPreviewUrl(full),
        });
      }
    }
  }

  if (fs.existsSync(rootDir)) {
    walk(rootDir, rootDir);
  }

  return {
    files,
    getFileById: (fileId) => files.find((f) => f.id === fileId),
  };
}

module.exports = {
  buildIndex,
};

