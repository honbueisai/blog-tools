
// ==UserScript==
// @name         Eisai Blog Generator
// @namespace    http://tampermonkey.net/
// @version      0.56.67
// @description  英才ブログ生成ツール (CTA修正版)
// @author       Yuan
// @match        https://gemini.google.com/*
// @updateURL    https://github.com/honbueisai/blog-tools/raw/refs/heads/main/blog-generator.user.js
// @downloadURL  https://github.com/honbueisai/blog-tools/raw/refs/heads/main/blog-generator.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const TOOL_ID = 'eisai-tool-v0-56-67';
  const BTN_ID = 'eisai-btn-v0-56-67';
  const STORAGE_KEY = 'eisai_blog_info_v05667';
  const CLASSROOM_STORAGE_KEY = 'eisai_classroom_settings_persistent';
  const CURRENT_VERSION = '0.56.67';
  const UPDATE_URL = 'https://github.com/honbueisai/blog-tools/raw/refs/heads/main/blog-generator.user.js';

  const BLOG_TYPES = {
    GROWTH: 'growth_story',
    EVENT: 'event',
    PERSON: 'person',
    SERVICE: 'service',
    SCORE: 'score_summary',
    OTHER: 'other'
  };

  let currentBlogType = BLOG_TYPES.GROWTH;

  console.log('🚀 英才ブログ生成ツール v0.56.59 起動');

  let lastBlogHtml = '';

  // =========================================================
  // 1. 訴求スタイル / 画像スタイル定義
  // =========================================================
  // NANO BANANA PRO Controller 用スタイル定義
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
    '赤': {
      main: 'Red',
      sub: 'Dark Red',
      hex: '#FF4444',
      gradient: 'Red to Dark Red'
    },
    'ピンク': {
      main: 'Pink',
      sub: 'Rose Pink',
      hex: '#FF69B4',
      gradient: 'Pink to Rose Pink'
    },
    'オレンジ': {
      main: 'Orange',
      sub: 'Dark Orange',
      hex: '#FF8C00',
      gradient: 'Orange to Dark Orange'
    },
    'イエロー': {
      main: 'Yellow',
      sub: 'Golden Yellow',
      hex: '#FFD700',
      gradient: 'Yellow to Golden Yellow'
    },
    'グリーン': {
      main: 'Green',
      sub: 'Forest Green',
      hex: '#32CD32',
      gradient: 'Green to Forest Green'
    },
    'ブルー': {
      main: 'Blue',
      sub: 'Navy Blue',
      hex: '#1E90FF',
      gradient: 'Blue to Navy Blue'
    },
    'スカイブルー': {
      main: 'Sky Blue',
      sub: 'Light Blue',
      hex: '#87CEEB',
      gradient: 'Sky Blue to Light Blue'
    },
    'パープル': {
      main: 'Purple',
      sub: 'Deep Purple',
      hex: '#9370DB',
      gradient: 'Purple to Deep Purple'
    },
    '白黒': {
      main: 'Black',
      sub: 'White',
      hex: '#000000',
      gradient: 'Black to White'
    }
  };

  // 既存のブログ生成用スタイル（互換性のため維持）
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
    "  【出力要件】",
    "  1. フォーマット: HTML形式（<html>タグ不要、<h1>から書き始める）",
    "  2. 構成:",
    "     - <h1>: 魅力的なタイトル（32文字以内推奨）",
    "     - 導入: 読者の悩みに寄り添う共感パート",
    "     - 本文: 具体的なエピソード、解決策、教室の取り組み（見出し<h2>, <h3>を活用）",
    "     - 結び: 前向きなメッセージと行動喚起",
    "  3. CTAセクション（重要）:",
    "     記事の最後には、記事の内容に即したCTAデータを以下の形式で必ず出力してください。",
    "     <!--CTA_DATA_START-->",
    "     説明文1：[記事の内容に合わせた、不安を解消する一言]",
    "     説明文2：[教室見学や相談へのハードルを下げる優しい一言]",
    "     相談ポイント1：[記事関連の相談内容1]",
    "     相談ポイント2：[記事関連の相談内容2]",
    "     体験ポイント1：[体験で得られるメリット1]",
    "     体験ポイント2：[体験で得られるメリット2]",
    "     締めの言葉：[校舎名]室長 [室長名]より、心を込めた最後のメッセージ",
    "     <!--CTA_DATA_END-->",
    "",
    "  【禁止事項】",
    "  - 嘘や架空の実績を書かない",
    "  - 不自然な日本語やAI特有の硬い表現を避ける",
    "  - マークダウンのコードブロック（```html）で囲まない（そのままブラウザでレンダリングできる形式で）"
  ].join("\n");
  /*
    blog_instruction:
  version: "5.0-minimal-eisai"
  ...
  */

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
      // バージョン依存のストレージから読み込み（互換性のため）
      const versionedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      // 永続ストレージから教室情報を読み込み
      const classroomData = JSON.parse(localStorage.getItem(CLASSROOM_STORAGE_KEY) || '{}');

      // マージして返す（教室情報を優先）
      // 旧キー(kosha, shichou)がある場合は新キー(name, manager)にマッピングしてフォールバック
      return {
        ...versionedData,
        name: classroomData.name || classroomData.kosha || versionedData.kosha || '',
        manager: classroomData.manager || classroomData.shichou || versionedData.shichou || '',
        url: classroomData.url || versionedData.url || '',
        tel: classroomData.tel || versionedData.tel || ''
      };
    } catch {
      return { name: '', manager: '', url: '', tel: '' };
    }
  }

  function saveSetting(info) {
    try {
      // 現在のストレージデータを取得
      const currentPersistent = JSON.parse(localStorage.getItem(CLASSROOM_STORAGE_KEY) || '{}');

      // 教室情報だけを永続ストレージに保存（すべてのフィールドを網羅）
      const classroomData = {
        name: info.name !== undefined ? info.name : currentPersistent.name,
        manager: info.manager !== undefined ? info.manager : currentPersistent.manager,
        url: info.url !== undefined ? info.url : currentPersistent.url,
        tel: info.tel !== undefined ? info.tel : currentPersistent.tel
      };

      // 永続化保存
      localStorage.setItem(CLASSROOM_STORAGE_KEY, JSON.stringify(classroomData));

      // バージョン依存ストレージにも念のため保存（後方互換性）
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

  // 更新確認：CSP制限のため外部fetchは不可。直接インストールページを開く方式に変更

  // CTAデータをパースする関数
  function parseCtaData(text) {
    // まずコメントタグ形式を試す
    let match = text.match(/<!--CTA_DATA_START-->([\s\S]*?)<!--CTA_DATA_END-->/);
    let dataText = match ? match[1] : null;

    // コメントタグがない場合、キーワードで検出
    if (!dataText) {
      const patterns = [
        /説明文1[:：]\s*(.+)/,
        /説明文2[:：]\s*(.+)/,
        /相談ポイント1[:：]\s*(.+)/,
        /体験ポイント1[:：]\s*(.+)/,
        /締めの言葉[:：]\s*(.+)/
      ];

      // 少なくとも3つ以上のパターンがマッチすればCTAデータとみなす
      let matchCount = 0;
      patterns.forEach(p => { if (p.test(text)) matchCount++; });

      if (matchCount >= 3) {
        // 説明文1から締めの言葉までの範囲を抽出
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

    // 最低限のデータがあるか確認
    return Object.keys(data).length >= 3 ? data : null;
  }

  // デフォルトのCTAデータ
  const defaultCtaData = {
    // 説明文は「今の不安に寄り添う」→「相談後の安心」が伝わるトーン
    '説明文1': 'テストや勉強のお悩みを一緒に整理します。',
    '説明文2': 'お子さまに合った一歩目を一緒に見つけていきましょう。',

    // 相談ポイント：保護者が「これなら相談したい」と思える具体的フレーズ（〜25字目安）
    '相談ポイント1': '今のつまずきの原因を一緒に見つけます',
    '相談ポイント2': 'テストで点が伸びない理由をプロが分析',
    '相談ポイント3': '家庭学習の「やり方」から見直せます',
    '相談ポイント4': '志望校選びや進路の不安も相談OK',

    // 体験ポイント：保護者が「受けさせてみたい」と思える具体的フレーズ（〜25字目安）
    '体験ポイント1': '実際の授業を体験して雰囲気がわかる',
    '体験ポイント2': '先生との相性をじっくり確認できます',
    '体験ポイント3': '苦手が「わかった！」に変わる瞬間を体感',
    '体験ポイント4': '教室や自習室の環境もしっかり見学',

    // 締めの言葉：保護者の心に響く、行動を促す一文（〜50字目安）
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
  }    // =========================================================
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
  function watchBlogResponseAndEnableCopy(statusDiv, copyBtn) {
    let last = '';
    let stableCount = 0;

    const timer = setInterval(() => {
      const nodes = document.querySelectorAll('.model-response-text, .markdown-main-panel');
      if (!nodes.length) return;

      const latest = nodes[nodes.length - 1];
      const text = latest.textContent || latest.innerText || '';

      if (text === last) {
        stableCount++;
      } else {
        last = text;
        stableCount = 0;
      }

      if (stableCount >= 3 && text.length > 500) {
        clearInterval(timer);

        // ★ ブログHTMLを抽出・デコード・CTA差し替え
        try {
          let raw = '';
          const innerMarkdown = latest.querySelector('.markdown-main-panel');
          if (innerMarkdown) {
            raw = innerMarkdown.textContent || '';
          } else {
            raw = text;
          }

          // HTMLエンティティをデコード（安全な方法）
          let decoded = raw;
          // 一般的なエンティティを手動でデコード
          decoded = decoded.replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");

          // CTAデータをパース（変動部分）
          const ctaData = parseCtaData(raw);

          // CTAデータ部分を削除（コメントタグ形式）
          decoded = decoded.replace(/<!--CTA_DATA_START-->[\s\S]*?<!--CTA_DATA_END-->/gi, '');
          // CTAデータ部分を削除（コメントタグなし形式）
          decoded = decoded.replace(/説明文1[:：].+[\s\S]*?締めの言葉[:：].+/gi, '');
          // CTAプレースホルダーを削除（実際のCTA HTMLに置換するため）
          decoded = decoded.replace(/<p[^>]*style=['"][^'"]*color:\s*red[^'"]*['"][^>]*>\s*■+CTAセクション■+\s*<\/p>/gi, '');
          // 一番最後の<table>〜</table>も削除（従来のCTA想定）
          decoded = decoded.replace(/<table[^>]*>[\s\S]*<\/table>\s*$/i, '');

          // CTA URL・電話番号取得とCTA構築
          const info = getSetting();
          let ctaUrl = (info.url || '').trim();
          const ctaTel = (info.tel || '').trim();
          if (!ctaUrl) {
            console.warn('CTA URLが設定されていません');
            return;
          }
          if (!/^https?:\/\//i.test(ctaUrl)) ctaUrl = 'https://' + ctaUrl;

          // CTAデータがあれば変動、なければデフォルト
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
  let lastPromptNode = null; // 最新のプロンプト出力を保存
  let isGeneratingPrompt = false; // プロンプト生成セッション中かどうかを追跡

  function watchThumbnailPrompt(statusDiv, imgExecBtn) {
    let last = '';
    let stableCount = 0;

    const timer = setInterval(() => {
      // プロンプト生成セッションでない場合は終了
      if (!isGeneratingPrompt) {
        clearInterval(timer);
        return;
      }

      const nodes = document.querySelectorAll('.markdown-main-panel, .model-response-text');
      if (!nodes.length) return;

      const latest = nodes[nodes.length - 1];
      const txt = latest.textContent || latest.innerText || '';

      // プロンプト生成完了のマーカーをチェック
      if (txt.includes('このプロンプトで画像を生成してください')) {
        if (txt === last) {
          stableCount++;
        } else {
          last = txt;
          stableCount = 0;
        }

        if (stableCount >= 3 && txt.length > 100) {
          clearInterval(timer);
          lastPromptNode = latest; // 最新の出力ノードを保存
          isGeneratingPrompt = false; // セッションを終了
          imgExecBtn.style.display = 'block';

          // プロンプト出力完了アナウンス
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

    // サイドパネルの開閉状態を取得
    const isCollapsed = localStorage.getItem('eisai_collapsed') === 'true';

    // サイドパネル本体
    const panel = createEl('div', { id: TOOL_ID }, document.body);
    if (isCollapsed) panel.classList.add('collapsed');

    // 開閉ボタン
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

    // 更新ボタンの動作：直接インストールページを開く（CSP制限のためバージョンチェック不可）
    updateBtn.onclick = () => {
      const ok = confirm(`現在のバージョン: v${CURRENT_VERSION} \n\n最新版を確認・インストールしますか？\n（Tampermonkeyのインストール画面が開きます）`);
      if (ok) {
        window.open(UPDATE_URL, '_blank');
      }
    };

    const content = createEl('div', { style: { padding: '14px', overflow: 'auto', flex: 1 } }, panel);

    // フッターを作成
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

    // 教室設定
    const details = createEl('details', { className: 'eisai-details' }, content);
    createEl('summary', {}, details, '⚙️ 教室情報設定（1回入力すれば保存されます）');
    const dContent = createEl('div', { className: 'eisai-details-content' }, details);

    const nameIn = createInput(dContent, '校舎名（記事に反映されます）', '例：◯◯校　※校まで必ずいれる', false);
    const managerIn = createInput(dContent, '室長名（本文では名前のみ使用）', '例：●●', false);
    const urlIn = createInput(dContent, 'CTAリンク先URL（https://必須）', '例：https://eisai.org/…', false);
    const telIn = createInput(dContent, '電話番号（CTAの電話ボタン用）', '例：ハイフンなしで登録', false);

    // ★ 初期値を設定から読み込んで反映 ★
    const saved = getSetting();
    if (saved.name) nameIn.value = saved.name;
    if (saved.manager) managerIn.value = saved.manager;
    if (saved.url) urlIn.value = saved.url;
    if (saved.tel) telIn.value = saved.tel;

    const saveBtn = createEl('button', {
      style: {
        padding: '6px 10px', fontSize: '12px', cursor: 'pointer',
        background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', marginTop: '4px'
      }
    }, dContent, '教室情報を保存');
    saveBtn.onclick = () => {
      saveSetting({ name: nameIn.value, manager: managerIn.value, url: urlIn.value, tel: telIn.value });
      alert('教室情報を保存しました');
      details.open = false;
    };

    // ステップ1: 記事タイプ選択
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

    // ステップ2: 詳細入力（タイプ別フォーム）
    const step2 = createEl('div', { id: 'eisai-step2', style: { display: 'none' } }, content);

    // 選択中のタイプ表示
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

    // タイプ別フォームコンテナ
    const formContainer = createEl('div', { id: 'eisai-form-container' }, step2);

    // フォーム入力値を保持するオブジェクト
    const formInputs = {};

    // タイプ別フォーム定義
    const TYPE_FORMS = {
      [BLOG_TYPES.GROWTH]: {
        label: '📝 結果アップ・成長ストーリー',
        fields: [
          { key: 'student', label: '主役の生徒情報', placeholder: '例：中2・西中原中・Aさん・数学', isArea: false },
          { key: 'before', label: 'ビフォー（課題・前回の状況）', placeholder: '例：前回テスト45点、計算ミスが多かった', isArea: false },
          { key: 'after', label: 'アフター（成果・今回の結果）', placeholder: '例：今回78点、33点アップ！', isArea: false },
          { key: 'actions', label: '教室で行ったこと（3つ以上）', placeholder: '例：\n・計算練習を毎回10分\n・途中式を書く習慣づけ\n・テスト前に類題演習', isArea: true },
          { key: 'episode', label: '印象に残ったエピソード・室長コメント', placeholder: '例：最初は自信なさそうだったけど、点数を見た時の笑顔が忘れられません', isArea: true }
        ]
      },
      [BLOG_TYPES.EVENT]: {
        label: '📅 対策・イベント紹介',
        fields: [
          { key: 'eventName', label: 'イベント名・対象', placeholder: '例：冬期講習・中1〜中3対象', isArea: false },
          { key: 'flow', label: 'イベントの流れ・内容', placeholder: '例：\n・12/25〜1/7の14日間\n・1日2コマ×週3回\n・苦手単元を集中特訓', isArea: true },
          { key: 'benefit', label: '生徒が得られるもの', placeholder: '例：\n・冬休み明けテストで自己ベスト更新\n・苦手克服で自信がつく', isArea: true },
          { key: 'example', label: '過去の実例・雰囲気メモ（任意）', placeholder: '例：去年参加した生徒は平均20点アップ', isArea: true }
        ]
      },
      [BLOG_TYPES.PERSON]: {
        label: '👤 講師・室長・生徒紹介',
        note: '⚠️ サムネイル作成のため、紹介する人物の写真をチャットにアップロードしてください',
        fields: [
          { key: 'personInfo', label: '紹介する人の基本情報', placeholder: '例：講師・田中先生・理系科目担当・3年目', isArea: false },
          { key: 'points', label: 'その人の「らしさ」ポイント（3つ以上）', placeholder: '例：\n・説明がわかりやすい\n・生徒の話をよく聞く\n・テスト前は自習にも付き合う', isArea: true },
          { key: 'episode', label: '印象的なエピソード', placeholder: '例：苦手だった生徒が「先生の授業だけは楽しい」と言ってくれた', isArea: true },
          { key: 'message', label: '室長として伝えたい一言', placeholder: '例：生徒思いの先生です。安心してお任せください', isArea: false }
        ]
      },
      [BLOG_TYPES.SERVICE]: {
        label: '💼 サービス・相談メニュー紹介',
        fields: [
          { key: 'serviceName', label: 'サービス名', placeholder: '例：無料学習相談会・無料体験授業', isArea: false },
          { key: 'target', label: 'どんな悩みを持つ人向け？（3つ以上）', placeholder: '例：\n・勉強のやり方がわからない\n・塾選びに迷っている\n・成績が伸び悩んでいる', isArea: true },
          { key: 'flow', label: '相談・体験の流れ', placeholder: '例：\n・①お電話で予約\n・②ヒアリング30分\n・③体験授業\n・④ご報告', isArea: true },
          { key: 'goal', label: '利用後にどうなってほしいか', placeholder: '例：お子さまに合った勉強法が見つかり、前向きに取り組めるように', isArea: true }
        ]
      },
      [BLOG_TYPES.SCORE]: {
        label: '🎯 点数アップ速報',
        fields: [
          { key: 'testName', label: '対象テスト', placeholder: '例：2学期期末テスト・中1〜中3', isArea: false },
          { key: 'scoreList', label: '高得点・点数アップ一覧（1行1件）', placeholder: '例：中2 Aさん 数学 45→78点（+33点）\n中1 Bくん 英語 52→71点（+19点）\n中3 Cさん 理科 88点', isArea: true },
          { key: 'comment', label: '速報から伝えたいこと', placeholder: '例：みんな本当によく頑張りました！次も一緒に頑張ろう', isArea: true },
          { key: 'pickup', label: '代表ケース深掘りメモ（任意）', placeholder: '例：Aさんは毎日自習に来て、計算練習を続けた結果です', isArea: true }
        ]
      },
      [BLOG_TYPES.OTHER]: {
        label: '📄 その他',
        fields: [
          { key: 'theme', label: '今回のブログで伝えたいテーマ・主役', placeholder: '例：西中原中の定期テストで結果を出すには？', isArea: false },
          { key: 'actions', label: '教室や先生が行ったこと（箇条書き）', placeholder: '例：\n・テスト範囲の確認\n・苦手単元の洗い出し\n・類題演習', isArea: true },
          { key: 'episode', label: 'エピソード・メッセージ', placeholder: '例：生徒たちの頑張りを見て、私も元気をもらいました', isArea: true }
        ]
      }
    };

    // フォーム生成関数
    function renderTypeForm(type) {
      while (formContainer.firstChild) {
        formContainer.removeChild(formContainer.firstChild);
      }
      formInputs[type] = formInputs[type] || {};
      const config = TYPE_FORMS[type];
      if (!config) return;

      selectedTypeLabel.textContent = config.label;

      if (config.note) {
        const noteEl = createEl('div', {
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

      config.fields.forEach(field => {
        const input = createInput(formContainer, field.label, field.placeholder, field.isArea);
        // 以前の入力値があれば復元
        if (formInputs[type][field.key]) {
          input.value = formInputs[type][field.key];
        }
        // 入力時に値を保存
        input.addEventListener('input', () => {
          formInputs[type][field.key] = input.value;
        });
        formInputs[type][field.key + '_el'] = input;
      });
    }

    // 初期フォーム表示
    renderTypeForm(currentBlogType);

    // デフォルト値は空欄のまま（ユーザーが入力するまで）

    // タイプボタンクリック時にフォームも切り替え
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

    // ステップ切り替え
    nextBtn.onclick = function () {
      console.log('次へボタンがクリックされました');
      step1.style.display = 'none';
      step2.style.display = 'block';
    };
    backBtn.onclick = () => {
      step2.style.display = 'none';
      step1.style.display = 'block';
    };
    const statusDiv = createEl('div', { className: 'eisai-status' }, content);

    // ブログコピー用トースト
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

    // 画像セクション
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
    [
      '実写スタイル',
      'アニメスタイル',
      'インフォグラフィックスタイル',
      'YOUTUBEスタイル',
      '漫画スタイル',
      'インパクトスタイル'
    ].forEach(label => {
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
    [
      '共感',
      '驚き',
      '笑顔',
      '不安煽る',
      'ポジティブ',
      '最高'
    ].forEach(label => {
      const opt = document.createElement('option');
      opt.value = label;
      opt.textContent = label;
      appealSelect.appendChild(opt);
    });

    // カラースタイル選択
    createEl('label', { className: 'eisai-label' }, imgSection, 'メインカラーを選択');
    const mainColorSelect = createEl('select', {
      className: 'eisai-input',
      style: { width: '100%', marginBottom: '8px' }
    }, imgSection);

    // お任せオプションを追加
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
    mainColorSelect.value = 'お任せ'; // デフォルト値

    createEl('label', { className: 'eisai-label' }, imgSection, 'サブカラーを選択');
    const subColorSelect = createEl('select', {
      className: 'eisai-input',
      style: { width: '100%', marginBottom: '8px' }
    }, imgSection);

    // お任せオプションを追加
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
    subColorSelect.value = 'お任せ'; // デフォルト値

    // キャッチフレーズ入力エリア
    createEl('hr', { style: { margin: '12px 0', border: 'none', borderTop: '1px solid #e5e7eb' } }, imgSection);
    createEl('p', { style: { fontWeight: 'bold', marginBottom: '8px', color: '#374151' } }, imgSection,
      '✏️ サムネイルテキスト設定');

    // おまかせトグルボタン
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
      style: {
        marginRight: '8px',
        width: '16px',
        height: '16px',
        cursor: 'pointer'
      }
    }, toggleContainer);

    createEl('label', {
      htmlFor: 'omakase-toggle',
      style: {
        fontSize: '14px',
        fontWeight: '500',
        color: '#374151',
        cursor: 'pointer',
        userSelect: 'none'
      }
    }, toggleContainer, '🎯 おまかせモード（ブログから自動抽出）');

    // テキスト入力フィールドコンテナ
    const textInputsContainer = createEl('div', {
      id: 'text-inputs-container',
      style: { display: 'none' }
    }, imgSection);

    const mainCatchInput = createInput(
      textInputsContainer,
      'メインキャッチフレーズ（必須）',
      '例：勉強が楽しくなる！',
      true
    );

    const subCatchInput = createInput(
      textInputsContainer,
      'サブキャッチフレーズ（任意）',
      '例：個別指導で成績アップ',
      false
    );

    const pointsInput = createInput(
      textInputsContainer,
      'ポイント・特徴（任意）',
      '例：安心のサポート体制',
      false
    );

    // トグル機能
    toggleSwitch.onchange = () => {
      if (toggleSwitch.checked) {
        // おまかせモードON
        textInputsContainer.style.display = 'none';
      } else {
        // おまかせモードOFF
        textInputsContainer.style.display = 'block';
      }
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

    // ===== 画像生成用プロンプト作成 =====
    imgGenBtn.onclick = () => {
      const style = styleSelect.value;
      const appeal = appealSelect.value;
      const mainColor = mainColorSelect.value;
      const subColor = subColorSelect.value;

      // トグル状態をチェック
      const isOmakase = toggleSwitch.checked;
      const mainCatch = isOmakase ? 'おまかせ' : (mainCatchInput.value.trim() || 'おまかせ');
      const subCatch = isOmakase ? 'おまかせ' : (subCatchInput.value.trim() || 'おまかせ');
      const points = isOmakase ? 'おまかせ' : (pointsInput.value.trim() || 'おまかせ');

      // 人物紹介（講師・室長・生徒）タイプ専用のサムネイルルール
      const isPersonType = currentBlogType === BLOG_TYPES.PERSON;
      const personThumbnailRules = isPersonType ? `
■ 人物紹介サムネイル専用ルール
  - このチャットにユーザーがアップロードした先生・講師・室長の写真を必ずベースにしてください
  - アップロードされた人物写真から人物のみを丁寧に切り抜き、元の背景は一切使用しないでください
    - 背景は透過前提で、メインカラーとサブカラーを生かしたグラデーションや図形(サークル・斜めライン)を使ったおしゃれなグラフィック背景を新しくデザインしてください
      - 構図は統一します：人物は画面右側1 / 3にバストアップで配置し、左2 / 3をテキストエリアとして確保してください
        - 先生の表情は自然な笑顔で、清潔感のある服装(白衣やシャツ、ジャケットなど)にしてください
          - 顔や髪型など、人物の特徴はアップロードされた写真にできるだけ忠実に再現してください。別人の顔に変えないでください
            - 左側のテキストエリアに以下の2行構成で名前を表示してください：
1行目: 日本語のフルネーム(例: 鈴木 太郎)
2行目: 自然なローマ字表記のフルネーム(例: Taro Suzuki)
  - ローマ字表記は、日本語の名前から推測される自然な綴りで生成してください
    - 名前とキャッチコピーは人物と重ならないように配置し、読みやすさを最優先してください
      - 人物紹介タイプ以外の記事では、このルールは無視して従来どおりのレイアウトで構いません
        ` : '';

      const input = document.querySelector('div[contenteditable="true"], rich-textarea div[contenteditable="true"]');
      if (!input) {
        alert('Geminiの入力欄が見つかりませんでした');
        return;
      }

      // ユーザー入力に基づいてプロンプトを生成、または「おまかせ」の場合はGeminiに任せる
      const promptRequest = `
@NANO BANANA PRO
【画像生成リクエスト】
以下のブログ記事の内容に基づき、定義されたスタイルで最高品質のサムネイル画像を生成するためのプロンプトを作成してください。

■ ブログ記事内容
${lastBlogHtml || 'ブログ記事が生成されていません。先にブログを生成してください。'}

■ 適用するスタイルパラメータ（英語）
1. Visual Style: ${VISUAL_STYLES[style] || style}
2. Emotion / Appeal: ${APPEAL_STYLES[appeal] || appeal}
3. Brand Rules: ${mainColor === 'お任せ' || subColor === 'お任せ' ? 'Color scheme optimized for appeal style' : `${COLOR_STYLES[mainColor]?.sub} and ${COLOR_STYLES[subColor]?.main} color scheme`}, Teacher as clean university student(male / female) wearing plain white lab coat with no text, professional appearance, clean composition, --ar 3: 2
4. Text Design: Impactful text design: Bold 3D letters with drop shadows, gradient fills(${mainColor === 'お任せ' ? 'optimized gradient for appeal style' : COLOR_STYLES[mainColor]?.gradient}), thick outlines, dynamic positioning, maximum visibility, eye - catching typography, professional yet striking appearance
5. Classroom Setting: ${style === '実写スタイル' ? CLASSROOM_DESCRIPTION : 'Modern educational environment appropriate for ' + style}
6. Tutoring Style: ${TUTORING_STYLE}
7. Color Scheme: ${mainColor === 'お任せ' || subColor === 'お任せ' ? 'Colors automatically selected based on appeal style: warm colors for empathy, bright colors for smile, urgent colors for anxiety, cool colors for positive, premium colors for highest' : `Main color ${COLOR_STYLES[mainColor]?.main} (${COLOR_STYLES[mainColor]?.hex}), Sub color ${COLOR_STYLES[subColor]?.main} (${COLOR_STYLES[subColor]?.hex})`}

■ ユーザー入力情報
メインキャッチ：${mainCatch}
サブキャッチ：${subCatch}
ポイント：${points}
${personThumbnailRules}

■ キャッチフレーズ作成の原則（最高品質のテキスト生成）
【メインキャッチフレーズ】
- 文字数：10 - 15文字（超短く、インパクト重視）
- 心理トリガー：好奇心、不安煽り、期待感、緊急性
  - 表現技法：「たった〇日で」「〇人が知らない」「ついに明らかに」
- 具体例：「たった2週間で33点アップ！」「99 % の生徒が知らない勉強法」「ついに解明！伸びる子の共通点」

【サブキャッチフレーズ】
- 文字数：15 - 25文字（補足情報、具体性）
- 役割：メインの裏付け、信頼性構築、共感誘導
  - 表現技法：数字・具体性、体験談、対比構造
    - 具体例：「計算ミスが激減した理由とは」「苦手科目が得意に変わる瞬間」「他塾との違いがわかる事例」

【ポイント・特徴】
- 文字数：8 - 12文字（キーワード、短いフレーズ）
- 役割：視覚的アクセント、情報補足
  - 表現技法：キーワード集中、記号使用、短いフレーズ
    - 具体例：「・毎日10分」「・途中式必須」「・類題演習」
- 注意：教室で行ったことをそのまま書かず、効果的なキーワードに変換
  - おまかせモード：Pointsは一切生成しないでください。空白のままにしてください
    - 手動入力モード：入力されている場合は必ずサムネイルに組み込む

【訴求スタイルとの連携】
- 共感：苦悩→解決のストーリー、温かい言葉選び
  - 驚き：衝撃的な数字、予想外の事実、感嘆符活用
    - 笑顔：成功体験、ポジティブな未来、達成感
      - 不安煽る：損失回避、競争、期限効果
        - ポジティブ：成長実感、可能性拡大、自信喚起
          - 最高：圧倒的成果、No.1実績、伝説的エピソード

■ 思考と生成プロセス（Gemini 3 Thinking Mode）
1. 【学生年代の判定】ブログ内容から学生の年代を判定：「小学生」「中学生」「高校生」のいずれかに特定
2. 【翻訳と抽出】ブログ内容を、画像生成AIが理解しやすい「具体的な被写体・アクションの英語描写」に変換
3. 【教師の設定】教師を登場させる場合：さわやかで綺麗な女子大生または男子大学生、白衣着用（文字なし）、プロフェッショナルな外見
4. 【教室環境の適用】実写スタイルの場合は詳細な教室環境を適用、他スタイルは適切な教育環境に調整
5. 【指導スタイルの反映】教師と生徒が同時に登場する場合は、横並びの個別指導スタイルを適用
6. 【キャッチフレーズ最適化】「おまかせ」の場合はブログ内容から最も訴求力のあるキャッチフレーズを自動生成。入力がある場合は改善・最適化
7. 【ポイントの処理】おまかせモード：Pointsは一切生成しないでください。空白のままにしてください。手動入力モード：入力がある場合は必ず組み込む
8. 【カラースタイルの適用】お任せモード：訴求スタイルに応じて最適なカラーを自動選択（共感→暖色系、笑顔→明るい色、不安煽る→緊急性のある色、ポジティブ→寒色系、最高→高級感のある色）。手動選択：指定されたメイン・サブカラーを適用
9. 【結合】[Visual Style] + [Emotion / Appeal] + [Dynamic Brand Rules] + [Dynamic Text Design] + [Classroom Setting] + [Tutoring Style] + [Color Scheme] + [学生年代] + [教師仕様] + [最適化されたキャッチフレーズ] + [ポイント（条件付き）]を結合

■ 画像生成プロンプトの要件
  - 英才個別学院のブランドイメージに合致した、教育的で信頼感のある雰囲気
    - 生徒・保護者の興味を引く、プロフェッショナルな学習塾の雰囲気
      - 【重要】画像サイズは必ず3: 2比率で指定
        - 視認性の高いテキスト配置、読みやすさを最優先
          - 構図は画面全体を使い、不自然な空白エリアを作らないでください
            - 【重要: 画像全体を使用し、右下にロゴ用スペースや空白は不要です】
- 【最重要: 塾名「英才個別学院」や類似の文字を背景や画像内に一切表示しないでください】

■ テキストデザインの指定（最大インパクト・超目立つ配置）
- メインキャッチ：【超巨大サイズ】画面の30 - 50 % を占める超太字3D効果、オレンジから白へのグラデーション、極太の黒いアウトライン、強烈なドロップシャドウ、画面中央〜上部に大胆に配置
  - サブキャッチ：【大きめサイズ】画面の15 - 25 % を占める太字、白ベースにオレンジのアクセント、強めのシャドウ効果、メインキャッチの下または横に目立つ配置
    - ポイント：スタイリッシュなフォント、オレンジ色、配置を工夫して目立たせる、効果的な場合のみ表示
      - 全体：【YouTubeサムネイル級の超ダイナミック配置】テキストが主役、背景は引き立て役、最大の視認性
        - 重要：テキスト配置は完全に自由。メイン・サブキャッチを画面の主役として最大限目立たせる。場所の制約なし
          - テキストは斜め配置、重なり、サイズ変化など自由に使ってインパクトを最大化
            - ポイントは教室の行動をそのまま書かず、効果的なキーワードに変換。不要なら省略可
              - ラベル（「メイン」「サブ」「ポイント」など）は表示せず、フレーズのみをレンダリング
                - 【禁止】同じテキストを複数回表示しないでください。各キャッチフレーズは1回のみ表示
                  - 【禁止】テキストの二重表示、重複表示、コピー表示は絶対にしないでください

■ 出力形式
以下の形式でプロンプトを作成してください：

---
  以下のプロンプトで画像を生成してください

  [ここに詳細な画像生成プロンプト]

このプロンプトで画像を生成してください。
---

【重要】プロンプトを出力のみで、画像は生成しないでください。プロンプトの内容を確認してから後で画像生成を実行します。`;

      statusDiv.textContent = '🎯 画像生成用プロンプトを作成しています...';
      statusDiv.classList.add('show');
      imgExecBtn.style.display = 'none';

      // プロンプト生成セッションを開始
      isGeneratingPrompt = true;
      lastPromptNode = null; // 以前のプロンプトをクリア

      input.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, promptRequest);
      input.dispatchEvent(new Event('input', { bubbles: true }));

      sendMessageViaEnter(input);
      watchThumbnailPrompt(statusDiv, imgExecBtn);
    };

    // ===== 記事生成 =====
    genBtn.onclick = async () => {
      // タイプ別フォームから入力値を取得
      const typeData = formInputs[currentBlogType] || {};
      const config = TYPE_FORMS[currentBlogType];

      // 必須項目チェック（最初のフィールドは必須）
      const firstField = config.fields[0];
      const firstValue = typeData[firstField.key] || '';
      if (!firstValue.trim()) {
        alert(`「${firstField.label}」を入力してください`);
        return;
      }

      const info = getSetting();
      const kosha = (info.name || '').trim();
      const shichou = (info.manager || '').trim();
      let ctaUrl = (info.url || '').trim();
      const ctaTel = (info.tel || '').trim();

      if (!kosha) {
        alert('校舎名を設定してください\n例：◯◯校 ※校までいれてください。');
        return;
      }
      if (!shichou) {
        alert('室長名（本文に出す名前）を設定してください');
        return;
      }
      if (!ctaUrl) {
        alert('CTAリンク先URL（体験フォームやお問い合わせページのURL）を設定してください。\n例：https://eisai.org/〇〇');
        return;
      }
      if (!ctaTel) {
        alert('電話番号を設定してください\n例：00000000000 ※ハイフンなし');
        return;
      }
      if (!/^https?:\/\//i.test(ctaUrl)) ctaUrl = 'https://' + ctaUrl;

      // タイプ別の入力内容をまとめる
      const esc = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      let formContent = '';
      config.fields.forEach(field => {
        const val = typeData[field.key] || '';
        if (val.trim()) {
          formContent += `${field.label}: ${val} \n`;
        }
      });

      // タイプ別指示を生成
      const TYPE_INSTRUCTIONS = {
        [BLOG_TYPES.GROWTH]: `【記事タイプ】成長ストーリー型
【構成指示】
- 導入：生徒の課題や悩みに共感する書き出し
  - 本文：ビフォー→取り組み→アフターの流れで構成
    - 見出し例：「〇〇さんの挑戦」「教室で取り組んだこと」「結果と変化」
- 締め：同じ悩みを持つ保護者への励ましメッセージ`,
        [BLOG_TYPES.EVENT]: `【記事タイプ】イベント紹介型
【構成指示】
- 導入：イベントの目的や対象者への呼びかけ
  - 本文：内容・流れ・得られるものを具体的に紹介
    - 見出し例：「〇〇講習の特徴」「参加するとどうなる？」
- 締め：参加を検討している保護者への後押しメッセージ`,
        [BLOG_TYPES.PERSON]: `【記事タイプ】人物紹介型
【構成指示】
- 導入：紹介する人との出会いや印象
  - 本文：その人の特徴・エピソードを具体的に紹介
    - 見出し例：「〇〇先生ってこんな人」「印象に残ったエピソード」
- 締め：保護者への安心感を与えるメッセージ`,
        [BLOG_TYPES.SERVICE]: `【記事タイプ】サービス紹介型
【構成指示】
- 導入：対象となる悩みへの共感
  - 本文：サービス内容・流れ・利用後のイメージを紹介
    - 見出し例：「こんなお悩みありませんか？」「相談の流れ」「利用された方の声」
- 締め：気軽に相談できることを伝えるメッセージ`,
        [BLOG_TYPES.SCORE]: `【記事タイプ】点数アップ速報型
【構成指示】
- 導入：テスト結果への喜びと生徒への称賛
  - 本文：点数アップ一覧を見やすく紹介し、代表ケースを深掘り
    - 【重要】入力された「高得点・点数アップ一覧」は、省略せずに ** 全て ** リスト形式で記載すること。「他多数」などで省略してはならない。
- 見出し例：「今回のテスト結果速報！」「特に頑張った生徒たち」
- 締め：次のテストに向けた意気込みと保護者へのメッセージ`,
        [BLOG_TYPES.OTHER]: `【記事タイプ】自由テーマ型
【構成指示】
- 導入：テーマに合わせた書き出し
  - 本文：伝えたい内容を自然な流れで構成
    - 締め：保護者への前向きなメッセージ`
      };

      const typeInstruction = TYPE_INSTRUCTIONS[currentBlogType] || TYPE_INSTRUCTIONS[BLOG_TYPES.OTHER];

      let yaml = MASTER_YAML;
      // タイプ別情報を追加
      yaml = yaml.replace('input_required:', `article_type: "${currentBlogType}"\n\n${typeInstruction} \n\n【入力された情報】\n${formContent} \ninput_required: `);
      yaml = yaml.replace(/__THEME__/g, esc(config.label.replace(/^[^\s]+\s/, '')));
      yaml = yaml.replace(/__MEMO__/g, esc(formContent));
      yaml = yaml.replace(/__KOSHA__/g, esc(kosha));
      yaml = yaml.replace(/__SHICHOU__/g, esc(shichou));
      yaml = yaml.replace(/__CTA_URL__/g, esc(ctaUrl));
      yaml = yaml.replace(/__CTA_TEL__/g, esc(ctaTel));

      const input = document.querySelector('div[contenteditable="true"], rich-textarea div[contenteditable="true"]');
      if (!input) {
        alert('Geminiの入力欄が見つかりませんでした');
        return;
      }

      statusDiv.textContent = '📨 ブログ生成用YAMLを送信しました。生成が完了したら、下にコピー用ボタンが出ます。';
      statusDiv.classList.add('show');
      copyBtn.style.display = 'none';
      imgSection.style.display = 'none';
      imgExecBtn.style.display = 'none';
      lastBlogHtml = '';

      input.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, yaml);
      input.dispatchEvent(new Event('input', { bubbles: true }));

      await sleep(500);
      sendMessageViaEnter(input);

      watchBlogResponseAndEnableCopy(statusDiv, copyBtn);
    };

    // ===== ブログコピー → HTMLデコード → CTA差し替え → 下スクロール =====
    copyBtn.onclick = async () => {
      // 直前に保存しておいた生HTML（エンティティ decode 済み＆CTA 差し替え済み）
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

      // --- ここからトースト表示（★ innerHTML を使わない） ---
      const toast = document.getElementById('eisai-copy-toast');
      if (toast) {
        toast.style.display = 'block';
        toast.textContent =
          '✅ ブログHTMLをコピーしました。\n' +
          'このまま WordPress などに貼り付けてご利用ください。';

        // 2秒後に自動で非表示
        setTimeout(() => {
          toast.style.display = 'none';
        }, 2000);
      }

      // --- 画像生成セクションを表示してスクロール ---
      imgSection.style.display = 'block';
      setTimeout(() => {
        const thumbSection = document.getElementById('eisai-image-section');
        if (thumbSection) {
          thumbSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);

      // ここで「▶ 画像生成用プロンプトをGeminiに送る」ボタンを有効化しているなら、
      // その表示切り替えもここでまとめてやると安全です。
      const sendImgPromptBtn = document.getElementById('eisai-gen-btn');
      if (sendImgPromptBtn) {
        sendImgPromptBtn.disabled = false;
        sendImgPromptBtn.style.opacity = '1';
      }
    };

    // ===== サムネイル画像生成用プロンプト送信 =====
    imgExecBtn.onclick = async () => {
      const nodes = document.querySelectorAll('.markdown-main-panel, .model-response-text');
      if (!nodes.length && !lastPromptNode) {
        alert('Geminiの出力が見つかりませんでした。サムネイル指示の生成が完了してからもう一度試してください。');
        return;
      }

      // 保存された最新のプロンプト出力を使用（なければ最新の出力を使用）
      const latest = lastPromptNode || nodes[nodes.length - 1];
      const prompt = latest.innerText || latest.textContent || '';

      // プロンプトをコピーしておく
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


  }

  // =========================================================
  // 9. 新しいチャットページ判定 & 左端丸ボタン
  // =========================================================
  function isNewChatPage() {
    const url = location.href;
    return url === "https://gemini.google.com/app" || url.startsWith("https://gemini.google.com/app?");
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
      if (!panel) buildPanel();
      else panel.style.display =
        (panel.style.display === 'none' || panel.style.display === '') ? 'flex' : 'none';
    };
  }

  setInterval(ensureButton, 1000);
})();