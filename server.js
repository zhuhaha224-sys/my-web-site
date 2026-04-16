const path = require('path');
const express = require('express');
const { buildIndex } = require('./lib/fileIndex');
const { renderLayout } = require('./lib/layout');

const app = express();
const PORT = process.env.PORT || 3000;

// data 目录根路径
const dataRoot = path.join(__dirname, 'data');

// 启动时构建一次 HTML 文件索引
const { files: htmlFiles, getFileById } = buildIndex(dataRoot);
const getLatestFile = () =>
  htmlFiles
    .slice()
    .sort(
      (a, b) =>
        (Number(b.nameTimeMs) || Number(b.modifiedTimeMs) || 0) -
        (Number(a.nameTimeMs) || Number(a.modifiedTimeMs) || 0)
    )[0];

// 首页：默认展示第一个文件
app.get('/', (req, res) => {
  if (!htmlFiles.length) {
    return res.status(200).send('<h1>data 目录下没有找到任何 HTML 文件</h1>');
  }
  const latestFile = getLatestFile();
  const html = renderLayout({
    files: htmlFiles,
    getFileById,
    selectedId: latestFile ? latestFile.id : htmlFiles[0].id,
  });
  res.send(html);
});

// 切换查看某个文件（通过 id）
app.get('/view/:id', (req, res) => {
  if (!htmlFiles.length) {
    return res.status(200).send('<h1>data 目录下没有找到任何 HTML 文件</h1>');
  }
  const id = Number(req.params.id);
  const file = getFileById(id);
  if (!file) {
    return res.status(404).send('未找到对应文件');
  }
  const html = renderLayout({
    files: htmlFiles,
    getFileById,
    selectedId: file.id,
  });
  res.send(html);
});

// 真实 HTML 内容，给 iframe 用
app.get('/raw/:id', (req, res) => {
  const id = Number(req.params.id);
  const file = getFileById(id);
  if (!file) {
    return res.status(404).send('未找到对应文件');
  }
  const absPath = path.join(dataRoot, file.relPath);
  res.sendFile(absPath, (err) => {
    if (err) {
      console.error('发送 HTML 文件失败:', err);
    }
  });
});

app.listen(PORT, () => {
  console.log(`SSR 文件预览服务已启动: http://localhost:${PORT}`);
});

