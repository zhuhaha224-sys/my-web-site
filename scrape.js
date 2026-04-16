const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  baseUrl: 'https://aipoju.com/past-actions',
  userDataDirName: 'chrome-user-data',
  headless: false,
  slowMo: 0,
  viewport: { width: 1280, height: 800 },
  defaultTimeoutMs: 30000,
  gotoTimeoutMs: 60000,
  dropdownVisibleTimeoutMs: 15000,
};

function safeFilename(input) {
  return String(input)
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function timestampString() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
    '_',
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
    String(d.getSeconds()).padStart(2, '0'),
    '_',
    String(d.getMilliseconds()).padStart(3, '0'),
  ].join('');
}

function uniqueHtmlName(prefix = 'page', subDirName = '') {
  const ts = timestampString();
  const fileName = `${safeFilename(prefix)}_${ts}.html`;
  const parts = ['data'];
  const dir = safeFilename(subDirName);
  if (dir) parts.push(dir);
  parts.push(fileName);
  return path.join(...parts);
}

async function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
}

async function savePageHtml(page, filename) {
  const html = await page.content();
  const out = filename || uniqueHtmlName('manual');
  await ensureDirForFile(out);
  await fs.promises.writeFile(out, html, 'utf8');
  console.log(`HTML 已保存到: ${out}`);
  return path.resolve(out);
}

async function gotoBase(page) {
  await page.goto(CONFIG.baseUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.gotoTimeoutMs });
}

function getSelectLocators(page) {
  const select = page.locator('.between-flex .ant-select').first();
  const dropdown = page.locator('.ant-select-dropdown:visible');
  const dropdownItems = dropdown.locator('.ant-select-item');
  return { select, dropdown, dropdownItems };
}

async function openFilterDropdown(page) {
  const { select, dropdown } = getSelectLocators(page);
  await select.click();
  await dropdown.waitFor({ state: 'visible', timeout: CONFIG.dropdownVisibleTimeoutMs });
  return getSelectLocators(page);
}

async function chooseOptionByIndex(page, optIdx) {
  const { dropdownItems } = await openFilterDropdown(page);
  const opt = dropdownItems.nth(optIdx);
  const rawText = (await opt.innerText().catch(() => `opt_${optIdx}`)) || `opt_${optIdx}`;
  const optText = safeFilename(rawText);
  await opt.click();
  return optText;
}

function getCardsLocator(page) {
  return page.locator('.pc-layout-content .ant-list .ant-row .ant-col');
}

async function clickAndMaybeNewPage({ page, context, clickLocator, timeoutMs }) {
  const newPagePromise = context.waitForEvent('page', { timeout: timeoutMs }).catch(() => null);
  await clickLocator.click({ timeout: timeoutMs });
  const newPage = await newPagePromise;
  if (!newPage) return page;
  await newPage.waitForLoadState('domcontentloaded', { timeout: timeoutMs }).catch(() => {});
  return newPage;
}

async function openHandbookFromCard({ page, context, optIdx, cardIdx }) {
  await gotoBase(page);
  await page.waitForTimeout(500);
  const optText = await chooseOptionByIndex(page, optIdx);

  const cards = getCardsLocator(page);
  await cards.first().waitFor({ state: 'visible', timeout: CONFIG.defaultTimeoutMs });
  const cardCount = await cards.count();
  if (cardIdx >= cardCount) return null;

  const card = cards.nth(cardIdx);
  const title = await card.locator('.truncate').first().innerText().catch(() => `card_${cardIdx}`);
  console.log(`当前标题: ${title}`);

  // 1) “查看详情”可能弹窗/新页，也可能仍在当前页
  const detailEntry = card.locator('text=查看详情').first();
  const detailPage = await clickAndMaybeNewPage({
    page,
    context,
    clickLocator: detailEntry,
    timeoutMs: CONFIG.defaultTimeoutMs,
  });

  // 2) “手册/详情”按钮（.font-1）同样可能打开新页
  await detailPage.waitForTimeout(800);
  const handbookBtn = detailPage.locator('.font-1').first();
  const handbookPage = await clickAndMaybeNewPage({
    page: detailPage,
    context,
    clickLocator: handbookBtn,
    timeoutMs: CONFIG.defaultTimeoutMs,
  });

  await handbookPage.waitForTimeout(1200);
  const outPath = uniqueHtmlName(`${title}_${cardIdx + 1}`, optText);
  await savePageHtml(handbookPage, outPath);

  // 如果是新开的页，尽量关掉，避免越开越多
  if (handbookPage !== detailPage) await handbookPage.close().catch(() => {});
  if (detailPage !== page) await detailPage.close().catch(() => {});

  return { title, optText };
}

(async () => {
  // 指定一个固定的用户数据目录，用来保存登录态
  const userDataDir = path.resolve(__dirname, CONFIG.userDataDirName);

  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: CONFIG.chromePath,
    headless: CONFIG.headless,
    // slowMo 会让每一步都“刻意变慢”，需要速度就关掉
    slowMo: CONFIG.slowMo,
    viewport: CONFIG.viewport,
  });

  const page = context.pages().length ? context.pages()[0] : await context.newPage();
  context.setDefaultTimeout(CONFIG.defaultTimeoutMs);

  console.log('正在打开浏览器并访问页面...');
  await gotoBase(page);

  const { dropdownItems } = await openFilterDropdown(page);
  const optionCount = await dropdownItems.count();

  for (let optIdx = 7; optIdx < optionCount; optIdx++) {
    await gotoBase(page);
    await page.waitForTimeout(300);
    const optText = await chooseOptionByIndex(page, optIdx);

    const cards = getCardsLocator(page);
    await cards.first().waitFor({ state: 'visible', timeout: CONFIG.defaultTimeoutMs });
    const cardCount = await cards.count();
    console.log(`当前筛选(${optIdx + 1}/${optionCount}) "${optText}" 列表数量: ${cardCount}`);

    for (let cardIdx = 0; cardIdx < cardCount; cardIdx++) {
      const r = await openHandbookFromCard({ page, context, optIdx, cardIdx });
      if (!r) break;
    }
  }

  // 可选：抓完不要立即关，方便观察
  // await context.close();
})();