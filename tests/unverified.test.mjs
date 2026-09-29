// findUnverifiedClaims（要確認チェック）の単体テスト。
// 実機（2026-09-28）で出た誤検出3件の再現・修正確認と、既存の検出（入力に無い数字・発言）が
// 引き続き出ることの確認を行う。`node tests/unverified.test.mjs` で実行できる（外部通信なし）。
//
// 対象の関数は blog-generator-chatgpt.user.js の module.exports 経由で読み込む
// （ブラウザ専用のDOM初期化はスキップされる。トップのコメント参照）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { findUnverifiedClaims } = require('../blog-generator-chatgpt.user.js');

// 実機で使われた入力メモ・記事側HTML抜粋（そのまま）
const INPUT_TEXT = [
  '中3のBくん。夏休み前の実力テストは5教科合計320点→9月の実力テストで395点、75点アップ！',
  '夏期講習で毎日自習室に来て、英語と数学の中1・中2の復習をやり直した',
  '英語は62点→81点。単語を毎日30個、音読と書き取りをセットで',
  '数学は58点→79点。関数と図形の基本問題を講師と解き直し',
  '担当は英語が田中先生、数学が鈴木先生',
  '本人の言葉「中1からやり直したら、問題文が読めるようになった」',
  '志望校の目標点まであと25点。10月の模試に向けて理科の計算問題を強化中'
].join('\n');

function bodyHtml(extra) {
  return `<h1>Bくんの成績が伸びました</h1>
<div class="bubble-right"><strong>Bくん：</strong>中1からやり直したら、問題文が読めるようになった</div>
<p>9月の実力テストでは81点となり、英語は19点アップしました</p>
<p>79点になりました。21点アップです！</p>
${extra || ''}`;
}

test('吹き出し内の発言が話者ラベル込みでも、入力に同じ発言があれば要確認に出ない', () => {
  const results = findUnverifiedClaims(bodyHtml(), INPUT_TEXT);
  const quotes = results.filter(r => r.type === 'quote');
  const hit = quotes.find(r => r.text.includes('中1からやり直したら'));
  assert.equal(hit, undefined, `吹き出しの発言が誤検出された: ${JSON.stringify(quotes)}`);
});

test('81点の内訳（62点→81点の差19点）は要確認に出ない', () => {
  const results = findUnverifiedClaims(bodyHtml(), INPUT_TEXT);
  const hit = results.find(r => r.type === 'number' && r.text === '19点');
  assert.equal(hit, undefined, `19点アップが誤検出された: ${JSON.stringify(results)}`);
});

test('79点の内訳（58点→79点の差21点）は要確認に出ない', () => {
  const results = findUnverifiedClaims(bodyHtml(), INPUT_TEXT);
  const hit = results.find(r => r.type === 'number' && r.text === '21点');
  assert.equal(hit, undefined, `21点アップが誤検出された: ${JSON.stringify(results)}`);
});

test('3件とも要確認に出ない（回帰チェック：まとめて0件）', () => {
  const results = findUnverifiedClaims(bodyHtml(), INPUT_TEXT);
  const falsePositives = results.filter(r =>
    (r.type === 'quote' && r.text.includes('中1からやり直したら')) ||
    (r.type === 'number' && (r.text === '19点' || r.text === '21点'))
  );
  assert.deepEqual(falsePositives, [], `既知の誤検出3件のいずれかがまだ出ている: ${JSON.stringify(falsePositives)}`);
});

test('入力に無い数字（同じ単位の入力2数の差・和にも一致しない）は引き続き要確認に出る', () => {
  // 理科の「30点アップ」は入力のどの2つの点数の差・和とも一致しない（入力に無い数字）
  const results = findUnverifiedClaims(bodyHtml('<p>理科は30点アップを目指します</p>'), INPUT_TEXT);
  const hit = results.find(r => r.type === 'number' && r.text === '30点');
  assert.ok(hit, `入力に無い「30点」が検出されなかった: ${JSON.stringify(results)}`);
});

test('入力に無い発言（吹き出し・入力に無い名前と発言内容）は引き続き要確認に出る', () => {
  const results = findUnverifiedClaims(
    bodyHtml('<div class="bubble-left"><strong>先生：</strong>これからも頑張りましょう</div>'),
    INPUT_TEXT
  );
  const hit = results.find(r => r.type === 'quote' && r.text.includes('これからも頑張りましょう'));
  assert.ok(hit, `入力に無い吹き出し発言が検出されなかった: ${JSON.stringify(results)}`);
});

test('「」内の入力に無い発言（文末記号あり）は引き続き要確認に出る', () => {
  const results = findUnverifiedClaims(
    bodyHtml('<p>Cさんは「毎日頑張っています」と話してくれました</p>'),
    INPUT_TEXT
  );
  const hit = results.find(r => r.type === 'quote' && r.text.includes('毎日頑張っています'));
  assert.ok(hit, `入力に無い「」発言が検出されなかった: ${JSON.stringify(results)}`);
});

test('話者ラベルの全角コロン・半角コロンどちらでも、入力にある発言は要確認に出ない（境界確認）', () => {
  const half = findUnverifiedClaims(
    `<h1>t</h1><div class="bubble-right"><strong>Bくん:</strong>中1からやり直したら、問題文が読めるようになった</div>`,
    INPUT_TEXT
  );
  const halfHit = half.find(r => r.type === 'quote' && r.text.includes('中1からやり直したら'));
  assert.equal(halfHit, undefined, `半角コロンの話者ラベルで誤検出された: ${JSON.stringify(half)}`);
});

test('単位が異なる数字どうしの差・和は誤って無視しない（点と人を混同しない）', () => {
  // 入力に「62点」「81点」はあるが「19人」は無い。単位が違うので差19が一致しても無視してはいけない
  const results = findUnverifiedClaims(
    bodyHtml('<p>今回は19人が参加しました</p>'),
    INPUT_TEXT
  );
  const hit = results.find(r => r.type === 'number' && r.text === '19人');
  assert.ok(hit, `単位違いの「19人」が誤って無視された: ${JSON.stringify(results)}`);
});
