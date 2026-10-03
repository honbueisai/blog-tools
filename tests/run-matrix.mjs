#!/usr/bin/env node
// v0.4.1.0: 合言葉（マーカー）方式の自動テストマトリクス。
//
// {記事生成→HTMLコピー→サムネ指示生成→画像生成} の一連の流れを、
//   layout × {表のまま, 途中で裏→表} × {heavyなし, heavy=1}
// の全組み合わせで、Node組み込みのWebSocketでChrome DevTools Protocol (CDP) を直接叩いて
// ヘッドレスChromeを操作する（Puppeteer等は使わない）。各ケースの合否・所要時間・
// ロングタスク（50ms超）件数を表で出力する。さらに「貼り付けて読み込む」の経路を
// 目印あり／目印なし（素の全文）／目印なし（コードブロック）の3ケースで確認する。
//
// 使い方:
//   1. 別ターミナルで dev-server.py を起動しておく
//      （cd .../BLOG && python3 dev-server.py）
//   2. node tests/run-matrix.mjs
//
// 前提: /Applications/Google Chrome.app が入っている macOS。
'use strict';

import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = process.env.EISAI_MOCK_BASE_URL || 'http://localhost:8090/.claude/worktrees/chatgpt-v0.4/tests/mock-chatgpt.html';
const NAV_TIMEOUT_MS = 15000;
const FLOW_TIMEOUT_MS = 30000;
// v0.4.1.3: 画像生成の完成は、DOMにnaturalWidth>500のimgが現れただけ（bigImage）では判定しない
// （プレビュー段階でも大きいimgが出るため）。拡張機能（watchGeneratedImage）が実際に完成と
// 判定した時に出す文言で判定する。IMAGE_STOPPED_REはタイムアウト／失敗（imgなし）で打ち切られた時。
const IMAGE_DONE_RE = /画像ができました|ChatGPTが仕上げに失敗しました/;
const IMAGE_STOPPED_RE = /8分経っても|画像を作れませんでした/;
// v0.4.1.1: 「貼り付けて読み込む」ケースで使うfixtureの絶対URL。mock-chatgpt.html自身が読み込み直後に
// history.replaceState(...)でページのURLを（本物のchatgpt.comの会話URLに似せて）書き換えるため、
// ページ内で相対パス（'fixtures/xxx.txt'）をfetchすると書き換え後のパスを起点に解決されてしまい404になる
// （バグの実体：ページ側ではなくこのテストスクリプトのfetch先の取り方に不具合があった）。navigate前に
// BASE_URLを起点に確定させた絶対URLを使うことで、URL書き換えの影響を受けずに本物のfixtureを取得する。
const PASTE_FIXTURE_URL = new URL('fixtures/higashioozima-chatgpt.txt', BASE_URL).toString();

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForCdpReady(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return true;
    } catch (e) {
      lastErr = e;
    }
    await sleep(150);
  }
  throw new Error('CDPが起動しませんでした: ' + (lastErr ? lastErr.message : 'timeout'));
}

class CdpSession {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        const cbs = this.listeners.get(msg.method);
        if (cbs) cbs.forEach(cb => cb(msg.params));
      }
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, cb) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(cb);
  }
  once(method, cb) {
    const wrapped = (params) => { cb(params); };
    this.on(method, wrapped);
  }
}

async function openTab(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).catch(() => null);
  const info = res && res.ok ? await res.json() : await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`)).json();
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const cdp = new CdpSession(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  return { cdp, ws, targetId: info.id };
}

async function closeTab(port, targetId, ws) {
  try { ws.close(); } catch (e) { /* noop */ }
  try { await fetch(`http://127.0.0.1:${port}/json/close/${targetId}`); } catch (e) { /* noop */ }
}

async function navigate(cdp, url) {
  // 注意：Page.enableをすでに読み込み済みのタブ（about:blank）に対して呼ぶと、
  // そのタブ自身のloadEventFiredが遅れて届くことがあり、次のPage.navigateの完了と
  // 取り違える恐れがある。ここでは固定の待ち時間で確実に読み込みを待つ
  // （このモックはローカル・軽量なので十分間に合う）。
  await cdp.send('Page.navigate', { url });
  await sleep(1500);
}

async function evalJs(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (result.exceptionDetails) {
    throw new Error('page eval error: ' + JSON.stringify(result.exceptionDetails.exception && result.exceptionDetails.exception.description));
  }
  return result.result ? result.result.value : undefined;
}

const STATE_EXPR = `(() => {
  const panel = document.querySelector('[id^="eisai-chatgpt-tool-v"]');
  const statusEl = panel ? panel.querySelector('.eisai-status') : null;
  const copyBtn = document.getElementById('eisai-copy-html-btn');
  const rereadBtn = document.getElementById('eisai-reread-btn');
  const imgExecBtn = document.getElementById('eisai-img-exec-btn');
  const root = Array.from(document.querySelectorAll('main')).sort((a, b) => (b.textContent || '').length - (a.textContent || '').length)[0] || document.body;
  const imgs = Array.from(root.querySelectorAll('img'));
  const tasks = window.__eisaiLongTasks || [];
  return JSON.stringify({
    status: statusEl ? statusEl.textContent : '',
    copyVisible: !!copyBtn && copyBtn.style.display === 'block',
    rereadVisible: !!rereadBtn && rereadBtn.style.display === '',
    imgExecVisible: !!imgExecBtn && imgExecBtn.style.display === 'block',
    bigImage: imgs.some(img => (img.naturalWidth || 0) > 500),
    longtaskCount: tasks.length,
    longtaskMax: tasks.reduce((m, t) => Math.max(m, t.duration), 0)
  });
})()`;

