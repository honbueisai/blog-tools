// サムネイル「作り込み型」テキスト（ラベル・メイン・サブ帯・補足・タグ）と、
// 教室・場面描写（授業＝白衣・横並び／面談＝スーツ・向かい合わせ）の単体テスト。
// `node tests/thumbnail-text-and-scene.test.mjs` で実行できる（外部通信なし）。
//
// 対象の関数は blog-generator-chatgpt.user.js の module.exports 経由で読み込む
// （ブラウザ専用のDOM初期化はスキップされる。トップのコメント参照）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  extractImgTextMeta,
  buildForcedImageTextInstruction,
  buildSceneDescriptionSection,
  buildImageGenerateMessage,
  buildThumbnailArticleSummary,
  buildThumbnailPromptRequest
} = require('../blog-generator-chatgpt.user.js');
const fs = require('node:fs');
const path = require('node:path');

// v0.4.1.6: buildThumbnailPromptRequestが参照する選択肢一覧は、blog-generator-chatgpt.user.js
// 本体のCOLOR_STYLES／THUMBNAIL_TYPE_OPTIONS等と同じ内容（実際の依頼文の字数を測るための
// テスト用コピー。Nodeからは、module.exportsの早期returnより後ろにあるこれらのconstを直接
// 参照できないため、ここに複製している。本体側でこれらの一覧の中身を変えた場合は、この
// コピーも合わせて更新すること）。
const REAL_THUMBNAIL_ART_DIRECTIONS = [
  'Modern Score Editorial: one large result number as the hero, flat bold Japanese typography, clean sticker badge, real answer sheet or notebook detail, high contrast without glossy 3D',
  'Evidence Photo Poster: full-bleed close-up of notebook, answer sheet, red pen marks, worksheet, or hands in action; text placed as a compact editorial lockup',
  'Soft Before After: before/after contrast using lighting, crop, blur, or overlapping panels; avoid a harsh vertical divider unless it genuinely improves clarity',
  'Parent Question Hook: one strong parent concern as the headline, calm but clickable photo, warm editorial palette, no panic-ad look',
  'Student Change Moment: the visual hook is a changed behavior or emotion, with a short quote or result badge as support',
  'Answer Sheet Hero: paper texture, score marks, red pen, test result, and correction details as the main visual; no generic classroom stock feel',
  'Teacher Support Documentary: natural teacher/student guidance only when it supports the article; candid, close, realistic, not staged advertising',
  'Editorial Magazine Photo: photorealistic magazine-style cover with a real photo hero, clean type blocks, score transition or short checklist as compact text (no illustrated diagrams), generous spacing',
  'Event Poster Modern: date/target/benefit arranged like a school event poster, strong hierarchy, clean blocks, not a flyer overloaded with text',
  'Character Spotlight Cover: person introduction layout with portrait/photo as hero, name typography, personality cue, and graphic background'
];
const REAL_THUMBNAIL_LAYOUT_VARIANTS = [
  'asymmetric editorial grid with one strong visual zone and one clean text zone',
  'full-bleed evidence photo with compact top-left or bottom-left type lockup',
  'central answer sheet or notebook hero with a corner result badge',
  'large flat number badge plus one short supporting subtitle',
  'soft before-after with overlapping cards or lighting contrast',
  'magazine cover layout with small labels and a strong headline',
  'minimal object poster with generous negative space and one bold phrase',
  'collage layout with 2-3 evidence objects, not random decoration',
  'speech-bubble question hook over a realistic parent/student scene',
  'cropped hands-and-paper documentary composition with text on a clean panel'
];
const REAL_THUMBNAIL_TYPE_OPTIONS = {
  'おまかせ': 'Auto-select the strongest thumbnail objective from the article (score/result, evidence object like notebook or answer sheet, before/after, parent pain-point, student change moment, person spotlight when a photo is uploaded, or event). Choose based on the main visual hook, not on a fixed template.'
};
const REAL_VISUAL_EXPRESSION_OPTIONS = {
  '実写': 'Photorealistic style, shot on DSLR, authentic Japanese cram school atmosphere'
};
const REAL_TEXT_IMPACT_OPTIONS = {
  '標準': 'Readable and clean. A clear headline, calm photo, and simple contrast.',
  '強め': 'Recommended. Make the headline feel big, loud, and instantly readable, like a strong YouTube/blog thumbnail. Let the text overlap the photo if it helps.',
  '最大インパクト': 'Maximum impact. One huge phrase or number should hit first, with bold color, thick outline, and a dramatic crop.'
};
const REAL_COLOR_STYLES = {
  '赤': { main: 'Red', sub: 'Dark Red', hex: '#FF4444' },
  'ピンク': { main: 'Pink', sub: 'Rose Pink', hex: '#FF69B4' },
  'オレンジ': { main: 'Orange', sub: 'Dark Orange', hex: '#FF8C00' },
  'イエロー': { main: 'Yellow', sub: 'Golden Yellow', hex: '#FFD700' },
  'グリーン': { main: 'Green', sub: 'Forest Green', hex: '#32CD32' },
  'ブルー': { main: 'Blue', sub: 'Navy Blue', hex: '#1E90FF' },
  'スカイブルー': { main: 'Sky Blue', sub: 'Light Blue', hex: '#87CEEB' },
  'パープル': { main: 'Purple', sub: 'Deep Purple', hex: '#9370DB' },
  '白黒': { main: 'Black', sub: 'White', hex: '#000000' }
};

