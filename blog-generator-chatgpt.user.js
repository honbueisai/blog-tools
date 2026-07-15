// ==UserScript==
// @name         Eisai Blog Generator for ChatGPT
// @namespace    http://tampermonkey.net/
// @version      0.3.0
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

  const CURRENT_VERSION = '0.3.0';
  const VERSION_ID = CURRENT_VERSION.replace(/\./g, '-');
  const VERSION_KEY = CURRENT_VERSION.replace(/\./g, '');
  const TOOL_ID = `eisai-chatgpt-tool-v${VERSION_ID}`;
  const BTN_ID = `eisai-chatgpt-btn-v${VERSION_ID}`;
  const STORAGE_KEY = `eisai_chatgpt_blog_info_v${VERSION_KEY}`;
  const CLASSROOM_STORAGE_KEY = 'eisai_classroom_settings_persistent';
  const UPDATE_URL = 'https://raw.githubusercontent.com/honbueisai/blog-tools/feature/chatgpt-blog-generator/blog-generator-chatgpt.user.js';
  const TEST_MODE_STORAGE_KEY = 'eisai_chatgpt_test_mode_enabled';
  const GENERATED_CONTEXT_STORAGE_KEY = 'eisai_chatgpt_last_generated_context';
  const GENERATED_CONTEXT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
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
    TRIAL: 'trial_lesson',
    CONSULTATION: 'learning_consultation',
    OTHER: 'other'
  };

  let currentBlogType = BLOG_TYPES.GROWTH;

  syncTestModeFlagFromLocation();
  console.log(`🚀 英才ブログ生成ツール ChatGPT版 v${CURRENT_VERSION} 起動`);
  if (isTestModeEnabled()) {
    console.log('🧪 英才ブログ生成ツール ChatGPT版 テストモード有効');
  }

  let lastBlogHtml = '';
  let lastArticleFacts = '';
  let lastBlogTitle = '';
  let lastImagePromptText = '';
  let lastTitleCandidates = [];

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
      const seen = new Set();
      const nodes = [];

      document.querySelectorAll('[data-message-author-role="assistant"]').forEach(turn => {
        const node = turn.querySelector('.markdown') || turn;
        if (seen.has(node)) return;
        seen.add(node);
        const text = node.textContent || '';
        if (text.trim().length > 0) nodes.push(node);
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

  function getComposerText(input) {
    if (!input) return '';
    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) return input.value || '';
    return input.textContent || '';
  }

  async function setComposerAndSend(text) {
    const input = getChatInput();
    if (!input) {
      alert('ChatGPTの入力欄が見つかりませんでした');
      return false;
    }

    CHATGPT_ADAPTER.setComposerText(input, text);
    await sleep(450);

    const expectedMin = Math.min(20, String(text || '').trim().length);
    if (expectedMin > 0 && getComposerText(input).trim().length < expectedMin) {
      CHATGPT_ADAPTER.setComposerText(input, text);
      await sleep(450);
    }

    await sendMessage(input);
    return true;
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

  function escapeAttr(raw) {
    return escapeHtml(raw).replace(/`/g, '&#96;');
  }

  function sanitizeTel(raw) {
    return String(raw || '').replace(/[^\d+]/g, '');
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
      btn.style.cssText = 'width:100%;text-align:left;padding:8px 10px;border:2px solid #cbd5e1;border-radius:6px;background:#ffffff;font-size:12px;line-height:1.5;cursor:pointer;color:#111827;';
      btn.innerHTML = `<span style="display:block;font-size:10px;color:#64748b;margin-bottom:2px;">${TITLE_CANDIDATE_LABELS[idx] || ('案' + (idx + 1))}（${title.length}文字）</span>${escapeHtml(title)}`;
      btn.onclick = () => {
        applyTitleToBlogHtml(title);
        wrap.querySelectorAll('button').forEach(b => {
          b.style.borderColor = '#cbd5e1';
          b.style.background = '#ffffff';
        });
        btn.style.borderColor = '#2563eb';
        btn.style.background = '#dbeafe';
        const toast = document.getElementById('eisai-copy-toast');
        if (toast) {
          toast.style.display = 'block';
          toast.textContent = `📰 タイトルを反映しました：${title}`;
          setTimeout(() => { toast.style.display = 'none'; }, 2000);
        }
      };
      wrap.appendChild(btn);
    });
    // 初期状態は1案目（h1と同一）を選択済み表示
    const first = wrap.querySelector('button');
    if (first) {
      first.style.borderColor = '#2563eb';
      first.style.background = '#dbeafe';
    }
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
    if (markerMatch) return markerMatch[1].trim();
    return text
      .replace(/^---\s*/i, '')
      .replace(/以下のプロンプトで画像を生成してください\s*/g, '')
      .replace(/このプロンプトで画像を生成してください。?\s*/g, '')
      .replace(/\s*---$/i, '')
      .trim();
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
      '<a href="tel:' + safeTel + '" style="display: inline-block; background: #fff; color: #e67e22; padding: 16px 32px; border-radius: 50px; font-size: 15px; font-weight: bold; text-decoration: none; border: 2px solid #e67e22;">電話で直接申し込む</a>' +
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
  let blogWatchTimer = null;
  let thumbnailWatchTimer = null;

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
    if (blogWatchTimer) {
      clearInterval(blogWatchTimer);
      blogWatchTimer = null;
    }

    let last = '';
    let stableCount = 0;
    let pollCount = 0;
    const maxPollCount = 300;

    blogWatchTimer = setInterval(() => {
      pollCount++;
      const latest = getLatestResponseNodeAfterBaseline(baselineCount);
      if (!latest) {
        if (pollCount === 20) {
          statusDiv.textContent = '⚠️ ChatGPTの回答欄をまだ検出できません。生成が終わっているのにボタンが出ない場合は、少し待つか再生成してください。';
          statusDiv.classList.add('show');
        }
        if (pollCount >= maxPollCount) {
          clearInterval(blogWatchTimer);
          blogWatchTimer = null;
          statusDiv.textContent = '⚠️ 生成完了を検出できませんでした。ChatGPTの生成が止まっているか確認し、もう一度お試しください。';
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

      if (pollCount >= maxPollCount && !isReadyToFinalize) {
        clearInterval(blogWatchTimer);
        blogWatchTimer = null;
        statusDiv.textContent = '⚠️ 生成完了を検出できませんでした。ChatGPTの生成が止まっているか確認し、もう一度お試しください。';
        statusDiv.classList.add('show');
        copyBtn.style.display = 'none';
        return;
      }

      if (isReadyToFinalize) {
        clearInterval(blogWatchTimer);
        blogWatchTimer = null;

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

          // タイトル候補を抽出し、本文からEISAI_TITLESコメントを除去する
          const titleResult = extractTitleCandidates(decoded);
          decoded = titleResult.html;
          lastTitleCandidates = titleResult.titles;

          if (!hasEnoughArticleHtml(decoded)) {
            lastBlogHtml = '';
            setGeneratedContext({ blogHtml: '', blogTitle: '' });
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
            statusDiv.textContent = '⚠️ CTAリンク先URLが未設定です。教室情報設定でURLを保存してから、もう一度生成してください。';
            statusDiv.classList.add('show');
            copyBtn.style.display = 'none';
            return;
          }
          if (!/^https?:\/\//i.test(ctaUrl)) ctaUrl = 'https://' + ctaUrl;

          const ctaHtml = buildCtaHtml(ctaUrl, ctaTel, ctaData);
          lastBlogTitle = extractH1Text(decoded);
          lastBlogHtml = decoded + '\n\n' + ctaHtml;
          setGeneratedContext({
            blogHtml: lastBlogHtml,
            articleFacts: lastArticleFacts,
            blogTitle: lastBlogTitle
          });

        } catch (e) {
          console.error('ブログHTML処理エラー:', e);
          return;
        }

        statusDiv.textContent = '✅ ブログ記事の生成が完了しました。下の赤いボタンからHTMLをコピーできます。';
        statusDiv.classList.add('show');
        renderTitleCandidates();
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
    if (thumbnailWatchTimer) {
      clearInterval(thumbnailWatchTimer);
      thumbnailWatchTimer = null;
    }

    let last = '';
    let stableCount = 0;
    let pollCount = 0;
    const maxPollCount = 300;

    thumbnailWatchTimer = setInterval(() => {
      if (!isGeneratingPrompt) {
        clearInterval(thumbnailWatchTimer);
        thumbnailWatchTimer = null;
        return;
      }

      pollCount++;
      const nodes = CHATGPT_ADAPTER.getResponseNodes().slice(baselineCount);
      if (!nodes.length) {
        if (pollCount >= maxPollCount) {
          clearInterval(thumbnailWatchTimer);
          thumbnailWatchTimer = null;
          isGeneratingPrompt = false;
          statusDiv.textContent = '⚠️ サムネイル指示の生成完了を検出できませんでした。ChatGPTの生成が止まっているか確認し、もう一度お試しください。';
          statusDiv.classList.add('show');
        }
        return;
      }

      const latest = nodes[nodes.length - 1];
      const txt = CHATGPT_ADAPTER.getResponseText(latest);
      const promptText = extractImagePromptText(txt);
      const hasPromptMarker = /\[\[EISAI_IMG_PROMPT\]\][\s\S]*?\[\[\/EISAI_IMG_PROMPT\]\]/.test(txt);

      if (hasPromptMarker) {
        if (txt === last) {
          stableCount++;
        } else {
          last = txt;
          stableCount = 0;
        }

        if (!CHATGPT_ADAPTER.isGenerating() && stableCount >= 3 && promptText.length > 80) {
          clearInterval(thumbnailWatchTimer);
          thumbnailWatchTimer = null;
          lastPromptNode = latest;
          lastImagePromptText = promptText;
          isGeneratingPrompt = false;
          imgExecBtn.style.display = 'block';
          if (imgExecBtn.parentElement) imgExecBtn.parentElement.style.display = 'block';

          alert('画像生成用プロンプトの出力が完了しました。\n\n１．この画面の内容を確認したら閉じてください。\n２．ChatGPTの画像生成が使える状態か確認してください。\n３．「このプロンプトで画像を生成する」ボタンを押して生成をスタート。\n\nそれでは、進めてください。');

          statusDiv.textContent = '✅ サムネイル指示の生成が完了しました。内容を確認して「このプロンプトで画像を生成する」ボタンを押してください。';
          statusDiv.classList.add('show');
        }
      }

      if (pollCount >= maxPollCount) {
        clearInterval(thumbnailWatchTimer);
        thumbnailWatchTimer = null;
        isGeneratingPrompt = false;
        statusDiv.textContent = '⚠️ サムネイル指示の生成完了を検出できませんでした。ChatGPTの生成が止まっているか確認し、もう一度お試しください。';
        statusDiv.classList.add('show');
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
    const btnGrowth = addTypeButton(BLOG_TYPES.GROWTH, '個人成長');
    addTypeButton(BLOG_TYPES.EVENT, '対策・イベント');
    addTypeButton(BLOG_TYPES.TRIAL, '無料体験授業');
    addTypeButton(BLOG_TYPES.CONSULTATION, '無料学習相談');
    addTypeButton(BLOG_TYPES.OTHER, 'その他・学習情報');
    btnGrowth.classList.add('eisai-type-btn-active');

    const nextBtn = document.createElement('button');
    nextBtn.className = 'eisai-primary-btn';
    nextBtn.type = 'button';
    nextBtn.textContent = '次へ';
    nextBtn.style.cssText = 'width:100%;padding:10px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;margin-top:10px;font-size:14px;';
    step1.appendChild(nextBtn);

    const step2 = createEl('div', { id: 'eisai-step2', style: { display: 'none' } }, content);

    // 生成後に入力欄(step2)を畳んで、下の進捗（状態・タイトル・画像生成）を見せるアコーディオン見出し
    const inputAccordion = createEl('div', {
      id: 'eisai-input-accordion',
      style: {
        display: 'none',
        cursor: 'pointer',
        padding: '10px 12px',
        marginBottom: '10px',
        background: '#eef2ff',
        border: '1px solid #c7d2fe',
        borderRadius: '8px',
        fontSize: '13px',
        fontWeight: '600',
        color: '#3730a3',
        userSelect: 'none'
      }
    }, content, '📝 入力内容を表示 ▼');
    content.insertBefore(inputAccordion, step2);
    inputAccordion.onclick = () => {
      const willOpen = step2.style.display === 'none';
      step2.style.display = willOpen ? 'block' : 'none';
      inputAccordion.textContent = willOpen ? '📝 入力内容を閉じる ▲' : '📝 入力内容を表示 ▼';
    };
    function collapseInputForResult() {
      step2.style.display = 'none';
      inputAccordion.style.display = 'block';
      inputAccordion.textContent = '📝 入力内容を表示 ▼';
    }
    function resetInputAccordion() {
      inputAccordion.style.display = 'none';
      inputAccordion.textContent = '📝 入力内容を表示 ▼';
    }

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
    const selectedTypeText = createEl('span', { style: { minWidth: '0' } }, selectedTypeLabel, '📝 個人成長（Before／After）');
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
        label: '📝 個人成長（Before／After）',
        hint: '点数アップだけでなく、ノートの取り方・質問の仕方・学習姿勢など「一人の生徒の変化」を書きます。速報ではなく、一人の成長を深く描く場所です。',
        fields: [
          { key: 'student', label: '主役の生徒情報', placeholder: '例：中2・篠崎第二中・Aさん・数学', isArea: false },
          { key: 'before', label: 'Before（悩み・課題・以前の様子）', placeholder: '例：計算ミスが多く、途中式を書かないことが多かった。本人も数学に苦手意識があった', isArea: true },
          { key: 'after', label: 'After（結果・変化・今の様子）', placeholder: '例：途中式を残すようになり、確認テストで安定して正解できるようになった。今回84点、39点アップ', isArea: true },
          { key: 'actions', label: '教室で行った具体的なこと（3つ以上）', placeholder: '例：\n・授業冒頭で計算練習を10分\n・途中式をノートに残すルールを作った\n・間違えた問題だけを解き直しリスト化', isArea: true },
          { key: 'reality', label: '現場で見えた変化・リアルな場面', placeholder: '例：最初は「どうせ無理」と言っていたが、自分から質問できる回数が増えた。点数を見た時に少し照れながら笑っていた', isArea: true },
          { key: 'episode', label: '印象に残ったエピソード・室長コメント', placeholder: '例：結果だけでなく、途中式を書く習慣がついたことが一番大きな成長だと感じています', isArea: true }
        ]
      },
      [BLOG_TYPES.EVENT]: {
        label: '📅 対策・イベント紹介',
        hint: 'テスト対策・英検対策・講習など。地域の学校名・対象・悩み・参加後のメリットまで入れるとSEOとCVに強くなります。',
        fields: [
          { key: 'eventName', label: '対策・イベント名／対象', placeholder: '例：大鳥居校 定期テスト対策会・中1〜中3対象', isArea: false },
          { key: 'target', label: '対象の学校・学年・検定など', placeholder: '例：出雲中・糀谷中・羽田中の定期テスト／英検3級対策', isArea: false },
          { key: 'worries', label: '保護者・生徒によくある悩み', placeholder: '例：\n・学校ワークが終わらない\n・英検の単語が覚えられない\n・テスト範囲が広くて何から手をつけるか迷う', isArea: true },
          { key: 'flow', label: '当日の内容・流れ', placeholder: '例：\n・学校別にテスト範囲を確認\n・苦手単元を演習\n・確認テストで定着度をチェック', isArea: true },
          { key: 'scene', label: '当日の雰囲気・教室で見えた場面', placeholder: '例：最初は不安そうだった生徒も、確認テストで正解が増えると表情が明るくなった', isArea: true },
          { key: 'benefit', label: '参加後にどうなってほしいか', placeholder: '例：やるべきことが整理され、家庭でもテスト前の動き方が見えやすくなる', isArea: true }
        ]
      },
      [BLOG_TYPES.TRIAL]: {
        label: '✏️ 無料体験授業',
        hint: '体験授業を受ける前と後で、保護者・生徒の不安や表情がどう変わったかを描きます。申し込みCVにつなげる場所です。',
        fields: [
          { key: 'student', label: '体験した生徒・保護者の情報', placeholder: '例：中1・羽田中・Bくん・英語／お母さまから相談', isArea: false },
          { key: 'trialBefore', label: '体験前の悩み・不安', placeholder: '例：英語が苦手で、家では単語練習を嫌がっていた。塾が合うか保護者も不安だった', isArea: true },
          { key: 'trialContent', label: '体験授業で行ったこと', placeholder: '例：\n・単語の覚え方を一緒に確認\n・教科書本文を1文ずつ読む\n・間違えた問題をその場で解き直す', isArea: true },
          { key: 'after', label: '体験後の変化・反応', placeholder: '例：本人が「思ったよりわかった」と話し、お母さまも表情が少し安心された', isArea: true },
          { key: 'nextStep', label: '次に提案した一歩・室長コメント', placeholder: '例：まずは単語チェックを短時間で続け、学校ワークの進め方も一緒に整えていきたいです', isArea: true }
        ]
      },
      [BLOG_TYPES.CONSULTATION]: {
        label: '📒 無料学習相談',
        hint: '無料学習相談で、保護者の悩みがどう整理され、次の一歩がどう見えたかを書きます。相談CVにつなげる場所です。',
        fields: [
          { key: 'student', label: '相談した保護者・生徒の情報', placeholder: '例：中2・糀谷中・お母さま／数学と家庭学習の相談', isArea: false },
          { key: 'concernBefore', label: '相談前の悩み・不安・不満', placeholder: '例：家で勉強しているのに点数が伸びず、親子で声かけがきつくなっていた', isArea: true },
          { key: 'diagnosis', label: '相談で見えてきた原因・整理したこと', placeholder: '例：学校ワークの進め方が遅く、テスト直前に解き直し時間が残っていなかった', isArea: true },
          { key: 'advice', label: '提案した具体策（3つ以上）', placeholder: '例：\n・テスト2週間前までに学校ワーク1周\n・間違えた問題を色分け\n・週2回の自習で進捗確認', isArea: true },
          { key: 'afterFeeling', label: '相談後の変化・保護者の反応', placeholder: '例：「何をすればいいか見えました」と少し安心された様子だった', isArea: true },
          { key: 'managerComment', label: '室長として伝えたい一言', placeholder: '例：不安を抱えたままにせず、まず状況を一緒に整理することが大切です', isArea: true }
        ]
      },
      [BLOG_TYPES.OTHER]: {
        label: '📄 その他・学習情報',
        hint: '学習情報・地域の学校情報・勉強法など。SEOを意識して、地域名・学校名・保護者の検索意図を入れてください。',
        fields: [
          { key: 'theme', label: 'テーマ・検索されそうな悩み', placeholder: '例：大鳥居エリアの中学生が定期テスト前にやるべき勉強法', isArea: false },
          { key: 'target', label: '誰に向けて書きたいか', placeholder: '例：テスト前に何をすればいいか迷っている中学生の保護者', isArea: false },
          { key: 'localSeo', label: '入れたい地域名・学校名・キーワード', placeholder: '例：大鳥居・糀谷・穴守稲荷／出雲中・糀谷中／定期テスト対策', isArea: true },
          { key: 'actions', label: '本文で伝えたいポイント（3つ以上）', placeholder: '例：\n・学校ワークは早めに1周\n・間違えた問題を解き直す\n・自習室を使って進捗確認', isArea: true },
          { key: 'episode', label: '教室で見えた場面・室長メッセージ', placeholder: '例：テスト前になると自習に来る生徒が増え、質問の内容も具体的になってきます', isArea: true }
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
            episode: '最初は「数学は無理」と言っていましたが、テスト前には自分から自習席に座り、間違えた問題をもう一度解き直す姿が印象的でした。'
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
            target: '架空中・出雲中・糀谷中の定期テスト',
            worries: '・学校ワークが終わらない\n・テスト範囲が広くて何から手をつけるか迷う\n・提出物と勉強を両立できない',
            flow: '・テスト範囲表をもとに学習計画を作成\n・学校ワークの進み具合を確認\n・英数の苦手単元を個別に演習\n・最後に確認テストで定着度をチェック',
            scene: '最初は何から始めるか迷っていた生徒も、確認テストで正解が増えると表情が明るくなりました。',
            benefit: 'やるべきことが整理され、家庭でもテスト前の動き方が見えやすくなります。'
          }
        },
        {
          label: '春期講習',
          values: {
            eventName: '春期講習・新学年準備コース',
            target: '新中1〜新中3・架空中学校',
            worries: '・新学年でついていけるか不安\n・前学年の苦手を持ち越している\n・春休みの過ごし方が決まらない',
            flow: '・現学年の苦手単元を診断\n・新学年でつまずきやすい単元を先取り\n・1人ひとりに合わせた授業回数を提案\n・最終日に学習状況を保護者へ報告',
            scene: '新学年への不安を口にしていた生徒が、先取り内容を一つ解けたことで少し安心した様子でした。',
            benefit: '新学年のスタートで不安を減らし、春休みの学習リズムを作れます。'
          }
        }
      ],
      [BLOG_TYPES.TRIAL]: [
        {
          label: '英語の体験授業',
          values: {
            student: '中1・架空中学校・Bくん・英語／お母さまから相談',
            trialBefore: '英語が苦手で、家では単語練習を嫌がっていた。塾が合うか保護者も不安だった。',
            trialContent: '・単語の覚え方を一緒に確認\n・教科書本文を1文ずつ読む\n・間違えた問題をその場で解き直す',
            after: '本人が「思ったよりわかった」と話し、お母さまも表情が少し安心された様子でした。',
            nextStep: 'まずは単語チェックを短時間で続け、学校ワークの進め方も一緒に整えていきたいです。'
          }
        }
      ],
      [BLOG_TYPES.CONSULTATION]: [
        {
          label: '数学と家庭学習の相談',
          values: {
            student: '中2・架空中学校・お母さま／数学と家庭学習の相談',
            concernBefore: '家で勉強しているのに点数が伸びず、親子で声かけがきつくなっていた。',
            diagnosis: '学校ワークの進め方が遅く、テスト直前に解き直し時間が残っていなかった。',
            advice: '・テスト2週間前までに学校ワーク1周\n・間違えた問題を色分け\n・週2回の自習で進捗確認',
            afterFeeling: '「何をすればいいか見えました」と少し安心された様子だった。',
            managerComment: '不安を抱えたままにせず、まず状況を一緒に整理することが大切です。'
          }
        }
      ],
      [BLOG_TYPES.OTHER]: [
        {
          label: '勉強習慣',
          values: {
            theme: '勉強習慣を作るために最初に見直したいこと',
            target: '家で勉強を始めるまでに時間がかかる中学生の保護者',
            localSeo: '架空エリア・架空中学校／家庭学習・勉強習慣',
            actions: '・勉強する時間を固定する\n・最初の5分だけ取りかかるルールを作る\n・学校ワークを小さく区切る\n・できたことを毎回確認する',
            episode: '最初から長時間頑張るのではなく、短い時間でも続けることで自信がついた生徒がいました。'
          }
        },
        {
          label: 'テスト後の見直し',
          values: {
            theme: 'テスト後の見直しで次の点数につなげる方法',
            target: 'テストが返ってきた後に何をすればいいか迷う中学生の保護者',
            localSeo: '架空エリア・架空中学校／定期テスト・見直し',
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
      resetInputAccordion();
    };
    backBtn.onclick = () => {
      step2.style.display = 'none';
      step1.style.display = 'block';
      resetInputAccordion();
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

    // ブログタイトル選択セクション（SEO / 共感 / CV の3案から選択）
    const titleSection = createEl('div', {
      id: 'eisai-title-section',
      style: {
        display: 'none',
        marginTop: '12px',
        padding: '10px',
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '8px'
      }
    }, content);
    createEl('div', {
      style: { fontWeight: '700', fontSize: '13px', color: '#1e40af', marginBottom: '6px' }
    }, titleSection, '📰 ブログタイトルを選択（記事に反映されます）');
    createEl('div', {
      style: { fontSize: '11px', color: '#475569', marginBottom: '8px', lineHeight: '1.5' }
    }, titleSection, '① SEO重視 ② 共感・ベネフィット重視 ③ CV（行動）重視 の3案です。クリックで <h1> が差し替わります。');
    createEl('div', {
      id: 'eisai-title-buttons',
      style: { display: 'flex', flexDirection: 'column', gap: '6px' }
    }, titleSection);

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

    // 参照画像アップロードの案内（全記事タイプ共通で常時表示）
    createEl('div', {
      style: {
        fontSize: '12px',
        color: '#92400e',
        backgroundColor: '#fffbeb',
        padding: '8px',
        borderRadius: '6px',
        marginBottom: '8px',
        border: '1px solid #fde68a',
        lineHeight: '1.6',
        fontWeight: 'bold'
      }
    }, imgSection, '📎 参照してほしい写真（生徒のノート・答案・教室の様子・講師や室長の人物写真など）があれば、画像生成前にこのチャットへアップロード（添付）してください。アップロードされた写真は画像のベースとして優先的に使われます。');

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
    }, imgSection, '🖼 画像は実写スタイルで生成されます。サムネイルの構図や訴求の方向性はブログ記事の内容から自動で判断されます。');

    // サムネイルのメインにするタイトルを3案から選択（生成完了後にlastTitleCandidatesから充填）
    createEl('label', { className: 'eisai-label' }, imgSection, 'サムネイルのメインにするタイトル');
    const thumbTitleSelect = createEl('select', {
      className: 'eisai-input',
      style: { width: '100%', marginBottom: '8px' }
    }, imgSection);
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
      const sourceBlogHtml = lastBlogHtml || '';
      // ユーザーが選んだ「サムネイルのメインにするタイトル」を優先（未選択時はh1/本文タイトル）
      const chosenThumbTitle = (thumbTitleSelect && thumbTitleSelect.value) ? thumbTitleSelect.value.trim() : '';
      const sourceBlogTitle = chosenThumbTitle || lastBlogTitle || extractH1Text(sourceBlogHtml);
      const sourceArticleFacts = lastArticleFacts || '';

      if (!sourceBlogHtml) {
        alert('サムネイル作成に使うブログ本文が見つかりませんでした。\n先にブログ生成を完了してから、もう一度お試しください。');
        return;
      }

      // 参照画像（アップロード写真）の扱いルール。記事タイプに関係なく常に適用する。
      const referenceImageRules = `
■ 参照画像（アップロード写真）の扱い（最優先ルール）
  - ユーザーがこのチャットに写真をアップロードしている場合は、必ずその写真を最優先の参照素材にしてください。
  - 人物写真がある場合：人物のみを丁寧に切り抜き、元の背景は使わず、顔・髪型・雰囲気をできるだけ忠実に再現してください。人物は画面右側1/3にバストアップで配置し、左2/3をテキストエリアにしてください。日本語フルネームとローマ字表記の2行で名前を入れてもよいです。
  - ノート・答案・教室などの写真がある場合：その実物の雰囲気（ノートの書き込み、答案の点数、教室の明るさなど）をプロンプトの描写に反映してください。
  - 写真がアップロードされていない場合は、下記のClassroom Setting / Tutoring Styleの描写を使ってください。`;

      const mainColorData = COLOR_STYLES[mainColor] || {};
      const subColorData = COLOR_STYLES[subColor] || {};
      const brandRules = mainColor === 'お任せ' || subColor === 'お任せ'
        ? 'Color scheme optimized for the article content and auto-selected thumbnail objective'
        : ((mainColorData.sub || mainColor) + ' and ' + (subColorData.main || subColor) + ' color scheme');
      const colorScheme = mainColor === 'お任せ' || subColor === 'お任せ'
        ? 'Colors automatically selected based on the article content and auto-selected thumbnail objective'
        : ('Main color ' + (mainColorData.main || mainColor) + ' (' + (mainColorData.hex || '') + '), Sub color ' + (subColorData.main || subColor) + ' (' + (subColorData.hex || '') + ')');
      const thumbnailTypeInstruction = THUMBNAIL_TYPE_OPTIONS[thumbnailType] || THUMBNAIL_TYPE_OPTIONS['おまかせ'];
      const visualExpressionInstruction = VISUAL_EXPRESSION_OPTIONS[style] || VISUAL_EXPRESSION_OPTIONS['実写'];
      const textImpactInstruction = TEXT_IMPACT_OPTIONS[textImpact] || TEXT_IMPACT_OPTIONS['強め'];
      const artDirectionHints = THUMBNAIL_ART_DIRECTIONS.map((item, index) => `${index + 1}. ${item}`).join('\n');
      const layoutVariantHints = THUMBNAIL_LAYOUT_VARIANTS.map((item, index) => `${index + 1}. ${item}`).join('\n');

      const input = getChatInput();
      if (!input) {
        alert('ChatGPTの入力欄が見つかりませんでした');
        return;
      }

      const promptRequest = `
【画像生成リクエスト】
以下のブログ記事の内容に基づき、定義されたスタイルで最高品質のサムネイル画像を生成するためのプロンプトを作成してください。

■ ブログ記事内容
${sourceBlogHtml}

■ ブログのタイトル（このトーンと事実を引き継ぐ。作り直して別の場面を作らない）
${sourceBlogTitle || '(未取得：本文から推定してよいが、下の確定ファクトの範囲を超えない)'}

■ 記事の確定ファクト（メイン・サブ・数字・場面はこの中の事実だけで作る）
${sourceArticleFacts || '(未取得。本文HTMLに書かれている事実だけを使う)'}

■ 創作の禁止（最重要）
- 上の確定ファクトと本文タイトルに無い「行動・数字・場面・セリフ」を作らないでください。
- 例：入力や本文に「答案を見せに来た」が無ければ、サムネにも書かないでください。
- 数字は確定ファクトまたは本文にあるもの（前回点／今回点／＋◯点など）だけを使ってください。
- サムネは強くしてよいですが、事実を盛って強くするのは禁止です。

■ サムネイル設計の選択
- サムネイル型（ブログ内容から自動判断）: ${thumbnailType}
  ${thumbnailTypeInstruction}
- 見た目の表現（実写固定）: ${style}
  ${visualExpressionInstruction}
  必ず実写（photorealistic）で生成してください。アニメ・イラスト・漫画調・3Dクレイ調は使わないでください。
- 文字の強さ: ${textImpact}
  ${textImpactInstruction}
- 色: ${colorScheme}

■ IMAGE2.0向けの考え方
細かい仕様で縛りすぎると、画像が固く、毎回似た構図になりやすいです。
あなたは画像生成AIに細かい命令を出す係ではなく、ブログを届けるためのサムネイルディレクターです。

目的は、完璧に指示通りのレイアウトを作ることではありません。
ブログ一覧やSNSで一瞬だけ見た保護者が、
「そうそう、うちもこれで困ってる」
「この教室は子どもの気持ちも分かってくれそう」
「ちょっと読んでみたい」
と感じるサムネイルにすることです。

見た目は実写（写真）で固定です。色、文字の強さは方向性のヒントです。
構図や寄り方は、記事の内容や見る人の気持ちに合わせて、実写の範囲で自由に選んでください。

■ ユーザー入力情報
メインキャッチ：${mainCatch}
サブキャッチ：${subCatch}
ポイント：${points}
${referenceImageRules}

■ 見る人起点のサムネイル設計
まず内部で、次の5つを考えてください。この検討は出力しないでください。
1. このブログを一番見てほしい保護者は、どんな不安や願いを持っているか
2. その保護者が一瞬で「自分ごとだ」と感じる言葉は何か
3. 記事の中で、いちばん心に残る場面・変化・証拠は何か
4. その場面を実写写真で見せるとき、どの寄り方・構図が最も伝わるか（イラスト・漫画・図解は使わない）
5. 文字を先に見せるべきか、表情や手元を先に見せるべきか

■ 感情フックの作り方
- サムネイルは記事の要約ではなく、読み手の感情を動かす入口です。
- まず内部で、今回いちばん狙う反応を1つ選んでください。この選択は出力しないでください。
  - 共感: 「そうそう、うちもこれ」
  - 驚き: 「え、そこが原因なの？」
  - 知りたい: 「それでどう変わったの？」
  - 安心: 「相談してもいいのかも」
  - 希望: 「うちの子も少し変われるかも」
- メインキャッチは、記事の結論を全部説明しきらず、少しだけ続きを知りたくなる余白を残してください。
- ただし釣りっぽい煽りや嘘は使わないでください。記事本文にある悩み・場面・変化から自然に作ってください。
- シンプルで強い言葉を優先してください。例: 「何からやる？」「そこだったの？」「止まる理由」「最初の5分」「うちもかも」「自分から解いた」「なぜ伸びた？」
- 弱いまとめ言葉は避けてください。例: 「成長の理由」「学習習慣について」「点数アップ事例」「取り組み紹介」「変化のきっかけ」。
- ビジュアルも情報を並べるのではなく、感情が動く一瞬を切り取ってください。例: ペンが止まった手元、少し顔が上がった表情、親が悩む場面、先生がそっと指すノート、赤丸の答案を見つめる瞬間。

■ 画像内テキストの短さ
- 画像生成では長い日本語ほど崩れやすいです。メインは全角8〜12字、サブは各6〜10字を目安にしてください。
- 長い説明文を画像に入れないでください。言い切り・体言止め・数字を優先します。
- 点数アップ系なら、サブ1に学年＋教科（例: 中2数学）、サブ2に理由または点数推移（例: 途中式 / 48→76点）を入れると伝わりやすいです。
- 学校名が確定ファクトにある場合だけ、小さなバッジやサブ要素として使ってOKです。

■ 文字設計フォーミュラ
- メイン = 感情の変化 or 数字（どちらか1つを主役）
- サブ1 = 学年＋教科（点数アップ系では必須）
- サブ2 = 理由 or 点数推移（記事にある事実だけ）
- バッジ = 任意で1つ（学校名・矢印・赤丸など、意味がある場合だけ）

■ 訴求力のベンチマーク
- 文字は控えめな見出しではなく、ブログ一覧で真っ先に目に入る広告サムネイルの主役として扱ってください。
- 画面の40〜55%くらいを大きな日本語コピーが占めてもOKです。人物や教室写真より先に、メインキャッチが読める強さを優先してください。
- メイン文字は太く、大きく、白フチ・濃い影・縁取り・強いコントラストなどを使い、スマホの小さい表示でも読めるようにしてください。
- サブキャッチは「何が得られるか」「なぜ気になるか」を補う短い一言にしてください。例: 「3つの秘訣を公開」「やる気を引き出す相談会」「お子様だけの戦略を設計」「早く来れば良かった」。
- ただし、記事にない実績や断定は作らないでください。「100点アップ」「80人抜き」など本文にない数字は使わないでください。
- 文字と人物の役割を分けてください。文字で興味を引き、人物・手元・教室の場面で「ここなら分かってくれそう」という感情を支えます。
- 写真・イラストの空きスペースに小さく文字を置くのではなく、文字を置くための余白や帯を大胆に作ってください。必要なら斜め帯、白い帯、黒フチ文字、オレンジ強調なども使ってOKです。
- シンプルでも、文字の強さは妥協しないでください。弱い上品さより、読みやすく刺さる強さを優先します。

そのうえで、内部で3案ほど方向性を考え、最も「読みたくなる」1案だけを最終プロンプトにしてください。
3案の比較や理由は出力しないでください。

■ マンネリ防止の方向性候補
毎回同じ構図にしないため、内部で以下から2〜3方向を検討し、記事に一番合う1つを選んでください。この一覧は出力しないでください。
${artDirectionHints}

■ レイアウト候補
内部検討用です。記事に合うものだけ選び、無理に全部入れないでください。
${layoutVariantHints}

■ キャッチの考え方
- おまかせモードの場合は、ブログ記事からメインキャッチとサブキャッチを自分で考えてください。ブログタイトルをそのまま使うだけは禁止です。
- メインキャッチは、見る人の心を止める短い言葉にしてください。説明ではなく、感情・悩み・変化・数字のどれかが一瞬で伝わる言葉にします。
- メインキャッチは「全部わかる言葉」より「気になって続きを見たくなる言葉」を優先してください。ブログの答えを出し切らず、クリック後に本文で回収する設計にします。
- サブキャッチは必要に応じて1〜2本。学年・科目・学校名・点数推移・変化の理由など、記事理解に必要なものだけを補ってください。
- 手動入力がある場合は尊重してください。ただし、より伝わるように短く整えるのはOKです。
- 点数、学年、科目、学校名など、記事にある事実は使ってOKです。記事にない実績や数字は作らないでください。

■ ビジュアルの考え方
- 記事の内容が伝わるなら、答案・ノート・手元・生徒の表情・保護者の不安・先生の声かけ・教室の空気・イベント風景など、モチーフは自由に選んでください。
- 毎回同じ「答案を大きく見せる」構図にしないでください。記事によって、手元寄り、表情寄り、親目線、雑誌見出し風（いずれも実写ベース）などを選んでください。イラスト・漫画・図解調にはしないでください。
- 画面に入れる要素は少なくしてください。メインとなる感情フック、強い文字、伝わるビジュアル、この3つがあれば十分です。
- 文字はサムネイルとして読める強さにしてください。小さく上品すぎて読めないより、少し大胆な方を優先します。
- アイコンやバッジは使っても使わなくてもOKです。使う場合は、内容理解に役立つものだけにしてください。

■ ノート・答案の物理的な正しさ（最重要・破綻防止）
- 生徒が紙面を「読んでいる／勉強している」姿と、紙面を読者（カメラ）に正面から見せる構図は、同時には成立しません（生徒から見ると紙が逆さ・裏向きになります）。どちらか一方に決めてください。
- 生徒が机で読んでいる場面にする場合は、必ず次のどれかにしてください。
  A. 肩越し（over-the-shoulder）または斜め後ろ・横からのカメラで、読者が生徒とほぼ同じ視点を共有する。→ ノートは生徒にも読者にも自然な向きになる（推奨）。
  B. 生徒の表情・感情を主役にし、ノートや答案は生徒が今まさに読んでいる紙ではなく、手前に別に置かれた"見せ物"として配置する（生徒はその紙を読んでいる動作にしない）。
  C. 記事に「見せた／持ってきた」場面がある時だけ、生徒がノートや答案をカメラの方へ掲げて見せているポーズにする。
- 禁止：生徒が机に向かって勉強しているのに、その同じ紙の文字だけが読者側に正面を向いている構図（物理的にあり得ず、最も破綻して見えます）。
- 紙の向きは必ず「その紙を使っている人」を基準に自然にしてください。読者に見せたいだけの理由で、人物基準の向きを反転させないでください。

■ 紙面の細かい文字を描き込みすぎない（崩れ防止）
- ノート・答案・単語帳などの文字は、判読できるほど大きく鮮明に写さないでください。浅い被写界深度（手前や周辺をぼかす）、見切れ、角度で"雰囲気"として見せてください。
- 具体的な英単語リストや問題文の行を細かく描かせないでください（画像生成では小さな文字が必ず崩れ、でたらめな文字列になります）。
- 点数を見せる場合は「100」のような大きな数字を1つだけ見せ、答案の問題行・単語行までは描写しないでください。

■ 最終プロンプトの書き方
- 最終的な画像生成プロンプトは、短めの日本語で書いてください。長い仕様書にしないでください。
- 「誰にどう感じてほしいか」「何を一番大きく見せるか」「どんな画にするか」「入れる文字」を自然な文章で伝えてください。
- 細かい座標、厳密な比率、禁止事項の長い列挙は入れないでください。
- IMAGE2.0が自由に良い絵を作れる余白を残してください。

■ 最低限守ること
- 画像比率は3:2
- 画像内の文字は日本語
- 塾名やロゴは入れない
- 同じ文言を何度も繰り返さない
- 記事にない実績や数字は作らない
- メイン文字は読みやすく、サムネイルとして目立つ

■ 出力形式
[[EISAI_IMG_PROMPT]]
[ここに、IMAGE2.0へそのまま渡せる短めの画像生成プロンプト]
[[/EISAI_IMG_PROMPT]]

【重要】プロンプトを出力のみで、画像は生成しないでください。`;

      statusDiv.textContent = '🎯 画像生成用プロンプトを作成しています...';
      statusDiv.classList.add('show');
      hideBlogCopyButton();
      imgExecBtn.style.display = 'none';
      syncFooterButtons();

      isGeneratingPrompt = true;
      lastPromptNode = null;
      lastImagePromptText = '';

      const responseBaseline = CHATGPT_ADAPTER.getResponseNodes().length;
      const sent = await setComposerAndSend(promptRequest);
      if (sent) {
        watchThumbnailPrompt(statusDiv, imgExecBtn, responseBaseline);
      } else {
        isGeneratingPrompt = false;
      }
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
      lastArticleFacts = formContent;
      lastBlogTitle = '';
      lastBlogHtml = '';
      setGeneratedContext({
        articleFacts: formContent,
        blogTitle: '',
        blogHtml: ''
      });

      const TYPE_INSTRUCTIONS = {
        [BLOG_TYPES.GROWTH]: `【記事タイプ】成長ストーリー型
【このタイプで必ず作る読後感】
- 保護者が「うちの子にも似ている」「この子の気持ちも分かる」と感じ、変化までの道筋を具体的に想像できる記事にしてください。
- 生徒の変化を、点数だけでなく、気持ちが少し動いた瞬間として描いてください。
【構成指示】
- 導入：点数や成果から入らず、家庭で見えやすい困りごとや保護者の迷いから入る
- 本文：ビフォー→小さな転機→教室での具体策→アフターの順で、変化の過程を場面として描く
- 生徒の表情、口ぐせ、手の動き、ノート、質問の仕方など、入力情報から自然に描ける観察を入れる
- 室長コメントは「何を見て嬉しかったか」「どこに成長を感じたか」を具体的にする
- 見出し例：「最初は〇〇に悩んでいました」「変わるきっかけになった取り組み」「自習席で見えた小さな変化」「質問の仕方が変わった日」「次の目標を口にした帰り道」
- 結末は、入力に合わせて自習・質問・ノート・家庭での会話・次回目標・解き直し・表情の変化などから選び、毎回同じ成功場面にしない
- 締め：同じ悩みを持つ保護者の不安に戻り、相談への自然な一歩につなげる`,
        [BLOG_TYPES.EVENT]: `【記事タイプ】イベント紹介型
【このタイプで必ず作る読後感】
- ただの日程案内ではなく、「参加すると何が変わるのか」「教室ではどんな空気なのか」が伝わる記事にしてください。
- 保護者が「参加させる意味がありそう」と感じるよう、イベントの裏にある教室側の思いを入れてください。
【構成指示】
- 導入：イベント名の説明から入らず、テスト前・講習前・新学期前に保護者が感じる不安から入る
- 本文：イベントの流れを羅列せず、当日の様子、生徒の反応、先生の声かけ、終わった後の変化を入れる
- 「なぜその内容を行うのか」を1つ以上説明し、教室側の意図が伝わるようにする
- 室長コメントは、参加した生徒を見て感じた課題や成長に触れる
- 見出し例：「この時期に多いお悩み」「当日はこんな流れで進めました」「参加後に見えた変化」
- 締め：参加を迷っている保護者が気軽に聞ける雰囲気で終える`,
        [BLOG_TYPES.TRIAL]: `【記事タイプ】無料体験授業 Before／After型
【このタイプで必ず作る読後感】
- 「まず一度、体験して確かめてみたい」と保護者が自然に思える記事にしてください。
- 入会案内ではなく、体験前の不安が、体験後にどう軽くなったかを具体的な場面で伝えてください。
【構成指示】
- 導入：体験授業の説明から入らず、体験前に保護者・生徒が抱えていた不安や迷いから入る
- 本文：体験前の悩み→体験授業で行ったこと→先生の関わり方→生徒・保護者の反応→次の一歩、の順で描く
- 講師の魅力は、すごさよりも「説明の仕方」「声かけ」「質問しやすさ」として具体化する
- 「入会しないと申し訳ない」という圧を出さず、まず試せる安心感を大切にする
- 室長コメントは、体験を通して見えた生徒の様子や、次に一緒にやりたいことに触れる
- 見出し例：「体験前に不安だったこと」「授業中に表情が変わった瞬間」「体験後に見えた次の一歩」
- 締め：まず気軽に試してみたい保護者の背中をそっと押す言葉で終える`,
        [BLOG_TYPES.CONSULTATION]: `【記事タイプ】無料学習相談 Before／After型
【このタイプで必ず作る読後感】
- 「一人で抱え込まず、まず相談してみよう」と保護者が思える記事にしてください。
- 相談で悩みが整理され、次にやることが見えて、気持ちが少し軽くなる過程を描いてください。
【構成指示】
- 導入：サービス名や相談の説明から入らず、相談前に保護者が抱えていた不安・不満・迷いから入る
- 本文：相談前の不安→面談で整理したこと→原因の見立て→提案した具体策→保護者の反応、の順で描く
- 「勧誘されそう」「こんな状態で相談していいのか」という遠慮に、やさしく寄り添う
- 室長の魅力は、聞き方・整理の仕方・現実的な提案として具体的な場面で伝える
- 入会前提ではなく「まず現状を一緒に整理する」という安心感を出す
- 見出し例：「相談前に抱えていた不安」「話して見えてきた本当の原因」「次にやることが見えた瞬間」
- 締め：同じ悩みを抱える保護者へ、気軽に相談してよいことを伝えて終える`,
        [BLOG_TYPES.OTHER]: `【記事タイプ】その他・学習情報型（SEO重視）
【このタイプで必ず作る読後感】
- 汎用コラムではなく、教室で実際に見えたことから保護者の役に立つ視点を届ける記事にしてください。
- 読者が「自分の家庭でも今日から少し見方を変えられそう」と感じる余韻を大切にしてください。
- 地域の保護者が検索して読みに来る記事です。検索意図（例: 「〇〇中 定期テスト 勉強法」）に自然に応える内容にしてください。
【構成指示】
- 導入：テーマの説明から入らず、読み手が日常で感じる困りごとや迷いから入る
- 本文：一般論→結論ではなく、現場で見えた場面→そこから言えること→家庭で考えられる一歩の順で書く
- 入力された地域名・学校名・キーワードを、見出しと本文に不自然にならない範囲で自然に入れる（キーワードの詰め込みは禁止）
- 入力された教室での取り組みやメッセージを中心にし、教育論だけで終わらせない
- 室長コメントは、教室で見ている子どもたちの変化や保護者への願いを入れる
- 見出し例：「〇〇中の定期テストでよく聞くお悩み」「大鳥居エリアの教室で見えていること」「今日からできる小さな一歩」
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

【読者体験の設計：感情に響かせる】
- この記事の目的は、単に教室の成果を伝えることではありません。保護者が「そうなのよ」「うちの子のことを分かってくれている」と感じ、生徒にも「自分だけじゃない」と届く文章にしてください。
- 書き始める前に、入力情報から「誰に、どんな気持ちになってほしい記事か」を内側で決めてください。例: 不安が少し軽くなる / 子どもを責めすぎなくていいと思える / 教室に相談してみようと思える / 生徒の小さな変化を一緒に喜べる。
- 保護者への共感は、悩みを代弁するだけでなく、その裏にある気持ちまで汲み取ってください。例: 焦り、申し訳なさ、声かけへの迷い、比べてしまう苦しさ、信じたいけれど不安な気持ち。
- 生徒への共感も入れてください。できない理由を責めるのではなく、止まってしまう背景、恥ずかしさ、失敗したくない気持ち、少しできた時の安心感を自然に描いてください。
- 教室の取り組みは「何をしたか」だけで終わらせず、「なぜその関わりを選んだのか」「どんな思いで見守ったのか」まで書いてください。
- 室長・先生の思いは、熱い宣伝ではなく、日々そばで見ている人の静かな実感として書いてください。例: ほっとした、嬉しかった、焦らず待とうと思った、ここを一緒に越えたいと感じた。
- AIとして、入力内容をもとに最も心が動く切り口を選んでください。型に合わせるより、読者が読み終えたあとに残る感情を優先してください。

【タイトルの作り方：弱いタイトル禁止。3案を出す】
- タイトルは3案作り、次の3つの方向性で1案ずつ作ってください（各案33文字以内を厳守）。
  1案目（SEO重視）：地域名・学校名・学年・教科・数字など検索されやすい言葉を前方に入れる
  2案目（共感・ベネフィット重視）：保護者の悩みが解消されるイメージや「うちの子も」と思える言葉を入れる
  3案目（CV重視）：無料体験・学習相談・行動につながる言葉や、続きが気になる言葉を入れる
- <h1> には必ず1案目（SEO重視）と同じ文言を入れてください。
- 3案は本文の一番最後（<!--CTA_DATA_END--> の後）に、次の形式の1行コメントで必ず出力してください。
  <!--EISAI_TITLES: ["1案目","2案目","3案目"]-->
- 3案とも18〜33文字を目安にし、記事の内容から離れないこと。誇張・釣りタイトルは禁止です。
- タイトルには、次のうち2つ以上を必ず入れてください: 具体的な悩み / 数字 / 教科 / 学年 / 生徒の行動 / 印象的な場面 / 読者が気になる変化。
- タイトルは、できるだけ「感情の出発点 or 学年＋教科」→「数字の変化」→「理由・きっかけ」の順にしてください。
- 良い型の例:
  - 「数学は無理」から76点へ。中2数学が変わった途中式の話
  - 「数学は無理」から自習席へ。28点アップした中2数学の変化
  - 48→76点。変えたのは「途中式」でした
- 弱い型の例（禁止）:
  - 自習席に向かった中2数学の28点アップ（係り受けがねじれやすい）
  - 48点の数学、答案を自分から見せに来た76点の日（重い／入力に無い場面を作りやすい）
- 数字（前回→今回 or ＋◯点）が入力にある場合は必ず1つ入れ、できるだけ前方に置いてください。
- 「自習席に向かった数学」のように、人がする行動を教科や物に係らせないでください。
- 「一歩」「変化」「成長」「きっかけ」「前向き」「頑張った」だけで終わる抽象タイトルは禁止です。使う場合も、必ず具体的な場面や数字と組み合わせてください。
- 記事本文の一番印象的な場面をタイトルに反映してください。例: 「声が少し大きくなった日」「机に向かう時間が増えた夜」「質問が具体的になった中2数学」。
- 大げさな広告表現は禁止です。「絶対」「必ず」「奇跡」「たったこれだけで」「誰でも」は使わないでください。
- 個人成長型は、Beforeの悩みとAfterの場面をつなぐタイトルにしてください。例: 「途中式を嫌がったAさんの28点アップ」「自習席に向かった中2数学の2週間」「質問が増えた日から変わった英語」。
- 対策・イベント型は、イベント名だけでなく参加後に見える変化を入れてください。例: 「冬期講習で見えた、質問が増えた瞬間」。
- 無料体験授業型は、体験前の不安と体験後の変化を入れてください。例: 「英語を嫌がっていたBくんが、体験後に単語練習を始めた話」。
- 無料学習相談型は、保護者の悩みと相談後の安心を入れてください。例: 「点数が伸びない不安を整理した無料学習相談」。
- その他・学習情報型は、地域名・学校名や検索されそうな悩みを入れてください。例: 「〇〇中の定期テスト前にやるべき3つのこと」。

【点数アップ・成長記事のバリエーションルール】
- 点数アップ記事の結末を毎回「答案を見せに来た」にしないでください。この表現は、入力情報に「答案を見せた」「答案を持ってきた」と明記されている場合だけ使ってください。
- 成果の見せ方は、入力に合わせて次の候補から自然なものを1つ選んでください。複数を無理に詰め込まないでください。
  1. 自習に来る回数が増えた
  2. 質問の内容が具体的になった
  3. ノートの途中式やメモが増えた
  4. 学校ワークの進め方が変わった
  5. 家で机に向かうまでの時間が短くなった
  6. 小テストや確認テストへの向き合い方が変わった
  7. テスト後に次の目標を自分で話した
  8. 間違い直しを避けなくなった
  9. 保護者への報告や家庭での会話が変わった
  10. 授業中の声、目線、手の動き、表情が変わった
- 入力が薄い場合でも、上記のどれかを勝手に実績として断定しないでください。入力に近い行動だけを使い、足りない場合は「教室では、まず取り組み方を一緒に整えました」のように現場の取り組み中心で書いてください。
- タイトルも同じパターンに寄せないでください。「答案」「見せた日」「持ってきた日」は、入力にその場面がある時だけ使ってください。

【本文の書き方ルール】
- 冒頭は、保護者の不安や悩みに寄り添うところから始めてください。いきなり成果や宣伝から入らないでください。
- 保護者、とくにお母さんが「うちの子にも当てはまるかもしれない」「一人で抱え込まなくていいかもしれない」と感じる温度で書いてください。
- 家で見える不安、親子でピリピリしてしまう気持ち、声かけに迷う気持ちにやさしく触れてください。ただし保護者を責めないでください。
- 保護者に寄り添う時は「大変ですよね」で終わらせず、「なぜ大変なのか」を一段深く書いてください。例: 分かっているのに動けない我が子を見るつらさ、声をかけるほど空気が重くなるしんどさ、見守るだけでいいのか迷う気持ち。
- 生徒の描写では、結果が出た子だけを立派に見せすぎないでください。できなかった時間、言葉にできなかった不安、少し動けた瞬間を丁寧に扱ってください。
- 教室の取り組みは、手順説明だけでなく「この子にはまず安心して手を動かしてほしかった」「できない原因を一緒に見える形にしたかった」のように、関わりの意図を添えてください。
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
<h1>18〜33文字程度。タイトル1案目（SEO重視）と同じ文言。悩み・数字・場面・変化のうち2つ以上を含む</h1>
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
<!--EISAI_TITLES: ["SEO重視の33文字以内タイトル（h1と同じ）","共感・ベネフィット重視の33文字以内タイトル","CV重視の33文字以内タイトル"]-->

【禁止】
- JSONで出力しないでください。
- Markdownで出力しないでください。
- コードブロックで囲まないでください。
- 「以下にHTMLを作成します」などの前置き・後置きは禁止です。
- CTA素材だけの出力は禁止です。
- CTA_DATA_START / CTA_DATA_END を省略しないでください。
- <!--EISAI_TITLES: [...]--> の1行を省略しないでください（本文の一番最後に必ず付けます）。
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
      lastTitleCandidates = [];
      const titleSectionReset = document.getElementById('eisai-title-section');
      if (titleSectionReset) titleSectionReset.style.display = 'none';

      // 入力欄をアコーディオンで畳み、状態・タイトル・画像生成が見えるようにする
      collapseInputForResult();
      setTimeout(() => {
        if (statusDiv.scrollIntoView) statusDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);

      const responseBaseline = CHATGPT_ADAPTER.getResponseNodes().length;
      const sent = await setComposerAndSend(prompt);
      if (sent) {
        watchBlogResponseAndEnableCopy(statusDiv, copyBtn, responseBaseline);
      }
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
      populateThumbnailTitleOptions();
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
      const prompt = lastImagePromptText || extractImagePromptText(CHATGPT_ADAPTER.getResponseText(latest));

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

      await setComposerAndSend(prompt);
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