async function getState(cdp) {
  const raw = await evalJs(cdp, STATE_EXPR);
  return JSON.parse(raw);
}

async function setHidden(cdp, hidden) {
  const expr = `(() => {
    Object.defineProperty(document, 'hidden', { value: ${hidden}, configurable: true });
    Object.defineProperty(document, 'visibilityState', { value: '${hidden ? 'hidden' : 'visible'}', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    return true;
  })()`;
  await evalJs(cdp, expr);
}

async function clickById(cdp, id) {
  return evalJs(cdp, `(() => { const el = document.getElementById(${JSON.stringify(id)}); if (!el) return false; el.click(); return true; })()`);
}

async function clickByIdPrefix(cdp, prefix) {
  return evalJs(cdp, `(() => { const el = document.querySelector('[id^=${JSON.stringify(prefix)}]'); if (!el) return false; el.click(); return true; })()`);
}

async function seedArticleDraft(cdp) {
  const memo = 'テスト用のメモです。8/1にテスト対策会を実施し、20名が参加しました。前回は15名でした。数学が苦手な生徒には田村先生が個別に解説しました。';
  await evalJs(cdp, `(() => {
    localStorage.setItem('eisai_chatgpt_article_draft_v040', JSON.stringify({ mode: 'easy', type: 'auto', memo: ${JSON.stringify(memo)} }));
    return true;
  })()`);
}

async function waitUntil(cdp, predicate, timeoutMs, intervalMs = 300) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await getState(cdp);
    if (predicate(last)) return last;
    await sleep(intervalMs);
  }
  return last;
}

function buildMockUrl(testCase) {
  const p = new URLSearchParams();
  p.set('eisai_test', '1');
  p.set('fixture', testCase.fixture || 'sc_yanokuchi-chatgpt');
  p.set('speed', String(testCase.speed || 12));
  if (testCase.layout) p.set('layout', testCase.layout);
  if (testCase.seed) p.set('seed', String(testCase.seed));
  if (testCase.echo) p.set('echo', '1');
  if (testCase.heavy) p.set('heavy', '1');
  // v0.4.1.2: 「裏にある間もChatGPTが本文を最後まで描画し終える」実機パターンの再現。
  if (testCase.hideDuring) p.set('hideDuring', '1');
  if (testCase.renderHidden) p.set('renderHidden', '1');
  // v0.4.1.4: 「#prompt-textareaが無く、入力欄がform内のdiv.ProseMirror（aria-label="ChatGPT
  // に聞く"）だけの画面。書き物キャンバスらしいデコイがDOM上で先に来る」を再現するテスト専用
  // モード（composer誤認の回帰確認用。runComposerMisdetectionCase参照）。
  if (testCase.composerNoId) p.set('composerNoId', '1');
  // v0.4.1.5: タブが裏にある間、入力後しばらく送信ボタンを無効化する（実機で描画が遅れて
  // 送信ボタンがまだ出ていなかった一瞬の再現。runLateSendButtonCase参照）。
  if (testCase.lateSendBtn) p.set('lateSendBtn', '1');
  // v0.4.1.6: タブが裏にある間、setTimeout／setIntervalの遅延をTHROTTLE_MULTIPLIER倍に伸ばす
  // （Chromeの実際のIntensive Throttlingそのものではないが、近似としての再現。
  // runThrottledLateSendButtonCase参照）。
  if (testCase.throttle) p.set('throttle', '1');
  // v0.4.1.7: 貼り付けが添付ファイル扱いに変わる境目（実機は8,000〜10,000字の間）を下げて、
  // 記事の依頼文（約6,000字）でも添付になる状況を再現する（添付＋短い案内文で送れることの確認）。
  if (testCase.pasteAttachAt) p.set('pasteAttachAt', String(testCase.pasteAttachAt));
  return `${BASE_URL}?${p.toString()}`;
}