function buildRealThumbnailPromptRequest(fields) {
  return buildThumbnailPromptRequest({
    thumbnailType: 'おまかせ',
    style: '実写',
    textImpact: '強め',
    mainColor: '赤',
    subColor: 'ブルー',
    mainCatch: 'おまかせ',
    subCatch: 'おまかせ',
    points: 'おまかせ',
    colorStyles: REAL_COLOR_STYLES,
    thumbnailTypeOptions: REAL_THUMBNAIL_TYPE_OPTIONS,
    visualExpressionOptions: REAL_VISUAL_EXPRESSION_OPTIONS,
    textImpactOptions: REAL_TEXT_IMPACT_OPTIONS,
    artDirections: REAL_THUMBNAIL_ART_DIRECTIONS,
    layoutVariants: REAL_THUMBNAIL_LAYOUT_VARIANTS,
    ...fields
  });
}

// ---------------------------------------------------------------------------
// extractImgTextMeta
// ---------------------------------------------------------------------------

test('extractImgTextMeta: 新形式（ラベル・メイン・サブ1・サブ2・補足・タグ）を全て読み取れる', () => {
  const raw = '[[EISAI_IMG_TEXT]] ラベル：田島中／メイン：偏差値+12.6／サブ1：田島中2年・体験授業／サブ2：応用問題で力がつく／補足：入試を見据えた応用問題も／タグ：田島中・土合中・内谷中,中間テストまで3週間切る';
  const meta = extractImgTextMeta(raw);
  assert.deepEqual(meta, {
    label: '田島中',
    main: '偏差値+12.6',
    sub1: '田島中2年・体験授業',
    sub2: '応用問題で力がつく',
    note: '入試を見据えた応用問題も',
    tags: ['田島中・土合中・内谷中', '中間テストまで3週間切る']
  });
});

test('extractImgTextMeta: 旧形式（メイン・サブ1・サブ2のみ）もそのまま読める', () => {
  const raw = '[[EISAI_IMG_TEXT]] メイン：偏差値+12.6／サブ1：田島中2年／サブ2：48→76点';
  const meta = extractImgTextMeta(raw);
  assert.deepEqual(meta, {
    label: '',
    main: '偏差値+12.6',
    sub1: '田島中2年',
    sub2: '48→76点',
    note: '',
    tags: []
  });
});

