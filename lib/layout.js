/**
 * 根据文件列表构建分组结构：
 * { [groupName]: FileMeta[] }
 */
function buildGroups(files) {
  const groups = {};
  for (const f of files) {
    const key = f.group || '未分组';
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  }
  return groups;
}

function getSortTimeMs(file) {
  return Number(file?.nameTimeMs) || Number(file?.modifiedTimeMs) || 0;
}

function sortByLatest(a, b) {
  const timeDiff = getSortTimeMs(b) - getSortTimeMs(a);
  if (timeDiff !== 0) return timeDiff;
  return a.name.localeCompare(b.name, 'zh-CN');
}

/**
 * 生成主布局 HTML（包含侧边栏 + 预览区）。
 *
 * @param {Object} options
 * @param {Array}  options.files        - 所有 HTML 文件元信息
 * @param {Function} options.getFileById - 通过 id 获取文件
 * @param {number} options.selectedId    - 当前选中的文件 id
 */
function renderLayout({
  files,
  getFileById,
  selectedId,
  buildViewHref = (file) => `/view/${file.id}`,
  buildRawHref = (file) => `/raw/${file.id}`,
  modeLabel = 'SSR',
  previewLabel = 'Server Render',
}) {
  if (!files || !files.length) {
    return '<h1>data 目录下没有找到任何 HTML 文件</h1>';
  }

  const groups = buildGroups(files);
  const sortedGroupNames = Object.keys(groups).sort((a, b) => {
    const latestA = groups[a].reduce((latest, file) => Math.max(latest, getSortTimeMs(file)), 0);
    const latestB = groups[b].reduce((latest, file) => Math.max(latest, getSortTimeMs(file)), 0);
    const timeDiff = latestB - latestA;
    if (timeDiff !== 0) return timeDiff;
    return a.localeCompare(b, 'zh-CN');
  });
  const firstSortedFile = sortedGroupNames.length
    ? groups[sortedGroupNames[0]].slice().sort(sortByLatest)[0]
    : files[0];

  const selectedFile = getFileById(selectedId) || firstSortedFile || files[0];
  const currentId = selectedFile ? selectedFile.id : null;

  const sidebarHtml = (sortedGroupNames || [])
    .map((groupName) => {
      const items = groups[groupName]
        .slice()
        .sort(sortByLatest)
        .map((f) => {
          const activeClass = f.id === currentId ? 'active' : '';
          const displayName = f.name.replace(/\.html$/i, '');
          return `<li class="${activeClass}">
  <a class="file-link" href="${buildViewHref(f)}" target="_self">
    <span class="file-icon">H</span>
    <span class="file-name">${displayName}</span>
  </a>
</li>`;
        })
        .join('');

      return `<div class="group">
  <div class="group-title">
    <span class="group-title-dot"></span>
    <span>${groupName}</span>
  </div>
  <ul class="file-list">
    ${items}
  </ul>
</div>`;
    })
    .join('');

  const iframeSrc = selectedFile ? buildRawHref(selectedFile) : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>AI_TEXT 手册预览</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      display: flex;
      height: 100vh;
      color: #111827;
      background: radial-gradient(circle at top left, #0f172a 0, #020617 40%, #020617 100%);
    }
    .sidebar {
      width: 320px;
      background: rgba(15, 23, 42, 0.98);
      backdrop-filter: blur(18px);
      color: #e5e7eb;
      padding: 16px 14px 18px;
      border-right: 1px solid rgba(55, 65, 81, 0.7);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .brand-logo {
      width: 26px;
      height: 26px;
      border-radius: 8px;
      background: radial-gradient(circle at 20% 0, #38bdf8 0, #1d4ed8 45%, #4f46e5 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.9), 0 12px 30px rgba(15, 23, 42, 0.9);
    }
    .brand-logo span {
      font-size: 14px;
      font-weight: 700;
      color: #e5e7eb;
    }
    .brand-text-main {
      font-size: 15px;
      font-weight: 600;
    }
    .brand-text-sub {
      font-size: 11px;
      color: #9ca3af;
    }
    .badge {
      padding: 2px 7px;
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.6);
      font-size: 10px;
      color: #e5e7eb;
      background: radial-gradient(circle at top, rgba(148, 163, 184, 0.4), rgba(15, 23, 42, 0.4));
    }
    .search {
      position: relative;
      margin-bottom: 6px;
    }
    .search input {
      width: 100%;
      padding: 7px 8px 7px 26px;
      border-radius: 8px;
      border: 1px solid rgba(55, 65, 81, 0.9);
      background: rgba(15, 23, 42, 0.9);
      color: #e5e7eb;
      font-size: 12px;
      outline: none;
      transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
    }
    .search input::placeholder {
      color: #6b7280;
    }
    .search input:focus {
      border-color: #3b82f6;
      background: rgba(15, 23, 42, 0.98);
      box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.6);
    }
    .search-icon {
      position: absolute;
      left: 8px;
      top: 50%;
      transform: translateY(-50%);
      width: 12px;
      height: 12px;
      color: #6b7280;
    }
    .sidebar-body {
      flex: 1;
      overflow-y: auto;
      padding-right: 4px;
      margin-right: -4px;
    }
    .sidebar-body::-webkit-scrollbar {
      width: 6px;
    }
    .sidebar-body::-webkit-scrollbar-track {
      background: transparent;
    }
    .sidebar-body::-webkit-scrollbar-thumb {
      background: rgba(55, 65, 81, 0.9);
      border-radius: 999px;
    }
    .group {
      margin-bottom: 14px;
    }
    .group-title {
      font-size: 12px;
      font-weight: 600;
      color: #9ca3af;
      margin-bottom: 6px;
      text-transform: none;
      letter-spacing: 0.02em;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .group-title-dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: linear-gradient(to right, #4f46e5, #22c55e);
      box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.9);
    }
    .file-list {
      list-style: none;
    }
    .file-list li {
      margin-bottom: 3px;
    }
    .file-link {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 8px;
      font-size: 12px;
      color: #e5e7eb;
      text-decoration: none;
      border-radius: 6px;
      border: 1px solid transparent;
      transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.08s ease;
      cursor: pointer;
    }
    .file-icon {
      width: 14px;
      height: 14px;
      border-radius: 4px;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(55, 65, 81, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      color: #9ca3af;
    }
    .file-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .file-list li.active .file-link {
      background: linear-gradient(90deg, #1d4ed8, #4f46e5);
      border-color: rgba(59, 130, 246, 0.9);
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.75);
      transform: translateY(-0.5px);
    }
    .file-list li.active .file-icon {
      background: rgba(15, 23, 42, 0.9);
      color: #e5e7eb;
      border-color: transparent;
    }
    .file-link:hover {
      background: rgba(31, 41, 55, 0.95);
      border-color: rgba(55, 65, 81, 0.9);
      transform: translateY(-0.5px);
    }
    .file-list li.active .file-link:hover {
      background: linear-gradient(90deg, #1d4ed8, #4f46e5);
    }
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: radial-gradient(circle at top right, #1e293b 0, #020617 40%);
    }
    .main-header {
      padding: 9px 12px;
      border-bottom: 1px solid rgba(31, 41, 55, 0.9);
      color: #e5e7eb;
      font-size: 13px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .main-header-title {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .main-header-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: radial-gradient(circle at center, #22c55e, #16a34a);
      box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.9);
    }
    .main-header .path {
      color: #9ca3af;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 11px;
      background: rgba(15, 23, 42, 0.9);
      border-radius: 999px;
      padding: 3px 8px;
      border: 1px solid rgba(31, 41, 55, 0.9);
      max-width: 60%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .open-link {
      color: #e5e7eb;
      font-size: 11px;
      text-decoration: none;
      border: 1px solid rgba(55, 65, 81, 0.9);
      border-radius: 999px;
      padding: 3px 10px;
      background: rgba(15, 23, 42, 0.9);
    }
    .open-link:hover {
      background: rgba(31, 41, 55, 0.95);
      border-color: rgba(75, 85, 99, 0.95);
    }
    .main-body {
      flex: 1;
      padding: 10px;
    }
    .preview-card {
      width: 100%;
      height: 100%;
      border-radius: 14px;
      background: radial-gradient(circle at top left, #111827 0, #020617 55%);
      border: 1px solid rgba(31, 41, 55, 0.95);
      box-shadow:
        0 20px 45px rgba(15, 23, 42, 1),
        0 0 0 1px rgba(15, 23, 42, 0.9);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    iframe {
      flex: 1;
      width: 100%;
      border: none;
      background: white;
    }
    .empty {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #9ca3af;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="sidebar">
    <div class="sidebar-header">
      <div class="brand">
        <div class="brand-logo"><span>AI</span></div>
        <div>
          <div class="brand-text-main">破局行动 · 手册库</div>
          <div class="brand-text-sub">本地 HTML 预览面板</div>
        </div>
      </div>
      <div class="badge">${modeLabel}</div>
    </div>
    <div class="search">
      <span class="search-icon">
        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9.16667 3.33331C5.945 3.33331 3.33333 5.94498 3.33333 9.16665C3.33333 12.3883 5.945 15 9.16667 15C12.3883 15 15 12.3883 15 9.16665C15 5.94498 12.3883 3.33331 9.16667 3.33331ZM2.5 9.16665C2.5 5.48475 5.48477 2.49998 9.16667 2.49998C12.8486 2.49998 15.8333 5.48475 15.8333 9.16665C15.8333 10.7932 15.2862 12.2903 14.3631 13.491L17.6026 16.7305C17.7639 16.8918 17.7639 17.1541 17.6026 17.3154C17.4413 17.4767 17.179 17.4767 17.0177 17.3154L13.7781 14.0758C12.5774 14.999 11.0803 15.546 9.45379 15.546C5.77189 15.546 2.78712 12.5612 2.78712 8.87931H2.5V9.16665Z" fill="currentColor" />
        </svg>
      </span>
      <input
        type="text"
        placeholder="这里暂时只是装饰搜索框（后续可做真实过滤）"
        disabled
      />
    </div>
    <div class="sidebar-body">
      ${sidebarHtml || '<div style="font-size:13px;color:#9ca3af;">未找到任何 HTML 文件</div>'}
    </div>
  </div>
  <div class="main">
    <div class="main-header">
      <div class="main-header-title">
        <div class="main-header-dot"></div>
        <div>HTML 预览 · ${previewLabel}</div>
      </div>
      ${iframeSrc ? `<a class="open-link" href="${iframeSrc}" target="_blank" rel="noopener noreferrer">Open in new tab</a>` : ''}
      <div class="path">${selectedFile ? selectedFile.relPath : ''}</div>
    </div>
    <div class="main-body">
      <div class="preview-card">
        ${
          iframeSrc
            ? `<iframe src="${iframeSrc}" title="HTML 预览"></iframe>`
            : '<div class="empty">暂无可预览文件</div>'
        }
      </div>
    </div>
  </div>
</body>
</html>`;
}

module.exports = {
  renderLayout,
};