async function runFullFlowCase(port, testCase) {
  const t0 = Date.now();
  const { cdp, ws, targetId } = await openTab(port);
  const steps = [];
  try {
    const url = buildMockUrl(testCase);
    await navigate(cdp, url);
    await seedArticleDraft(cdp);
    // ヘッドレス・バックグラウンドタブはdocument.hiddenがtrueになりがちなので、まず
    // 「表」に固定する（toggleVisibilityケースだけ、下で明示的に裏→表を切り替える）。
    await setHidden(cdp, false);

    const openedLaunch = await clickByIdPrefix(cdp, 'eisai-chatgpt-btn-v');
    if (!openedLaunch) throw new Error('起動ボタンが見つかりませんでした');
    await sleep(150);

    const clickedGen = await clickById(cdp, 'eisai-gen-article-btn');
    if (!clickedGen) throw new Error('「ChatGPTで記事を作る」ボタンが見つかりませんでした');
    steps.push('sent-article');

    if (testCase.toggleVisibility) {
      setTimeout(() => { setHidden(cdp, true).catch(() => {}); }, 700);
      setTimeout(() => { setHidden(cdp, false).catch(() => {}); }, 700 + (testCase.hiddenMs || 1500));
    }

    const afterArticle = await waitUntil(cdp, (s) => s.copyVisible || s.rereadVisible, FLOW_TIMEOUT_MS);
    if (!afterArticle || !afterArticle.copyVisible) {
      throw new Error('記事生成が完了しませんでした（status=' + (afterArticle && afterArticle.status) + ')');
    }
    steps.push('article-done');

    const clickedCopy = await clickById(cdp, 'eisai-copy-html-btn');
    if (!clickedCopy) throw new Error('HTMLコピーボタンが見つかりませんでした');
    await sleep(150);
    steps.push('copied');

    const clickedThumbGen = await clickById(cdp, 'eisai-gen-btn');
    if (!clickedThumbGen) throw new Error('「画像用の指示を作る」ボタンが見つかりませんでした');
    steps.push('sent-thumbnail');

    if (testCase.toggleVisibility) {
      setTimeout(() => { setHidden(cdp, true).catch(() => {}); }, 500);
      setTimeout(() => { setHidden(cdp, false).catch(() => {}); }, 500 + (testCase.hiddenMs || 1200));
    }

    const afterThumb = await waitUntil(cdp, (s) => s.imgExecVisible, FLOW_TIMEOUT_MS);
    if (!afterThumb || !afterThumb.imgExecVisible) {
      throw new Error('サムネ指示生成が完了しませんでした（status=' + (afterThumb && afterThumb.status) + ')');
    }
    steps.push('thumbnail-done');

    const clickedImgExec = await clickById(cdp, 'eisai-img-exec-btn');
    if (!clickedImgExec) throw new Error('「このプロンプトで画像を生成する」ボタンが見つかりませんでした');
    steps.push('sent-image');

    // v0.4.1.3: 大きい画像（naturalWidth>500）がまず「プレビュー」表示で出る（mock側の
    // appendPreviewThenFinalImage）。この段階ではまだ完成と表示されないことを確認する
    // （isNearImagePreviewLabelでプレビュー中は完成にしない、という今回の修正の本体）。
    const duringPreview = await waitUntil(cdp, (s) => s.bigImage, FLOW_TIMEOUT_MS);
    if (!duringPreview || !duringPreview.bigImage) {
      throw new Error('プレビュー画像が現れませんでした（status=' + (duringPreview && duringPreview.status) + ')');
    }
    if (IMAGE_DONE_RE.test(duringPreview.status || '')) {
      throw new Error('プレビュー段階なのに完成と表示されました（status=' + duringPreview.status + ')');
    }
    steps.push('preview-not-done');

    // 約10秒後にmock側がDOMを差し替え、プレビューのラベルが消える。そこから5秒（IMAGE_STABLE_MS）
    // 安定した時点で拡張機能が完成と判定する（watchGeneratedImage）ので、それを確認する。
    const afterImage = await waitUntil(cdp, (s) => IMAGE_DONE_RE.test(s.status || '') || IMAGE_STOPPED_RE.test(s.status || ''), FLOW_TIMEOUT_MS);
    if (!afterImage || !IMAGE_DONE_RE.test(afterImage.status || '')) {
      throw new Error('画像生成が完了しませんでした（status=' + (afterImage && afterImage.status) + ')');
    }
    steps.push('image-done');

    const finalState = await getState(cdp);
    return {
      ok: true,
      elapsedMs: Date.now() - t0,
      longtaskCount: finalState.longtaskCount,
      longtaskMax: finalState.longtaskMax,
      steps
    };
  } catch (e) {
    let longtaskCount = -1, longtaskMax = -1;
    try { const s = await getState(cdp); longtaskCount = s.longtaskCount; longtaskMax = s.longtaskMax; } catch (e2) { /* noop */ }
    return {
      ok: false,
      elapsedMs: Date.now() - t0,
      longtaskCount,
      longtaskMax,
      steps,
      error: e && e.message ? e.message : String(e)
    };
  } finally {
    await closeTab(port, targetId, ws);
  }
}

// v0.4.1.1: 「貼り付けて読み込む」を、ChatGPTから実際に返ってくる想定の3つの形で確認する。
//   - marker : 目印あり（[[EISAI-START-xxxxxx]]…[[EISAI-END-xxxxxx]]）。文書カードの見出し文字・
//              提案ボタンの文言が本文の前後に付いたままコピーされた状態を含む
//              （tests/fixtures/higashioozima-chatgpt.txt自体が先頭に「英才個別学院 東大島校ブログ」、
//              末尾に提案ボタンの文言を含む本物のChatGPT出力そのままの形）。
//   - plain  : 目印なし・素の全文。ChatGPTのコピーボタンでコピーした際に付く、先頭の余分な空行・空白も
//              合わせて再現する。
//   - fenced : 目印なし・Markdownのコードブロック（```html〜```）に入った全文。
const PASTE_VARIANTS = {
  marker: { label: '目印あり', wrapExpr: `'[[EISAI-START-abc123]]\\n' + body + '\\n[[EISAI-END-abc123]]'` },
  plain: { label: '目印なし・素の全文（先頭に余分な空行）', wrapExpr: `'\\n\\n   \\n' + body` },
  fenced: { label: '目印なし・コードブロック', wrapExpr: `'\`\`\`html\\n' + body + '\\n\`\`\`'` }
};

