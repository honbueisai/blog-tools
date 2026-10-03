// ==UserScript==
// @name         Eisai Blog Generator for ChatGPT
// @namespace    http://tampermonkey.net/
// @version      0.4.1
// @description  英才ブログ生成ツール (ChatGPT対応 / Gemini版とは別ファイル)
// @author       Yuan
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @updateURL    https://raw.githubusercontent.com/honbueisai/blog-tools/main/blog-generator-chatgpt.user.js
// @downloadURL  https://raw.githubusercontent.com/honbueisai/blog-tools/main/blog-generator-chatgpt.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // v0.4.1.0: 「合言葉（リクエストID）方式」の中核。ChatGPTのDOM構造（role属性・
  // data-testid・停止ボタン等）に依存する「画面の作り」ベースの判定は、アカウント・A/Bテストで
  // 頻繁に変わり壊れるため全廃した。代わりに、送信ごとに短いランダムID（依頼番号）を発行し、
  // プロンプト側に「回答の最初の行に開始目印・最後の行に終了目印を書く」よう指示する。
  // 読み取り側は画面のDOM構造を一切問わず、目印の文字列だけを探す（collectMainTextIndex等・
  // 下記）。これにより、DOM構造がどう変わっても（役割属性の有無・ネストの深さ・要素の分割）
  // 同じ仕組みで読み取れる。
  //
  // 依頼番号：小文字英字＋数字6文字（衝突しても実害は小さいが、念のため毎回ランダムに作る）。
  function makeRequestId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function startMarkerText(requestId) { return '[[EISAI-START-' + requestId + ']]'; }
  function endMarkerText(requestId) { return '[[EISAI-END-' + requestId + ']]'; }

  // v0.4.1.0: 送信確認・失敗文言の切り分けに使う、画面に残る素朴な合言葉。
  // プロンプト中に1回だけ書く（buildRequestIdLine）。
  function buildRequestIdLine(requestId) {
    return `（依頼番号：${requestId}）`;
  }
  function requestIdNeedle(requestId) {
    return `依頼番号：${requestId}`;
  }

  // v0.4.1.0: 記事プロンプト（buildBlogPromptV3）・サムネ用メタプロンプト（imgGenBtn.onclickの
  // promptRequest）の両方の末尾に付ける、目印の書き方の指示。
  // 重要：この指示文そのものの中に、完成した目印（「[[」から「]]」までを実際につなげた形）を
  // 1字も連続して書かない。部品（「[[」／「EISAI-START-」／依頼番号／「]]」）をそれぞれ
  // 別の引用符で挟んで説明することで、送る文章の中では目印が未完成のまま保たれる
  // （目印が完成した形で画面に残ると、それを「ChatGPT自身が書いた開始/終了の目印」と
  // 取り違えてしまうため）。
  function buildMarkerInstructionBlock(requestId) {
    return `
■ 出力の目印（今までの指示に必ず追加してください。省略しないでください）
${buildRequestIdLine(requestId)}
- 回答の最初の行には、角かっこ2つ「[[」に続けて「EISAI-START-」、続けてこの依頼番号「${requestId}」、最後に「]]」を、空白を一切入れずにそのままつなげた1行だけを書いてください（他の文字は書かないでください）。
- 回答の最後の行には、同じように角かっこ2つ「[[」に続けて「EISAI-END-」、続けてこの依頼番号「${requestId}」、最後に「]]」を、空白を一切入れずにそのままつなげた1行だけを書いてください（他の文字は書かないでください）。
- この2行は本文の一部ではありません。本文の前後に、独立した1行として置いてください。
- この目印を完成させた形は、この指示を説明するための文章の中では書かないでください。あなたが実際に回答するときに、初めて完成させてください。`;
  }

  // v0.4.1.0:「記事らしさ」の唯一の入り口（貼り付けて読み込む・目印が無い時の保険専用）。
  // 通常の読み取りは目印（[[EISAI-START-…]]〜[[EISAI-END-…]]）だけを見るため、DOM構造や
  // 「プロンプトの決まり文句」の除外リストは一切不要になった。<h1>…</h1>（見出しらしい
  // 短い1行）を持つことだけを、貼り付けテキストの<h1>切り出し（trimToArticleBounds）と
  // 内容チェック（hasEnoughArticleHtml）が共有する。
  const CLOSED_H1_RE = /<h1>[^<\n]{2,120}<\/h1>/i;

  function hasClosedArticleHeading(text) {
    return CLOSED_H1_RE.test(typeof text === 'string' ? text : String(text || ''));
  }

  // v0.4.0: Node（単体テスト用。例：findUnverifiedClaims・trimToArticleBoundsのテスト）から
  // require() された場合は、ブラウザ専用のDOM初期化処理を実行せずここで抜ける。
  // 関数宣言のためホイスティングにより下の定義を参照できる。
  if (typeof module !== 'undefined' && module.exports) {
    // v0.4.0: 入力モード（かんたん／しっかり）対応のため buildBlogPromptV3 もNodeから呼べるようにする。
    // v0.4.0.4: サムネ送信文の組み立て（[[EISAI_IMG_TEXT]]の解析・強制指示文の生成）もNodeから確認できるようにする。
    // v0.4.1.3: サムネの「教室と場面の描写」節・画像生成の送信文組み立てもNodeから確認できるようにする。
    // v0.4.1.6: サムネ指示に埋め込む記事本文の軽量化（buildThumbnailArticleSummary）・
    // サムネ生成プロンプト全体の組み立て（buildThumbnailPromptRequest）もNodeから
    // 字数を確認できるようにする。
    module.exports = {
      findUnverifiedClaims,
      trimToArticleBounds,
      buildBlogPromptV3,
      extractImgTextMeta,
      buildForcedImageTextInstruction,
      buildSceneDescriptionSection,
      buildImageGenerateMessage,
      buildThumbnailArticleSummary,
      buildThumbnailPromptRequest,
      // v0.4.1: 最後の申込枠の復活（AIが書いた最後のCTAの除去・CTA_DATAの読み取り）
      removeFinalEisaiCta,
      parseCtaData
    };
    return;
  }

  const CURRENT_VERSION = '0.4.1';
  // v0.4.0.5: パネル見出しの版表示だけ、Tampermonkey等が渡す GM_info.script.version があれば
  // それを使う（テスト版インストール時は 0.4.0.N のようなテスト版番号が出る）。
  // @grant none環境やGM_info未対応環境でも落ちないよう、try/typeofで守る。
  // ストレージキー等（STORAGE_KEY・VERSION_ID等）はCURRENT_VERSIONのまま変えない。
  function getDisplayVersion() {
    try {
      if (typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.version) {
        return String(GM_info.script.version);
      }
    } catch (e) {
      // GM_info未定義・アクセス不可のときはCURRENT_VERSIONにフォールバックする
    }
    return CURRENT_VERSION;
  }
  const VERSION_ID = CURRENT_VERSION.replace(/\./g, '-');
  const VERSION_KEY = CURRENT_VERSION.replace(/\./g, '');
  const TOOL_ID = `eisai-chatgpt-tool-v${VERSION_ID}`;
  const BTN_ID = `eisai-chatgpt-btn-v${VERSION_ID}`;
  const STORAGE_KEY = `eisai_chatgpt_blog_info_v${VERSION_KEY}`;
  const CLASSROOM_STORAGE_KEY = 'eisai_classroom_settings_persistent';
  const UPDATE_URL = 'https://raw.githubusercontent.com/honbueisai/blog-tools/main/blog-generator-chatgpt.user.js';
  const TEST_MODE_STORAGE_KEY = 'eisai_chatgpt_test_mode_enabled';
  // v0.4.0: 記事入力（ペルソナ→事実フォーム）の自動保存先。バージョン非依存の固定キー。
  const ARTICLE_DRAFT_STORAGE_KEY = 'eisai_chatgpt_article_draft_v040';
  const GENERATED_CONTEXT_STORAGE_KEY = 'eisai_chatgpt_last_generated_context';
  const GENERATED_CONTEXT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const PANEL_WIDTH = 420;
  const PANEL_TAB_WIDTH_FALLBACK = 42;
  const PANEL_OPEN_LAYOUT_CLASS = 'eisai-chatgpt-panel-open';
  // v0.4.0.5: 「架空中」「架空エリア」のような表記は記事タイトルに出た時（例：【架空中・…】）不自然なため、
  // 記事に出ても違和感のない、実在の地名・学校名と紛らわしくない自然な架空名にする。
  const TEST_CLASSROOM = {
    name: '英才テスト校',
    manager: '山田',
    area: 'テスト市',
    schools: 'テスト市立第一中学校, テスト市立第二中学校',
    url: 'https://example.com/eisai-test-form',
    tel: '0000000000',
    line: '',
    address: 'テスト県テスト市テスト1-2-3',
    access: 'テスト線「テスト駅」徒歩3分',
    hours: '平日15:00〜21:00、土日13:00〜19:00'
  };

  // v0.4.0.5: 教室情報の必須項目（校舎名・室長名・申込URL）を1箇所で定義し、
  // 必須ピル・isClassroomComplete()・collectMissingLabels()・見出し文言のすべてがここを参照する
  // （項目がズレるのを防ぐための単一の定義元）。
  const REQUIRED_CLASSROOM_FIELDS = [
    { key: 'name', missingLabel: '教室情報の校舎名' },
    { key: 'manager', missingLabel: '教室情報の室長名' },
    { key: 'url', missingLabel: '教室情報の申込フォームURL' }
  ];
  const REQUIRED_CLASSROOM_SUMMARY_TEXT = '教室情報（必須：校舎名・室長名・申込URL）';
  function isClassroomInfoComplete(info) {
    const target = info || {};
    return REQUIRED_CLASSROOM_FIELDS.every(field => !!(target[field.key] || '').trim());
  }
  function collectMissingClassroomLabels(info) {
    const target = info || {};
    return REQUIRED_CLASSROOM_FIELDS
      .filter(field => !(target[field.key] || '').trim())
      .map(field => field.missingLabel);
  }

  // v0.4.0: 記事タイプは「悩み解決型」「ストーリー型」の2択（旧5タイプは廃止）。
  // v0.4.0（入力モード追加）: かんたんモードでは「おまかせ（メモから判断）」も選べる。
  // v0.4.1: 「ビフォー・アフター型（成果・変化）」を追加し、標準の型にした（湯浅さん指示
  // 2026-09-29：情報提供の流れではなく、生徒の変化＝ビフォー・アフターをメインにする）。
  // 悩み解決型（情報提供）は、自分で選んだ時だけ使う。
  const ARTICLE_TYPES = {
    BA: 'ba',
    SOLVE: 'solve',
    STORY: 'story',
    AUTO: 'auto'
  };
  // 保存済みの下書きにこの印が無い（v0.4.0以前の下書き）時は、型をビフォー・アフター型に切り替える。
  const ARTICLE_TYPE_SCHEME = 2;

  // v0.4.0: 入力モード（かんたん＝メモ1つだけ必須／しっかり＝項目別・今のフォーム）。選択は保存する。
  const INPUT_MODES = {
    EASY: 'easy',
    DETAILED: 'detailed'
  };
  const INPUT_MODE_STORAGE_KEY = 'eisai_chatgpt_input_mode_v040';
  function loadInputMode() {
    try {
      return localStorage.getItem(INPUT_MODE_STORAGE_KEY) === INPUT_MODES.DETAILED
        ? INPUT_MODES.DETAILED
        : INPUT_MODES.EASY;
    } catch (e) {
      return INPUT_MODES.EASY;
    }
  }
  function saveInputMode(mode) {
    try {
      localStorage.setItem(INPUT_MODE_STORAGE_KEY, mode);
    } catch (e) {
      console.error('Save Input Mode Error:', e);
    }
  }

  let currentInputMode = loadInputMode();
  let currentArticleType = ARTICLE_TYPES.BA;

  syncTestModeFlagFromLocation();
  console.log(`🚀 英才ブログ生成ツール ChatGPT版 v${CURRENT_VERSION} 起動`);
  if (isTestModeEnabled()) {
    console.log('🧪 英才ブログ生成ツール ChatGPT版 テストモード有効');
  }

  let lastBlogHtml = '';
  let lastArticleFacts = '';
  let lastBlogTitle = '';
  // v0.4.1.0: 直前に送った記事生成プロンプトの依頼番号（「読み取り直す」で使う）。
  let lastArticleRequestId = '';
  let lastImagePromptText = '';
  // v0.4.0.4: [[EISAI_IMG_TEXT]]行を含む、サムネイル指示生成の生テキスト（画像生成送信時の文字強制指示の元データ）
  let lastImageRawResponseText = '';
  // v0.4.0.4: サムネイル指示生成時に確定したタイトル（[[EISAI_IMG_TEXT]]が取れなかった時のフォールバック用）
  let lastThumbTitleForImage = '';
  // v0.4.0.4: 画像生成の完了（img naturalWidth>0 検出）を、サムネのステップ表示に反映するためのフラグ
  let thumbnailImageDetected = false;
  let lastTitleCandidates = [];
  // v0.4.0: 結果パネル（自己チェック・実測・要確認）表示用の状態
  let lastEisaiCheck = null;
  let lastArticleMetrics = null;
  let lastUnverifiedClaims = [];

  // =========================================================
  // 1. サムネイルスタイル / 画像スタイル定義
  // =========================================================
  const VISUAL_STYLES = {
    '実写スタイル': 'Photorealistic style, shot on DSLR, authentic Japanese cram school atmosphere',
    'アニメスタイル': 'Modern Japanese anime style, vibrant colors, clean lines, cel shaded, Kyoto Animation style, high quality illustration',
    'インフォグラフィック': '3D isometric icon style, clay render, minimalism, clean background, educational infographic, data visualization',
    '漫画スタイル': 'Japanese manga style, black and white with screentones, comic book art, dramatic lines, ink drawing, speech bubbles',
    'YOUTUBEスタイル': 'YouTube thumbnail style, photorealistic, hyper-saturated colors, bold outlines, clear contrast, catchy visuals, close-up, professional photography',
    'インパクトスタイル': 'Dynamic angle, fish-eye lens, high contrast, intense lighting, dramatic shadows, movie poster quality, explosion of colors'
  };

  // v0.4.1.3: これらは以前const（トップレベル変数）だったが、module.exportsの早期return
  // （Nodeからの単体テスト用）より後ろにあるconstはNodeから参照すると未初期化のまま
  // （gradeLevelWordSource関数のコメント参照）になるため、関数宣言（ホイスティングされ、
  // Nodeのテストからも安全に呼べる）に変更した。buildSceneDescriptionSectionから使う。
  function classroomDescriptionText() {
    return 'A bright, clean, modern Japanese cram school classroom filled with soft natural light. Large windows with sheer white curtains diffuse daylight evenly across the room, creating a gentle, calm atmosphere. The interior is minimalist and white-based: smooth white walls, white ceilings, and uncluttered decor. White rectangular desks with simple, modern legs are arranged in rows, providing wide workspace for two people to sit side-by-side. On the desks are neatly arranged study materials such as notebooks, pens, and open textbooks, without clutter. Chairs are lightweight, white plastic with small perforations on the backrest, matching the clean and modern design of the room. The overall space feels open, bright, and warm, with a soft photographic depth of field and natural diffusion that highlights a quiet, studious environment.';
  }

  // v0.4.1.3: 授業の場面。以前は「服装は指定しない」だったが、実機の本部実例に寄せるため、
  // 先生は白衣（white lab coat）、生徒は制服または私服と明記した。横並び・向かい合わせにしない
  // （never facing each other）は維持。
  function tutoringSceneStyleText() {
    return 'Two people sit side-by-side at a white desk, engaging in a one-on-one tutoring session. The teacher wears a clean white lab coat over their clothes; the student wears a school uniform or casual clothes. Faces or identities are not emphasized. They are positioned horizontally next to each other, never facing each other. One person (the teacher, in the white coat) provides gentle academic guidance while the other (the student) takes notes or works through a problem. Hands, textbooks, and writing tools are visible on the desk, capturing the natural movement of a study session without defining who the individuals are. The focus is on the interaction and learning atmosphere, not the identity of the participants.';
  }

  // v0.4.1.3: 新設。面談の場面（保護者面談・進路相談等）。机をはさんで向かい合い、室長はダーク
  // スーツ＋ネクタイ、保護者・生徒は私服。授業の場面（横並び）とは向きをはっきり分ける。
  function meetingSceneStyleText() {
    return 'Two or three people sit facing each other across a table or desk, engaging in a calm parent-teacher or student consultation meeting. The school director/manager wears a dark business suit with a necktie; parents and students wear casual clothes. Faces or identities are not emphasized. They are positioned facing each other across the table, never side-by-side. Materials such as a report card, notebook, or planning sheet may be visible between them, showing an attentive, consultative conversation. The focus is on the interaction and consultative atmosphere, not the identity of the participants.';
  }

  // v0.4.1.3: promptRequestの「■ 参照画像（アップロード写真）の扱い」が「下記のClassroom
  // Setting / Tutoring Styleの描写を使ってください」と案内しているのに、その描写自体が
  // promptRequest本文に一度も入っておらず空振りしていた不具合の修正。この節を実際に
  // promptRequestへ埋め込む（写真が無い時に使う教室・場面描写、と場面の選び方）。
  // v0.4.1.7: サムネ指示を7,500字以内に収めるため、長い英語の描写3本（約2,000字）を、
  // 場面の選び方・向き・服装の要点だけの短い日本語＋英語1文ずつにまとめた（英語1文は
  // 画像生成AIへそのまま伝わりやすい要点。white lab coat／dark business suit等）。
  function buildSceneDescriptionSection() {
    return `■ 写真の場面（人物を入れる時は必ず守る）
記事が授業・点数アップ・自習・対策会の内容なら「授業の場面」、面談・相談・進路・保護者向けの内容なら「面談の場面」にする。
- 授業の場面：先生と生徒が白い机に横並びで座る個別指導。向かい合わない。先生は必ず白衣を着ている。（Teacher and student sit side-by-side at a white desk, never facing each other; the teacher always wears a clean white lab coat.）
- 面談の場面：机をはさんで向かい合って面談する。室長は必ずダークスーツにネクタイ、保護者・生徒は私服。（They sit facing each other across a desk, never side-by-side; the director wears a dark business suit with a necktie.）
- 教室：白い壁・白い机と椅子の、明るくすっきりした教室。窓からのやわらかい自然光。`;
  }

  const THUMBNAIL_ART_DIRECTIONS = [
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

  const THUMBNAIL_LAYOUT_VARIANTS = [
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

  // サムネイル型はブログ内容から自動判断（v0.2.0以降 'おまかせ' 固定）。UIの型選択は廃止済み。
  const THUMBNAIL_TYPE_OPTIONS = {
    'おまかせ': 'Auto-select the strongest thumbnail objective from the article (score/result, evidence object like notebook or answer sheet, before/after, parent pain-point, student change moment, person spotlight when a photo is uploaded, or event). Choose based on the main visual hook, not on a fixed template.'
  };

  // 見た目は実写固定（v0.2.0以降）。UIの見た目選択は廃止済み。
  const VISUAL_EXPRESSION_OPTIONS = {
    '実写': VISUAL_STYLES['実写スタイル']
  };

  const TEXT_IMPACT_OPTIONS = {
    '標準': 'Readable and clean. A clear headline, calm photo, and simple contrast.',
    '強め': 'Recommended. Make the headline feel big, loud, and instantly readable, like a strong YouTube/blog thumbnail. Let the text overlap the photo if it helps.',
    '最大インパクト': 'Maximum impact. One huge phrase or number should hit first, with bold color, thick outline, and a dramatic crop.'
  };

  const COLOR_STYLES = {
    '赤': { main: 'Red', sub: 'Dark Red', hex: '#FF4444', gradient: 'Red to Dark Red' },
    'ピンク': { main: 'Pink', sub: 'Rose Pink', hex: '#FF69B4', gradient: 'Pink to Rose Pink' },
    'オレンジ': { main: 'Orange', sub: 'Dark Orange', hex: '#FF8C00', gradient: 'Orange to Dark Orange' },
    'イエロー': { main: 'Yellow', sub: 'Golden Yellow', hex: '#FFD700', gradient: 'Yellow to Golden Yellow' },
    'グリーン': { main: 'Green', sub: 'Forest Green', hex: '#32CD32', gradient: 'Green to Forest Green' },
    'ブルー': { main: 'Blue', sub: 'Navy Blue', hex: '#1E90FF', gradient: 'Blue to Navy Blue' },
    'スカイブルー': { main: 'Sky Blue', sub: 'Light Blue', hex: '#87CEEB', gradient: 'Sky Blue to Light Blue' },
    'パープル': { main: 'Purple', sub: 'Deep Purple', hex: '#9370DB', gradient: 'Purple to Deep Purple' },
    '白黒': { main: 'Black', sub: 'White', hex: '#000000', gradient: 'Black to White' }
  };

  // =========================================================
  // 4. 共通ヘルパー
  // =========================================================
  function createEl(tag, props = {}, parent = null, text = '') {
    const el = document.createElement(tag);
    const { className, style, ...rest } = props;
    if (className) el.className = className;
    if (style) Object.assign(el.style, style);
    Object.assign(el, rest);
    if (text) el.textContent = text;
    if (parent) parent.appendChild(el);
    return el;
  }

  // v0.4.0: requiredPill=trueのとき、ラベルの右に「必須」ピルを付ける（見た目のみ。必須判定ロジックは呼び出し側のまま）。
  function createInput(parent, label, ph, isArea = false, requiredPill = false) {
    const wrap = createEl('div', { className: 'eisai-input-wrap' }, parent);
    const labelRow = createEl('div', { className: 'eisai-label-row' }, wrap);
    createEl('span', { className: 'eisai-label', style: { marginBottom: '0' } }, labelRow, label);
    if (requiredPill) createEl('span', { className: 'eisai-required-pill' }, labelRow, '必須');
    const input = createEl(isArea ? 'textarea' : 'input', { className: 'eisai-input' }, wrap);
    if (isArea) input.style.height = '80px';
    input.placeholder = ph;
    return input;
  }

  function syncTestModeFlagFromLocation() {
    const href = location.href || '';
    if (href.indexOf('eisai_test=1') >= 0) {
      localStorage.setItem(TEST_MODE_STORAGE_KEY, 'true');
    }
    if (href.indexOf('eisai_test=0') >= 0) {
      localStorage.removeItem(TEST_MODE_STORAGE_KEY);
    }
  }

  function isTestModeEnabled() {
    return localStorage.getItem(TEST_MODE_STORAGE_KEY) === 'true';
  }

  function setTestModeEnabled(enabled) {
    if (enabled) {
      localStorage.setItem(TEST_MODE_STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(TEST_MODE_STORAGE_KEY);
    }
  }

  function setChatAvoidance(enabled) {
    const shouldApply = enabled && window.innerWidth > 900;
    const toggleBtn = document.getElementById('eisai-toggle-btn');
    const tabWidth = toggleBtn ? Math.ceil(toggleBtn.getBoundingClientRect().width || PANEL_TAB_WIDTH_FALLBACK) : PANEL_TAB_WIDTH_FALLBACK;
    const reservedWidth = PANEL_WIDTH + tabWidth;
    document.documentElement.classList.toggle(PANEL_OPEN_LAYOUT_CLASS, shouldApply);
    if (document.body) {
      document.body.classList.toggle(PANEL_OPEN_LAYOUT_CLASS, shouldApply);
      if (shouldApply) {
        document.body.style.setProperty('--eisai-chatgpt-panel-width', `${PANEL_WIDTH}px`);
        document.body.style.setProperty('--eisai-chatgpt-tab-width', `${tabWidth}px`);
        document.body.style.setProperty('--eisai-chatgpt-reserved-width', `${reservedWidth}px`);
      } else {
        document.body.style.removeProperty('--eisai-chatgpt-panel-width');
        document.body.style.removeProperty('--eisai-chatgpt-tab-width');
        document.body.style.removeProperty('--eisai-chatgpt-reserved-width');
      }
    }
  }

  function removeLauncherButton() {
    const launcher = document.getElementById(BTN_ID);
    if (launcher) launcher.remove();
  }

  function setPanelCollapsed(panel, toggleBtn, collapsed) {
    if (!panel) return;
    panel.style.display = 'flex';
    panel.classList.toggle('collapsed', collapsed);
    if (toggleBtn) toggleBtn.classList.toggle('collapsed', collapsed);
    localStorage.setItem('eisai_collapsed', collapsed ? 'true' : 'false');
    syncChatAvoidance(panel);
  }

  function syncChatAvoidance(panel) {
    const isOpen = Boolean(
      panel &&
      panel.style.display !== 'none' &&
      !panel.classList.contains('collapsed')
    );
    setChatAvoidance(isOpen);
  }

  function bindChatAvoidanceResize() {
    if (window.__eisaiChatgptAvoidanceResizeBound) return;
    window.__eisaiChatgptAvoidanceResizeBound = true;
    window.addEventListener('resize', () => {
      syncChatAvoidance(document.getElementById(TOOL_ID));
    });
  }

  // v0.4.0: 教室設定を拡張（校舎名/室長名/地域駅名/近隣対象校/申込URL/電話/LINE URL/住所/アクセス/受付時間）。
  // 既存キー（kosha/shichou 等の旧バージョン付きミラーを含む）は読み込めるよう互換を保つ。
  const CLASSROOM_FIELD_KEYS = ['name', 'manager', 'area', 'schools', 'url', 'tel', 'line', 'address', 'access', 'hours'];

  function getSetting() {
    try {
      if (isTestModeEnabled()) {
        return {
          ...TEST_CLASSROOM,
          kosha: TEST_CLASSROOM.name,
          shichou: TEST_CLASSROOM.manager
        };
      }

      const versionedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const classroomData = JSON.parse(localStorage.getItem(CLASSROOM_STORAGE_KEY) || '{}');
      return {
        ...versionedData,
        ...classroomData,
        name: classroomData.name || classroomData.kosha || versionedData.kosha || versionedData.name || '',
        manager: classroomData.manager || classroomData.shichou || versionedData.shichou || versionedData.manager || '',
        area: classroomData.area || versionedData.area || '',
        schools: classroomData.schools || versionedData.schools || '',
        url: classroomData.url || versionedData.url || '',
        tel: classroomData.tel || versionedData.tel || '',
        line: classroomData.line || versionedData.line || '',
        address: classroomData.address || versionedData.address || '',
        access: classroomData.access || versionedData.access || '',
        hours: classroomData.hours || versionedData.hours || ''
      };
    } catch {
      return { name: '', manager: '', area: '', schools: '', url: '', tel: '', line: '', address: '', access: '', hours: '' };
    }
  }

  function saveSetting(info) {
    try {
      const currentPersistent = JSON.parse(localStorage.getItem(CLASSROOM_STORAGE_KEY) || '{}');
      const classroomData = {};
      CLASSROOM_FIELD_KEYS.forEach(key => {
        classroomData[key] = info[key] !== undefined ? info[key] : currentPersistent[key];
      });
      localStorage.setItem(CLASSROOM_STORAGE_KEY, JSON.stringify(classroomData));
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...classroomData,
        kosha: classroomData.name,
        shichou: classroomData.manager
      }));
    } catch (e) {
      console.error('Save Setting Error:', e);
    }
  }

  // v0.4.0: 記事入力（ペルソナ→事実フォーム）の自動保存・復元・クリア。
  function loadArticleDraft() {
    try {
      return JSON.parse(localStorage.getItem(ARTICLE_DRAFT_STORAGE_KEY) || 'null') || null;
    } catch {
      return null;
    }
  }

  function saveArticleDraft(data) {
    try {
      // v0.4.1: 型の印（ARTICLE_TYPE_SCHEME）を付けて保存する（印の無い古い下書きは標準の型に切り替えるため）
      localStorage.setItem(ARTICLE_DRAFT_STORAGE_KEY, JSON.stringify(Object.assign({}, data, { typeScheme: ARTICLE_TYPE_SCHEME })));
    } catch (e) {
      console.error('Save Article Draft Error:', e);
    }
  }

  function clearArticleDraft() {
    try {
      localStorage.removeItem(ARTICLE_DRAFT_STORAGE_KEY);
    } catch (e) {
      console.error('Clear Article Draft Error:', e);
    }
  }

  // v0.4.0: プロトタイプv3のbuildPrompt()を移植（文言は1文字も変えない）。
  // 値の取り出し（v('xxx')）だけ、拡張機能のフォーム(articleData)／教室設定(classroomInfo)から取る。
  function buildBlogPromptV3(articleData, classroomInfo, requestId) {
    const effectiveRequestId = requestId || makeRequestId();
    function v(id) {
      switch (id) {
        case 'kosha': return String((classroomInfo && classroomInfo.name) || '').trim();
        case 'shichou': return String((classroomInfo && classroomInfo.manager) || '').trim();
        case 'area': return String((classroomInfo && classroomInfo.area) || '').trim();
        case 'schools': return String((classroomInfo && classroomInfo.schools) || '').trim();
        case 'ctaUrl': return String((classroomInfo && classroomInfo.url) || '').trim();
        case 'tel': return String((classroomInfo && classroomInfo.tel) || '').trim();
        case 'line': return String((classroomInfo && classroomInfo.line) || '').trim();
        case 'address': return String((classroomInfo && classroomInfo.address) || '').trim();
        case 'access': return String((classroomInfo && classroomInfo.access) || '').trim();
        case 'hours': return String((classroomInfo && classroomInfo.hours) || '').trim();
        default: return String((articleData && articleData[id]) || '').trim();
      }
    }
    const rel=['r1','r2','r3'].map(v).filter(Boolean).map(x=>{ const [t,u]=x.split('｜').map(s=>(s||'').trim()); return u?`- ${t}｜${u}`:`- ${t}`; });
    // v0.4.0: 入力モード（かんたん／しっかり）と、記事の型「おまかせ」（かんたんモードの既定）。
    const isEasyMode=(articleData && articleData.mode)==='easy';
    const isAuto=(articleData && articleData.type)==='auto';
    const isStory=(articleData && articleData.type)==='story';
    const isSolve=(articleData && articleData.type)==='solve';
    // v0.4.1: 型の指定が無い・不明な時は、ビフォー・アフター型にする（標準の型）。
    const isBA=!isAuto&&!isStory&&!isSolve;
    // v0.4.1: 文字数が未選択の時は「本文 字。」にならないよう、既定値（1,800〜2,200字）にする
    //         （フォームの既定値も defaultArticleInput() 側で同じ値にしている）。
    const len=v('length')||'1800-2200';
    // v0.4.0: つなげたい行動の既定値（未入力なら「無料学習相談」）
    const actionText=v('action')||'無料学習相談';
    // v0.4.0: 「誰に」（学年・対象校・時期）が空欄でも文が崩れないようにする（かんたんモード・任意化対応）
    // v0.4.1: 時期が空欄の時に「このタイミング」という存在しない言葉を作らないようにする
    //         （ゴール文・導入で使う言い回しは、空欄かどうかで文ごと切り替える）。
    const timingRaw=v('timing');
    const goalTimingPhrase=timingRaw?`「${timingRaw}」に検索して読み`:'検索して読み';
    const introTimingPhrase=timingRaw?`時期のきっかけ（${timingRaw}）に触れ`:'時期のきっかけ（メモや事実から読み取れれば）に触れ';
    const empathyTimingLabel=timingRaw||'今の時期';
    const personaParts=[v('grade'),v('tSchools')].filter(Boolean);
    const personaPrefix=personaParts.length?personaParts.join('・')+'の':'';
    // v0.4.0: 悩み／家庭でできることが空欄の時は、書き方を切り替える（かんたん・しっかり共通）
    const hasWorries=Boolean(v('w1')||v('w2')||v('w3'));
    const hasHomeSteps=Boolean(v('h1')||v('h2')||v('h3'));
    // 8. 教室情報：住所・アクセス・受付時間・対象校は入力が空なら行を出さない
    const schoolsLabel=v('schools')||v('tSchools');
    const schoolInfoParts=[`英才個別学院 ${v('kosha')}`,`室長：${v('shichou')}`];
    if(v('address')) schoolInfoParts.push(`住所：${v('address')}`);
    if(v('access')) schoolInfoParts.push(`アクセス：${v('access')}`);
    let telHoursLine='';
    if(v('tel')&&v('hours')) telHoursLine=`電話：${v('tel')}（受付 ${v('hours')}）`;
    else if(v('tel')) telHoursLine=`電話：${v('tel')}`;
    else if(v('hours')) telHoursLine=`受付時間：${v('hours')}`;
    if(telHoursLine) schoolInfoParts.push(telHoursLine);
    if(schoolsLabel) schoolInfoParts.push(`対象校：${schoolsLabel}`);
    const schoolInfoHtml=`<div class="eisai-school-info">${schoolInfoParts.join('<br>')}</div>`;
    // v0.4.0: 悩みが空欄の時は「よく聞くお悩み」の引用ではなく、問いかけの形にする（empathy-boxのラベルも合わせる）。
    // 入力がある時は元の文言のまま（1文字も変えない）。
    const empathyInstruction=hasWorries
      ? '悩みを3つ「よく聞くお悩み」としてセリフをそのまま引用して並べる（<div class="eisai-empathy-box"> に <ul> で）'
      : `${v('grade')||'この学年'}・${empathyTimingLabel}の保護者が抱きやすい悩みを3つ考え、「こんなお悩みはありませんか？」という問いかけの形で並べる（<div class="eisai-empathy-box"> に <ul> で。<strong>ラベル</strong>は「こんなお悩みはありませんか？」にする）。「よく聞く」「〜と相談されました」のように実際に聞いたことにはしない`;
    // 1. 本論（型ごとに出し分け）：悩み解決型は手順×教室の対、ストーリー型は出来事の流れ＋事例＋家庭でできることを本論の後に集約
    // v0.4.0: 家庭でできることが空欄の時は、記事の内容から一般的な学習方法の範囲で考えてよい（教室の実績・数字・日付は作らない）。
    // 入力がある時は元の文言のまま（1文字も変えない）。
    const homeStepsNoteSolve=hasHomeSteps
      ? '（入力の3つを1つずつ）'
      : '（入力が無いので、記事の内容から家庭で今日からできる具体的な手順を3つ考えて書いてよい。一般的な学習方法の範囲にとどめ、教室の実績・数字・日付は作らない）';
    const homeStepsNoteStory=hasHomeSteps
      ? ''
      : '（入力が無いので、記事の内容から家庭で今日からできる具体的な手順を3つ考えて書いてよい。一般的な学習方法の範囲にとどめ、教室の実績・数字・日付は作らない）';
    // v0.4.1: 写真の入力が空欄の時に、存在しない項目名（「現場で撮れるもの」という架空の入力）を作らない。
    const photoDefaultDesc='その場面で撮れそうなもの（教室の様子・ノート・プリントなど）';
    const photoDefaultDescPlain='教室の様子・ノート・プリントなど、その場面で撮れそうなもの';
    const photoAssignInstruction=v('photos')
      ? `入力の写真「${v('photos')}」を場面ごとに割り振る`
      : `写真は、${photoDefaultDesc}を指示する`;
    const step3Story=`3. 本論（ストーリー型）：<h2> をちょうど3つ、出来事の流れで書く（例：当日の様子／生徒の変化・事例／終わってから・次に向けて、という3幕構成。見出し文はこの例をそのまま使わず記事に合わせて作る）。教室固有の仕組み・データ用に新しい<h2>を追加しない（5.参照）。学校ごとの教科数が揃わない時は、3つ目以降の教科を<h3>で本論の中に足してよい（<h2>は増やさない）。見出しの文頭に①②③・数字・STEPは付けない（エディタが自動で 01/02/03 を付けます）。見出しの中では「家庭でできる手順」は書かない。日時・人数・対象などのデータは、当てはまる見出しの中で <table>（各行 <tr><th>項目</th><td>内容</td></tr> の「項目＝th／内容＝td」）にまとめる。事例は入力の事例・事実から1件ずつ書き、必ず「学年・イニシャル・教科・担当講師名」を明記する。入力（facts・事例）に生徒の反応や変化が書いてあれば、それを落とさずに書く（書いていなければ新しく作らない。表情・動作・セリフを想像で加えない）。写真プレースホルダー（<p data-photo-placeholder="true"><strong>■ 写真：何を撮るか</strong></p>）は、その場面を書いた直後に置く（${photoAssignInstruction}）。<h2>3つの本論が終わったところで、家庭でできること3つを1つにまとめて書く${homeStepsNoteStory}：<div class="eisai-point-list"><strong>ご家庭でできること</strong><ul><li>…</li></ul></div>。中間CTA（次項）は本論2つ目の見出しの後のまま。`;
    // v0.4.1: ビフォー・アフター型（標準）。生徒の変化（前→後）を主役にし、家庭でできることは本論の後に1つにまとめる。
    const step3BA=`3. 本論（ビフォー・アフター型）：<h2> をちょうど3つ、この順で書く。①ビフォー：以前はどんな状態だったか（点数・成績・つまずき・困っていたこと。入力にあることだけ）②教室でやったこと：変化のために何をしたか（取り組みの中身・担当講師名・期間や回数。進め方は <ol class="eisai-steps"><li>…</li></ol> で）③アフター：どう変わったか（結果の数字、できるようになったこと、本人・保護者の言葉、次の目標。入力にあることだけ）。見出し文は「ビフォー」「アフター」という言葉をそのまま使わず、記事の中身が分かる文にする（例：「文章題で式が立てられなかった6月」「線を引いて『何を求めるか』を先に書く練習」「92点、文章題がこわくなくなった」）。見出しの文頭に①②③・数字・STEPは付けない（エディタが自動で 01/02/03 を付けます）。教室固有の仕組み・データ用に新しい<h2>を追加しない（5.参照）。点数・成績の変化がある時は、③の中に <table><tr><th>回</th><th>点数</th></tr>…</table>（列見出し形式）で前後を並べ、変化の幅（例：+32点）も本文に書く。入力に本人・保護者の言葉があれば、③で吹き出し（入力の文言のまま）にする。複数の教科・生徒の変化がある時は、③の中で教科（または生徒）ごとに<h3>で分け、同じ粒度で書く（<h2>は増やさない）。写真プレースホルダー（<p data-photo-placeholder="true"><strong>■ 写真：何を撮るか</strong></p>）は、その場面を書いた直後に置く（${photoAssignInstruction}）。<h2>3つの本論が終わったところで、同じ悩みを持つ家庭が今日からできることを3つ、1つにまとめて書く${homeStepsNoteStory}：<div class="eisai-point-list"><strong>ご家庭でできること</strong><ul><li>…</li></ul></div>。`;
    const step3Solve=`3. 本論：<h2> をちょうど3つ。教室固有の仕組み・データ用に新しい<h2>を追加しない（5.参照）。学校ごとの教科数が揃わない時は、3つ目以降の教科を<h3>で本論の中に足してよい（<h2>は増やさない）。見出しの文頭に①②③・数字・STEPは付けない（エディタが自動で 01/02/03 を付けます）。各見出しの中に「家庭で今日からできる手順」${homeStepsNoteSolve}と「教室ではこうしている」（入力の事実から）を対にして書く。手順は <ol class="eisai-steps"><li>…</li></ol>、要点は <div class="eisai-point-list"><strong>家庭でできること</strong><ul><li>…</li></ul></div> のように、<strong> には中身が分かるタイトルを入れる（「ポイント」だけにしない）。`;
    // v0.4.0: 記事の型「おまかせ」の時は、メモの内容から型を判断させ、両方の型の本論指示を併記して選ばせる。
    // v0.4.1（Codexレビュー対応・依頼文の長さ）：おまかせの時だけ使う、ストーリー型の短い版。
    // 見出しのルール・写真・表・家庭でできることの書き方は、上のビフォー・アフター型と同じものを使わせる。
    const step3StoryShort=`3. 本論（ストーリー型）：<h2> をちょうど3つ、出来事の流れで書く（例：当日の様子／生徒の変化・事例／終わってから・次に向けて。見出し文は記事に合わせて作る）。日時・人数などは表、事例は「学年・イニシャル・教科・担当講師名」を明記。見出しの付け方・新しい<h2>を足さないこと・写真プレースホルダー・最後の「ご家庭でできること」のまとめ方は、ビフォー・アフター型と同じにする。`;
    // v0.4.1: 「おまかせ」は、生徒の変化・成果ならビフォー・アフター型、イベントの報告ならストーリー型
    //         （迷ったらビフォー・アフター型）。悩み解決型（情報提供）は、おまかせでは選ばない。
    const step3=isAuto
      ? `3. 本論：メモの内容が、生徒の変化・成果（点数・成績・できるようになったこと・取り組みの前後）ならビフォー・アフター型、イベント（対策会・講習・行事）の報告が中心ならストーリー型で書く（どちらか一方を選ぶ。迷ったらビフォー・アフター型）。\n【ビフォー・アフター型で書く場合】${step3BA}\n【ストーリー型で書く場合】${step3StoryShort}`
      : (isStory?step3Story:(isSolve?step3Solve:step3BA));
    const typeSummaryLabelLong=isAuto
      ? 'おまかせ（生徒の変化・成果ならビフォー・アフター型、イベント報告ならストーリー型。迷ったらビフォー・アフター型）'
      : (isStory?'ストーリー型（イベント報告・事例・体験）':(isSolve?'悩み解決型（情報提供）':'ビフォー・アフター型（生徒の変化・成果）'));
    const typeSummaryLabelShort=isAuto?'おまかせ':(isStory?'ストーリー型':(isSolve?'悩み解決型':'ビフォー・アフター型'));
    // v0.4.1: ビフォー・アフター型（おまかせ含む）の導入は、最初に結果を一言で見せる。
    const baIntroCore='室長のあいさつのすぐ後で、この記事の結果（変化）を一言で先に見せる（数字があれば「60点→92点」のように前後を必ず書く。無ければ「できなかった○○が、できるようになった」の形で。入力にあることだけ）';
    // v0.4.1（Codexレビュー対応）：おまかせでストーリー型を選んだ時に、ビフォー・アフター専用の指示がかからないよう条件付きにする。
    const baIntroLead=isBA
      ? baIntroCore+'。そのうえで、'
      : (isAuto?'（ビフォー・アフター型で書く場合は、'+baIntroCore+'）。そのうえで、':'');
    // v0.4.0: かんたんモードは【入力】をメモ中心にする（悩み・家庭でできること・事実の項目別入力は使わない）。
    const inputBodyLines=isEasyMode
      ? [
          'メモ（書きたいこと・教室でやったこと）：',
          v('memo'),
          '（メモの扱い：メモから事実（日付・人数・学校名・学年・教科・講師名・生徒の様子や発言・数字）を拾って使う。メモに無い事実は作らない。メモの口語や箇条書きはそのまま写さず、記事の文章に整える。学年・対象校・時期が空欄なら、メモから読み取れる範囲で書き、読み取れなければ特定しない書き方にする（日付を作らない）。）'
        ]
      : [
          '悩み：',
          `1. ${v('w1')}`,
          `2. ${v('w2')}`,
          `3. ${v('w3')}`,
          '家庭でできること：',
          `1. ${v('h1')}`,
          `2. ${v('h2')}`,
          `3. ${v('h3')}`,
          '教室でやっている事実：',
          v('facts'),
          `事例：${v('caseText')||'（なし）'}`
        ];
    // v0.4.1: 「誰に」「教室情報」は、入力された項目だけを出す（空欄の羅列を作らない）。
    const whoToParts=[v('grade'),v('tSchools'),timingRaw].filter(Boolean);
    const whoToLine=whoToParts.length?`誰に：${whoToParts.join('／')}`:'誰に：未記入（メモから読み取る）';
    const classroomInfoParts=[];
    if(v('kosha')) classroomInfoParts.push(`校舎名 ${v('kosha')}`);
    if(v('shichou')) classroomInfoParts.push(`室長 ${v('shichou')}`);
    if(v('area')) classroomInfoParts.push(`地域 ${v('area')}`);
    if(schoolsLabel) classroomInfoParts.push(`対象校 ${schoolsLabel}`);
    if(v('ctaUrl')) classroomInfoParts.push(`申込URL ${v('ctaUrl')}`);
    if(v('tel')) classroomInfoParts.push(`電話 ${v('tel')}`);
    if(v('line')) classroomInfoParts.push(`LINE ${v('line')}`);
    if(v('address')) classroomInfoParts.push(`住所 ${v('address')}`);
    if(v('access')) classroomInfoParts.push(`アクセス ${v('access')}`);
    if(v('hours')) classroomInfoParts.push(`受付時間 ${v('hours')}`);
    const inputSection=[
      `記事の型：${typeSummaryLabelShort}`,
      whoToLine,
      ...inputBodyLines,
      `つなげたい行動：${actionText}${v('offer')?'／締切・特典：'+v('offer'):''}`,
      `教室情報：${classroomInfoParts.join('／')}`
    ].join('\n');
    const lines=[];
    lines.push(`あなたは英才個別学院の教室ブログ専門ライターです。以下の入力から、保護者向けのブログ記事をHTMLで1本書いてください。
このHTMLは英才ブログエディタに貼り付けて装飾されます。応答は <h1> から始め、前置き・解説・Markdown・コードブロックは出力しないでください。

【この記事のゴール】
- ${personaPrefix}保護者が${goalTimingPhrase}、記事だけでも得をし（家庭でできることが分かる）、同時に「${v('kosha')}ならここまでやってくれる」と感じて「${actionText}」に進みたくなること。
- 本部の評価軸：①タイトル ②サムネ ③構成 ④教室の中身が見える ⑤⑥視認性 ⑦問い合わせとの連動 ⑧記事単体で読者にメリット。

【記事の型（この順番で書く。今回の型：${typeSummaryLabelLong}）】
1. 導入：「${v('area')?v('area')+'の':''}個別指導塾、英才個別学院 ${v('kosha')} 室長の${v('shichou')}です！」で始め、${baIntroLead}${introTimingPhrase}、${empathyInstruction}。入力にない場面・状況設定（「面談で」「来校時に」「送迎の時に」など、誰から・どこで聞いた話かの設定）を作らない。
2. 原因の言い換え：${isBA?'ビフォーの状態（つまずき）の裏にある本当の原因を、入力の事実から一段深く言い換える（一般論で終わらせない）':(isAuto?'ビフォー・アフター型ならビフォーの状態（つまずき）の裏にある本当の原因を、ストーリー型なら悩みの裏にある本当の原因を、入力の事実から一段深く言い換える（一般論で終わらせない）':'悩みの裏にある本当の原因を一段深く言い換える（一般論で終わらせない）')}。目次は、本文をひととおり書き終えてから文字数を数え、2,000字を超えていた場合だけここに置く（先に入れるかどうかを決めてから書き始めない）：<div class="eisai-toc"><strong>目次</strong><ol><li>見出しの文</li>…</ol></div>（リンクは付けない）。
${step3}
4. 中間CTA：本論(3.)の2つ目の<h2>のまとまりの後に1つ。そこまでの本文が全体の40%に届かない場合は、3つ目の<h2>の途中（最初の段落の後）に置く。必ずこの形：<div class="eisai-cta" data-kind="mid"><p>記事固有でハードル低めの一文（例：範囲表を持って、対策会で一緒に計画を立てませんか？）</p><a class="cta-btn" href="${v('ctaUrl')}">20字以内の短いボタン文言（例：無料相談を申し込む）</a></div>　cta-btnの文言は20字以内にする（2行に折れる長さは不可）。締切・特典があっても、ボタンではなく直前の<p>に書く。
${(isStory||isBA||isAuto)?'5. 教室固有の仕組み・データ：③に書いていない残りの事実（日付・人数・数字・実際の言葉）があれば、本論の後に<h3>で補う（無ければ省略。新しい<h2>は追加しない）。日程や条件は <table> で「項目＝th／内容＝td」（曜日を新しく作らない）。facts内の列挙（①〜④等）は本文でも数を揃える。':`5. 教室固有の仕組み・事例・データ：新しい<h2>は追加しない。本論(3.)の<h2>3つのどれかの中に書くか、本論の3つが終わったあとに<h3>で続けて置く。入力の事実と事例を、日付・人数・数字・実際の言葉を落とさずに書く。日程や条件は <table> で、各行を <tr><th>日時</th><td>（入力にある日時をそのまま）</td></tr> のように「項目＝th／内容＝td」にする（曜日を新しく作らない）。点数の推移だけは <tr><th>回</th><th>点数</th></tr> の列見出し形式にする。写真は <p data-photo-placeholder="true"><strong>■ 写真：何を撮るか</strong></p> で「何を撮った写真か」まで指示する（${v('photos')||photoDefaultDescPlain}）。複数の学校・教科のデータがある時は、学校（または教科）ごとに<h3>で見出しを分け、同じ粒度で書く（<h2>は増やさない）。1つの見出しに複数校・複数教科の事実を詰め込まない。facts内の列挙（①〜④等）は本文でも数を揃える。`}
6. まとめ：<div class="eisai-summary"><strong>まとめ</strong><ul><li>要点1</li><li>要点2</li><li>要点3</li></ul></div>（直前に要約の一文を <p> で）。
${rel.length?'7. 関連記事：<div class="eisai-related"><strong>あわせて読みたい</strong><a href="URL">タイトル</a></div> の形で次のリンクを入れる。\n'+rel.join('\n')+'\n':'7. 関連記事：入力が無いので省略。\n'}8. 教室情報：${schoolInfoHtml} を置く（本CTAは本文に書かない。記事の一番最後に、拡張機能が「まずはお気軽にご相談ください」の申込枠を付ける。その中の文章は、下の CTA_DATA にこの記事に合わせて書く${v('offer')?`。締切・特典「${v('offer')}」は説明文1か2に入れる`:''}）。

【使ってよいHTML（これ以外のclassは使わない。装飾はエディタ側で付きます）】
<h1> <h2> <h3> <p> <strong> <br> <table><tr><th><td> ／ <div class="eisai-empathy-box"><strong>ラベル</strong><ul><li>…</li></ul></div> ／ <div class="eisai-toc"> ／ <div class="eisai-point-list"><strong>タイトル</strong><ul>…</ul></div> ／ <ol class="eisai-steps"> ／ <p class="eisai-highlight"><strong>…</strong></p> ／ <div class="bubble-right"><strong>Aさん：</strong>…</div> <div class="bubble-left"><strong>${v('shichou')}：</strong>…</div> ／ <div class="eisai-manager-note"><strong>室長より</strong><p>…</p></div> ／ <p data-photo-placeholder="true"><strong>■ 写真：…</strong></p> ／ <div class="eisai-cta" data-kind="mid|final"> ／ <div class="eisai-summary"> ／ <div class="eisai-related"> ／ <div class="eisai-school-info">`);
    lines.push(`
【文体・分量】
- 本文 ${len.replace('-','〜')}字。段落は1〜2文で短く。敬体で、少し近い距離感（「ですよね」「まずは」）。硬い業務文（〜させていただきます）は避ける。
- 本文の文字数は、<h1>・すべてのタグ・HTMLコメント・改行・空白を除いた文字数で数える（レンダリングして見える文字だけを数える。EISAI_CHECKのcharsもこの数え方で書く）。出力前にこの数え方で数え、指定の下限に届いていなければ、本論に1〜2文足してから出力する。
- 数字・学校名・日付は入力どおりに。入力にない実績・点数・人数・キャンペーンは作らない。曜日・時刻・人数・学年などの付随情報も、入力に無ければ書き足さない（日付に曜日を付けない）。足りなければ書かない。
- 生徒の表情・動作・発言、保護者の発言は、入力（事例・facts・悩み）に書いてあるものだけを書く。入力に無ければ書かない。「」で囲む発言は、入力にある文言をそのまま使う（新しいセリフを作らない）。
- 誇張表現（絶対・必ず・奇跡・誰でも）は禁止。感嘆符は記事全体で3〜6回、絵文字は☺✨などを2〜3個使ってよい（室長の気持ちを書く所で）。
- 温度感は事実を新しく足すのではなく、室長の気持ちで出す。入力にある事実に対して室長が感じたこと（感想。例：「うれしかったです」「頼もしく感じました」「よく頑張ったね！と声をかけたくなりました」）を、本文中に最低1か所は入れる（室長コメント内でもよい）。
- 強調は本当に読ませたい一文だけ <p class="eisai-highlight"><strong>…</strong></p>（記事全体で1〜2個）。
- 吹き出しは事例に生徒・保護者の実際の言葉がある時だけ（<div class="bubble-right"><strong>Aさん：</strong>…</div> と <div class="bubble-left"><strong>${v('shichou')}：</strong>…</div>）。ここでの発言も入力にある文言のみ。
- 室長コメントは <div class="eisai-manager-note"><strong>室長より</strong><p>…</p></div> を1つ。売り込みではなく、そばで見ている人の実感として。
- 表が合う情報（日程・点数の推移・学校別の違い）は <table> を使ってよい。

【タイトル3案（各33文字以内。数字か学校名のどちらかを必ず含む）】
※33字を超えたら、そのまま出力せずに短く言い換えてから出力する（全角1字＝1字、句読点・記号・カギ括弧も1字として数える）。
${isBA?'※1案目に必ず「前→後」の変化（例：60点→92点、+32点）を入れる。\n':(isAuto?'※ビフォー・アフター型で書く場合は、1案目に必ず「前→後」の変化（例：60点→92点、+32点）を入れる。\n':'')}1案目：【学校名／地域】＋入力の facts・事例の中でいちばん強い具体的な数字・実績（参加人数・点数・学校別データ・日付・開催回数など）を必ず使う（SEO・ペルソナ起点）　例：【総勢40名参加！】テスト直前の無料対策会レポート／【稲城三中・四中】9月中間テスト、学校別の出題傾向
2案目：悩みのセリフ引用＋否定の切り返し／問いかけ　例：「勉強したのに解けなかった」で終わらせない3つの振り返り
3案目：季節・時期トリガー＋学校名か数字　例：9月から算数が難しい…小学生に増える3つのつまずきとは？
※「3つの〜」のような手順の数だけをタイトルの数字にする案は、1〜3案のうち最大1つまで。かつ facts内に参加人数・点数・学校別データ・日付・回数などの強い数字が無い場合に限る。強い数字がある時は、必ずどこかの案でその数字自体をタイトルに使う。
<h1> には1案目を入れる。

【入力】
${inputSection}

【出力の末尾に必ず付けるもの（この順）】
<!--CTA_DATA_START-->
中間CTA文言：（記事固有の一文）
説明文1：（この記事の内容に合わせた、保護者の不安を解消する一文）
説明文2：（相談・体験へのハードルを下げる、この記事に合わせた一文）
相談ポイント1：（無料学習相談でできること。この記事の学年・教科・悩みに合わせて、各25字以内）
相談ポイント2：
相談ポイント3：
相談ポイント4：
体験ポイント1：（無料体験授業でできること。この記事に合わせて、各25字以内）
体験ポイント2：
体験ポイント3：
体験ポイント4：
締めの言葉：（この記事の内容に合わせて、行動を後押しする一文）
<!--CTA_DATA_END-->
（CTA_DATAの文章も、入力にない実績・数字・特典は作らない。教室の仕組みとして入力に無いもの（例：自習室の無料開放）も書かない）
<!--EISAI_TITLES: ["1案目","2案目","3案目"]-->
<!--EISAI_CHECK: {"title":"○","structure":"○","classroom":"○","visibility":"○","cta":"○","benefit":"○","facts_only":"○","chars":2000,"notes":["直した点や自信のない点を短く"]}-->
EISAI_CHECK は出力前の自己点検です。○△×で正直に付け、△×があれば先に本文を直してから出力してください。facts_only は「入力にない事実（数字・固有名だけでなく、『面談で』『来校時に』のような入力に無い状況設定、「」で囲んだ発言、生徒・保護者の表情・動作、曜日も含む）を書いていないか」です。classroom は「室長名を入力のまま書いているか、facts内の列挙（①〜④等）が本文でも同じ数だけ書かれているか」も含めて点検してください。`);
    // v0.4.1.0: 合言葉（マーカー）方式の目印指示を末尾に追加する。記事の型・文体の指示
    // （上のlines）は1字も変えない。
    lines.push(buildMarkerInstructionBlock(effectiveRequestId));
    return lines.join('\n');
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // v0.4.0.5: 実機（2026-09-27）で、ChatGPTのタブが裏（document.hidden）にあると
  // ChatGPTが回答のDOM反映を止める（タイマーも1秒〜1分に間引かれる）ことが判明した。
  // すべての監視（完了監視・サムネ指示監視・画像監視・送信確認）で、裏にある間は
  // 経過時間・タイムアウト・無反応カウントを進めないようにするための判定関数。
  function isTabHidden() {
    try {
      return typeof document !== 'undefined' && document.hidden === true;
    } catch (e) {
      return false;
    }
  }

  // v0.4.1.6: 2026-09-29に実機で確認：タブが裏にある状態が長く続くと、Chromeの
  // Intensive Throttlingにより、setTimeoutの連鎖（sleepを繰り返す待ち方）が数十分に
  // 間引かれることがある（人が手で送信してChatGPT側は完了していたのに、拡張機能側の
  // 「送信ボタンを探し直す」待ち・「送信を確認する」待ちが進まず、パネルが止まって見えた）。
  // MutationObserverはDOM変化そのもので起きるため、setTimeoutの間引きに影響されにくい。
  // checkFn()がtruthyを返すまで、(1)DOM変化があった時は毎回すぐ再チェックし、
  // (2)保険としてpollMsごとの再チェックも行う、の2本立てで待つ。timeoutMsで必ず終わる
  // （extendDeadlineWhileHiddenがtrueなら、裏で過ごした分だけ期限を後ろにずらす。
  // confirmSendSucceededの既存の考え方と同じ）。
  function waitForDomCondition(checkFn, timeoutMs, pollMs, extendDeadlineWhileHidden) {
    return new Promise((resolve) => {
      let immediate;
      try { immediate = checkFn(); } catch (e) { immediate = null; }
      if (immediate) { resolve(immediate); return; }

      let settled = false;
      let observer = null;
      let timer = null;
      let deadline = Date.now() + timeoutMs;
      const interval = pollMs || 300;
      // v0.4.1.7: 以前はDOM変化のたびにrecheckを呼び、そのたびに新しい保険タイマーを
      // 前のものを消さずに追加していた。ChatGPTの生成中はDOM変化が毎秒何十回も起きるため、
      // タイマーが雪だるま式に増え、そのたびに重い確認（会話全体のテキスト走査）が走っていた。
      // (1)保険タイマーは常に1本だけ、(2)DOM変化での確認は最短minGapMsに1回まで、に絞る。
      const minGapMs = Math.max(100, Math.floor(interval / 2));
      let lastCheckAt = 0;
      let lastHiddenCheckAt = Date.now();

      const finish = (value) => {
        if (settled) return;
        settled = true;
        if (observer) { try { observer.disconnect(); } catch (e) { /* noop */ } }
        if (timer) { clearTimeout(timer); timer = null; }
        resolve(value || null);
      };

      const recheck = () => {
        if (settled) return;
        lastCheckAt = Date.now();
        let value;
        try { value = checkFn(); } catch (e) { value = null; }
        if (value) { finish(value); return; }
        const now = Date.now();
        // 裏にある間は、その経過時間ぶん期限を延ばす（回数ではなく実時間で数える）
        if (extendDeadlineWhileHidden && isTabHidden()) deadline += (now - lastHiddenCheckAt);
        lastHiddenCheckAt = now;
        if (now >= deadline) { finish(null); return; }
        if (timer) clearTimeout(timer);
        timer = setTimeout(recheck, interval);
      };

      const onMutation = () => {
        if (settled) return;
        if (Date.now() - lastCheckAt < minGapMs) return; // 保険タイマーが拾う
        recheck();
      };

      try {
        observer = new MutationObserver(onMutation);
        observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
      } catch (e) {
        observer = null;
      }

      timer = setTimeout(recheck, interval);
    });
  }

  // v0.4.1.2: 2026-09-27に実機で確認：タブが裏にある間もChatGPTが本文を最後まで描画し
  // 終了目印まで出ているのに、パネルはこの文言のまま完成処理へ進まないことがあった
  // （原因は各監視tickの実装。下記のisTabHidden利用箇所を参照）。文言自体も「戻ったときに
  // 仕上げる」から「書き終わると自動で仕上げる」に直し、裏のままでも完成することを反映した。
  const TAB_HIDDEN_STATUS_TEXT = '⏸ ChatGPTのタブが裏にあります。書き終わると自動で仕上げます。仕上がらないときは、このタブを一度開いてください';

  // v0.4.1.0: 【削除済み・旧方式】ここには以前、ChatGPTの「画面の作り」（writing block
  // のProseMirror／.markdown／ターン全体、data-message-author-role・data-testid^=
  // "conversation-turn"・data-content-search-turn-key等のセレクタ候補、TreeWalkerによる
  // <h1探索の保険、祖先ターンを辿るclimbToFullChatgptTurn等）に依存する本文抽出・完了判定が
  // あった。アカウント・A/Bテストで画面の作りが変わるたびに壊れていたため全廃し、下記の
  // 「合言葉（マーカー）方式」に置き換えた（詳細はCHANGELOG・SPEC.mdのChatGPT拡張の節）。
  //
  // 新方式の要：main（無ければbody）内の全テキストノードを、自パネル・入力欄を除いて
  // TreeWalkerで1本の文字列に連結し（collectMainTextIndex）、その連結文字列の中だけで
  // 目印文字列（[[EISAI-START-<ID>]]・[[EISAI-END-<ID>]]）を検索する。目印がテキストノードや
  // spanをまたいで分割されていても、1本の文字列として検索するので必ず見つかる。DOM構造
  // （役割属性の有無・ネストの深さ）は一切問わない。

  // v0.4.1.4: 2026-09-29に実機で確認した重大な不具合の修正。ChatGPTが記事を「書き物
  // キャンバス」（div.ProseMirror[contenteditable="true"][aria-label="書き始める"]、formの外）
  // に書いた場合、本文・開始/終了の目印はこのキャンバスの子孫テキストノードに入る。以前の
  // isInsideOwnToolOrComposerは`[contenteditable="true"]`を一律で「入力欄」として除外していた
  // ため、このキャンバスも入力欄と誤認して除外され、getMarkerStateが永久にhasStart=falseの
  // ままになり、パネルが止まったまま進まなかった（ChatGPTが通常の回答(.markdown)で書いた時
  // だけ動く、という不安定さの正体）。
  //
  // 同じ系統の危険がもう1つあった：CHATGPT_ADAPTER.getComposerの候補
  // 'div.ProseMirror[contenteditable="true"]'が、#prompt-textareaが無い画面で会話中の
  // キャンバス（DOM順で先に来ることがある）を入力欄と誤認し、プロンプトを記事キャンバスに
  // 書き込んでしまう危険があった。
  //
  // 対処：「入力欄」をfindComposerElement()という1か所だけで決め、除外判定
  // （isInsideOwnToolOrComposer）は「自パネル」と「入力欄の入れ物」（入力欄のclosest('form')。
  // 無ければ入力欄自身）に実際に含まれるか（contains）だけで行う。[contenteditable="true"]の
  // 一律除外はやめた。入力欄の入れ物（composerContainer）は呼び出し側で1回だけ計算して渡す
  // （テキストノードごとに入力欄を探し直すと重いため）。

  // ChatGPTの「書き物キャンバス」らしいaria-label（実機で確認済みの「書き始める」を含む）、
  // またはwriting-block系のdata-testidの中にある要素は、絶対に入力欄にしない。
  const WRITING_CANVAS_ARIA_LABEL_RE = /書き始める|キャンバス|canvas/i;
  function isWritingCanvasElement(el) {
    if (!el) return false;
    try {
      const ariaLabel = (el.getAttribute && el.getAttribute('aria-label')) || '';
      if (WRITING_CANVAS_ARIA_LABEL_RE.test(ariaLabel)) return true;
      if (el.closest && el.closest('[data-testid*="writing-block"]')) return true;
    } catch (e) { /* noop */ }
    return false;
  }

  // 入力欄らしいaria-label（実機・英語UIで確認できているもの＋一般的な言い回し）。
  const COMPOSER_LIKE_ARIA_LABEL_RE = /ChatGPT\s*に聞く|Ask\s*ChatGPT|Message|メッセージ/i;

  // 画面上で一番下（getBoundingClientRect().bottomが最大）にある要素を選ぶ
  // （入力欄は通常、画面下部の固定バーにあるため）。
  function pickBottomMostElement(elements) {
    let best = null;
    let bestBottom = -Infinity;
    elements.forEach(el => {
      let bottom = -Infinity;
      try { bottom = el.getBoundingClientRect().bottom; } catch (e) { /* noop */ }
      if (bottom > bestBottom) {
        bestBottom = bottom;
        best = el;
      }
    });
    return best;
  }

  // v0.4.1.4: 「入力欄」を決める唯一の場所。優先順位：
  //   1. #prompt-textarea（実機で最も安定）
  //   2. form内のcontenteditable／textarea（キャンバスは除外）
  //   3. aria-labelが入力欄らしいcontenteditable／textarea／input（キャンバスは除外）
  // どの段でも、自パネルの中にある要素・書き物キャンバスらしい要素は候補から外す。
  // 複数候補が残る場合は、画面の一番下にあるものを選ぶ。
  function findComposerElement() {
    function isOwnPanel(el) {
      return !!(el.closest && el.closest(`#${TOOL_ID}`));
    }
    function isUsable(el) {
      return el && !isOwnPanel(el) && !isWritingCanvasElement(el);
    }

    const byId = document.getElementById('prompt-textarea');
    if (isUsable(byId)) return byId;

    const formCandidates = Array.from(document.querySelectorAll('main form textarea, main form [contenteditable="true"]'))
      .filter(isUsable);
    if (formCandidates.length) return pickBottomMostElement(formCandidates);

    const ariaCandidates = Array.from(document.querySelectorAll('[contenteditable="true"][aria-label], textarea[aria-label], input[aria-label]'))
      .filter(el => isUsable(el) && COMPOSER_LIKE_ARIA_LABEL_RE.test(el.getAttribute('aria-label') || ''));
    if (ariaCandidates.length) return pickBottomMostElement(ariaCandidates);

    return null;
  }

  // 入力欄の「入れ物」＝入力欄のclosest('form')。無ければ入力欄自身。見つからなければnull。
  function computeComposerContainer() {
    const composer = findComposerElement();
    if (!composer) return null;
    return (composer.closest && composer.closest('form')) || composer;
  }

  // v0.4.1.5: 2026-09-29に実機で確認：タブが裏にあるとChatGPT側の描画が遅れ、送信ボタンが
  // まだ無い一瞬にCHATGPT_ADAPTER.sendが1回だけボタンを探して見つからず、Enterキー送信に
  // 落ちてしまい（Enterでは送れない画面だった）、結局送信できていなかった。送信ボタンの検索を
  // 「入力欄の入れ物（container）の中を優先し、無ければ画面全体」という2段の探索にまとめる
  // （CHATGPT_ADAPTER.sendが最大5秒・250msおきに呼ぶ）。
  const SEND_BUTTON_SELECTOR = '#composer-submit-button, button[data-testid="send-button"], button[data-testid="composer-send-button"], button[type="submit"], button[aria-label*="Send"], button[aria-label*="送信"]';
  function findSendButtonNear(container) {
    const scopes = container ? [container, document] : [document];
    for (const scope of scopes) {
      let candidates;
      try { candidates = Array.from(scope.querySelectorAll(SEND_BUTTON_SELECTOR)); } catch (e) { candidates = []; }
      const usable = candidates.find(btn => !btn.disabled && !btn.getAttribute('aria-disabled'));
      if (usable) return usable;
    }
    return null;
  }

  // 自分のパネル、または「入力欄の入れ物」に実際に含まれる（contains）要素かどうかの判定。
  // composerContainerは呼び出し側で1回だけ計算して渡す（省略時はこの中で1回だけ計算する）。
  function isInsideOwnToolOrComposer(el, composerContainer) {
    if (!el || typeof el.closest !== 'function') return false;
    if (el.closest(`#${TOOL_ID}`)) return true;
    const container = composerContainer !== undefined ? composerContainer : computeComposerContainer();
    return !!(container && container.contains && container.contains(el));
  }

  // v0.4.1.0: main（無ければbody）内の全テキストノード（自パネル・入力欄を除く）を出現順に
  // 連結し、1本の文字列と「どのテキストノードのどの位置がどのオフセットに対応するか」の
  // 対応表を作る。目印検索・依頼番号の可視確認・失敗文言の位置スコープ判定など、この後の
  // すべての読み取りがこれを使う。
  // v0.4.1: 2026-10-03に実機で確認：ChatGPTの画面に<main>が2つあり、先頭の<main>は空の
  // 「どこから始めましょうか？」の画面、会話は2つ目の<main>に入っていた。querySelector('main')は
  // 先頭の空の方を返すため、回答の目印が永久に見つからず「生成中」のまま止まる恐れがあった。
  // 読み取りの範囲は「会話が入っている<main>」＝文字数がいちばん多い<main>にする。
  // ページ全体（body）にすると、画面の端にある別の文言（メニュー等）まで拾い、画像の失敗判定などを
  // 取り違える恐れがあるため、範囲は会話のエリアに絞る。<main>が無い画面だけbody全体を読む。
  function getReadRoot() {
    const mains = Array.from(document.querySelectorAll('main'));
    if (!mains.length) return document.body;
    if (mains.length === 1) return mains[0];
    let best = mains[0];
    let bestLen = -1;
    mains.forEach(m => {
      const len = (m.textContent || '').length;
      if (len > bestLen) { best = m; bestLen = len; }
    });
    return best;
  }

  function collectMainTextIndex() {
    const root = getReadRoot();
    if (!root) return { root: null, text: '', nodeSpans: [] };
    // v0.4.1.4: 入力欄の入れ物は、このテキストノード走査1回につき1回だけ計算する
    // （テキストノードごとに入力欄を探し直すと重いため）。
    const composerContainer = computeComposerContainer();
    const nodeSpans = [];
    let text = '';
    try {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || isInsideOwnToolOrComposer(parent, composerContainer)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      let n;
      while ((n = walker.nextNode())) {
        const value = n.nodeValue || '';
        if (!value) continue;
        nodeSpans.push({ node: n, start: text.length, end: text.length + value.length });
        text += value;
      }
    } catch (e) {
      console.warn('[Eisai] main内テキストの走査に失敗しました:', e);
    }
    return { root, text, nodeSpans };
  }

  // v0.4.1.0: 連結文字列上のオフセットを、実際のテキストノード＋ノード内オフセットへ戻す
  // （Rangeを作るために必要）。
  function locateNodeOffset(index, offset) {
    const spans = index.nodeSpans;
    for (let i = 0; i < spans.length; i++) {
      const span = spans[i];
      if (offset >= span.start && offset <= span.end) {
        return { node: span.node, offset: offset - span.start };
      }
    }
    if (spans.length) {
      const last = spans[spans.length - 1];
      return { node: last.node, offset: (last.node.nodeValue || '').length };
    }
    return null;
  }

  // v0.4.1.0: 改行を保つための境目挿入は、本文が「HTMLソースをそのまま文字として表示している」
  // （＝本文はただの文字列で、その中の改行は元のテキストの改行そのもの。ChatGPTの画面側が
  // 1行ごとに<p>／<li>で包んでいるだけ）という、実機で確認されている唯一のケース（writing
  // blockのProseMirror。1行=1子要素）に限って行う。<p>／<li>以外の要素（<div>や<span>等）は、
  // ChatGPTの表示側の都合で「行の途中」にも自由に現れうる（実際にストリーミング表示中は、
  // 文字列を任意の位置でラップし直すことがある）ため、境目に改行を入れると、たまたまその境目が
  // 「<h1」のようなタグ文字列の途中に来ていた場合に文字列を壊してしまう（テスト
  // `layout=random`で確認）。<div>等はここでは境目とみなさない（＝改行を追加しない。
  // テキストノードの連結だけで、元の文字列に含まれる改行はそのまま保たれる）。
  const EISAI_BLOCK_TAGS = new Set(['P', 'LI']);
  function serializeBlockText(rootNode) {
    let out = '';
    function walk(n) {
      if (n.nodeType === 3) { out += n.nodeValue || ''; return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === 'BR') { out += '\n'; return; }
      if (tag === 'SCRIPT' || tag === 'STYLE') return;
      const isBlock = EISAI_BLOCK_TAGS.has(tag);
      if (isBlock && out.length && !/\n$/.test(out)) out += '\n';
      const children = n.childNodes;
      for (let i = 0; i < children.length; i++) walk(children[i]);
      if (isBlock && out.length && !/\n$/.test(out)) out += '\n';
    }
    const children = rootNode.childNodes;
    for (let i = 0; i < children.length; i++) walk(children[i]);
    return out.replace(/\n{3,}/g, '\n\n').trim();
  }

  // v0.4.1.0: 連結文字列上の[startOffset, endOffset)をRangeで切り出し、改行を保ったまま
  // 文字列化する。decodeHtmlText済みの文字列に<h1（またはサムネ指示の場合は
  // [[EISAI_IMG_PROMPT]]）が見えなければ、ChatGPT側が実際にHTMLとしてレンダリングして
  // しまったケース（innerHTMLをシリアライズし直した文字列の方にタグ文字列が残る）を保険で試す。
  function extractIndexRangeAsBlockText(index, startOffset, endOffset) {
    if (!(endOffset > startOffset)) return '';
    const startLoc = locateNodeOffset(index, startOffset);
    const endLoc = locateNodeOffset(index, endOffset);
    if (!startLoc || !endLoc) return '';
    try {
      const range = document.createRange();
      range.setStart(startLoc.node, startLoc.offset);
      range.setEnd(endLoc.node, endLoc.offset);
      const frag = range.cloneContents();
      const container = document.createElement('div');
      container.appendChild(frag);

      const blockText = decodeHtmlText(serializeBlockText(container));
      if (blockText.indexOf('<h1') !== -1 || blockText.indexOf('[[EISAI_IMG_PROMPT]]') !== -1) {
        return blockText;
      }
      const htmlText = decodeHtmlText(container.innerHTML || '');
      if (htmlText.indexOf('<h1') !== -1 || htmlText.indexOf('[[EISAI_IMG_PROMPT]]') !== -1) {
        return htmlText.trim();
      }
      return blockText;
    } catch (e) {
      console.warn('[Eisai] 目印範囲の抽出に失敗しました:', e);
      return '';
    }
  }

  // v0.4.1.0: 依頼IDに対応する開始・終了の目印を、main内の連結文字列から探す。
  //   - 開始目印は「最後の出現」を使う（同じ依頼で複数の目印らしき文字列が画面に残っていても、
  //     一番新しいものを使う）。
  //   - 終了目印は、開始目印より後で最初に見つかったものを使う。
  // 戻り値：{ hasStart, hasEnd, text, charCount }。textは終了目印が見つかった時だけ入る
  // （改行を保ったまま切り出し済み・目印そのものは含まない）。
  function getMarkerState(requestId) {
    const index = collectMainTextIndex();
    const startNeedle = startMarkerText(requestId);
    const endNeedle = endMarkerText(requestId);
    const startPos = index.text.lastIndexOf(startNeedle);
    if (startPos === -1) {
      return { hasStart: false, hasEnd: false, text: '', charCount: 0 };
    }
    const afterStart = startPos + startNeedle.length;
    const endPos = index.text.indexOf(endNeedle, afterStart);
    if (endPos === -1) {
      const partial = decodeHtmlText(index.text.slice(afterStart));
      return { hasStart: true, hasEnd: false, text: '', charCount: getArticlePlainLength(partial) };
    }
    const extracted = extractIndexRangeAsBlockText(index, afterStart, endPos);
    return { hasStart: true, hasEnd: true, text: extracted, charCount: getArticlePlainLength(extracted) };
  }

  // v0.4.1.0: 送信確認・失敗文言のスコープ判定用。「依頼番号：<ID>」が、自パネル・入力欄を
  // 除いた画面に見えているか。
  function isRequestIdVisibleOutsideComposer(requestId) {
    const index = collectMainTextIndex();
    return index.text.indexOf(requestIdNeedle(requestId)) !== -1;
  }

  // v0.4.1.0: 「依頼番号：<ID>」の最後の出現より後のテキストだけを返す（画像生成の失敗文言を、
  // 今回の依頼より前の会話の言い回しと混同しないためのスコープ絞り込み）。
  function textAfterRequestId(requestId) {
    const index = collectMainTextIndex();
    const needle = requestIdNeedle(requestId);
    const pos = index.text.lastIndexOf(needle);
    if (pos === -1) return '';
    return decodeHtmlText(index.text.slice(pos + needle.length));
  }

  // v0.4.1.0: 画像そのものの完成監視用。main内（自パネル・入力欄を除く）のimg要素一覧。
  function collectMainImages() {
    const root = getReadRoot();
    if (!root) return [];
    try {
      const composerContainer = computeComposerContainer();
      return Array.from(root.querySelectorAll('img')).filter(img => !isInsideOwnToolOrComposer(img, composerContainer));
    } catch (e) {
      return [];
    }
  }

  // v0.4.1.3: 2026-09-28に実機で確認：大きい画像（naturalWidth>500）が現れても、しばらくは
  // 「プレビュー」表示のままで、その後にDOMごと本番表示へ差し替わる（watchGeneratedImage参照）。
  // その画像の近く（祖先を数段さかのぼった入れ物の中）に「プレビュー」/「Preview」の表示が
  // あるかどうかを見て、プレビュー段階かどうかを判定する。
  const IMAGE_PREVIEW_ANCESTOR_LEVELS = 5;
  const IMAGE_PREVIEW_LABEL_RE = /プレビュー|Preview/i;
  function isNearImagePreviewLabel(img) {
    try {
      let node = img;
      for (let i = 0; i < IMAGE_PREVIEW_ANCESTOR_LEVELS && node; i++) {
        node = node.parentElement;
        if (!node) break;
        if (IMAGE_PREVIEW_LABEL_RE.test(node.textContent || '')) return true;
      }
    } catch (e) { /* noop */ }
    return false;
  }

  const CHATGPT_ADAPTER = {
    // v0.4.1.4: 以前はセレクタの先頭一致方式で、候補に'div.ProseMirror[contenteditable="true"]'
    // があった。#prompt-textareaが無い画面では、会話中の「書き物キャンバス」（同じ
    // contenteditable。DOM順で入力欄より先に来ることがある）を入力欄と誤認し、プロンプトを
    // 記事キャンバスへ書き込んでしまう危険があった。入力欄の判定はfindComposerElement()に
    // 一本化した（キャンバスを絶対に入力欄にしない・複数候補は画面最下部を選ぶ）。
    getComposer() {
      return findComposerElement();
    },

    // v0.4.1.6: サムネ指示（記事HTMLを丸ごと含む）は入力欄への書き込み量が大きく、タブが
    // 裏にあると反映が長く詰まることがある実機報告があったため、書き込みにかかった実時間を
    // console.debugへ残す（[Eisai] composer insert: n文字 / m ms）。
    setComposerText(input, text) {
      if (!input) return false;
      const insertStart = Date.now();
      const value = String(text || '');
      input.focus();

      if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
        const descriptor = Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value');
        const setter = descriptor && descriptor.set;
        if (setter) setter.call(input, value);
        else input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        console.debug(`[Eisai] composer insert: ${value.length}文字 / ${Date.now() - insertStart}ms`);
        return true;
      }

      // v0.4.1.7: 2026-09-29に実機（ChatGPTの入力欄＝ProseMirror）で計測した結果、
      // execCommand('insertText')は文字数の2乗に近い割合で重くなる（3,000字で約1秒、
      // 15,000字で約17秒。その間ページ全体が固まり、裏タブでは数分に伸びる）。一方、
      // 貼り付け（pasteイベント）はChatGPT自身の貼り付け処理で1回の変更として入るため、
      // 8,000字でも約0.04秒で終わる。これが「送信中のまま固まる」「ページが反応しなくなる」の
      // 根本原因だったため、書き込みは貼り付けを第一の方法にする。
      // ChatGPTは長すぎる貼り付け（実機：10,000字以上）を本文に入れず「貼り付けたテキスト.txt」
      // という添付に変える。その場合の扱いはsetComposerAndSend側（添付＋短い案内文）で行う。
      // 貼り付けが処理されなかった時（defaultPreventedにならない画面）だけ、従来のinsertTextに戻す。
      document.execCommand('selectAll', false, null);
      if (getComposerText(input).length > 0) {
        document.execCommand('delete', false, null);
      }
      if (!value) {
        input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContent' }));
        return true;
      }

      let pasteHandled = false;
      try {
        const dt = new DataTransfer();
        dt.setData('text/plain', value);
        const pasteEvent = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
        input.dispatchEvent(pasteEvent);
        pasteHandled = pasteEvent.defaultPrevented;
      } catch (e) {
        pasteHandled = false;
      }

      let method = 'paste';
      if (!pasteHandled) {
        method = 'insertText';
        document.execCommand('insertText', false, value);
        input.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: value
        }));
      }
      console.debug(`[Eisai] composer insert(${method}): ${value.length}文字 / ${Date.now() - insertStart}ms`);
      return true;
    },

    // v0.4.1.5: 2026-09-29に実機で確認：タブが裏にあるとChatGPT側の描画が遅れ、送信直後の
    // 一瞬（250ms後の1回だけの確認）にはまだ送信ボタンが無く、Enterキー送信に落ちてしまう
    // 画面があった（Enterでは送信されない）。最大5秒・250msおきに送信ボタンを探し直すように
    // 変更し、見つかった時だけclickする。5秒探しても見つからない時だけ、最後の手段として
    // Enterキー（keydown・keypress・keyupの3つとも）を送る。
    // v0.4.1.6: 2026-09-29に実機で確認：タブが裏にある状態が長引くと、Chromeの
    // Intensive Throttlingにより「250msおきに探し直す」のsleep連鎖そのものが数十分に
    // 間引かれることがあった。sleepの繰り返しではなく、DOM変化で起きやすいwaitForDomCondition
    // （MutationObserver＋保険のタイマー）で探すように変更した。
    // v0.4.1.7: 添付（長すぎる貼り付け）を送る時は、アップロードが終わるまで送信ボタンが
    // 無効のままなので、待つ上限をopts.waitMsで延ばせるようにした（既定5秒）。
    async send(input, opts) {
      const waitMs = (opts && typeof opts.waitMs === 'number') ? opts.waitMs : 5000;
      const container = (input && input.closest && (input.closest('form') || input)) || computeComposerContainer();
      let sendButton = await waitForDomCondition(() => findSendButtonNear(container), waitMs, 250, false);
      if (sendButton) {
        sendButton.click();
        return;
      }

      if (!input) return;
      input.focus();
      ['keydown', 'keypress', 'keyup'].forEach(type => {
        input.dispatchEvent(new KeyboardEvent(type, {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true
        }));
      });
    }

    // v0.4.1.0: getResponseNodes／getResponseText／isGenerating／getUserMessageCountは
    // 全廃した。ChatGPTの回答を読む処理は、この後の「合言葉（マーカー）方式」
    // （getMarkerState・collectMainTextIndex等）に統一し、role属性・停止ボタン・
    // ターン用セレクタのどれにも依存しない。CHATGPT_ADAPTERは「入力欄を見つけて文字を
    // 入れて送る」という、避けられないDOM依存（送信先を探す操作）だけを持つ。
  };

  function getChatInput() {
    return CHATGPT_ADAPTER.getComposer();
  }

  async function sendMessage(input, opts) {
    await CHATGPT_ADAPTER.send(input, opts);
  }

  // v0.4.1.7: 2026-09-29に実機で確認：ページにキーボードの焦点が無い時（別アプリを見ている等）、
  // navigator.clipboard.writeText()が失敗もせず返ってこないことがあり、その後ろの処理
  // （画像生成の送信）が永久に始まらなかった。クリップボードへの書き込みは必ず時間制限付きにし、
  // 返ってこなければ「失敗」として先へ進む（送信など本来の処理をクリップボードで止めない）。
  function writeClipboardWithTimeout(text, timeoutMs) {
    const limit = typeof timeoutMs === 'number' ? timeoutMs : 1500;
    return new Promise((resolve) => {
      let done = false;
      const finish = (ok) => { if (!done) { done = true; resolve(ok); } };
      setTimeout(() => finish(false), limit);
      try {
        Promise.resolve(navigator.clipboard.writeText(String(text || ''))).then(() => finish(true), () => finish(false));
      } catch (e) {
        finish(false);
      }
    });
  }

  // v0.4.1.7: 入力欄の入れ物（form）にある「添付を外す」ボタン（＝添付の数）。ChatGPTは
  // 長すぎる貼り付けを「貼り付けたテキスト（n）.txt」という添付に変え、「… を削除」という
  // ボタンを付ける（実機2026-09-29で確認。英語画面は「Remove …」）。
  const ATTACHMENT_REMOVE_LABEL_RE = /を削除$|^Remove\b/;
  function listComposerAttachmentRemoveButtons() {
    const container = computeComposerContainer();
    if (!container || !container.querySelectorAll) return [];
    try {
      return Array.from(container.querySelectorAll('button[aria-label]'))
        .filter(btn => ATTACHMENT_REMOVE_LABEL_RE.test(btn.getAttribute('aria-label') || ''));
    } catch (e) {
      return [];
    }
  }

  // v0.4.1.7: 依頼文が添付になった時に、入力欄へ入れる短い案内文。依頼番号の行
  // （buildRequestIdLine）を必ず含める（送信確認・安全な再送の判定が依頼番号を見るため）。
  function buildAttachmentCoverMessage(text) {
    const m = String(text || '').match(/（依頼番号：[A-Za-z0-9]+）/);
    const idLine = m ? m[0] : '';
    return (idLine ? idLine + '\n' : '') +
      '依頼の全文は、添付した「貼り付けたテキスト」に書きました。添付の指示にそのまま従って回答してください（回答の最初と最後の目印の行も、添付の指示どおりに書いてください）。';
  }

  // v0.4.1.7: 最後の送信で自分が付けた添付の「削除」ボタン（送信に失敗した時の後片付け用）。
  let lastAddedAttachmentButtons = [];

  function getComposerText(input) {
    if (!input) return '';
    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) return input.value || '';
    return input.textContent || '';
  }

  // v0.4.0: alert()の代わり。パネル内に数秒で消える一時メッセージを表示する
  // （既存の #eisai-copy-toast を流用）。alert()はページ全体を止めてしまい、
  // 自動送信・生成待ちの処理も一緒に止まってしまうため使わない。
  function showToast(message, ms) {
    const text = String(message || '');
    const duration = ms || Math.min(10000, 2500 + text.length * 40);
    const toast = document.getElementById('eisai-copy-toast');
    if (!toast) {
      console.warn('[Eisai]', text);
      return;
    }
    clearTimeout(toast._eisaiHideTimer);
    toast.style.display = 'block';
    toast.textContent = text;
    toast._eisaiHideTimer = setTimeout(() => { toast.style.display = 'none'; }, duration);
    try {
      if (toast.scrollIntoView) toast.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) { /* noop */ }
  }

  // v0.4.0: confirm()の代わり。1回押すと確認状態（ボタン文言が変わる）になり、
  // 一定時間内にもう一度押すと実行する（パネル内の2回押し確認・ダイアログでページを止めない）。
  function armTwoStepButton(btn, confirmLabel, action, revertMs) {
    const waitMs = revertMs || 4000;
    let armed = false;
    let timer = null;
    const originalLabel = btn.textContent;
    const revert = () => {
      armed = false;
      clearTimeout(timer);
      btn.textContent = originalLabel;
    };
    btn.onclick = () => {
      if (!armed) {
        armed = true;
        btn.textContent = confirmLabel;
        timer = setTimeout(revert, waitMs);
        return;
      }
      revert();
      action();
    };
  }

  async function setComposerAndSend(text) {
    const input = getChatInput();
    if (!input) {
      showToast('ChatGPTの入力欄が見つかりませんでした');
      return false;
    }

    // v0.4.1.7: 固定のsleep(450)をやめ、「本文に入った」か「添付になった」かをDOM変化で待つ
    // （waitForDomCondition。裏タブのタイマー間引きの影響を受けにくい）。
    const attachmentsBefore = listComposerAttachmentRemoveButtons();
    lastAddedAttachmentButtons = [];
    const expectedMin = Math.min(20, String(text || '').trim().length);

    CHATGPT_ADAPTER.setComposerText(input, text);
    const landed = await waitForDomCondition(() => {
      const current = getChatInput() || input;
      if (expectedMin === 0 || getComposerText(current).trim().length >= expectedMin) return 'inline';
      const added = listComposerAttachmentRemoveButtons().filter(btn => attachmentsBefore.indexOf(btn) === -1);
      if (added.length) return 'attachment';
      return null;
    }, 3000, 200, true);

    let sendWaitMs = 5000;
    if (landed === 'attachment') {
      // 長すぎて添付になった：添付はそのまま残し、依頼番号入りの短い案内文を本文に入れて送る。
      lastAddedAttachmentButtons = listComposerAttachmentRemoveButtons().filter(btn => attachmentsBefore.indexOf(btn) === -1);
      const coverInput = getChatInput() || input;
      CHATGPT_ADAPTER.setComposerText(coverInput, buildAttachmentCoverMessage(text));
      sendWaitMs = 30000; // 添付のアップロードが終わるまで送信ボタンが押せないため
      console.debug('[Eisai] 依頼文が長いため添付として送ります（' + String(text || '').length + '文字）');
    } else if (!landed) {
      // どちらにもならなかった（まれ）：もう一度だけ入れ直す
      CHATGPT_ADAPTER.setComposerText(getChatInput() || input, text);
    }

    await sendMessage(getChatInput() || input, { waitMs: sendWaitMs });
    return true;
  }

  // v0.4.1.0: 送信確認は「入力欄以外の画面に依頼番号が現れた」「会話URLが/c/…に変わった」
  // 「入力欄が空になった」のいずれかだけで判定する（役割属性・送信ボタン・停止ボタンには
  // 依存しない）。確認できなければ送信失敗とみなす（呼び出し側で1回だけ再送する設計）。
  async function confirmSendSucceeded(requestId, startHref, timeoutMs) {
    // タブが裏にある間は期限を進めない（裏で過ごした分だけ期限を後ろにずらす）。
    // 条件判定自体（DOM状態の確認）はhiddenの影響を受けないため、hiddenでも毎回チェックする
    // （hiddenの間チェックをスキップすると、確認できているのに永久に返らなくなるため）。
    // v0.4.1.2で見直し：この関数はstartMarkerWatch/watchGeneratedImageの不具合（裏にある間、
    // 確認そのものをスキップしていた）とは別で、元から毎ループ確認しデッドラインだけ延ばす
    // 作りだったため変更不要。
    // v0.4.1.6: 2026-09-29に実機で確認：sleepの繰り返し（300msおき）はChromeの
    // Intensive Throttlingで大きく間引かれることがあった。DOM変化（入力欄が空になった・
    // 依頼番号が現れた等）で起きやすいwaitForDomConditionに変更（保険のタイマーは残す）。
    const budgetMs = typeof timeoutMs === 'number' ? timeoutMs : 8000;
    const check = () => {
      const currentInput = getChatInput();
      const composerEmptied = !currentInput || getComposerText(currentInput).trim().length === 0;
      const navigatedToConversation = typeof startHref === 'string' &&
        /\/c\//.test(location.pathname) && location.href !== startHref;
      const requestIdVisible = isRequestIdVisibleOutsideComposer(requestId);
      return composerEmptied || navigatedToConversation || requestIdVisible;
    };
    const result = await waitForDomCondition(check, budgetMs, 300, true);
    return !!result;
  }

  // v0.4.1.5: 2026-09-29に実機で確認：タブが裏にあるまま送信が確認できないと、以前は
  // waitUntilTabVisible()で表に戻るまで永久に待っていた（送信ボタンが遅れて出た結果、実際には
  // 送信できていたのに、パネルは「📨 送信中…」のまま止まって見えた）。
  //
  // 裏にある間に送信操作（入力欄へのテキスト設定・送信）を行うと、ChatGPT側のDOM反映が
  // 止まっている状態に書き込むことになり、「実は届いていた送信」と「これから送る再送」の
  // 区別が付かなくなって二重送信の恐れがある……というのが従来の考え方だったが、それは
  // 「入力欄に入れ直す（setComposerTextで打ち直す）」場合の話。入力欄の内容を変えず、
  // 送信ボタンをもう一度押すだけなら、次の条件が成り立つ時に限り、裏でも安全に行える：
  //   1. 入力欄に今回のプロンプトがまだ残っている（依頼番号「依頼番号：<ID>」を含む）
  //      → 今回の送信操作そのものがまだ入力欄に残っている＝ChatGPT側で処理済みではない
  //   2. その依頼番号が入力欄の外（会話・ChatGPTの応答）にまだ一切見えていない
  //      （isRequestIdVisibleOutsideComposerがfalse）→ 会話に届いた形跡が無い
  // この2つが同時に成り立つ時だけ「まだ確実に送れていない」と確定できるので、入力欄への
  // 打ち直しはせず、送信ボタンをもう一度押すだけの再試行を、裏でもそのまま行ってよい
  // （呼び出し側：genBtn.onclick参照）。条件を満たさない（入力欄が空・別内容になっている等、
  // 状態が確定できない）時は、打ち直し・再送はせず確認だけをやり直す（表に戻るまでの
  // 無限待ちはしない）。
  function canSafelyRetrySendWhileHidden(requestId) {
    const input = getChatInput();
    if (!input) return false;
    const text = getComposerText(input);
    if (!text || text.indexOf(requestIdNeedle(requestId)) === -1) return false;
    return !isRequestIdVisibleOutsideComposer(requestId);
  }

  // v0.4.1.6: 記事・サムネ指示・画像生成の3か所で別々に書かれていた「入力欄に入れる→送信→
  // 確認→（裏でも安全な時だけ）再送」を1つの関数にまとめた。呼び出し側はこの関数の戻り値
  // （{confirmed}）だけを見て、成功／失敗それぞれの画面表示を行う。
  //
  // 重要：完成監視（startMarkerWatch系・watchGeneratedImage）は、この関数を呼ぶ前に
  // （送信の成否にかかわらず）先に始めておくこと。2026-09-29に実機で確認：ChromeのIntensive
  // Throttlingでこの関数自体の解決が長く伸びることがあり、それを待ってから監視を始める
  // 作りだと、実は人が手で送信していても・送信自体は届いていても、監視が始まらず永久に
  // 「送信中…」のまま止まって見えた。監視を先に並行して始めておけば、この関数がどれだけ
  // 遅れても（あるいは失敗しても）、ChatGPT側の応答が現れた時点で監視側が拾える。
  async function sendAndConfirm(text, requestId, statusDiv, opts) {
    const options = opts || {};
    const sendingHintText = options.sendingHintText
      || '📨 送信しています…（ChatGPTの画面が後ろにあると少し時間がかかります）';
    const retryText = options.retryText || '📨 送信を確認できなかったため、もう一度送信します…';

    const startHref = location.href;
    let sendingHintTimer = setTimeout(() => {
      statusDiv.textContent = sendingHintText;
      statusDiv.classList.add('show');
    }, 2000);
    const stopSendingHint = () => {
      if (sendingHintTimer) { clearTimeout(sendingHintTimer); sendingHintTimer = null; }
    };

    try {
      const sent = await setComposerAndSend(text);
      let confirmed = sent && await confirmSendSucceeded(requestId, startHref);
      stopSendingHint();

      if (!confirmed) {
        // v0.4.1.5: 以前はここで表に戻るまで永久に待っていた（waitUntilTabVisible）。
        // 「まだ確実に送れていない」と確定できる時（canSafelyRetrySendWhileHidden）だけ、
        // 入力欄への打ち直しはせず送信ボタンをもう一度押す再試行を、裏でもそのまま行う
        // （二重送信にならない理由は同関数のコメント参照）。確定できない時は、打ち直し・
        // 再送はせず確認だけをやり直す（表に戻るまでの無限待ちはしない）。
        if (canSafelyRetrySendWhileHidden(requestId)) {
          statusDiv.textContent = retryText;
          statusDiv.classList.add('show');
          const retryInput = getChatInput();
          if (retryInput) await sendMessage(retryInput, { waitMs: lastAddedAttachmentButtons.length ? 30000 : 5000 });
          confirmed = await confirmSendSucceeded(requestId, startHref);
        } else {
          confirmed = await confirmSendSucceeded(requestId, startHref, 3000);
        }

        if (!confirmed) {
          // v0.4.0.6: 送信を確認できなかった場合、入力欄にプロンプトが残ったままだと
          // 次の操作で二重入力・二重送信の混乱を招くため、空に戻す。
          const leftoverInput = getChatInput();
          if (leftoverInput && getComposerText(leftoverInput).trim().length > 0) {
            CHATGPT_ADAPTER.setComposerText(leftoverInput, '');
          }
          // v0.4.1.7: 自分が付けた添付（長い依頼文）も外す（ユーザー自身の添付には触らない）
          lastAddedAttachmentButtons.forEach(btn => {
            try { if (btn.isConnected) btn.click(); } catch (e) { /* noop */ }
          });
          lastAddedAttachmentButtons = [];
        }
      }

      return { confirmed };
    } finally {
      stopSendingHint();
    }
  }

  function decodeHtmlText(raw) {
    return String(raw || '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  // v0.4.0: writing block（文書カード）対応。ChatGPTのヘッダー（タイトル文字）や
  // 提案ボタン（followups）の文言がgetResponseTextの取得結果に混ざっても、
  // 最初の<h1より前と、最後のEISAI_CHECK（無ければEISAI_TITLES、それも無ければCTA_DATA_END）の
  // -->より後を切り落として本文だけに絞る。decodeHtmlText済みのテキストに対して使う純粋関数
  // （DOM・localStorageに依存しないのでNodeからも呼べる）。
  // v0.4.0.8: 切り出しの起点を「最初の裸の<h1」ではなく、閉じた見出し<h1>…</h1>
  // （CLOSED_H1_RE）の開始位置にした。プロンプトの決まり文句（「応答は <h1> から始め」等）が
  // 本文より前に混入していた場合、裸の<h1のままだとそこから切り出してしまい、プロンプトの
  // 断片を記事本文と誤認する（実機2026-09-27で確認した不具合）。閉じた見出しが見つからない時
  // （記事そのものが未検出）だけ、従来どおり裸の<h1から切り出す。
  function trimToArticleBounds(text) {
    let out = String(text || '');

    const closedH1Match = out.match(CLOSED_H1_RE);
    const h1Match = closedH1Match || out.match(/<h1[\s>]/i);
    if (h1Match) {
      out = out.slice(h1Match.index);
    }

    const endMarkerPatterns = [
      /<!--\s*EISAI_CHECK\b[\s\S]*?-->/gi,
      /<!--\s*EISAI_TITLES\b[\s\S]*?-->/gi,
      /<!--CTA_DATA_END-->/gi
    ];
    for (const re of endMarkerPatterns) {
      let lastEnd = -1;
      let m;
      re.lastIndex = 0;
      while ((m = re.exec(out))) {
        lastEnd = m.index + m[0].length;
      }
      if (lastEnd >= 0) {
        out = out.slice(0, lastEnd);
        break;
      }
    }

    return out;
  }

  // v0.4.1.0:「読み取り直す」で、依頼番号の目印がまだ見つからない時の最後の保険。
  // main全体（自パネル・入力欄を除く）から、最後に見つかった閉じた見出し<h1>…</h1>より
  // 後ろだけを対象にし、trimToArticleBoundsで末尾（EISAI_CHECK等）まで切り出す。
  function extractArticleFallbackFromMainText() {
    const index = collectMainTextIndex();
    const decoded = decodeHtmlText(index.text);
    const re = new RegExp(CLOSED_H1_RE.source, 'gi');
    let lastMatch = null;
    let m;
    while ((m = re.exec(decoded))) { lastMatch = m; }
    if (!lastMatch) return '';
    return trimToArticleBounds(decoded.slice(lastMatch.index));
  }

  // v0.4.1.0:「貼り付けて読み込む」（§8・最後の逃げ道）用。ユーザーがChatGPTのコピーボタンで
  // コピーした回答をそのまま貼れるように、まず合言葉（目印）を探し、無ければ<h1>ベースの
  // 保険（trimToArticleBounds）にフォールバックする。requestIdが分かっていれば最優先で使い、
  // 分からない／一致しない場合は目印の形（[[EISAI-START-…]]〜[[EISAI-END-…]]）だけを見る
  // 汎用パターンで探す。
  function extractMarkerBoundedText(rawText, requestId) {
    const decoded = decodeHtmlText(String(rawText || ''));
    if (requestId) {
      const startNeedle = startMarkerText(requestId);
      const endNeedle = endMarkerText(requestId);
      const s = decoded.lastIndexOf(startNeedle);
      if (s !== -1) {
        const e = decoded.indexOf(endNeedle, s + startNeedle.length);
        if (e !== -1) return decoded.slice(s + startNeedle.length, e).trim();
      }
    }
    const generic = decoded.match(/\[\[EISAI-START-[a-z0-9]+\]\]([\s\S]*?)\[\[EISAI-END-[a-z0-9]+\]\]/i);
    if (generic) return generic[1].trim();
    return null;
  }

  // 貼り付けテキスト→記事本文らしき文字列（目印優先、無ければ<h1>ベース）。
  function extractPastedArticleText(rawText, requestId) {
    const bounded = extractMarkerBoundedText(rawText, requestId);
    if (bounded !== null) return bounded;
    return trimToArticleBounds(decodeHtmlText(String(rawText || '')));
  }

  // 貼り付けテキスト→サムネ指示らしき文字列（目印優先、無ければ生テキストのまま。
  // extractImagePromptText/extractImgTextMeta側が[[EISAI_IMG_PROMPT]]等を探す）。
  function extractPastedThumbnailText(rawText, requestId) {
    const bounded = extractMarkerBoundedText(rawText, requestId);
    if (bounded !== null) return bounded;
    return decodeHtmlText(String(rawText || ''));
  }

  function escapeHtml(raw) {
    return String(raw || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(raw) {
    return escapeHtml(raw).replace(/`/g, '&#96;');
  }

  function sanitizeTel(raw) {
    return String(raw || '').replace(/[^\d+]/g, '');
  }

  // v0.4.0: 全角/半角・空白の違いを無視して比較できるように正規化する（NFKCで全角数字等を半角化し、空白は除去）
  function normalizeForMatch(str) {
    return String(str || '').normalize('NFKC').replace(/\s+/g, '');
  }

  // v0.4.0: HTMLタグ・コメントを除いた素のテキストを得る（要確認チェックの走査対象を作るため）
  function stripHtmlToPlainText(html) {
    return String(html || '')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ');
  }

  // v0.4.0: 日付の表記ゆれ（2026.09.06／2026/9/6／9/6／9月6日／9.6 等）を無視して
  // 同じ日付かどうかを比較できるように、テキスト中の日付らしき箇所から「月-日」のキー集合を作る
  // （年が違っても月日が一致すれば同じ日付とみなす。年月日が無い「9/6」のような単独表記も拾う）。
  function collectMonthDayKeys(text) {
    const keys = new Set();
    const normalized = String(text || '').normalize('NFKC');
    const addKey = (month, day) => {
      const m = parseInt(month, 10);
      const d = parseInt(day, 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) keys.add(m + '-' + d);
    };
    // YYYY.MM.DD / YYYY/MM/DD / YYYY-MM-DD
    {
      const re = /\d{4}[.\/\-](\d{1,2})[.\/\-](\d{1,2})/g;
      let m;
      while ((m = re.exec(normalized))) addKey(m[1], m[2]);
    }
    // YYYY年M月D日
    {
      const re = /\d{4}年(\d{1,2})月(\d{1,2})日/g;
      let m;
      while ((m = re.exec(normalized))) addKey(m[1], m[2]);
    }
    // M月D日（年なし）
    {
      const re = /(\d{1,2})月(\d{1,2})日/g;
      let m;
      while ((m = re.exec(normalized))) addKey(m[1], m[2]);
    }
    // M/D・M.D（年が前についていない単独表記。YYYY.MM.DD等の一部として再検出されても
    // Setなので実害はない）
    {
      const re = /\b(\d{1,2})[.\/](\d{1,2})\b/g;
      let m;
      while ((m = re.exec(normalized))) addKey(m[1], m[2]);
    }
    return keys;
  }

  // v0.4.0（要確認の数字誤検出対策）: 人数の単位ゆれ（名／人／人組）を同じ扱いで比較できるように、
  // テキスト中の「数字+名／数字+人」から数字だけを集めた集合を作る
  // （「5人組」の「組」は数字に続く単位の対象外のため、「5人」の形で拾われる＝結果として同じ扱いになる）。
  function collectPersonCounts(text) {
    const counts = new Set();
    const normalized = String(text || '').normalize('NFKC');
    const re = /([0-9]+)(?:名|人)/g;
    let m;
    while ((m = re.exec(normalized))) counts.add(parseInt(m[1], 10));
    return counts;
  }

  // v0.4.0（要確認の数字誤検出対策）: 学年の表記ゆれ（中3／中学3年／中学校3年／3年生／3年。
  // 小・高も同様）を「学年＋数字」の同じ扱いで比較できるように、テキスト中から学年を表す数字を集めた
  // 集合を作る。「3年目」「3年間」のような年数と学年を区別するため、学年を表す語
  // 〈中学校/中学/小学校/小学/高等学校/高校/中/小/高〉が直前に付く場合と、「年生」で終わる場合だけを
  // 学年とみなす（語が無い単独の「3年」は年数の可能性があるため対象にしない）。
  // 注意：module.exports の早期returnより後ろにあるトップレベルconstは、Nodeからrequire()した際
  // 未初期化のまま参照されてしまう（関数宣言のみホイスティングで使える）。そのため学年を表す語の
  // 正規表現は、関数の中でその都度組み立てる（gradeLevelWordSource）。
  function gradeLevelWordSource() {
    return '(?:中学校|中学|小学校|小学|高等学校|高校|中|小|高)';
  }
  // 「前」の直前が学年を表す語（中学校/中学/小学校/小学/高等学校/高校/中/小/高）で終わっているかどうか
  function endsWithGradeLevelWord(text) {
    return new RegExp(gradeLevelWordSource() + '$').test(String(text || ''));
  }
  function collectGradeNumbers(text) {
    const numbers = new Set();
    const normalized = String(text || '').normalize('NFKC');
    // 中3／小6／高2（「年」を伴わない略記）
    {
      const re = new RegExp(gradeLevelWordSource() + '([0-9]+)(?!年)', 'g');
      let m;
      while ((m = re.exec(normalized))) numbers.add(parseInt(m[1], 10));
    }
    // 中学3年／中学校3年（学年を表す語＋数字＋年）
    {
      const re = new RegExp(gradeLevelWordSource() + '([0-9]+)年', 'g');
      let m;
      while ((m = re.exec(normalized))) numbers.add(parseInt(m[1], 10));
    }
    // 3年生（学年を表す語が無くても「年生」なら学年とみなす）
    {
      const re = /([0-9]+)年生/g;
      let m;
      while ((m = re.exec(normalized))) numbers.add(parseInt(m[1], 10));
    }
    return numbers;
  }

  // v0.4.0（要確認の数字誤検出対策）: 「回・回目」は、入力に同じ数字の「回」表記があれば
  // 要確認にしない（「前回→今回」のような回数の言い換えまでは追わず、数字そのものの有無だけで
  // 判定する。数字が入力に無い場合は要確認のまま残す）。
  function collectTimesCounts(text) {
    const counts = new Set();
    const normalized = String(text || '').normalize('NFKC');
    const re = /([0-9]+)回/g;
    let m;
    while ((m = re.exec(normalized))) counts.add(parseInt(m[1], 10));
    return counts;
  }

  // v0.4.1.3（要確認の数字誤検出対策）: 「62点→81点」のような入力の数字どうしの差（19点＝
  // 81-62）や和を本文が言い換えているだけの場合まで要確認に出さないよう、入力テキストから
  // 「単位ごとの数字集合」を作る（名・人・点・回・問・％・分・時間・日・か月・年・位・倍・円）。
  // 本文側の数字が、同じ単位の入力の数字2つの組み合わせの差または和と一致する時だけ
  // 要確認から除く（何でも通らないよう、必ず入力に実在する数字どうしの組み合わせに限る）。
  function collectNumbersByUnit(text) {
    const byUnit = new Map();
    const normalized = String(text || '').normalize('NFKC');
    const re = /([0-9]+)(?:[.,][0-9]+)?(名|人|点|回|問|％|分|時間|日|か月|年|位|倍|円)/g;
    let m;
    while ((m = re.exec(normalized))) {
      const unit = m[2];
      const num = parseInt(m[1], 10);
      if (!byUnit.has(unit)) byUnit.set(unit, new Set());
      byUnit.get(unit).add(num);
    }
    return byUnit;
  }

  // 同じ単位の入力の数字2つ（distinct）の差または和のいずれかが target と一致するか
  function matchesInputNumberDiffOrSum(byUnit, unit, target) {
    const set = byUnit.get(unit);
    if (!set || set.size < 2 || !(target > 0)) return false;
    const values = Array.from(set);
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        const a = values[i];
        const b = values[j];
        if (Math.abs(a - b) === target || (a + b) === target) return true;
      }
    }
    return false;
  }

  // v0.4.0（design.md 5.要確認／要確認の「」判定調整）：本文（bodyHtml。タグを含む生成HTML）を
  // 走査し、入力（inputText）に含まれていない「誰かが言ったことになっている発言」／曜日表記／数字＋単位を
  // 検出する純粋関数。ブラウザ・Node どちらからも呼べる（DOM・localStorageに依存しない）。
  //
  // 「」内の文言は、入力に無く、かつ次のどちらかに当てはまる時だけ要確認にする
  // （「勉強する場所」のような説明のための言い回しまで拾って読み飛ばされる量になるのを防ぐため）：
  //   1. 閉じ」の直後6字以内に発言の帰属がある
  //      （と言う／と話す／とおっしゃる／と聞く／と笑う／とつぶやく／と教える／と答える／と声…、
  //        という声・言葉・一言・ひと言・感想、って言う・話す、との声・こと）
  //   2. 「」の中に文末記号（。！？!?）がある
  // さらに、吹き出し（bubble-left / bubble-right）内の発言は「」の有無に関わらず対象にする
  // （<div class="bubble-right">Aさん：…</div> のような、入力に無い創作セリフを拾うため）。
  function findUnverifiedClaims(bodyHtml, inputText) {
    const rawBody = String(bodyHtml || '');
    const body = stripHtmlToPlainText(rawBody);
    const normalizedInput = normalizeForMatch(inputText);
    const results = [];
    const seen = new Set();

    function addMatch(type, matched, excerpt) {
      const key = type + '::' + normalizeForMatch(matched);
      if (seen.has(key)) return;
      seen.add(key);
      results.push({ type, text: matched, excerpt });
    }

    function excerptAround(source, index, length) {
      const start = Math.max(0, index - 15);
      const end = Math.min(source.length, index + length + 15);
      return source.slice(start, index) + '【' + source.slice(index, index + length) + '】' + source.slice(index + length, end);
    }

    // 発言の帰属語（閉じ」の直後、6字以内。空白は無視して判定する）
    const ATTRIBUTION_RE = /(?:と(?:言|話|おっしゃ|聞|笑|つぶや|教え|答え|声)|という(?:声|言葉|一言|ひと言|感想)|って(?:言|話)|との(?:声|こと))/;
    const SENTENCE_END_RE = /[。！？!?]/;

    // 1・2. 「」内の文言（発言の帰属がある、または文末記号がある時だけ）
    {
      const re = /「([^」]+)」/g;
      let m;
      while ((m = re.exec(body))) {
        const inner = m[1];
        if (normalizedInput.includes(normalizeForMatch(inner))) continue;
        const afterStart = m.index + m[0].length;
        const after = body.slice(afterStart, afterStart + 6).replace(/\s+/g, '');
        const hasAttribution = ATTRIBUTION_RE.test(after);
        const hasSentenceEnd = SENTENCE_END_RE.test(inner);
        if (hasAttribution || hasSentenceEnd) {
          addMatch('quote', m[0], excerptAround(body, m.index, m[0].length));
        }
      }
    }

    // 3. 吹き出し（bubble-left / bubble-right）内の発言（「」が無くても本文を対象にする）
    // v0.4.1.3: 吹き出しの冒頭は必ず話者ラベル（<strong>Aさん：</strong>等。全角・半角コロン
    // どちらもあり得る）で始まる（buildBlogPromptV3の出力規約）。ラベルは入力に無い文字列
    // （生徒名等）を含むことがあり、比較対象に混ぜると発言そのものが入力にあっても不一致に
    // なってしまうため、比較・表示の対象から冒頭の<strong>…</strong>ごと除く。
    {
      const re = /<div[^>]*\bclass=["'][^"']*\bbubble-(?:left|right)\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
      let m;
      while ((m = re.exec(rawBody))) {
        const withoutLabel = m[1].replace(/^\s*<strong[^>]*>[\s\S]*?<\/strong>\s*/i, '');
        const text = stripHtmlToPlainText(withoutLabel).replace(/\s+/g, ' ').trim();
        if (!text) continue;
        if (normalizedInput.includes(normalizeForMatch(text))) continue;
        addMatch('quote', text, '（吹き出し）' + text);
      }
    }

    // 4. 曜日表記（（月）〜（日）、〜曜日）
    {
      const re = /(?:[（(]\s*[月火水木金土日]\s*[）)]|[月火水木金土日]曜日)/g;
      let m;
      while ((m = re.exec(body))) {
        if (!normalizedInput.includes(normalizeForMatch(m[0]))) {
          addMatch('weekday', m[0], excerptAround(body, m.index, m[0].length));
        }
      }
    }

    // 5. 数字＋単位（名・人・点・回・問・％・分・時間・日・か月・年・位・倍・円）
    // v0.4.0: 「M月D日」の「D日」部分は、日付の表記ゆれ（2026.09.06／2026/9/6／9/6／9.6等）を
    // 正規化した上で、入力のどこかに同じ月日があれば要確認にしない（日付の誤検出対策）。
    // v0.4.0（要確認の数字誤検出対策）: 単位・言い回しのゆれ（名⇔人⇔人組、中3⇔中学3年⇔中学校3年
    // ⇔3年生⇔3年、回⇔回目）は、入力側・本文側を同じ規則で正規化してから数字だけを比較する
    // （入力と同じ事実の言い換えを要確認から除くため。collectPersonCounts/collectGradeNumbers/
    // collectTimesCounts参照）。
    {
      const inputDateKeys = collectMonthDayKeys(inputText);
      const inputPersonCounts = collectPersonCounts(inputText);
      const inputGradeNumbers = collectGradeNumbers(inputText);
      const inputTimesCounts = collectTimesCounts(inputText);
      const inputUnitNumbers = collectNumbersByUnit(inputText);
      const re = /([0-9０-９]+(?:[.,][0-9０-９]+)?)(名|人|点|回|問|％|分|時間|日|か月|年|位|倍|円)/g;
      let m;
      while ((m = re.exec(body))) {
        const matched = m[0];
        const numberText = m[1];
        const unit = m[2];
        if (normalizedInput.includes(normalizeForMatch(matched))) continue;

        const numValue = parseInt(String(numberText).normalize('NFKC').replace(/[.,].*$/, ''), 10);

        if (unit === '日') {
          const before = body.slice(0, m.index);
          const monthMatch = before.match(/([0-9０-９]{1,2})月$/);
          if (monthMatch) {
            const monthNum = parseInt(String(monthMatch[1]).normalize('NFKC'), 10);
            if (monthNum >= 1 && monthNum <= 12 && numValue >= 1 && numValue <= 31 &&
                inputDateKeys.has(monthNum + '-' + numValue)) {
              continue;
            }
          }
        }

        // 名／人（人組の「人」部分もここに含まれる）：入力に同じ人数があれば要確認にしない
        if ((unit === '名' || unit === '人') && inputPersonCounts.has(numValue)) continue;

        // 年：学年の言い回し（中3／中学3年／中学校3年／3年生／3年）の時だけ、入力に同じ学年の
        // 数字があれば要確認にしない（「3年目」「3年間」等の年数はここでは扱わない）
        if (unit === '年') {
          const after = body.slice(m.index + matched.length, m.index + matched.length + 1);
          const before = body.slice(Math.max(0, m.index - 4), m.index);
          const isGradeWording = after === '生' || endsWithGradeLevelWord(before);
          if (isGradeWording && inputGradeNumbers.has(numValue)) continue;
        }

        // 回（回目の「回」部分もここに含まれる）：入力に同じ数字の「回」表記があれば要確認にしない
        if (unit === '回' && inputTimesCounts.has(numValue)) continue;

        // v0.4.1.3: 上記の言い換え以外でも、同じ単位の「入力にある数字2つ」の差または和と
        // 一致するなら要確認にしない（例：入力「62点」「81点」→本文「19点アップ」はOK）。
        // 何でも通らないよう、必ず入力に実在する同じ単位の数字どうしの組み合わせに限る。
        if (matchesInputNumberDiffOrSum(inputUnitNumbers, unit, numValue)) continue;

        addMatch('number', matched, excerptAround(body, m.index, matched.length));
      }
    }

    return results;
  }

  function extractH1Text(html) {
    const match = String(html || '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    return match ? decodeHtmlText(match[1].replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim() : '';
  }

  // <!--EISAI_TITLES: ["...","...","..."]--> をHTMLから抽出・除去する。
  // 候補が取れない場合でも <h1> を1案目として必ず返し、タイトル選択UIを成立させる。
  function extractTitleCandidates(html) {
    let titles = [];
    let cleaned = html || '';
    const m = cleaned.match(/<!--\s*EISAI_TITLES\s*:\s*(\[[\s\S]*?\])\s*-->/i)
      || cleaned.match(/&lt;!--\s*EISAI_TITLES\s*:\s*(\[[\s\S]*?\])\s*--&gt;/i)
      || cleaned.match(/EISAI_TITLES\s*:\s*(\[[\s\S]*?\])/i);
    if (m) {
      try {
        const parsed = JSON.parse(decodeHtmlText(m[1]));
        if (Array.isArray(parsed)) {
          titles = parsed
            .map(t => String(t || '').trim())
            .filter(Boolean)
            .map(t => t.slice(0, 33));
        }
      } catch (e) {
        console.warn('[Eisai] タイトル候補のJSON解析に失敗しました:', e);
      }
    }
    // EISAI_TITLESマーカーは配列有無に関わらず本文から必ず除去する（コピーHTMLへの残留防止）
    cleaned = cleaned.replace(/<p[^>]*>\s*(?:<!--|&lt;!--)?\s*EISAI_TITLES[\s\S]*?(?:-->|--&gt;)\s*<\/p>/gi, '');
    cleaned = cleaned.replace(/(?:<!--|&lt;!--)\s*EISAI_TITLES[\s\S]*?(?:-->|--&gt;)/gi, '');
    cleaned = cleaned.replace(/EISAI_TITLES\s*:\s*\[[\s\S]*?\]/gi, '');
    cleaned = cleaned.trim();

    // 実際の <h1> を1案目（SEO重視）として扱う。
    // ・3案が取れている場合：プロンプトで1案目=h1と一致させているため、
    //   微差（末尾句点・全角半角など）があっても1案目を実h1に揃える。取りこぼし・ラベルずれを防ぐ。
    // ・候補が取れない場合：h1のみを唯一の候補にする。
    const h1Title = extractH1Text(cleaned);
    if (h1Title) {
      const capped = h1Title.slice(0, 33);
      if (titles.length === 0) {
        titles = [capped];
      } else if (titles[0] !== capped) {
        titles[0] = capped;
      }
    }
    return { html: cleaned, titles: titles.slice(0, 3) };
  }

  // <!--EISAI_CHECK: {...}--> をHTMLから抽出・除去する（design.md 5.結果パネル）。
  // コピーするHTMLには残さず、結果パネルの自己チェック表示だけに使う。
  function extractEisaiCheck(html) {
    let cleaned = html || '';
    let check = null;
    const m = cleaned.match(/<!--\s*EISAI_CHECK\s*:\s*(\{[\s\S]*?\})\s*-->/i)
      || cleaned.match(/&lt;!--\s*EISAI_CHECK\s*:\s*(\{[\s\S]*?\})\s*--&gt;/i);
    if (m) {
      try {
        check = JSON.parse(decodeHtmlText(m[1]));
      } catch (e) {
        console.warn('[Eisai] EISAI_CHECKのJSON解析に失敗しました:', e);
      }
    }
    cleaned = cleaned.replace(/(?:<!--|&lt;!--)\s*EISAI_CHECK[\s\S]*?(?:-->|--&gt;)/gi, '');
    cleaned = cleaned.trim();
    return { html: cleaned, check };
  }

  // lastBlogHtml の <h1> を選択されたタイトルに差し替える
  function applyTitleToBlogHtml(title) {
    if (!lastBlogHtml || !title) return;
    const safe = escapeHtml(title);
    // 置換文字列内の $ 特殊解釈を避けるため、関数リプレーサで挿入する
    if (/<h1[^>]*>[\s\S]*?<\/h1>/i.test(lastBlogHtml)) {
      lastBlogHtml = lastBlogHtml.replace(/(<h1[^>]*>)[\s\S]*?(<\/h1>)/i, (_m, open, close) => open + safe + close);
    } else {
      lastBlogHtml = `<h1>${safe}</h1>\n` + lastBlogHtml;
    }
    lastBlogTitle = title;
    setGeneratedContext({ blogHtml: lastBlogHtml, articleFacts: lastArticleFacts, blogTitle: lastBlogTitle });
  }

  // エディタ側で3タイトルを選べるよう、コピーHTMLの末尾に埋め込むコメントを作る
  // （2案未満なら埋め込まない。HTMLコメントなのでWordPress等では不可視）
  function buildTitlesComment(titles) {
    if (!Array.isArray(titles) || titles.length < 2) return '';
    const json = JSON.stringify(titles.map(t => String(t || '').slice(0, 33)));
    return '\n<!--EISAI_TITLES: ' + json + '-->';
  }

  // 生成完了後、タイトル選択セクションに3案のボタンを描画する
  const TITLE_CANDIDATE_LABELS = ['① SEO重視', '② 共感重視', '③ CV重視'];
  function renderTitleCandidates() {
    const section = document.getElementById('eisai-title-section');
    const wrap = document.getElementById('eisai-title-buttons');
    if (!section || !wrap) return;
    while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
    if (!lastTitleCandidates || lastTitleCandidates.length < 2) {
      section.style.display = 'none';
      return;
    }
    section.style.display = 'block';
    lastTitleCandidates.forEach((title, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'eisai-title-pick';
      // v0.4.0: 33字を超えるタイトルは文字数を赤で表示する（見出しの一般的な表示崩れの目安）。
      const isTooLong = title.length > 33;
      const countColor = isTooLong ? 'var(--eisai-red)' : 'var(--eisai-text-soft)';
      btn.innerHTML = `<span style="display:block;font-size:10px;color:${countColor};font-weight:${isTooLong ? '700' : '400'};margin-bottom:2px;">${TITLE_CANDIDATE_LABELS[idx] || ('案' + (idx + 1))}（${title.length}文字）</span>${escapeHtml(title)}`;
      btn.onclick = () => {
        applyTitleToBlogHtml(title);
        wrap.querySelectorAll('button').forEach(b => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        const toast = document.getElementById('eisai-copy-toast');
        if (toast) {
          toast.style.display = 'block';
          toast.textContent = `タイトルを反映しました：${title}`;
          setTimeout(() => { toast.style.display = 'none'; }, 2000);
        }
      };
      wrap.appendChild(btn);
    });
    // 初期状態は1案目（h1と同一）を選択済み表示
    const first = wrap.querySelector('button');
    if (first) first.classList.add('is-selected');
  }

  // v0.4.0（design.md 5.結果パネル）：EISAI_CHECKの○△×と、拡張機能側の実測を表示する
  const EISAI_CHECK_LABELS = {
    title: 'タイトル', structure: '構成', classroom: '教室情報', visibility: '可視性',
    cta: 'CTA', benefit: 'ベネフィット', facts_only: '事実のみ'
  };
  function renderCheckAndMetrics() {
    const section = document.getElementById('eisai-check-section');
    const body = document.getElementById('eisai-check-body');
    if (!section || !body) return;
    while (body.firstChild) body.removeChild(body.firstChild);

    if (lastEisaiCheck && typeof lastEisaiCheck === 'object') {
      const row = createEl('div', { style: { marginBottom: '6px' } }, body);
      Object.keys(EISAI_CHECK_LABELS).forEach(key => {
        if (lastEisaiCheck[key] === undefined) return;
        const mark = String(lastEisaiCheck[key]);
        const bg = mark === '○' ? '#dcfce7' : (mark === '△' ? '#fef3c7' : (mark === '×' ? '#fde2e2' : '#e2e8f0'));
        const fg = mark === '○' ? '#166534' : (mark === '△' ? '#92400e' : (mark === '×' ? '#b42318' : '#334155'));
        createEl('span', {
          className: 'eisai-check-chip',
          style: { background: bg, color: fg }
        }, row, `${EISAI_CHECK_LABELS[key]}：${mark}`);
      });
      if (Array.isArray(lastEisaiCheck.notes) && lastEisaiCheck.notes.length) {
        createEl('div', { style: { fontSize: '11px', color: '#64748b', marginTop: '2px' } }, body,
          '備考：' + lastEisaiCheck.notes.join(' / '));
      }
    } else {
      createEl('div', { style: { fontSize: '11px', color: '#94a3b8', marginBottom: '6px' } }, body,
        '（EISAI_CHECKを検出できませんでした）');
    }

    if (lastArticleMetrics) {
      const m = lastArticleMetrics;
      const midPos = (m.midCtaPositionPercent != null) ? `（中間CTA位置：約${m.midCtaPositionPercent}%）` : '';
      createEl('div', { style: { marginTop: '4px' } }, body,
        `本文字数：${m.chars}字／見出し(h2)：${m.h2Count}／CTA数：${m.ctaCount}${midPos}／写真枠：${m.photoCount}／感嘆符：${m.exclamationCount}／絵文字：${m.emojiCount}`);
    }

    section.style.display = 'block';
  }

  const UNVERIFIED_TYPE_LABELS = { quote: '発言', weekday: '曜日', number: '数字' };
  function renderUnverifiedList() {
    const section = document.getElementById('eisai-unverified-section');
    const body = document.getElementById('eisai-unverified-body');
    if (!section || !body) return;
    while (body.firstChild) body.removeChild(body.firstChild);

    const claims = lastUnverifiedClaims || [];
    const title = document.getElementById('eisai-unverified-title');
    if (title) {
      title.textContent = claims.length
        ? `③ 要確認（${claims.length}件：入力に無いかもしれない箇所）`
        : '③ 要確認なし（入力に無い発言・曜日・数字は見つかりませんでした）';
      title.style.color = claims.length ? '#9a3412' : 'var(--eisai-green)';
    }
    section.style.background = claims.length ? '#fff7ed' : 'var(--eisai-green-bg)';
    section.style.borderColor = claims.length ? '#fdba74' : '#bfe6cf';
    if (claims.length) {
      claims.forEach(c => {
        createEl('div', { style: { marginBottom: '5px', fontSize: '12px' } }, body,
          `［${UNVERIFIED_TYPE_LABELS[c.type] || c.type}］…${c.excerpt}…`);
      });
    }
    section.style.display = 'block';
  }

  function getGeneratedContextRecord() {
    try {
      const record = JSON.parse(localStorage.getItem(GENERATED_CONTEXT_STORAGE_KEY) || 'null');
      if (!record || typeof record !== 'object') return {};
      if (Date.now() - Number(record.updatedAt || 0) > GENERATED_CONTEXT_MAX_AGE_MS) {
        localStorage.removeItem(GENERATED_CONTEXT_STORAGE_KEY);
        return {};
      }
      return record;
    } catch (e) {
      localStorage.removeItem(GENERATED_CONTEXT_STORAGE_KEY);
      return {};
    }
  }

  function setGeneratedContext(patch = {}) {
    const next = {
      ...getGeneratedContextRecord(),
      ...patch,
      updatedAt: Date.now()
    };
    lastBlogHtml = next.blogHtml || '';
    lastArticleFacts = next.articleFacts || '';
    lastBlogTitle = next.blogTitle || extractH1Text(next.blogHtml || '');
    try {
      localStorage.setItem(GENERATED_CONTEXT_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('[Eisai] 生成コンテキストの保存に失敗しました:', e);
    }
    return next;
  }

  function restoreGeneratedContext() {
    const record = getGeneratedContextRecord();
    if (!record || !Object.keys(record).length) return record;
    lastBlogHtml = record.blogHtml || lastBlogHtml || '';
    lastArticleFacts = record.articleFacts || lastArticleFacts || '';
    lastBlogTitle = record.blogTitle || lastBlogTitle || extractH1Text(lastBlogHtml);
    return record;
  }

  function extractImagePromptText(raw) {
    const text = String(raw || '').trim();
    const markerMatch = text.match(/\[\[EISAI_IMG_PROMPT\]\]([\s\S]*?)\[\[\/EISAI_IMG_PROMPT\]\]/);
    if (markerMatch) {
      return markerMatch[1].trim();
    }
    return text
      .replace(/^---\s*/i, '')
      .replace(/以下のプロンプトで画像を生成してください\s*/g, '')
      .replace(/このプロンプトで画像を生成してください。?\s*/g, '')
      .replace(/\s*---$/i, '')
      .trim();
  }

  // v0.4.0.4: ChatGPTの出力にある `[[EISAI_IMG_TEXT]] メイン：…／サブ1：…／サブ2：…` 行を解析し、
  // 画像に実際に描き込む文字を取り出す。見つからなければnullを返す（呼び出し側でタイトルへの
  // フォールバックを行う）。
  // v0.4.1.3: 作り込み型サムネ（左上ラベル・特大メイン・色帯サブ・補足・下部タグの複数レイヤー）
  // に合わせて、ラベル・補足・タグを追加で読み取れるように拡張した。旧形式（メイン／サブ1／サブ2
  // だけの行）もそのまま読める（無いフィールドは空文字／空配列のまま）。
  function extractImgTextMeta(raw) {
    const text = String(raw || '');
    const lineMatch = text.match(/\[\[EISAI_IMG_TEXT\]\]\s*([^\n\r]*)/i);
    if (!lineMatch) return null;
    const body = lineMatch[1].trim();
    if (!body) return null;

    const meta = { label: '', main: '', sub1: '', sub2: '', note: '', tags: [] };
    body.split(/[／/]/).map(s => s.trim()).filter(Boolean).forEach(part => {
      const m = part.match(/^(ラベル|メイン|サブ\s*1|サブ\s*2|サブ|補足|タグ)\s*[:：]\s*(.+)$/);
      if (!m) return;
      const label = m[1].replace(/\s+/g, '');
      const value = m[2].trim();
      if (!value) return;
      if (label === 'ラベル') meta.label = value;
      else if (label === 'メイン') meta.main = value;
      else if (label === 'サブ1') meta.sub1 = value;
      else if (label === 'サブ2') meta.sub2 = value;
      else if (label === 'サブ') {
        if (!meta.sub1) meta.sub1 = value;
        else if (!meta.sub2) meta.sub2 = value;
      } else if (label === '補足') meta.note = value;
      else if (label === 'タグ') meta.tags = value.split(/[,、]/).map(s => s.trim()).filter(Boolean);
    });

    if (!meta.label && !meta.main && !meta.sub1 && !meta.sub2 && !meta.note && meta.tags.length === 0) return null;
    return meta;
  }

  // v0.4.0.4: 画像生成の送信文の先頭に付ける「文字を必ず描き込む」強制指示を組み立てる。
  // metaが取れなければ、選ばれたタイトル（fallbackTitle）をメイン文字として使う。
  // どちらも無ければ空文字を返す（呼び出し側で強制指示を付けない）。
  // v0.4.1.3: ラベル・補足・タグにも対応し、それぞれの置き場所（左上ラベル・色帯サブ・
  // 小さめの補足・下部タグ）を短く伝えるようにした。旧形式（メイン・サブのみ）の呼び出しでも
  // 変わらず動く（無いフィールドはparts配列に追加されないだけ）。
  function buildForcedImageTextInstruction(meta, fallbackTitle) {
    const main = (meta && meta.main) ? meta.main : String(fallbackTitle || '').trim();
    if (!main) return '';
    const parts = [];
    if (meta && meta.label) parts.push('左上の角丸ラベルに『' + meta.label + '』');
    parts.push('特大のメイン文字に『' + main + '』');
    const subs = [];
    if (meta && meta.sub1) subs.push(meta.sub1);
    if (meta && meta.sub2) subs.push(meta.sub2);
    if (subs.length) parts.push('色帯の上のサブ文字に『' + subs.join('』『') + '』');
    if (meta && meta.note) parts.push('小さめの補足に『' + meta.note + '』');
    if (meta && meta.tags && meta.tags.length) parts.push('下部のタグに『' + meta.tags.join('』『') + '』');
    return `画像の中に次の日本語の文字を、それぞれの場所へはっきり読める大きさで必ず描き込んでください：${parts.join('、')}。文字の誤字・欠け・別の文字への置き換えは不可。`;
  }

  // v0.4.1.3: 画像生成の送信文（imgExecBtnクリック時にChatGPTへ送る本文）を組み立てる純粋関数。
  // forcedTextInstructionはbuildForcedImageTextInstructionの戻り値（空文字なら省略）。
  // 人物がいる場合の場面ルール（授業＝横並び・白衣／面談＝向かい合わせ・スーツ）を、
  // promptRequest側の「教室と場面の描写」とは別に、画像生成の送信ごとに必ず短く付ける
  // （promptRequest作成後にユーザーが写真をアップロードし直す等、教室描写を使わない生成でも
  // 人物の服装・向きだけは毎回守らせるため）。
  function buildImageGenerateMessage(requestId, forcedTextInstruction, imgPrompt) {
    const sceneRuleLine = '人物がいる場合：授業場面は先生と生徒が横並び、先生は白衣。面談場面は向かい合わせ、室長はスーツ。';
    return buildRequestIdLine(requestId) + '\n' +
      (forcedTextInstruction ? forcedTextInstruction + '\n\n' : '') +
      sceneRuleLine + '\n\n' +
      '次の内容で画像を1枚生成してください。\n' +
      '説明やプロンプトの復唱はせず、必ず画像そのものを出力してください。\n' +
      'アスペクト比は3:2、実写（photorealistic）で生成してください。\n\n' +
      String(imgPrompt || '');
  }

  // v0.4.1.6: 2026-09-29に実機で確認：サムネ指示（promptRequest）に記事HTMLを丸ごと
  // 入れていたため、依頼文が17,000字を超えることがあった。タブが裏にある状態で入力欄に
  // 入れた直後、ページがCDP／表示のどちらにも数分反応しなくなり、その後も送信されて
  // いなかった（大きすぎる書き込みが、裏タブでの反映をさらに詰まらせていたと見られる）。
  // 記事HTMLをタグを除いた本文テキストに軽量化し、最大maxChars（既定
  // 既定maxChars＝2500字）程度に切り詰める：見出しは行頭に「■」、
  // 段落は改行区切り。HTMLコメント（旧CTA_DATA・EISAI_TITLES等のマーカーも含む。すべて
  // HTMLコメントの形のため一度に除去できる）は除く。字数超過時は、見出し（構成が分かる
  // ように必ず残す）→数字を含む文（点数・人数など記事の事実の中心）→残りの本文（元の順）
  // の優先順で入るところまで残す。
  // 注意：module.exportsの早期return（Nodeからの単体テスト用）より後ろにあるconstは、
  // Nodeから参照すると未初期化のまま（gradeLevelWordSource関数のコメント参照）になるため、
  // 既定値は関数の中に直接書く（THUMBNAIL_ARTICLE_SUMMARY_MAX_CHARSという名の外部constは作らない）。
  function buildThumbnailArticleSummary(blogHtml, maxChars) {
    const limit = typeof maxChars === 'number' && maxChars > 0 ? maxChars : 2500;
    const html = String(blogHtml || '').replace(/<!--[\s\S]*?-->/g, ' ');

    const lines = [];
    const blockRe = /<(h1|h2|h3|h4|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let m;
    while ((m = blockRe.exec(html))) {
      const tag = m[1].toLowerCase();
      const inner = decodeHtmlText(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
      if (!inner) continue;
      const isHeading = tag !== 'p' && tag !== 'li';
      lines.push({
        text: isHeading ? ('■ ' + inner) : inner,
        isHeading,
        hasDigit: /[0-9０-９]/.test(inner)
      });
    }
    if (!lines.length) return '';

    const kept = new Array(lines.length).fill(false);
    let used = 0;
    const tryAdd = (i) => {
      if (kept[i]) return;
      const cost = lines[i].text.length + 1; // 改行1字分
      if (used + cost > limit) return;
      kept[i] = true;
      used += cost;
    };
    // 優先順位1：見出し（記事の構成が分かるように必ず残す）
    lines.forEach((line, i) => { if (line.isHeading) tryAdd(i); });
    // 優先順位2：数字を含む文（点数・人数など、記事の事実の中心）
    lines.forEach((line, i) => { if (!line.isHeading && line.hasDigit) tryAdd(i); });
    // 優先順位3：残りの本文を、元の順で入るところまで
    lines.forEach((line, i) => { if (!line.isHeading && !line.hasDigit) tryAdd(i); });

    const out = [];
    lines.forEach((line, i) => { if (kept[i]) out.push(line.text); });
    let result = out.join('\n');
    if (result.length > limit) result = result.slice(0, limit);
    return result;
  }

  // v0.4.1.6: サムネ生成プロンプト（promptRequest）の組み立てを、imgGenBtn.onclick（DOM依存の
  // 閉包）から純粋関数として切り出した（buildBlogPromptV3と同じ考え方）。記事HTMLを丸ごと
  // 入れていたのをbuildThumbnailArticleSummaryに替えたことで依頼文が軽くなったが、実際に
  // どのくらいの字数になるかをNodeの単体テストで確認できるようにするのが目的。
  // 選択肢の一覧（colorStyles・thumbnailTypeOptions・visualExpressionOptions・
  // textImpactOptions・artDirections・layoutVariants）は、呼び出し側（imgGenBtn.onclick）が
  // 実際に使っている定数（COLOR_STYLES等）をそのまま渡す。これらの定数はNodeから直接参照
  // できない（module.exportsの早期returnより後ろにあるため）ため、関数の引数として受け取る
  // 形にして、Node側のテストでは同内容を渡せるようにした。
  function buildThumbnailPromptRequest(opts) {
    const o = opts || {};
    const thumbnailType = o.thumbnailType || 'おまかせ';
    const style = o.style || '実写';
    const textImpact = o.textImpact || '強め';
    const mainColor = o.mainColor || '';
    const subColor = o.subColor || '';
    const mainCatch = o.mainCatch || 'おまかせ';
    const subCatch = o.subCatch || 'おまかせ';
    const points = o.points || 'おまかせ';
    const sourceBlogHtml = o.sourceBlogHtml || '';
    const sourceBlogTitle = o.sourceBlogTitle || '';
    const sourceArticleFacts = o.sourceArticleFacts || '';
    const requestId = o.requestId || '';
    const colorStyles = o.colorStyles || {};
    const thumbnailTypeOptions = o.thumbnailTypeOptions || {};
    const visualExpressionOptions = o.visualExpressionOptions || {};
    const textImpactOptions = o.textImpactOptions || {};
    const artDirections = Array.isArray(o.artDirections) ? o.artDirections : [];
    const layoutVariants = Array.isArray(o.layoutVariants) ? o.layoutVariants : [];

    // v0.4.1.7: 2026-09-29に実機で計測：ChatGPTの入力欄は、貼り付けでも10,000字以上になると本文に
    // 入らず添付ファイル扱いになる（8,000字までは本文に入る）。サムネ指示は約15,000字あったため、
    // 指示の中身（創作禁止・多層の文字設計・場面と服装・紙の向き・出力形式）は落とさずに書き直し、
    // 依頼文全体を7,500字以内（実際の記事・メモで約5,000字）に収めた。記事本文の要約は最大1,800字。
    // 旧版の英語の候補一覧（artDirections・layoutVariants・thumbnailTypeOptions・
    // visualExpressionOptions）は、短い日本語の「構図のヒント」にまとめたため、引数として
    // 受け取っても使わない（呼び出し側の互換のために受け取りだけは残す）。
    void thumbnailType; void style; void thumbnailTypeOptions; void visualExpressionOptions; void artDirections; void layoutVariants;
    const sourceBlogSummary = buildThumbnailArticleSummary(sourceBlogHtml, 1800);

    const TEXT_IMPACT_JA = {
      '標準': '読みやすく落ち着いた見出し',
      '強め': '大きく太く、一瞬で読める強い見出し（おすすめ）',
      '最大インパクト': '特大の数字や一言が最初に目に飛び込む、最大の強さ'
    };
    const textImpactJa = TEXT_IMPACT_JA[textImpact] || TEXT_IMPACT_JA['強め'];
    void textImpactOptions;

    const mainColorData = colorStyles[mainColor] || {};
    const subColorData = colorStyles[subColor] || {};
    const colorJa = (!mainColor || !subColor || mainColor === 'お任せ' || subColor === 'お任せ')
      ? '記事の内容に合わせておまかせ'
      : `メイン${mainColor}（${mainColorData.hex || ''}）・サブ${subColor}（${subColorData.hex || ''}）`;

    return `
【画像生成リクエスト】
あなたはブログのサムネイルを作るアートディレクターです。下の記事のサムネイル画像を作るための「画像生成プロンプト」を書いてください（画像はまだ作りません）。

■ 記事の本文（要約。見出しは■）
${sourceBlogSummary || '(本文を取得できませんでした。タイトルと確定ファクトだけで作る)'}

■ 記事タイトル
${sourceBlogTitle || '(未取得：本文から推定してよいが、確定ファクトの範囲を超えない)'}

■ 確定ファクト（文字・数字・場面は、この中と本文にある事実だけで作る）
${sourceArticleFacts || '(未取得。本文に書かれている事実だけを使う)'}

■ 創作の禁止（最重要）
- 確定ファクトと本文に無い行動・数字・場面・セリフは作らない（例：本文に「答案を見せに来た」が無ければ描かない）。
- 数字は前回点・今回点・差など、本文とファクトにあるものだけ。事実を盛って強くしない。

■ ねらい
- ブログ一覧で一瞬見た保護者が「うちの子のことだ」「読んでみたい」と感じる、実写の広告サムネイルにする。
- 記事に結果・数字・変化があれば、必ずそれをメインの主役にする。感想だけの弱い一言（「〜かも」「〜楽しい」だけ）や、「成長の理由」「取り組み紹介」のような弱いまとめ言葉は使わない。
- 狙う反応を1つ決める（共感／驚き／続きが知りたい／安心／希望）。結果は見せ、理由は少しだけ隠す。釣りや嘘はしない。

■ 設定
- 見た目：実写（photorealistic）で固定。アニメ・イラスト・漫画・3D調は使わない。比率は3:2。
- 文字の強さ：${textImpact}（${textImpactJa}）
- 色：${colorJa}
- ユーザー指定：メイン「${mainCatch}」／サブ「${subCatch}」／ポイント「${points}」（「おまかせ」以外は、その文言をそのまま使う）

■ 文字の作り込み（本部の実例のように4〜6層重ねる。メインだけの「さみしい」サムネは不可）
実例：「応用問題で、力がつく／田島中2年・体験授業」「20名超を表彰！次は私も！」「偏差値+12.6」
- ラベル（左上の角丸バッジ・任意）2〜10字：学校名、テストの種類・時期など
- メイン（特大・必須）8〜12字：数字か変化を主役に。2色づかい、白フチ＋濃い縁取り、数字だけ特に大きく。少し傾ける・下にハイライト帯を敷くのも可
- サブ帯（色帯に白文字・最大2本）各6〜14字：学年＋教科（点数アップ系は必須）、点数推移や理由
- 補足（小さめ・任意）〜14字：具体的な取り組みや結果
- タグ（下部のチップ・1〜3個・任意）各〜12字：対象校・期間など
- 小物（任意）：成績表・グラフ・上向き矢印・表彰の掲示など。数字は記事の範囲だけ
- 文字は画面の40〜55%を占めてよい。写真の空きに小さく置かず、帯や余白を大胆に作って読ませる。スマホでも読める太さとコントラストにする。
- 優先順位はメイン→サブ帯→ラベル→タグ→補足→小物。詰め込みすぎて散らからないようにする。

${buildSceneDescriptionSection()}

■ 参照写真（このチャットに写真がアップロードされている時は、それを最優先で使う）
- 人物写真：人物だけを切り抜き、顔・髪型・雰囲気を忠実に。右1/3にバストアップ、左2/3を文字エリアにする。
- ノート・答案・教室の写真：その実物の雰囲気（書き込み・点数・明るさ）を描写に反映する。

■ 構図のヒント（毎回同じ構図にしない。内部で2〜3案を考え、一番「読みたくなる」1案だけを使う。検討は出力しない）
数字が主役のポスター／ノート・答案の手元アップ／ビフォーアフター／保護者の悩みを見出しに／生徒の変化の瞬間／先生の声かけの記録写真風／雑誌の表紙風／イベント告知風

■ 破綻を防ぐ
- 生徒が読んでいる紙を、読者側に正面向きで見せない（物理的にあり得ない）。肩越しの視点にするか、紙は手前に別に置く。
- ノート・答案の細かい文字や問題文は描かない（崩れるため）。ぼかし・見切れで雰囲気だけ見せる。点数を見せるなら大きな数字1つだけ。
- 塾名・ロゴは入れない。同じ文言を繰り返さない。

■ 最終プロンプトの書き方
- 短めの日本語の文章で、「誰にどう感じてほしいか」「何を一番大きく見せるか」「どんな写真か」「画像に描き込む文字（全部）」を書く。
- 文字は画像の中に描き込むと明記する。「文字を乗せる余白を確保」のような、描き込まない前提の書き方はしない。
- 細かい座標・比率・禁止事項の長い列挙は入れない。

■ 出力形式
[[EISAI_IMG_PROMPT]]
（画像生成プロンプト）
[[/EISAI_IMG_PROMPT]]
[[EISAI_IMG_TEXT]] ラベル：…／メイン：…／サブ1：…／サブ2：…／補足：…／タグ：…,…
（[[EISAI_IMG_TEXT]]の行は必ず1行で出す。使わない項目は「／項目：…」ごと省く。メインは必須）

【重要】プロンプトを出力するだけで、画像は生成しないでください。
${buildMarkerInstructionBlock(requestId)}`;
  }

  function stripJsonCodeFence(raw) {
    return String(raw || '')
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  function extractJsonObjectText(raw) {
    const cleaned = stripJsonCodeFence(raw);
    if (!cleaned) return '';
    if (cleaned[0] === '{' && cleaned[cleaned.length - 1] === '}') return cleaned;
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first >= 0 && last > first) return cleaned.slice(first, last + 1);
    return '';
  }

  function parseBlogJsonResponse(raw) {
    const jsonText = extractJsonObjectText(decodeHtmlText(raw || ''));
    if (!jsonText) return null;
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== 'object') return null;
      const article = parsed.article && typeof parsed.article === 'object' ? parsed.article : parsed;
      const title = String(article.title || '').trim();
      const sections = Array.isArray(article.sections) ? article.sections : [];
      if (!title || sections.length < 2) return null;
      return parsed;
    } catch (e) {
      console.warn('[Eisai] JSON応答の解析に失敗しました:', e);
      return null;
    }
  }

  function normalizeTextArray(value) {
    if (Array.isArray(value)) {
      return value.map(item => String(item || '').trim()).filter(Boolean);
    }
    if (typeof value === 'string' && value.trim()) return [value.trim()];
    return [];
  }

  function normalizeObjectArray(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(item => item && typeof item === 'object');
  }

  function splitReadableParagraph(raw) {
    const text = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!text) return [];
    const sentences = [];
    let current = '';
    let pendingPunctuation = false;
    Array.from(text).forEach(char => {
      current += char;
      if ('。！？'.indexOf(char) >= 0) {
        pendingPunctuation = true;
        return;
      }
      if (pendingPunctuation && char === '」') {
        const sentence = current.trim();
        if (sentence) sentences.push(sentence);
        current = '';
        pendingPunctuation = false;
        return;
      }
      if (pendingPunctuation) {
        const sentence = current.slice(0, -1).trim();
        if (sentence) sentences.push(sentence);
        current = char;
        pendingPunctuation = false;
      }
    });
    if (current.trim()) sentences.push(current.trim());
    if (sentences.length <= 1) return [text];

    const blocks = [];
    let block = '';
    sentences.forEach(sentence => {
      const next = block ? block + sentence : sentence;
      if (block && next.length > 84) {
        blocks.push(block);
        block = sentence;
      } else {
        block = next;
      }
    });
    if (block) blocks.push(block);
    return blocks;
  }

  function decorateInlineText(raw, options = {}) {
    let safe = escapeHtml(raw);
    const state = options.state || { number: 0, quote: 0, keyword: 0 };
    const limits = {
      number: options.numberLimit !== undefined ? options.numberLimit : 4,
      quote: options.quoteLimit !== undefined ? options.quoteLimit : 4,
      keyword: options.keywordLimit !== undefined ? options.keywordLimit : 2
    };

    function replaceFirst(regex, key, renderer) {
      let used = false;
      safe = safe.replace(regex, function (match, captured) {
        if (used || state[key] >= limits[key]) return match;
        used = true;
        state[key]++;
        return renderer(match, captured);
      });
      return used;
    }

    if (options.allowNumbers !== false && replaceFirst(
      /([0-9０-９]+(?:\.[0-9]+)?(?:点アップ|点|分|週間|週|日|周|回|名|人))/,
      'number',
      match => '<strong style="color: #dc2626; font-size: 108%; font-weight: 900;">' + match + '</strong>'
    )) return safe;

    if (options.allowQuotes !== false && replaceFirst(
      /「([^」]{2,34})」/,
      'quote',
      (_match, captured) => '<strong style="background: linear-gradient(transparent 64%, #bfdbfe 64%); color: #1e3a8a; font-weight: 800; padding: 0 2px;">「' + captured + '」</strong>'
    )) return safe;

    if (options.allowKeywords && replaceFirst(
      /(苦手|不安|自信|成長|変化|できた|わかった|習慣|笑顔|つまずき|ミス)/,
      'keyword',
      match => '<strong style="background: linear-gradient(transparent 66%, #fef08a 66%); font-weight: 800;">' + match + '</strong>'
    )) return safe;

    return safe;
  }

  function normalizeJsonCtaData(rawCta) {
    if (!rawCta || typeof rawCta !== 'object') return null;
    const consultationPoints = normalizeTextArray(rawCta.consultationPoints || rawCta.consultation_points);
    const trialPoints = normalizeTextArray(rawCta.trialPoints || rawCta.trial_points);
    const aliases = {
      '説明文1': ['説明文1', 'description1', 'description_1'],
      '説明文2': ['説明文2', 'description2', 'description_2'],
      '相談ポイント1': ['相談ポイント1', 'consultationPoint1', 'consultation_point_1'],
      '相談ポイント2': ['相談ポイント2', 'consultationPoint2', 'consultation_point_2'],
      '相談ポイント3': ['相談ポイント3', 'consultationPoint3', 'consultation_point_3'],
      '相談ポイント4': ['相談ポイント4', 'consultationPoint4', 'consultation_point_4'],
      '体験ポイント1': ['体験ポイント1', 'trialPoint1', 'trial_point_1'],
      '体験ポイント2': ['体験ポイント2', 'trialPoint2', 'trial_point_2'],
      '体験ポイント3': ['体験ポイント3', 'trialPoint3', 'trial_point_3'],
      '体験ポイント4': ['体験ポイント4', 'trialPoint4', 'trial_point_4'],
      '締めの言葉': ['締めの言葉', 'closingMessage', 'closing_message']
    };
    const data = {};
    Object.keys(aliases).forEach(key => {
      const found = aliases[key].find(alias => rawCta[alias] !== undefined && String(rawCta[alias]).trim());
      if (found) data[key] = String(rawCta[found]).trim();
    });
    consultationPoints.slice(0, 4).forEach((point, index) => {
      data['相談ポイント' + (index + 1)] = point;
    });
    trialPoints.slice(0, 4).forEach((point, index) => {
      data['体験ポイント' + (index + 1)] = point;
    });
    return Object.keys(data).length >= 3 ? data : null;
  }

  function renderBlogJsonHtml(data) {
    const article = data && data.article && typeof data.article === 'object' ? data.article : data;
    const html = [];
    const title = String(article.title || '').trim();
    if (!title) return '';
    const decorationState = { number: 0, quote: 0, keyword: 0 };

    function renderParagraph(paragraph) {
      splitReadableParagraph(paragraph).forEach(block => {
        html.push('<p style="margin: 0 0 18px; font-size: 16px; letter-spacing: 0; line-height: 2.12;">' + decorateInlineText(block, { state: decorationState }) + '</p>');
      });
    }

    function renderHighlight(text, index = 0) {
      const styles = [
        'color: #b91c1c; background: #fff7ed; border-left: 4px solid #f97316;',
        'color: #1e3a8a; background: #eff6ff; border-left: 4px solid #1d8acb;',
        'color: #166534; background: #f0fdf4; border-left: 4px solid #22c55e;'
      ];
      html.push('<p style="margin: 20px 0 24px; padding: 12px 14px; border-radius: 8px; font-size: 16px; line-height: 1.95; ' + styles[index % styles.length] + '"><strong style="font-weight: 900;">' + escapeHtml(text) + '</strong></p>');
    }

    function renderCheckList(titleText, items) {
      if (items.length < 3) return;
      html.push('<div style="border: 2px solid #1d8acb; border-radius: 10px; margin: 26px 0; overflow: hidden; background: #ffffff; box-shadow: 0 4px 14px rgba(29, 138, 203, 0.10);">');
      html.push('<div style="background: #1d8acb; color: #ffffff; padding: 10px 16px; font-size: 16px; font-weight: 900;">' + escapeHtml(titleText) + '</div>');
      html.push('<ul style="list-style: none; margin: 0; padding: 16px 22px; line-height: 2.0;">');
      items.forEach(item => {
        html.push('<li style="margin: 0 0 9px; padding-left: 1.5em; text-indent: -1.5em; font-size: 15.5px;">✓ ' + decorateInlineText(item, { state: decorationState, allowKeywords: false }) + '</li>');
      });
      html.push('</ul></div>');
    }

    function renderManagerNote(note) {
      if (!note) return;
      html.push('<div style="background: #f0f9ff; border: 1px solid #bae6fd; border-left: 5px solid #0ea5e9; border-radius: 12px; padding: 17px 20px; margin: 24px 0; box-shadow: 0 4px 14px rgba(14, 165, 233, 0.10);">');
      html.push('<div style="color: #0369a1; font-weight: 900; margin: 0 0 8px; font-size: 16px;">室長より</div>');
      splitReadableParagraph(note).forEach(block => {
        html.push('<p style="margin: 0 0 10px; font-size: 16.5px; line-height: 2.05;">' + decorateInlineText(block, { state: decorationState }) + '</p>');
      });
      html.push('</div>');
    }

    function normalizeDialogueArray(value) {
      if (!Array.isArray(value)) return [];
      return value
        .map(item => {
          if (!item || typeof item !== 'object') return null;
          const speaker = String(item.speaker || item.role || '').trim();
          const text = String(item.text || item.message || item.body || '').trim();
          if (!speaker || !text) return null;
          return { speaker, text };
        })
        .filter(Boolean)
        .slice(0, 4);
    }

    function renderDialogues(dialogues) {
      if (dialogues.length < 2) return;
      dialogues.forEach(dialogue => {
        const managerName = String(getSetting().manager || '').trim();
        const isClassroomSide = /室長|先生|講師/.test(dialogue.speaker) || (managerName && dialogue.speaker.indexOf(managerName) >= 0);
        const isReaderSide = !isClassroomSide && /保護者|お母|母|お父|父|親|生徒|さん|くん|ちゃん/.test(dialogue.speaker);
        const className = isReaderSide ? 'bubble-right' : 'bubble-left';
        const label = escapeHtml(dialogue.speaker);
        const body = escapeHtml(dialogue.text).replace(/\n/g, '<br>');
        html.push('<div class="' + className + '"><strong>' + label + '：</strong>' + body + '</div>');
      });
    }

    function renderPhotoSuggestion(suggestion) {
      if (!suggestion || typeof suggestion !== 'object') return;
      const label = String(suggestion.label || suggestion.title || '写真挿入').trim();
      const displayLabel = label && label !== '写真挿入' ? '写真挿入（' + label + '）' : '写真挿入';
      html.push(
        '<p data-photo-placeholder="true" style="border: 2px dashed #94a3b8; background: #f8fafc; color: #334155; border-radius: 10px; padding: 18px 20px; margin: 32px 0; font-size: 15px; line-height: 1.85; text-align: center;">' +
        '<strong style="display: block; font-size: 15px; color: #0f172a; font-weight: 900;">■■■■■■■■ ' + escapeHtml(displayLabel) + ' ■■■■■■■■</strong>' +
        '</p>'
      );
    }

    function buildPhotoSuggestions(rawSuggestions, sectionCount) {
      const suggestions = rawSuggestions
        .slice(0, 3)
        .map(suggestion => ({
          afterSection: Math.max(1, Number(suggestion.afterSection || suggestion.after_section || 1)),
          label: String(suggestion.label || suggestion.title || '写真挿入').trim(),
          description: String(suggestion.description || suggestion.detail || suggestion.text || '').trim()
        }))
        .filter(suggestion => suggestion.label || suggestion.description);
      const fallback = [
        { afterSection: 1, label: 'ノートの写真' },
        { afterSection: 2, label: '自習風景' },
        { afterSection: 3, label: '答案の写真' },
        { afterSection: Math.max(1, sectionCount), label: '教室の写真' }
      ];
      fallback.forEach(item => {
        if (suggestions.length >= 2) return;
        if (!suggestions.some(suggestion => suggestion.afterSection === item.afterSection)) suggestions.push(item);
      });
      return suggestions.slice(0, 3).sort((a, b) => a.afterSection - b.afterSection);
    }

    html.push('<div data-eisai-article="true" style="font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; color: #1f2937; line-height: 1.95;">');
    html.push('<h1 style="font-size: 30px; line-height: 1.45; margin: 0 0 28px; padding: 20px 24px; border-left: 6px solid #1d8acb; background: #eef8ff; color: #0f172a; font-weight: 900;">' + escapeHtml(title) + '</h1>');

    normalizeTextArray(article.greeting || article.openingGreeting).forEach(renderParagraph);

    const leadParagraphs = normalizeTextArray(article.lead || article.introduction);
    if (leadParagraphs.length) {
      html.push('<div style="background: #f8fafc; border: 1px solid #e5edf5; border-radius: 12px; padding: 20px 22px; margin: 0 0 30px;">');
      leadParagraphs.forEach(paragraph => {
        splitReadableParagraph(paragraph).forEach(block => {
          html.push('<p style="margin: 0 0 16px; line-height: 2.12; font-size: 16px; color: #334155;">' + decorateInlineText(block, { state: decorationState }) + '</p>');
        });
      });
      html.push('</div>');
    }

    const empathyBox = article.empathyBox || article.empathy_box;
    if (empathyBox && typeof empathyBox === 'object') {
      const label = String(empathyBox.label || empathyBox.title || '保護者の方へ').trim();
      const paragraphs = normalizeTextArray(empathyBox.paragraphs || empathyBox.body || empathyBox.content);
      if (paragraphs.length) {
        html.push('<div style="background: #fff7ed; border-left: 6px solid #f97316; border-radius: 0 10px 10px 0; padding: 18px 20px; margin: 0 0 30px;">');
        html.push('<div style="color: #c2410c; font-weight: 900; margin: 0 0 9px; font-size: 17px;">' + escapeHtml(label) + '</div>');
        paragraphs.forEach(paragraph => {
          splitReadableParagraph(paragraph).forEach(block => {
            html.push('<p style="margin: 0 0 12px; font-size: 16.5px; line-height: 2.1;">' + decorateInlineText(block, { state: decorationState }) + '</p>');
          });
        });
        html.push('</div>');
      }
    }

    const sections = Array.isArray(article.sections) ? article.sections : [];
    const photoSuggestions = buildPhotoSuggestions(normalizeObjectArray(article.photoSuggestions || article.photo_suggestions), sections.length);
    sections.forEach((section, index) => {
      if (!section || typeof section !== 'object') return;
      const sectionIndex = index + 1;
      const heading = String(section.heading || section.title || '').trim();
      if (heading) html.push('<h2 style="font-size: 23px; line-height: 1.5; margin: 40px 0 20px; padding: 17px 20px; border-left: 6px solid #1d8acb; background: #eef8ff; color: #0f172a; font-weight: 900;">' + escapeHtml(heading) + '</h2>');
      normalizeTextArray(section.paragraphs || section.body || section.content).forEach(renderParagraph);
      normalizeTextArray(section.highlights || section.highlight || section.emphasis).slice(0, 1).forEach((text, highlightIndex) => renderHighlight(text, highlightIndex));
      renderDialogues(normalizeDialogueArray(section.dialogues || section.dialogue || section.conversation));
      renderCheckList(String(section.bulletTitle || section.bullet_title || 'ここがポイント').trim(), normalizeTextArray(section.bullets || section.points));
      renderManagerNote(String(section.managerNote || section.manager_note || '').trim());
      photoSuggestions
        .filter(suggestion => Number(suggestion.afterSection || suggestion.after_section || 0) === sectionIndex)
        .forEach(renderPhotoSuggestion);
    });

    normalizeTextArray(article.closing || article.conclusion).forEach(renderParagraph);
    photoSuggestions
      .filter(suggestion => Number(suggestion.afterSection || suggestion.after_section || 0) > sections.length)
      .forEach(renderPhotoSuggestion);
    html.push('</div>');
    return html.join('\n').trim();
  }

  function parseCtaData(text) {
    let match = text.match(/<!--CTA_DATA_START-->([\s\S]*?)<!--CTA_DATA_END-->/);
    let dataText = match ? match[1] : null;

    if (!dataText) {
      const patterns = [
        /説明文1[:：]\s*(.+)/,
        /説明文2[:：]\s*(.+)/,
        /相談ポイント1[:：]\s*(.+)/,
        /体験ポイント1[:：]\s*(.+)/,
        /締めの言葉[:：]\s*(.+)/
      ];
      let matchCount = 0;
      patterns.forEach(p => { if (p.test(text)) matchCount++; });
      if (matchCount >= 3) {
        const startMatch = text.match(/説明文1[:：]/);
        const endMatch = text.match(/締めの言葉[:：]\s*.+/);
        if (startMatch && endMatch) {
          const startIdx = startMatch.index;
          const endIdx = endMatch.index + endMatch[0].length;
          dataText = text.substring(startIdx, endIdx);
        }
      }
    }

    if (!dataText) return null;
    const data = {};
    // v0.4.1: 実機で、CTA_DATAの各行が改行なしで1行につながって読まれることがあったため、
    // 決まった項目名（説明文1・相談ポイント1…）の前で必ず改行してから1行ずつ読む。
    dataText = dataText.replace(/(中間CTA文言|本CTAボタン|本CTA説明文|電話文言|説明文[12]|相談ポイント[1-4]|体験ポイント[1-4]|締めの言葉)\s*[:：]/g, '\n$1：');
    const lines = dataText.trim().split('\n');
    lines.forEach(line => {
      const idx = line.search(/[:：]/);
      if (idx > 0) {
        const key = line.substring(0, idx).trim();
        const value = line.substring(idx + 1).trim();
        if (key && value) data[key] = value;
      }
    });
    return Object.keys(data).length >= 3 ? data : null;
  }

  const defaultCtaData = {
    '説明文1': 'テストや勉強のお悩みを一緒に整理します。',
    '説明文2': 'お子さまに合った一歩目を一緒に見つけていきましょう。',
    '相談ポイント1': '今のつまずきの原因を一緒に見つけます',
    '相談ポイント2': 'テストで点が伸びない理由をプロが分析',
    '相談ポイント3': '家庭学習の「やり方」から見直せます',
    '相談ポイント4': '志望校選びや進路の不安も相談OK',
    '体験ポイント1': '実際の授業を体験して雰囲気がわかる',
    '体験ポイント2': '先生との相性をじっくり確認できます',
    '体験ポイント3': '苦手が「わかった！」に変わる瞬間を体感',
    '体験ポイント4': '教室や自習室の環境もしっかり見学',
    '締めの言葉': 'お子さまの「これから」のために、まずは私たちにお話を聞かせてください。一緒に最善の一歩を見つけましょう。'
  };

  function buildCtaHtml(url, tel, ctaData = null) {
    const d = ctaData || defaultCtaData;
    const safeUrl = escapeAttr(String(url || '').replace(/"/g, ''));
    const safeTel = sanitizeTel(tel);
    const text = (key) => escapeHtml(d[key] || defaultCtaData[key] || '');
    return (
      '<div data-cta-protected="true" style="background: #f8f8f8; padding: 40px 20px; margin: 40px 0;">' +
      '<div style="text-align: center; font-size: 26px; font-weight: bold; color: #333; margin: 0 0 12px 0;">まずはお気軽にご相談ください</div>' +
      '<div style="text-align: center; color: #888; margin: 0 0 16px 0; font-size: 13px;">入会する・しないにかかわらず、お子さまの学習についてお力になります。</div>' +
      '<div style="text-align: center; color: #555; margin: 0 0 10px 0; font-size: 15px;">' + text('説明文1') + '</div>' +
      '<div style="text-align: center; color: #555; margin: 0 0 30px 0; font-size: 15px;">' + text('説明文2') + '</div>' +
      '<div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; margin-bottom: 30px; max-width: 800px; margin-left: auto; margin-right: auto;">' +
      '<div style="flex: 1; min-width: 300px; max-width: 380px; background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 24px 28px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">' +
      '<div style="color: #e67e22; font-size: 18px; font-weight: bold; margin: 0 0 16px 0;">📒 無料学習相談でできること</div>' +
      '<div style="color: #444; line-height: 2.0; font-size: 15px; padding-left: 8px;">' +
      '<div style="margin-bottom: 4px;">・' + text('相談ポイント1') + '</div>' +
      '<div style="margin-bottom: 4px;">・' + text('相談ポイント2') + '</div>' +
      '<div style="margin-bottom: 4px;">・' + text('相談ポイント3') + '</div>' +
      '<div style="margin-bottom: 4px;">・' + text('相談ポイント4') + '</div>' +
      '</div>' +
      '</div>' +
      '<div style="flex: 1; min-width: 300px; max-width: 380px; background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 24px 28px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">' +
      '<div style="color: #e67e22; font-size: 18px; font-weight: bold; margin: 0 0 16px 0;">✏️ 無料体験授業でできること</div>' +
      '<div style="color: #444; line-height: 2.0; font-size: 15px; padding-left: 8px;">' +
      '<div style="margin-bottom: 4px;">・' + text('体験ポイント1') + '</div>' +
      '<div style="margin-bottom: 4px;">・' + text('体験ポイント2') + '</div>' +
      '<div style="margin-bottom: 4px;">・' + text('体験ポイント3') + '</div>' +
      '<div style="margin-bottom: 4px;">・' + text('体験ポイント4') + '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div style="text-align: center; color: #555; margin: 0 0 28px 0; font-size: 15px;">' + text('締めの言葉') + '</div>' +
      '<div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">' +
      '<a href="' + safeUrl + '" style="display: inline-block; background: #e67e22; color: #fff; padding: 16px 32px; border-radius: 50px; font-size: 15px; font-weight: bold; text-decoration: none; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">無料学習相談・体験授業に申し込む</a>' +
      // v0.4.1: 電話番号が未設定の時は、電話ボタンを出さない（tel: だけの壊れたリンクを作らない）
      (safeTel ? '<a href="tel:' + safeTel + '" style="display: inline-block; background: #fff; color: #e67e22; padding: 16px 32px; border-radius: 50px; font-size: 15px; font-weight: bold; text-decoration: none; border: 2px solid #e67e22;">電話で直接申し込む</a>' : '') +
      '</div>' +
      '</div>'
    );
  }

  // v0.4.0（design.md 4.生成後の処理）：新語彙 eisai-cta 用。
  // buildCtaHtmlは使わず、AIが書いたcta-btn/cta-subのhrefを教室設定の値で差し替える
  // （AIが書いたURL・電話・LINEは信用しない）。設定に無い電話/LINEのcta-subは外し、
  // 本CTA（final）で設定にあるのに無ければ足す。
  // v0.4.1: AIが本文に書いた最後のCTA（<div class="eisai-cta" data-kind="final">…</div>）を取り除く
  // （記事の一番最後には、拡張機能が保護CTA＝「まずはお気軽にご相談ください」の申込枠を付けるため）。
  // 入れ子のdivがあっても対応するよう、開始タグから対応する閉じタグまでを数えて取り除く。
  function removeFinalEisaiCta(html) {
    let out = String(html || '');
    const openRe = /<div\b[^>]*\bclass=["']eisai-cta["'][^>]*\bdata-kind=["']final["'][^>]*>|<div\b[^>]*\bdata-kind=["']final["'][^>]*\bclass=["']eisai-cta["'][^>]*>/i;
    for (let guard = 0; guard < 5; guard++) {
      const m = openRe.exec(out);
      if (!m) break;
      const start = m.index;
      const tagRe = /<\/?div\b[^>]*>/gi;
      tagRe.lastIndex = start + m[0].length;
      let depth = 1;
      let end = -1;
      let t;
      while ((t = tagRe.exec(out))) {
        depth += t[0][1] === '/' ? -1 : 1;
        if (depth === 0) { end = t.index + t[0].length; break; }
      }
      if (end < 0) break;
      out = out.slice(0, start) + out.slice(end);
    }
    return out;
  }

  function applyClassroomCtaLinks(html, ctaUrl, tel, line) {
    const safeUrl = escapeAttr(String(ctaUrl || '').replace(/"/g, ''));
    const safeTel = sanitizeTel(tel);
    const lineRaw = String(line || '').trim();
    const safeLine = lineRaw ? escapeAttr(lineRaw.replace(/"/g, '')) : '';
    const hasTel = !!safeTel;
    const hasLine = !!safeLine;

    return String(html || '').replace(
      /(<div\b[^>]*\bclass=["']eisai-cta["'][^>]*\bdata-kind=["'](mid|final)["'][^>]*>)([\s\S]*?)(<\/div>)/gi,
      (fullMatch, openTag, kind, inner, closeTag) => {
        // cta-btn: href を申込URLに差し替え
        let updatedInner = inner.replace(/<a\b[^>]*\bclass=["']cta-btn["'][^>]*>/i, (tag) => {
          return /href=["'][^"']*["']/i.test(tag)
            ? tag.replace(/href=["'][^"']*["']/i, `href="${safeUrl}"`)
            : tag.replace(/<a\b/i, `<a href="${safeUrl}"`);
        });

        // cta-sub: tel:/LINEをそれぞれ設定値に差し替え、未設定なら外す
        updatedInner = updatedInner.replace(/<a\b[^>]*\bclass=["']cta-sub["'][^>]*>[\s\S]*?<\/a>/gi, (anchor) => {
          const isTelAnchor = /href=["']tel:/i.test(anchor);
          if (isTelAnchor) {
            return hasTel ? anchor.replace(/href=["'][^"']*["']/i, `href="tel:${safeTel}"`) : '';
          }
          return hasLine ? anchor.replace(/href=["'][^"']*["']/i, `href="${safeLine}"`) : '';
        });

        // 本CTA（final）は、設定にあるのにcta-subが無くなっていたら足す
        if (kind === 'final') {
          if (hasTel && !updatedInner.includes(`href="tel:${safeTel}"`)) {
            updatedInner += `<a class="cta-sub" href="tel:${safeTel}">電話で相談する</a>`;
          }
          if (hasLine && !updatedInner.includes(`href="${safeLine}"`)) {
            updatedInner += `<a class="cta-sub" href="${safeLine}">LINEで相談する</a>`;
          }
        }

        return openTag + updatedInner + closeTag;
      }
    );
  }

  // v0.4.0（design.md 5.結果パネル）：本文字数（タグ・コメント・空白除く）を数える
  function countArticleChars(html) {
    return String(html || '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, '')
      .length;
  }

  // v0.4.0（design.md 5.結果パネル）：感嘆符（！/!）・絵文字の数を数える
  function countExclamationsAndEmoji(text) {
    const source = String(text || '');
    const exclamationCount = (source.match(/[!！]/g) || []).length;
    const emojiCount = (source.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length;
    return { exclamationCount, emojiCount };
  }

  // v0.4.0（design.md 5.結果パネル）：本文字数・h2数・CTA数と中間CTA位置％・写真枠数・感嘆符/絵文字数を実測する
  function computeArticleMetrics(html) {
    const source = String(html || '');
    const chars = countArticleChars(source);
    const h2Count = (source.match(/<h2[\s>]/gi) || []).length;
    const photoCount = (source.match(/data-photo-placeholder=["']true["']/gi) || []).length;
    const { exclamationCount, emojiCount } = countExclamationsAndEmoji(source);

    const ctaMatches = [];
    const ctaRe = /<div\b[^>]*\bclass=["']eisai-cta["'][^>]*\bdata-kind=["'](mid|final)["'][^>]*>/gi;
    let m;
    while ((m = ctaRe.exec(source))) {
      ctaMatches.push({ kind: m[1], index: m.index });
    }

    let midCtaPositionPercent = null;
    const firstMid = ctaMatches.find(c => c.kind === 'mid');
    if (firstMid && chars > 0) {
      const charsBeforeMid = countArticleChars(source.slice(0, firstMid.index));
      midCtaPositionPercent = Math.round((charsBeforeMid / chars) * 100);
    }

    return {
      chars,
      h2Count,
      ctaCount: ctaMatches.length,
      midCtaPositionPercent,
      photoCount,
      exclamationCount,
      emojiCount
    };
  }

  // =========================================================
  // 5. CSS
  // =========================================================
  const CSS = `
#${TOOL_ID} {
  --eisai-navy: #12294D;
  --eisai-navy-soft: #33507a;
  --eisai-orange: #F5811F;
  --eisai-orange-dark: #d96e0f;
  --eisai-bg: #ffffff;
  --eisai-bg-soft: #F6F7F9;
  --eisai-border: #e3e6eb;
  --eisai-text: #1f2937;
  --eisai-text-soft: #5b6472;
  --eisai-green: #1f9254;
  --eisai-green-bg: #e7f6ee;
  --eisai-red: #c23b3b;
  --eisai-red-bg: #fdecec;
  --eisai-r-sm: 8px;
  --eisai-r: 10px;
  font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", system-ui, sans-serif;
  color: var(--eisai-text);
  box-shadow: -4px 0 20px rgba(18, 41, 77, 0.18); border-radius: 0;
  overflow: hidden; border-left: 1px solid var(--eisai-border); background: var(--eisai-bg);
  position: fixed; top: 0; right: 0; width: 420px; height: 100vh;
  z-index: 2147483647; display: flex; flex-direction: column;
  pointer-events: auto;
  transition: transform 0.3s ease;
  font-size: 13px;
  line-height: 1.5;
}
#${TOOL_ID}.collapsed {
  transform: translateX(100%);
}
#${TOOL_ID} * {
  pointer-events: auto;
}
html.${PANEL_OPEN_LAYOUT_CLASS} main,
html.${PANEL_OPEN_LAYOUT_CLASS} [role="main"] {
  width: calc(100vw - var(--eisai-chatgpt-reserved-width, ${PANEL_WIDTH + PANEL_TAB_WIDTH_FALLBACK}px)) !important;
  margin-right: var(--eisai-chatgpt-reserved-width, ${PANEL_WIDTH + PANEL_TAB_WIDTH_FALLBACK}px) !important;
  max-width: calc(100vw - var(--eisai-chatgpt-reserved-width, ${PANEL_WIDTH + PANEL_TAB_WIDTH_FALLBACK}px)) !important;
  box-sizing: border-box !important;
  transition: width 0.3s ease, margin-right 0.3s ease, max-width 0.3s ease;
}
html.${PANEL_OPEN_LAYOUT_CLASS} main > div,
html.${PANEL_OPEN_LAYOUT_CLASS} [role="main"] > div {
  max-width: 100% !important;
  box-sizing: border-box !important;
}
html.${PANEL_OPEN_LAYOUT_CLASS} #thread-bottom-container {
  left: 0 !important;
  right: var(--eisai-chatgpt-reserved-width, ${PANEL_WIDTH + PANEL_TAB_WIDTH_FALLBACK}px) !important;
  width: auto !important;
  max-width: calc(100vw - var(--eisai-chatgpt-reserved-width, ${PANEL_WIDTH + PANEL_TAB_WIDTH_FALLBACK}px)) !important;
  box-sizing: border-box !important;
  transition: right 0.3s ease, width 0.3s ease, max-width 0.3s ease;
}
html.${PANEL_OPEN_LAYOUT_CLASS} #thread-bottom-container > * {
  max-width: min(calc(100vw - var(--eisai-chatgpt-reserved-width, ${PANEL_WIDTH + PANEL_TAB_WIDTH_FALLBACK}px) - 32px), 48rem) !important;
  margin-left: auto !important;
  margin-right: auto !important;
  box-sizing: border-box !important;
}
html.${PANEL_OPEN_LAYOUT_CLASS} form[data-type="unified-composer"],
html.${PANEL_OPEN_LAYOUT_CLASS} [data-testid="composer"],
html.${PANEL_OPEN_LAYOUT_CLASS} [data-testid="composer-bar"] {
  max-width: min(calc(100vw - var(--eisai-chatgpt-reserved-width, ${PANEL_WIDTH + PANEL_TAB_WIDTH_FALLBACK}px) - 32px), 48rem) !important;
  margin-left: auto !important;
  margin-right: auto !important;
  box-sizing: border-box !important;
}
#eisai-toggle-btn {
  position: fixed; top: 50%; right: ${PANEL_WIDTH}px; transform: translateY(-50%);
  z-index: 2147483646; background: #12294D; color: #fff;
  border: none; border-radius: 8px 0 0 8px; padding: 12px 8px;
  cursor: pointer; font-size: 14px; writing-mode: vertical-rl;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.2);
  transition: right 0.3s ease;
  font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", system-ui, sans-serif;
}
#eisai-toggle-btn.collapsed {
  right: 0;
}
#eisai-toggle-btn:hover {
  background: #1b3966;
}
@media (max-width: 900px) {
  html.${PANEL_OPEN_LAYOUT_CLASS} main,
  html.${PANEL_OPEN_LAYOUT_CLASS} [role="main"],
  html.${PANEL_OPEN_LAYOUT_CLASS} #thread-bottom-container {
    width: 100vw !important;
    margin-right: 0 !important;
    max-width: 100vw !important;
    right: 0 !important;
  }
}
#${TOOL_ID} .eisai-header {
  background: var(--eisai-navy); color: #fff; padding: 10px 14px; display: flex;
  justify-content: space-between; align-items: center; font-size: 13px;
  border-bottom: 1px solid var(--eisai-navy); user-select: none;
  flex-wrap: wrap; gap: 6px;
}
#${TOOL_ID} .eisai-header-title {
  font-size: 15px; font-weight: 700; letter-spacing: 0.01em;
}
#${TOOL_ID} .eisai-label { font-size: 11px; display: block; margin-bottom: 4px; font-weight: 700; color: var(--eisai-text-soft); }
#${TOOL_ID} .eisai-label-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
#${TOOL_ID} .eisai-input {
  width: 100%; padding: 8px 10px; border: 1px solid #d7dbe3; border-radius: var(--eisai-r-sm);
  box-sizing: border-box; font-size: 13px; color: var(--eisai-text); background: #fff;
  font-family: inherit;
}
#${TOOL_ID} .eisai-input:focus { outline: none; border-color: var(--eisai-orange); box-shadow: 0 0 0 2px rgba(245,129,31,0.18); }
#${TOOL_ID} .eisai-input-wrap { margin-bottom: 12px; }
#${TOOL_ID} .eisai-type-wrap { margin: 8px 0 4px; }
#${TOOL_ID} .eisai-type-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
#${TOOL_ID} .eisai-type-btn {
  flex: 1 1 calc(50% - 6px);
  min-width: 120px;
  padding: 7px 8px;
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.4;
  border-radius: var(--eisai-r-sm);
  border: 1px solid #d7dbe3;
  background: #fff;
  color: var(--eisai-text);
  cursor: pointer;
  text-align: center;
  white-space: normal;
  word-break: keep-all;
  overflow-wrap: anywhere;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
