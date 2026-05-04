// ==UserScript==
// @name         Eisai Blog Generator for ChatGPT
// @namespace    http://tampermonkey.net/
// @version      0.1.9
// @description  英才ブログ生成ツール (ChatGPT対応 / Gemini版とは別ファイル)
// @author       Yuan
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @updateURL    https://github.com/honbueisai/blog-tools/raw/refs/heads/feature/chatgpt-blog-generator/blog-generator-chatgpt.user.js
// @downloadURL  https://github.com/honbueisai/blog-tools/raw/refs/heads/feature/chatgpt-blog-generator/blog-generator-chatgpt.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const TOOL_ID = 'eisai-chatgpt-tool-v0-1-9';
  const BTN_ID = 'eisai-chatgpt-btn-v0-1-9';
  const STORAGE_KEY = 'eisai_chatgpt_blog_info_v019';
  const CLASSROOM_STORAGE_KEY = 'eisai_classroom_settings_persistent';
  const CURRENT_VERSION = '0.1.9';
  const UPDATE_URL = 'https://github.com/honbueisai/blog-tools/raw/refs/heads/feature/chatgpt-blog-generator/blog-generator-chatgpt.user.js';
  const TEST_MODE_STORAGE_KEY = 'eisai_chatgpt_test_mode_enabled';
  const PANEL_WIDTH = 420;
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
    document.documentElement.classList.toggle(PANEL_OPEN_LAYOUT_CLASS, shouldApply);
    if (document.body) {
      document.body.classList.toggle(PANEL_OPEN_LAYOUT_CLASS, shouldApply);
    }
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
    Array.from(text).forEach(char => {
      current += char;
      if ('。！？'.indexOf(char) >= 0) {
        const sentence = current.trim();
        if (sentence) sentences.push(sentence);
        current = '';
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
        if (suggestions.length >= 3) return;
        if (!suggestions.some(suggestion => suggestion.afterSection === item.afterSection)) suggestions.push(item);
      });
      return suggestions.slice(0, 5).sort((a, b) => a.afterSection - b.afterSection);
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
  margin-right: ${PANEL_WIDTH}px !important;
  max-width: calc(100vw - ${PANEL_WIDTH}px) !important;
  transition: margin-right 0.3s ease, max-width 0.3s ease;
}
html.${PANEL_OPEN_LAYOUT_CLASS} #thread-bottom-container {
  right: ${PANEL_WIDTH}px !important;
  width: auto !important;
  transition: right 0.3s ease;
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
  function watchBlogResponseAndEnableCopy(statusDiv, copyBtn, baselineCount = 0) {
    let last = '';
    let stableCount = 0;

    const timer = setInterval(() => {
      const nodes = CHATGPT_ADAPTER.getResponseNodes().slice(baselineCount);
      if (!nodes.length) return;

      const latest = nodes[nodes.length - 1];
      const text = CHATGPT_ADAPTER.getResponseText(latest);

      if (text === last) {
        stableCount++;
      } else {
        last = text;
        stableCount = 0;
      }

      if (stableCount >= 3 && text.length > 500) {
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
  function buildPanel() {
    const existingPanel = document.getElementById(TOOL_ID);
    if (existingPanel) {
      syncChatAvoidance(existingPanel);
      return;
    }

    const styleTag = document.createElement('style');
    styleTag.textContent = CSS;
    document.head.appendChild(styleTag);
    bindChatAvoidanceResize();

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
      syncChatAvoidance(panel);
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
      buildPanel();
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
      panel.classList.add('collapsed');
      toggleBtn.classList.add('collapsed');
      localStorage.setItem('eisai_collapsed', 'true');
      syncChatAvoidance(panel);
    };

    updateBtn.onclick = () => {
      const ok = confirm(`現在のバージョン: v${CURRENT_VERSION} \n\n最新版を確認・インストールしますか？\n（Tampermonkeyのインストール画面が開きます）`);
      if (ok) {
        window.open(UPDATE_URL, '_blank');
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
        padding: '8px 12px',
        marginBottom: '12px',
        background: '#e0e7ff',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: '600',
        color: '#3730a3'
      }
    }, step2, '📝 結果アップ・成長ストーリー');

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

    function renderTypeForm(type) {
      while (formContainer.firstChild) {
        formContainer.removeChild(formContainer.firstChild);
      }
      formInputs[type] = formInputs[type] || {};
      const config = TYPE_FORMS[type];
      if (!config) return;

      selectedTypeLabel.textContent = config.label;

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

      if (isTestModeEnabled()) {
        const samples = TEST_SAMPLES[type] || [];
        const sampleWrap = createEl('div', {
          style: {
            marginTop: '8px',
            marginBottom: '10px',
            padding: '8px',
            borderRadius: '6px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0'
          }
        }, formContainer);
        createEl('div', {
          style: {
            fontSize: '11px',
            fontWeight: '700',
            color: '#475569',
            marginBottom: '6px'
          }
        }, sampleWrap, 'テスト用サンプル');
        const sampleRow = createEl('div', { style: { display: 'flex', gap: '6px' } }, sampleWrap);
        samples.forEach(sample => {
          const sampleBtn = createEl('button', {
            style: {
              flex: '1',
              padding: '7px 8px',
              fontSize: '12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              cursor: 'pointer'
            }
          }, sampleRow, sample.label);
          sampleBtn.onclick = () => {
            config.fields.forEach(field => {
              const value = sample.values[field.key] || '';
              formInputs[type][field.key] = value;
              const input = formInputs[type][field.key + '_el'];
              if (input) input.value = value;
            });
          };
        });
      }
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
    }, content, '▶ ブログHTMLをコピーする');

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

      const mainColorData = COLOR_STYLES[mainColor] || {};
      const subColorData = COLOR_STYLES[subColor] || {};
      const brandRules = mainColor === 'お任せ' || subColor === 'お任せ'
        ? 'Color scheme optimized for appeal style'
        : ((mainColorData.sub || mainColor) + ' and ' + (subColorData.main || subColor) + ' color scheme');
      const textGradient = mainColor === 'お任せ'
        ? 'optimized gradient for appeal style'
        : (mainColorData.gradient || mainColor);
      const colorScheme = mainColor === 'お任せ' || subColor === 'お任せ'
        ? 'Colors automatically selected based on appeal style'
        : ('Main color ' + (mainColorData.main || mainColor) + ' (' + (mainColorData.hex || '') + '), Sub color ' + (subColorData.main || subColor) + ' (' + (subColorData.hex || '') + ')');

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

■ 適用するスタイルパラメータ（英語）
1. Visual Style: ${VISUAL_STYLES[style] || style}
2. Emotion / Appeal: ${APPEAL_STYLES[appeal] || appeal}
3. Brand Rules: ${brandRules}, Teacher as clean university student(male/female) wearing plain white lab coat with no text, professional appearance, clean composition, --ar 3:2
4. Text Design: Impactful text design: Bold 3D letters with drop shadows, gradient fills(${textGradient}), thick outlines, dynamic positioning, maximum visibility, eye-catching typography, professional yet striking appearance
5. Classroom Setting: ${style === '実写スタイル' ? CLASSROOM_DESCRIPTION : 'Modern educational environment appropriate for ' + style}
6. Tutoring Style: ${TUTORING_STYLE}
7. Color Scheme: ${colorScheme}

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
最終的なHTML化とCTA装飾はブログツール側で行います。あなたはJSONだけを返してください。

【今回の最重要方針】
- 主役は article です。cta は最後に添える補助データです。
- まず article の本文を十分に書いてください。cta だけ、相談ポイントだけ、要約だけの出力は禁止です。
- JSONオブジェクト1つだけを出力してください。Markdown、コードブロック、前置き、解説、HTMLタグは出力しないでください。

【本文の書き方ルール】
- 冒頭は、保護者の不安や悩みに寄り添うところから始めてください。いきなり成果や宣伝から入らないでください。
- 保護者、とくにお母さんが「うちの子にも当てはまるかもしれない」「一人で抱え込まなくていいかもしれない」と感じる温度で書いてください。
- 家で見える不安、親子でピリピリしてしまう気持ち、声かけに迷う気持ちにやさしく触れてください。ただし保護者を責めないでください。
- 文体は敬体を基本にしつつ、少し近い距離で話しかけてください。「ですよね」「かもしれません」「まずは」「少しずつ」のような自然な言葉を使ってください。
- 本文は自然な段落で書いてください。箇条書きは補助だけにし、本文の中心にしないでください。
- 各段落は1〜2文程度で短くしてください。スマホで読んでも疲れないよう、こまめに話を区切ってください。
- 「何をしたか」だけでなく、「生徒がどう変わったか」「教室でどんな場面があったか」を書いてください。
- 入力された学校名、学年、教科、点数、期間、生徒の様子、先生・室長コメントを本文に反映してください。
- 室長目線は売り込みではなく、そばで見守っていた人の言葉として自然に入れてください。
- 一般論だけの記事にしないでください。必ず入力情報に基づいた具体的な場面を書いてください。
- 入力にない実績、点数、学校名、生徒発言、キャンペーンは作らないでください。
- 大げさな広告表現、断定表現、「必ず伸びる」「絶対合格」は使わないでください。

【装飾用データの作り方】
- article.empathyBox は、保護者の気持ちに寄り添う短い共感ボックスです。1つだけ作ってください。
- section.highlights は、本当に読ませたい一文だけにしてください。記事全体で2〜4個までが目安です。
- section.bullets は、手順・取り組み・チェックポイントなど、3項目以上で整理した方が読みやすい時だけ使ってください。
- section.managerNote は、室長の思いや感情が伝わる短いコメントです。本文全体で1〜2個は入れてください。
- article.photoSuggestions は必須です。空配列は禁止です。最低3個、理想は5個作ってください。
- 写真候補は文章の流れに沿って、ノート・途中式・解き直しリスト・答案・確認テスト・自習風景・教室内の教材など、実際の現場で撮れる写真を優先してください。
- 汎用的な悩み写真、人物の頭抱え写真、フリー素材風のイメージ写真、冒頭用の雰囲気写真は作らないでください。
- photoSuggestions.afterSection は同じ番号に集中させず、本文の流れに合わせて分散してください。

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
- article.photoSuggestions は必ず3〜5個。
- article.closing は2段落。
- 本文全体は900〜1400字程度。
- cta は短く簡潔に。articleより目立たせないでください。
- cta.closingMessage は記事内容に合わせた具体的な一文にしてください。定型句しか書けない場合は空文字 "" にしてください。

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
        "managerNote": "室長の思いや感情が伝わる短いコメント"
      }
    ],
    "photoSuggestions": [
      { "afterSection": 1, "label": "ノートの写真", "description": "この位置に入れるとよい写真の内容" },
      { "afterSection": 2, "label": "自習風景", "description": "この位置に入れるとよい写真の内容" },
      { "afterSection": 3, "label": "答案の写真", "description": "この位置に入れるとよい写真の内容" }
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
- JSON以外の文章を出力しないでください。

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
      copyBtn.style.display = 'none';
      imgSection.style.display = 'none';
      imgExecBtn.style.display = 'none';
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

      CHATGPT_ADAPTER.setComposerText(input, prompt);
      sendMessage(input);
    };
  }

  // =========================================================
  // 10. ChatGPT画面での起動判定
  // =========================================================
  function isNewChatPage() {
    const path = location.pathname;
    return path === '/' || path.startsWith('/c/') || path.startsWith('/g/');
  }

  function ensureButton() {
    if (!isNewChatPage()) {
      const exist = document.getElementById(BTN_ID);
      if (exist) exist.remove();
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
      const panel = document.getElementById(TOOL_ID);
      if (!panel) {
        buildPanel();
        return;
      }

      const willShow = panel.style.display === 'none';
      panel.style.display = willShow ? 'flex' : 'none';
      syncChatAvoidance(panel);
    };
  }

  setInterval(ensureButton, 1000);
})();