test('extractImgTextMeta: [[EISAI_IMG_TEXT]]行が無ければnull', () => {
  assert.equal(extractImgTextMeta('本文中にEISAI_IMG_TEXTの行が無いテキスト'), null);
});

test('extractImgTextMeta: タグはカンマ・読点どちらでも複数に分割される', () => {
  const raw = '[[EISAI_IMG_TEXT]] メイン：テスト／タグ：タグA,タグB、タグC';
  const meta = extractImgTextMeta(raw);
  assert.deepEqual(meta.tags, ['タグA', 'タグB', 'タグC']);
});

// ---------------------------------------------------------------------------
// buildForcedImageTextInstruction
// ---------------------------------------------------------------------------

test('buildForcedImageTextInstruction: 新形式は各要素の置き場所（左上ラベル・特大メイン・色帯サブ・補足・下部タグ）を含む', () => {
  const meta = {
    label: '田島中',
    main: '偏差値+12.6',
    sub1: '田島中2年・体験授業',
    sub2: '応用問題で力がつく',
    note: '入試を見据えた応用問題も',
    tags: ['田島中・土合中・内谷中', '中間テストまで3週間切る']
  };
  const instruction = buildForcedImageTextInstruction(meta, 'フォールバックタイトル');
  assert.match(instruction, /左上の角丸ラベルに『田島中』/);
  assert.match(instruction, /特大のメイン文字に『偏差値\+12\.6』/);
  assert.match(instruction, /色帯の上のサブ文字に『田島中2年・体験授業』『応用問題で力がつく』/);
  assert.match(instruction, /小さめの補足に『入試を見据えた応用問題も』/);
  assert.match(instruction, /下部のタグに『田島中・土合中・内谷中』『中間テストまで3週間切る』/);
});

test('buildForcedImageTextInstruction: 旧形式（メイン・サブのみ）は、ラベル・補足・タグの文言を含まない', () => {
  const meta = { label: '', main: '偏差値+12.6', sub1: '田島中2年', sub2: '48→76点', note: '', tags: [] };
  const instruction = buildForcedImageTextInstruction(meta, 'フォールバックタイトル');
  assert.match(instruction, /特大のメイン文字に『偏差値\+12\.6』/);
  assert.match(instruction, /色帯の上のサブ文字に『田島中2年』『48→76点』/);
  assert.doesNotMatch(instruction, /左上の角丸ラベル/);
  assert.doesNotMatch(instruction, /小さめの補足/);
  assert.doesNotMatch(instruction, /下部のタグ/);
});

test('buildForcedImageTextInstruction: metaがnullならフォールバックタイトルをメインとして使う', () => {
  const instruction = buildForcedImageTextInstruction(null, 'フォールバックタイトル');
  assert.match(instruction, /特大のメイン文字に『フォールバックタイトル』/);
});

test('buildForcedImageTextInstruction: メインもフォールバックも無ければ空文字', () => {
  assert.equal(buildForcedImageTextInstruction(null, ''), '');
  assert.equal(buildForcedImageTextInstruction({ label: '', main: '', sub1: '', sub2: '', note: '', tags: [] }, ''), '');
});

// ---------------------------------------------------------------------------
// buildSceneDescriptionSection（教室と場面の描写）
// ---------------------------------------------------------------------------

test('buildSceneDescriptionSection: 授業＝白衣・横並び、面談＝スーツ・向かい合、の日本語ルールを含む', () => {
  const section = buildSceneDescriptionSection();
  assert.match(section, /白衣/);
  assert.match(section, /スーツ/);
  assert.match(section, /横並び/);
  assert.match(section, /向かい合/);
  // 場面の選び方（記事内容からの判断基準）も含む
  assert.match(section, /授業・点数アップ・自習・対策会/);
  assert.match(section, /面談・相談・進路・保護者/);
});

test('buildSceneDescriptionSection: 教室設定・授業の場面・面談の場面の詳細描写（英語）も含む', () => {
  const section = buildSceneDescriptionSection();
  assert.match(section, /white lab coat/);
  assert.match(section, /dark business suit/);
  assert.match(section, /never facing each other/);
  assert.match(section, /never side-by-side/);
});