#${TOOL_ID} .eisai-type-btn:hover {
  background: var(--eisai-bg-soft);
  border-color: var(--eisai-navy-soft);
}
#${TOOL_ID} .eisai-type-btn-active {
  background: var(--eisai-navy);
  color: #ffffff;
  border-color: var(--eisai-navy);
}
#${TOOL_ID} .eisai-type-btn-active:hover {
  background: #0d1f3b;
  border-color: #0d1f3b;
}

/* セグメント型トグル（入力モード：かんたん｜しっかり） */
#${TOOL_ID} .eisai-segmented {
  display: flex; background: var(--eisai-bg-soft); border: 1px solid var(--eisai-border);
  border-radius: 999px; padding: 3px; gap: 3px;
}
#${TOOL_ID} .eisai-segmented button {
  flex: 1; border: none; background: transparent; border-radius: 999px;
  padding: 8px 6px; font-size: 12px; font-weight: 700; color: var(--eisai-text-soft);
  cursor: pointer; white-space: nowrap; font-family: inherit;
  transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}
#${TOOL_ID} .eisai-segmented button.eisai-segmented-active {
  background: #ffffff; color: var(--eisai-navy);
  box-shadow: 0 1px 3px rgba(18,41,77,0.18);
}
#${TOOL_ID} .eisai-segment-desc {
  font-size: 11.5px; color: var(--eisai-text-soft); margin-top: 6px; line-height: 1.6;
}

