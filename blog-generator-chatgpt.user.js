// ==UserScript==
// @name         Eisai Blog Generator for ChatGPT
// @namespace    http://tampermonkey.net/
// @version      0.1.32
// @description  英才ブログ生成ツール (ChatGPT対応 / Gemini版とは別ファイル)
// @author       Yuan
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @updateURL    https://raw.githubusercontent.com/honbueisai/blog-tools/feature/chatgpt-blog-generator/blog-generator-chatgpt.user.js
// @downloadURL  https://raw.githubusercontent.com/honbueisai/blog-tools/feature/chatgpt-blog-generator/blog-generator-chatgpt.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const TOOL_ID = 'eisai-chatgpt-tool-v0-1-32';
  const BTN_ID = 'eisai-chatgpt-btn-v0-1-32';
  const STORAGE_KEY = 'eisai_chatgpt_blog_info_v0132';
  const CLASSROOM_STORAGE_KEY = 'eisai_classroom_settings_persistent';
  const CURRENT_VERSION = '0.1.32';
  const UPDATE_URL = 'https://raw.githubusercontent.com/honbueisai/blog-tools/feature/chatgpt-blog-generator/blog-generator-chatgpt.user.js';
  const TEST_MODE_STORAGE_KEY = 'eisai_chatgpt_test_mode_enabled';
  const PANEL_WIDTH = 420;
  const PANEL_TAB_WIDTH_FALLBACK = 42;
  const PANEL_OPEN_LAYOUT_CLASS = 'eisai-chatgpt-panel-open';
  const TEST_CLASSROOM = {
    name: '英才テスト校',
    manager: '山田',
    area: '架空エリア',
    url: 'https://example.com/eisai-test-form',
    tel: '0000000000'
  };

  const BLOG_TYPES = {
    GROWTH: 'growth_story',
    EVENT: 'event',
    PERSON: 'person',
    SERVICE: 'service',
    SCORE: 'score_summary',
    OTHER: 'other'
  };

  let currentBlogType = BLOG_TYPES.GROWTH;

  syncTestModeFlagFromLocation();
  console.log(`🚀 英才ブログ生成ツール ChatGPT版 v${CURRENT_VERSION} 起動`);
  if (isTestModeEnabled()) {
    console.log('🧪 英才ブログ生成ツール ChatGPT版 テストモード有効');
  }

  let lastBlogHtml = '';

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

  const CLASSROOM_DESCRIPTION = 'A bright, clean, modern Japanese cram school classroom filled with soft natural light. Large windows with sheer white curtains diffuse daylight evenly across the room, creating a gentle, calm atmosphere. The interior is minimalist and white-based: smooth white walls, white ceilings, and uncluttered decor. White rectangular desks with simple, modern legs are arranged in rows, providing wide workspace for two people to sit side-by-side. On the desks are neatly arranged study materials such as notebooks, pens, and open textbooks, without clutter. Chairs are lightweight, white plastic with small perforations on the backrest, matching the clean and modern design of the room. The overall space feels open, bright, and warm, with a soft photographic depth of field and natural diffusion that highlights a quiet, studious environment.';

  const TUTORING_STYLE = 'Two people sit side-by-side at a white desk, engaging in a tutoring session. Their clothing is not specified (could be white coat, uniform, or casual wear), and the faces or identities are not emphasized. They are positioned horizontally next to each other, never facing each other. One person provides gentle academic guidance while the other takes notes or works through a problem. Hands, textbooks, and writing tools are visible on the desk, capturing the natural movement of a study session without defining who the individuals are. The focus is on the interaction and learning atmosphere, not the identity of the participants.';

  const THUMBNAIL_ART_DIRECTIONS = [
    'Modern Score Editorial: one large result number as the hero, flat bold Japanese typography, clean sticker badge, real answer sheet or notebook detail, high contrast without glossy 3D',
    'Evidence Photo Poster: full-bleed close-up of notebook, answer sheet, red pen marks, worksheet, or hands in action; text placed as a compact editorial lockup',
    'Soft Before After: before/after contrast using lighting, crop, blur, or overlapping panels; avoid a harsh vertical divider unless it genuinely improves clarity',
    'Parent Question Hook: one strong parent concern as the headline, calm but clickable photo, warm editorial palette, no panic-ad look',
    'Student Change Moment: the visual hook is a changed behavior or emotion, with a short quote or result badge as support',
    'Answer Sheet Hero: paper texture, score marks, red pen, test result, and correction details as the main visual; no generic classroom stock feel',
    'Teacher Support Documentary: natural teacher/student guidance only when it supports the article; candid, close, realistic, not staged advertising',
    'Infographic Magazine: clean diagram, timeline, arrows, score transition, checklist, and modern magazine layout with generous spacing',
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

  const THUMBNAIL_TYPE_OPTIONS = {
    'おまかせ': 'Auto-select the strongest thumbnail objective from the article. Choose based on the main visual hook, not on a fixed template.',
    '点数アップ強調': 'Score/result focused thumbnail. Make the score, point increase, or visible result the strongest visual and text element.',
    'ノート・答案主役': 'Evidence-object thumbnail. Use notebook, answer sheet, red pen marks, worksheet, or study materials as the hero visual.',
    'Before / After': 'Before-after thumbnail. Clearly contrast the previous struggle and the later improvement in a split or paired composition.',
    '保護者の悩み共感': 'Parent pain-point thumbnail. Lead with the parent concern or question, using a calmer but still readable design.',
    '生徒の変化ストーリー': 'Student change-story thumbnail. Show the moment of behavioral or emotional change as the hook.',
    '先生・人物紹介': 'Person spotlight thumbnail. Use the teacher/student/person as the hero with name and personality cue.',
    'イベント告知': 'Event/campaign thumbnail. Prioritize who it is for, when it happens, and why it matters.'
  };

  const VISUAL_EXPRESSION_OPTIONS = {
    'おまかせ': 'Auto-select the visual expression that best fits the selected thumbnail objective and article content.',
    '実写': VISUAL_STYLES['実写スタイル'],
    'アニメ': VISUAL_STYLES['アニメスタイル'],
    '漫画': VISUAL_STYLES['漫画スタイル'],
    'インフォグラフィック': VISUAL_STYLES['インフォグラフィック']
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
  // 2. ブログ用 MASTER_YAML
  // =========================================================
  const MASTER_YAML = [
    "あなたは英才個別学院の教室ブログを書く専門ライターです。",
    "保護者向けに、現場感のある自然な日本語で、ブログ記事をHTMLで書いてください。",
    "",
    "------------------------------",
    "教室情報",
    "------------------------------",
    "校舎: __KOSHA__",
    "室長: __SHICHOU__",
    "",
    "------------------------------",
    "入力された現場情報",
    "------------------------------",
    "__INPUT_BLOCK__",
    "",
    "------------------------------",
    "出力フォーマット（このHTML構造をそのまま埋めて出力してください）",
    "------------------------------",
    "<h1>記事タイトル（32文字以内）</h1>",
    "<p>導入文。保護者の不安に寄り添う書き出し。</p>",
    "<h2>1つ目の見出し（例: 生徒の状況や課題）</h2>",
    "<p>具体的な状況や場面の描写。</p>",
    "<h2>2つ目の見出し（例: 教室で行った取り組み）</h2>",
    "<p>教室で実施した取り組みと、結果や変化につながった理由。</p>",
    "<h2>まとめ</h2>",
    "<p>同じ悩みを持つ保護者への前向きなメッセージで締める。</p>",
    "<!--CTA_DATA_START-->",
    "説明文1：記事内容に合わせた、不安を解消する一言（1行）",
    "説明文2：教室見学や相談へのハードルを下げる優しい一言（1行）",
    "相談ポイント1：記事関連の相談内容1（1行）",
    "相談ポイント2：記事関連の相談内容2（1行）",
    "体験ポイント1：体験で得られるメリット1（1行）",
    "体験ポイント2：体験で得られるメリット2（1行）",
    "締めの言葉：__KOSHA__室長 __SHICHOU__より、心を込めた最後のメッセージ（1行）",
    "<!--CTA_DATA_END-->",
    "",
    "------------------------------",
    "絶対ルール（守れない応答は失敗扱いになります）",
    "------------------------------",
    "1. あなたの応答の【最初の文字】は必ず `<h1>` にしてください。前置き・解説・コードブロックは禁止です。",
    "2. 「説明文1：…」「相談ポイント1：…」のような CTA素材だけを返してはいけません。本文HTML（<h1>〜<h2>まとめのパラグラフまで）が無い応答は失敗扱いです。",
    "3. 本文HTMLは合計800〜1200字程度に収め、`<h2>` は3個、`<p>` は4〜7個を目安にしてください。冗長に書かないでください。",
    "4. 本文HTMLの末尾に必ず <!--CTA_DATA_START--> と <!--CTA_DATA_END--> で囲んだCTA素材ブロックを1回だけ付けてください。",
    "5. ```html などのコードブロック、Markdown見出し（#, ##）、絵文字、英語の分析文、思考プロセスは出力しないでください。",
    "6. 「もちろんです」「以下に作成します」「こちらがHTMLです」などの前置き・後置きは禁止です。",
    "7. 申し込みボタンHTML、電話リンク、CTAリンクのHTMLは出力しないでください（CTAの見た目は別ツール側で生成します）。",
    "8. 入力されていない点数・学校名・合格校・生徒発言・キャンペーン・実績は作らないでください。",
    "9. 「必ず伸びる」「絶対合格」などの断定的な広告表現は禁止です。",
    "",
    "それでは、上の【入力された現場情報】を使って、【出力フォーマット】の構造どおりに記事をHTMLで書いてください。応答は `<h1>` から始めてください。"
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

  const CHATGPT_ADAPTER = {
    getComposer() {
      const selectors = [
        '#prompt-textarea',
        '[contenteditable="true"][id="prompt-textarea"]',
        'div.ProseMirror[contenteditable="true"]',
        'textarea#prompt-textarea',
        'main form textarea',
        'main form [contenteditable="true"]'
      ];

      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && !el.closest(`#${TOOL_ID}`)) return el;
      }
      return null;
    },

    setComposerText(input, text) {
      if (!input) return false;
      input.focus();

      if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
        const descriptor = Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value');
        const setter = descriptor && descriptor.set;
        if (setter) setter.call(input, text);
        else input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }

      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: text
      }));
      return true;
    },

    async send(input) {
      await sleep(250);
      const buttons = Array.from(document.querySelectorAll([
        'button[data-testid="send-button"]',
        'button[data-testid="composer-send-button"]',
        'form button[type="submit"]',
        'button[aria-label*="Send"]',
        'button[aria-label*="送信"]'
      ].join(',')));
      const sendButton = buttons.find(btn => !btn.disabled && !btn.getAttribute('aria-disabled'));
      if (sendButton) {
        sendButton.click();
        return;
      }

      if (!input) return;
      input.focus();
      input.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      }));
    },

    getResponseNodes() {
      const selectors = [
        '[data-message-author-role="assistant"] .markdown',
        '[data-message-author-role="assistant"]',
        'article[data-testid^="conversation-turn-"] .markdown',
        'main article .markdown'
      ];
      const seen = new Set();
      const nodes = [];

      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(node => {
          if (seen.has(node)) return;
          seen.add(node);
          const text = node.textContent || '';
          if (text.trim().length > 0) nodes.push(node);
        });
      });

      return nodes;
    },

    getResponseText(node) {
      if (!node) return '';
      const isMarkdownNode = typeof node.matches === 'function' && node.matches('.markdown');
      const nestedMarkdown = typeof node.querySelector === 'function' ? node.querySelector('.markdown') : null;
      const target = isMarkdownNode ? node : (nestedMarkdown || node);
      const clone = target.cloneNode(true);
      clone.querySelectorAll('button, svg, [data-testid], .sr-only').forEach(el => el.remove());

      const text = clone.textContent || '';
      const html = clone.innerHTML || '';
      if (text.includes('<h1') || text.includes('<!--CTA_DATA_START-->')) return text;
      if (html.includes('<h1') || html.includes('<!--CTA_DATA_START-->')) return html;
      return text;
    },

    isGenerating() {
      const selectors = [
        'button[data-testid="stop-button"]',
        'button[data-testid="composer-stop-button"]',
        'button[aria-label*="Stop"]',
        'button[aria-label*="stop"]',
        'button[aria-label*="停止"]',
        'button[aria-label*="中止"]'
      ];
      return selectors.some(selector => {
        const btn = document.querySelector(selector);
        return btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true';
      });
    }
  };

  function getChatInput() {
    return CHATGPT_ADAPTER.getComposer();
  }

  async function sendMessage(input) {
    await CHATGPT_ADAPTER.send(input);
  }

  function decodeHtmlText(raw) {
    return String(raw || '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  function escapeHtml(raw) {
    return String(raw || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
      '<div style="text-align: center; color: #555; margin: 0 0 28px 0; font-size: 15px;">' + (d['締めの言葉'] || defaultCtaData['締めの言葉']) + '</div>' +
      '<div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">' +
      '<a href="' + url + '" style="display: inline-block; background: #e67e22; color: #fff; padding: 16px 32px; border-radius: 50px; font-size: 15px; font-weight: bold; text-decoration: none; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">無料学習相談・体験授業に申し込む</a>' +
      '<a href="tel:' + tel.replace(/-/g, '') + '" style="display: inline-block; background: #fff; color: #e67e22; padding: 16px 32px; border-radius: 50px; font-size: 15px; font-weight: bold; text-decoration: none; border: 2px solid #e67e22;">電話で直接申し込む</a>' +
      '</div>' +
      '</div>'
    );
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
  function getLatestResponseNodeAfterBaseline(baselineCount = 0) {
    const nodes = CHATGPT_ADAPTER.getResponseNodes();
    if (!nodes.length) return null;
    const safeBaseline = Math.max(0, Math.min(Number(baselineCount) || 0, nodes.length));
    const newNodes = nodes.slice(safeBaseline);
    return (newNodes.length ? newNodes : nodes)[(newNodes.length ? newNodes : nodes).length - 1] || null;
  }

  function looksCompleteBlogHtml(raw) {
    const decoded = decodeHtmlText(raw || '');
    return /<h1[\s>]/i.test(decoded) && /<!--CTA_DATA_END-->/i.test(decoded);
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
    return /<h1[\s>]/i.test(source) &&
      headingCount >= 2 &&
      paragraphCount >= 4 &&
      getArticlePlainLength(source) >= 300;
  }

  function watchBlogResponseAndEnableCopy(statusDiv, copyBtn, baselineCount = 0) {
    let last = '';
    let stableCount = 0;
    let pollCount = 0;

    const timer = setInterval(() => {
      pollCount++;
      const latest = getLatestResponseNodeAfterBaseline(baselineCount);
      if (!latest) {
        if (pollCount === 20) {
          statusDiv.textContent = '⚠️ ChatGPTの回答欄をまだ検出できません。生成が終わっているのにボタンが出ない場合は、少し待つか再生成してください。';
          statusDiv.classList.add('show');
        }
        return;
      }

      const text = CHATGPT_ADAPTER.getResponseText(latest);

      if (text === last) {
        stableCount++;
      } else {
        last = text;
        stableCount = 0;
      }

      const isCompleteHtml = looksCompleteBlogHtml(text);
      const isGenerationStopped = !CHATGPT_ADAPTER.isGenerating();
      const isReadyToFinalize = isCompleteHtml && isGenerationStopped && stableCount >= 5;

      if (isReadyToFinalize) {
        clearInterval(timer);

        try {
          let raw = '';
          raw = CHATGPT_ADAPTER.getResponseText(latest);

          let decoded = '';
          let ctaData = null;
          const blogJson = parseBlogJsonResponse(raw);
          if (blogJson) {
            decoded = renderBlogJsonHtml(blogJson);
            const articleJson = blogJson.article && typeof blogJson.article === 'object' ? blogJson.article : blogJson;
            ctaData = normalizeJsonCtaData(blogJson.cta || blogJson.ctaData || blogJson.cta_data || articleJson.cta);
          } else {
            decoded = decodeHtmlText(raw);
            decoded = decoded.replace(/```(?:html)?\s*/gi, '').replace(/```/g, '');
            ctaData = parseCtaData(raw);
          }

          if (!/<h1[\s>]/i.test(decoded)) {
            statusDiv.textContent = '⚠️ ChatGPTの出力からブログHTMLを検出できませんでした。もう一度生成してください。';
            statusDiv.classList.add('show');
            return;
          }

          decoded = decoded.replace(/<!--CTA_DATA_START-->[\s\S]*?<!--CTA_DATA_END-->/gi, '');
          decoded = decoded.replace(/説明文1[:：].+[\s\S]*?締めの言葉[:：].+/gi, '');
          decoded = decoded.replace(/<p[^>]*style=['"][^'"]*color:\s*red[^'"]*['"][^>]*>\s*■+CTAセクション■+\s*<\/p>/gi, '');
          decoded = decoded.replace(/<table[^>]*>[\s\S]*<\/table>\s*$/i, '');

          if (!hasEnoughArticleHtml(decoded)) {
            lastBlogHtml = '';
            statusDiv.textContent = '⚠️ ブログ本文が途中までしか取得できませんでした。赤いコピーは出さずに止めています。ChatGPTの生成完了後、もう一度「ChatGPTへ送信して記事生成」を押してください。';
            statusDiv.classList.add('show');
            copyBtn.style.display = 'none';
            return;
          }

          const info = getSetting();
          let ctaUrl = (info.url || '').trim();
          const ctaTel = (info.tel || '').trim();
          if (!ctaUrl) {
            console.warn('CTA URLが設定されていません');
            return;
          }
          if (!/^https?:\/\//i.test(ctaUrl)) ctaUrl = 'https://' + ctaUrl;

          const ctaHtml = buildCtaHtml(ctaUrl, ctaTel, ctaData);
          lastBlogHtml = decoded + '\n\n' + ctaHtml;

        } catch (e) {
          console.error('ブログHTML処理エラー:', e);
          return;
        }

        statusDiv.textContent = '✅ ブログ記事の生成が完了しました。下の赤いボタンからHTMLをコピーできます。';
        statusDiv.classList.add('show');
        copyBtn.style.display = 'block';
        if (copyBtn.parentElement) copyBtn.parentElement.style.display = 'block';
        setTimeout(() => {
          if (copyBtn.scrollIntoView) {
            copyBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 50);
      }
    }, 1000);
  }

  // =========================================================
  // 7. ウォッチャー：サムネイル指示生成完了
  // =========================================================
  let lastPromptNode = null;
  let isGeneratingPrompt = false;

  function watchThumbnailPrompt(statusDiv, imgExecBtn, baselineCount = 0) {
    let last = '';
    let stableCount = 0;

    const timer = setInterval(() => {
      if (!isGeneratingPrompt) {
        clearInterval(timer);
        return;
      }

      const nodes = CHATGPT_ADAPTER.getResponseNodes().slice(baselineCount);
      if (!nodes.length) return;

      const latest = nodes[nodes.length - 1];
      const txt = CHATGPT_ADAPTER.getResponseText(latest);

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
          if (imgExecBtn.parentElement) imgExecBtn.parentElement.style.display = 'block';

          alert('画像生成用プロンプトの出力が完了しました。\n\n１．この画面の内容を確認したら閉じてください。\n２．ChatGPTの画像生成が使える状態か確認してください。\n３．「このプロンプトで画像を生成する」ボタンを押して生成をスタート。\n\nそれでは、進めてください。');

          statusDiv.textContent = '✅ サムネイル指示の生成が完了しました。内容を確認して「このプロンプトで画像を生成する」ボタンを押してください。';
          statusDiv.classList.add('show');
        }
      }
    }, 1000);
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
    toggleBtn.textContent = '📝 ブログツール';
    if (isCollapsed) toggleBtn.classList.add('collapsed');

    toggleBtn.onclick = () => {
      setPanelCollapsed(panel, toggleBtn, !panel.classList.contains('collapsed'));
    };

    const header = createEl('div', { className: 'eisai-header' }, panel);
    const titleWrap = createEl('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, header);
    createEl('span', {}, titleWrap, '📝 英才ブログ生成（ブログ＋サムネイル）');
    const verSpan = createEl('span', { style: { fontSize: '11px', color: '#6b7280' } }, titleWrap, `v${CURRENT_VERSION} `);
    if (isTestModeEnabled()) {
      createEl('span', {
        style: {
          fontSize: '10px',
          color: '#92400e',
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '999px',
          padding: '2px 6px',
          fontWeight: '700'
        }
      }, titleWrap, 'TEST');
    }

    const headerRight = createEl('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } }, header);

    const testModeBtn = createEl('button', {
      style: {
        fontSize: '10px',
        padding: '3px 6px',
        borderRadius: '4px',
        border: isTestModeEnabled() ? '1px solid #f59e0b' : '1px solid #d1d5db',
        background: isTestModeEnabled() ? '#fef3c7' : '#f9fafb',
        color: isTestModeEnabled() ? '#92400e' : '#6b7280',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontWeight: '700'
      }
    }, headerRight, isTestModeEnabled() ? 'TEST OFF' : 'TEST ON');
    testModeBtn.title = 'テストモードを切り替えます';
    testModeBtn.onclick = () => {
      const nextEnabled = !isTestModeEnabled();
      setTestModeEnabled(nextEnabled);
      alert(nextEnabled
        ? 'テストモードをONにしました。\n架空教室情報とサンプル入力ボタンが使えます。'
        : 'テストモードをOFFにしました。');
      setChatAvoidance(false);
      panel.remove();
      toggleBtn.remove();
      buildPanel({ forceOpen: true });
    };

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
      setPanelCollapsed(panel, toggleBtn, true);
    };

    updateBtn.onclick = () => {
      const ok = confirm(`現在のバージョン: v${CURRENT_VERSION} \n\n最新版を確認・インストールしますか？\n（Tampermonkeyのインストール画面が開きます）`);
      if (ok) {
        const cacheBustedUrl = UPDATE_URL + '?v=' + encodeURIComponent(CURRENT_VERSION) + '&t=' + Date.now();
        window.open(cacheBustedUrl, '_blank');
      }
    };

    syncChatAvoidance(panel);

    const content = createEl('div', { style: { padding: '14px', overflow: 'auto', flex: 1 } }, panel);

    const footer = createEl('div', {
      style: {
        position: 'sticky',
        bottom: 0,
        background: '#ffffff',
        borderTop: '1px solid #e5e7eb',
        padding: '12px 14px',
        boxShadow: '0 -2px 4px rgba(0,0,0,0.05)',
        display: 'none'
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
      if (isTestModeEnabled()) {
        alert('テストモード中は架空の教室情報を自動使用します。\n通常の教室情報は上書きしません。');
        return;
      }
      saveSetting({ name: nameIn.value, manager: managerIn.value, area: areaIn.value, url: urlIn.value, tel: telIn.value });
      alert('教室情報を保存しました');
      details.open = false;
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
    const selectedTypeText = createEl('span', { style: { minWidth: '0' } }, selectedTypeLabel, '📝 結果アップ・成長ストーリー');
    const sampleButtonWrap = createEl('div', {
      style: {
        display: 'none',
        flexWrap: 'wrap',
        gap: '4px',
        justifyContent: 'flex-end',
        maxWidth: '50%'
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
          { key: 'actions', label: '教室や先生が行ったこと（箇条書き）', placeholder: '例：\n・テスト範囲の確認\n・苦手単元の洗い出し\n・類題演習', isArea: true },
          { key: 'episode', label: '現場エピソード・メッセージ', placeholder: '例：生徒たちが自習に来る回数が増え、質問の内容も具体的になってきました', isArea: true }
        ]
      }
    };

    const TEST_SAMPLES = {
      [BLOG_TYPES.GROWTH]: [
        {
          label: '中2数学アップ',
          values: {
            student: '中2・架空中学校・Aさん・数学',
            before: '前回テスト48点。計算ミスが多く、文章題になると手が止まりやすい状態でした。',
            after: '今回テスト76点。28点アップし、本人も「途中式を書く意味がわかった」と話していました。',
            actions: '・毎回の授業冒頭で計算小テストを実施\n・途中式を省略しないノートづくりを練習\n・テスト2週間前から学校ワークの解き直しを管理\n・間違えた問題だけを集めた復習プリントを作成',
            reality: '最初は「数学は無理」と言っていましたが、2週間ほどで自習に来る回数が増えました。',
            episode: '最初は「数学は無理」と言っていましたが、テスト後に自分から答案を見せてくれたのが印象的でした。'
          }
        },
        {
          label: '小6英語の自信',
          values: {
            student: '小6・架空小学校・Bさん・英語',
            before: '英単語を覚えることに苦手意識があり、宿題も後回しになりがちでした。',
            after: '単語テストで満点が増え、中学準備講座でも積極的に発音できるようになりました。',
            actions: '・1日5単語に絞った暗記計画を作成\n・発音しながら書く練習に変更\n・授業ごとに小さな成功を確認\n・保護者へ家庭での声かけポイントを共有',
            reality: '最初は声が小さかったのですが、満点が続いてからは自分から発音練習に取り組むようになりました。',
            episode: '「英語ってちょっと楽しいかも」と本人が言ってくれたことで、ご家庭でも前向きな会話が増えました。'
          }
        }
      ],
      [BLOG_TYPES.EVENT]: [
        {
          label: '定期テスト対策',
          values: {
            eventName: '架空中学校 定期テスト対策会・中1〜中3対象',
            flow: '・テスト範囲表をもとに学習計画を作成\n・学校ワークの進み具合を確認\n・英数の苦手単元を個別に演習\n・最後に確認テストで定着度をチェック',
            scene: '最初は何から始めるか迷っていた生徒も、確認テストで正解が増えると表情が明るくなりました。',
            benefit: '・何から始めればよいかが明確になる\n・提出物と点数対策を同時に進められる\n・苦手単元をテスト前に発見できる',
            example: '前回は「ワークを終わらせるだけ」で止まっていた生徒が、解き直しまで進められるようになりました。'
          }
        },
        {
          label: '春期講習',
          values: {
            eventName: '春期講習・新学年準備コース',
            flow: '・現学年の苦手単元を診断\n・新学年でつまずきやすい単元を先取り\n・1人ひとりに合わせた授業回数を提案\n・最終日に学習状況を保護者へ報告',
            scene: '新学年への不安を口にしていた生徒が、先取り内容を一つ解けたことで少し安心した様子でした。',
            benefit: '・新学年のスタートで不安を減らせる\n・前学年の苦手を持ち越しにくくなる\n・春休みの学習リズムを作れる',
            example: '短い春休みでも、やる内容を絞ることで「新学期が少し安心」と話す生徒が増えました。'
          }
        }
      ],
      [BLOG_TYPES.PERSON]: [
        {
          label: '理系講師紹介',
          values: {
            personInfo: '講師・佐藤先生・理系科目担当・大学2年生',
            points: '・途中式を丁寧に見てくれる\n・生徒が質問しやすい雰囲気を作る\n・テスト前はミスの原因まで一緒に確認する',
            episode: '計算が苦手な生徒に対して、答えではなく「どこでズレたか」を一緒に探したことで自信につながりました。',
            message: 'わからないところをそのままにしない、頼れる先生です。'
          }
        },
        {
          label: '室長紹介',
          values: {
            personInfo: '室長・山田・学習相談担当・架空テスト校',
            points: '・保護者の不安を丁寧に聞く\n・生徒の性格に合わせて声かけを変える\n・学習計画を現実的に組み立てる',
            episode: '部活で忙しい生徒に、無理な計画ではなく「平日15分だけ」の復習から始めてもらいました。',
            message: '勉強の悩みを一緒に整理し、最初の一歩を見つけます。'
          }
        }
      ],
      [BLOG_TYPES.SERVICE]: [
        {
          label: '無料学習相談',
          values: {
            serviceName: '無料学習相談',
            target: '・何から勉強すればよいかわからない\n・テスト前だけ頑張っても点数が伸びない\n・家庭学習の習慣がつかない',
            flow: '・現在の成績や学習状況をヒアリング\n・学校ワークや答案を確認\n・つまずきの原因を整理\n・必要な学習方法を提案',
            scene: '保護者の方が「何から始めればいいかわからなくて」と話され、学習状況を整理すると少し安心された様子でした。',
            goal: '保護者と生徒が「まず何をするか」を具体的に持ち帰れる状態を目指します。'
          }
        },
        {
          label: '無料体験授業',
          values: {
            serviceName: '無料体験授業',
            target: '・塾の雰囲気を見てから決めたい\n・先生との相性を確認したい\n・個別指導が合うか試したい',
            flow: '・事前に苦手単元を確認\n・実際の個別授業を体験\n・授業後に理解度をフィードバック\n・必要に応じて今後の学習プランを提案',
            scene: '最初は緊張していた生徒も、先生と一緒に問題を解くうちに質問できるようになりました。',
            goal: 'お子さまが安心して通えるかを、授業を通して確認していただくことを大切にしています。'
          }
        }
      ],
      [BLOG_TYPES.SCORE]: [
        {
          label: '期末速報',
          values: {
            testName: '架空中学校 2学期期末テスト',
            scoreList: '中2 Aさん 数学 48点→76点（+28点）\n中1 Bさん 英語 61点→82点（+21点）\n中3 Cさん 理科 88点',
            reason: '・学校ワークを早めに終わらせた\n・間違えた問題を授業で解き直した\n・テスト前は自習に週3回来た',
            comment: '今回も一人ひとりが自分の課題に向き合い、最後までよく頑張りました。',
            pickup: 'Aさんは途中式を書く習慣を徹底したことで、計算ミスが大きく減りました。'
          }
        },
        {
          label: '英語アップ',
          values: {
            testName: '架空中学校 英語単元テスト',
            scoreList: '中1 Dさん 英語 54点→79点（+25点）\n中2 Eさん 英語 70点→86点（+16点）\n中3 Fさん 英語 92点',
            reason: '・本文音読を毎日続けた\n・単語テストを授業ごとに実施した\n・間違えた英文を声に出して確認した',
            comment: '単語暗記と本文音読を続けた成果が、点数にも表れました。',
            pickup: 'Dさんは毎日5分の音読を続け、長文への抵抗感が少しずつ減っていきました。'
          }
        }
      ],
      [BLOG_TYPES.OTHER]: [
        {
          label: '勉強習慣',
          values: {
            theme: '勉強習慣を作るために最初に見直したいこと',
            target: '家で勉強を始めるまでに時間がかかる中学生の保護者',
            actions: '・勉強する時間を固定する\n・最初の5分だけ取りかかるルールを作る\n・学校ワークを小さく区切る\n・できたことを毎回確認する',
            episode: '最初から長時間頑張るのではなく、短い時間でも続けることで自信がついた生徒がいました。'
          }
        },
        {
          label: 'テスト後の見直し',
          values: {
            theme: 'テスト後の見直しで次の点数につなげる方法',
            target: 'テストが返ってきた後に何をすればいいか迷う中学生の保護者',
            actions: '・答案を科目ごとに確認\n・ミスを「知識不足」「計算ミス」「時間不足」に分ける\n・次回までに直す単元を3つに絞る\n・解き直し日を決める',
            episode: '点数だけを見るのではなく、ミスの種類を分けたことで次にやることがはっきりしました。'
          }
        }
      ]
    };

    function clearElement(el) {
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
    }

    function applySampleValues(type, config, sample) {
      config.fields.forEach(field => {
        const value = sample.values[field.key] || '';
        formInputs[type][field.key] = value;
        const input = formInputs[type][field.key + '_el'];
        if (input) input.value = value;
      });
    }

    function renderSampleButtons(type, config) {
      clearElement(sampleButtonWrap);
      const samples = isTestModeEnabled() ? (TEST_SAMPLES[type] || []) : [];
      if (!samples.length) {
        sampleButtonWrap.style.display = 'none';
        return;
      }

      sampleButtonWrap.style.display = 'flex';
      samples.forEach(sample => {
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
        sampleBtn.onclick = () => applySampleValues(type, config, sample);
      });
    }

    function renderTypeForm(type) {
      while (formContainer.firstChild) {
        formContainer.removeChild(formContainer.firstChild);
      }
      formInputs[type] = formInputs[type] || {};
      const config = TYPE_FORMS[type];
      if (!config) return;

      selectedTypeText.textContent = config.label;
      renderSampleButtons(type, config);

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
    }, step2BtnWrap, 'ChatGPTへ送信して記事生成');

    nextBtn.onclick = function () {
      step1.style.display = 'none';
      step2.style.display = 'block';
    };
    backBtn.onclick = () => {
      step2.style.display = 'none';
      step1.style.display = 'block';
    };
    const statusDiv = createEl('div', { className: 'eisai-status' }, content);

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

    const copyBtn = createEl('button', {
      style: {
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
    }, footer, '▶ ブログHTMLをコピーする');

    const imgSection = createEl('div', {
      id: 'eisai-image-section',
      style: {
        display: 'none',
        marginTop: '16px',
        paddingTop: '12px',
        borderTop: '1px solid #e5e7eb'
      }
    }, content);

    createEl('p', { style: { fontWeight: 'bold', marginBottom: '6px' } }, imgSection,
      '🖼 サムネイル画像生成（ブログ用）');

    createEl('label', { className: 'eisai-label' }, imgSection, 'サムネイル型を選択');
    const thumbnailTypeSelect = createEl('select', {
      className: 'eisai-input',
      style: { width: '100%', marginBottom: '8px' }
    }, imgSection);
    Object.keys(THUMBNAIL_TYPE_OPTIONS).forEach(label => {
      const opt = document.createElement('option');
      opt.value = label;
      opt.textContent = label;
      thumbnailTypeSelect.appendChild(opt);
    });
    thumbnailTypeSelect.value = 'おまかせ';

    createEl('label', { className: 'eisai-label' }, imgSection, '見た目の表現を選択');
    const visualExpressionSelect = createEl('select', {
      className: 'eisai-input',
      style: { width: '100%', marginBottom: '8px' }
    }, imgSection);
    Object.keys(VISUAL_EXPRESSION_OPTIONS).forEach(label => {
      const opt = document.createElement('option');
      opt.value = label;
      opt.textContent = label;
      visualExpressionSelect.appendChild(opt);
    });
    visualExpressionSelect.value = 'おまかせ';

    createEl('label', { className: 'eisai-label' }, imgSection, '文字の強さを選択');
    const textImpactSelect = createEl('select', {
      className: 'eisai-input',
      style: { width: '100%', marginBottom: '8px' }
    }, imgSection);
    Object.keys(TEXT_IMPACT_OPTIONS).forEach(label => {
      const opt = document.createElement('option');
      opt.value = label;
      opt.textContent = label;
      textImpactSelect.appendChild(opt);
    });
    textImpactSelect.value = '強め';

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

    function syncFooterButtons() {
      const hasVisibleAction = copyBtn.style.display === 'block' || imgExecBtn.style.display === 'block';
      footer.style.display = hasVisibleAction ? 'block' : 'none';
    }

    function hideBlogCopyButton() {
      copyBtn.style.display = 'none';
      syncFooterButtons();
    }

    imgGenBtn.onclick = () => {
      const thumbnailType = thumbnailTypeSelect.value;
      const style = visualExpressionSelect.value;
      const textImpact = textImpactSelect.value;
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
  - 構図は記事内容に合わせて選んでください。人物を右側に置く構図だけでなく、中央ポートレート、雑誌表紙風、斜め帯、名前プレート型なども候補にしてください
  - 先生の表情は自然な笑顔で、清潔感のある服装にしてください
  - 顔や髪型など、人物の特徴はアップロードされた写真にできるだけ忠実に再現してください
  - 日本語フルネームとローマ字表記の2行構成で名前を表示してください
  - 名前とキャッチコピーは人物と重ならないように配置し、読みやすさを最優先してください
        ` : '';

      const mainColorData = COLOR_STYLES[mainColor] || {};
      const subColorData = COLOR_STYLES[subColor] || {};
      const brandRules = mainColor === 'お任せ' || subColor === 'お任せ'
        ? 'Color scheme optimized for the selected thumbnail objective and visual expression'
        : ((mainColorData.sub || mainColor) + ' and ' + (subColorData.main || subColor) + ' color scheme');
      const colorScheme = mainColor === 'お任せ' || subColor === 'お任せ'
        ? 'Colors automatically selected based on the selected thumbnail objective and visual expression'
        : ('Main color ' + (mainColorData.main || mainColor) + ' (' + (mainColorData.hex || '') + '), Sub color ' + (subColorData.main || subColor) + ' (' + (subColorData.hex || '') + ')');
      const thumbnailTypeInstruction = THUMBNAIL_TYPE_OPTIONS[thumbnailType] || THUMBNAIL_TYPE_OPTIONS['おまかせ'];
      const visualExpressionInstruction = VISUAL_EXPRESSION_OPTIONS[style] || VISUAL_EXPRESSION_OPTIONS['おまかせ'];
      const textImpactInstruction = TEXT_IMPACT_OPTIONS[textImpact] || TEXT_IMPACT_OPTIONS['強め'];

      const input = getChatInput();
      if (!input) {
        alert('ChatGPTの入力欄が見つかりませんでした');
        return;
      }

      const promptRequest = `
【画像生成リクエスト】
以下のブログ記事の内容に基づき、定義されたスタイルで最高品質のサムネイル画像を生成するためのプロンプトを作成してください。

■ ブログ記事内容
${lastBlogHtml || 'ブログ記事が生成されていません。先にブログを生成してください。'}

■ サムネイル設計の選択
- サムネイル型: ${thumbnailType}
  ${thumbnailTypeInstruction}
- 見た目の表現: ${style}
  ${visualExpressionInstruction}
- 文字の強さ: ${textImpact}
  ${textImpactInstruction}
- 色: ${colorScheme}

■ IMAGE2.0向けの考え方
細かい仕様で縛りすぎると、画像が固く、似た構図になりやすいです。
最終的な画像生成プロンプトは、設計書のように細かく書かず、
「こんな感じ」「このあたりに文字をドンと」「答案を大きめに」くらいの余白を残してください。

目的は、完璧に指示通りのレイアウトを作ることではなく、
ブログの内容が一瞬で伝わる、目を止めるサムネイルにすることです。

■ ユーザー入力情報
メインキャッチ：${mainCatch}
サブキャッチ：${subCatch}
ポイント：${points}
${personThumbnailRules}

■ 文字要素の設計ルール（最重要）
- 最終プロンプトには、画像内に入れる文字を必ず明記してください。
  例：メイン文字「28点アップ」、サブ1「中2数学」、サブ2「途中式で変わった」、点数バッジ「48点→76点」。
- おまかせモードの場合は、ブログ記事から訴求できる文字を自分で作ってください。ブログタイトルをそのまま使うだけは禁止です。
- メインキャッチは、読み手が一瞬で止まる言葉にしてください。説明文ではなく、広告サムネイルとして強い短い言葉にします。
  良い例：「28点アップ」「何からやる？」「自分から解いた」「英語が楽しいかも」「質問が増えた日」
  弱い例：「成長の理由」「変化のきっかけ」「学習習慣について」「中2数学の理由」
- サブキャッチは1〜2本入れて、メインだけでは伝わらない対象・理由・場面を補ってください。
  サブ1は「対象・科目・学年」を優先します。例：「中2数学」「小6英語」「中3理科」「架空中学校」
  サブ2は「変化・場面・点数推移」を短く補足します。例：「途中式で変わった」「48点→76点」「答案を見せに来た」
- 点数アップ・成績アップ・テスト結果の記事では、科目と学年を必ず画像内テキストに入れてください。
  例：「28点アップ」だけで終わらせず、必ず「中2数学」も入れる。
- 学校名がブログ記事や入力情報にある場合は、サブキャッチまたは小さなバッジに入れてください。
  例：「篠崎第二中」「架空中学校」「○○中」など。ただし学校名はメインより小さくします。
- 点数推移がある場合は「48点→76点」のように短く見せてください。主役は「28点アップ」か点数推移のどちらか一方にし、もう一方は小さめにします。
- 科目名は省略しないでください。「数学」「英語」「理科」などを明記してください。「テスト」「勉強」だけでぼかさないでください。
- 学年は記事にあれば必ず入れてください。「中2」「小6」「高1」など短く表記してください。
- サブキャッチ2本を入れる場合は、読み順が自然になるようにしてください。
  例：メイン「28点アップ」 / サブ1「中2数学」 / サブ2「途中式で変わった」
- 文字数を増やしすぎないでください。メイン1つ、サブ1〜2つ、必要なら小バッジ1つまでを基本にします。

■ 構図・物理整合性ルール（重要）
- 最終プロンプトには、カメラ位置・被写体の向き・紙やノートの向き・文字の向きを短く明記してください。
- 机、ノート、答案、ペン、手、人物の視線が同じ空間にあるようにしてください。物理的にありえない重なりや、手が届かない位置を指す構図は禁止です。
- 紙面上の文字や数字の向きは、「その紙を使っている人」に合わせてください。カメラ側に常に読ませる必要はありません。
- 写真の中の生徒や先生がノートを書いている場合、ノートやプリントの文字はその人物から読める向きにしてください。人物がこちらを向いていて机が手前にあるなら、紙面の文字は視聴者から見ると上下逆または斜めになるのが自然です。
- 答案やプリントをカメラに見せている場面だけ、紙面が視聴者から読める向きに傾いていることを指定してください。
- 机上に置かれた紙は、机・人物・手の向きに合わせて自然に配置してください。紙の向きと紙面の文字方向がズレる、鏡文字になる、紙だけ不自然にカメラ正面を向く構図は禁止です。
- 俯瞰なら「机の斜め上45度から」「紙面が画面下から奥へ伸びる」など、カメラと紙面の関係を指定してください。
- 手元アップなら「右手のペン先が答案のこの部分を指している」「ペン先と視線が同じ場所へ向く」など、動作の意味が伝わるようにしてください。
- 人物がいる場合は、人物の視線・指差し・手元が、答案やノートの注目点へ自然に向くようにしてください。
- 漫画・アニメ調でも、机のパース、紙の傾き、人物の座る位置は現実の机上構図として成立させてください。
- 文字装飾は写真やイラストの上に後から載せる広告文字です。紙面の中にメインキャッチを書き込ませないでください。メインキャッチは紙の角度に引っ張られず、画面に対して水平・読みやすく置きます。
- 赤ペンの丸や点数を書く場合は、答案用紙の向きと同じパースに乗せてください。画面手前の紙にだけ赤丸が乗り、空中に浮かないようにします。

■ キャッチと見せ方の考え方
- まず、記事の中でいちばん目を引く素材を1つ選んでください。
  例：点数、答案、ノート、手元、表情、親の悩み、イベント名など。
- 文字は短くしてください。メインは必ず1フレーズだけ、サブキャッチは状況に応じて0〜2本まで使ってください。
- サブキャッチ1本目は「何の記事か」を補足します。学年・科目がある場合はここに必ず入れてください。例：「中2数学」「小6英語」「中3理科」。
- サブキャッチ2本目は、必要な時だけ「学校・状況・ベネフィット」を短く補足します。例：「48点→76点」「篠崎第二中」「途中式で変わった」。
- サブキャッチを2本使う場合でも、どちらもメインよりかなり小さくしてください。メインの邪魔をしないことが最優先です。
- 小さなバッジやアイコンは0〜2個まで使ってOKです。使うなら意味のあるものだけにしてください。例：答案アイコン、チェック、矢印、赤ペン、テスト対策ラベル、点数バッジ。
- 装飾だけのキラキラ、爆発、意味のないスタンプ、読めない英字は使わないでください。
- 点数や期間がある記事では、数字を大きく見せると強いです。
- ただし数字を2つも3つも同じ強さで並べず、主役は1つだけにしてください。
- 「強め」なら、文字はガンと大きく。写真に少しかぶってもOKです。
- 「標準」なら、少し落ち着いた編集部っぽい見せ方でOKです。
- 「最大インパクト」なら、ひと目で読める大文字を画面の主役にしてください。

■ 方向性の作り方
いきなり1つに決めず、内部で軽く3案くらい考えてください。
例：
- 案A：答案を大きく見せて、左側に「28点アップ」をドンと置く
- 案B：ノートの手元を寄りで見せて、中央に「途中式で変わる」
- 案C：点数バッジを右上に置き、下に「中2数学」を添える

その中から、記事内容に一番合うものを1つ選んでください。
この3案の検討は出力しないでください。

■ 最終プロンプトの書き方
最終的な画像生成プロンプトは、長い仕様書にしないでください。
日本語で、下のような温度感で書いてください。

例：
「3:2のブログサムネイル。数学の答案用紙を手に持っている写真っぽい画。左〜中央にメイン文字『28点アップ』をかなり大きく、太いオレンジ文字＋白フチ＋濃い影でドンと置く。サブ1『中2数学』、サブ2『途中式で変わった』を読みやすく添える。右上に小さな点数バッジ『48点→76点』、学校名があるなら小さく『篠崎第二中』も入れる。全体は明るい教室の雰囲気。文字は写真より先に目に入る感じ。古い広告っぽいギラギラ3Dや巨大な青帯にはしない。」

物理整合性まで書く例：
「カメラは机の斜め上45度から。生徒がノートに書いている場面なので、ノートの文字は生徒側から読める向きに置く。視聴者からは少し上下逆気味に見えて自然。先生の右手のペン先はノートの途中式を指し、生徒の視線も同じ場所へ向く。メイン文字は紙の上ではなく画面左側に水平に重ねる。」
「答案をカメラへ見せる場面なら、答案用紙だけは視聴者から読める向きに持たせる。手で持った答案のパースに合わせて赤丸や点数を書く。」

このくらいのラフさで十分です。
細かい座標、厳密な比率、禁止事項の長い列挙は入れないでください。
ただし、カメラ角度・紙面の向き・文字の向き・手元の意味は必ず短く入れてください。
IMAGE2.0が自由に良い絵を作れる余白を残してください。

■ 最低限守ること
- 画像比率は3:2
- 文字は日本語
- 塾名やロゴは入れない
- 同じ文言を何度も繰り返さない
- メイン文字は読みやすく、サムネイルとして目立つ
- サブキャッチは1〜2本を基本にする。点数アップ系では、学年・科目を必ずサブキャッチに入れる
- 学校名がある場合は、サブキャッチまたは小バッジとして入れる
- アイコンやバッジは最大2個まで。意味があるものだけ使う
- カメラ角度、紙面の向き、紙面上の文字方向、手やペンの向きが物理的に自然。紙面文字は、その紙を使う人物の向きに合わせる
- 記事にない実績や数字は作らない

■ 出力形式
---
以下のプロンプトで画像を生成してください

[ここに、IMAGE2.0へそのまま渡せる短めの画像生成プロンプト]

このプロンプトで画像を生成してください。
---

【重要】プロンプトを出力のみで、画像は生成しないでください。`;

      statusDiv.textContent = '🎯 画像生成用プロンプトを作成しています...';
      statusDiv.classList.add('show');
      hideBlogCopyButton();
      imgExecBtn.style.display = 'none';
      syncFooterButtons();

      isGeneratingPrompt = true;
      lastPromptNode = null;

      const responseBaseline = CHATGPT_ADAPTER.getResponseNodes().length;
      CHATGPT_ADAPTER.setComposerText(input, promptRequest);
      sendMessage(input);
      watchThumbnailPrompt(statusDiv, imgExecBtn, responseBaseline);
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
【このタイプで必ず作る読後感】
- 保護者が「うちの子にも似ている」と感じ、変化までの道筋を具体的に想像できる記事にしてください。
【構成指示】
- 導入：点数や成果から入らず、家庭で見えやすい困りごとや保護者の迷いから入る
- 本文：ビフォー→小さな転機→教室での具体策→アフターの順で、変化の過程を場面として描く
- 生徒の表情、口ぐせ、手の動き、ノート、質問の仕方など、入力情報から自然に描ける観察を入れる
- 室長コメントは「何を見て嬉しかったか」「どこに成長を感じたか」を具体的にする
- 見出し例：「最初は〇〇に悩んでいました」「変わるきっかけになった取り組み」「結果以上に大きかった変化」
- 締め：同じ悩みを持つ保護者の不安に戻り、相談への自然な一歩につなげる`,
        [BLOG_TYPES.EVENT]: `【記事タイプ】イベント紹介型
【このタイプで必ず作る読後感】
- ただの日程案内ではなく、「参加すると何が変わるのか」「教室ではどんな空気なのか」が伝わる記事にしてください。
【構成指示】
- 導入：イベント名の説明から入らず、テスト前・講習前・新学期前に保護者が感じる不安から入る
- 本文：イベントの流れを羅列せず、当日の様子、生徒の反応、先生の声かけ、終わった後の変化を入れる
- 「なぜその内容を行うのか」を1つ以上説明し、教室側の意図が伝わるようにする
- 室長コメントは、参加した生徒を見て感じた課題や成長に触れる
- 見出し例：「この時期に多いお悩み」「当日はこんな流れで進めました」「参加後に見えた変化」
- 締め：参加を迷っている保護者が気軽に聞ける雰囲気で終える`,
        [BLOG_TYPES.PERSON]: `【記事タイプ】人物紹介型
【このタイプで必ず作る読後感】
- 経歴紹介ではなく、「この先生なら子どもを任せてもよさそう」と感じられる人物像を描いてください。
【構成指示】
- 導入：肩書きや経歴だけで始めず、教室での印象的な関わり方から入る
- 本文：性格説明ではなく、生徒への声かけ、質問対応、授業中の見守り方を具体的な場面で書く
- 先生を過度に持ち上げず、自然な人柄と安心感が伝わる温度にする
- 室長コメントは「なぜその先生を信頼しているか」を具体的な行動に基づいて書く
- 見出し例：「〇〇先生が大切にしていること」「質問しやすい空気の作り方」「室長から見た〇〇先生」
- 締め：保護者が実際の授業を見てみたくなるよう、安心感で終える`,
        [BLOG_TYPES.SERVICE]: `【記事タイプ】サービス紹介型
【このタイプで必ず作る読後感】
- 宣伝ではなく、「相談したら頭の中が整理されそう」と感じられる記事にしてください。
【構成指示】
- 導入：サービス名から入らず、保護者が抱えがちな迷い、焦り、塾選びの不安から入る
- 本文：サービス内容を箇条書きで済ませず、相談前→相談中→相談後の気持ちの変化を描く
- 面談や体験で実際によくある会話、持参物、確認するポイントを自然に入れる
- 売り込み感を避け、「入会前提ではなく現状整理から」という安心感を出す
- 見出し例：「こんなお悩みから始まることが多いです」「相談では何を確認するのか」「体験後に見えること」
- 締め：問い合わせへの心理的ハードルを下げる言葉で終える`,
        [BLOG_TYPES.SCORE]: `【記事タイプ】点数アップ速報型
【このタイプで必ず作る読後感】
- 数字の自慢ではなく、「伸びた理由がある」「次はうちの子も準備を変えられるかも」と感じられる記事にしてください。
【構成指示】
- 導入：点数一覧から始めず、テスト後に保護者が感じる喜び・悔しさ・次への不安に触れる
- 本文：入力された「高得点・点数アップ一覧」は、省略せずに全てリスト形式で記載する
- 代表ケースを1つ以上深掘りし、点数が伸びた背景、準備の仕方、授業で変えたことを具体化する
- 点数だけを強調せず、提出物、解き直し、自習、質問量などの行動変化を本文の中心にする
- 室長コメントは、数字よりも「準備の変化」「やり切った過程」に触れる
- 見出し例：「今回の結果速報」「点数アップの裏側にあった行動」「次のテストへ向けて」
- 締め：結果が出た子だけでなく、悔しかった子にも届く前向きな言葉で終える`,
        [BLOG_TYPES.OTHER]: `【記事タイプ】自由テーマ型
【このタイプで必ず作る読後感】
- 汎用コラムではなく、教室で実際に見えたことから保護者の役に立つ視点を届ける記事にしてください。
【構成指示】
- 導入：テーマの説明から入らず、読み手が日常で感じる困りごとや迷いから入る
- 本文：一般論→結論ではなく、現場で見えた場面→そこから言えること→家庭で考えられる一歩の順で書く
- 入力された教室での取り組みやメッセージを中心にし、教育論だけで終わらせない
- 室長コメントは、教室で見ている子どもたちの変化や保護者への願いを入れる
- 見出し例：「ご家庭でよく聞くお悩み」「教室で見えていること」「今日からできる小さな一歩」
- 締め：保護者が自分ごととして受け止められる余韻を残す`
      };

      const typeInstruction = TYPE_INSTRUCTIONS[currentBlogType] || TYPE_INSTRUCTIONS[BLOG_TYPES.OTHER];

      const prompt = `あなたは英才個別学院の教室ブログ専門ライターです。
以下の入力情報をもとに、保護者向けブログ記事をHTMLで作成してください。
このHTMLはそのまま英才ブログエディターに貼り付けて装飾・整形します。

【今回の最重要方針】
- 応答は必ず <h1> から始めてください。
- JSON、Markdown、コードブロック、前置き、解説は出力しないでください。
- 本文・吹き出し・リスト・写真挿入・CTA素材まで、すべてHTMLとして出力してください。
- CTA素材だけ、相談ポイントだけ、要約だけの出力は禁止です。本文HTMLがない応答は失敗です。
- 申し込みボタンや電話リンクの完成HTMLは出力しないでください。CTA素材ブロックだけを末尾に付けてください。

【品質基準：ChatGPTの文章力を使い切る】
- この記事は「説明」ではなく「現場のストーリー」として書いてください。
- 読者が読み終えた時に、少なくとも1つの場面を頭に思い浮かべられる文章にしてください。
- 「小さな成功体験」「前向き」「苦手意識」「安心感」「一歩」などの抽象語を使う場合は、必ず近くに具体的な行動・表情・会話・ノート・答案・授業風景を添えてください。
- 似た意味の共感文を繰り返さないでください。保護者への共感は深く、短く、重複なく書いてください。
- 同じ言葉や同じ意味の文を繰り返さないでください。特に「手が止まる」「無理」「変化」「できた」は必要な箇所だけに絞ってください。
- 強調文は本文の言い換えにしないでください。本文と同じ内容になるなら、強調パーツは使わないでください。
- 見出しはテンプレート臭を避け、記事内容が少し伝わる具体的な言葉にしてください。
- 本文は「誰でも言えること」よりも「この入力があるから書けること」を優先してください。

【タイトルの作り方：弱いタイトル禁止】
- タイトルは最初に5案を内側で考え、その中で最も「読みたくなる」1案だけを <h1> にしてください。5案は出力しないでください。
- タイトルは18〜32文字を目安にしてください。短すぎる標語、長すぎる説明文、抽象的なまとめは禁止です。
- タイトルには、次のうち2つ以上を必ず入れてください: 具体的な悩み / 数字 / 教科 / 学年 / 生徒の行動 / 印象的な場面 / 読者が気になる変化。
- 「一歩」「変化」「成長」「きっかけ」「前向き」「頑張った」だけで終わる抽象タイトルは禁止です。使う場合も、必ず具体的な場面や数字と組み合わせてください。
- 記事本文の一番印象的な場面をタイトルに反映してください。例: 「答案を自分から見せた日」「声が少し大きくなった日」「机に向かう時間が増えた夜」。
- 大げさな広告表現は禁止です。「絶対」「必ず」「奇跡」「たったこれだけで」「誰でも」は使わないでください。
- 成長ストーリー型は、Beforeの悩みとAfterの場面をつなぐタイトルにしてください。例: 「48点の数学、答案を見せに来た日」「途中式を嫌がったAさんの28点アップ」。
- イベント紹介型は、イベント名だけでなく参加後に見える変化を入れてください。例: 「冬期講習で見えた、質問が増えた瞬間」。
- 人物紹介型は、名前と人柄が伝わる場面を入れてください。例: 「田中先生が質問前に必ず聞くこと」。
- サービス紹介型は、保護者の悩みと相談後の安心を入れてください。例: 「塾選びの不安を整理する無料相談」。
- 点数アップ速報型は、数字だけでなく伸びた理由を示してください。例: 「33点アップの裏側にあった解き直し習慣」。

【本文の書き方ルール】
- 冒頭は、保護者の不安や悩みに寄り添うところから始めてください。いきなり成果や宣伝から入らないでください。
- 保護者、とくにお母さんが「うちの子にも当てはまるかもしれない」「一人で抱え込まなくていいかもしれない」と感じる温度で書いてください。
- 家で見える不安、親子でピリピリしてしまう気持ち、声かけに迷う気持ちにやさしく触れてください。ただし保護者を責めないでください。
- 文体は敬体を基本にしつつ、少し近い距離で話しかけてください。「ですよね」「かもしれません」「まずは」「少しずつ」のような自然な言葉を使ってください。
- 「〜いたします」「〜させていただきます」「サポートいたします」などの硬い業務文は使いすぎないでください。
- 本文は自然な段落で書いてください。箇条書きは補助だけにし、本文の中心にしないでください。
- 各段落は1〜2文程度で短くしてください。スマホで読んでも疲れないよう、こまめに話を区切ってください。
- 「何をしたか」だけでなく、「生徒がどう変わったか」「教室でどんな場面があったか」を書いてください。
- 場面描写には、表情、手元、声の大きさ、ノート、答案、質問の仕方、保護者の言葉など、入力に基づいて自然に書ける具体要素を使ってください。
- 入力された学校名、学年、教科、点数、期間、生徒の様子、先生・室長コメントを本文に反映してください。
- 室長目線は売り込みではなく、そばで見守っていた人の言葉として自然に入れてください。
- 一般論だけの記事にしないでください。必ず入力情報に基づいた具体的な場面を書いてください。
- 入力にない実績、点数、学校名、生徒発言、キャンペーンは作らないでください。
- 大げさな広告表現、断定表現、「必ず伸びる」「絶対合格」は使わないでください。

【HTML装飾パーツの使い方】
- 共感ボックスを使う場合は、本文冒頭の後に次のHTMLで1回だけ入れてください。
  <div class="eisai-empathy-box"><strong>保護者の方へ</strong><p>共感文</p></div>
- ラベルは記事の場面に合わせて「お母さまへ」「お父さまへ」「保護者の方へ」など自然に使い分けてください。毎回「お母さんへ」に固定しないでください。
- 強調したい一文は、本文の繰り返しにならない場合だけ次のHTMLで入れてください。記事全体で0〜2個までです。
  <p class="eisai-highlight"><strong>本当に読ませたい一文</strong></p>
- リストは、手順・取り組み・チェックポイントなど、3項目以上で整理した方が読みやすい時だけ使ってください。不要なら使わないでください。
  <div class="eisai-point-list"><strong>教室で意識したこと</strong><ul><li>項目</li><li>項目</li><li>項目</li></ul></div>
- 吹き出しは、保護者と室長・先生の短いやりとりが自然な場面だけ使ってください。不要なら使わないでください。
  <div class="bubble-right"><strong>お母さま：</strong>自然な短い相談の言葉</div>
  <div class="bubble-left"><strong>${shichou || '山田'}：</strong>それに対する短い返答</div>
- 吹き出しの話者は場面に合わせて自然に使い分けてください。保護者側は「お母さま」「お父さま」、生徒本人なら「Aさん」「Bさん」、教室側は室長名（例: ${shichou || '山田'}）または「先生」にしてください。
- 「保護者」「室長」のような役割名だけを吹き出しの話者にするのは避けてください。
- 吹き出しの直前には、会話が出る理由がわかる導入文を <p> で1文入れてください。例: <p>その頃、保護者の方からもこんなお話をいただきました。</p>
- 室長コメントは本文全体で1〜2個まで、次のHTMLで入れてください。
  <div class="eisai-manager-note"><strong>室長より</strong><p>室長の思いや感情が伝わる短いコメント</p></div>
- 写真挿入は本文の流れを止めないよう、2〜3個だけ入れてください。
  <p data-photo-placeholder="true"><strong>■■■■■■■■ 写真挿入（ノートの写真） ■■■■■■■■</strong></p>
- 写真候補は、ノート・途中式・解き直しリスト・答案・確認テスト・自習風景・教室内の教材など、実際の現場で撮れる写真を優先してください。
- 汎用的な悩み写真、人物の頭抱え写真、フリー素材風のイメージ写真、冒頭用の雰囲気写真は作らないでください。

【冒頭あいさつ】
- 冒頭あいさつを <p> で必ず1段落入れてください。
- 対象エリアがある場合は「${area || '◯◯エリア'}の個別指導塾、英才個別学院 ${kosha} 室長の${shichou}です！」のように始めてください。
- 対象エリアが空欄の場合は「英才個別学院 ${kosha} 室長の${shichou}です！」のように始めてください。
- あいさつの後に、「今日は、〜についてお話しします。」という自然な導入を続けてください。
- 毎回まったく同じ定型文にせず、記事内容に合わせて少し変化をつけてください。

【文章量と構成】
- <h1> は1つだけ。
- 冒頭の <p> は2〜3段落。共感を重ねすぎず、早めに本文の主題へ入ってください。
- <h2> は3〜4個。
- 各 <h2> の下には <p> を2段落以上入れてください。
- <p class="eisai-highlight"> は記事全体で0〜2個。
- <div class="eisai-point-list"> は記事全体で0〜2ブロック。不要なら使わない。
- 吹き出しは記事全体で0〜2セット。不要なら使わない。
- 写真挿入は必ず2〜3個。
- 結びの <p> は2段落。
- 本文全体は1000〜1600字程度。
- CTA素材は短く簡潔に。本文より目立たせないでください。
- 締めの言葉は記事内容に合わせた具体的な一文にしてください。定型句しか書けない場合は空欄にしてください。

【HTML出力形式】
<h1>18〜32文字程度。悩み・数字・場面・変化のうち2つ以上を含む強いブログタイトル</h1>
<p>冒頭のあいさつ段落</p>
<p>保護者の不安に寄り添う導入段落</p>
<p>入力内容につながる導入段落</p>
<div class="eisai-empathy-box"><strong>保護者の方へ</strong><p>読み手の不安に寄り添う短い共感文</p></div>
<h2>具体的な見出し</h2>
<p>自然な本文段落</p>
<p>現場感のある本文段落</p>
<p class="eisai-highlight"><strong>本当に読ませたい一文</strong></p>
<div class="eisai-point-list"><strong>取り組みポイント</strong><ul><li>具体項目</li><li>具体項目</li><li>具体項目</li></ul></div>
<div class="bubble-right"><strong>お母さま：</strong>自然な短い相談の言葉</div>
<div class="bubble-left"><strong>${shichou || '山田'}：</strong>それに対する短い返答</div>
<div class="eisai-manager-note"><strong>室長より</strong><p>室長の思いや感情が伝わる短いコメント</p></div>
<p data-photo-placeholder="true"><strong>■■■■■■■■ 写真挿入（ノートの写真） ■■■■■■■■</strong></p>
<h2>具体的な見出し</h2>
<p>自然な本文段落</p>
<p>現場感のある本文段落</p>
<h2>具体的な見出し</h2>
<p>自然な本文段落</p>
<p>現場感のある本文段落</p>
<p>保護者への前向きな結び</p>
<p>相談へ自然につなげる結び</p>
<!--CTA_DATA_START-->
説明文1：記事内容に合わせた、不安を解消する一言
説明文2：教室見学や相談へのハードルを下げる優しい一言
相談ポイント1：相談内容1
相談ポイント2：相談内容2
相談ポイント3：相談内容3
相談ポイント4：相談内容4
体験ポイント1：体験で得られるメリット1
体験ポイント2：体験で得られるメリット2
体験ポイント3：体験で得られるメリット3
体験ポイント4：体験で得られるメリット4
締めの言葉：記事内容に合わせた具体的な一文
<!--CTA_DATA_END-->

【禁止】
- JSONで出力しないでください。
- Markdownで出力しないでください。
- コードブロックで囲まないでください。
- 「以下にHTMLを作成します」などの前置き・後置きは禁止です。
- CTA素材だけの出力は禁止です。
- CTA_DATA_START / CTA_DATA_END を省略しないでください。
- 申し込みボタンHTML、電話リンクHTML、完成CTAボックスHTMLは出力しないでください。

【教室情報】
校舎名: ${kosha}
室長名: ${shichou}
対象エリア: ${area || '未設定'}

${typeInstruction}

【入力情報】
${formContent}`;

      const input = getChatInput();
      if (!input) {
        alert('ChatGPTの入力欄が見つかりませんでした');
        return;
      }

      statusDiv.textContent = '📨 ブログ生成用プロンプトを送信しました。生成が完了したら、下にコピー用ボタンが出ます。';
      statusDiv.classList.add('show');
      hideBlogCopyButton();
      imgSection.style.display = 'none';
      imgExecBtn.style.display = 'none';
      syncFooterButtons();
      lastBlogHtml = '';

      const responseBaseline = CHATGPT_ADAPTER.getResponseNodes().length;
      CHATGPT_ADAPTER.setComposerText(input, prompt);

      await sleep(500);
      await sendMessage(input);

      watchBlogResponseAndEnableCopy(statusDiv, copyBtn, responseBaseline);
    };

    copyBtn.onclick = async () => {
      if (!lastBlogHtml) {
        alert('コピーできるブログHTMLがまだありません。\nまずは「ChatGPTへ送信して記事生成」を実行してください。');
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
      const nodes = CHATGPT_ADAPTER.getResponseNodes();
      if (!nodes.length && !lastPromptNode) {
        alert('ChatGPTの出力が見つかりませんでした。サムネイル指示の生成が完了してからもう一度試してください。');
        return;
      }

      const latest = lastPromptNode || nodes[nodes.length - 1];
      const prompt = CHATGPT_ADAPTER.getResponseText(latest);

      try {
        await navigator.clipboard.writeText(prompt);
      } catch (e) {
        console.warn('プロンプトコピーに失敗しましたが、送信は続行します:', e);
      }

      const input = getChatInput();
      if (!input) {
        alert('ChatGPTの入力欄が見つかりませんでした');
        return;
      }

      statusDiv.textContent = '🖼 画像生成プロンプトを送信しました。画像が生成されます。';
      statusDiv.classList.add('show');
      imgExecBtn.style.display = 'none';
      syncFooterButtons();

      CHATGPT_ADAPTER.setComposerText(input, prompt);
      sendMessage(input);
    };
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
      buildPanel({ forceOpen: true });
    };
  }

  setInterval(ensureButton, 1000);
})();
