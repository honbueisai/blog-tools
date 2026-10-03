// v0.4.1: 記事の型（ビフォー・アフター型が標準）の単体テスト。node tests/article-type.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { buildBlogPromptV3 } = require('../blog-generator-chatgpt.user.js');
const cls = { name: '英才テスト校', manager: '山田', url: 'https://example.com/f' };
const memo = '小6のCさん。算数60点→92点';

test('型の指定が無い時は、ビフォー・アフター型になる', () => {
  const p = buildBlogPromptV3({ mode: 'easy', memo }, cls, 'id0001');
  assert.match(p, /今回の型：ビフォー・アフター型/);
  assert.match(p, /本論（ビフォー・アフター型）/);
  assert.match(p, /結果（変化）を一言で先に見せる/);
  assert.match(p, /1案目に必ず「前→後」の変化/);
});

test('おまかせは、ビフォー・アフター型かストーリー型を選ばせ、悩み解決型は選ばせない', () => {
  const p = buildBlogPromptV3({ type: 'auto', mode: 'easy', memo }, cls, 'id0002');
  assert.match(p, /【ビフォー・アフター型で書く場合】/);
  assert.match(p, /【ストーリー型で書く場合】/);
  assert.doesNotMatch(p, /【悩み解決型で書く場合】/);
});

test('悩み解決型を自分で選んだ時だけ、悩み解決型になる', () => {
  const p = buildBlogPromptV3({ type: 'solve', mode: 'easy', memo }, cls, 'id0003');
  assert.match(p, /今回の型：悩み解決型（情報提供）/);
  assert.doesNotMatch(p, /本論（ビフォー・アフター型）/);
});

test('依頼文は7,500字以内（貼り付けが添付にならない長さ）', () => {
  const p = buildBlogPromptV3({ type: 'ba', mode: 'easy', memo: memo.repeat(20) }, cls, 'id0004');
  assert.ok(p.length <= 7500, `${p.length}字`);
});

const { removeFinalEisaiCta, parseCtaData } = require('../blog-generator-chatgpt.user.js');

test('おまかせ＋1,000字のメモでも8,000字以内（実機で本文に入る長さ）', () => {
  const memo = '小6のCさん。算数60点→92点。割合と速さの文章題が苦手だった。'.repeat(60).slice(0, 1000);
  const p = buildBlogPromptV3({ type: 'auto', mode: 'easy', memo }, cls, 'id0005');
  assert.ok(p.length <= 8000, `${p.length}字`);
});

test('おまかせでは、ビフォー・アフター専用の指示は「その型で書く場合」に限定される', () => {
  const p = buildBlogPromptV3({ type: 'auto', mode: 'easy', memo }, cls, 'id0006');
  assert.match(p, /（ビフォー・アフター型で書く場合は、室長のあいさつのすぐ後で/);
  assert.match(p, /※ビフォー・アフター型で書く場合は、1案目に必ず「前→後」/);
  assert.doesNotMatch(p, /\n※1案目に必ず「前→後」/);
});

test('最後の申込枠：本文に本CTAを書かせず、CTA_DATAに記事に合わせた文章を書かせる', () => {
  const p = buildBlogPromptV3({ type: 'ba', mode: 'easy', memo }, cls, 'id0007');
  assert.match(p, /本CTAは本文に書かない/);
  assert.doesNotMatch(p, /data-kind="final"><p>不安を下げる一文/);
  ['説明文1', '説明文2', '相談ポイント1', '相談ポイント4', '体験ポイント1', '体験ポイント4', '締めの言葉'].forEach(k => assert.match(p, new RegExp(k + '：')));
});

test('removeFinalEisaiCta：最後のCTAだけを取り除き、中間CTAと前後の本文は残す', () => {
  const html = '<p>本文</p><div class="eisai-cta" data-kind="mid"><p>中間</p><a class="cta-btn" href="#">申込</a></div>' +
    '<div class="eisai-school-info">教室</div><div class="eisai-cta" data-kind="final"><p>最後</p><div><span>入れ子</span></div><a class="cta-btn" href="#">申込</a></div><p>後ろ</p>';
  const out = removeFinalEisaiCta(html);
  assert.match(out, /data-kind="mid"/);
  assert.doesNotMatch(out, /data-kind="final"/);
  assert.doesNotMatch(out, /入れ子/);
  assert.match(out, /eisai-school-info/);
  assert.match(out, /<p>後ろ<\/p>$/);
});

test('parseCtaData：新しい項目（説明文・相談ポイント・体験ポイント・締めの言葉）を読める', () => {
  const text = '本文<!--CTA_DATA_START-->\n中間CTA文言：一緒に計画を\n説明文1：不安を解消\n説明文2：気軽に\n相談ポイント1：つまずきの原因\n体験ポイント1：授業の雰囲気\n締めの言葉：まずは一歩\n<!--CTA_DATA_END-->';
  const d = parseCtaData(text);
  assert.equal(d['説明文1'], '不安を解消');
  assert.equal(d['相談ポイント1'], 'つまずきの原因');
  assert.equal(d['締めの言葉'], 'まずは一歩');
});

test('parseCtaData：改行なしで1行につながっていても、項目ごとに読める（実機で確認した形）', () => {
  const text = '<!--CTA_DATA_START-->\n中間CTA文言：一緒に整理説明文1：不安を整理します。説明文2：気軽に相談を。相談ポイント1：つまずき整理相談ポイント2：優先順位体験ポイント1：基礎を確認締めの言葉：まずは一緒に。\n<!--CTA_DATA_END-->';
  const d = parseCtaData(text);
  assert.equal(d['説明文1'], '不安を整理します。');
  assert.equal(d['相談ポイント1'], 'つまずき整理');
  assert.equal(d['相談ポイント2'], '優先順位');
  assert.equal(d['締めの言葉'], 'まずは一緒に。');
});

test('v0.4.2：手順には中身が分かるタイトル（data-title）を付けさせ、教室情報に対象校を出さない', () => {
  const p = buildBlogPromptV3({ type: 'ba', mode: 'easy', memo }, { ...cls, schools: '第一中, 第二中' }, 'id0008');
  assert.match(p, /<ol class="eisai-steps" data-title="/);
  assert.match(p, /data-title に、その手順の中身が分かる12字以内のタイトル/);
  const schoolInfo = (p.match(/<div class="eisai-school-info">[\s\S]*?<\/div>/) || [''])[0];
  assert.doesNotMatch(schoolInfo, /対象校/);
});