/* 主/副ボタン */
#${TOOL_ID} .eisai-primary-btn {
  width: 100%; padding: 12px; background: var(--eisai-orange); color: #fff;
  border: none; border-radius: var(--eisai-r); font-weight: 700; cursor: pointer;
  margin-top: 10px; font-size: 15px; font-family: inherit;
  box-shadow: 0 2px 6px rgba(245,129,31,0.35);
  transition: background 0.15s ease, transform 0.1s ease;
}
#${TOOL_ID} .eisai-primary-btn:hover { background: var(--eisai-orange-dark); }
#${TOOL_ID} .eisai-primary-btn:active { transform: scale(0.99); }
#${TOOL_ID} .eisai-primary-btn:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }
#${TOOL_ID} .eisai-secondary-btn {
  width: 100%; padding: 10px; background: #ffffff; color: var(--eisai-navy);
  border: 1px solid #cbd2de; border-radius: var(--eisai-r); font-weight: 700; cursor: pointer;
  font-size: 13px; font-family: inherit;
  transition: background 0.15s ease;
}
#${TOOL_ID} .eisai-secondary-btn:hover { background: var(--eisai-bg-soft); }

/* 必須ピル */
#${TOOL_ID} .eisai-required-pill {
  display: inline-block; font-size: 10px; font-weight: 700; color: #9a3412;
  background: #ffedd5; border: 1px solid #fdba74; border-radius: 999px;
  padding: 1px 7px; line-height: 1.5; vertical-align: middle;
}