async function runPasteFallbackCase(port, variant) {
  const t0 = Date.now();
  const { cdp, ws, targetId } = await openTab(port);
  try {
    const p = new URLSearchParams({ eisai_test: '1', fixture: 'higashioozima-chatgpt', speed: '12' });
    await navigate(cdp, `${BASE_URL}?${p.toString()}`);
    await seedArticleDraft(cdp);
    await setHidden(cdp, false);

    const openedLaunch = await clickByIdPrefix(cdp, 'eisai-chatgpt-btn-v');
    if (!openedLaunch) throw new Error('起動ボタンが見つかりませんでした');
    await sleep(150);

    // fixtureの生本文を3形のいずれかで包んだ状態を「ChatGPTからコピーしてきたテキスト」として
    // 貼り付け欄に入れ、読み込むボタンを押す。fetch先はPASTE_FIXTURE_URL（絶対URL）を使う
    // （mock-chatgpt.htmlのhistory.replaceStateでページのURLが書き換わった後でも解決できるように）。
    const wrapExpr = PASTE_VARIANTS[variant].wrapExpr;
    const loadResult = await evalJs(cdp, `(async () => {
      const res = await fetch(${JSON.stringify(PASTE_FIXTURE_URL)}, { cache: 'no-store' });
      const body = await res.text();
      const wrapped = ${wrapExpr};
      const details = document.getElementById('eisai-paste-fallback');
      const textarea = document.getElementById('eisai-paste-fallback-textarea');
      const loadBtn = document.getElementById('eisai-paste-fallback-load-btn');
      if (!details || !textarea || !loadBtn) return { ok: false, reason: 'element-missing' };
      details.open = true;
      textarea.value = wrapped;
      loadBtn.click();
      return { ok: true, bodyLen: body.length };
    })()`);
    if (!loadResult || !loadResult.ok) {
      throw new Error('貼り付け欄の要素が見つかりませんでした: ' + JSON.stringify(loadResult));
    }
    if (!loadResult.bodyLen || loadResult.bodyLen < 300) {
      throw new Error('fixtureの取得に失敗しました（取得文字数=' + loadResult.bodyLen + '）。dev-server.pyが起動しているか確認してください。');
    }

    const state = await waitUntil(cdp, (s) => s.copyVisible, 10000);
    if (!state || !state.copyVisible) {
      throw new Error('貼り付け読み込みが完了しませんでした（status=' + (state && state.status) + ')');
    }
    return { ok: true, elapsedMs: Date.now() - t0, longtaskCount: state.longtaskCount, longtaskMax: state.longtaskMax };
  } catch (e) {
    return { ok: false, elapsedMs: Date.now() - t0, error: e && e.message ? e.message : String(e) };
  } finally {
    await closeTab(port, targetId, ws);
  }
}

// v0.4.1.2: 「ずっと裏のまま（表に戻さない）」で、記事→サムネ指示→画像のすべてが完成することを
// 確認する専用ケース。2026-09-27に実機で確認した不具合（タブが裏にある間、ChatGPTは本文を
// 最後まで描画し終えているのに、パネルが完成処理へ進まなかった）の再発防止用。
// mock-chatgpt.htmlにhideDuring=1（裏でDOM反映が止まる再現）とrenderHidden=1
// （裏でも本文描画を続ける・hideDuringより優先）を同時に指定し、「本来は裏で止まる想定の
// モックでも、renderHiddenを付ければ裏のまま最後まで描画され、それを拡張機能が検出できる」
// ことまで確認する。
async function runStayHiddenCase(port) {
  const t0 = Date.now();
  const { cdp, ws, targetId } = await openTab(port);
  const steps = [];
  try {
    const url = buildMockUrl({
      fixture: 'sc_yanokuchi-chatgpt',
      speed: 12,
      layout: 'writing-block',
      hideDuring: true,
      renderHidden: true
    });
    await navigate(cdp, url);
    await seedArticleDraft(cdp);
    await setHidden(cdp, false);

    const openedLaunch = await clickByIdPrefix(cdp, 'eisai-chatgpt-btn-v');
    if (!openedLaunch) throw new Error('起動ボタンが見つかりませんでした');
    await sleep(150);

    // ここから先は表に戻さない（ずっと裏のまま）。
    await setHidden(cdp, true);

    const clickedGen = await clickById(cdp, 'eisai-gen-article-btn');
    if (!clickedGen) throw new Error('「ChatGPTで記事を作る」ボタンが見つかりませんでした');
    steps.push('sent-article');

    const afterArticle = await waitUntil(cdp, (s) => s.copyVisible || s.rereadVisible, FLOW_TIMEOUT_MS);
    if (!afterArticle || !afterArticle.copyVisible) {
      throw new Error('記事生成が完了しませんでした（裏のまま・status=' + (afterArticle && afterArticle.status) + ')');
    }
    steps.push('article-done');

    const clickedCopy = await clickById(cdp, 'eisai-copy-html-btn');
    if (!clickedCopy) throw new Error('HTMLコピーボタンが見つかりませんでした');
    await sleep(150);
    steps.push('copied');

    const clickedThumbGen = await clickById(cdp, 'eisai-gen-btn');
    if (!clickedThumbGen) throw new Error('「画像用の指示を作る」ボタンが見つかりませんでした');
    steps.push('sent-thumbnail');

    const afterThumb = await waitUntil(cdp, (s) => s.imgExecVisible, FLOW_TIMEOUT_MS);
    if (!afterThumb || !afterThumb.imgExecVisible) {
      throw new Error('サムネ指示生成が完了しませんでした（裏のまま・status=' + (afterThumb && afterThumb.status) + ')');
    }
    steps.push('thumbnail-done');

    const clickedImgExec = await clickById(cdp, 'eisai-img-exec-btn');
    if (!clickedImgExec) throw new Error('「このプロンプトで画像を生成する」ボタンが見つかりませんでした');
    steps.push('sent-image');

    // v0.4.1.3: 裏のままでも、プレビュー段階では完成と表示されず、差し替え後の安定待ちを経て
    // 完成と表示されることを確認する（IMAGE_DONE_RE参照）。
    const afterImage = await waitUntil(cdp, (s) => IMAGE_DONE_RE.test(s.status || '') || IMAGE_STOPPED_RE.test(s.status || ''), FLOW_TIMEOUT_MS);
    if (!afterImage || !IMAGE_DONE_RE.test(afterImage.status || '')) {
      throw new Error('画像生成が完了しませんでした（裏のまま・status=' + (afterImage && afterImage.status) + ')');
    }
    steps.push('image-done');

    // このテスト自体の前提（最後まで裏のままだったこと）が崩れていないかの確認
    const stillHidden = await evalJs(cdp, `document.hidden === true`);
    if (!stillHidden) throw new Error('テストの前提が崩れました：途中で表に戻っていました');

    const finalState = await getState(cdp);
    return {
      ok: true,
      elapsedMs: Date.now() - t0,
      longtaskCount: finalState.longtaskCount,
      longtaskMax: finalState.longtaskMax,
      steps
    };
  } catch (e) {
    let longtaskCount = -1, longtaskMax = -1;
    try { const s = await getState(cdp); longtaskCount = s.longtaskCount; longtaskMax = s.longtaskMax; } catch (e2) { /* noop */ }
    return {
      ok: false,
      elapsedMs: Date.now() - t0,
      longtaskCount,
      longtaskMax,
      steps,
      error: e && e.message ? e.message : String(e)
    };
  } finally {
    await closeTab(port, targetId, ws);
  }
}

