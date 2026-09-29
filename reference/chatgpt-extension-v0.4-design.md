# ChatGPT拡張機能 v0.4.0 設計（2026-09-23）

対象：`blog-generator-chatgpt.user.js`（v0.3.4 → v0.4.0）。Gemini版 `blog-generator.user.js` は変更しない。
根拠：
- 現行レビュー `reference/chatgpt-extension-review-v0.3.4.md`（メイン作業ツリーにある。パスは下記）
- お手本10記事とのギャップ分析 `reference/blog-generator-v1-gap-analysis.md`（同上）
- プロンプトv3（お手本2本で逆再現テスト済み）：`reference/blog-studio-prototype-v3.html` の `buildPrompt()`、変更点 `reference/blog-prompt-v3-changes.md`（同上）

メイン作業ツリー：`/Users/yuanob/Documents/EISAI_KOBETSU.localized/MIRAIMO/EISAI/BLOG`（上の参照ファイルはここの `reference/` にある。読むだけ。書き込みはこの worktree だけ）

## 方針
- 単一ファイル・`@grant none`・localStorage のまま。構成は大きく変えない（差分を追いやすく）。
- 出力語彙はエディタ v0.13 の「生成語彙コントラクト」に合わせる（`eisai-cta` data-kind mid/final、`eisai-toc`、`eisai-summary`、`eisai-related`、`eisai-school-info`、`ol.eisai-steps`、`p[data-photo-placeholder]` など）。末尾は `CTA_DATA_START/END`・`EISAI_TITLES`・`EISAI_CHECK`。
- 旧語彙しか無い出力（`eisai-cta` が無い）では従来の CTA 組み立て（`buildCtaHtml`）をそのまま使う（後方互換）。

## 1. 入力（ペルソナ → 事実）
- 記事の型は2択：悩み解決型（solve）／ストーリー型（story：事例・イベント・体験）。旧5タイプの入力画面は廃止。
- 記事の入力：誰に（学年・対象校・時期）、悩み3つ（セリフ）、家庭でできること3つ、教室の事実（箇条書き）、事例・当日の様子（任意。書いたことだけが記事に出る旨をラベルに）、つなげたい行動、締切・特典、文字数、関連記事×3（タイトル｜URL）、写真。
- 教室設定（端末に保存・既存の `eisai_classroom_settings_persistent` を拡張）：校舎名、室長名（フルネーム可）、地域・駅名、近隣の対象校、申込URL、電話、LINE URL、住所、アクセス、受付時間。既存キーは互換維持。
- 記事の入力も自動保存（入力のたび）。「入力をクリア」ボタン。
- 必須未入力は送信前に具体的に表示（どの欄か）。

## 2. プロンプト
- プロトタイプ v3 の `buildPrompt()` を移植（文言は変えない）。値の取り出しだけ拡張機能のフォーム／設定に合わせる。
- 「プロンプトをコピー」ボタン（自動送信が壊れた時の逃げ道。コピー後「ChatGPTの入力欄に貼って送信してください」と表示）。

## 3. 送信と完了検知（v0.3.5 の保険を同梱）
- 生成中は生成系ボタンを無効化し、状態表示（送信中／生成中 n文字／完了／失敗＋理由）をパネルに常時出す。
- 送信成功の確認：送信後8秒以内に「新しいユーザー発言が増えた」または「入力欄が空になった」または「停止ボタンが出た」を確認。無ければ1回だけ再送。それでも駄目なら失敗表示＋「プロンプトをコピー」を促す。
- 完了判定：テキストが一定時間変化しない＋生成中でない＋`<h1` を含み、かつ `EISAI_CHECK` または `CTA_DATA_END` を含む。タイムアウト時は画面に理由を出す。
- 途中の例外はコンソールだけでなくパネルに出す（サイレント失敗をなくす）。
- セレクタ：既存の候補を維持し、`#composer-submit-button`（現行 chatgpt.com の送信ボタンID、2026-09-23確認）を送信候補に追加。

## 4. 生成後の処理
- コードフェンス除去、`&lt;h1` 等のエスケープ解除（既存処理を流用）。
- `eisai-cta` がある場合：`buildCtaHtml` は使わない。`a.cta-btn` の href を教室設定の申込URLに、`a.cta-sub` は tel:／LINE を設定値で差し替え（AIが書いたURLを信用しない）。電話・LINE が設定に無いのにAIが書いた cta-sub は外す。本CTAに電話／LINEが設定にあるのに無ければ足す。
- コピーするHTML：本文＋`<!--EISAI_TITLES: [...]-->`。`CTA_DATA` と `EISAI_CHECK` はコピーに含めない（パネルに表示するため）。

## 5. 結果パネル
- タイトル3案（文字数つき・クリックでコピー、33字超は警告）。
- 自己チェック（EISAI_CHECK の ○△×）と、拡張機能側の実測：本文字数（タグ・コメント・空白除く）、h2 数、CTA数と中間CTAの位置％、写真枠数、感嘆符・絵文字の数。
- **要確認（入力に無いかもしれない箇所）**：本文を機械的に照合して一覧表示。
  - 「」内の文言で、入力（悩み・事実・事例・家庭でできること・教室情報）に含まれないもの
  - 曜日表記（（月）〜（日）、〜曜日）で入力に無いもの
  - 数字＋単位（名・人・点・回・問・％・分・時間・日・か月・年・位・倍・円）で、入力に無いもの
  - 各項目は本文の前後15字を添えて表示。0件なら「要確認なし」。
- ボタン：HTMLをコピー（エディタへ）／エディタを開く（https://tools.eisai.org/blogs/editor-icons.html）／プロンプトをコピー／サムネ生成（既存フロー、1案目タイトルを使う）。

## 6. バージョン・文書
- `@version` と `CURRENT_VERSION` を 0.4.0。CHANGELOG に `[Userscript(ChatGPT) 0.4.0]`、README（使い方）、SPEC（ChatGPT拡張の入力・出力・完了判定）、TROUBLESHOOTING（送信失敗時はプロンプトをコピー）を更新。

## 7. テスト用の模擬ページ
- `tests/mock-chatgpt.html`：chatgpt.com の必要最小限のDOM（`div#prompt-textarea[contenteditable]`、`button#composer-submit-button[data-testid=send-button]`、`[data-message-author-role="user"]` と `[data-message-author-role="assistant"] .markdown`、生成中の `button[data-testid=stop-button]`）を再現し、`<script src="../blog-generator-chatgpt.user.js">` で拡張機能を読み込む。
- 送信すると `tests/fixtures/<name>.txt`（ChatGPT の実出力を保存したもの）を数秒かけて少しずつ表示し、終わると停止ボタンを消す。URLパラメータ：`fixture=<name>`、`fail=send`（送信ボタンが反応しない＝再送とエラー表示の確認）、`speed=<ms>`。
- 本番URLへの外部通信はしない。