/* カード */
#${TOOL_ID} .eisai-card {
  background: #ffffff; border: 1px solid var(--eisai-border); border-radius: var(--eisai-r);
  padding: 12px; margin-bottom: 12px;
}
#${TOOL_ID} .eisai-card-soft {
  background: var(--eisai-bg-soft);
}
#${TOOL_ID} .eisai-card-title {
  font-size: 14px; font-weight: 700; color: var(--eisai-navy); margin-bottom: 8px;
  display: flex; align-items: center; gap: 6px; justify-content: space-between;
}

/* ステップ表示 */
#${TOOL_ID} .eisai-steps {
  display: flex; align-items: center; padding: 10px 12px 8px; background: #fff;
  border-bottom: 1px solid var(--eisai-border); overflow-x: auto;
}
#${TOOL_ID} .eisai-step {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  min-width: 46px; flex: 1;
}
#${TOOL_ID} .eisai-step-dot {
  width: 20px; height: 20px; border-radius: 999px; background: #e5e7eb; color: #9aa2af;
  font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center;
}
#${TOOL_ID} .eisai-step.is-done .eisai-step-dot { background: var(--eisai-green); color: #fff; }
#${TOOL_ID} .eisai-step.is-active .eisai-step-dot { background: var(--eisai-orange); color: #fff; }
#${TOOL_ID} .eisai-step-label {
  font-size: 10px; color: #9aa2af; font-weight: 600; white-space: nowrap;
}
#${TOOL_ID} .eisai-step.is-active .eisai-step-label { color: var(--eisai-navy); font-weight: 700; }
#${TOOL_ID} .eisai-step.is-done .eisai-step-label { color: var(--eisai-green); }
#${TOOL_ID} .eisai-step-line {
  flex: 0 0 auto; width: 14px; height: 1px; background: #d7dbe3; margin: 0 1px; margin-bottom: 15px;
}

