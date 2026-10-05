import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5184', '--strictPort'], { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => { server.kill(); reject(new Error('Vite startup timed out')); }, 20000);
  server.stdout.on('data', data => { if (data.toString().includes('Local:')) { clearTimeout(timer); resolve(); } });
  server.once('error', error => { clearTimeout(timer); reject(error); });
  server.once('exit', code => { clearTimeout(timer); reject(new Error('Vite exited: ' + code)); });
});
const browser = await chromium.launch().catch(error => { server.kill(); throw error; });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
let tasks;
let lists;
let movedTask;
page.on('pageerror', error => errors.push(error.message));
await page.route('**/rest/v1/**', async route => {
  const request = route.request();
  const url = new URL(request.url());
  const table = url.pathname.split('/').pop();
  if (request.method() === 'PATCH') {
    const id = url.searchParams.get('id')?.replace(/^eq\./, '');
    const fields = request.postDataJSON();
    if (table === 'tasks') {
      tasks = tasks.map(task => task.id === id ? { ...task, ...fields } : task);
      movedTask = tasks.find(task => task.id === id);
    }
    return route.fulfill({ status: 204 });
  }
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify(table === 'tasks' ? tasks : table === 'lists' ? lists : []) });
});
try {
  await page.goto('http://127.0.0.1:5184/tests/fixtures/board-scroll.html');
  await page.locator('h3').filter({ hasText: /^Todo$/ }).waitFor();
  ({ tasks, lists } = await page.evaluate(() => window.boardFixture));
  assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight), true, 'long lists must not grow the page');
  const todo = page.getByRole('region', { name: 'Tasks in Todo', exact: true });
  const progress = page.getByRole('region', { name: 'Tasks in Progress', exact: true });
  const section = page.locator('section').filter({ has: page.locator('h3').filter({ hasText: /^Todo$/ }) });
  const headerBefore = await section.locator('h3').filter({ hasText: /^Todo$/ }).boundingBox();
  const addBefore = await section.getByPlaceholder('New task title').boundingBox();
  assert.ok(await todo.evaluate(el => el.scrollHeight > el.clientHeight));
  await todo.hover();
  await page.mouse.wheel(0, 700);
  await page.waitForFunction(() => document.querySelector('[aria-label="Tasks in Todo"]').scrollTop > 0);
  assert.equal(await progress.evaluate(el => el.scrollTop), 0, 'scroll is independent');
  assert.equal((await section.locator('h3').filter({ hasText: /^Todo$/ }).boundingBox()).y, headerBefore.y);
  assert.equal((await section.getByPlaceholder('New task title').boundingBox()).y, addBefore.y, 'add form stays visible');
  await page.screenshot({ path: join(tmpdir(), 'kanban-board-scroll-desktop.png') });
  await todo.evaluate(el => { el.scrollTop = 0; });
  await todo.focus();
  await page.keyboard.press('PageDown');
  await page.waitForFunction(() => document.querySelector('[aria-label="Tasks in Todo"]').scrollTop > 0);
  await todo.evaluate(el => { el.scrollTop = el.scrollHeight; });
  const source = await todo.locator('article').filter({ hasText: 'Todo task 40' }).boundingBox();
  const target = await page.getByRole('region', { name: 'Tasks in Done', exact: true }).boundingBox();
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 10, source.y + source.height / 2, { steps: 4 });
  const drop = page.waitForResponse(response => response.request().method() === 'PATCH');
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();
  await drop;
  assert.equal(movedTask.list_id, 'list-2', 'drag from scrolled list to empty list');
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth), true, 'mobile page stays within viewport');
    const add = await section.getByPlaceholder('New task title').boundingBox();
    assert.ok(add.y + add.height <= viewport.height, 'add form fits mobile');
    assert.ok(await page.locator('#main').evaluate(el => el.scrollWidth > el.clientWidth), 'board can scroll horizontally');
    await page.locator('#main').evaluate(el => { el.scrollLeft = el.scrollWidth; });
    assert.ok(await page.locator('#main').evaluate(el => el.scrollLeft > 0));
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, checks: ['viewport height cap', 'independent wheel scroll', 'fixed list header and add form', 'keyboard scroll', 'drag from scrolled list to empty list', 'mobile portrait/landscape', 'horizontal board scroll'], pageErrors: errors }));
} finally { await browser.close(); server.kill(); }