// v0.4.1.5: 2026-09-29に実機で確認：タブが裏にある間にChatGPT側の描画が遅れ、送信直後には
// まだ送信ボタンが無く（Enterキーでも送れない画面）、旧CHATGPT_ADAPTER.sendは250ms後に1回
// だけボタンを探して見つからず、結局送信できていなかった（その後waitUntilTabVisibleで表に
// 戻るまで永久に待ち、パネルが「📨 送信中…」で止まって見えた）。
// v0.4.1.6: 2026-09-29に実機で確認：記事は裏のまま送信〜完成まで成功したが、次のサムネ指示
// （setComposerAndSend→すぐwatchThumbnailPrompt。送信確認・再送が無かった）で、送信ボタンが
// 遅れて出るケースが再発した。画像生成の送信文も同じ作りだったため、サムネ指示・画像生成の
// 送信にもsendAndConfirm（送信確認・裏での安全な再送）を使うように統一した。
// lateSendBtn=1のmockで、ずっと裏のまま記事・サムネ指示・画像生成の3つすべてで送信ボタンが
// 遅れて出る状況を再現し、送信〜画像の完成まで進むことを確認する。
async function runLateSendButtonCase(port) {
  const t0 = Date.now();
  const { cdp, ws, targetId } = await openTab(port);
  const steps = [];
  try {
    const url = buildMockUrl({
      fixture: 'sc_yanokuchi-chatgpt',
      speed: 12,
      layout: 'writing-block',
      lateSendBtn: true
    });
    await navigate(cdp, url);
    await seedArticleDraft(cdp);
    await setHidden(cdp, false);

    const openedLaunch = await clickByIdPrefix(cdp, 'eisai-chatgpt-btn-v');
    if (!openedLaunch) throw new Error('起動ボタンが見つかりませんでした');
    await sleep(150);

    // ここから先は表に戻さない（ずっと裏のまま）。
    await setHidden(cdp, true);

    const clickedGen = await clickById(cdp, 'eisai-gen-article-btn');
    if (!clickedGen) throw new Error('「ChatGPTで記事を作る」ボタンが見つかりませんでした');
    steps.push('sent-article');

    const afterArticle = await waitUntil(cdp, (s) => s.copyVisible || s.rereadVisible, FLOW_TIMEOUT_MS);
    if (!afterArticle || !afterArticle.copyVisible) {
      throw new Error('記事生成が完了しませんでした（裏のまま・送信ボタン遅延・status=' + (afterArticle && afterArticle.status) + ')');
    }
    steps.push('article-done');

    const clickedCopy = await clickById(cdp, 'eisai-copy-html-btn');
    if (!clickedCopy) throw new Error('HTMLコピーボタンが見つかりませんでした');
    await sleep(150);
    steps.push('copied');

    const clickedThumbGen = await clickById(cdp, 'eisai-gen-btn');
    if (!clickedThumbGen) throw new Error('「画像用の指示を作る」ボタンが見つかりませんでした');
    steps.push('sent-thumbnail');

    const afterThumb = await waitUntil(cdp, (s) => s.imgExecVisible, FLOW_TIMEOUT_MS);
    if (!afterThumb || !afterThumb.imgExecVisible) {
      throw new Error('サムネ指示生成が完了しませんでした（裏のまま・送信ボタン遅延・status=' + (afterThumb && afterThumb.status) + ')');
    }
    steps.push('thumbnail-done');

    const clickedImgExec = await clickById(cdp, 'eisai-img-exec-btn');
    if (!clickedImgExec) throw new Error('「このプロンプトで画像を生成する」ボタンが見つかりませんでした');
    steps.push('sent-image');

    const afterImage = await waitUntil(cdp, (s) => IMAGE_DONE_RE.test(s.status || '') || IMAGE_STOPPED_RE.test(s.status || ''), FLOW_TIMEOUT_MS);
    if (!afterImage || !IMAGE_DONE_RE.test(afterImage.status || '')) {
      throw new Error('画像生成が完了しませんでした（裏のまま・送信ボタン遅延・status=' + (afterImage && afterImage.status) + ')');
    }
    steps.push('image-done');

    // このテスト自体の前提（最後まで裏のままだったこと）が崩れていないかの確認
    const stillHidden = await evalJs(cdp, `document.hidden === true`);
    if (!stillHidden) throw new Error('テストの前提が崩れました：途中で表に戻っていました');

    const finalState = await getState(cdp);
    return {
      ok: true,
      elapsedMs: Date.now() - t0,
      longtaskCount: finalState.longtaskCount,
      longtaskMax: finalState.longtaskMax,
      steps
    };
  } catch (e) {
    let longtaskCount = -1, longtaskMax = -1;
    try { const s = await getState(cdp); longtaskCount = s.longtaskCount; longtaskMax = s.longtaskMax; } catch (e2) { /* noop */ }
    return {
      ok: false,
      elapsedMs: Date.now() - t0,
      longtaskCount,
      longtaskMax,
      steps,
      error: e && e.message ? e.message : String(e)
    };
  } finally {
    await closeTab(port, targetId, ws);
  }
}