/* 状態表示 */
#${TOOL_ID} .eisai-status {
  padding: 9px 10px; margin-top: 0; font-size: 12px; border-radius: var(--eisai-r-sm);
  display: none; line-height: 1.6;
}
#${TOOL_ID} .eisai-status.show { display: block; background: #eef2f9; color: var(--eisai-navy); }
#${TOOL_ID} .eisai-status.eisai-status-error { background: var(--eisai-red-bg); color: var(--eisai-red); }
#${TOOL_ID} .eisai-status.eisai-status-success { background: var(--eisai-green-bg); color: var(--eisai-green); }

/* 下部固定アクションバー */
#${TOOL_ID} .eisai-action-bar {
  position: sticky; bottom: 0; background: #ffffff; border-top: 1px solid var(--eisai-border);
  padding: 10px 14px 12px; box-shadow: 0 -2px 8px rgba(18,41,77,0.08);
  display: flex; flex-direction: column; gap: 6px;
}
#${TOOL_ID} .eisai-missing-hint {
  display: none; font-size: 11.5px; color: #9a3412; background: #fff3e0;
  border: 1px solid #fdba74; border-radius: var(--eisai-r-sm); padding: 6px 8px;
  cursor: pointer; font-weight: 600; line-height: 1.5;
}
#${TOOL_ID} .eisai-missing-hint.show { display: block; }
#${TOOL_ID} .eisai-action-bar-row { display: flex; gap: 8px; }
#${TOOL_ID} .eisai-action-bar-row .eisai-secondary-btn { flex: 0 0 auto; width: auto; padding: 10px 12px; font-size: 12px; }
#${TOOL_ID} .eisai-action-bar-row .eisai-primary-btn { flex: 1; margin-top: 0; }

details.eisai-details { margin-bottom: 12px; border: 1px solid var(--eisai-border); border-radius: var(--eisai-r); overflow: hidden; }
details.eisai-details summary { padding: 10px 12px; background: var(--eisai-bg-soft); cursor: pointer; font-size: 13px; font-weight: 700; list-style: none; color: var(--eisai-navy); }
details.eisai-details summary::-webkit-details-marker { display: none; }
.eisai-details-content { padding: 10px 12px; }
#${TOOL_ID} .eisai-classroom-summary {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 10px 12px; font-size: 12.5px; color: var(--eisai-navy); font-weight: 600;
  background: var(--eisai-green-bg); border: 1px solid #bfe6cf; border-radius: var(--eisai-r);
}
#${TOOL_ID} .eisai-classroom-summary-edit {
  flex: 0 0 auto; border: 1px solid #bfe6cf; background: #fff; color: var(--eisai-navy);
  border-radius: 999px; padding: 4px 12px; font-size: 11px; font-weight: 700; cursor: pointer;
  font-family: inherit;
}

/* 生成後カードの案チップ */
#${TOOL_ID} .eisai-title-pick {
  width: 100%; text-align: left; padding: 9px 10px; border: 2px solid #d7dbe3; border-radius: var(--eisai-r-sm);
  background: #ffffff; font-size: 12.5px; line-height: 1.5; cursor: pointer; color: var(--eisai-text);
  font-family: inherit;
}
#${TOOL_ID} .eisai-title-pick.is-selected { border-color: var(--eisai-orange); background: #fff6ed; }
#${TOOL_ID} .eisai-check-chip {
  display: inline-block; margin: 0 5px 5px 0; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700;
}

/* サムネイル：番号ステップ */
#${TOOL_ID} .eisai-thumb-step { border: 1px solid var(--eisai-border); border-radius: var(--eisai-r); padding: 10px; margin-bottom: 10px; }
#${TOOL_ID} .eisai-thumb-step-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
#${TOOL_ID} .eisai-thumb-step-num {
  width: 20px; height: 20px; border-radius: 999px; background: var(--eisai-navy); color: #fff;
  font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex: 0 0 auto;
}
#${TOOL_ID} .eisai-thumb-step-title { font-size: 13px; font-weight: 700; color: var(--eisai-navy); }

#${TOOL_ID} .eisai-btn-pulse {
  animation: eisai-pulse 0.9s ease-in-out 0s 4;
}