// ---------------------------------------------------------------------------
// buildImageGenerateMessage（画像生成の送信文）
// ---------------------------------------------------------------------------

test('buildImageGenerateMessage: 送信文に場面ルール（白衣・スーツ・横並び・向かい合わせ）が毎回入る', () => {
  const msg = buildImageGenerateMessage('req001', '', 'ここに画像生成プロンプト');
  assert.match(msg, /白衣/);
  assert.match(msg, /スーツ/);
  assert.match(msg, /横並び/);
  assert.match(msg, /向かい合わせ/);
});

test('buildImageGenerateMessage: 依頼番号行・強制指示・元プロンプトをすべて含む', () => {
  const msg = buildImageGenerateMessage('req002', '強制指示テキスト', '画像プロンプト本体');
  assert.match(msg, /依頼番号：req002/);
  assert.match(msg, /強制指示テキスト/);
  assert.match(msg, /画像プロンプト本体/);
  assert.match(msg, /次の内容で画像を1枚生成してください/);
});

test('buildImageGenerateMessage: forcedTextInstructionが空文字でも落ちない', () => {
  const msg = buildImageGenerateMessage('req003', '', 'プロンプト');
  assert.match(msg, /依頼番号：req003/);
  assert.match(msg, /プロンプト/);
});

// ---------------------------------------------------------------------------
// buildThumbnailArticleSummary（サムネ指示に埋め込む記事本文の軽量化。v0.4.1.6）
// ---------------------------------------------------------------------------
// 2026-09-29に実機で確認：記事HTMLを丸ごと入れていたため、サムネ指示の依頼文が
// 17,133字になり、タブが裏にある時に入力欄への書き込みが長く詰まる不具合があった。
const { fileURLToPath } = require('node:url');
const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

test('buildThumbnailArticleSummary: 実際の記事fixture（sc_yanokuchi）で2,500字程度に収まる', () => {
  const raw = fs.readFileSync(path.join(FIXTURES_DIR, 'sc_yanokuchi-chatgpt.txt'), 'utf8');
  const summary = buildThumbnailArticleSummary(raw);
  assert.ok(summary.length > 0, '本文が空になってはいけない');
  assert.ok(summary.length <= 2500, `2,500字を超えている: ${summary.length}字`);
  // 見出しは■付きで残る
  assert.match(summary, /■ /);
});

test('buildThumbnailArticleSummary: 実際の記事fixture（higashioozima）で2,500字程度に収まる', () => {
  const raw = fs.readFileSync(path.join(FIXTURES_DIR, 'higashioozima-chatgpt.txt'), 'utf8');
  const summary = buildThumbnailArticleSummary(raw);
  assert.ok(summary.length > 0, '本文が空になってはいけない');
  assert.ok(summary.length <= 2500, `2,500字を超えている: ${summary.length}字`);
});

test('buildThumbnailArticleSummary: 長い記事では見出し→数字を含む文→残りの本文、の優先順で切り詰める', () => {
  // 見出し2つ・数字を含む段落1つ・数字を含まない長い段落多数、を持つ合成HTML（2,500字を超える量）。
  const longParaNoDigit = '<p>' + 'あいうえおかきくけこさしすせそたちつてとなにぬねの。'.repeat(6) + '</p>';
  const html = [
    '<h1>見出しA</h1>',
    '<p>途中で320点から395点に伸びました。</p>',
    Array(30).fill(longParaNoDigit).join(''),
    '<h2>見出しB</h2>'
  ].join('');
  const summary = buildThumbnailArticleSummary(html, 500);
  assert.ok(summary.length <= 500, `500字を超えている: ${summary.length}字`);
  assert.match(summary, /■ 見出しA/, '見出しAは優先して残る');
  assert.match(summary, /■ 見出しB/, '見出しBも優先して残る');
  assert.match(summary, /320点から395点/, '数字を含む文は次に優先して残る');
});