// v0.4.1.6: 2026-09-29にユーザーから追加報告：手動送信でChatGPT側は完了していたのに、パネルが
// 「🎯 画像生成用プロンプトを作成しています…」のまま進まなかった。原因として、Chromeの
// Intensive Throttling（タブが長く裏にあると、setTimeoutの連鎖が数十分に間引かれる）が
// send()側の待ちを異常に伸ばしていた可能性が疑われた。throttle=1（拡張機能が直接呼んだ
// setTimeout／setIntervalの遅延だけをTHROTTLE_MULTIPLIER倍に伸ばす近似）＋lateSendBtn=1
// （送信ボタンが2秒遅れて出る）を組み合わせ、ずっと裏のまま記事生成が完了することを確認する。
// 注意：
// - 本物のIntensive Throttlingはページの実際の占有・可視状態に基づくブラウザ内部の仕組みで、
//   document.hiddenのプロパティ上書き（run-matrix.mjsのsetHidden）だけでは発生しない。
//   このケースはあくまで近似（setTimeoutの遅延を直接伸ばす）による再現であり、完全な再現では
//   ない。DOM変化で起きるMutationObserverベースの待ち方（waitForDomCondition）は、この
//   setTimeoutの遅延に影響されないことを確認する目的で使う。
// - `startMarkerWatch`自身のsetInterval(tick, 1000)も拡張機能のコードなので同じくthrottleの
//   対象になり、終了目印検出後の安定確認（2回連続で1000ms間隔のはずが、throttle下では
//   15000ms間隔になる）だけで30秒前後かかる。そのためこのケースだけはFLOW_TIMEOUT_MSより
//   長い専用のタイムアウト（THROTTLED_FLOW_TIMEOUT_MS）を使う。「間引かれても完成には
//   進む」ことの確認が目的で、「速く終わる」ことは確認しない。
async function runThrottledLateSendButtonCase(port) {
  const THROTTLED_FLOW_TIMEOUT_MS = 120000; // 2分（throttleでtickが15秒おきになる分の余裕）
  const t0 = Date.now();
  const { cdp, ws, targetId } = await openTab(port);
  const steps = [];
  try {
    const url = buildMockUrl({
      fixture: 'sc_yanokuchi-chatgpt',
      speed: 12,
      layout: 'writing-block',
      lateSendBtn: true,
      throttle: true
    });
    await navigate(cdp, url);
    await seedArticleDraft(cdp);
    await setHidden(cdp, false);

    const openedLaunch = await clickByIdPrefix(cdp, 'eisai-chatgpt-btn-v');
    if (!openedLaunch) throw new Error('起動ボタンが見つかりませんでした');
    await sleep(150);

    // ここから先は表に戻さない（ずっと裏のまま）。
    await setHidden(cdp, true);

    const clickedGen = await clickById(cdp, 'eisai-gen-article-btn');
    if (!clickedGen) throw new Error('「ChatGPTで記事を作る」ボタンが見つかりませんでした');
    steps.push('sent-article');

    const afterArticle = await waitUntil(cdp, (s) => s.copyVisible || s.rereadVisible, THROTTLED_FLOW_TIMEOUT_MS);
    if (!afterArticle || !afterArticle.copyVisible) {
      throw new Error('記事生成が完了しませんでした（裏のまま・throttle+送信ボタン遅延・status=' + (afterArticle && afterArticle.status) + ')');
    }
    steps.push('article-done');

    const stillHidden = await evalJs(cdp, `document.hidden === true`);
    if (!stillHidden) throw new Error('テストの前提が崩れました：途中で表に戻っていました');

    const finalState = await getState(cdp);
    return {
      ok: true,
      elapsedMs: Date.now() - t0,
      longtaskCount: finalState.longtaskCount,
      longtaskMax: finalState.longtaskMax,
      steps
    };
  } catch (e) {
    let longtaskCount = -1, longtaskMax = -1;
    try { const s = await getState(cdp); longtaskCount = s.longtaskCount; longtaskMax = s.longtaskMax; } catch (e2) { /* noop */ }
    return {
      ok: false,
      elapsedMs: Date.now() - t0,
      longtaskCount,
      longtaskMax,
      steps,
      error: e && e.message ? e.message : String(e)
    };
  } finally {
    await closeTab(port, targetId, ws);
  }
}

