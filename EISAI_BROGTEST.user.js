// ==UserScript==
// @name         EISAI_BROGTEST
// @namespace    https://github.com/honbueisai/blog-tools/test
// @version      0.56.92
// @description  英才ブログ生成ツール テスト版（現場リアリティ入力検証）
// @author       Yuan
// @match        https://gemini.google.com/*
// @updateURL    https://github.com/honbueisai/blog-tools/raw/refs/heads/feature/eisai-blogtest-reality-form/EISAI_BROGTEST.user.js
// @downloadURL  https://github.com/honbueisai/blog-tools/raw/refs/heads/feature/eisai-blogtest-reality-form/EISAI_BROGTEST.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const TOOL_ID = 'eisai-brogtest-tool-v0-56-70';
  const BTN_ID = 'eisai-brogtest-btn-v0-56-70';
  const STORAGE_KEY = 'eisai_brogtest_info_v05670';
  const CLASSROOM_STORAGE_KEY = 'eisai_classroom_settings_persistent';
  const CURRENT_VERSION = '0.56.92';
  const UPDATE_URL = 'https://github.com/honbueisai/blog-tools/raw/refs/heads/feature/eisai-blogtest-reality-form/EISAI_BROGTEST.user.js';
  const BLOG_GEM_URL = 'https://gemini.google.com/gem/1IcERsiUCgrBSktbOY6SjAxIcc7-ry7rf?usp=sharing';
  const THUMBNAIL_GEM_URL = 'https://gemini.google.com/gem/1CghC28sQu1ViOe9E4TgfC5LGGj23pPTQ?usp=sharing';
  const BLOG_GEM_ID = '1IcERsiUCgrBSktbOY6SjAxIcc7-ry7rf';
  const THUMBNAIL_GEM_ID = '1CghC28sQu1ViOe9E4TgfC5LGGj23pPTQ';
  const PENDING_BLOG_PROMPT_KEY = 'eisai_brogtest_pending_blog_prompt';

  const BLOG_TYPES = {
    GROWTH: 'growth_story',
    EVENT: 'event',
    PERSON: 'person',
    SERVICE: 'service',
    SCORE: 'score_summary',
    OTHER: 'other'
  };

  let currentBlogType = BLOG_TYPES.GROWTH;

  console.log('🚀 EISAI_BROGTEST v0.56.92 起動');

  let lastBlogHtml = '';

  // =========================================================
  // 1. 訴求スタイル / 画像スタイル定義
  // =========================================================
  const VISUAL_STYLES = {
    '実写スタイル': 'Photorealistic style, shot on DSLR, authentic Japanese cram school atmosphere',
    'アニメスタイル': 'Modern Japanese anime style, vibrant colors, clean lines, cel shaded, Kyoto Animation style, high quality illustration',
    'インフォグラフィック': '3D isometric icon style, clay render, minimalism, clean background, educational infographic, data visualization',
    '漫画スタイル': 'Japanese manga style, black and white with screentones, comic book art, dramatic lines, ink drawing, speech bubbles',
    'YOUTUBEスタイル': 'YouTube thumbnail style, photorealistic, hyper-saturated colors, bold outlines, clear contrast, catchy visuals, close-up, professional photography',
    'インパクトスタイル': 'Dynamic angle, fish-eye lens, high contrast, intense lighting, dramatic shadows, movie poster quality, explosion of colors'
  };

  const APPEAL_STYLES = {
    '共感': 'Relatable expression, gentle nod, soft warm lighting, sentimental atmosphere, slice of life',
    '驚き': 'Shocked expression, wide eyes, mouth open, dynamic speed lines background, sudden realization',
    '笑顔': 'Big bright smile, showing teeth, thumbs up, happy emotion, sparkling eyes, warm sunlight',
    '不安煽る': 'Worried face, sweating, dark gloomy background, holding head in hands, stressed, cool colors',
    'ポジティブ': 'Confident pose, fist pump, looking up at the sky, energetic, bright sunlight, lens flare',
    '最高': 'Triumphant pose, glowing aura, golden lighting, confetti, crown, champion vibe, masterpiece'
  };

  const BRAND_CONSTANT = 'Navy Blue and Orange color scheme, Teacher as clean university student (male/female) wearing plain white lab coat with no text, professional appearance, clean composition, --ar 3:2';

  const TEXT_DESIGN = 'Impactful text design: Bold 3D letters with drop shadows, gradient fills (orange to white), thick outlines, dynamic positioning, maximum visibility, eye-catching typography, professional yet striking appearance';

  const CLASSROOM_DESCRIPTION = 'A bright, clean, modern Japanese cram school classroom filled with soft natural light. Large windows with sheer white curtains diffuse daylight evenly across the room, creating a gentle, calm atmosphere. The interior is minimalist and white-based: smooth white walls, white ceilings, and uncluttered decor. White rectangular desks with simple, modern legs are arranged in rows, providing wide workspace for two people to sit side-by-side. On the desks are neatly arranged study materials such as notebooks, pens, and open textbooks, without clutter. Chairs are lightweight, white plastic with small perforations on the backrest, matching the clean and modern design of the room. The overall space feels open, bright, and warm, with a soft photographic depth of field and natural diffusion that highlights a quiet, studious environment.';

  const TUTORING_STYLE = 'Two people sit side-by-side at a white desk, engaging in a tutoring session. Their clothing is not specified (could be white coat, uniform, or casual wear), and the faces or identities are not emphasized. They are positioned horizontally next to each other, never facing each other. One person provides gentle academic guidance while the other takes notes or works through a problem. Hands, textbooks, and writing tools are visible on the desk, capturing the natural movement of a study session without defining who the individuals are. The focus is on the interaction and learning atmosphere, not the identity of the participants.';

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

  const appealStyles = {
    '共感': {
      composition: '温かみのある柔らかい構図。人物は正面または斜め45度で、視線をカメラに向け、親しみやすい表情。',
      lighting: '柔らかい自然光、温かみのあるトーン。影は柔らかく、包み込むような光。',
      color: 'パステルカラー、アースカラー、ベージュ・オレンジ・淡いピンク系',
      emotion: '安心感、寄り添い、理解を示す優しい表情',
      elements: '手を差し伸べる、うなずく、穏やかな微笑み'
    },
    '驚き': {
      composition: 'ダイナミックな斜め構図。人物は目を見開き、口を開けた驚きの表情。背景に放射状のエフェクト。',
      lighting: '強いスポットライト、ハイコントラスト。被写体を際立たせる劇的な光。',
      color: '鮮やかな黄色・オレンジ・青、ビビッドカラー',
      emotion: '目を大きく見開いた驚きの表情、衝撃を受けた瞬間',
      elements: 'ビックリマーク、稲妻エフェクト、爆発的な背景'
    },
    '笑顔': {
      composition: '明るく開放的な構図。人物は大きな笑顔で、ポジティブなエネルギーを放つ。',
      lighting: '明るく均一な光、影は最小限。爽やかな印象。',
      color: '明るい黄色・水色・白・ライトグリーン、清潔感のある色',
      emotion: '満面の笑み、喜び、幸福感あふれる表情',
      elements: 'キラキラエフェクト、太陽、花、ハート'
    },
    '不安煽る': {
      composition: '緊張感のある構図。人物は不安そうな表情、または問題を示す要素を配置。',
      lighting: '暗めの照明、強い影、不安を演出するドラマチックな光。',
      color: '暗い青・グレー・赤、警告色(赤・黄色)をアクセントに',
      emotion: '困惑、焦り、不安、心配そうな表情',
      elements: '時計、カレンダー、！マーク、下向き矢印、暗い雲'
    },
    'ポジティブ': {
      composition: '上向きで前向きな構図。人物はガッツポーズや指差し、希望を感じさせるポーズ。',
      lighting: '明るく希望に満ちた光、上方からの光で未来を示唆。',
      color: '鮮やかなオレンジ・黄色・緑・青、エネルギッシュな配色',
      emotion: '自信、希望、やる気、達成感を示す表情',
      elements: '上向き矢印、グラフ、星、トロフィー、チェックマーク'
    },
    '最高': {
      composition: '圧倒的なインパクトの中心構図。人物は勝利のポーズ、最高の瞬間を表現。',
      lighting: '後光が差すような強い光、ゴージャスな輝き、金色の光。',
      color: 'ゴールド・赤・黒、高級感と勝利を示す色',
      emotion: '最高の笑顔、勝利、達成、自信に満ちた表情',
      elements: '王冠、金メダル、紙吹雪、NO.1、輝くエフェクト'
    }
  };

  const imageStyles = {
    '実写スタイル': {
      baseStyle: '高品質な写真、フォトリアリスティック、一眼レフカメラで撮影したような質感',
      detail: '肌の質感、髪の毛の流れ、服のシワなど細部まで写実的に',
      rendering: '自然な被写界深度、リアルな光の反射、フォトリアルレンダリング'
    },
    'アニメスタイル': {
      baseStyle: '日本のアニメ風イラスト、セルアニメ調、クリーンなライン',
      detail: '大きな瞳、整った輪郭、アニメ的な髪の表現、ハイライトとシャドウの明確な分離',
      rendering: 'フラットな塗り、アニメ塗り、鮮やかな色彩'
    },
    'インフォグラフィックスタイル': {
      baseStyle: 'フラットデザイン、シンプルなアイコンとイラスト、情報を視覚化',
      detail: 'グラフ、チャート、矢印、数字を効果的に配置。幾何学的な形状',
      rendering: 'ベクターアート風、クリーンでモダン、余白を活かしたデザイン'
    },
    'YOUTUBEスタイル': {
      baseStyle: 'YouTubeサムネイル特化、超高コントラスト、派手でキャッチー',
      detail: '大きな文字、驚きの表情、赤い丸や矢印などのYouTube定番要素',
      rendering: '彩度MAX、縁取り文字、ドロップシャドウ強め、目立つことを最優先'
    },
    '漫画スタイル': {
      baseStyle: '日本の漫画風、白黒またはトーン使用、コマ割り風',
      detail: '漫画的な表情、集中線、効果線、吹き出し、スクリーントーン',
      rendering: 'ペン画タッチ、インクの質感、漫画特有の演出効果'
    },
    'インパクトスタイル': {
      baseStyle: '圧倒的な視覚的インパクト、一目で目を引く強烈なビジュアル',
      detail: '極端な配色、大胆な構図、巨大な文字、衝撃的な要素',
      rendering: '超高コントラスト、HDR風、派手なエフェクト、爆発的な印象'
    }
  };

  // =========================================================
  // 2. ブログ用 MASTER_YAML
  // =========================================================
  const MASTER_YAML = [
    "version: \"5.0-minimal-eisai\"",
    "role: \"Professional Cram School Blog Writer\"",
    "tone_and_manner: \"Empathic, Professional, Encouraging, Trustworthy\"",
    "target_audience: \"Parents of junior high and high school students\"",
    "",
    "basic_info:",
    "  classroom_name: \"__KOSHA__\"",
    "  manager_name: \"__SHICHOU__\"",
    "  cta_url: \"__CTA_URL__\"",
    "  cta_tel: \"__CTA_TEL__\"",
    "",
    "input_required:",
    "",
    "instruction: |",
    "  上記の設定と【入力された情報】に基づき、保護者の心に響くブログ記事を作成してください。",
    "  記事のテーマは「__THEME__」です。",
    "  ",
    "  【最重要：現場感・リアリティ】",
    "  - 一般論だけで終わらせず、入力された学校名・学年・教科・点数・期間・生徒の様子・先生の声を本文に反映してください。",
    "  - 入力されていない点数、学校名、合格校、キャンペーン内容、生徒発言は作らないでください。",
    "  - 教室で実際に行ったことを、読者がイメージできる粒度で書いてください。",
    "  - 「頑張りました」だけで終わらず、何を・いつ・どのくらい・どう変えたのかを具体化してください。",
    "  - 室長または先生の目線を1か所以上入れてください。",
    "  - 保護者が抱きやすい不安に一度寄り添ってから、教室での取り組みに接続してください。",
    "  ",
    "  【文字量の目安】",
    "  - 成長ストーリー・相談系: 1500〜2200字程度",
    "  - 講習・イベント紹介: 1300〜1800字程度",
    "  - 点数アップ速報: 1200〜1600字程度",
    "  - 先生紹介: 900〜1300字程度",
    "  - 休校・事務連絡などのお知らせ: 200〜500字程度",
    "  - 入力情報が少ない場合は無理に長くせず、不足情報を補うための架空設定はしないでください。",
    "  ",
    "  【出力要件】",
    "  1. フォーマット: 必ずHTML形式（<html>タグ不要、<h1>から書き始める）",
    "     - 本文は必ず <h1>, <h2>, <p>, <ul>, <li>, <strong> などのHTMLタグを実際に使って出力してください。",
    "     - 通常の文章だけ、Markdown見出し（# や ##）、箇条書きだけの出力は禁止です。",
    "     - ```html などのコードブロックで囲まず、貼り付け可能なHTML本文だけを出力してください。",
    "     - 箇条書き中心の記事は禁止です。本文の中心は必ず段落（<p>）で書き、箇条書きは具体的な取り組みを整理する場合だけにしてください。",
    "  2. 構成:",
    "     - <h1>: 魅力的なタイトル（32文字以内推奨）",
    "     - 導入: 読者の悩みに寄り添う共感パート",
    "     - 本文: 具体的なエピソード、解決策、教室の取り組み（見出し<h2>, <h3>を活用し、各見出しの下に自然な段落を2つ以上入れる）",
    "     - 結び: 前向きなメッセージと行動喚起",
    "  3. CTAセクション（重要）:",
    "     記事本文の最後に、記事内容に即したCTAデータを以下の形式で必ず出力してください。",
    "     このCTAデータはツール側で読み取り、最終的なHTMLでは整形済みCTAに変換されます。",
    "     <!--CTA_DATA_START-->",
    "     説明文1：[記事の内容に合わせた、不安を解消する一言]",
    "     説明文2：[教室見学や相談へのハードルを下げる優しい一言]",
    "     相談ポイント1：[記事関連の相談内容1]",
    "     相談ポイント2：[記事関連の相談内容2]",
    "     相談ポイント3：[記事関連の相談内容3]",
    "     相談ポイント4：[記事関連の相談内容4]",
    "     体験ポイント1：[体験で得られるメリット1]",
    "     体験ポイント2：[体験で得られるメリット2]",
    "     体験ポイント3：[体験で得られるメリット3]",
    "     体験ポイント4：[体験で得られるメリット4]",
    "     締めの言葉：[校舎名]室長 [室長名]より、心を込めた最後のメッセージ",
    "     <!--CTA_DATA_END-->",
    "",
    "  【禁止事項】",
    "  - 嘘や架空の実績を書かない",
    "  - 不自然な日本語やAI特有の硬い表現を避ける",
    "  - HTMLタグなしのプレーンテキストで出力しない",
    "  - CTAデータ以外の場所に、説明文1・相談ポイント・体験ポイントなどの内部項目を出力しない",
    "  - マークダウンのコードブロック（```html）で囲まない（そのままブラウザでレンダリングできる形式で）"
  ].join("\n");

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

  function createInput(parent, label, ph, isArea = false) {
    const wrap = createEl('div', { className: 'eisai-input-wrap' }, parent);
    createEl('label', { className: 'eisai-label' }, wrap, label);
    const input = createEl(isArea ? 'textarea' : 'input', { className: 'eisai-input' }, wrap);
    if (isArea) input.style.height = '80px';
    input.placeholder = ph;
    return input;
  }

  function getSetting() {
    try {
      const versionedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const classroomData = JSON.parse(localStorage.getItem(CLASSROOM_STORAGE_KEY) || '{}');
      return {
        ...versionedData,
        name: classroomData.name || classroomData.kosha || versionedData.kosha || '',
        manager: classroomData.manager || classroomData.shichou || versionedData.shichou || '',
        area: classroomData.area || versionedData.area || '',
        url: classroomData.url || versionedData.url || '',
        tel: classroomData.tel || versionedData.tel || ''
      };
    } catch {
      return { name: '', manager: '', area: '', url: '', tel: '' };
    }
  }

  function saveSetting(info) {
    try {
      const currentPersistent = JSON.parse(localStorage.getItem(CLASSROOM_STORAGE_KEY) || '{}');
      const classroomData = {
        name: info.name !== undefined ? info.name : currentPersistent.name,
        manager: info.manager !== undefined ? info.manager : currentPersistent.manager,
        area: info.area !== undefined ? info.area : currentPersistent.area,
        url: info.url !== undefined ? info.url : currentPersistent.url,
        tel: info.tel !== undefined ? info.tel : currentPersistent.tel
      };
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

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function sendMessageViaEnter(input) {
    if (!input) return;
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true
    }));
  }

  function isBlogGemPage() {
    return location.pathname.indexOf('/gem/' + BLOG_GEM_ID) !== -1;
  }

  function isThumbnailGemPage() {
    return location.pathname.indexOf('/gem/' + THUMBNAIL_GEM_ID) !== -1;
  }

  function findGeminiInput() {
    return document.querySelector('div[contenteditable="true"], rich-textarea div[contenteditable="true"]');
  }

  async function waitForGeminiInput(timeoutMs = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const input = findGeminiInput();
      if (input) return input;
      await sleep(500);
    }
    return null;
  }

  function savePendingBlogPrompt(prompt) {
    localStorage.setItem(PENDING_BLOG_PROMPT_KEY, JSON.stringify({
      prompt,
      createdAt: Date.now()
    }));
  }

  function loadPendingBlogPrompt() {
    try {
      const pending = JSON.parse(localStorage.getItem(PENDING_BLOG_PROMPT_KEY) || 'null');
      if (!pending || !pending.prompt) return null;
      if (Date.now() - pending.createdAt > 10 * 60 * 1000) {
        localStorage.removeItem(PENDING_BLOG_PROMPT_KEY);
        return null;
      }
      return pending;
    } catch (e) {
      localStorage.removeItem(PENDING_BLOG_PROMPT_KEY);
      return null;
    }
  }

  async function insertPromptAndSend(prompt) {
    const input = await waitForGeminiInput();
    if (!input) return false;

    input.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, prompt);
    input.dispatchEvent(new Event('input', { bubbles: true }));

    await sleep(500);
    sendMessageViaEnter(input);
    return true;
  }

  function decodeHtmlText(raw) {
    return (raw || '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  function escapeHtml(raw) {
    return (raw || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function looksLikeHtml(raw) {
    return /<\/?(article|section|h1|h2|h3|p|div|ul|ol|li|strong|em|br)\b/i.test(raw || '');
  }

  function plainTextToHtml(raw) {
    const lines = (raw || '')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    if (!lines.length) return '';

    const html = [];
    let usedTitle = false;
    let listOpen = false;

    function closeList() {
      if (listOpen) {
        html.push('</ul>');
        listOpen = false;
      }
    }

    lines.forEach((line, idx) => {
      const normalized = line.replace(/^#{1,6}\s*/, '');
      const bullet = normalized.match(/^[・\-*]\s*(.+)$/);

      if (!usedTitle) {
        closeList();
        html.push('<h1>' + escapeHtml(normalized) + '</h1>');
        usedTitle = true;
        return;
      }

      if (bullet) {
        if (!listOpen) {
          html.push('<ul>');
          listOpen = true;
        }
        html.push('<li>' + escapeHtml(bullet[1]) + '</li>');
        return;
      }

      closeList();
      const isHeading = idx < 12 && normalized.length <= 32 && /[:：]$/.test(normalized);
      if (isHeading) {
        html.push('<h2>' + escapeHtml(normalized.replace(/[:：]$/, '')) + '</h2>');
      } else {
        html.push('<p>' + escapeHtml(normalized) + '</p>');
      }
    });

    closeList();
    return html.join('\n');
  }

  function ensureHtmlContent(raw) {
    const cleaned = (raw || '').trim();
    if (!cleaned) return '';
    return looksLikeHtml(cleaned) ? cleaned : plainTextToHtml(cleaned);
  }

  function sanitizeGeminiHtml(rawHtml) {
    let html = String(rawHtml || '');
    if (!html.trim()) return '';

    html = html
      .replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_m, inner) => decodeHtmlText(inner))
      .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_m, inner) =>
        /&lt;\/?(h1|h2|h3|p|ul|ol|li|strong|em|br)\b/i.test(inner) ? decodeHtmlText(inner) : `<code>${inner}</code>`
      );

    html = html.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g, (_m, slash, tag) => {
      const lower = tag.toLowerCase();
      const allowed = new Set(['h1','h2','h3','h4','p','ul','ol','li','strong','em','br','article','section','div','blockquote']);
      if (!allowed.has(lower)) return '';
      return `<${slash}${lower}>`;
    });

    html = html
      .replace(/<div>\s*<\/div>/gi, '')
      .replace(/<p>\s*<\/p>/gi, '')
      .replace(/<br>\s*<br>(?:\s*<br>)+/gi, '<br><br>')
      .trim();

    return html;
  }

  function findLatestBlogResponseNode() {
    const selectors = [
      '.model-response-text',
      '.markdown-main-panel',
      'message-content',
      '[data-message-author-role="model"]',
      '[class*="model-response"]',
      '[class*="response-content"]',
      '[class*="markdown"]'
    ];
    const seen = new Set();
    const candidates = [];

    selectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(node => {
          if (!seen.has(node)) {
            seen.add(node);
            candidates.push(node);
          }
        });
      } catch (e) {
        console.warn('[Eisai] 応答候補セレクタを読み飛ばしました:', selector, e);
      }
    });

    const usable = candidates.filter(node => {
      const text = (node.textContent || node.innerText || '').trim();
      if (text.length < 20) return false;
      return node.getClientRects().length > 0 || node.offsetParent !== null;
    });

    return (usable.length ? usable : candidates).pop() || null;
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

    function splitLongSentence(sentence) {
      if (sentence.includes('、')) {
        return sentence
          .split(/(?<=、)/)
          .map(part => part.trim())
          .filter(Boolean);
      }
      if (sentence.length <= 78) return [sentence];
      const parts = sentence.split(/(?<=、)/).map(part => part.trim()).filter(Boolean);
      if (parts.length <= 1) return [sentence];
      const blocks = [];
      let block = '';
      parts.forEach(part => {
        const next = block ? block + part : part;
        if (block && next.length > 70) {
          blocks.push(block);
          block = part;
        } else {
          block = next;
        }
      });
      if (block) blocks.push(block);
      return blocks;
    }

    const sentences = [];
    let current = '';
    Array.from(text).forEach(char => {
      current += char;
      if ('。！？'.includes(char)) {
        const sentence = current.trim();
        if (sentence) sentences.push(sentence);
        current = '';
      }
    });
    if (current.trim()) sentences.push(current.trim());
    if (sentences.length <= 1) return splitLongSentence(text);

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
    return blocks.flatMap(splitLongSentence);
  }

  function decorateInlineText(raw, options = {}) {
    let safe = escapeHtml(raw);
    const state = options.state || { number: 0, quote: 0, keyword: 0 };
    const limits = {
      number: options.numberLimit ?? 4,
      quote: options.quoteLimit ?? 4,
      keyword: options.keywordLimit ?? 2
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
      '説明文1': ['説明文1', 'description1', 'description_1', 'firstDescription', 'first_description'],
      '説明文2': ['説明文2', 'description2', 'description_2', 'secondDescription', 'second_description'],
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
      html.push('</ul>');
      html.push('</div>');
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
      html.push('<div style="margin: 28px 0; padding: 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">');
      dialogues.forEach(dialogue => {
        const isParent = /保護者|お母|母|親/.test(dialogue.speaker);
        const align = isParent ? 'flex-start' : 'flex-end';
        const bubbleColor = isParent ? '#ffffff' : '#e0f2fe';
        const borderColor = isParent ? '#cbd5e1' : '#7dd3fc';
        html.push('<div style="display: flex; justify-content: ' + align + '; margin: 0 0 12px;">');
        html.push('<div style="max-width: 88%; background: ' + bubbleColor + '; border: 1px solid ' + borderColor + '; border-radius: 14px; padding: 11px 14px; line-height: 1.85;">');
        html.push('<div style="font-size: 12px; color: #64748b; font-weight: 800; margin: 0 0 4px;">' + escapeHtml(dialogue.speaker) + '</div>');
        html.push('<div style="font-size: 15.5px;">' + decorateInlineText(dialogue.text, { state: decorationState }) + '</div>');
        html.push('</div></div>');
      });
      html.push('</div>');
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
        .slice(0, 5)
        .map(suggestion => ({
          afterSection: Math.max(0, Number(suggestion.afterSection || suggestion.after_section || 0)),
          label: String(suggestion.label || suggestion.title || '写真挿入').trim(),
          description: String(suggestion.description || suggestion.detail || suggestion.text || '').trim()
        }))
        .filter(suggestion => suggestion.label || suggestion.description);
      const targetCount = 5;
      const fallback = [
        { afterSection: 0, label: '冒頭写真', description: '校舎外観、教室入口、または明るい教室全体の写真。記事の最初に安心感を出せます。' },
        { afterSection: 1, label: '学習中の手元写真', description: 'ノート、途中式、解き直しリストなど、今回の取り組みが伝わる手元写真。' },
        { afterSection: 2, label: '教室の雰囲気写真', description: '自習スペースや授業中の様子など、実際の通塾イメージが湧く写真。' },
        { afterSection: 3, label: '成果が伝わる写真', description: '答案用紙、確認テスト、学習計画表など、変化や成長が伝わる写真。' },
        { afterSection: sectionCount + 1, label: '室長・先生の写真', description: '室長や先生の自然な表情の写真。最後の相談導線に安心感を添えられます。' }
      ];
      fallback.forEach(item => {
        if (suggestions.length >= targetCount) return;
        const alreadyUsed = suggestions.some(suggestion => suggestion.afterSection === item.afterSection);
        if (!alreadyUsed) suggestions.push(item);
      });
      return suggestions
        .slice(0, 5)
        .sort((a, b) => a.afterSection - b.afterSection);
    }

    html.push('<div data-eisai-article="true" style="font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; color: #1f2937; line-height: 1.95;">');
    html.push('<h1 style="font-size: 30px; line-height: 1.45; margin: 0 0 28px; padding: 20px 24px; border-left: 6px solid #1d8acb; background: #eef8ff; color: #0f172a; font-weight: 900;">' + escapeHtml(title) + '</h1>');

    normalizeTextArray(article.greeting || article.openingGreeting).forEach(paragraph => {
      renderParagraph(paragraph);
    });

    const leadParagraphs = normalizeTextArray(article.lead || article.introduction);
    if (leadParagraphs.length) {
      html.push('<div style="background: #f8fafc; border: 1px solid #e5edf5; border-radius: 12px; padding: 20px 22px; margin: 0 0 30px;">');
      leadParagraphs.forEach((paragraph, paragraphIndex) => {
        splitReadableParagraph(paragraph).forEach(block => {
          const leadStyle = paragraphIndex === 0
            ? 'font-size: 17px; font-weight: 700; color: #334155;'
            : 'font-size: 16px; color: #334155;';
          html.push('<p style="margin: 0 0 16px; line-height: 2.12; ' + leadStyle + '">' + decorateInlineText(block, { state: decorationState }) + '</p>');
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

    normalizeTextArray(article.summary || article.keyMessage).slice(0, 1).forEach((paragraph, index) => {
      renderHighlight(paragraph, index);
    });

    const sections = Array.isArray(article.sections) ? article.sections : [];
    const rawPhotoSuggestions = normalizeObjectArray(article.photoSuggestions || article.photo_suggestions);
    const photoSuggestions = buildPhotoSuggestions(rawPhotoSuggestions, sections.length);
    photoSuggestions
      .filter(suggestion => Number(suggestion.afterSection || suggestion.after_section || 0) === 0)
      .forEach(renderPhotoSuggestion);

    sections.forEach((section, index) => {
      if (!section || typeof section !== 'object') return;
      const sectionIndex = index + 1;
      const heading = String(section.heading || section.title || '').trim();
      if (heading) html.push('<h2 style="font-size: 23px; line-height: 1.5; margin: 40px 0 20px; padding: 17px 20px; border-left: 6px solid #1d8acb; background: #eef8ff; color: #0f172a; font-weight: 900;">' + escapeHtml(heading) + '</h2>');

      normalizeTextArray(section.paragraphs || section.body || section.content).forEach(paragraph => {
        renderParagraph(paragraph);
      });

      renderDialogues(normalizeDialogueArray(section.dialogues || section.dialogue || section.conversation));

      normalizeTextArray(section.highlights || section.highlight || section.emphasis).slice(0, 1).forEach((text, highlightIndex) => renderHighlight(text, highlightIndex));

      const bullets = normalizeTextArray(section.bullets || section.points);
      renderCheckList(String(section.bulletTitle || section.bullet_title || 'ここがポイント').trim(), bullets);
      renderManagerNote(String(section.managerNote || section.manager_note || '').trim());
      photoSuggestions
        .filter(suggestion => Number(suggestion.afterSection || suggestion.after_section || 0) === sectionIndex)
        .forEach(renderPhotoSuggestion);
    });

    normalizeTextArray(article.closing || article.conclusion).forEach(paragraph => {
      renderParagraph(paragraph);
    });

    photoSuggestions
      .filter(suggestion => Number(suggestion.afterSection || suggestion.after_section || 0) > sections.length)
      .forEach(renderPhotoSuggestion);

    html.push('</div>');

    return html.join('\n').trim();
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
    const closingMessage = getCtaClosingMessage(d);
    return (
      '<div data-cta-protected="true" style="background: #f8f8f8; padding: 40px 20px; margin: 40px 0;">' +
      '<div style="text-align: center; font-size: 26px; font-weight: bold; color: #333; margin: 0 0 12px 0;">まずはお気軽にご相談ください</div>' +
      '<div style="text-align: center; color: #888; margin: 0 0 16px 0; font-size: 13px;">入会する・しないにかかわらず、お子さまの学習についてお力になります。</div>' +
      '<div style="text-align: center; color: #555; margin: 0 0 10px 0; font-size: 15px;">' + (d['説明文1'] || defaultCtaData['説明文1']) + '</div>' +
      '<div style="text-align: center; color: #555; margin: 0 0 30px 0; font-size: 15px;">' + (d['説明文2'] || defaultCtaData['説明文2']) + '</div>' +
      '<div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; margin-bottom: 30px; max-width: 800px; margin-left: auto; margin-right: auto;">' +
      '<div style="flex: 1; min-width: 300px; max-width: 380px; background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 24px 28px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">' +
      '<div style="color: #e67e22; font-size: 18px; font-weight: bold; margin: 0 0 16px 0;">📒 無料学習相談でできること</div>' +
      '<div style="color: #444; line-height: 2.0; font-size: 15px; padding-left: 8px;">' +
      '<div style="margin-bottom: 4px;">・' + (d['相談ポイント1'] || defaultCtaData['相談ポイント1']) + '</div>' +
      '<div style="margin-bottom: 4px;">・' + (d['相談ポイント2'] || defaultCtaData['相談ポイント2']) + '</div>' +
      '<div style="margin-bottom: 4px;">・' + (d['相談ポイント3'] || defaultCtaData['相談ポイント3']) + '</div>' +
      '<div style="margin-bottom: 4px;">・' + (d['相談ポイント4'] || defaultCtaData['相談ポイント4']) + '</div>' +
      '</div>' +
      '</div>' +
      '<div style="flex: 1; min-width: 300px; max-width: 380px; background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 24px 28px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">' +
      '<div style="color: #e67e22; font-size: 18px; font-weight: bold; margin: 0 0 16px 0;">✏️ 無料体験授業でできること</div>' +
      '<div style="color: #444; line-height: 2.0; font-size: 15px; padding-left: 8px;">' +
      '<div style="margin-bottom: 4px;">・' + (d['体験ポイント1'] || defaultCtaData['体験ポイント1']) + '</div>' +
      '<div style="margin-bottom: 4px;">・' + (d['体験ポイント2'] || defaultCtaData['体験ポイント2']) + '</div>' +
      '<div style="margin-bottom: 4px;">・' + (d['体験ポイント3'] || defaultCtaData['体験ポイント3']) + '</div>' +
      '<div style="margin-bottom: 4px;">・' + (d['体験ポイント4'] || defaultCtaData['体験ポイント4']) + '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +
      (closingMessage ? '<div style="text-align: center; color: #555; margin: 0 0 28px 0; font-size: 15px;">' + closingMessage + '</div>' : '') +
      '<div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">' +
      '<a href="' + url + '" style="display: inline-block; background: #e67e22; color: #fff; padding: 16px 32px; border-radius: 50px; font-size: 15px; font-weight: bold; text-decoration: none; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">無料学習相談・体験授業に申し込む</a>' +
      '<a href="tel:' + tel.replace(/-/g, '') + '" style="display: inline-block; background: #fff; color: #e67e22; padding: 16px 32px; border-radius: 50px; font-size: 15px; font-weight: bold; text-decoration: none; border: 2px solid #e67e22;">電話で直接申し込む</a>' +
      '</div>' +
      '</div>'
    );
  }

  function getCtaClosingMessage(data) {
    const raw = String((data && data['締めの言葉']) || '').trim();
    if (!raw) return '';
    const genericPatterns = [
      /誠心誠意/,
      /全力でサポート/,
      /サポートさせていただきます/,
      /お待ちしております/,
      /心を込めた最後のメッセージ/,
      /校舎名.*室長名/,
      /英才個別学院\s*[^、。]*校\s*室長の[^、。]*(?:が|より)/
    ];
    if (genericPatterns.some(pattern => pattern.test(raw)) && raw.length < 55) return '';
    return escapeHtml(raw);
  }

  // =========================================================
  // 5. CSS
  // =========================================================
  const CSS = `
#${TOOL_ID} {
  font-family: system-ui, sans-serif; color: #333;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15); border-radius: 0;
  overflow: hidden; border-left: 1px solid #e5e7eb; background: #fff;
  position: fixed; top: 0; right: 0; width: 420px; height: 100vh;
  z-index: 2147483647; display: flex; flex-direction: column;
  pointer-events: auto;
  transition: transform 0.3s ease;
}
#${TOOL_ID}.collapsed {
  transform: translateX(100%);
}
#${TOOL_ID} * {
  pointer-events: auto;
}
#eisai-toggle-btn {
  position: fixed; top: 50%; right: 420px; transform: translateY(-50%);
  z-index: 2147483646; background: #1d4ed8; color: #fff;
  border: none; border-radius: 8px 0 0 8px; padding: 12px 8px;
  cursor: pointer; font-size: 14px; writing-mode: vertical-rl;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.2);
  transition: right 0.3s ease;
}
#eisai-toggle-btn.collapsed {
  right: 0;
}
#eisai-toggle-btn:hover {
  background: #1e40af;
}
.eisai-header {
  background: #f9fafb; padding: 10px 14px; display: flex;
  justify-content: space-between; align-items: center; font-size: 13px;
  border-bottom: 1px solid #e5e7eb; user-select: none;
}
.eisai-label { font-size: 11px; display: block; margin-bottom: 3px; font-weight: bold; color: #555; }
.eisai-input { width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-size: 13px; }
.eisai-input-wrap { margin-bottom: 10px; }
.eisai-type-wrap { margin: 8px 0 4px; }
.eisai-type-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.eisai-type-btn {
  flex: 1 1 calc(50% - 6px);
  min-width: 140px;
  padding: 6px 8px;
  font-size: 11px;
  border-radius: 999px;
  border: 1px solid #d1d5db;
  background: #f9fafb;
  cursor: pointer;
  text-align: center;
  white-space: nowrap;
}
.eisai-type-btn:hover {
  background: #e0e7ff;
  border-color: #6366f1;
}
.eisai-type-btn-active {
  background: #1d4ed8;
  color: #ffffff;
  border-color: #1d4ed8;
}
.eisai-type-btn-active:hover {
  background: #1e40af;
  border-color: #1e40af;
}
.eisai-primary-btn {
  width: 100%; padding: 10px; background: #1d4ed8; color: #fff;
  border: none; border-radius: 8px; font-weight: 600; cursor: pointer;
  margin-top: 10px; font-size: 14px;
}
.eisai-primary-btn:hover { background: #1e40af; }
.eisai-status {
  padding: 8px; margin-top: 8px; font-size: 12px; border-radius: 6px;
  display: none;
}
.eisai-status.show { display: block; background: #eff6ff; color:#1d4ed8; }
details.eisai-details { margin-bottom: 12px; border: 1px solid #eee; border-radius: 6px; }
details.eisai-details summary { padding: 8px; background: #fafafa; cursor: pointer; font-size: 12px; font-weight: bold; list-style: none; }
.eisai-details-content { padding: 8px; }

.eisai-btn-pulse {
  animation: eisai-pulse 0.9s ease-in-out 0s 4;
}

@keyframes eisai-pulse {
  0% { transform: scale(1); box-shadow: 0 0 0 rgba(37, 99, 235, 0.0); }
  50% { transform: scale(1.10); box-shadow: 0 0 16px rgba(37, 99, 235, 0.70); }
  100% { transform: scale(1); box-shadow: 0 0 0 rgba(37, 99, 235, 0.0); }
}
`;

  // =========================================================
  // 6. ウォッチャー：ブログ生成完了
  // =========================================================
  function watchBlogResponseAndEnableCopy(statusDiv, copyBtn, onReady) {
    console.log('[Eisai] ブログ応答ウォッチャー開始');
    let last = '';
    let stableCount = 0;
    let pollCount = 0;
    const maxPollCount = 120;
    const initialNode = findLatestBlogResponseNode();
    const initialText = initialNode ? (initialNode.textContent || initialNode.innerText || '') : '';
    const showReady = (message) => {
      if (onReady) {
        onReady(message);
      } else {
        statusDiv.textContent = message;
        statusDiv.classList.add('show');
        copyBtn.style.display = 'block';
      }
    };

    const timer = setInterval(() => {
      pollCount++;
      const latest = findLatestBlogResponseNode();

      if (!latest) {
        if (pollCount === 30) {
          statusDiv.textContent = '⚠️ Geminiの応答欄を検出できません。画面構成が変わった可能性があります。生成完了後も赤いボタンが出ない場合は、Gemini本文を手動コピーしてください。';
          statusDiv.classList.add('show');
        }
        if (pollCount >= maxPollCount) {
          clearInterval(timer);
          statusDiv.textContent = '❌ タイムアウト：Geminiの応答を検出できませんでした。Gemini本文を手動コピーしてください。';
          statusDiv.classList.add('show');
        }
        return;
      }

      const text = latest.textContent || latest.innerText || '';
      if (pollCount === 60 && text.length < 100) {
        statusDiv.textContent = '⚠️ 生成に時間がかかっています。Gemini側で止まっている場合は、Geminiの停止ボタンで一度止めてから、もう一度送信してください。';
        statusDiv.classList.add('show');
      }
      if (latest === initialNode && text === initialText) {
        if (pollCount % 30 === 0) {
          console.log('[Eisai] 新しいGemini応答待ち', { pollCount, textLength: text.length });
        }
        return;
      }

      if (pollCount % 10 === 0) {
        console.log('[Eisai] 応答監視中', { pollCount, textLength: text.length, stableCount });
      }

      if (text === last) {
        stableCount++;
      } else {
        last = text;
        stableCount = 0;
      }

      const isStableLongResponse = stableCount >= 3 && text.length > 300;
      const isStableShortResponse = stableCount >= 10 && text.length > 100;
      if (isStableLongResponse || isStableShortResponse) {
        console.log('[Eisai] Gemini応答の安定を検出', { textLength: text.length, stableCount });
        clearInterval(timer);

        let raw = '';
        let innerHtmlRaw = '';
        let innerTextRaw = '';
        let decoded = '';
        try {
          const innerMarkdown = latest.matches('.markdown-main-panel') ? latest : latest.querySelector('.markdown-main-panel');
          if (innerMarkdown) {
            innerHtmlRaw = innerMarkdown.innerHTML || '';
            innerTextRaw = innerMarkdown.textContent || '';
          } else {
            innerHtmlRaw = latest.innerHTML || '';
            innerTextRaw = text;
          }
          raw = innerHtmlRaw || innerTextRaw;

          let ctaData = null;
          const blogJson = parseBlogJsonResponse(innerTextRaw || decodeHtmlText(innerHtmlRaw));

          if (blogJson) {
            decoded = renderBlogJsonHtml(blogJson);
            const articleJson = blogJson.article && typeof blogJson.article === 'object' ? blogJson.article : blogJson;
            ctaData = normalizeJsonCtaData(blogJson.cta || blogJson.ctaData || blogJson.cta_data || articleJson.cta);
            console.log('[Eisai] JSON応答からブログHTMLを生成しました');
          } else {
            ctaData = parseCtaData(innerTextRaw || decodeHtmlText(innerHtmlRaw));

            decoded = sanitizeGeminiHtml(innerHtmlRaw);
            decoded = decoded.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '');
            decoded = decoded.replace(/<!--CTA_DATA_START-->[\s\S]*?<!--CTA_DATA_END-->/gi, '');
            decoded = decoded.replace(/<p[^>]*>\s*(説明文[12]|相談ポイント\d+|体験ポイント\d+|締めの言葉)[:：][\s\S]*?<\/p>/gi, '');
            decoded = decoded.replace(/^\s*(説明文[12]|相談ポイント\d+|体験ポイント\d+|締めの言葉)[:：].*$/gim, '');
            decoded = decoded.replace(/<table[^>]*>[\s\S]*<\/table>\s*$/i, '').trim();
          }

          let hasRequiredHtml = /<h1[\s>]/i.test(decoded) && /<p[\s>]/i.test(decoded);

          if (!blogJson && !hasRequiredHtml) {
            const fallbackText = decodeHtmlText(innerTextRaw)
              .replace(/<!--CTA_DATA_START-->[\s\S]*?<!--CTA_DATA_END-->/gi, '')
              .replace(/^\s*(説明文[12]|相談ポイント\d+|体験ポイント\d+|締めの言葉)[:：].*$/gim, '')
              .trim();
            const fallbackPlain = fallbackText.replace(/\s+/g, '');
            if (fallbackPlain.length >= 300) {
              decoded = ensureHtmlContent(fallbackText);
              hasRequiredHtml = /<h1[\s>]/i.test(decoded) && /<p[\s>]/i.test(decoded);
              console.warn('[Eisai] innerHTML から本文HTMLを取得できなかったため、textContent + ensureHtmlContent でフォールバックしました');
            }
          }

          const articleText = decoded
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, '')
            .trim();
          if (!hasRequiredHtml || articleText.length < 300) {
            lastBlogHtml = '';
            statusDiv.textContent = '❌ Gemの出力にブログ本文が見つかりませんでした。CTA素材だけの可能性があります。Gemの本文を確認し、もう一度「Geminiへ送信して記事生成」を押してください。';
            statusDiv.classList.add('show');
            copyBtn.style.display = 'none';
            return;
          }

          const info = getSetting();
          let ctaUrl = (info.url || '').trim();
          const ctaTel = (info.tel || '').trim();
          if (!ctaUrl) {
            console.warn('[Eisai] CTA URLが未設定のため、CTAなしでコピー可能にします');
            lastBlogHtml = decoded;
            showReady('⚠️ CTA URLが未設定のため、CTAなしのHTMLをコピーできます。次回は教室情報設定からCTAリンク先URLを保存してください。');
            return;
          }
          if (!/^https?:\/\//i.test(ctaUrl)) ctaUrl = 'https://' + ctaUrl;

          const ctaHtml = buildCtaHtml(ctaUrl, ctaTel, ctaData);
          lastBlogHtml = decoded + '\n\n' + ctaHtml;

        } catch (e) {
          console.error('ブログHTML処理エラー:', e);
          lastBlogHtml = ensureHtmlContent(decodeHtmlText(raw || text).trim());
          if (lastBlogHtml) {
            showReady('⚠️ HTML加工中にエラーが発生しましたが、Gemini応答本文をHTML化してコピーできます。内容を確認してから貼り付けてください。');
          } else {
            statusDiv.textContent = '❌ HTML加工中にエラーが発生し、コピー用本文も取得できませんでした。Gemini本文を手動コピーしてください。';
            statusDiv.classList.add('show');
          }
          return;
        }

        showReady(isStableShortResponse
          ? '✅ 短めの応答として生成完了を検出しました。内容を確認してから赤いボタンでコピーしてください。'
          : '✅ ブログ記事の生成が完了しました。下の赤いボタンからHTMLをコピーできます。');
      }
    }, 1000);
  }

  // =========================================================
  // 7. ウォッチャー：サムネイル指示生成完了
  // =========================================================
  let lastPromptNode = null;
  let isGeneratingPrompt = false;

  function watchThumbnailPrompt(statusDiv, imgExecBtn) {
    let last = '';
    let stableCount = 0;

    const timer = setInterval(() => {
      if (!isGeneratingPrompt) {
        clearInterval(timer);
        return;
      }

      const nodes = document.querySelectorAll('.markdown-main-panel, .model-response-text');
      if (!nodes.length) return;

      const latest = nodes[nodes.length - 1];
      const txt = latest.textContent || latest.innerText || '';

      if (txt.includes('このプロンプトで画像を生成してください')) {
        if (txt === last) {
          stableCount++;
        } else {
          last = txt;
          stableCount = 0;
        }

        if (stableCount >= 3 && txt.length > 100) {
          clearInterval(timer);
          lastPromptNode = latest;
          isGeneratingPrompt = false;
          imgExecBtn.style.display = 'block';

          alert('画像生成用プロンプトの出力が完了しました。\n\n１．この画面の内容を画面を閉じたら進めてください。\n２．思考モードをオンにする。\n３．画像生成モード（バナナマーク）をオンにする。\n４．「このプロンプトで画像を生成する」ボタンを押して生成をスタート。\n\nそれでは、進めてください。');

          statusDiv.textContent = '✅ サムネイル指示の生成が完了しました。内容を確認して「このプロンプトで画像を生成する」ボタンを押してください。';
          statusDiv.classList.add('show');
        }
      }
    }, 1000);
  }

  // =========================================================
  // 9. パネルUI本体
  // =========================================================
  function buildPanel() {
    if (document.getElementById(TOOL_ID)) return;

    const styleTag = document.createElement('style');
    styleTag.textContent = CSS;
    document.head.appendChild(styleTag);

    const isCollapsed = localStorage.getItem('eisai_collapsed') === 'true';

    const panel = createEl('div', { id: TOOL_ID }, document.body);
    if (isCollapsed) panel.classList.add('collapsed');

    const toggleBtn = createEl('button', { id: 'eisai-toggle-btn' }, document.body);
    toggleBtn.textContent = '📝 ブログツール';
    if (isCollapsed) toggleBtn.classList.add('collapsed');

    toggleBtn.onclick = () => {
      const collapsed = panel.classList.toggle('collapsed');
      toggleBtn.classList.toggle('collapsed');
      localStorage.setItem('eisai_collapsed', collapsed);
    };

    const header = createEl('div', { className: 'eisai-header' }, panel);
    const titleWrap = createEl('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, header);
    createEl('span', {}, titleWrap, '📝 英才ブログ生成（ブログ＋サムネイル）');
    const verSpan = createEl('span', { style: { fontSize: '11px', color: '#6b7280' } }, titleWrap, `v${CURRENT_VERSION} `);

    const headerRight = createEl('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } }, header);

    const updateBtn = createEl('button', {
      style: {
        fontSize: '11px',
        padding: '3px 6px',
        borderRadius: '4px',
        border: '1px solid #d1d5db',
        background: '#f9fafb',
        cursor: 'pointer',
        whiteSpace: 'nowrap'
      }
    }, headerRight, '更新');

    const closeBtn = createEl('button', { textContent: '←', style: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', padding: '4px 8px' } }, headerRight);
    closeBtn.title = 'サイドパネルを閉じる';
    closeBtn.onclick = () => {
      panel.classList.add('collapsed');
      toggleBtn.classList.add('collapsed');
      localStorage.setItem('eisai_collapsed', 'true');
    };

    updateBtn.onclick = () => {
      if (!UPDATE_URL) {
        alert('EISAI_BROGTESTはテスト版のため、自動更新は無効です。');
        return;
      }
      const ok = confirm(`現在のバージョン: v${CURRENT_VERSION} \n\n最新版を確認・インストールしますか？\n（Tampermonkeyのインストール画面が開きます）`);
      if (ok) {
        window.open(UPDATE_URL, '_blank');
      }
    };

    const content = createEl('div', { style: { padding: '14px', overflow: 'auto', flex: 1 } }, panel);

    const footer = createEl('div', {
      style: {
        position: 'sticky',
        bottom: 0,
        background: '#ffffff',
        borderTop: '1px solid #e5e7eb',
        padding: '12px 14px',
        boxShadow: '0 -2px 4px rgba(0,0,0,0.05)'
      }
    }, panel);

    const details = createEl('details', { className: 'eisai-details' }, content);
    createEl('summary', {}, details, '⚙️ 教室情報設定（1回入力すれば保存されます）');
    const dContent = createEl('div', { className: 'eisai-details-content' }, details);

    const nameIn = createInput(dContent, '校舎名（記事に反映されます）', '例：◯◯校　※校まで必ずいれる', false);
    const managerIn = createInput(dContent, '室長名（本文では名前のみ使用）', '例：●●', false);
    const areaIn = createInput(dContent, '対象エリア（冒頭あいさつ用・任意）', '例：武蔵新城・武蔵中原エリア', false);
    const urlIn = createInput(dContent, 'CTAリンク先URL（https://必須）', '例：https://eisai.org/…', false);
    const telIn = createInput(dContent, '電話番号（CTAの電話ボタン用）', '例：ハイフンなしで登録', false);

    const saved = getSetting();
    if (saved.name) nameIn.value = saved.name;
    if (saved.manager) managerIn.value = saved.manager;
    if (saved.area) areaIn.value = saved.area;
    if (saved.url) urlIn.value = saved.url;
    if (saved.tel) telIn.value = saved.tel;

    const saveBtn = createEl('button', {
      style: {
        padding: '6px 10px', fontSize: '12px', cursor: 'pointer',
        background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', marginTop: '4px'
      }
    }, dContent, '教室情報を保存');
    saveBtn.onclick = () => {
      saveSetting({ name: nameIn.value, manager: managerIn.value, area: areaIn.value, url: urlIn.value, tel: telIn.value });
      alert('教室情報を保存しました');
      details.open = false;
    };

    const gemNav = createEl('div', {
      style: {
        display: 'flex',
        gap: '8px',
        margin: '0 0 12px 0'
      }
    }, content);

    const blogGemBtn = createEl('button', {
      type: 'button',
      style: {
        flex: '1',
        padding: '8px 10px',
        borderRadius: '999px',
        border: '1px solid #bfdbfe',
        background: '#eff6ff',
        color: '#1d4ed8',
        fontSize: '12px',
        fontWeight: '700',
        cursor: 'pointer'
      }
    }, gemNav, 'ブログGemを開く');

    const thumbGemBtn = createEl('button', {
      type: 'button',
      style: {
        flex: '1',
        padding: '8px 10px',
        borderRadius: '999px',
        border: '1px solid #bbf7d0',
        background: '#f0fdf4',
        color: '#15803d',
        fontSize: '12px',
        fontWeight: '700',
        cursor: 'pointer'
      }
    }, gemNav, 'サムネイルGemを開く');

    blogGemBtn.onclick = () => {
      window.open(BLOG_GEM_URL, '_blank');
    };

    thumbGemBtn.onclick = () => {
      window.open(THUMBNAIL_GEM_URL, '_blank');
    };

    const step1 = createEl('div', { id: 'eisai-step1' }, content);
    const typeWrap = createEl('div', { className: 'eisai-type-wrap' }, step1);
    createEl('div', { className: 'eisai-label' }, typeWrap, '記事タイプを選択');
    const typeRow = createEl('div', { className: 'eisai-type-row' }, typeWrap);
    const typeButtons = [];
    function addTypeButton(type, label) {
      const btn = createEl('button', { className: 'eisai-type-btn' }, typeRow, label);
      btn.onclick = () => {
        currentBlogType = type;
        typeButtons.forEach(b => b.classList.remove('eisai-type-btn-active'));
        btn.classList.add('eisai-type-btn-active');
      };
      typeButtons.push(btn);
      return btn;
    }
    const btnGrowth = addTypeButton(BLOG_TYPES.GROWTH, '結果アップ・成長');
    addTypeButton(BLOG_TYPES.EVENT, '対策・イベント');
    addTypeButton(BLOG_TYPES.PERSON, '講師・室長・生徒');
    addTypeButton(BLOG_TYPES.SERVICE, 'サービス・相談');
    addTypeButton(BLOG_TYPES.SCORE, '点数アップ速報');
    addTypeButton(BLOG_TYPES.OTHER, 'その他');
    btnGrowth.classList.add('eisai-type-btn-active');

    const nextBtn = document.createElement('button');
    nextBtn.className = 'eisai-primary-btn';
    nextBtn.type = 'button';
    nextBtn.textContent = '次へ';
    nextBtn.style.cssText = 'width:100%;padding:10px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;margin-top:10px;font-size:14px;';
    step1.appendChild(nextBtn);

    const step2 = createEl('div', { id: 'eisai-step2', style: { display: 'none' } }, content);

    const selectedTypeLabel = createEl('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '8px 12px',
        marginBottom: '12px',
        background: '#e0e7ff',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: '600',
        color: '#3730a3'
      }
    }, step2);
    const selectedTypeText = createEl('span', {}, selectedTypeLabel, '📝 結果アップ・成長ストーリー');
    const sampleButtonWrap = createEl('div', {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        justifyContent: 'flex-end'
      }
    }, selectedTypeLabel);

    const formContainer = createEl('div', { id: 'eisai-form-container' }, step2);
    const formInputs = {};

    const TYPE_FORMS = {
      [BLOG_TYPES.GROWTH]: {
        label: '📝 結果アップ・成長ストーリー',
        hint: '短くてもOKです。実際に見た場面、生徒の変化、先生の一言が入ると記事が現場っぽくなります。',
        fields: [
          { key: 'student', label: '主役の生徒情報', placeholder: '例：中2・篠崎第二中・Aさん・数学', isArea: false },
          { key: 'before', label: 'ビフォー（課題・前回の状況）', placeholder: '例：前回45点。計算ミスが多く、途中式を書かないことが多かった', isArea: false },
          { key: 'after', label: 'アフター（成果・今回の結果）', placeholder: '例：今回84点。39点アップ。本人も「初めて数学が楽しい」と話していた', isArea: false },
          { key: 'actions', label: '教室で行った具体的なこと（3つ以上）', placeholder: '例：\n・毎回の授業冒頭で計算練習を10分\n・途中式をノートに残すルールを作った\n・テスト2週間前から学校ワークを2周\n・間違えた問題だけを解き直しリスト化', isArea: true },
          { key: 'reality', label: '現場で見えた変化・リアルな場面', placeholder: '例：最初は「どうせ無理」と言っていたが、2週間ほどで自習に来る回数が増えた。点数を見た時に少し照れながら笑っていた', isArea: true },
          { key: 'episode', label: '印象に残ったエピソード・室長コメント', placeholder: '例：結果だけでなく、途中式を書く習慣がついたことが一番大きな成長だと感じています', isArea: true }
        ]
      },
      [BLOG_TYPES.EVENT]: {
        label: '📅 対策・イベント紹介',
        hint: '日程や内容だけでなく、当日の雰囲気・参加した生徒の様子・現場で感じた課題を書いてください。',
        fields: [
          { key: 'eventName', label: 'イベント名・対象', placeholder: '例：冬期講習・中1〜中3対象', isArea: false },
          { key: 'flow', label: 'イベントの流れ・内容', placeholder: '例：\n・12/25〜1/7の14日間\n・1日2コマ×週3回\n・学校ワーク確認→苦手単元演習→確認テスト', isArea: true },
          { key: 'scene', label: '当日の雰囲気・生徒の様子', placeholder: '例：最初は眠そうな生徒もいたが、確認テストで点が取れると表情が明るくなった', isArea: true },
          { key: 'benefit', label: '生徒・保護者にとってのメリット', placeholder: '例：\n・冬休み明けテストに向けて苦手を整理できる\n・家では進みにくい学校ワークを教室で進められる', isArea: true },
          { key: 'example', label: '過去の実例・室長コメント（任意）', placeholder: '例：去年は講習後に英語が20点以上伸びた生徒もいました。早めに苦手を見つけることが大切です', isArea: true }
        ]
      },
      [BLOG_TYPES.PERSON]: {
        label: '👤 講師・室長・生徒紹介',
        note: '⚠️ サムネイル作成のため、紹介する人物の写真をチャットにアップロードしてください',
        hint: '経歴よりも「どんな声かけをする人か」「生徒とどう関わるか」を入れると温度感が出ます。',
        fields: [
          { key: 'personInfo', label: '紹介する人の基本情報', placeholder: '例：講師・田中先生・理系科目担当・3年目', isArea: false },
          { key: 'points', label: 'その人の「らしさ」ポイント（3つ以上）', placeholder: '例：\n・説明前に必ず生徒の考えを聞く\n・できたところを具体的にほめる\n・テスト前は自習にも声をかける', isArea: true },
          { key: 'episode', label: '印象的なエピソード', placeholder: '例：苦手だった生徒が「先生の授業だけは質問しやすい」と言ってくれた', isArea: true },
          { key: 'message', label: '室長として伝えたい一言', placeholder: '例：ただ教えるだけでなく、生徒が前向きになれる関わり方をしてくれる先生です', isArea: true }
        ]
      },
      [BLOG_TYPES.SERVICE]: {
        label: '💼 サービス・相談メニュー紹介',
        hint: 'サービス説明だけでなく、実際によくある相談内容や、面談で保護者が安心する場面を書いてください。',
        fields: [
          { key: 'serviceName', label: 'サービス名', placeholder: '例：無料学習相談会・無料体験授業', isArea: false },
          { key: 'target', label: 'よくある相談・悩み（3つ以上）', placeholder: '例：\n・家で勉強しているのに点数が上がらない\n・学校ワークの進め方がわからない\n・塾選びに迷っている', isArea: true },
          { key: 'flow', label: '相談・体験の流れ', placeholder: '例：\n・①お電話で予約\n・②ヒアリング30分\n・③体験授業\n・④ご報告', isArea: true },
          { key: 'scene', label: '実際の面談・体験でよくある場面', placeholder: '例：保護者の方が「何から始めればいいかわからなくて」と話され、学習状況を整理すると少し安心された様子だった', isArea: true },
          { key: 'goal', label: '利用後にどうなってほしいか', placeholder: '例：お子さまに合った勉強法が見つかり、親子で次の一歩を話しやすくなる状態', isArea: true }
        ]
      },
      [BLOG_TYPES.SCORE]: {
        label: '🎯 点数アップ速報',
        hint: '点数一覧だけでなく、代表ケースの「何を変えたか」を入れると説得力が出ます。',
        fields: [
          { key: 'testName', label: '対象テスト', placeholder: '例：2学期期末テスト・中1〜中3', isArea: false },
          { key: 'scoreList', label: '高得点・点数アップ一覧（1行1件）', placeholder: '例：中2 Aさん 数学 45→78点（+33点）\n中1 Bくん 英語 52→71点（+19点）\n中3 Cさん 理科 88点', isArea: true },
          { key: 'reason', label: '点数アップにつながった取り組み', placeholder: '例：\n・学校ワークを早めに終わらせた\n・間違えた問題を授業で解き直した\n・テスト前は自習に週3回来た', isArea: true },
          { key: 'comment', label: '速報から伝えたいこと', placeholder: '例：点数だけでなく、準備の仕方が変わってきたことが大きな成長です', isArea: true },
          { key: 'pickup', label: '代表ケース深掘りメモ（任意）', placeholder: '例：Aさんは毎回の小テストで間違えた単元を残し、テスト前にそこだけを重点的に復習した結果です', isArea: true }
        ]
      },
      [BLOG_TYPES.OTHER]: {
        label: '📄 その他',
        hint: '自由テーマでも、誰に・何を・なぜ伝えたいのかと、教室で実際に見えた場面を入れてください。',
        fields: [
          { key: 'theme', label: '今回のブログで伝えたいテーマ・主役', placeholder: '例：西中原中の定期テストで結果を出すには？', isArea: false },
          { key: 'target', label: '誰に向けて書きたいか', placeholder: '例：定期テスト前に何をすればいいか迷っている中学生の保護者', isArea: false },
          { key: 'actions', label: '教室や先生が行ったこと（箇条書き）', placeholder: '例：\n・テスト範囲の確認\n・苦手単元の洗い出し\n・類題演習\n・学校ワークの進捗確認', isArea: true },
          { key: 'episode', label: '現場エピソード・メッセージ', placeholder: '例：生徒たちが自習に来る回数が増え、質問の内容も具体的になってきました', isArea: true }
        ]
      }
    };

    const TEST_SAMPLES = {
      [BLOG_TYPES.GROWTH]: [
        {
          label: 'ペースト1',
          values: {
            student: '中2・篠崎第二中・Aさん・数学',
            before: '前回の定期テストは45点。計算ミスが多く、途中式を書かずに暗算で進めてしまうことが多かった。本人も「数学は苦手だから仕方ない」と少しあきらめ気味だった。',
            after: '今回の定期テストで84点。39点アップ。答案を返された時、本人が「初めて数学でこんな点を取れた」と少し照れながら話してくれた。',
            actions: '・毎回の授業冒頭で計算練習を10分行った\n・途中式をノートに残すルールを作った\n・学校ワークをテスト2週間前までに1周終わらせた\n・間違えた問題だけを解き直しリストにまとめた\n・テスト前の1週間は自習に来た日に確認テストを行った',
            reality: '最初は「どうせ数学は無理」と言っていたが、2週間ほど経つと自分から自習に来る回数が増えた。授業中も、以前は答えだけを書いていたが、途中式を見せながら「ここまでは合っていますか？」と質問できるようになった。',
            episode: '点数が上がったことももちろん嬉しいが、一番大きな成長は、解き方を丁寧に残す習慣がついたことだと感じています。Aさん自身が「やれば変わる」と実感できたことが、次のテストにもつながると思います。'
          }
        },
        {
          label: 'ペースト2',
          values: {
            student: '中1・西中原中・Bくん・英語',
            before: '入塾時は英単語を覚えることが苦手で、前回テストは52点。本文を読む前にあきらめてしまい、長文問題はほとんど空欄だった。',
            after: '今回の定期テストで76点。24点アップ。本人が「単語を覚えると読める文が増える」と話し、テスト後も自分から単語練習を続けている。',
            actions: '・授業前に英単語チェックを毎回実施した\n・間違えた単語だけを小さなカードにまとめた\n・教科書本文を1文ずつ日本語に直す練習をした\n・テスト範囲の本文を音読してから問題演習に入った\n・自習の日に10問だけ確認テストを行った',
            reality: '最初は単語テストで半分も取れず悔しそうにしていたが、3週目あたりから満点の日が増えた。授業中に「この単語、前にやったやつだ」と自分で気づける場面が出てきた。',
            episode: 'Bくんは一気に全部を変えたわけではありません。毎回の小さな確認を積み重ねたことで、英語に向き合う表情が変わってきました。'
          }
        }
      ],
      [BLOG_TYPES.EVENT]: [
        {
          label: 'ペースト1',
          values: {
            eventName: '篠崎第二中 定期テスト直前対策会・中1〜中3対象',
            flow: '・テスト範囲表を見ながら優先順位を確認\n・学校ワークの未完了部分をチェック\n・数学と英語は苦手単元ごとに演習\n・最後に10問の確認テストを実施',
            scene: '開始直後は学校ワークの残りに焦っている生徒もいたが、やる順番を一緒に決めると表情が落ち着いた。夕方には自分から質問に来る生徒が増えた。',
            benefit: '・テスト前に何をすればよいか整理できる\n・家では進みにくい学校ワークを教室で進められる\n・苦手単元を先生に質問しながら確認できる',
            example: '前回の対策会では、数学の計算分野を集中的に確認した生徒が、テスト本番で計算問題を落としにくくなりました。準備の仕方を整えることが大切です。'
          }
        },
        {
          label: 'ペースト2',
          values: {
            eventName: '冬期講習 学習リズム立て直し講座・中学生対象',
            flow: '・初回面談で冬休み中の目標を決める\n・苦手単元を1人ずつ確認\n・授業後にその日の復習内容を記録\n・講習後半で確認テストを実施',
            scene: '冬休みは生活リズムが崩れやすい時期だが、午前中から授業に来ることで表情がすっきりしている生徒が多かった。授業後に残って学校課題を進める姿も見られた。',
            benefit: '・冬休み中に勉強のペースを作れる\n・3学期につながる苦手単元を整理できる\n・学校課題を後回しにしにくくなる',
            example: '昨年も、冬期講習をきっかけに自習習慣がついた生徒がいました。短い休みでも、毎日の使い方で3学期のスタートは変わります。'
          }
        }
      ],
      [BLOG_TYPES.PERSON]: [
        {
          label: 'ペースト1',
          values: {
            personInfo: '講師・田中先生・数学と理科担当・大学2年生',
            points: '・説明する前に必ず生徒の考えを聞く\n・正解だけでなく途中式の良いところをほめる\n・質問しづらい生徒にも自然に声をかける',
            episode: 'ある中2の生徒が、最初は「質問するのが恥ずかしい」と話していました。田中先生は毎回「ここまではどう考えた？」と聞き、少しずつ生徒が自分の言葉で説明できるようになりました。',
            message: '田中先生は、ただ解き方を教えるだけでなく、生徒が安心して間違えられる空気を作ってくれる先生です。苦手な科目でも、前向きに取り組むきっかけを作ってくれます。'
          }
        },
        {
          label: 'ペースト2',
          values: {
            personInfo: '室長・湯浅・武蔵新城校・学習相談担当',
            points: '・最初に保護者と生徒の不安を丁寧に聞く\n・点数だけでなく勉強の進め方を見る\n・家庭学習で続けられる小さな行動まで決める',
            episode: '面談で「何から手をつければいいかわからない」と話していたご家庭がありました。まず学校ワークとテスト範囲を一緒に確認し、1週間でやることを3つに絞ると、親子で少し安心した表情になりました。',
            message: '勉強の悩みは、原因が一つとは限りません。だからこそ、まず状況を整理し、お子さまに合った一歩を一緒に見つけたいと考えています。'
          }
        }
      ],
      [BLOG_TYPES.SERVICE]: [
        {
          label: 'ペースト1',
          values: {
            serviceName: '無料学習相談会',
            target: '・勉強しているのに点数が上がらない\n・学校ワークがいつもテスト直前に残ってしまう\n・家での声かけがケンカになりやすい\n・塾を変えるべきか迷っている',
            flow: '・現在の成績や学習状況をヒアリング\n・学校ワークや答案を見ながら課題を整理\n・次のテストまでにやることを一緒に決める\n・必要に応じて体験授業を案内',
            scene: '面談では、保護者の方が「本人はやっていると言うけれど結果につながらない」と話されることが多いです。実際にノートや答案を見ると、勉強時間ではなくやり方に原因があるケースもあります。',
            goal: '相談後に、親子で「まず何から始めるか」が見える状態を目指します。入会するかどうかよりも、今の不安を整理する時間にしていただきたいです。'
          }
        },
        {
          label: 'ペースト2',
          values: {
            serviceName: '無料体験授業',
            target: '・先生との相性を見てから決めたい\n・個別指導が合うか試してみたい\n・苦手単元を1回見てもらいたい\n・教室の雰囲気を知りたい',
            flow: '・事前に苦手単元を確認\n・実際の個別指導を体験\n・授業後に理解度と課題を報告\n・今後の学習プランを提案',
            scene: '体験前は緊張していた生徒も、先生が横で声をかけながら進めると、少しずつ手が動き始めます。授業後に「ここなら質問しやすいかも」と話してくれる生徒もいます。',
            goal: '体験授業を通して、教室の雰囲気や先生との相性を確認していただきたいです。お子さまが前向きに通えるかどうかを大切にしています。'
          }
        }
      ],
      [BLOG_TYPES.SCORE]: [
        {
          label: 'ペースト1',
          values: {
            testName: '2学期期末テスト・篠崎第二中 中1〜中3',
            scoreList: '中2 Aさん 数学 45点→84点（+39点）\n中1 Bくん 英語 52点→76点（+24点）\n中3 Cさん 理科 68点→88点（+20点）\n中2 Dさん 社会 72点→91点',
            reason: '・学校ワークをテスト2週間前までに1周終わらせた\n・間違えた問題だけを解き直しリストにした\n・授業冒頭で確認テストを続けた\n・自習に来た日に先生へ質問する流れを作った',
            comment: '今回の結果で嬉しいのは、点数だけではありません。テスト前の準備の仕方が変わり、自分から質問する生徒が増えたことが大きな成長です。',
            pickup: 'Aさんは数学で途中式を書く習慣を徹底しました。最初は面倒がっていましたが、ミスの原因が見えるようになり、テスト本番でも落ち着いて解ける問題が増えました。'
          }
        },
        {
          label: 'ペースト2',
          values: {
            testName: '1学期期末テスト・武蔵新城校 通塾生結果',
            scoreList: '中1 Eさん 英語 88点\n中2 Fくん 数学 61点→80点（+19点）\n中3 Gさん 国語 70点→86点（+16点）\n中2 Hさん 理科 92点',
            reason: '・テスト範囲表を見て優先順位を決めた\n・苦手単元を授業で先に確認した\n・暗記科目は小テスト形式で反復した\n・テスト前の自習時間を固定した',
            comment: '高得点を取った生徒も、点数アップした生徒も、共通しているのは準備を早めに始めたことです。直前だけでなく、普段の積み重ねが結果につながりました。',
            pickup: 'Fくんは計算問題の取りこぼしが課題でした。毎回の授業で最初に5問だけ計算確認を続け、テスト前には自分でミスのパターンを説明できるようになりました。'
          }
        }
      ],
      [BLOG_TYPES.OTHER]: [
        {
          label: 'ペースト1',
          values: {
            theme: '定期テスト前に学校ワークを早く終わらせる大切さ',
            target: 'テスト直前に学校ワークが残ってしまう中学生の保護者',
            actions: '・テスト範囲表が出た日にワークのページ数を確認\n・1日ごとの進める量を一緒に決めた\n・授業のたびに進捗を確認\n・間違えた問題だけを解き直す時間を確保',
            episode: '毎回テスト直前に焦っていた生徒が、今回は1週間前にワークを終わらせることができました。その分、苦手な単元の解き直しに時間を使うことができ、本人も少し余裕を持ってテストに向かえました。'
          }
        },
        {
          label: 'ペースト2',
          values: {
            theme: '自習室をうまく使える生徒が増えています',
            target: '家だと集中できず、勉強時間の作り方に悩んでいる保護者',
            actions: '・自習に来る曜日を固定した\n・来たら最初に今日やることを先生に伝える\n・終わったらチェックを受ける\n・質問したい問題にふせんを貼る',
            episode: '最初は自習に来ても何をすればいいか迷っていた生徒が、最近は教室に来るとすぐに学校ワークを開くようになりました。小さなルールを決めるだけでも、勉強の始めやすさは変わります。'
          }
        }
      ]
    };

    function renderSampleButtons(type) {
      while (sampleButtonWrap.firstChild) {
        sampleButtonWrap.removeChild(sampleButtonWrap.firstChild);
      }

      const samples = TEST_SAMPLES[type] || [];
      samples.forEach(sample => {
        const btn = createEl('button', {
          type: 'button',
          style: {
            padding: '3px 7px',
            borderRadius: '999px',
            border: '1px solid #93c5fd',
            background: '#ffffff',
            color: '#1d4ed8',
            fontSize: '11px',
            fontWeight: '700',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }
        }, sampleButtonWrap, sample.label);

        btn.title = 'テスト用サンプルをフォームに入力';
        btn.onclick = () => applyTypeSample(type, sample);
      });
    }

    function applyTypeSample(type, sample) {
      formInputs[type] = formInputs[type] || {};
      Object.keys(sample.values).forEach(key => {
        const value = sample.values[key];
        formInputs[type][key] = value;
        const input = formInputs[type][key + '_el'];
        if (input) {
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      formStatusDiv.textContent = '✅ テスト用サンプルを入力しました。このまま「Geminiへ送信して記事生成」を押せます。';
      formStatusDiv.classList.add('show');
      resultStep.style.display = 'none';
      copyBtn.style.display = 'none';
      imgSection.style.display = 'none';
      lastBlogHtml = '';
    }

    function renderTypeForm(type) {
      while (formContainer.firstChild) {
        formContainer.removeChild(formContainer.firstChild);
      }
      formInputs[type] = formInputs[type] || {};
      const config = TYPE_FORMS[type];
      if (!config) return;

      selectedTypeText.textContent = config.label;
      renderSampleButtons(type);

      if (config.note) {
        createEl('div', {
          style: {
            fontSize: '12px',
            color: '#b91c1c',
            backgroundColor: '#fef2f2',
            padding: '8px',
            borderRadius: '6px',
            marginBottom: '10px',
            border: '1px solid #fecaca',
            fontWeight: 'bold'
          }
        }, formContainer, config.note);
      }

      if (config.hint) {
        createEl('div', {
          style: {
            fontSize: '12px',
            color: '#374151',
            backgroundColor: '#f8fafc',
            padding: '8px',
            borderRadius: '6px',
            marginBottom: '10px',
            border: '1px solid #e5e7eb',
            lineHeight: '1.6'
          }
        }, formContainer, config.hint);
      }

      config.fields.forEach(field => {
        const input = createInput(formContainer, field.label, field.placeholder, field.isArea);
        if (formInputs[type][field.key]) {
          input.value = formInputs[type][field.key];
        }
        input.addEventListener('input', () => {
          formInputs[type][field.key] = input.value;
        });
        formInputs[type][field.key + '_el'] = input;
      });
    }

    renderTypeForm(currentBlogType);

    typeButtons.forEach((btn, idx) => {
      const originalOnclick = btn.onclick;
      btn.onclick = () => {
        originalOnclick();
        renderTypeForm(currentBlogType);
      };
    });

    const step2BtnWrap = createEl('div', { style: { display: 'flex', gap: '8px', marginTop: '10px' } }, step2);
    const backBtn = createEl('button', {
      style: {
        flex: '1',
        padding: '10px',
        background: '#6b7280',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontWeight: '600',
        fontSize: '14px',
        cursor: 'pointer'
      }
    }, step2BtnWrap, '戻る');
    const genBtn = createEl('button', {
      style: {
        flex: '2',
        padding: '10px',
        background: '#1d4ed8',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontWeight: '600',
        fontSize: '14px',
        cursor: 'pointer'
      }
    }, step2BtnWrap, 'Geminiへ送信して記事生成');

    const returnResultBtn = createEl('button', {
      style: {
        display: 'none',
        width: '100%',
        padding: '10px',
        marginTop: '8px',
        background: '#16a34a',
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        fontWeight: '600',
        fontSize: '14px',
        cursor: 'pointer'
      }
    }, step2, '生成完了画面に戻る');

    nextBtn.onclick = function () {
      step1.style.display = 'none';
      step2.style.display = 'block';
    };
    backBtn.onclick = () => {
      step2.style.display = 'none';
      step1.style.display = 'block';
    };
    const formStatusDiv = createEl('div', { className: 'eisai-status' }, step2);

    const resultStep = createEl('div', { id: 'eisai-result-step', style: { display: 'none' } }, content);
    createEl('div', {
      style: {
        padding: '12px',
        marginBottom: '12px',
        background: '#dcfce7',
        borderRadius: '8px',
        fontSize: '16px',
        fontWeight: '700',
        color: '#166534'
      }
    }, resultStep, '✅ ブログ生成完了');
    createEl('div', {
      style: {
        padding: '10px',
        marginBottom: '12px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        fontSize: '13px',
        color: '#475569',
        lineHeight: '1.6'
      }
    }, resultStep, '入力内容は残っています。修正したい場合は「入力内容に戻る」から戻れます。');

    const statusDiv = createEl('div', { className: 'eisai-status show' }, resultStep);

    const editBackBtn = createEl('button', {
      style: {
        marginTop: '10px',
        width: '100%',
        padding: '10px',
        background: '#6b7280',
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        fontWeight: '600',
        fontSize: '14px',
        cursor: 'pointer'
      }
    }, resultStep, '入力内容に戻る');

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
    }, resultStep);

    const copyBtn = createEl('button', {
      style: {
        marginTop: '10px',
        width: '100%',
        padding: '10px',
        background: '#ef4444',
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        fontWeight: '600',
        fontSize: '14px',
        cursor: 'pointer',
        display: 'none'
      }
    }, resultStep, '▶ ブログHTMLをコピーする');

    const imgSection = createEl('div', {
      id: 'eisai-image-section',
      style: {
        display: 'none',
        marginTop: '16px',
        paddingTop: '12px',
        borderTop: '1px solid #e5e7eb'
      }
    }, resultStep);

    function showResultStep(message) {
      step1.style.display = 'none';
      step2.style.display = 'none';
      resultStep.style.display = 'block';
      statusDiv.textContent = message;
      statusDiv.classList.add('show');
      copyBtn.style.display = 'block';
      returnResultBtn.style.display = 'block';
      setTimeout(() => {
        resultStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }

    returnResultBtn.onclick = () => {
      if (!lastBlogHtml) {
        alert('まだコピーできるブログHTMLがありません。生成完了後に使えます。');
        return;
      }
      showResultStep(statusDiv.textContent || '✅ ブログ記事の生成が完了しました。下の赤いボタンからHTMLをコピーできます。');
    };

    editBackBtn.onclick = () => {
      resultStep.style.display = 'none';
      step1.style.display = 'none';
      step2.style.display = 'block';
      setTimeout(() => {
        step2.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    };

    createEl('p', { style: { fontWeight: 'bold', marginBottom: '6px' } }, imgSection,
      '🖼 サムネイル画像生成（ブログ用）');

    const openThumbGemFromSectionBtn = createEl('button', {
      type: 'button',
      style: {
        width: '100%',
        padding: '9px 10px',
        margin: '0 0 12px 0',
        borderRadius: '8px',
        border: '1px solid #bbf7d0',
        background: '#f0fdf4',
        color: '#15803d',
        fontSize: '13px',
        fontWeight: '700',
        cursor: 'pointer'
      }
    }, imgSection, 'サムネイルGemを開く');

    openThumbGemFromSectionBtn.onclick = () => {
      window.open(THUMBNAIL_GEM_URL, '_blank');
    };

    createEl('label', { className: 'eisai-label' }, imgSection, '画像スタイルを選択');
    const styleSelect = createEl('select', {
      className: 'eisai-input',
      style: { width: '100%', marginBottom: '8px' }
    }, imgSection);
    ['実写スタイル', 'アニメスタイル', 'インフォグラフィックスタイル', 'YOUTUBEスタイル', '漫画スタイル', 'インパクトスタイル'].forEach(label => {
      const opt = document.createElement('option');
      opt.value = label;
      opt.textContent = label;
      styleSelect.appendChild(opt);
    });

    createEl('label', { className: 'eisai-label' }, imgSection, '訴求スタイルを選択');
    const appealSelect = createEl('select', {
      className: 'eisai-input',
      style: { width: '100%', marginBottom: '8px' }
    }, imgSection);
    ['共感', '驚き', '笑顔', '不安煽る', 'ポジティブ', '最高'].forEach(label => {
      const opt = document.createElement('option');
      opt.value = label;
      opt.textContent = label;
      appealSelect.appendChild(opt);
    });

    createEl('label', { className: 'eisai-label' }, imgSection, 'メインカラーを選択');
    const mainColorSelect = createEl('select', {
      className: 'eisai-input',
      style: { width: '100%', marginBottom: '8px' }
    }, imgSection);
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

    createEl('label', { className: 'eisai-label' }, imgSection, 'サブカラーを選択');
    const subColorSelect = createEl('select', {
      className: 'eisai-input',
      style: { width: '100%', marginBottom: '8px' }
    }, imgSection);
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

    createEl('hr', { style: { margin: '12px 0', border: 'none', borderTop: '1px solid #e5e7eb' } }, imgSection);
    createEl('p', { style: { fontWeight: 'bold', marginBottom: '8px', color: '#374151' } }, imgSection,
      '✏️ サムネイルテキスト設定');

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
    }, imgSection);

    const toggleSwitch = createEl('input', {
      type: 'checkbox',
      id: 'omakase-toggle',
      checked: true,
      style: { marginRight: '8px', width: '16px', height: '16px', cursor: 'pointer' }
    }, toggleContainer);

    createEl('label', {
      htmlFor: 'omakase-toggle',
      style: { fontSize: '14px', fontWeight: '500', color: '#374151', cursor: 'pointer', userSelect: 'none' }
    }, toggleContainer, '🎯 おまかせモード（ブログから自動抽出）');

    const textInputsContainer = createEl('div', {
      id: 'text-inputs-container',
      style: { display: 'none' }
    }, imgSection);

    const mainCatchInput = createInput(textInputsContainer, 'メインキャッチフレーズ（必須）', '例：勉強が楽しくなる！', true);
    const subCatchInput = createInput(textInputsContainer, 'サブキャッチフレーズ（任意）', '例：個別指導で成績アップ', false);
    const pointsInput = createInput(textInputsContainer, 'ポイント・特徴（任意）', '例：安心のサポート体制', false);

    toggleSwitch.onchange = () => {
      textInputsContainer.style.display = toggleSwitch.checked ? 'none' : 'block';
    };

    const imgGenBtn = createEl('button', {
      id: 'eisai-gen-btn',
      style: {
        marginTop: '8px',
        width: '100%',
        padding: '10px',
        background: '#22c55e',
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        fontWeight: '600',
        fontSize: '14px',
        cursor: 'pointer'
      }
    }, imgSection, '▶ 画像生成用プロンプトを作成');

    const imgExecBtn = createEl('button', {
      style: {
        width: '100%',
        padding: '10px',
        background: '#0f766e',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        fontWeight: '500',
        fontSize: '14px',
        cursor: 'pointer',
        display: 'none',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }
    }, footer, 'このプロンプトで画像を生成する');

    imgGenBtn.onclick = () => {
      const style = styleSelect.value;
      const appeal = appealSelect.value;
      const mainColor = mainColorSelect.value;
      const subColor = subColorSelect.value;

      const isOmakase = toggleSwitch.checked;
      const mainCatch = isOmakase ? 'おまかせ' : (mainCatchInput.value.trim() || 'おまかせ');
      const subCatch = isOmakase ? 'おまかせ' : (subCatchInput.value.trim() || 'おまかせ');
      const points = isOmakase ? 'おまかせ' : (pointsInput.value.trim() || 'おまかせ');

      const isPersonType = currentBlogType === BLOG_TYPES.PERSON;
      const personThumbnailRules = isPersonType ? `
■ 人物紹介サムネイル専用ルール
  - このチャットにユーザーがアップロードした先生・講師・室長の写真を必ずベースにしてください
  - アップロードされた人物写真から人物のみを丁寧に切り抜き、元の背景は一切使用しないでください
  - 背景は透過前提で、メインカラーとサブカラーを生かしたグラデーションや図形を使ったおしゃれなグラフィック背景を新しくデザインしてください
  - 構図は統一します：人物は画面右側1/3にバストアップで配置し、左2/3をテキストエリアとして確保してください
  - 先生の表情は自然な笑顔で、清潔感のある服装にしてください
  - 顔や髪型など、人物の特徴はアップロードされた写真にできるだけ忠実に再現してください
  - 左側のテキストエリアに日本語フルネームとローマ字表記の2行構成で名前を表示してください
  - 名前とキャッチコピーは人物と重ならないように配置し、読みやすさを最優先してください
        ` : '';

      const input = document.querySelector('div[contenteditable="true"], rich-textarea div[contenteditable="true"]');
      if (!input) {
        alert('Geminiの入力欄が見つかりませんでした');
        return;
      }

      const promptRequest = `
@NANO BANANA PRO
【画像生成リクエスト】
以下のブログ記事の内容に基づき、定義されたスタイルで最高品質のサムネイル画像を生成するためのプロンプトを作成してください。

■ ブログ記事内容
${lastBlogHtml || 'ブログ記事が生成されていません。先にブログを生成してください。'}

■ 適用するスタイルパラメータ（英語）
1. Visual Style: ${VISUAL_STYLES[style] || style}
2. Emotion / Appeal: ${APPEAL_STYLES[appeal] || appeal}
3. Brand Rules: ${mainColor === 'お任せ' || subColor === 'お任せ' ? 'Color scheme optimized for appeal style' : `${COLOR_STYLES[mainColor]?.sub} and ${COLOR_STYLES[subColor]?.main} color scheme`}, Teacher as clean university student(male/female) wearing plain white lab coat with no text, professional appearance, clean composition, --ar 3:2
4. Text Design: Impactful text design: Bold 3D letters with drop shadows, gradient fills(${mainColor === 'お任せ' ? 'optimized gradient for appeal style' : COLOR_STYLES[mainColor]?.gradient}), thick outlines, dynamic positioning, maximum visibility, eye-catching typography, professional yet striking appearance
5. Classroom Setting: ${style === '実写スタイル' ? CLASSROOM_DESCRIPTION : 'Modern educational environment appropriate for ' + style}
6. Tutoring Style: ${TUTORING_STYLE}
7. Color Scheme: ${mainColor === 'お任せ' || subColor === 'お任せ' ? 'Colors automatically selected based on appeal style' : `Main color ${COLOR_STYLES[mainColor]?.main} (${COLOR_STYLES[mainColor]?.hex}), Sub color ${COLOR_STYLES[subColor]?.main} (${COLOR_STYLES[subColor]?.hex})`}

■ ユーザー入力情報
メインキャッチ：${mainCatch}
サブキャッチ：${subCatch}
ポイント：${points}
${personThumbnailRules}

■ キャッチフレーズ作成の原則（最高品質のテキスト生成）
【メインキャッチフレーズ】
- 文字数：10-15文字（超短く、インパクト重視）
- 心理トリガー：好奇心、不安煽り、期待感、緊急性
- 表現技法：「たった〇日で」「〇人が知らない」「ついに明らかに」
- 具体例：「たった2週間で33点アップ！」「99%の生徒が知らない勉強法」「ついに解明！伸びる子の共通点」

【サブキャッチフレーズ】
- 文字数：15-25文字（補足情報、具体性）
- 役割：メインの裏付け、信頼性構築、共感誘導

【ポイント・特徴】
- 文字数：8-12文字（キーワード、短いフレーズ）
- おまかせモード：Pointsは一切生成しないでください
- 手動入力モード：入力されている場合は必ずサムネイルに組み込む

■ 思考と生成プロセス
1. ブログ内容から学生の年代を判定（小学生/中学生/高校生）
2. ブログ内容を画像生成AIが理解しやすい英語描写に変換
3. 教師設定：さわやかな女子大生または男子大学生、白衣着用（文字なし）
4. キャッチフレーズ最適化
5. カラースタイル適用
6. 全要素を結合してプロンプト生成

■ 画像生成プロンプトの要件
- 画像サイズは必ず3:2比率で指定
- 視認性の高いテキスト配置、読みやすさを最優先
- 構図は画面全体を使い、不自然な空白エリアを作らないこと
- 【最重要】塾名「英才個別学院」や類似の文字を背景や画像内に一切表示しないこと
- 【禁止】同じテキストを複数回表示しないこと

■ 出力形式
---
以下のプロンプトで画像を生成してください

[ここに詳細な画像生成プロンプト]

このプロンプトで画像を生成してください。
---

【重要】プロンプトを出力のみで、画像は生成しないでください。`;

      statusDiv.textContent = '🎯 画像生成用プロンプトを作成しています...';
      statusDiv.classList.add('show');
      imgExecBtn.style.display = 'none';

      isGeneratingPrompt = true;
      lastPromptNode = null;

      input.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, promptRequest);
      input.dispatchEvent(new Event('input', { bubbles: true }));

      sendMessageViaEnter(input);
      watchThumbnailPrompt(statusDiv, imgExecBtn);
    };

    genBtn.onclick = async () => {
      const typeData = formInputs[currentBlogType] || {};
      const config = TYPE_FORMS[currentBlogType];

      const firstField = config.fields[0];
      const firstValue = typeData[firstField.key] || '';
      if (!firstValue.trim()) {
        alert(`「${firstField.label}」を入力してください`);
        return;
      }

      const info = getSetting();
      const kosha = (info.name || '').trim();
      const shichou = (info.manager || '').trim();
      const area = (info.area || '').trim();
      let ctaUrl = (info.url || '').trim();
      const ctaTel = (info.tel || '').trim();

      if (!kosha) { alert('校舎名を設定してください\n例：◯◯校 ※校までいれてください。'); return; }
      if (!shichou) { alert('室長名（本文に出す名前）を設定してください'); return; }
      if (!ctaUrl) { alert('CTAリンク先URL（体験フォームやお問い合わせページのURL）を設定してください。\n例：https://eisai.org/〇〇'); return; }
      if (!ctaTel) { alert('電話番号を設定してください\n例：00000000000 ※ハイフンなし'); return; }
      if (!/^https?:\/\//i.test(ctaUrl)) ctaUrl = 'https://' + ctaUrl;

      let formContent = '';
      config.fields.forEach(field => {
        const val = typeData[field.key] || '';
        if (val.trim()) {
          formContent += `${field.label}: ${val}\n\n`;
        }
      });

      const TYPE_INSTRUCTIONS = {
        [BLOG_TYPES.GROWTH]: `【記事タイプ】成長ストーリー型
【構成指示】
- 導入：生徒の課題や悩みに共感する書き出し
- 本文：ビフォー→取り組み→アフターの流れで構成
- 現場で見えた変化・教室での具体的な取り組みを必ず入れる
- 見出し例：「〇〇さんの挑戦」「教室で取り組んだこと」「結果と変化」
- 締め：同じ悩みを持つ保護者への励ましメッセージ`,
        [BLOG_TYPES.EVENT]: `【記事タイプ】イベント紹介型
【構成指示】
- 導入：イベントの目的や対象者への呼びかけ
- 本文：内容・流れ・得られるものを具体的に紹介
- 当日の雰囲気・参加した生徒の様子・室長目線を入れる
- 見出し例：「〇〇講習の特徴」「参加するとどうなる？」
- 締め：参加を検討している保護者への後押しメッセージ`,
        [BLOG_TYPES.PERSON]: `【記事タイプ】人物紹介型
【構成指示】
- 導入：紹介する人との出会いや印象
- 本文：その人の特徴・エピソードを具体的に紹介
- 経歴だけでなく、生徒への声かけや関わり方が伝わる場面を入れる
- 見出し例：「〇〇先生ってこんな人」「印象に残ったエピソード」
- 締め：保護者への安心感を与えるメッセージ`,
        [BLOG_TYPES.SERVICE]: `【記事タイプ】サービス紹介型
【構成指示】
- 導入：対象となる悩みへの共感
- 本文：サービス内容・流れ・利用後のイメージを紹介
- 実際によくある相談内容や、面談・体験で安心につながる場面を入れる
- 見出し例：「こんなお悩みありませんか？」「相談の流れ」「利用された方の声」
- 締め：気軽に相談できることを伝えるメッセージ`,
        [BLOG_TYPES.SCORE]: `【記事タイプ】点数アップ速報型
【構成指示】
- 導入：テスト結果への喜びと生徒への称賛
- 本文：点数アップ一覧を見やすく紹介し、代表ケースを深掘り
- 【重要】入力された「高得点・点数アップ一覧」は、省略せずに全てリスト形式で記載すること
- 点数だけでなく、点数アップにつながった行動・授業での取り組みを入れる
- 見出し例：「今回のテスト結果速報！」「特に頑張った生徒たち」
- 締め：次のテストに向けた意気込みと保護者へのメッセージ`,
        [BLOG_TYPES.OTHER]: `【記事タイプ】自由テーマ型
【構成指示】
- 導入：テーマに合わせた書き出し
- 本文：伝えたい内容を自然な流れで構成
- 入力された現場エピソードや教室で実際に見えた場面を中心に書く
- 締め：保護者への前向きなメッセージ`
      };

      const typeInstruction = TYPE_INSTRUCTIONS[currentBlogType] || TYPE_INSTRUCTIONS[BLOG_TYPES.OTHER];

      const prompt = `あなたは英才個別学院の教室ブログ専門ライターです。
以下の入力情報をもとに、保護者向けブログ記事の本文素材をJSONで作成してください。
最終的なHTML化とCTA装飾はBROGTEST側で行います。あなたはJSONだけを返してください。

【今回の最重要方針】
- 主役は article です。cta は最後に添える補助データです。
- まず article の本文を十分に書いてください。cta だけ、相談ポイントだけ、要約だけの出力は禁止です。
- JSONオブジェクト1つだけを出力してください。Markdown、コードブロック、前置き、解説、HTMLタグは出力しないでください。

【本文の書き方ルール】
- 冒頭は、保護者の不安や悩みに寄り添うところから始めてください。いきなり成果や宣伝から入らないでください。
- 保護者、とくにお母さんが「うちの子にも当てはまるかもしれない」「一人で抱え込まなくていいかもしれない」と感じる温度で書いてください。
- 家で見える不安、親子でピリピリしてしまう気持ち、声かけに迷う気持ちにやさしく触れてください。ただし保護者を責めないでください。
- 文体は敬体を基本にしつつ、少し近い距離で話しかけてください。「ですよね」「かもしれません」「まずは」「少しずつ」のような自然な言葉を使ってください。
- 「〜いたします」「〜させていただきます」「ご確認ください」「サポートいたします」などの硬い業務文は使いすぎないでください。
- 本文は自然な段落で書いてください。箇条書きは補助だけにし、本文の中心にしないでください。
- 各段落は1〜2文程度で短くしてください。長い説明を1段落に詰め込まないでください。
- 読み手がスマホで読んでも疲れないように、こまめに話を区切ってください。
- 本文段落は、読点「、」で自然に改行される前提で、1文を長くしすぎないでください。リスト項目はこの限りではありません。
- 「何をしたか」だけでなく、「生徒がどう変わったか」「教室でどんな場面があったか」を書いてください。
- 入力された学校名、学年、教科、点数、期間、生徒の様子、先生・室長コメントを本文に反映してください。
- 室長目線は売り込みではなく、そばで見守っていた人の言葉として自然に入れてください。「嬉しかった」「ほっとした」「印象に残った」などの感情を、過度に熱くしすぎずに入れてください。
- 一般論だけの記事にしないでください。必ず入力情報に基づいた具体的な場面を書いてください。
- 入力にない実績、点数、学校名、生徒発言、キャンペーンは作らないでください。
- 大げさな広告表現、断定表現、「必ず伸びる」「絶対合格」は使わないでください。

【装飾用データの作り方】
- BROGTEST側でHTML装飾するため、読ませたい部分をJSON項目として分けてください。
- article.empathyBox は、保護者の気持ちに寄り添う短い共感ボックスです。1つだけ作ってください。
- section.highlights は、本当に読ませたい一文だけにしてください。記事全体で2〜4個までが目安です。各セクションに必ず入れる必要はありません。
- section.bullets は、手順・取り組み・チェックポイントなど、3項目以上で整理した方が読みやすい時だけ使ってください。本文で自然に読ませる方がよい内容はリスト化しないでください。
- section.dialogues は、保護者と室長の短いやりとりにすると読みやすい場面だけ使ってください。不要なら空配列または省略してください。
- section.managerNote は、室長の思いや感情が伝わる短いコメントです。全セクションに入れる必要はありませんが、本文全体で1〜2個は入れてください。
- article.photoSuggestions は必須です。空配列は禁止です。最低3個、理想は5個作り、「どのセクションの後に」「どんな写真を入れるとよいか」を具体的に書いてください。
- 写真候補は文章の流れに沿って、冒頭・取り組み・変化・成果・室長/教室の安心感が伝わる位置に分散してください。
- photoSuggestions.label は「お悩み写真」「ノートの写真」「自習風景」「成果の写真」「室長・先生の写真」のように、写真挿入（◯◯）として1行表示して意味が伝わる短い名前にしてください。
- photoSuggestions.description は内部メモ扱いです。最終HTMLには表示しないため、説明文を読ませる前提で書かないでください。
- 読ませたい言葉は必要な箇所だけカギカッコ「」で囲んでください。囲みすぎは禁止です。
- 点数、期間、回数などの数字はできるだけ具体的に書いてください。BROGTEST側で赤字・大きめ文字に装飾します。
- 装飾が多すぎると読みづらくなります。強調は1段落に1つまで、何も強調しない段落があって自然です。

【冒頭あいさつ】
- article.greeting を必ず1段落入れてください。
- 対象エリアがある場合は「${area || '◯◯エリア'}の個別指導塾、英才個別学院 ${kosha} 室長の${shichou}です！」のように始めてください。
- 対象エリアが空欄の場合は「英才個別学院 ${kosha} 室長の${shichou}です！」のように始めてください。
- あいさつの後に、「今日は、〜についてお話しします。」という自然な導入を続けてください。
- 毎回まったく同じ定型文にせず、記事内容に合わせて少し変化をつけてください。

【文章量と構成】
- article.greeting は1段落。
- article.lead は2段落。
- article.sections は3〜4個。
- 各 section.paragraphs は2段落以上。
- section.highlights は記事全体で2〜4個まで。
- section.dialogues は必要な時だけ0〜2セット。
- section.managerNote は本文全体で1〜2個。
- article.photoSuggestions は必ず3〜5個。本文の流れに合わせて、写真を入れると読みやすくなる位置を具体的に指定してください。
- article.closing は2段落。
- 本文全体は900〜1400字程度。
- cta は短く簡潔に。articleより目立たせないでください。
- cta.closingMessage は記事内容に合わせた具体的な一文にしてください。
- 「誠心誠意サポート」「全力でサポート」「お待ちしております」のような定型句しか書けない場合、cta.closingMessage は空文字 "" にしてください。

【JSON形式】
{
  "article": {
    "title": "32文字以内のブログタイトル",
    "greeting": ["冒頭のあいさつ段落"],
    "lead": ["保護者の不安に寄り添う導入段落", "入力内容につながる導入段落"],
    "empathyBox": {
      "label": "お母さんへ",
      "paragraphs": ["読み手の不安に寄り添う短い共感文"]
    },
    "sections": [
      {
        "heading": "見出し",
        "paragraphs": ["自然な本文段落", "現場感のある本文段落"],
        "highlights": ["本当に読ませたい一文"],
        "bulletTitle": "取り組みポイント",
        "bullets": ["リスト化した方が読みやすい具体項目"],
        "dialogues": [
          { "speaker": "保護者", "text": "自然な短い相談の言葉" },
          { "speaker": "室長", "text": "それに対する短い返答" }
        ],
        "managerNote": "室長の思いや感情が伝わる短いコメント"
      }
    ],
    "photoSuggestions": [
      {
        "afterSection": 0,
        "label": "お悩み写真",
        "description": "この位置に入れるとよい写真の内容"
      },
      {
        "afterSection": 1,
        "label": "ノートの写真",
        "description": "この位置に入れるとよい写真の内容"
      },
      {
        "afterSection": 3,
        "label": "成果の写真",
        "description": "この位置に入れるとよい写真の内容"
      }
    ],
    "closing": ["保護者への前向きな結び", "相談へ自然につなげる結び"]
  },
  "cta": {
    "description1": "記事内容に合わせた、不安を解消する一言",
    "description2": "教室見学や相談へのハードルを下げる優しい一言",
    "consultationPoints": ["相談内容1", "相談内容2", "相談内容3", "相談内容4"],
    "trialPoints": ["体験で得られるメリット1", "体験で得られるメリット2", "体験で得られるメリット3", "体験で得られるメリット4"],
    "closingMessage": "記事内容に合わせた具体的な一文。定型句しか書けない場合は空文字"
  }
}

【禁止】
- articleなしの出力は禁止です。
- ctaだけの出力は禁止です。
- HTMLタグを出力しないでください。
- CTA_DATA_START / CTA_DATA_END を出力しないでください。
- 説明文1、相談ポイント、体験ポイントだけの出力は禁止です。
- JSON以外の文章を出力しないでください。

【教室情報】
校舎名: ${kosha}
室長名: ${shichou}
対象エリア: ${area || '未設定'}

${typeInstruction}

【入力情報】
${formContent}`;

      formStatusDiv.textContent = isBlogGemPage()
        ? '📨 ブログGemへ送信しました。生成が完了したら、完了画面に切り替わります。入力内容はこのまま残ります。'
        : '📨 ブログGemへ移動して送信します。Gemが開いたら自動で入力・送信されます。';
      formStatusDiv.classList.add('show');
      resultStep.style.display = 'none';
      returnResultBtn.style.display = 'none';
      copyBtn.style.display = 'none';
      imgSection.style.display = 'none';
      imgExecBtn.style.display = 'none';
      lastBlogHtml = '';

      if (!isBlogGemPage()) {
        savePendingBlogPrompt(prompt);
        localStorage.setItem('eisai_collapsed', 'false');
        location.href = BLOG_GEM_URL;
        return;
      }

      const sent = await insertPromptAndSend(prompt);
      if (!sent) {
        alert('Geminiの入力欄が見つかりませんでした。ブログGemが開いているか確認してください。');
        return;
      }

      watchBlogResponseAndEnableCopy(formStatusDiv, copyBtn, showResultStep);
    };

    copyBtn.onclick = async () => {
      if (!lastBlogHtml) {
        alert('コピーできるブログHTMLがまだありません。\nまずは「Geminiへ送信して記事生成」を実行してください。');
        return;
      }

      try {
        await navigator.clipboard.writeText(lastBlogHtml);
      } catch (e) {
        console.error('Clipboard write failed:', e);
        alert('クリップボードへのコピーに失敗しました。\n(ブラウザの権限設定を確認してください)');
        return;
      }

      const toast = document.getElementById('eisai-copy-toast');
      if (toast) {
        toast.style.display = 'block';
        toast.textContent = '✅ ブログHTMLをコピーしました。\nこのまま WordPress などに貼り付けてご利用ください。';
        setTimeout(() => { toast.style.display = 'none'; }, 2000);
      }

      imgSection.style.display = 'block';
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
      const nodes = document.querySelectorAll('.markdown-main-panel, .model-response-text');
      if (!nodes.length && !lastPromptNode) {
        alert('Geminiの出力が見つかりませんでした。サムネイル指示の生成が完了してからもう一度試してください。');
        return;
      }

      const latest = lastPromptNode || nodes[nodes.length - 1];
      const prompt = latest.innerText || latest.textContent || '';

      try {
        await navigator.clipboard.writeText(prompt);
      } catch (e) {
        console.warn('プロンプトコピーに失敗しましたが、送信は続行します:', e);
      }

      const input = document.querySelector('div[contenteditable="true"], rich-textarea div[contenteditable="true"]');
      if (!input) {
        alert('Geminiの入力欄が見つかりませんでした');
        return;
      }

      statusDiv.textContent = '🖼 画像生成プロンプトを送信しました。画像が生成されます。';
      statusDiv.classList.add('show');

      input.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, prompt);
      input.dispatchEvent(new Event('input', { bubbles: true }));

      sendMessageViaEnter(input);
    };

    async function runPendingBlogPromptIfNeeded() {
      if (!isBlogGemPage()) return;

      const pending = loadPendingBlogPrompt();
      if (!pending) return;
      localStorage.removeItem(PENDING_BLOG_PROMPT_KEY);

      step1.style.display = 'none';
      step2.style.display = 'block';
      resultStep.style.display = 'none';
      formStatusDiv.textContent = '📨 ブログGemを開きました。保存していた入力内容を自動送信しています...';
      formStatusDiv.classList.add('show');
      copyBtn.style.display = 'none';
      imgSection.style.display = 'none';
      imgExecBtn.style.display = 'none';
      lastBlogHtml = '';

      const sent = await insertPromptAndSend(pending.prompt);
      if (!sent) {
        formStatusDiv.textContent = '❌ ブログGemの入力欄を検出できませんでした。ページの読み込み完了後、もう一度「Geminiへ送信して記事生成」を押してください。';
        formStatusDiv.classList.add('show');
        return;
      }

      formStatusDiv.textContent = '📨 ブログGemへ送信しました。生成が完了したら、完了画面に切り替わります。';
      formStatusDiv.classList.add('show');
      watchBlogResponseAndEnableCopy(formStatusDiv, copyBtn, showResultStep);
    }

    runPendingBlogPromptIfNeeded();
  }

  // =========================================================
  // ★ 修正箇所：isNewChatPage() のURL判定を修正
  // =========================================================
  function isNewChatPage() {
    const path = location.pathname;
    // /app または /app/ のみが新規チャット画面
    // /app/xxxxxxx のようなチャット中ページは除外
    return path === '/app' || path === '/app/' || isBlogGemPage() || isThumbnailGemPage();
  }

  function ensureButton() {
    if (!isNewChatPage()) {
      const exist = document.getElementById(BTN_ID);
      if (exist) exist.remove();
      return;
    }
    if (document.getElementById(BTN_ID)) return;

    if (isBlogGemPage() && loadPendingBlogPrompt() && !document.getElementById(TOOL_ID)) {
      buildPanel();
    }

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
        background: '#2563eb',
        borderRadius: '50%',
        cursor: 'pointer',
        border: '2px solid #1e3a8a',
        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
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
      btn.style.boxShadow = '0 6px 18px rgba(37, 99, 235, 0.45)';
      btn.style.background = '#1d4ed8';
    };
    btn.onmouseout = () => {
      btn.style.transform = 'translateY(-50%) scale(1)';
      btn.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.35)';
      btn.style.background = '#2563eb';
    };

    btn.classList.add('eisai-btn-pulse');
    setTimeout(() => btn.classList.remove('eisai-btn-pulse'), 6000);

    btn.onclick = () => {
      const panel = document.getElementById(TOOL_ID);
      if (!panel) buildPanel();
      else panel.style.display =
        (panel.style.display === 'none' || panel.style.display === '') ? 'flex' : 'none';
    };
  }

  setInterval(ensureButton, 1000);
})();