test('buildThumbnailArticleSummary: 見出し・段落タグが無ければ空文字', () => {
  assert.equal(buildThumbnailArticleSummary('<div>タグ無し本文</div>'), '');
  assert.equal(buildThumbnailArticleSummary(''), '');
});

test('buildThumbnailArticleSummary: HTMLコメント（旧CTA_DATA・EISAI_TITLES等）は本文に混ざらない', () => {
  const html = '<!--CTA_DATA_START--><!--EISAI_TITLES: ["a"]--><h1>本当の見出し</h1><p>本当の本文</p><!--CTA_DATA_END-->';
  const summary = buildThumbnailArticleSummary(html);
  assert.doesNotMatch(summary, /CTA_DATA/);
  assert.doesNotMatch(summary, /EISAI_TITLES/);
  assert.match(summary, /本当の見出し/);
  assert.match(summary, /本当の本文/);
});

// ---------------------------------------------------------------------------
// buildThumbnailPromptRequest（サムネ生成プロンプト全体。v0.4.1.6）
// ---------------------------------------------------------------------------
test('buildThumbnailPromptRequest: 記事HTMLを丸ごと入れず、軽量化した本文が使われる', () => {
  const raw = fs.readFileSync(path.join(FIXTURES_DIR, 'sc_yanokuchi-chatgpt.txt'), 'utf8');
  const prompt = buildRealThumbnailPromptRequest({
    sourceBlogHtml: raw,
    sourceBlogTitle: 'テストタイトル',
    sourceArticleFacts: '中3のBくん。夏休み前の実力テストは320点→9月395点、75点アップ！',
    requestId: 'p8i4fk'
  });
  // 記事本文の「タグを除いた」見出しは残るが、生のHTMLタグ（<div等）は入らない
  assert.doesNotMatch(prompt, /<div/);
  assert.doesNotMatch(prompt, /<p>/);
  assert.match(prompt, /依頼番号：p8i4fk/);
  assert.match(prompt, /\[\[EISAI_IMG_TEXT\]\]/);
});

test('buildThumbnailPromptRequest: 実際の記事fixtureで、記事本文を丸ごと入れていた旧方式より大幅に短い', () => {
  const raw = fs.readFileSync(path.join(FIXTURES_DIR, 'sc_yanokuchi-chatgpt.txt'), 'utf8');
  const facts = '中3のBくん。夏休み前の実力テストは5教科合計320点→9月の実力テストで395点、75点アップ！';
  const promptWithSummary = buildRealThumbnailPromptRequest({
    sourceBlogHtml: raw,
    sourceBlogTitle: 'テストタイトル',
    sourceArticleFacts: facts,
    requestId: 'abc123'
  });
  // v0.4.1.6より前の「記事HTMLを丸ごと入れる」方式を、同じ関数で再現して比較する
  // （buildThumbnailArticleSummaryを経由せず、生のsourceBlogHtmlをそのまま本文欄に入れる）。
  const oldStyleBodyLen = raw.length; // 旧方式は記事HTML全体（raw）がそのまま入っていた
  const newStyleBodyLen = promptWithSummary.length
    - (buildRealThumbnailPromptRequest({ sourceBlogHtml: '', sourceBlogTitle: 'テストタイトル', sourceArticleFacts: facts, requestId: 'abc123' }).length);
  assert.ok(newStyleBodyLen < oldStyleBodyLen, `軽量化後（${newStyleBodyLen}字）が旧方式の本文量（${oldStyleBodyLen}字）より短くなっていない`);
  assert.ok(newStyleBodyLen <= 2500 + 50, `本文部分がおよそ2,500字を大きく超えている: ${newStyleBodyLen}字`);
});