// v0.4.1.4: 2026-09-29に実機で確認した「composer誤認」の危険（CHATGPT_ADAPTER.getComposerの
// 候補'div.ProseMirror[contenteditable="true"]'が、#prompt-textareaが無い画面で会話中の
// 書き物キャンバスを入力欄と誤認し、プロンプトを記事キャンバスへ書き込んでしまう）の回帰確認。
// composerNoId=1のmockで、#prompt-textareaを外し、入力欄をform内のProseMirror
// （aria-label="ChatGPT に聞く"）だけにし、main内・入力欄よりDOM順で先に書き物キャンバスの
// デコイ（aria-label="書き始める"）を置く。プロンプトが正しく入力欄に送られたことは、
// 記事生成が完了すること自体で強く裏付けられる（mockのhandleSendは、実際の入力欄
// （composer変数の指す要素）にテキストが入っていない限り発火せず、デコイに書き込まれていた
// 場合は永久に完成しない）。加えて、デコイキャンバスの文字が変わっていないことも明示的に
// 確認する（findComposerElement／isWritingCanvasElement参照）。
async function runComposerMisdetectionCase(port) {
  const t0 = Date.now();
  const { cdp, ws, targetId } = await openTab(port);
  const steps = [];
  try {
    const url = buildMockUrl({ fixture: 'sc_yanokuchi-chatgpt', layout: 'v2dom', speed: 12, composerNoId: true });
    await navigate(cdp, url);
    await seedArticleDraft(cdp);
    await setHidden(cdp, false);

    const preCheck = await evalJs(cdp, `(() => {
      const decoy = document.querySelector('[data-testid="writing-block-container-decoy"]');
      return {
        hasPromptTextareaId: !!document.getElementById('prompt-textarea'),
        decoyText: decoy ? decoy.textContent : null
      };
    })()`);
    if (preCheck.hasPromptTextareaId) throw new Error('テストの前提が崩れています：#prompt-textareaがまだ存在します');
    if (preCheck.decoyText === null) throw new Error('テストの前提が崩れています：書き物キャンバスのデコイが見つかりません');
    steps.push('precondition-ok');

    const openedLaunch = await clickByIdPrefix(cdp, 'eisai-chatgpt-btn-v');
    if (!openedLaunch) throw new Error('起動ボタンが見つかりませんでした');
    await sleep(150);

    const clickedGen = await clickById(cdp, 'eisai-gen-article-btn');
    if (!clickedGen) throw new Error('「ChatGPTで記事を作る」ボタンが見つかりませんでした');
    steps.push('sent-article');

    const afterArticle = await waitUntil(cdp, (s) => s.copyVisible || s.rereadVisible, FLOW_TIMEOUT_MS);
    if (!afterArticle || !afterArticle.copyVisible) {
      throw new Error('記事生成が完了しませんでした（プロンプトが入力欄に届いていない可能性。status=' + (afterArticle && afterArticle.status) + ')');
    }
    steps.push('article-done');

    const postCheck = await evalJs(cdp, `(() => {
      const decoy = document.querySelector('[data-testid="writing-block-container-decoy"]');
      return { decoyText: decoy ? decoy.textContent : null };
    })()`);
    if (postCheck.decoyText === null) throw new Error('デコイキャンバスが消えていました（テストのDOM前提が崩れています）');
    if (postCheck.decoyText !== preCheck.decoyText) {
      throw new Error('デコイキャンバスの文字が変わっていました（入力欄と誤認された可能性）: ' + String(postCheck.decoyText).slice(0, 80));
    }
    steps.push('decoy-untouched');

    const finalState = await getState(cdp);
    return {
      ok: true,
      elapsedMs: Date.now() - t0,
      longtaskCount: finalState.longtaskCount,
      longtaskMax: finalState.longtaskMax,
      steps
    };
  } catch (e) {
    let longtaskCount = -1, longtaskMax = -1;
    try { const s = await getState(cdp); longtaskCount = s.longtaskCount; longtaskMax = s.longtaskMax; } catch (e2) { /* noop */ }
    return {
      ok: false,
      elapsedMs: Date.now() - t0,
      longtaskCount,
      longtaskMax,
      steps,
      error: e && e.message ? e.message : String(e)
    };
  } finally {
    await closeTab(port, targetId, ws);
  }
}

function buildMatrix() {
  const layouts = [
    { label: 'writing-block', layout: 'writing-block' },
    { label: 'markdown', layout: 'markdown' },
    { label: 'stale', layout: 'stale' },
    { label: 'v2dom&echo=1', layout: 'v2dom', echo: true },
    { label: 'random(seed=1)', layout: 'random', seed: 1 },
    { label: 'random(seed=2)', layout: 'random', seed: 2 },
    { label: 'random(seed=3)', layout: 'random', seed: 3 }
  ];
  const visibilities = [
    { label: '表のまま', toggleVisibility: false },
    { label: '裏→表', toggleVisibility: true }
  ];
  const heavies = [
    { label: 'heavyなし', heavy: false },
    { label: 'heavy=1', heavy: true }
  ];

  const cases = [];
  layouts.forEach((l) => {
    visibilities.forEach((v) => {
      heavies.forEach((h) => {
        cases.push({
          name: `${l.label} / ${v.label} / ${h.label}`,
          fixture: 'sc_yanokuchi-chatgpt',
          layout: l.layout,
          echo: l.echo,
          seed: l.seed,
          toggleVisibility: v.toggleVisibility,
          heavy: h.heavy
        });
      });
    });
  });
  // v0.4.1.7: 依頼文が添付ファイル扱いになる場合（表のまま／裏→表）
  cases.push({ name: '依頼文が添付になる（pasteAttachAt=3000）/ 表のまま', fixture: 'sc_yanokuchi-chatgpt', layout: 'writing-block', pasteAttachAt: 3000 });
  cases.push({ name: '依頼文が添付になる（pasteAttachAt=3000）/ 裏→表', fixture: 'sc_yanokuchi-chatgpt', layout: 'markdown', pasteAttachAt: 3000, toggleVisibility: true });
  return cases;
}

// v0.4.1.7: 2026-09-29に実機で、入力欄への書き込み（execCommand('insertText')）が15,000字で
// 約17秒ページ全体を固めていた。mockは既定でこの重さを再現する（slowInsert）ので、
// 1回でも500msを超える重い処理があれば、そのケースは不合格にする（固まる作りの再発防止）。
const LONGTASK_FAIL_MS = 500;
function applyLongtaskGate(result) {
  if (result && result.ok && (result.longtaskMax || 0) > LONGTASK_FAIL_MS) {
    result.ok = false;
    result.error = `重い処理でページが固まった（最大${Math.round(result.longtaskMax)}ms > ${LONGTASK_FAIL_MS}ms）`;
  }
  return result;
}