@keyframes eisai-pulse {
  0% { transform: scale(1); box-shadow: 0 0 0 rgba(245, 129, 31, 0.0); }
  50% { transform: scale(1.05); box-shadow: 0 0 14px rgba(245, 129, 31, 0.65); }
  100% { transform: scale(1); box-shadow: 0 0 0 rgba(245, 129, 31, 0.0); }
}
`;

  // =========================================================
  // 6. ウォッチャー：ブログ生成完了
  // =========================================================
  let blogWatchTimer = null;
  let thumbnailWatchTimer = null;
  let imageDetectWatchTimer = null;
  // v0.4.0.5: 各監視のvisibilitychangeリスナー（監視を止めるときに一緒に外す。二重登録防止）。
  let blogWatchVisibilityHandler = null;
  let thumbnailWatchVisibilityHandler = null;
  let imageDetectWatchVisibilityHandler = null;

  function stopBlogWatch() {
    if (blogWatchTimer) { clearInterval(blogWatchTimer); blogWatchTimer = null; }
    if (blogWatchVisibilityHandler) { document.removeEventListener('visibilitychange', blogWatchVisibilityHandler); blogWatchVisibilityHandler = null; }
  }
  function stopThumbnailWatch() {
    if (thumbnailWatchTimer) { clearInterval(thumbnailWatchTimer); thumbnailWatchTimer = null; }
    if (thumbnailWatchVisibilityHandler) { document.removeEventListener('visibilitychange', thumbnailWatchVisibilityHandler); thumbnailWatchVisibilityHandler = null; }
  }
  function stopImageDetectWatch() {
    if (imageDetectWatchTimer) { clearInterval(imageDetectWatchTimer); imageDetectWatchTimer = null; }
    if (imageDetectWatchVisibilityHandler) { document.removeEventListener('visibilitychange', imageDetectWatchVisibilityHandler); imageDetectWatchVisibilityHandler = null; }
  }

  function getArticlePlainLength(html) {
    return String(html || '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, '')
      .trim()
      .length;
  }

  function hasEnoughArticleHtml(html) {
    const source = String(html || '');
    const headingCount = (source.match(/<h2[\s>]/gi) || []).length;
    const paragraphCount = (source.match(/<p[\s>]/gi) || []).length;
    return hasClosedArticleHeading(source) &&
      headingCount >= 2 &&
      paragraphCount >= 4 &&
      getArticlePlainLength(source) >= 300;
  }

  // v0.4.1.0:「読み取り直す」・「貼り付けて読み込む」（時間切れ・読み取り失敗のときの
  // 再読み込み）と、通常の監視完了の両方から呼べるように、完了時の後処理・結果表示を
  // 単体の関数として切り出したもの。articleTextは呼び出し元がすでに用意した「記事の本文
  // らしきテキスト」（目印方式で切り出した本文、または貼り付けテキストから<h1>で切り出した
  // 本文）を渡す。成功なら結果パネルまで表示してtrueを返す。失敗時はstatusDivに理由を表示して
  // falseを返す（呼び出し側の状態遷移はしない）。
  // getArticleFactsTextは「今この時点の画面の入力（＝保存済みドラフト）」から比較用テキストを
  // 作る関数（buildArticleFactsSummary）を呼び出し元から受け取る。渡されない場合は、後方互換
  // としてlastArticleFactsにフォールバックする。
  function finalizeBlogFromText(articleText, statusDiv, copyBtn, getArticleFactsText) {
    if (!articleText) {
      statusDiv.textContent = '⚠️ ChatGPTの回答が見つかりませんでした。ChatGPTの画面に記事の回答が表示されているか確認してください。';
      statusDiv.classList.add('show');
      return false;
    }

    try {
      let decoded = '';
      let ctaData = null;
      const blogJson = parseBlogJsonResponse(articleText);
      if (blogJson) {
        decoded = renderBlogJsonHtml(blogJson);
        const articleJson = blogJson.article && typeof blogJson.article === 'object' ? blogJson.article : blogJson;
        ctaData = normalizeJsonCtaData(blogJson.cta || blogJson.ctaData || blogJson.cta_data || articleJson.cta);
      } else {
        decoded = decodeHtmlText(articleText);
        decoded = decoded.replace(/```(?:html)?\s*/gi, '').replace(/```/g, '');
        ctaData = parseCtaData(decoded);
        // v0.4.1.0: 目印で切り出した本文はほぼこの形のままのはずだが、末尾の雑談や
        // 貼り付け経由（目印無し・<h1>切り出しのみ）の余分な前後を保険で切り落とす。
        decoded = trimToArticleBounds(decoded);
      }

      if (!hasClosedArticleHeading(decoded)) {
        statusDiv.textContent = '⚠️ ChatGPTの回答からブログHTML（<h1から始まる本文）を検出できませんでした。ChatGPTの回答が記事の形になっているか確認し、必要なら下の「📋 プロンプトをコピー」で貼り直してください。';
        statusDiv.classList.add('show');
        copyBtn.style.display = 'none';
        return false;
      }

      decoded = decoded.replace(/<!--CTA_DATA_START-->[\s\S]*?<!--CTA_DATA_END-->/gi, '');
      decoded = decoded.replace(/説明文1[:：].+[\s\S]*?締めの言葉[:：].+/gi, '');
      decoded = decoded.replace(/<p[^>]*style=['"][^'"]*color:\s*red[^'"]*['"][^>]*>\s*■+CTAセクション■+\s*<\/p>/gi, '');
      decoded = decoded.replace(/<table[^>]*>[\s\S]*<\/table>\s*$/i, '');

      // タイトル候補を抽出し、本文からEISAI_TITLESコメントを除去する
      const titleResult = extractTitleCandidates(decoded);
      decoded = titleResult.html;
      lastTitleCandidates = titleResult.titles;

      if (!hasEnoughArticleHtml(decoded)) {
        lastBlogHtml = '';
        setGeneratedContext({ blogHtml: '', blogTitle: '' });
        statusDiv.textContent = '⚠️ ブログ本文が途中までしか取得できませんでした（失敗）。本文として使うには短すぎるか、見出し・段落が足りません。ChatGPTの回答全体（<h1>から最後まで）をコピーし直して、もう一度「貼り付けて読み込む」をお試しください。時間がかかっているだけの場合は「ChatGPTで記事を作る」をもう一度押すか、「📋 プロンプトをコピー」から送り直してください。';
        statusDiv.classList.add('show');
        copyBtn.style.display = 'none';
        return false;
      }

      const info = getSetting();
      let ctaUrl = (info.url || '').trim();
      const ctaTel = (info.tel || '').trim();
      if (!ctaUrl) {
        console.warn('CTA URLが設定されていません');
        statusDiv.textContent = '⚠️ CTAリンク先URLが未設定です（失敗）。教室情報設定でURLを保存してから、もう一度生成してください。';
        statusDiv.classList.add('show');
        copyBtn.style.display = 'none';
        return false;
      }
      if (!/^https?:\/\//i.test(ctaUrl)) ctaUrl = 'https://' + ctaUrl;

      // v0.4.0（design.md 4.生成後の処理）：新語彙(eisai-cta)がある出力ではbuildCtaHtmlを使わず、
      // AIが書いたcta-btn/cta-subのhrefを教室設定の値で差し替える。旧語彙のみ従来どおりbuildCtaHtmlを使う。
      // v0.4.1：湯浅さん指示「必ず一番最後に、ブログに合わせて文章を変えた『まずはお気軽にご相談ください』の
      // CTAを付ける」。v0.4.0では本文に eisai-cta がある時にこの申込枠を付けなかったため、最後の申込枠が消えていた。
      // 中間CTA（data-kind="mid"）はリンクを教室設定の値に差し替えて残し、AIが書いた最後のCTA（data-kind="final"）は
      // 申込枠と重なるので外し、記事の一番最後に必ず buildCtaHtml（CTA_DATAの文章で作る保護CTA）を付ける。
      decoded = removeFinalEisaiCta(decoded);
      if (/class=["']eisai-cta["']/i.test(decoded)) {
        decoded = applyClassroomCtaLinks(decoded, ctaUrl, ctaTel, (info.line || '').trim());
      }
      const ctaHtml = buildCtaHtml(ctaUrl, ctaTel, ctaData);

      // EISAI_CHECK（自己チェック）を抽出し、コピー用HTMLからは除去する（結果パネル表示専用）
      const checkResult = extractEisaiCheck(decoded);
      decoded = checkResult.html;
      lastEisaiCheck = checkResult.check;

      // 拡張機能側の実測（本文字数・h2数・CTA数と中間CTA位置％・写真枠数・感嘆符/絵文字数）
      lastArticleMetrics = computeArticleMetrics(decoded);

      // 要確認：本文の「」内の文言／曜日表記／数字＋単位で、入力（記事入力＋教室設定）に無いものを検出
      // v0.4.0.5: EISAI_TITLES（タイトル案）は本文ではないため、要確認の対象から必ず除く
      // （通常はこの時点でextractTitleCandidatesにより既に除去済みだが、万一の残骸に備えた保険）。
      const unverifiedCheckSource = decoded.replace(/(?:<!--|&lt;!--)?\s*EISAI_TITLES[\s\S]*?(?:-->|--&gt;|\])/gi, '');
      const classroomInputText = [info.name, info.manager, info.area, info.schools, info.tel, info.line, info.address, info.access, info.hours]
        .filter(Boolean).join('\n');
      // v0.4.0.9: 「記憶した値」ではなく、呼び出し時点の画面の入力（保存済みドラフト）から
      // 毎回作る。getArticleFactsTextが渡されていない古い呼び出し元向けにlastArticleFactsへ
      // フォールバックする。
      const currentArticleFactsText = typeof getArticleFactsText === 'function'
        ? (getArticleFactsText() || '')
        : (lastArticleFacts || '');
      const unverifiedInputText = currentArticleFactsText + '\n' + classroomInputText;
      lastUnverifiedClaims = findUnverifiedClaims(unverifiedCheckSource, unverifiedInputText);

      lastBlogTitle = extractH1Text(decoded);
      // エディタで3タイトルを選べるよう、末尾にEISAI_TITLESコメントを残す（不可視）
      lastBlogHtml = decoded + (ctaHtml ? '\n\n' + ctaHtml : '') + buildTitlesComment(lastTitleCandidates);
      setGeneratedContext({
        blogHtml: lastBlogHtml,
        articleFacts: currentArticleFactsText,
        blogTitle: lastBlogTitle
      });

    } catch (e) {
      console.error('ブログHTML処理エラー:', e);
      // v0.4.0: コンソールだけのサイレント失敗をなくし、パネルにも理由を出す
      statusDiv.textContent = `⚠️ ブログHTMLの処理中にエラーが発生しました（失敗・${e && e.message ? e.message : e}）。下の「📋 プロンプトをコピー」からChatGPTの入力欄に貼って、もう一度送信してください。`;
      statusDiv.classList.add('show');
      return false;
    }

    statusDiv.textContent = '✅ 記事の生成が完了しました。下のボタンからHTMLをコピーできます。';
    statusDiv.classList.add('show');
    renderTitleCandidates();
    renderCheckAndMetrics();
    renderUnverifiedList();
    copyBtn.style.display = 'block';
    // v0.4.0: openEditorBtnの表示・下部アクションバーの主/副切替・ステップ表示の更新は、
    // buildPanel側のonSettledコールバックでsyncFooterButtons()/refreshDynamicUi()を呼んで行う
    // （このモジュール関数はbuildPanelのクロージャ変数を持たないため、直接は呼べない）。
    setTimeout(() => {
      const titleSectionEl = document.getElementById('eisai-title-section');
      if (titleSectionEl && titleSectionEl.scrollIntoView) {
        titleSectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
    return true;
  }

  // v0.4.1.0: 記事監視・サムネ指示監視の共通エンジン。合言葉（マーカー）方式の状態
  // （getMarkerState）だけを見るため、DOM構造（役割属性・停止ボタン等）には一切依存しない。
  //   - 開始目印すら無い → 「考え中（n秒）」
  //   - 開始目印はあるが終了目印が無い → 「生成中（n文字）」
  //   - 終了目印が見つかり、切り出した本文が2回連続（=2秒）で変わらない → 完成
  // タブが裏にある間はカウントしない（TAB_HIDDEN_STATUS_TEXT）。見えている時間で8分
  // （480秒）でタイムアウト。
  const MARKER_WATCH_MAX_POLL_COUNT = 480; // 8分（見えている秒数だけ数える）
  const MARKER_WATCH_STABLE_TARGET = 2; // 終了目印が見つかってから、これだけ連続で同一なら完成

  function startMarkerWatch(requestId, statusDiv, stopFn, setTimerFn, handlers) {
    stopFn();

    let last = null;
    let stableCount = 0;
    let pollCount = 0;
    let visibleAgainAt = Date.now();
    let wasHidden = isTabHidden();

    const tick = () => {
      if (typeof handlers.shouldContinue === 'function' && !handlers.shouldContinue()) {
        stopFn();
        return;
      }

      // v0.4.1.2: 2026-09-27に実機で確認：タブが裏にある間、ChatGPTは本文を最後まで
      // 描画し終えている（終了目印まで出ている）ことがあるのに、以前はここで
      // 目印の確認そのものをせずreturnしていたため、表に戻すまでパネルが完成処理へ
      // 進めなかった。裏にある間も毎回getMarkerStateで目印を確認するように変更し、
      // 「タイムアウトの秒数に数えない」（pollCountを進めない）だけに絞った。
      const hidden = isTabHidden();
      if (hidden) {
        wasHidden = true;
      } else if (wasHidden) {
        // 裏から表になった直後：間引かれたタイマーを待たず、この場で確認する
        visibleAgainAt = Date.now();
        wasHidden = false;
      }

      if (!hidden) pollCount++;
      const state = getMarkerState(requestId);

      if (!state.hasStart) {
        if (hidden) {
          statusDiv.textContent = TAB_HIDDEN_STATUS_TEXT;
          statusDiv.classList.add('show');
          return;
        }
        statusDiv.textContent = `🧠 ChatGPTが考えています…（${pollCount}秒）`;
        statusDiv.classList.add('show');
        if (pollCount >= MARKER_WATCH_MAX_POLL_COUNT) {
          stopFn();
          handlers.onTimeout(false);
        }
        return;
      }

      if (!state.hasEnd) {
        if (hidden) {
          statusDiv.textContent = TAB_HIDDEN_STATUS_TEXT;
          statusDiv.classList.add('show');
          return;
        }
        statusDiv.textContent = `🧠 ChatGPTが生成中です…（${state.charCount}文字）`;
        statusDiv.classList.add('show');
        // 表に戻った直後、ChatGPTが全文を描画するまで数秒かかる。見えている状態で
        // 60秒以内は、この待ちをタイムアウトに数えない。
        if (Date.now() - visibleAgainAt < 60000) {
          pollCount--;
          return;
        }
        if (pollCount >= MARKER_WATCH_MAX_POLL_COUNT) {
          stopFn();
          handlers.onTimeout(true);
        }
        return;
      }

      // 終了目印は見つかった：裏にある間も含め、通常どおり安定確認〜完成処理まで進める
      // （終了目印が見つかった後は、裏にあっても「⏳ 生成完了を確認しています…」を出す）。
      if (state.text === last) {
        stableCount++;
      } else {
        last = state.text;
        stableCount = 0;
      }
      statusDiv.textContent = `⏳ 生成完了を確認しています…（${state.charCount}文字）`;
      statusDiv.classList.add('show');

      if (stableCount >= MARKER_WATCH_STABLE_TARGET) {
        stopFn();
        handlers.onDone(state.text);
        return;
      }

      // タイムアウトの打ち切りは、見えている時間だけで数える（裏にある間はpollCountを
      // 進めていないため、この条件自体もhidden時は実質発火しない。isTabHidden参照）。
      if (!hidden && pollCount >= MARKER_WATCH_MAX_POLL_COUNT) {
        stopFn();
        handlers.onTimeout(true);
      }
    };

    setTimerFn(tick);
  }

  // v0.4.1.0: 記事生成の完了監視。requestId（送信時に発行した依頼番号）だけを見る。
  function watchBlogResponseAndEnableCopy(requestId, statusDiv, copyBtn, onSettled, getArticleFactsText) {
    const finish = (ok) => {
      if (typeof onSettled === 'function') {
        try { onSettled(ok); } catch (e) { console.error('[Eisai] onSettled呼び出しエラー:', e); }
      }
    };
    startMarkerWatch(requestId, statusDiv, stopBlogWatch, (tick) => {
      blogWatchTimer = setInterval(tick, 1000);
      blogWatchVisibilityHandler = () => tick();
      document.addEventListener('visibilitychange', blogWatchVisibilityHandler);
    }, {
      onDone: (text) => {
        const ok = finalizeBlogFromText(text, statusDiv, copyBtn, getArticleFactsText);
        finish(ok);
      },
      onTimeout: (hasStart) => {
        statusDiv.textContent = hasStart
          ? '⚠️ 生成完了を検出できませんでした（タイムアウト）。ChatGPTの生成が止まっているか確認し、下の「読み取り直す」か「📋 プロンプトをコピー」をお試しください。'
          : '⚠️ 生成完了を検出できませんでした（タイムアウト・回答欄未検出）。下の「📋 プロンプトをコピー」からChatGPTの入力欄に貼って送信するか、「読み取り直す」をお試しください。';
        statusDiv.classList.add('show');
        copyBtn.style.display = 'none';
        finish(false);
      }
    });
  }

  // =========================================================
  // 7. ウォッチャー：サムネイル指示生成完了
  // =========================================================
  let lastImagePromptRequestId = '';
  let isGeneratingPrompt = false;

  // v0.4.1.0: サムネ指示生成の完了監視。記事監視と同じ合言葉方式（startMarkerWatch）を使う。
  function watchThumbnailPrompt(requestId, statusDiv, imgExecBtn) {
    startMarkerWatch(requestId, statusDiv, stopThumbnailWatch, (tick) => {
      thumbnailWatchTimer = setInterval(tick, 1000);
      thumbnailWatchVisibilityHandler = () => tick();
      document.addEventListener('visibilitychange', thumbnailWatchVisibilityHandler);
    }, {
      shouldContinue: () => isGeneratingPrompt,
      onDone: (text) => {
        const promptText = extractImagePromptText(text);
        if (!promptText) {
          isGeneratingPrompt = false;
          statusDiv.textContent = '⚠️ サムネイル指示の生成完了を検出できませんでした。ChatGPTの生成が止まっているか確認し、もう一度お試しください。';
          statusDiv.classList.add('show');
          return;
        }
        lastImagePromptRequestId = requestId;
        lastImagePromptText = promptText;
        // v0.4.0.4: [[EISAI_IMG_TEXT]]行の解析用に、生テキストも保存しておく
        lastImageRawResponseText = text;
        isGeneratingPrompt = false;
        imgExecBtn.style.display = 'block';
        if (imgExecBtn.parentElement) imgExecBtn.parentElement.style.display = 'block';

        statusDiv.textContent = '✅ 画像生成用プロンプトの出力が完了しました。内容を確認のうえ、①ChatGPTの画像生成が使える状態か確認し、②「このプロンプトで画像を生成する」ボタンを押して生成をスタートしてください。';
        statusDiv.classList.add('show');
      },
      onTimeout: () => {
        isGeneratingPrompt = false;
        statusDiv.textContent = '⚠️ サムネイル指示の生成完了を検出できませんでした。ChatGPTの生成が止まっているか確認し、もう一度お試しください。';
        statusDiv.classList.add('show');
      }
    });
  }

  // =========================================================
  // 7-1. ウォッチャー：画像そのものの生成完了（v0.4.0.4）
  // =========================================================
  // v0.4.1.0: 画像は本文と違って合言葉（マーカー）を出力できないため、別の仕組みで完成を見る。
  // 送信前にmain内の画像一覧（自パネル外）を記録しておき、その集合に含まれない新しいimgで
  // naturalWidth>500のものを完成の候補とみなす。8分（480秒）経っても現れなければタイムアウト表示。
  // 失敗文言（IMAGE_FAIL_TEXT_RE）は、今回の依頼の「依頼番号：<ID>」より後のテキストに
  // 限って判定する（別の会話や前回の依頼の言い回しと混同しないため）。
  //
  // v0.4.1.3: 2026-09-28に実機で確認：ChatGPTは大きい画像を「プレビュー」表示のまま
  // 十数秒出し続けた後、DOMごと本番表示に差し替える（プレビューのラベルが消え、操作アイコンが
  // 出る）。停止ボタンは最初から最後まで出ないため、止めるボタンでは完成を判定できない。
  // 「大きい画像が現れたら即完成」だと、このプレビュー段階を完成と誤検出してしまっていた。
  // 以後は2段判定にする：(1) 大きい画像の近くに「プレビュー」/「Preview」の表示がある間
  // （isNearImagePreviewLabel）は完成にせず「🎨 画像を仕上げています…」を表示して待つ、
  // (2) プレビュー表示が無い状態で、大きい画像の組（src一覧）がIMAGE_STABLE_MS（5秒）続けて
  // 変わらなければ完成とみなす。プレビューが一度も出ないまま完成するケースでも、5秒安定すれば
  // 従来どおり完成にする。
  const IMAGE_FAIL_TEXT_RE = /画像を生成できませんでした|画像が返されませんでした|画像の生成に失敗|画像を作成できませんでした|画像を生成することができませんでした/;
  const IMAGE_STABLE_MS = 5000;

  function watchGeneratedImage(requestId, baselineImages, statusDiv, onDetected) {
    stopImageDetectWatch();

    let pollCount = 0;
    const maxPollCount = 480; // 8分（見えている時間だけ数える）
    let visibleAgainAt = Date.now();
    let wasHidden = isTabHidden();
    const baselineSet = new Set(baselineImages || []);
    // v0.4.1.3: 直近の「大きい画像の組」のキー（src一覧を並べ替えて連結した文字列）と、
    // そのキーがいつから変わっていないか。プレビュー表示がある間・画像が消えた間は都度リセットする。
    let stableImageKey = null;
    let stableSince = null;

    const tick = () => {
      // v0.4.1.2: startMarkerWatchと同じ考え方。裏にある間も新しい画像の出現（完成）だけは
      // 毎回確認する。タイムアウトの秒数と、失敗文言だけで打ち切る判定は表にある時だけ行う
      // （失敗文言は裏で本文が更新され続けても誤って早期に打ち切らないよう、見えている
      // 時間の猶予・秒数カウントに乗せたままにする）。
      const hidden = isTabHidden();
      if (hidden) {
        wasHidden = true;
      } else if (wasHidden) {
        visibleAgainAt = Date.now();
        wasHidden = false;
      }
      // v0.4.0.5: 表に戻った直後の描画待ち（最大60秒）はタイムアウトに数えない
      const inVisibleGrace = !hidden && (Date.now() - visibleAgainAt < 60000);

      const newImages = collectMainImages().filter(img => !baselineSet.has(img));
      const bigImages = newImages.filter(img => (img.naturalWidth || 0) > 500);
      const hasAnyImage = newImages.length > 0;
      const hasFailText = IMAGE_FAIL_TEXT_RE.test(textAfterRequestId(requestId));

      if (bigImages.length > 0) {
        const hasPreview = bigImages.some(img => isNearImagePreviewLabel(img));
        if (hasPreview) {
          // v0.4.1.3: プレビュー段階。安定カウントをリセットし、仕上げ待ちを表示する
          // （完成にはしない。プレビューが消えた瞬間から改めて5秒の安定待ちを始める）。
          stableImageKey = null;
          stableSince = null;
          if (!hidden) {
            statusDiv.textContent = '🎨 画像を仕上げています…';
            statusDiv.classList.add('show');
          }
        } else {
          const currentKey = bigImages.map(img => img.currentSrc || img.src || '').sort().join('|');
          if (currentKey !== stableImageKey) {
            stableImageKey = currentKey;
            stableSince = Date.now();
          }
          if (Date.now() - stableSince >= IMAGE_STABLE_MS) {
            stopImageDetectWatch();
            if (hasFailText) {
              // v0.4.0.5: 失敗の言い回しが出つつも下書きimgが残っているケース
              statusDiv.textContent = '⚠️ ChatGPTが仕上げに失敗しました。表示中の画像で良ければ保存してください。作り直すときは「もう一度作る」を押してください。';
            } else {
              statusDiv.textContent = '✅ 画像ができました。ChatGPTの画像をクリックして開き、保存してください（右上のダウンロード）。';
            }
            statusDiv.classList.add('show');
            if (typeof onDetected === 'function') {
              try { onDetected(); } catch (e) { console.error('[Eisai] 画像完了コールバックエラー:', e); }
            }
            return;
          }
          if (!hidden) {
            statusDiv.textContent = '🎨 画像を仕上げています…';
            statusDiv.classList.add('show');
          }
        }
      } else {
        stableImageKey = null;
        stableSince = null;
      }

      if (hidden) {
        statusDiv.textContent = TAB_HIDDEN_STATUS_TEXT;
        statusDiv.classList.add('show');
        return;
      }

      if (hasFailText && !hasAnyImage && !inVisibleGrace) {
        // v0.4.0.5: 失敗の言い回しが出て、imgも無いケース
        stopImageDetectWatch();
        statusDiv.textContent = '⚠️ 画像を作れませんでした。「もう一度作る」を押してください。';
        statusDiv.classList.add('show');
        return;
      }

      if (inVisibleGrace) return;

      pollCount++;
      if (pollCount >= maxPollCount) {
        stopImageDetectWatch();
        statusDiv.textContent = '⚠️ 8分経っても画像の完成を確認できませんでした。ChatGPTの画面を直接確認してください（進んでいれば、そのまま少し待てば表示されます）。';
        statusDiv.classList.add('show');
      }
    };

    imageDetectWatchTimer = setInterval(tick, 1000);
    imageDetectWatchVisibilityHandler = () => tick();
    document.addEventListener('visibilitychange', imageDetectWatchVisibilityHandler);
  }

  // =========================================================
  // 9. パネルUI本体
  // =========================================================
  function buildPanel(options = {}) {
    const forceOpen = options.forceOpen === true;
    const existingPanel = document.getElementById(TOOL_ID);
    if (existingPanel) {
      const existingToggle = document.getElementById('eisai-toggle-btn');
      if (forceOpen) {
        setPanelCollapsed(existingPanel, existingToggle, false);
      } else {
        existingPanel.style.display = 'flex';
        syncChatAvoidance(existingPanel);
      }
      removeLauncherButton();
      return;
    }

    const styleTag = document.createElement('style');
    styleTag.textContent = CSS;
    document.head.appendChild(styleTag);
    bindChatAvoidanceResize();

    const isCollapsed = forceOpen ? false : localStorage.getItem('eisai_collapsed') === 'true';

    const panel = createEl('div', { id: TOOL_ID }, document.body);
    if (isCollapsed) panel.classList.add('collapsed');
    removeLauncherButton();

    const staleToggleBtn = document.getElementById('eisai-toggle-btn');
    if (staleToggleBtn) staleToggleBtn.remove();

    const toggleBtn = createEl('button', { id: 'eisai-toggle-btn' }, document.body);
    toggleBtn.textContent = '📝 英才ブログ生成';
    if (isCollapsed) toggleBtn.classList.add('collapsed');

    toggleBtn.onclick = () => {
      setPanelCollapsed(panel, toggleBtn, !panel.classList.contains('collapsed'));
    };

    const header = createEl('div', { className: 'eisai-header' }, panel);
    const titleWrap = createEl('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, header);
    createEl('span', { className: 'eisai-header-title' }, titleWrap, '英才ブログ生成');
    const verSpan = createEl('span', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.65)' } }, titleWrap, `v${getDisplayVersion()}`);
    if (isTestModeEnabled()) {
      createEl('span', {
        style: {
          fontSize: '10px',
          color: '#7a4a00',
          background: '#ffd453',
          border: '1px solid #f5a623',
          borderRadius: '999px',
          padding: '2px 7px',
          fontWeight: '800'
        }
      }, titleWrap, 'テストモード');
    }

    const headerRight = createEl('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } }, header);

    const testModeBtn = createEl('button', {
      style: {
        fontSize: '10px',
        padding: '3px 6px',
        borderRadius: '4px',
        border: isTestModeEnabled() ? '1px solid #f5a623' : '1px solid rgba(255,255,255,0.35)',
        background: isTestModeEnabled() ? '#ffd453' : 'transparent',
        color: isTestModeEnabled() ? '#7a4a00' : '#e7ebf3',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontWeight: '700'
      }
    }, headerRight, isTestModeEnabled() ? 'テストOFF' : 'テストON');
    testModeBtn.title = 'テストモードを切り替えます（もう一度押すと切替）';
    // v0.4.0: confirm()の代わりに2回押し確認にする（1回目で「もう一度押すと切替」に変わる）
    armTwoStepButton(testModeBtn, 'もう一度で切替', () => {
      const nextEnabled = !isTestModeEnabled();
      setTestModeEnabled(nextEnabled);
      setChatAvoidance(false);
      panel.remove();
      toggleBtn.remove();
      buildPanel({ forceOpen: true });
      showToast(nextEnabled
        ? 'テストモードをONにしました。架空教室情報とサンプル入力ボタンが使えます。'
        : 'テストモードをOFFにしました。');
    });

    const updateBtn = createEl('button', {
      style: {
        fontSize: '11px',
        padding: '3px 6px',
        borderRadius: '4px',
        border: '1px solid rgba(255,255,255,0.35)',
        background: 'transparent',
        color: '#e7ebf3',
        cursor: 'pointer',
        whiteSpace: 'nowrap'
      }
    }, headerRight, '更新');

    const closeBtn = createEl('button', { textContent: '←', style: { background: 'none', border: 'none', color: '#fff', fontSize: '16px', cursor: 'pointer', padding: '4px 8px' } }, headerRight);
    closeBtn.title = 'サイドパネルを閉じる';
    closeBtn.onclick = () => {
      setPanelCollapsed(panel, toggleBtn, true);
    };

    updateBtn.title = `現在のバージョン: v${CURRENT_VERSION}（もう一度押すと更新確認画面を開きます）`;
    // v0.4.0: confirm()の代わりに2回押し確認にする
    armTwoStepButton(updateBtn, 'もう一度で確認', () => {
      const cacheBustedUrl = UPDATE_URL + '?v=' + encodeURIComponent(CURRENT_VERSION) + '&t=' + Date.now();
      window.open(cacheBustedUrl, '_blank');
    });

    // v0.4.0: ステップ表示（① 教室 → ② 入力 → ③ 生成 → ④ 仕上げ → ⑤ サムネ）。
    // 今どの段階かを、既存の状態（教室設定・生成結果・サムネ表示）から都度判定して表示するだけの見た目部品。
    const STEP_LABELS = ['教室', '入力', '生成', '仕上げ', 'サムネ'];
    const stepsBar = createEl('div', { className: 'eisai-steps' }, panel);
    const stepEls = STEP_LABELS.map((label, idx) => {
      if (idx > 0) createEl('div', { className: 'eisai-step-line' }, stepsBar);
      const stepEl = createEl('div', { className: 'eisai-step' }, stepsBar);
      const dot = createEl('div', { className: 'eisai-step-dot' }, stepEl, String(idx + 1));
      createEl('div', { className: 'eisai-step-label' }, stepEl, label);
      stepEl._dot = dot;
      return stepEl;
    });

    syncChatAvoidance(panel);

    const content = createEl('div', { style: { padding: '14px', overflow: 'auto', flex: 1 } }, panel);

    // v0.4.0: 下部固定のアクションバー。状態表示→不足項目の案内→主/副ボタンの順で常時表示する。
    const footer = createEl('div', { className: 'eisai-action-bar' }, panel);
    const statusDiv = createEl('div', { className: 'eisai-status' }, footer);
    const missingHint = createEl('div', { className: 'eisai-missing-hint' }, footer);
    const actionRow = createEl('div', { className: 'eisai-action-bar-row' }, footer);
    missingHint.title = 'クリックすると、不足している項目までスクロールします';
    missingHint.onclick = () => {
      const info = getSetting();
      const classroomDone = isClassroomInfoComplete(info);
      if (!classroomDone) {
        details.open = true;
        if (details.scrollIntoView) details.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      focusFirstMissingArticleField();
    };

    // v0.4.0: ステップ表示・不足項目の案内を、既存の状態（教室設定・genBtnの活性状態・生成結果・サムネ表示）
    // から都度判定して更新するだけの見た目部品。本体の構築が終わるまでは何もしない（dynamicUiReadyで制御）。
    let dynamicUiReady = false;
    function refreshDynamicUi() {
      if (!dynamicUiReady) return;
      // v0.4.0.5: 「詳しく指定」がたたまれていても値が見えるよう、見出し横の要約を都度更新する
      if (typeof updateDetailedSummaryRecap === 'function') updateDetailedSummaryRecap();
      const generated = !!lastBlogHtml;
      const sending = !!(genBtn && genBtn.disabled);
      const missing = collectMissingLabels();
      if (missing.length && !generated && !sending) {
        missingHint.textContent = `あと${missing.length}項目：${missing.join('、')}`;
        missingHint.classList.add('show');
      } else {
        missingHint.classList.remove('show');
      }

      const info = getSetting();
      const classroomDone = isClassroomInfoComplete(info);
      let active;
      if (!classroomDone) active = 1;
      else if (sending) active = 3;
      else if (!generated) active = 2;
      else if (!imgSection || imgSection.style.display !== 'block') active = 4;
      // v0.4.0.4: 画像そのものの生成が完了検知済みなら、サムネのステップを完了扱いにする
      // （STEP_LABELSは5個なので、activeを6にすると全ステップがis-done扱いになる）
      else if (thumbnailImageDetected) active = 6;
      else active = 5;
      stepEls.forEach((el, idx) => {
        const n = idx + 1;
        const isDone = n < active;
        el.classList.toggle('is-active', n === active);
        el.classList.toggle('is-done', isDone);
        if (el._dot) el._dot.textContent = isDone ? '✓' : String(n);
      });
    }

    // v0.4.0: 教室情報カード。保存済みなら1行要約＋「編集」、未設定なら開いた状態で必須（校舎名・申込URL）を強調する。
    const details = createEl('details', { className: 'eisai-details' }, content);
    const classroomSummary = createEl('summary', {}, details);
    const dContent = createEl('div', { className: 'eisai-details-content' }, details);

    const nameIn = createInput(dContent, '校舎名（記事に反映されます）', '例：◯◯校　※校まで必ずいれる', false, true);
    const managerIn = createInput(dContent, '室長名（本文では名前のみ使用・フルネーム可）', '例：●●', false, true);
    const areaIn = createInput(dContent, '地域・駅名（冒頭あいさつ用・任意）', '例：武蔵新城・武蔵中原エリア', false);
    const schoolsIn = createInput(dContent, '近隣の対象校（カンマ区切り・任意）', '例：枡形中, 生田中, 稲田中', false);
    const urlIn = createInput(dContent, '申込フォームURL（https://必須）', '例：https://eisai.org/…', false, true);
    const telIn = createInput(dContent, '電話番号（CTAの電話ボタン用・任意）', '例：ハイフンなしで登録', false);
    const lineIn = createInput(dContent, 'LINE URL（CTAのLINEボタン用・任意）', '例：https://lin.ee/…', false);
    const addressIn = createInput(dContent, '住所（任意）', '例：東京都◯◯区◯◯1-2-3', false);
    const accessIn = createInput(dContent, 'アクセス（任意）', '例：◯◯線「◯◯駅」徒歩1分', false);
    const hoursIn = createInput(dContent, '受付時間（任意）', '例：平日15:00〜21:00、土日13:00〜19:00', false);

    const saved = getSetting();
    if (saved.name) nameIn.value = saved.name;
    if (saved.manager) managerIn.value = saved.manager;
    if (saved.area) areaIn.value = saved.area;
    if (saved.schools) schoolsIn.value = saved.schools;
    if (saved.url) urlIn.value = saved.url;
    if (saved.tel) telIn.value = saved.tel;
    if (saved.line) lineIn.value = saved.line;
    if (saved.address) addressIn.value = saved.address;
    if (saved.access) accessIn.value = saved.access;
    if (saved.hours) hoursIn.value = saved.hours;

    // v0.4.0.5: 必須判定は単一の定義元（REQUIRED_CLASSROOM_FIELDS）を参照する
    function isClassroomComplete() {
      return isClassroomInfoComplete(getSetting());
    }

    // 保存済み：1行要約（例「東大島校／山田／申込URL ✓／電話 –／LINE ✓」）＋「編集」。未設定：開いた状態で見出しのみ。
    function renderClassroomSummary() {
      while (classroomSummary.firstChild) classroomSummary.removeChild(classroomSummary.firstChild);
      const info = getSetting();
      if (isClassroomComplete()) {
        const row = createEl('div', { className: 'eisai-classroom-summary' }, classroomSummary);
        createEl('span', {
          style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
        }, row, `${info.name}／${info.manager || '室長未設定'}／申込URL✓／電話${info.tel ? '✓' : '–'}／LINE${info.line ? '✓' : '–'}`);
        createEl('span', { className: 'eisai-classroom-summary-edit' }, row, '編集');
        details.open = false;
      } else {
        createEl('span', { style: { fontWeight: '700' } }, classroomSummary, REQUIRED_CLASSROOM_SUMMARY_TEXT);
        details.open = true;
      }
    }
    renderClassroomSummary();

    const saveBtn = createEl('button', { className: 'eisai-secondary-btn', style: { marginTop: '6px' } }, dContent, '教室情報を保存');
    saveBtn.onclick = () => {
      if (isTestModeEnabled()) {
        showToast('テストモード中は架空の教室情報を自動使用します。通常の教室情報は上書きしません。');
        return;
      }
      saveSetting({
        name: nameIn.value,
        manager: managerIn.value,
        area: areaIn.value,
        schools: schoolsIn.value,
        url: urlIn.value,
        tel: telIn.value,
        line: lineIn.value,
        address: addressIn.value,
        access: accessIn.value,
        hours: hoursIn.value
      });
      showToast('教室情報を保存しました');
      renderClassroomSummary();
      refreshDynamicUi();
    };

    if (isTestModeEnabled()) {
      createEl('div', {
        style: {
          marginTop: '8px',
          padding: '8px',
          borderRadius: '6px',
          background: '#fffbeb',
          color: '#92400e',
          border: '1px solid #fcd34d',
          fontSize: '12px',
          lineHeight: '1.5'
        }
      }, dContent, 'テストモード中です。架空の教室情報を使用し、保存済みの本番教室情報は上書きしません。');
    }

    // v0.4.0: 入力モード（かんたん／しっかり）のセグメント型トグル。教室情報カードの下に置き、選択は保存する。
    const inputModeWrap = createEl('div', { className: 'eisai-type-wrap' }, content);
    createEl('div', { className: 'eisai-label' }, inputModeWrap, '入力モード');
    const inputModeRow = createEl('div', { className: 'eisai-segmented' }, inputModeWrap);
    const INPUT_MODE_LABELS = {
      [INPUT_MODES.EASY]: 'かんたん（メモ）',
      [INPUT_MODES.DETAILED]: 'しっかり（項目別）'
    };
    const INPUT_MODE_DESCRIPTIONS = {
      [INPUT_MODES.EASY]: 'メモを書くだけ。AIが事実を拾って記事にします。',
      [INPUT_MODES.DETAILED]: '項目ごとに書くと、狙いどおりの記事になりやすいです。'
    };
    const segmentDesc = createEl('div', { className: 'eisai-segment-desc' }, inputModeWrap);
    function updateSegmentDesc() {
      segmentDesc.textContent = INPUT_MODE_DESCRIPTIONS[currentInputMode] || '';
    }
    const inputModeButtons = [];
    function addInputModeButton(mode, label) {
      const btn = createEl('button', { textContent: label }, inputModeRow);
      btn.type = 'button';
      btn.onclick = () => {
        if (currentInputMode === mode) return;
        currentInputMode = mode;
        saveInputMode(mode);
        inputModeButtons.forEach(b => b.classList.remove('eisai-segmented-active'));
        btn.classList.add('eisai-segmented-active');
        if (currentInputMode === INPUT_MODES.DETAILED && currentArticleType === ARTICLE_TYPES.AUTO) {
          currentArticleType = ARTICLE_TYPES.BA;
        }
        updateSegmentDesc();
        renderTypeButtons();
        renderArticleForm();
        persistArticleInput();
      };
      inputModeButtons.push(btn);
      return btn;
    }
    addInputModeButton(INPUT_MODES.EASY, INPUT_MODE_LABELS[INPUT_MODES.EASY]);
    addInputModeButton(INPUT_MODES.DETAILED, INPUT_MODE_LABELS[INPUT_MODES.DETAILED]);
    (currentInputMode === INPUT_MODES.DETAILED ? inputModeButtons[1] : inputModeButtons[0]).classList.add('eisai-segmented-active');
    updateSegmentDesc();

    // v0.4.0: 記事の型（悩み解決型／ストーリー型／おまかせ）。かんたんモードでは「詳しく指定」内に、
    // しっかりモードではカードの上に置く（renderArticleForm()内で移動する）ため、ここでは箱だけ作る。
    const typeWrap = createEl('div', { className: 'eisai-type-wrap' });
    const typeWrapLabel = createEl('div', { className: 'eisai-label' }, typeWrap, '記事の型');
    const typeRow = createEl('div', { className: 'eisai-type-row' }, typeWrap);
    let typeButtons = [];
    // v0.4.0: 「おまかせ」はかんたんモードの時だけ選べる（しっかりモードは今の2択のまま）ため、
    // 入力モード切替時に再構築できる関数にする。
    function renderTypeButtons() {
      clearElement(typeRow);
      typeButtons = [];
      function addTypeButton(type, label) {
        const btn = createEl('button', { className: 'eisai-type-btn' }, typeRow, label);
        btn.onclick = () => {
          currentArticleType = type;
          typeButtons.forEach(b => b.classList.remove('eisai-type-btn-active'));
          btn.classList.add('eisai-type-btn-active');
          renderArticleForm();
          // v0.4.1（Codexレビュー対応）：型だけ変えて再読み込みしても戻らないよう、すぐ保存する
          persistArticleInput();
        };
        typeButtons.push(btn);
        return btn;
      }
      // v0.4.1: ビフォー・アフター型を先頭（標準）にした。
      const orderedTypes = [ARTICLE_TYPES.BA, ARTICLE_TYPES.STORY, ARTICLE_TYPES.SOLVE];
      addTypeButton(ARTICLE_TYPES.BA, 'ビフォー・アフター型（生徒の変化・成果）');
      addTypeButton(ARTICLE_TYPES.STORY, 'ストーリー型（事例・イベント・体験）');
      addTypeButton(ARTICLE_TYPES.SOLVE, '悩み解決型（情報提供）');
      if (currentInputMode === INPUT_MODES.EASY) {
        addTypeButton(ARTICLE_TYPES.AUTO, 'おまかせ（メモから判断）');
        orderedTypes.push(ARTICLE_TYPES.AUTO);
      }
      const activeIndex = orderedTypes.indexOf(currentArticleType);
      const activeBtn = typeButtons[activeIndex >= 0 ? activeIndex : 0] || typeButtons[0];
      if (activeBtn) activeBtn.classList.add('eisai-type-btn-active');
    }
    renderTypeButtons();

    const step2 = createEl('div', { id: 'eisai-step2' }, content);

    // 生成後に入力欄(step2)を畳んで、下の進捗（状態・タイトル・画像生成）を見せるアコーディオン見出し
    const inputAccordion = createEl('div', {
      id: 'eisai-input-accordion',
      style: {
        display: 'none',
        cursor: 'pointer',
        padding: '10px 12px',
        marginBottom: '10px',
        background: 'var(--eisai-bg-soft)',
        border: '1px solid var(--eisai-border)',
        borderRadius: 'var(--eisai-r-sm)',
        fontSize: '13px',
        fontWeight: '600',
        color: 'var(--eisai-navy)',
        userSelect: 'none'
      }
    }, content, '入力内容を表示 ▼');
    content.insertBefore(inputAccordion, step2);
    inputAccordion.onclick = () => {
      const willOpen = step2.style.display === 'none';
      step2.style.display = willOpen ? 'block' : 'none';
      inputAccordion.textContent = willOpen ? '入力内容を閉じる ▲' : '入力内容を表示 ▼';
    };
    function collapseInputForResult() {
      step2.style.display = 'none';
      inputAccordion.style.display = 'block';
      inputAccordion.textContent = '入力内容を表示 ▼';
    }
    function resetInputAccordion() {
      inputAccordion.style.display = 'none';
      inputAccordion.textContent = '入力内容を表示 ▼';
    }

    const selectedTypeLabel = createEl('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '8px 12px',
        marginBottom: '12px',
        background: 'var(--eisai-bg-soft)',
        border: '1px solid var(--eisai-border)',
        borderRadius: 'var(--eisai-r-sm)',
        fontSize: '12px',
        fontWeight: '600',
        color: 'var(--eisai-navy)',
        flexWrap: 'wrap'
      }
    }, step2);
    const selectedTypeText = createEl('span', { style: { minWidth: '0' } }, selectedTypeLabel, 'ビフォー・アフター型（生徒の変化・成果）');
    const labelRightWrap = createEl('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexWrap: 'wrap',
        justifyContent: 'flex-end'
      }
    }, selectedTypeLabel);
    const sampleButtonWrap = createEl('div', {
      style: {
        display: 'none',
        flexWrap: 'wrap',
        gap: '4px',
        justifyContent: 'flex-end'
      }
    }, labelRightWrap);

    function clearElement(el) {
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
    }

    const clearInputBtn = createEl('button', {
      style: {
        padding: '3px 8px',
        fontSize: '10px',
        lineHeight: '1.2',
        borderRadius: '999px',
        border: '1px solid #d1d5db',
        background: '#f9fafb',
        color: '#6b7280',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontWeight: '700'
      }
    }, labelRightWrap, '入力をクリア');
    clearInputBtn.title = '入力した記事の内容をすべてクリアします（もう一度押すとクリア）';
    // v0.4.0: confirm()の代わりに2回押し確認にする
    armTwoStepButton(clearInputBtn, 'もう一度でクリア', () => {
      clearArticleForm();
      showToast('入力内容をクリアしました');
    });

    // v0.4.0: 記事入力（ペルソナ→事実）。旧5タイプのTYPE_FORMS/TEST_SAMPLESは廃止。
    const ARTICLE_TYPE_LABELS = {
      [ARTICLE_TYPES.BA]: 'ビフォー・アフター型（生徒の変化・成果）',
      [ARTICLE_TYPES.SOLVE]: '悩み解決型（情報提供）',
      [ARTICLE_TYPES.STORY]: 'ストーリー型（事例・イベント・体験）',
      [ARTICLE_TYPES.AUTO]: 'おまかせ（メモから判断）'
    };

    // v0.4.0: 入力モード（かんたん／しっかり）追加。
    // - modes: そのモードの時だけフォームに表示する（省略時は両モードで表示）。
    // - requiredModes: そのモードの時だけ必須にする（省略時はどちらも任意）。
    const ARTICLE_FIELDS = [
      { key: 'memo', label: '書きたいこと・教室でやったこと（箇条書きでも文章でもOK。日付・人数・学校名・生徒の様子など、事実をそのまま）', shortLabel: '書きたいこと', modes: [INPUT_MODES.EASY], requiredModes: [INPUT_MODES.EASY], isArea: true, placeholder: '例：\n9/6にテスト前の無料対策会やった。40人来た！前回32人だったから増えた\n中3のHくん 社会の暗記が苦手だったが、先生の説明でわかったと話していた' },
      { key: 'grade', label: '誰に：学年', shortLabel: '学年', requiredModes: [INPUT_MODES.DETAILED], type: 'select', options: ['小学生（低学年）', '小学生（高学年）', '中1', '中2', '中3', '中学生全般', '高1・高2', '高3', '私立中高一貫生'] },
      { key: 'tSchools', label: '誰に：対象校', placeholder: '例：枡形中・生田中' },
      { key: 'timing', label: '誰に：時期・きっかけ', placeholder: '例：前期期末テスト1週間前' },
      { key: 'w1', label: '悩み1（セリフで）', modes: [INPUT_MODES.DETAILED], placeholder: '例：「ワークが終わってないのに、もう1週間前…」' },
      { key: 'w2', label: '悩み2（セリフで）', modes: [INPUT_MODES.DETAILED], placeholder: '例：「何から手をつければいいか分からない」' },
      { key: 'w3', label: '悩み3（セリフで）', modes: [INPUT_MODES.DETAILED], placeholder: '例：「本人に危機感がなくて、声をかけると険悪になる」' },
      { key: 'h1', label: '家庭でできること1（手順で）', modes: [INPUT_MODES.DETAILED], placeholder: '例：テスト範囲表を出して、終わっていないページに付箋を貼る' },
      { key: 'h2', label: '家庭でできること2（手順で）', modes: [INPUT_MODES.DETAILED], placeholder: '例：1日1教科、ワークの「間違えた問題だけ」を解き直す' },
      { key: 'h3', label: '家庭でできること3（手順で）', modes: [INPUT_MODES.DETAILED], placeholder: '例：前日は新しい問題をやらず、付箋の問題を見直すだけにする' },
      { key: 'facts', label: '教室でやっている事実（日付・人数・データ・料金・体制など、事実だけ箇条書き）', shortLabel: '教室の事実', modes: [INPUT_MODES.DETAILED], requiredModes: [INPUT_MODES.DETAILED], isArea: true, placeholder: '例：\n・9/6（土）14:00〜18:00 テスト対策会（参加無料・外部生OK）\n・過去3年分の出題傾向を科目別に分析済み\n・自習室は平日15:00〜22:00開放、講師に質問できる\n・生徒ごとに「残り7日の日割りプラン」を作成' },
      { key: 'caseText', label: '事例・当日の様子（任意。書いたことだけが記事に出ます）', modes: [INPUT_MODES.DETAILED], isArea: true, placeholder: '例：中2・Aさん（数学・担当：田中先生）。前回48点→今回76点。本人の言葉：「途中式を書いたら、どこで間違えたか分かった」' },
      { key: 'action', label: 'この記事でつなげたい行動', type: 'select', options: ['無料学習相談', '無料体験授業', 'テスト対策会への参加', 'イベント・講習の申込', '教室見学'] },
      { key: 'offer', label: '締切・特典（任意）', modes: [INPUT_MODES.DETAILED], placeholder: '例：9/5まで申込で範囲別プリント進呈' },
      { key: 'length', label: '目安の文字数', type: 'select', options: [['1800-2200', '1,800〜2,200字（標準）'], ['2200-2800', '2,200〜2,800字（情報多め）'], ['1400-1800', '1,400〜1,800字（短め）']] },
      { key: 'r1', label: '関連記事1（任意：タイトル｜URL）', placeholder: '例：目標点から逆算する、テスト前の問題選び｜https://…' },
      { key: 'r2', label: '関連記事2（任意）', placeholder: '' },
      { key: 'r3', label: '関連記事3（任意）', placeholder: '' },
      { key: 'photos', label: '用意できる写真（任意：何の写真があるか）', placeholder: '例：対策会の様子、日割りプランの用紙、生徒の解き直しノート' }
    ];

    function isFieldVisibleInMode(field, mode) {
      return !field.modes || field.modes.indexOf(mode) >= 0;
    }
    function isFieldRequiredInMode(field, mode) {
      return !!(field.requiredModes && field.requiredModes.indexOf(mode) >= 0);
    }
    function getRequiredFields() {
      return ARTICLE_FIELDS.filter(f => isFieldRequiredInMode(f, currentInputMode));
    }

    // v0.4.0.5: サンプルの対象校名も、記事タイトル等に出ても不自然にならない架空名にする
    // （TEST_CLASSROOM.schoolsと同じ命名に揃える）。
    const ARTICLE_TEST_SAMPLES = {
      [ARTICLE_TYPES.BA]: {
        label: '点数アップ事例（サンプル）',
        values: {
          grade: '中3', tSchools: 'テスト市立第一中学校', timing: '9月の実力テスト後',
          w1: '「夏休みに勉強したのに、点数につながるか不安」',
          w2: '「中1・中2の内容まで戻らないと直せない気がする」',
          w3: '「志望校まであと何点必要か分からない」',
          h1: '', h2: '', h3: '',
          facts: '・夏期講習で毎日自習室に来て、英語と数学の中1・中2の復習をやり直した\n・英語は単語を毎日30個、音読と書き取りをセットで\n・数学は関数と図形の基本問題を講師と解き直し',
          caseText: '中3のBくん（英語：田中先生・数学：鈴木先生）。夏休み前の実力テスト5教科320点→9月の実力テスト395点（+75点）。英語62点→81点、数学58点→79点。本人の言葉：「中1からやり直したら、問題文が読めるようになった」',
          action: '無料学習相談', offer: '', length: '1800-2200',
          r1: '', r2: '', r3: '',
          photos: '英語の単語ノート、数学の解き直しノート'
        }
      },
      [ARTICLE_TYPES.SOLVE]: {
        label: 'テスト市立第一中学校 対策（サンプル）',
        values: {
          grade: '中2', tSchools: 'テスト市立第一中学校', timing: '前期期末テスト1週間前',
          w1: '「ワークが終わってないのに、もう1週間前…」',
          w2: '「何から手をつければいいか分からない」',
          w3: '「本人に危機感がなくて、声をかけると険悪になる」',
          h1: 'テスト範囲表を出して、終わっていないページに付箋を貼る（今日10分）',
          h2: '1日1教科、ワークの「間違えた問題だけ」を解き直す',
          h3: '前日は新しい問題をやらず、付箋の問題を見直すだけにする',
          facts: '・9/6（土）14:00〜18:00 テスト市立第一中学校向け無料テスト対策会（外部生OK、先着12名）\n・過去3年分のテスト市立第一中学校の出題傾向を科目別に分析（数学は大問1の計算で毎回12点分）\n・自習室は平日15:00〜22:00開放、その場で講師に質問できる\n・生徒ごとに「残り7日の日割りプラン」を作成し、毎日チェック',
          caseText: 'テスト市立第一中学校2年のAさん。前回の数学48点。1週間前から日割りプランで計算問題だけ毎日20分。今回76点。本人の言葉：「途中式を書いたら、どこで間違えたか分かった」',
          action: 'テスト対策会への参加', offer: '9/5までに申込で「テスト市立第一中学校 範囲別プリント」を進呈', length: '1800-2200',
          r1: '目標点から逆算する、テスト前の問題選び｜https://www.eisai.org/example/blogs/000000', r2: '', r3: '',
          photos: '対策会の様子、日割りプランの用紙、生徒の解き直しノート'
        }
      },
      [ARTICLE_TYPES.STORY]: {
        label: '対策会レポート（サンプル）',
        values: {
          grade: '中2', tSchools: 'テスト市立第一中学校・テスト市立第二中学校', timing: 'テスト対策会 当日',
          w1: '「対策会って参加して意味あるのかな…」',
          w2: '「何をすればいいか分からないまま当日を迎えそう」',
          w3: '「一人だと集中して勉強できるか心配」',
          h1: '範囲表を持って参加する',
          h2: '間違えた問題に付箋を貼っておく',
          h3: '終わった後、その日のうちに解き直す',
          facts: '・9/6（土）14:00〜18:00 テスト市立第一中学校向け無料テスト対策会（外部生OK、先着12名）\n・講師3名体制で科目別に質問対応\n・自習室は平日15:00〜22:00開放\n・参加者には「残り7日の日割りプラン」を作成',
          caseText: 'テスト市立第一中学校2年のAさん。最初は「何から始めるか分からない」と手が止まっていたが、範囲表を見ながら講師と一緒に計算問題から着手。終了後「思っていたより進んだ」と話していた。',
          action: '無料学習相談', offer: '', length: '1800-2200',
          r1: '', r2: '', r3: '',
          photos: '対策会の様子、講師が指導している場面、日割りプランの用紙'
        }
      },
      [ARTICLE_TYPES.AUTO]: {
        label: 'かんたんメモ（サンプル）',
        values: {
          memo: '9/6にテスト前の無料対策会やった。40人来た！前回32人だったから増えた\n中3のHくん 社会の暗記が苦手だったが、先生の説明でわかったと話していた'
        }
      }
    };

    // v0.4.0: 入力モード（mode）も記事タイプ（type）と同じく、記事入力に持たせておく
    // （buildBlogPromptV3にそのまま渡すため。実際の値は毎回 renderArticleForm() で currentInputMode に揃える）。
    function defaultArticleInput() {
      const data = { type: currentArticleType, mode: currentInputMode };
      // v0.4.1: 文字数は未選択のままだと「本文 字。」になってしまうため、フォームの既定値も
      // buildBlogPromptV3側の既定値（1,800〜2,200字・標準）に揃えておく。
      ARTICLE_FIELDS.forEach(f => { data[f.key] = f.key === 'length' ? '1800-2200' : ''; });
      return data;
    }

    function loadInitialArticleInput() {
      const draft = loadArticleDraft();
      const data = defaultArticleInput();
      if (draft && typeof draft === 'object') {
        Object.keys(data).forEach(key => {
          if (draft[key] !== undefined) data[key] = draft[key];
        });
        // v0.4.1: v0.4.0以前の下書き（型の印が無いもの）は、標準のビフォー・アフター型に切り替える。
        if (draft.typeScheme === ARTICLE_TYPE_SCHEME &&
            (draft.type === ARTICLE_TYPES.BA || draft.type === ARTICLE_TYPES.SOLVE || draft.type === ARTICLE_TYPES.STORY || draft.type === ARTICLE_TYPES.AUTO)) {
          data.type = draft.type;
        } else {
          data.type = ARTICLE_TYPES.BA;
        }
      }
      return data;
    }

    let articleInput = loadInitialArticleInput();
    // v0.4.1（Codexレビュー対応）：しっかりモードに「おまかせ」は無いので、ビフォー・アフター型に直す
    if (currentInputMode === INPUT_MODES.DETAILED && articleInput.type === ARTICLE_TYPES.AUTO) {
      articleInput.type = ARTICLE_TYPES.BA;
    }
    currentArticleType = articleInput.type;
    renderTypeButtons();

    const formContainer = createEl('div', { id: 'eisai-form-container' }, step2);
    const fieldEls = {};

    function createSelect(parent, label, options, requiredMark) {
      const wrap = createEl('div', { className: 'eisai-input-wrap' }, parent);
      const labelRow = createEl('div', { className: 'eisai-label-row' }, wrap);
      createEl('span', { className: 'eisai-label', style: { marginBottom: '0' } }, labelRow, label);
      if (requiredMark) createEl('span', { className: 'eisai-required-pill' }, labelRow, '必須');
      const select = createEl('select', { className: 'eisai-input' }, wrap);
      const blank = createEl('option', {}, select, '選択してください');
      blank.value = '';
      options.forEach(opt => {
        const value = Array.isArray(opt) ? opt[0] : opt;
        const text = Array.isArray(opt) ? opt[1] : opt;
        const optEl = createEl('option', {}, select, text);
        optEl.value = value;
      });
      return select;
    }

    function persistArticleInput() {
      saveArticleDraft(articleInput);
    }

    function renderSampleButton() {
      clearElement(sampleButtonWrap);
      if (!isTestModeEnabled()) {
        sampleButtonWrap.style.display = 'none';
        return;
      }
      const sample = ARTICLE_TEST_SAMPLES[currentArticleType];
      if (!sample) {
        sampleButtonWrap.style.display = 'none';
        return;
      }
      sampleButtonWrap.style.display = 'flex';
      const sampleBtn = createEl('button', {
        style: {
          padding: '3px 7px',
          fontSize: '10px',
          lineHeight: '1.2',
          borderRadius: '999px',
          border: '1px solid #a5b4fc',
          background: '#ffffff',
          color: '#3730a3',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          fontWeight: '700'
        }
      }, sampleButtonWrap, sample.label);
      sampleBtn.title = 'テスト用サンプルを入力';
      sampleBtn.onclick = () => {
        ARTICLE_FIELDS.forEach(field => {
          const value = sample.values[field.key] || '';
          articleInput[field.key] = value;
          const el = fieldEls[field.key];
          if (el) el.value = value;
        });
        persistArticleInput();
      };
    }

    function mountField(parent, key) {
      const field = ARTICLE_FIELDS.find(f => f.key === key);
      if (!field) return null;
      if (!isFieldVisibleInMode(field, currentInputMode)) return null;
      const requiredMark = isFieldRequiredInMode(field, currentInputMode);
      let input;
      if (field.type === 'select') {
        input = createSelect(parent, field.label, field.options, requiredMark);
      } else {
        input = createInput(parent, field.label, field.placeholder || '', !!field.isArea, requiredMark);
      }
      if (articleInput[field.key]) input.value = articleInput[field.key];
      fieldEls[field.key] = input;
      const onChange = () => {
        articleInput[field.key] = input.value;
        persistArticleInput();
        refreshDynamicUi();
      };
      input.addEventListener('input', onChange);
      input.addEventListener('change', onChange);
      return input;
    }

    function card(parent, title) {
      const el = createEl('div', { className: 'eisai-card eisai-card-soft' }, parent);
      if (title) createEl('div', { className: 'eisai-card-title' }, el, title);
      return el;
    }

    // v0.4.0: かんたんモードのメモ欄（大きめ・文字数表示・「例を入れる」）。
    function renderEasyMemoField() {
      const memoField = ARTICLE_FIELDS.find(f => f.key === 'memo');
      const wrap = createEl('div', { className: 'eisai-input-wrap' }, formContainer);
      const labelRow = createEl('div', { className: 'eisai-label-row' }, wrap);
      createEl('span', { className: 'eisai-label', style: { marginBottom: '0' } }, labelRow, '書きたいこと・教室でやったこと');
      createEl('span', { className: 'eisai-required-pill' }, labelRow, '必須');
      const memoTextarea = createEl('textarea', {
        className: 'eisai-input',
        style: { height: '160px', resize: 'vertical', lineHeight: '1.6' }
      }, wrap);
      memoTextarea.placeholder = memoField.placeholder;
      if (articleInput.memo) memoTextarea.value = articleInput.memo;
      fieldEls.memo = memoTextarea;

      const metaRow = createEl('div', {
        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }
      }, wrap);
      const memoCount = createEl('span', { style: { fontSize: '11px', color: '#9aa2af' } }, metaRow);
      const exampleBtn = createEl('button', {
        type: 'button',
        style: {
          padding: '3px 8px', fontSize: '10px', lineHeight: '1.2', borderRadius: '999px',
          border: '1px solid #cbd2de', background: '#ffffff', color: 'var(--eisai-navy)',
          cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: '700', fontFamily: 'inherit'
        }
      }, metaRow, '例を入れる');
      exampleBtn.title = 'メモ欄にサンプルの書き方を入れます';

      function updateMemoCount() {
        memoCount.textContent = `${memoTextarea.value.length}文字`;
      }
      updateMemoCount();

      const onMemoChange = () => {
        articleInput.memo = memoTextarea.value;
        persistArticleInput();
        updateMemoCount();
        refreshDynamicUi();
      };
      memoTextarea.addEventListener('input', onMemoChange);
      memoTextarea.addEventListener('change', onMemoChange);
      exampleBtn.onclick = () => {
        const sample = (ARTICLE_TEST_SAMPLES[ARTICLE_TYPES.AUTO] && ARTICLE_TEST_SAMPLES[ARTICLE_TYPES.AUTO].values.memo) || '';
        memoTextarea.value = sample;
        onMemoChange();
      };

      createEl('div', { className: 'eisai-segment-desc' }, wrap,
        '日付・人数・学校名・学年・教科・講師名・生徒の様子や一言があると、記事が濃くなります（書いたことだけが記事に出ます）。');
    }

    // v0.4.0.5: かんたんモードで「詳しく指定（任意）」がたたまれていても、入力済みの値を
    // 1行で見出しの横に出すための要約（例「学年：中2／型：悩み解決型」）。空欄の項目は出さない。
    function buildDetailedSummaryText() {
      const parts = [];
      const gradeVal = (articleInput.grade || '').trim();
      if (gradeVal) parts.push(`学年：${gradeVal}`);
      const typeLabel = ARTICLE_TYPE_LABELS[currentArticleType];
      if (typeLabel) parts.push(`型：${typeLabel}`);
      const tSchoolsVal = (articleInput.tSchools || '').trim();
      if (tSchoolsVal) parts.push(`対象校：${tSchoolsVal}`);
      const timingVal = (articleInput.timing || '').trim();
      if (timingVal) parts.push(`時期：${timingVal}`);
      const actionVal = (articleInput.action || '').trim();
      if (actionVal) parts.push(`行動：${actionVal}`);
      const lengthVal = (articleInput.length || '').trim();
      if (lengthVal) parts.push(`文字数：${lengthVal}`);
      const relatedCount = ['r1', 'r2', 'r3'].filter(k => (articleInput[k] || '').trim()).length;
      if (relatedCount) parts.push(`関連記事：${relatedCount}件`);
      const photosVal = (articleInput.photos || '').trim();
      if (photosVal) parts.push('写真：あり');
      return parts.join('／');
    }

    // v0.4.0.5: 上の要約テキストを、詳しく指定の見出し（<summary>内のspan）へ反映する。
    // <details>は閉じている間、<summary>の中身しか表示しないため、spanは<summary>の子にする。
    function updateDetailedSummaryRecap() {
      const el = document.getElementById('eisai-detail-recap');
      if (el) el.textContent = buildDetailedSummaryText();
    }

    function renderArticleForm() {
      while (formContainer.firstChild) {
        formContainer.removeChild(formContainer.firstChild);
      }
      fieldEls && Object.keys(fieldEls).forEach(k => delete fieldEls[k]);
      articleInput.type = currentArticleType;
      articleInput.mode = currentInputMode;
      selectedTypeText.textContent = ARTICLE_TYPE_LABELS[currentArticleType] || ARTICLE_TYPE_LABELS[ARTICLE_TYPES.BA];
      renderSampleButton();

      if (currentInputMode === INPUT_MODES.EASY) {
        renderEasyMemoField();

        const moreDetails = createEl('details', { className: 'eisai-details' }, formContainer);
        const moreSummary = createEl('summary', {}, moreDetails, '詳しく指定（任意）');
        createEl('span', {
          id: 'eisai-detail-recap',
          style: { fontWeight: '400', color: 'var(--eisai-text-soft)', marginLeft: '6px', fontSize: '11px' }
        }, moreSummary, buildDetailedSummaryText());
        const moreBody = createEl('div', { className: 'eisai-details-content' }, moreDetails);
        typeWrapLabel.textContent = '記事の型（標準：ビフォー・アフター）';
        moreBody.appendChild(typeWrap);
        ['grade', 'tSchools', 'timing', 'action', 'length', 'r1', 'r2', 'r3', 'photos'].forEach(key => mountField(moreBody, key));
      } else {
        typeWrapLabel.textContent = '記事の型';
        formContainer.appendChild(typeWrap);

        const whoCard = card(formContainer, '誰に');
        mountField(whoCard, 'grade');
        mountField(whoCard, 'tSchools');
        mountField(whoCard, 'timing');

        const worryCard = card(formContainer, '悩み（任意・空ならAIが問いかけで補います）');
        mountField(worryCard, 'w1');
        mountField(worryCard, 'w2');
        mountField(worryCard, 'w3');

        const homeCard = card(formContainer, '家庭でできること（任意・空ならAIが補います）');
        mountField(homeCard, 'h1');
        mountField(homeCard, 'h2');
        mountField(homeCard, 'h3');

        const factsCard = card(formContainer, '教室でやっている事実');
        mountField(factsCard, 'facts');

        const caseCard = card(formContainer, '事例・当日の様子（任意）');
        mountField(caseCard, 'caseText');

        const ctaCard = card(formContainer, 'CTA・関連記事・写真（任意）');
        mountField(ctaCard, 'action');
        mountField(ctaCard, 'offer');
        mountField(ctaCard, 'length');
        mountField(ctaCard, 'r1');
        mountField(ctaCard, 'r2');
        mountField(ctaCard, 'r3');
        mountField(ctaCard, 'photos');
      }
      refreshDynamicUi();
    }

    // v0.4.0: 確認は呼び出し元（clearInputBtnの2回押し）で行うため、ここでは無条件にクリアする。
    function clearArticleForm() {
      articleInput = defaultArticleInput();
      clearArticleDraft();
      renderArticleForm();
    }

    // v0.4.0: 下部固定アクションバーの主/副ボタン（送信）。footer(actionRow)へ配置する。
    // refreshDynamicUi()（renderArticleForm内から呼ばれる）がgenBtnを参照するため、
    // 初回のrenderArticleForm()より前に作っておく。
    const copyPromptBtn = createEl('button', { id: 'eisai-copy-prompt-btn', className: 'eisai-secondary-btn' }, actionRow, 'プロンプトをコピー');
    const genBtn = createEl('button', { id: 'eisai-gen-article-btn', className: 'eisai-primary-btn', style: { marginTop: '0' } }, actionRow, 'ChatGPTで記事を作る');
    // v0.4.0.5: 時間切れ・読み取り失敗のとき、genBtnの代わりに主ボタンとして出す「読み取り直す」。
    const rereadBtn = createEl('button', { id: 'eisai-reread-btn', className: 'eisai-primary-btn', style: { display: 'none', marginTop: '0' } }, actionRow, '読み取り直す');

    renderArticleForm();

    const copyToast = createEl('div', {
      id: 'eisai-copy-toast',
      style: {
        display: 'none',
        marginTop: '8px',
        padding: '8px 10px',
        fontSize: '12px',
        borderRadius: '6px',
        background: '#fef3c7',
        color: '#92400e',
        whiteSpace: 'pre-line',
      }
    }, content);

    // v0.4.0: 生成後（仕上げ）カード。①タイトルを選ぶ ②チェック ③要確認 ④HTMLをコピー（エディタへ）の順で縦に並べる。
    const titleSection = createEl('div', {
      id: 'eisai-title-section',
      className: 'eisai-card',
      style: { display: 'none' }
    }, content);
    createEl('div', {
      className: 'eisai-card-title'
    }, titleSection, '① タイトルを選ぶ');
    createEl('div', {
      style: { fontSize: '11px', color: 'var(--eisai-text-soft)', marginBottom: '8px', lineHeight: '1.6' }
    }, titleSection, 'SEO重視／共感・ベネフィット重視／CV（行動）重視の3案です。タップで記事のタイトルが差し替わります（33字を超えると赤で表示）。');
    createEl('div', {
      id: 'eisai-title-buttons',
      style: { display: 'flex', flexDirection: 'column', gap: '6px' }
    }, titleSection);

    // v0.4.0（design.md 5.結果パネル）：自己チェック（EISAI_CHECK）と拡張機能側の実測
    const checkSection = createEl('div', {
      id: 'eisai-check-section',
      className: 'eisai-card',
      style: { display: 'none' }
    }, content);
    createEl('div', {
      className: 'eisai-card-title'
    }, checkSection, '② チェック');
    createEl('div', {
      id: 'eisai-check-body',
      style: { fontSize: '12px', color: 'var(--eisai-text)', lineHeight: '1.8' }
    }, checkSection);

    // v0.4.0（design.md 5.結果パネル）：要確認（入力に無いかもしれない箇所）
    const unverifiedSection = createEl('div', {
      id: 'eisai-unverified-section',
      className: 'eisai-card',
      style: { display: 'none' }
    }, content);
    createEl('div', {
      id: 'eisai-unverified-title',
      className: 'eisai-card-title'
    }, unverifiedSection, '③ 要確認');
    createEl('div', {
      id: 'eisai-unverified-body',
      style: { fontSize: '12px', color: 'var(--eisai-text)', lineHeight: '1.8' }
    }, unverifiedSection);

    // v0.4.0: ④ 主ボタン「HTMLをコピー（エディタへ）」＋副「エディタを開く」は、下部固定バーの
    // 主/副ボタン枠（actionRow）を共用する（生成前はChatGPTへ送信ボタンが入っている枠と同じ場所）。
    const copyBtn = createEl('button', { id: 'eisai-copy-html-btn', className: 'eisai-primary-btn', style: { display: 'none', marginTop: '0' } }, actionRow, 'HTMLをコピー（エディタへ）');

    // v0.4.0（design.md 5.結果パネル）：コピーしたHTMLをエディタで装飾するための入口
    const openEditorBtn = createEl('button', { id: 'eisai-open-editor-btn', className: 'eisai-secondary-btn', style: { display: 'none' } }, actionRow, 'エディタを開く');
    openEditorBtn.onclick = () => {
      window.open('https://tools.eisai.org/blogs/editor-icons.html', '_blank');
    };

    // v0.4.0.4: クリップボードへの自動コピーが失敗した時だけ出す、最小限の手動コピー用テキスト欄
    // （このパネルには生成HTMLの表示欄が他に無いため、失敗時にここへ流し込んで代用する）。
    const manualCopyBox = createEl('div', {
      id: 'eisai-manual-copy-box',
      style: { display: 'none', marginTop: '8px' }
    }, content);
    createEl('div', {
      style: { fontSize: '11px', color: 'var(--eisai-text-soft)', marginBottom: '4px' }
    }, manualCopyBox, '手動コピー用：下の欄をタップ（クリック）すると全選択されます。そのままコピーしてください。');
    const manualCopyTextarea = createEl('textarea', {
      id: 'eisai-manual-copy-textarea',
      readOnly: true,
      style: {
        width: '100%',
        minHeight: '90px',
        fontSize: '11px',
        fontFamily: 'monospace',
        padding: '6px',
        borderRadius: '6px',
        border: '1px solid #d1d5db',
        boxSizing: 'border-box'
      }
    }, manualCopyBox);
    manualCopyTextarea.onclick = () => manualCopyTextarea.select();
    manualCopyTextarea.onfocus = () => manualCopyTextarea.select();

    function showManualCopyBox(text) {
      manualCopyTextarea.value = String(text || '');
      manualCopyBox.style.display = 'block';
    }
    function hideManualCopyBox() {
      manualCopyBox.style.display = 'none';
      manualCopyTextarea.value = '';
    }

    // v0.4.1.0: §8「最後の逃げ道」。合言葉（目印）が見つからない・タイムアウトした時のため、
    // ChatGPTの回答をコピーボタンでコピーして貼り付ければ、同じ後処理で完成できる欄を常設する
    // （記事・サムネ指示のどちらでも使える）。目印が無くても<h1>／[[EISAI_IMG_PROMPT]]から
    // 読み取れる（extractPastedArticleText／extractPastedThumbnailText）。
    const pasteFallbackDetails = createEl('details', {
      id: 'eisai-paste-fallback',
      className: 'eisai-details',
      style: { marginTop: '10px' }
    }, content);
    createEl('summary', {}, pasteFallbackDetails, 'うまく検出できない場合：ChatGPTの回答を貼り付けて読み込む');
    const pasteFallbackBody = createEl('div', { className: 'eisai-details-content' }, pasteFallbackDetails);
    createEl('div', {
      style: { fontSize: '11px', color: 'var(--eisai-text-soft)', marginBottom: '6px', lineHeight: '1.6' }
    }, pasteFallbackBody, 'ChatGPTの回答をコピーボタンでコピーし、下に貼り付けてください。目印が付いていなくても、記事は<h1>から、サムネ指示は[[EISAI_IMG_PROMPT]]から読み取ります。');

    let pasteFallbackMode = 'article';
    const pasteFallbackModeRow = createEl('div', { className: 'eisai-segmented' }, pasteFallbackBody);
    const pasteFallbackArticleBtn = createEl('button', { id: 'eisai-paste-fallback-article-btn', type: 'button' }, pasteFallbackModeRow, '記事として読み込む');
    const pasteFallbackThumbBtn = createEl('button', { id: 'eisai-paste-fallback-thumb-btn', type: 'button' }, pasteFallbackModeRow, 'サムネ指示として読み込む');
    function syncPasteFallbackModeButtons() {
      pasteFallbackArticleBtn.classList.toggle('eisai-segmented-active', pasteFallbackMode === 'article');
      pasteFallbackThumbBtn.classList.toggle('eisai-segmented-active', pasteFallbackMode === 'thumbnail');
    }
    pasteFallbackArticleBtn.onclick = () => { pasteFallbackMode = 'article'; syncPasteFallbackModeButtons(); };
    pasteFallbackThumbBtn.onclick = () => { pasteFallbackMode = 'thumbnail'; syncPasteFallbackModeButtons(); };
    syncPasteFallbackModeButtons();

    const pasteFallbackTextarea = createEl('textarea', {
      id: 'eisai-paste-fallback-textarea',
      placeholder: 'ここにChatGPTの回答を貼り付け…',
      style: {
        width: '100%',
        minHeight: '90px',
        fontSize: '12px',
        padding: '6px',
        borderRadius: '6px',
        border: '1px solid #d1d5db',
        boxSizing: 'border-box',
        marginBottom: '6px'
      }
    }, pasteFallbackBody);
    const pasteFallbackLoadBtn = createEl('button', { id: 'eisai-paste-fallback-load-btn', className: 'eisai-secondary-btn' }, pasteFallbackBody, '読み込む');

    // buildPanel内の他の場所（genBtn失敗時・watchThumbnailPromptタイムアウト時）から、
    // この欄を開いて案内するために使う。
    function openPasteFallback(mode) {
      pasteFallbackMode = mode === 'thumbnail' ? 'thumbnail' : 'article';
      syncPasteFallbackModeButtons();
      pasteFallbackDetails.open = true;
      if (pasteFallbackTextarea.scrollIntoView) {
        pasteFallbackTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    pasteFallbackLoadBtn.onclick = () => {
      const raw = pasteFallbackTextarea.value;
      if (!raw || !raw.trim()) {
        showToast('貼り付けるテキストが空です。');
        return;
      }
      if (pasteFallbackMode === 'thumbnail') {
        const text = extractPastedThumbnailText(raw, lastImagePromptRequestId);
        const promptText = extractImagePromptText(text);
        if (!promptText) {
          showToast('サムネイル指示（[[EISAI_IMG_PROMPT]]）が見つかりませんでした。貼り付けた内容をご確認ください。');
          return;
        }
        lastImagePromptText = promptText;
        lastImageRawResponseText = text;
        isGeneratingPrompt = false;
        imgExecBtn.style.display = 'block';
        if (imgExecBtn.parentElement) imgExecBtn.parentElement.style.display = 'block';
        statusDiv.textContent = '✅ 貼り付けたテキストからサムネイル指示を読み込みました。「このプロンプトで画像を生成する」を押してください。';
        statusDiv.classList.add('show');
        syncFooterButtons();
        pasteFallbackTextarea.value = '';
      } else {
        const text = extractPastedArticleText(raw, lastArticleRequestId);
        const ok = finalizeBlogFromText(text, statusDiv, copyBtn, buildArticleFactsSummary);
        setFooterFailed(!ok);
        if (ok) pasteFallbackTextarea.value = '';
      }
    };

    // v0.4.0: サムネイル（3ステップの番号付きカード：1 設定 → 2 画像用の指示を作る → 3 画像を生成する）
    const imgSection = createEl('div', {
      id: 'eisai-image-section',
      className: 'eisai-card',
      style: { display: 'none' }
    }, content);
    createEl('div', { className: 'eisai-card-title' }, imgSection, 'サムネイル画像生成');

    // 参照画像アップロードの案内（全記事タイプ共通で常時表示）
    createEl('div', {
      style: {
        fontSize: '12px',
        color: '#92400e',
        backgroundColor: '#fffbeb',
        padding: '8px',
        borderRadius: '6px',
        marginBottom: '10px',
        border: '1px solid #fde68a',
        lineHeight: '1.6',
        fontWeight: 'bold'
      }
    }, imgSection, '参照してほしい写真（生徒のノート・答案・教室の様子・講師や室長の人物写真など）があれば、画像生成前にこのチャットへアップロード（添付）してください。アップロードされた写真は画像のベースとして優先的に使われます。');

    const thumbStep1 = createEl('div', { className: 'eisai-thumb-step' }, imgSection);
    const thumbStep1Head = createEl('div', { className: 'eisai-thumb-step-head' }, thumbStep1);
    createEl('div', { className: 'eisai-thumb-step-num' }, thumbStep1Head, '1');
    createEl('div', { className: 'eisai-thumb-step-title' }, thumbStep1Head, '設定（タイトル・文字の強さ・色）');

    // サムネイル型はブログ内容から自動判断・見た目は実写固定のため、選択UIは廃止
    createEl('div', {
      style: {
        fontSize: '12px',
        color: '#374151',
        backgroundColor: '#f8fafc',
        padding: '8px',
        borderRadius: '6px',
        marginBottom: '8px',
        border: '1px solid #e5e7eb',
        lineHeight: '1.6'
      }
    }, thumbStep1, '画像は実写スタイルで生成されます。サムネイルの構図や訴求の方向性はブログ記事の内容から自動で判断されます。');

    // サムネイルのメインにするタイトルを3案から選択（生成完了後にlastTitleCandidatesから充填）
    createEl('label', { className: 'eisai-label' }, thumbStep1, 'サムネイルのメインにするタイトル');
    const thumbTitleSelect = createEl('select', {
      className: 'eisai-input',
      style: { width: '100%', marginBottom: '8px' }
    }, thumbStep1);
    function populateThumbnailTitleOptions() {
      while (thumbTitleSelect.firstChild) thumbTitleSelect.removeChild(thumbTitleSelect.firstChild);
      const cands = (lastTitleCandidates && lastTitleCandidates.length)
        ? lastTitleCandidates
        : (lastBlogTitle ? [lastBlogTitle] : []);
      const labels = ['① SEO重視', '② 共感重視', '③ CV重視'];
      if (!cands.length) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '(タイトル未取得：本文から自動判断)';
        thumbTitleSelect.appendChild(opt);
        return;
      }
      cands.forEach((t, i) => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = (labels[i] || ('案' + (i + 1))) + '：' + t;
        thumbTitleSelect.appendChild(opt);
      });
      // 本文で選んだタイトル（現在のh1）があれば初期選択を合わせる
      if (lastBlogTitle && cands.indexOf(lastBlogTitle) >= 0) {
        thumbTitleSelect.value = lastBlogTitle;
      }
    }

    createEl('label', { className: 'eisai-label' }, thumbStep1, '文字の強さを選択');
    const textImpactSelect = createEl('select', {
      className: 'eisai-input',
      style: { width: '100%', marginBottom: '8px' }
    }, thumbStep1);
    Object.keys(TEXT_IMPACT_OPTIONS).forEach(label => {
      const opt = document.createElement('option');
      opt.value = label;
      opt.textContent = label;
      textImpactSelect.appendChild(opt);
    });
    textImpactSelect.value = '強め';

    createEl('label', { className: 'eisai-label' }, thumbStep1, 'メインカラーを選択');
    const mainColorSelect = createEl('select', {
      className: 'eisai-input',
      style: { width: '100%', marginBottom: '8px' }
    }, thumbStep1);
    const omakaseMainOpt = document.createElement('option');
    omakaseMainOpt.value = 'お任せ';
    omakaseMainOpt.textContent = 'お任せ';
    mainColorSelect.appendChild(omakaseMainOpt);
    Object.keys(COLOR_STYLES).forEach(label => {
      const opt = document.createElement('option');
      opt.value = label;
      opt.textContent = label;
      mainColorSelect.appendChild(opt);
    });
    mainColorSelect.value = 'お任せ';

    createEl('label', { className: 'eisai-label' }, thumbStep1, 'サブカラーを選択');
    const subColorSelect = createEl('select', {
      className: 'eisai-input',
      style: { width: '100%', marginBottom: '8px' }
    }, thumbStep1);
    const omakaseSubOpt = document.createElement('option');
    omakaseSubOpt.value = 'お任せ';
    omakaseSubOpt.textContent = 'お任せ';
    subColorSelect.appendChild(omakaseSubOpt);
    Object.keys(COLOR_STYLES).forEach(label => {
      const opt = document.createElement('option');
      opt.value = label;
      opt.textContent = label;
      subColorSelect.appendChild(opt);
    });
    subColorSelect.value = 'お任せ';

    const thumbTextDetails = createEl('details', { className: 'eisai-details' }, thumbStep1);
    createEl('summary', {}, thumbTextDetails, 'サムネイルテキスト設定（任意）');
    const thumbTextBody = createEl('div', { className: 'eisai-details-content' }, thumbTextDetails);

    const toggleContainer = createEl('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        marginBottom: '12px',
        padding: '8px',
        backgroundColor: '#f8fafc',
        borderRadius: '6px',
        border: '1px solid #e2e8f0'
      }
    }, thumbTextBody);

    const toggleSwitch = createEl('input', {
      type: 'checkbox',
      id: 'omakase-toggle',
      checked: true,
      style: { marginRight: '8px', width: '16px', height: '16px', cursor: 'pointer' }
    }, toggleContainer);

    createEl('label', {
      htmlFor: 'omakase-toggle',
      style: { fontSize: '13px', fontWeight: '600', color: '#374151', cursor: 'pointer', userSelect: 'none' }
    }, toggleContainer, 'おまかせモード（ブログから自動抽出）');

    const textInputsContainer = createEl('div', {
      id: 'text-inputs-container',
      style: { display: 'none' }
    }, thumbTextBody);

    const mainCatchInput = createInput(textInputsContainer, 'メインキャッチフレーズ（必須）', '例：勉強が楽しくなる！', true);
    const subCatchInput = createInput(textInputsContainer, 'サブキャッチフレーズ（任意）', '例：個別指導で成績アップ', false);
    const pointsInput = createInput(textInputsContainer, 'ポイント・特徴（任意）', '例：安心のサポート体制', false);

    toggleSwitch.onchange = () => {
      textInputsContainer.style.display = toggleSwitch.checked ? 'none' : 'block';
    };

    const thumbStep2 = createEl('div', { className: 'eisai-thumb-step' }, imgSection);
    const thumbStep2Head = createEl('div', { className: 'eisai-thumb-step-head' }, thumbStep2);
    createEl('div', { className: 'eisai-thumb-step-num' }, thumbStep2Head, '2');
    createEl('div', { className: 'eisai-thumb-step-title' }, thumbStep2Head, '画像用の指示を作る');
    const imgGenBtn = createEl('button', {
      id: 'eisai-gen-btn',
      className: 'eisai-primary-btn',
      style: { marginTop: '0' }
    }, thumbStep2, '画像用の指示を作る');

    const thumbStep3 = createEl('div', { className: 'eisai-thumb-step', style: { marginBottom: '0' } }, imgSection);
    const thumbStep3Head = createEl('div', { className: 'eisai-thumb-step-head' }, thumbStep3);
    createEl('div', { className: 'eisai-thumb-step-num' }, thumbStep3Head, '3');
    createEl('div', { className: 'eisai-thumb-step-title' }, thumbStep3Head, '画像を生成する');
    // v0.4.0: imgExecBtnは②の指示作成が終わるまでdisplay:noneのまま（既存ロジックを維持）。
    // その間、カードが空欄に見えないよう案内文を出す（imgExecBtnのstyle変化だけを見て
    // 表示を切り替える見た目専用の処理で、②③の判定・タイミング自体は変えない）。
    const thumbStep3Placeholder = createEl('div', {
      style: { fontSize: '12px', color: 'var(--eisai-text-soft)' }
    }, thumbStep3, '②の指示づくりが終わると、ここに生成ボタンが表示されます。');
    const imgExecBtn = createEl('button', {
      id: 'eisai-img-exec-btn',
      className: 'eisai-secondary-btn',
      style: { display: 'none' }
    }, thumbStep3, 'このプロンプトで画像を生成する');
    function syncThumbStep3Placeholder() {
      thumbStep3Placeholder.style.display = (imgExecBtn.style.display === 'none' || !imgExecBtn.style.display) ? 'block' : 'none';
    }
    syncThumbStep3Placeholder();
    new MutationObserver(syncThumbStep3Placeholder).observe(imgExecBtn, { attributes: true, attributeFilter: ['style'] });

    // v0.4.0.5: 時間切れ・読み取り失敗のとき、主ボタンを「読み取り直す」に切り替えるための状態。
    // 生成成功・新しい送信の開始でfalseに戻す。
    let footerFailedState = false;

    // v0.4.0: 主/副ボタンは常に片方の組だけを見せる（送信前=ChatGPTで記事を作る／プロンプトをコピー、
    // 失敗時=読み取り直す／プロンプトをコピー（強調）、
    // 生成後=HTMLをコピー（エディタへ）／エディタを開く）。imgExecBtn/imgGenBtnはサムネカード内の別枠。
    function syncFooterButtons() {
      const isGenerated = copyBtn.style.display === 'block';
      if (isGenerated) footerFailedState = false;
      const isFailed = footerFailedState && !isGenerated;
      genBtn.style.display = (isGenerated || isFailed) ? 'none' : '';
      rereadBtn.style.display = isFailed ? '' : 'none';
      copyPromptBtn.style.display = isGenerated ? 'none' : '';
      openEditorBtn.style.display = isGenerated ? '' : 'none';
      refreshDynamicUi();
    }

    // v0.4.0.5: 時間切れ・読み取り失敗を主ボタン「読み取り直す」に反映し、
    // 副ボタン「プロンプトをコピー」を強調する。
    function setFooterFailed(failed) {
      footerFailedState = !!failed;
      syncFooterButtons();
      if (footerFailedState) {
        promotePromptCopyButton();
        // v0.4.1.0: 失敗・タイムアウト時は「貼り付けて読み込む」欄を開いて案内する（§8）。
        openPasteFallback('article');
      }
    }

    function hideBlogCopyButton() {
      copyBtn.style.display = 'none';
      syncFooterButtons();
    }

    imgGenBtn.onclick = async () => {
      // サムネイル型はブログ内容から自動判断（おまかせ固定）、見た目は実写固定
      const thumbnailType = 'おまかせ';
      const style = '実写';
      const textImpact = textImpactSelect.value;
      const mainColor = mainColorSelect.value;
      const subColor = subColorSelect.value;

      const isOmakase = toggleSwitch.checked;
      const mainCatch = isOmakase ? 'おまかせ' : (mainCatchInput.value.trim() || 'おまかせ');
      const subCatch = isOmakase ? 'おまかせ' : (subCatchInput.value.trim() || 'おまかせ');
      const points = isOmakase ? 'おまかせ' : (pointsInput.value.trim() || 'おまかせ');
      restoreGeneratedContext();
      // 画像プロンプトへ渡す本文からは EISAI_TITLES コメントを除去（不可視だが混入回避）
      const sourceBlogHtml = (lastBlogHtml || '').replace(/<!--\s*EISAI_TITLES[\s\S]*?-->/gi, '').trim();
      // ユーザーが選んだ「サムネイルのメインにするタイトル」を優先（未選択時はh1/本文タイトル）
      const chosenThumbTitle = (thumbTitleSelect && thumbTitleSelect.value) ? thumbTitleSelect.value.trim() : '';
      const sourceBlogTitle = chosenThumbTitle || lastBlogTitle || extractH1Text(sourceBlogHtml);
      const sourceArticleFacts = lastArticleFacts || '';
      // v0.4.0.4: [[EISAI_IMG_TEXT]]が取れなかった時のフォールバック用に、今回使うタイトルを保存しておく
      lastThumbTitleForImage = sourceBlogTitle;

      if (!sourceBlogHtml) {
        showToast('サムネイル作成に使うブログ本文が見つかりませんでした。\n先にブログ生成を完了してから、もう一度お試しください。');
        return;
      }

      const thumbnailRequestId = makeRequestId();
      // v0.4.1.6: サムネ生成プロンプトの組み立てをbuildThumbnailPromptRequest（純粋関数）に
      // 切り出した。記事HTMLを丸ごと入れていた不具合の修正（buildThumbnailArticleSummaryへの
      // 軽量化）を含む、依頼文の組み立てそのものをNodeの単体テストで確認できるようにするため。
      const promptRequest = buildThumbnailPromptRequest({
        thumbnailType,
        style,
        textImpact,
        mainColor,
        subColor,
        mainCatch,
        subCatch,
        points,
        sourceBlogHtml,
        sourceBlogTitle,
        sourceArticleFacts,
        requestId: thumbnailRequestId,
        colorStyles: COLOR_STYLES,
        thumbnailTypeOptions: THUMBNAIL_TYPE_OPTIONS,
        visualExpressionOptions: VISUAL_EXPRESSION_OPTIONS,
        textImpactOptions: TEXT_IMPACT_OPTIONS,
        artDirections: THUMBNAIL_ART_DIRECTIONS,
        layoutVariants: THUMBNAIL_LAYOUT_VARIANTS
      });

      statusDiv.textContent = '🎯 画像生成用プロンプトを作成しています…待っている間、別のタブを見ていて大丈夫です。';
      statusDiv.classList.add('show');
      hideBlogCopyButton();
      imgExecBtn.style.display = 'none';
      syncFooterButtons();

      isGeneratingPrompt = true;
      lastImagePromptRequestId = '';
      lastImagePromptText = '';
      lastImageRawResponseText = '';
      thumbnailImageDetected = false;

      // v0.4.1.6: imgGenBtn（サムネ指示）は、送信〜完了検知の間で想定外の例外が起きても
      // isGeneratingPromptがtrueのまま固まらないよう、try/catchで囲む（記事側と同じ考え方）。
      try {
        // v0.4.1.6: 送信の成否にかかわらず、依頼番号を発行した直後に完成監視を先に（並行して）
        // 始める（genBtn.onclickと同じ理由。ChromeのIntensive Throttling等でsendAndConfirm側の
        // 待ちが長く伸びても、人が手で送信した場合や、実は送信自体は届いていた場合を拾える）。
        watchThumbnailPrompt(thumbnailRequestId, statusDiv, imgExecBtn);

        const { confirmed } = await sendAndConfirm(promptRequest, thumbnailRequestId, statusDiv, {
          sendingHintText: '🎯 送信しています…（ChatGPTの画面が後ろにあると少し時間がかかります）',
          retryText: '🎯 送信を確認できなかったため、もう一度送信します…'
        });

        if (!confirmed) {
          // v0.4.1.6: 監視は上で既に始まっているため止めない（isGeneratingPromptもtrueのまま。
          // 手動送信・実は届いていた場合を拾えるように）。失敗の案内だけ出す。
          statusDiv.textContent = '⚠️ サムネ指示の送信を確認できませんでした。ChatGPTの画面をご確認のうえ、手動で送信してください（送信されれば自動で続きから進みます）。';
          statusDiv.classList.add('show');
        }
      } catch (e) {
        isGeneratingPrompt = false;
        console.error('[Eisai] サムネ指示の送信・完了検知中に予期しないエラーが発生しました:', e);
        statusDiv.textContent = `⚠️ サムネ指示の送信中に予期しないエラーが発生しました（失敗・${e && e.message ? e.message : e}）。もう一度「画像用の指示を作る」を押してください。`;
        statusDiv.classList.add('show');
      }
    };

    // v0.4.0.5: 送信前バリデーション（未入力の欄を具体的に列挙する）。
    // 教室情報の必須判定は単一の定義元（REQUIRED_CLASSROOM_FIELDS）を参照する。
    function collectMissingLabels() {
      const missing = collectMissingClassroomLabels(getSetting());
      getRequiredFields().forEach(field => {
        if (!(articleInput[field.key] || '').trim()) missing.push(field.shortLabel || field.label);
      });
      return missing;
    }

    function focusFirstMissingArticleField() {
      const firstMissingField = getRequiredFields().find(field => !(articleInput[field.key] || '').trim());
      if (firstMissingField) {
        const el = fieldEls[firstMissingField.key];
        if (el && el.focus) el.focus();
        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    // v0.4.0: プロトタイプv3のbuildPrompt()（buildBlogPromptV3として移植）に、
    // 教室設定(getSetting())と記事入力(articleInput)を渡すだけ。プロンプト文言はここでは組み立てない。
    function buildPromptForCurrentInput(requestId) {
      const info = getSetting();
      let ctaUrl = (info.url || '').trim();
      if (ctaUrl && !/^https?:\/\//i.test(ctaUrl)) ctaUrl = 'https://' + ctaUrl;
      const classroomInfo = { ...info, url: ctaUrl };
      return buildBlogPromptV3(articleInput, classroomInfo, requestId);
    }

    // サムネイル生成プロンプト（lastArticleFacts）用の、記事入力の簡易テキスト化。
    function buildArticleFactsSummary() {
      let text = '';
      ARTICLE_FIELDS.forEach(field => {
        const val = (articleInput[field.key] || '').trim();
        if (val) text += `${field.label}: ${val}\n\n`;
      });
      return text;
    }

    // v0.4.0: 生成中は生成系ボタンを無効化し、二重送信を防ぐ（完了・失敗いずれでも戻す）
    function setGenerateBusy(busy) {
      genBtn.disabled = busy;
      genBtn.style.opacity = busy ? '0.6' : '1';
      genBtn.style.cursor = busy ? 'not-allowed' : 'pointer';
      rereadBtn.disabled = busy;
      rereadBtn.style.opacity = busy ? '0.6' : '1';
      rereadBtn.style.cursor = busy ? 'not-allowed' : 'pointer';
      refreshDynamicUi();
    }

    // v0.4.0: 送信失敗時、逃げ道の「プロンプトをコピー」ボタンへ注意を引く
    function promotePromptCopyButton() {
      copyPromptBtn.classList.add('eisai-btn-pulse');
      setTimeout(() => copyPromptBtn.classList.remove('eisai-btn-pulse'), 6000);
    }

    genBtn.onclick = async () => {
      if (genBtn.disabled) return;

      const missing = collectMissingLabels();
      if (missing.length) {
        showToast(`次の項目を入力してください（あと${missing.length}件）\n・${missing.join('\n・')}`);
        focusFirstMissingArticleField();
        return;
      }

      const articleRequestId = makeRequestId();
      lastArticleRequestId = articleRequestId;
      const prompt = buildPromptForCurrentInput(articleRequestId);
      const formContent = buildArticleFactsSummary();
      lastArticleFacts = formContent;
      lastBlogTitle = '';
      lastBlogHtml = '';
      setGeneratedContext({
        articleFacts: formContent,
        blogTitle: '',
        blogHtml: ''
      });

      const input = getChatInput();
      if (!input) {
        showToast('ChatGPTの入力欄が見つかりませんでした');
        return;
      }

      setGenerateBusy(true);
      statusDiv.textContent = '📨 送信中…';
      statusDiv.classList.add('show');
      // v0.4.0.5: 新しい送信を始めるので、前回の「読み取り直す」失敗状態は解除する
      footerFailedState = false;
      hideBlogCopyButton();
      imgSection.style.display = 'none';
      imgExecBtn.style.display = 'none';
      syncFooterButtons();
      lastBlogHtml = '';
      lastTitleCandidates = [];
      lastEisaiCheck = null;
      lastArticleMetrics = null;
      lastUnverifiedClaims = [];
      const titleSectionReset = document.getElementById('eisai-title-section');
      if (titleSectionReset) titleSectionReset.style.display = 'none';
      const checkSectionReset = document.getElementById('eisai-check-section');
      if (checkSectionReset) checkSectionReset.style.display = 'none';
      const unverifiedSectionReset = document.getElementById('eisai-unverified-section');
      if (unverifiedSectionReset) unverifiedSectionReset.style.display = 'none';

      // v0.4.0: 送信〜完了検知の間で想定外の例外が起きても、genBtnが無効のまま固まらないように
      // try/catchで囲み、パネルにも理由を出す（コンソールだけのサイレント失敗をなくす）。
      try {
        // 入力欄をアコーディオンで畳み、状態・タイトル・画像生成が見えるようにする
        collapseInputForResult();
        setTimeout(() => {
          if (statusDiv.scrollIntoView) statusDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 60);

        // v0.4.1.6: 2026-09-29に実機で確認：send()側の待ちがChromeのIntensive Throttling等で
        // 長く伸びると、その完了（sendAndConfirmのawait）を待ってから完成監視を始める作りでは、
        // 人が手で送信した場合や、実は送信自体は届いていた場合を拾えない。依頼番号を発行した
        // 直後、送信の成否にかかわらず完成監視を先に（並行して）始める。監視には8分（見えている
        // 時間）のタイムアウトがあるため、送信が最終的に失敗のままでも、いずれonSettledで
        // setGenerateBusy(false)される。
        watchBlogResponseAndEnableCopy(articleRequestId, statusDiv, copyBtn, (ok) => {
          setGenerateBusy(false);
          // v0.4.0.5: 時間切れ・読み取り失敗のときは主ボタンを「読み取り直す」に切り替える
          setFooterFailed(!ok);
        }, buildArticleFactsSummary);

        const { confirmed } = await sendAndConfirm(prompt, articleRequestId, statusDiv);

        if (!confirmed) {
          // v0.4.1.6: 監視は上で既に始まっているため止めない（手動送信・実は届いていた場合を
          // 拾えるように）。ここでは失敗の案内だけ出す。setGenerateBusy(false)は呼ばない：
          // 監視側のonSettled（完成 or 8分タイムアウト）で必ず呼ばれる。
          statusDiv.textContent = '⚠️ ChatGPTへの送信を確認できませんでした。ChatGPTの画面をご確認のうえ、手動で送信してください（送信されれば自動で続きから進みます）。うまくいかない場合は下の「📋 プロンプトをコピー」もお使いください。';
          statusDiv.classList.add('show');
          promotePromptCopyButton();
          return;
        }

        statusDiv.textContent = '📨 ブログ生成用プロンプトを送信しました。生成が完了したら、下にコピー用ボタンが出ます。待っている間、別のタブを見ていて大丈夫です。';
        statusDiv.classList.add('show');
      } catch (e) {
        console.error('[Eisai] 送信・完了検知中に予期しないエラーが発生しました:', e);
        statusDiv.textContent = `⚠️ 予期しないエラーが発生しました（失敗・${e && e.message ? e.message : e}）。下の「📋 プロンプトをコピー」からChatGPTの入力欄に貼って、もう一度送信してください。`;
        statusDiv.classList.add('show');
        promotePromptCopyButton();
        setGenerateBusy(false);
      }
    };

    // v0.4.0: 自動送信が壊れた時の逃げ道。コピー後、手動でChatGPTに貼って送信してもらう。
    copyPromptBtn.onclick = async () => {
      const missing = collectMissingLabels();
      if (missing.length) {
        showToast(`次の項目を入力してください（あと${missing.length}件）\n・${missing.join('\n・')}`);
        focusFirstMissingArticleField();
        return;
      }

      const prompt = buildPromptForCurrentInput();
      if (await writeClipboardWithTimeout(prompt)) {
        statusDiv.textContent = '📋 プロンプトをコピーしました。ChatGPTの入力欄に貼って送信してください。';
        statusDiv.classList.add('show');
      } else {
        showToast('プロンプトのコピーに失敗しました。ChatGPTの画面を一度クリックしてから、もう一度押してください。');
      }
    };

    // v0.4.1.0: 時間切れ・読み取り失敗のときの再読み込み。新方式（合言葉）では、最後に送信した
    // 依頼番号（lastArticleRequestId）で目印をもう一度探す。終了目印がまだ見つからない場合だけ、
    // 目印無しでも読める保険（main全体から最後の閉じた<h1>…</h1>を探す）にフォールバックする。
    rereadBtn.onclick = async () => {
      if (rereadBtn.disabled) return;
      statusDiv.textContent = '🔎 ChatGPTの最後の回答を読み取っています…';
      statusDiv.classList.add('show');

      let articleText = '';
      if (lastArticleRequestId) {
        const state = getMarkerState(lastArticleRequestId);
        if (state.hasEnd) articleText = state.text;
      }
      if (!articleText) {
        articleText = extractArticleFallbackFromMainText();
      }
      // v0.4.0.9: 要確認の比較用テキストは、記憶していたlastArticleFactsではなく、
      // 呼び出し時点の画面の入力（＝保存済みドラフト）から毎回作る。ページ再読み込み後は
      // lastArticleFactsが空のままになるため、これをbuildArticleFactsSummaryに置き換える。
      const ok = finalizeBlogFromText(articleText, statusDiv, copyBtn, buildArticleFactsSummary);
      setFooterFailed(!ok);
    };


    copyBtn.onclick = async () => {
      if (!lastBlogHtml) {
        showToast('コピーできるブログHTMLがまだありません。\nまずは「ChatGPTで記事を作る」を実行してください。');
        return;
      }

      // v0.4.0.4: クリップボードへの書き込みが失敗しても、サムネ欄を開く処理とステップ更新は
      // 必ず行う（下で続行する）。失敗時は手動コピー用の欄を出す。
      const copyOk = await writeClipboardWithTimeout(lastBlogHtml);

      const toast = document.getElementById('eisai-copy-toast');
      if (toast) {
        toast.style.display = 'block';
        if (copyOk) {
          toast.textContent = '✅ HTMLをコピーしました。\n英才ブログエディタの原稿欄に貼り付けてください。';
          setTimeout(() => { toast.style.display = 'none'; }, 2000);
        } else {
          toast.textContent = '⚠️ コピーできませんでした。下のHTML表示から手動でコピーしてください。';
          // 手動コピーへの案内なので、自動では消さない（次のコピー成功時に隠れる）
        }
      }

      if (copyOk) {
        hideManualCopyBox();
      } else {
        showManualCopyBox(lastBlogHtml);
      }

      imgSection.style.display = 'block';
      populateThumbnailTitleOptions();
      refreshDynamicUi();
      setTimeout(() => {
        const thumbSection = document.getElementById('eisai-image-section');
        if (thumbSection) {
          thumbSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);

      const sendImgPromptBtn = document.getElementById('eisai-gen-btn');
      if (sendImgPromptBtn) {
        sendImgPromptBtn.disabled = false;
        sendImgPromptBtn.style.opacity = '1';
      }
    };

    imgExecBtn.onclick = async () => {
      const rawResponseText = lastImageRawResponseText;
      const imgPrompt = lastImagePromptText || extractImagePromptText(rawResponseText);
      if (!imgPrompt) {
        showToast('ChatGPTの出力が見つかりませんでした。サムネイル指示の生成が完了してからもう一度試してください。');
        return;
      }

      // v0.4.1.7: コピーはおまけ。待たずに送信へ進む（焦点が無い時に返ってこないことがあるため）
      writeClipboardWithTimeout(imgPrompt).then(ok => { if (!ok) console.warn('[Eisai] プロンプトのコピーはできませんでしたが、送信は続行します'); });

      const input = getChatInput();
      if (!input) {
        showToast('ChatGPTの入力欄が見つかりませんでした');
        return;
      }

      // v0.4.0.4: [[EISAI_IMG_TEXT]]行から、画像に描き込む文字（メイン・サブ）を取り出し、
      // 「画像の中に必ず描き込む」という強い指示として先頭に付ける。取れなければ選ばれたタイトルで代用する。
      const imgTextMeta = extractImgTextMeta(rawResponseText);
      const forcedTextInstruction = buildForcedImageTextInstruction(imgTextMeta, lastThumbTitleForImage || lastBlogTitle);

      // v0.4.1.0: 画像は合言葉（開始・終了の目印）を出力できないため、依頼番号の行だけを付ける
      // （失敗文言の判定を今回の依頼より後のテキストに絞るため。§6参照）。
      const imageRequestId = makeRequestId();

      // ★ ChatGPTに「説明文」だけを送ると生成されず復唱されてしまうため、
      //   画像生成の明確な指示を必ず前置きして送る（画像ツールを起動させる）
      const generateMessage = buildImageGenerateMessage(imageRequestId, forcedTextInstruction, imgPrompt);

      // v0.4.1.0: 画像そのものの完成検知のため、送信前のmain内の画像一覧をベースラインとして
      // 記録しておく（役割属性・ターン一覧ではなく、img要素そのものを見る）。
      const baselineImages = collectMainImages();

      // v0.4.1.6: 画像生成も、送信〜完了検知の間で想定外の例外が起きてもボタンが固まらないよう
      // try/catchで囲む（記事・サムネ指示と同じ考え方）。
      try {
        // v0.4.1.6: 送信の成否にかかわらず、依頼番号を発行した直後に完成監視を先に（並行して）
        // 始める（他2か所と同じ理由）。画像（naturalWidth>500のimg）が現れたら、完了メッセージに
        // 切り替え、サムネのステップ表示を完了扱いにする。8分（見えている時間）待って現れなければ
        // タイムアウト表示。
        thumbnailImageDetected = false;
        refreshDynamicUi();
        watchGeneratedImage(imageRequestId, baselineImages, statusDiv, () => {
          thumbnailImageDetected = true;
          refreshDynamicUi();
        });

        const { confirmed } = await sendAndConfirm(generateMessage, imageRequestId, statusDiv, {
          sendingHintText: '🖼 送信しています…（ChatGPTの画面が後ろにあると少し時間がかかります）',
          retryText: '🖼 送信を確認できなかったため、もう一度送信します…'
        });

        if (!confirmed) {
          // v0.4.1.6: 監視は上で既に始まっているため止めない（手動送信・実は届いていた場合を
          // 拾えるように）。失敗の案内だけ出す。ボタンは隠さず、再試行できるようにする（既存どおり）。
          statusDiv.textContent = '⚠️ 画像生成の依頼の送信を確認できませんでした。ChatGPTの画面をご確認のうえ、手動で送信してください（送信されれば自動で続きから進みます）。うまくいかない場合は、もう一度「このプロンプトで画像を生成する」を押してください。';
          statusDiv.classList.add('show');
          return;
        }

        // ★ 画像生成はChatGPT側の混雑で数分かかったり、まれに失敗することがある。
        //   失敗時にすぐ押し直せるよう、ボタンは隠さず表示したままにする。
        statusDiv.textContent = '🖼 画像生成を依頼しました。ChatGPTが画像を生成します（数分かかることがあります）。待っている間、別のタブを見ていて大丈夫です。\n進まない・「生成できませんでした」と出た場合は、もう一度このボタンを押すと生成されることが多いです。';
        statusDiv.classList.add('show');
        // v0.4.0.5: 2回目以降のクリックは「作り直す」であることが分かるようにボタン名を切り替える
        imgExecBtn.textContent = 'もう一度作る';
        syncFooterButtons();
      } catch (e) {
        console.error('[Eisai] 画像生成の送信・完了検知中に予期しないエラーが発生しました:', e);
        statusDiv.textContent = `⚠️ 画像生成の依頼中に予期しないエラーが発生しました（失敗・${e && e.message ? e.message : e}）。もう一度「このプロンプトで画像を生成する」を押してください。`;
        statusDiv.classList.add('show');
      }
    };

    // v0.4.0: ここまででパネルの部品が全て揃ったので、ステップ表示・不足項目案内の判定を有効化する。
    dynamicUiReady = true;
    refreshDynamicUi();
  }

  // =========================================================
  // 10. ChatGPT画面での起動判定
  // =========================================================
  function getChatRoutePath() {
    const path = location.pathname || '/';
    const localeMatch = path.match(/^\/[a-z]{2}(?:-[a-z]{2})?(\/.*)?$/i);
    return localeMatch ? (localeMatch[1] || '/') : path;
  }

  function isNewChatPage() {
    const path = getChatRoutePath();
    return path === '/' || path.startsWith('/c/') || path.startsWith('/g/');
  }

  function ensureButton() {
    if (!isNewChatPage()) {
      const exist = document.getElementById(BTN_ID);
      if (exist) exist.remove();
      setChatAvoidance(false);
      return;
    }

    const panel = document.getElementById(TOOL_ID);
    if (panel) {
      removeLauncherButton();
      syncChatAvoidance(panel);
      return;
    }

    if (document.getElementById(BTN_ID)) return;

    const btn = createEl('button', {
      id: BTN_ID,
      style: {
        position: 'fixed',
        top: '50%',
        left: '12px',
        transform: 'translateY(-50%)',
        zIndex: 2147483647,
        width: '60px',
        height: '60px',
        background: '#F5811F',
        borderRadius: '50%',
        cursor: 'pointer',
        border: '2px solid #12294D',
        boxShadow: '0 4px 12px rgba(245, 129, 31, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0',
        transition: 'all 0.2s ease'
      }
    }, document.body);

    btn.title = '英才ブログ生成ツールを開く';

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '32');
    svg.setAttribute('height', '32');
    svg.setAttribute('viewBox', '0 0 32 32');

    const pen = document.createElementNS(svgNS, 'path');
    pen.setAttribute('d', 'M10 20.5 L19.5 11 C20.2 10.3 21.3 10.3 22 11 C22.7 11.7 22.7 12.8 22 13.5 L12.5 23 L9 24 L10 20.5 Z');
    pen.setAttribute('fill', '#ffffff');

    const tip = document.createElementNS(svgNS, 'path');
    tip.setAttribute('d', 'M9 24 L10.8 23.8 L9.2 22.2 Z');
    tip.setAttribute('fill', '#ffffff');

    const star = document.createElementNS(svgNS, 'path');
    star.setAttribute('d', 'M19.5 8.5 L20.5 7 L21.5 8.5 L23 9.5 L21.5 10.5 L20.5 12 L19.5 10.5 L18 9.5 Z');
    star.setAttribute('fill', '#ffffff');

    svg.appendChild(pen);
    svg.appendChild(tip);
    svg.appendChild(star);
    btn.appendChild(svg);

    btn.onmouseover = () => {
      btn.style.transform = 'translateY(-50%) scale(1.08)';
      btn.style.boxShadow = '0 6px 18px rgba(245, 129, 31, 0.5)';
      btn.style.background = '#d96e0f';
    };
    btn.onmouseout = () => {
      btn.style.transform = 'translateY(-50%) scale(1)';
      btn.style.boxShadow = '0 4px 12px rgba(245, 129, 31, 0.4)';
      btn.style.background = '#F5811F';
    };

    btn.classList.add('eisai-btn-pulse');
    setTimeout(() => btn.classList.remove('eisai-btn-pulse'), 6000);

    btn.onclick = () => {
      buildPanel({ forceOpen: true });
    };
  }

  setInterval(ensureButton, 1000);
})();