test('buildThumbnailPromptRequest: 依頼文全体の字数を記録する（実際の記事fixture・実際の選択肢一覧で計測）', () => {
  // v0.4.1.6の目安「依頼文全体は8,000字以下」について：記事本文をbuildThumbnailArticleSummary
  // で最大2,500字に軽量化したことで、記事の長さに比例して依頼文が無限に伸びる問題（実機で
  // 17,133字まで肥大化していた）は解消した。ただし、この関数の残りの部分（記事に依存しない
  // 固定の指示文＋色・型・レイアウト候補などの選択肢一覧）だけで、既に約9,800字ある
  // （下の計測）。8,000字以下にするには固定の指示文自体を削る必要があり、それは今回の
  // 依頼（記事本文の軽量化）の範囲を超えるため、この単体テストでは「記事本文の軽量化により
  // 記事の長さに関係なく総字数が一定の範囲に収まること」だけを確認する（合否条件は16,000字
  // 以下＝実機で確認した17,133字を明確に下回ること）。
  const raw = fs.readFileSync(path.join(FIXTURES_DIR, 'sc_yanokuchi-chatgpt.txt'), 'utf8');
  const facts = '中3のBくん。夏休み前の実力テストは5教科合計320点→9月の実力テストで395点、75点アップ！\n' +
    '夏期講習で毎日自習室に来て、英語と数学の中1・中2の復習をやり直した\n' +
    '英語は62点→81点。単語を毎日30個、音読と書き取りをセットで\n' +
    '数学は58点→79点。関数と図形の基本問題を講師と解き直し';
  const prompt = buildRealThumbnailPromptRequest({
    sourceBlogHtml: raw,
    sourceBlogTitle: 'Bくんの成績が伸びました',
    sourceArticleFacts: facts,
    requestId: 'abc123'
  });
  console.log(`[buildThumbnailPromptRequest] 依頼文全体: ${prompt.length}字（記事本文raw: ${raw.length}字・確定ファクト: ${facts.length}字）`);
  // v0.4.1.7: 実機で計測した「貼り付けが添付ファイル扱いに変わる境目」（8,000字は本文、
  // 10,000字以上は添付）を確実に下回るよう、7,500字以下を合格条件にする。
  assert.ok(prompt.length <= 7500, `7,500字を超えている（添付ファイル扱いになる恐れ）: ${prompt.length}字`);
});

test('buildThumbnailPromptRequest: 長めのメモ（約1,000字）でも7,500字以下に収まる', () => {
  const raw = fs.readFileSync(path.join(FIXTURES_DIR, 'higashioozima-chatgpt.txt'), 'utf8');
  let facts = '';
  while (facts.length < 1000) facts += '中2のAさん。定期テストで数学が48点→76点に上がった。毎回の宿題で間違えた問題だけを解き直した。\n';
  const prompt = buildRealThumbnailPromptRequest({
    sourceBlogHtml: raw,
    sourceBlogTitle: '長めのメモのテスト',
    sourceArticleFacts: facts,
    requestId: 'long01'
  });
  console.log(`[buildThumbnailPromptRequest] 長めのメモ: ${prompt.length}字`);
  assert.ok(prompt.length <= 7500, `7,500字を超えている: ${prompt.length}字`);
});

test('buildThumbnailPromptRequest: 必須の指示（創作禁止・多層の文字・場面と服装・紙の向き・出力形式）が残っている', () => {
  const raw = fs.readFileSync(path.join(FIXTURES_DIR, 'sc_yanokuchi-chatgpt.txt'), 'utf8');
  const prompt = buildRealThumbnailPromptRequest({ sourceBlogHtml: raw, sourceBlogTitle: 't', sourceArticleFacts: 'f', requestId: 'must01' });
  [/創作の禁止/, /4〜6層/, /ラベル/, /サブ帯/, /タグ/, /白衣/, /スーツ/, /横並び/, /向かい合/, /正面向きで見せない/, /細かい文字/, /\[\[EISAI_IMG_PROMPT\]\]/, /\[\[EISAI_IMG_TEXT\]\]/, /画像は生成しないでください/, /依頼番号：must01/]
    .forEach(re => assert.match(prompt, re));
});