async function main() {
  console.log('=== run-matrix.mjs（合言葉方式・v0.4.1.0） ===');
  console.log('対象URL:', BASE_URL);

  const port = await getFreePort();
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'eisai-chrome-'));
  console.log(`Chromeをヘッドレス起動します（port=${port}, user-data-dir=${userDataDir}）`);

  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions'
  ], { stdio: 'ignore' });

  const results = [];
  try {
    await waitForCdpReady(port, 15000);

    // EISAI_ONLY=文字列 で、名前にその文字列を含む表のケースだけを実行する（調査用）。
    const only = process.env.EISAI_ONLY || '';
    // EISAI_SPECIAL_ONLY=1 で、表のケースを飛ばして特別ケース（貼り付け・ずっと裏のまま等）だけを実行する（調査用）。
    const specialOnly = process.env.EISAI_SPECIAL_ONLY === '1';
    const matrix = specialOnly ? [] : buildMatrix().filter(c => !only || c.name.indexOf(only) !== -1);
    for (const testCase of matrix) {
      process.stdout.write(`実行中: ${testCase.name} ... `);
      const result = applyLongtaskGate(await runFullFlowCase(port, testCase));
      results.push({ name: testCase.name, ...result });
      console.log(result.ok ? `OK (${result.elapsedMs}ms, longtask=${result.longtaskCount})` : `FAIL (${result.error})`);
    }

    if (!only) for (const variant of Object.keys(PASTE_VARIANTS)) {
      const label = PASTE_VARIANTS[variant].label;
      process.stdout.write(`実行中: 貼り付けて読み込む（${label}） ... `);
      const pasteResult = await runPasteFallbackCase(port, variant);
      results.push({ name: `貼り付けて読み込む（記事・${label}）`, ...pasteResult });
      console.log(pasteResult.ok ? `OK (${pasteResult.elapsedMs}ms)` : `FAIL (${pasteResult.error})`);
    }

    if (only) { /* 調査用：表のケースだけ */ } else {
    process.stdout.write('実行中: ずっと裏のまま（記事→サムネ指示→画像・renderHidden） ... ');
    const stayHiddenResult = applyLongtaskGate(await runStayHiddenCase(port));
    results.push({ name: 'ずっと裏のまま（記事→サムネ指示→画像・renderHidden）', ...stayHiddenResult });
    console.log(stayHiddenResult.ok ? `OK (${stayHiddenResult.elapsedMs}ms)` : `FAIL (${stayHiddenResult.error})`);

    process.stdout.write('実行中: composer誤認防止（#prompt-textareaなし・書き物キャンバスのデコイあり） ... ');
    const composerResult = applyLongtaskGate(await runComposerMisdetectionCase(port));
    results.push({ name: 'composer誤認防止（#prompt-textareaなし・書き物キャンバスのデコイあり）', ...composerResult });
    console.log(composerResult.ok ? `OK (${composerResult.elapsedMs}ms)` : `FAIL (${composerResult.error})`);

    process.stdout.write('実行中: ずっと裏のまま・送信ボタン遅延（lateSendBtn=1、記事→サムネ指示→画像） ... ');
    const lateSendBtnResult = applyLongtaskGate(await runLateSendButtonCase(port));
    results.push({ name: 'ずっと裏のまま・送信ボタン遅延（lateSendBtn=1、記事→サムネ指示→画像）', ...lateSendBtnResult });
    console.log(lateSendBtnResult.ok ? `OK (${lateSendBtnResult.elapsedMs}ms)` : `FAIL (${lateSendBtnResult.error})`);

    process.stdout.write('実行中: ずっと裏のまま・throttle近似＋送信ボタン遅延 ... ');
    const throttledResult = applyLongtaskGate(await runThrottledLateSendButtonCase(port));
    results.push({ name: 'ずっと裏のまま・throttle近似＋送信ボタン遅延', ...throttledResult });
    console.log(throttledResult.ok ? `OK (${throttledResult.elapsedMs}ms)` : `FAIL (${throttledResult.error})`);
    }
  } finally {
    chrome.kill('SIGKILL');
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }

  console.log('\n=== 結果表 ===');
  const header = ['ケース', '合否', '所要時間(ms)', 'ロングタスク件数', 'ロングタスク最大(ms)', 'エラー'];
  console.log(header.join(' | '));
  let allOk = true;
  let anyLongtask = false;
  results.forEach((r) => {
    if (!r.ok) allOk = false;
    if ((r.longtaskCount || 0) > 0) anyLongtask = true;
    console.log([
      r.name,
      r.ok ? '合格' : '不合格',
      r.elapsedMs != null ? String(r.elapsedMs) : '-',
      r.longtaskCount != null ? String(r.longtaskCount) : '-',
      r.longtaskMax != null ? r.longtaskMax.toFixed ? r.longtaskMax.toFixed(1) : String(r.longtaskMax) : '-',
      r.error || ''
    ].join(' | '));
  });

  console.log('\n合計:', results.length, '件 / 合格:', results.filter(r => r.ok).length, '件 / 不合格:', results.filter(r => !r.ok).length, '件');
  console.log('ロングタスク（50ms超）が発生したケースがある:', anyLongtask);

  if (!allOk || anyLongtask) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('run-matrix.mjs 実行エラー:', e);
  process.exitCode = 1;
});
