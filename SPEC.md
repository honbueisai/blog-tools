# 英才ブログ生成ツール - 技術仕様書

## 概要

英才個別学院のブログ記事を自動生成するTampermonkeyユーザースクリプト。Google Gemini（https://gemini.google.com/*）で動作し、教室情報の管理、ブログ記事の生成、サムネイル画像のプロンプト作成を行う。

## システム要件

- **ブラウザ**: Chrome, Firefox, Edge, Safari などTampermonkeyをサポートするブラウザ
- **拡張機能**: Tampermonkey
- **対象サイト**: https://gemini.google.com/*
- **ストレージ**: TampermonkeyのGM_setValue/GM_getValue（永続ストレージ）

## アーキテクチャ

### 主要コンポーネント

1. **設定管理モジュール**
   - バージョン管理ストレージ（STORAGE_KEY）
   - 教室情報永続ストレージ（CLASSROOM_STORAGE_KEY）
   - 設定の保存・復元機能

2. **UI生成モジュール**
   - パネルインターフェースの動的生成
   - フォーム要素の作成とイベント管理
   - トグルスイッチ、ボタン、セレクトボックス等

3. **ブログ生成モジュール**
   - 記事タイプ別のプロンプト生成
   - テンプレート管理
   - HTMLコンテンツの生成

4. **画像生成モジュール**
   - NANO BANANA PRO対応のプロンプト作成
   - 人物紹介タイプ専用のサムネイル生成
   - カラースタイルとビジュアルスタイルの適用

### データ構造

#### 設定データ構造
```javascript
{
  // バージョン管理データ
  version: "0.60.00",
  classroomName: "",
  managerName: "",
  classroomUrl: "",
  classroomTel: "",
  
  // 教室情報（永続）
  name: "",
  manager: "",
  url: "",
  tel: ""
}
```

#### 記事タイプ定義
```javascript
const BLOG_TYPES = {
  BASIC: 'basic',           // 基本ブログ
  CAMPAIGN: 'campaign',     // キャンペーン
  EVENT: 'event',          // イベント
  COLUMN: 'column',        // コラム
  INTERVIEW: 'interview',  // インタビュー
  PERSON: 'person'         // 人物紹介
};
```

## 主要機能

### 1. 教室情報管理
- **入力項目**: 教室名、責任者名、URL、電話番号
- **永続化**: CLASSROOM_STORAGE_KEYに保存
- **自動復元**: パネル初期化時に自動復元
- **バリデーション**: URL形式のチェック

### 2. ブログ記事生成

#### 基本ブログ
- 生徒の成功事例
- 学習効果の具体的な記述
- 保護者向けの安心感演出

#### キャンペーンブログ
- 期間限定の特典
- お問い合わせ数の目標設定
- 緊急性の演出

#### イベントブログ
- イベントの詳細情報
- 参加対象と募集人数
- 開催場所と時間

#### コラムブログ
- 専門的な教育内容
- 保護者向けのアドバイス
- 具体的な学習方法

#### インタビューブログ
- 卒業生の成功事例
- 大学合格の経験談
- 具体的な成長過程

#### 人物紹介ブログ
- 講師の経歴と専門性
- 指導方針と特徴
- 生徒からの信頼性

### 3. サムネイル生成

#### 人物紹介タイプの特殊処理
- **ベース画像**: アップロードされた先生の写真
- **背景**: 透過背景＋おしゃれなグラフィック背景
- **レイアウト**: 右1/3に先生（バストアップ）、左2/3にテキストエリア
- **名前表示**: 日本語フルネーム＋ローマ字フルネーム（2行）

#### カラースタイル
- メインカラーとサブカラーの選択
- お任せモード（訴求スタイルに応じて自動選択）
- グラデーション効果の適用

#### ビジュアルスタイル
- 実写スタイル
- アニメスタイル
- イラストスタイル
- 3Dスタイル

## ChatGPT拡張機能（blog-generator-chatgpt.user.js）

Gemini版とは別ファイルの、`chatgpt.com` / `chat.openai.com` で動作するTampermonkeyユーザースクリプト（`@grant none`）。単一ファイル・localStorageのまま。バージョンは `0.4.0`（設計書 `reference/chatgpt-extension-v0.4-design.md` 参照）。

### 入力項目
- **記事の型**：`solve`（悩み解決型）／`story`（ストーリー型：事例・イベント・体験）の2択（旧5タイプは廃止）
- **記事入力**：誰に（学年・対象校・時期）、悩み3つ（セリフ）、家庭でできること3つ、教室の事実（箇条書き）、事例・当日の様子（任意）、つなげたい行動、締切・特典、文字数、関連記事×3（タイトル｜URL）、写真。入力ごとに `eisai_chatgpt_article_draft_v040` へ自動保存
- **教室設定**（`eisai_classroom_settings_persistent` に永続化。旧キーとの互換あり）：校舎名、室長名、地域・駅名、近隣の対象校、申込URL、電話、LINE URL、住所、アクセス、受付時間

### 出力語彙（AI応答からエディタへ渡すHTML）
本文で使用するclass／属性：
- `eisai-empathy-box`（よく聞くお悩み）／`eisai-toc`（目次）／`eisai-point-list`（家庭でできること）／`ol.eisai-steps`（手順）
- `eisai-cta` に `data-kind="mid"`（中間CTA）／`data-kind="final"`（本CTA）。`a.cta-btn`・`a.cta-sub`
- `eisai-summary`（まとめ）／`eisai-related`（関連記事）／`eisai-school-info`（教室情報）
- `p[data-photo-placeholder="true"]`（写真プレースホルダー）／`eisai-highlight`／`bubble-right`・`bubble-left`／`eisai-manager-note`

応答末尾のマーカー（この順）：
1. `<!--CTA_DATA_START-->` 〜 `<!--CTA_DATA_END-->`（旧語彙。`eisai-cta` が無い出力向けの後方互換用）
2. `<!--EISAI_TITLES: ["1案目","2案目","3案目"]-->`（タイトル3案。エディタへコピーするHTMLにも残す）
3. `<!--EISAI_CHECK: {"title":"○",...,"chars":2000,"notes":[...]}-->`（自己チェック。結果パネル表示専用でコピーHTMLからは除去）

`eisai-cta` がある新語彙の出力では `buildCtaHtml` は使わず、`a.cta-btn`/`a.cta-sub` のhrefを教室設定の値へ差し替える（AIが書いたURL・電話・LINEは信用しない）。`eisai-cta` が無い旧語彙の出力は従来どおり `buildCtaHtml` を使う。

### 完了判定：合言葉（依頼番号）方式（v0.4.1.0）
ChatGPTの「画面の作り」（`data-message-author-role`・`data-testid`・停止ボタン等）には一切依存しない。仕組みは次のとおり：

1. **依頼番号の発行**：送信ごとに`makeRequestId()`が短いランダムID（小文字英数字6文字）を発行する。
2. **目印の指示**：`buildMarkerInstructionBlock(id)`が、プロンプトの末尾に「回答の最初の行に開始目印`[[EISAI-START-<ID>]]`、最後の行に終了目印`[[EISAI-END-<ID>]]`を書く」よう指示する文を追加する（記事用プロンプト`buildBlogPromptV3`・サムネ用メタプロンプトの両方）。指示文自体は目印を完成した形で書かない（部品ごとに引用符で区切って説明し、送信文の中に完成形が1字も連続して現れないようにする）。依頼番号は`buildRequestIdLine(id)`で「（依頼番号：ID）」の形でも1回書く（送信確認・失敗文言のスコープ判定用）。
3. **読み取り**：`collectMainTextIndex()`が、`main`（無ければ`body`）内の全テキストノード（自パネル・入力欄を除く）をTreeWalkerで出現順に連結し、1本の文字列＋ノード対応表を作る。`getMarkerState(id)`がこの文字列の中で開始目印の最後の出現・終了目印のその後の最初の出現を探す。目印がテキストノード・要素をまたいで分割されていても見つかる。範囲はDOM Rangeで切り出し、`<p>`/`<li>`の境目と`<br>`にだけ改行を入れて文字列化する（`extractIndexRangeAsBlockText`／`serializeBlockText`。ChatGPTが1行=1つの`<p>`（writing block）で表示する場合の改行復元用。それ以外の要素（`<div>`・`<span>`等）は境目とみなさない＝改行を追加しない。任意の位置で`<div>`等に分割されても、元の文字列中の改行はテキストノードの連結だけでそのまま保たれる。`<h1>`のような裸のタグ文字列を、無関係な要素境界で誤って分断しないための設計）。
4. **完了判定**：終了目印が見つかり、切り出した本文が1秒間隔のポーリングで2回連続（＝2秒）変わらなければ完成。終了目印が無く開始目印だけなら「生成中（n文字）」、どちらも無ければ「考え中（n秒）」と表示する（`startMarkerWatch`。記事監視`watchBlogResponseAndEnableCopy`・サムネ指示監視`watchThumbnailPrompt`の共通エンジン）。
5. **送信確認**：送信後8秒以内に「入力欄以外の画面に依頼番号が現れた」「会話URLが`/c/…`に変わった」「入力欄が空になった」のいずれかを確認できなければ1回だけ再送し、それでも確認できなければ失敗表示＋「📋 プロンプトをコピー」を促す（`confirmSendSucceeded`）。送信〜確認〜（必要なら）再送の一連は`sendAndConfirm(text, requestId, statusDiv, opts)`に統一されており、記事・サムネ指示・画像生成の3か所すべてがこれを使う（v0.4.1.6。以前はサムネ指示・画像生成にはこの確認・再送が無く、送信できていなくても完成監視だけが永久に待つ不具合があった）。詳細は下記「送信の統一」参照。
6. **画像の完成**：画像そのものは目印を出力できないため、送信前に`main`内の`img`一覧（自パネル外）を記録し、その集合に無い`naturalWidth>500`の新しいimgを完成の候補とみなす（`collectMainImages`／`watchGeneratedImage`）。ChatGPTは大きい画像を「プレビュー」表示のまま十数秒出し続けた後にDOMごと本番表示へ差し替えるため（2026-09-28実機確認）、(1)その画像の近く（祖先を数段さかのぼった入れ物の中）に「プレビュー」/「Preview」の表示がある間は完成にせず待つ（`isNearImagePreviewLabel`）、(2)プレビュー表示が無い状態で大きい画像の組（src一覧）が5秒（`IMAGE_STABLE_MS`）続けて変わらなければ完成とみなす、の2段判定にしている（プレビューが一度も出ないケースも5秒安定で完成）。失敗文言は、今回の依頼の「依頼番号：ID」より後のテキストに限って判定する（`textAfterRequestId`）。
7. **最後の逃げ道**：失敗・タイムアウト時は、ChatGPTのコピーボタンでコピーした回答を貼り付けて読み込める欄（パネル常設・`eisai-paste-fallback`）を開く。目印が無くても、記事は閉じた見出し`<h1>…</h1>`から（`extractArticleFallbackFromMainText`／`trimToArticleBounds`）、サムネ指示は`[[EISAI_IMG_PROMPT]]`から読み取れる。
8. 見えている時間（タブが裏の間はカウントしない）で8分でタイムアウトし、理由をパネルに表示する（コンソールのみのサイレント失敗をなくす）。

タブが裏の間はカウントを進めず、`document.hidden`をポーリングごとに確認する。

### 要確認（`findUnverifiedClaims`）
生成された本文（タグ・コメント除去後）を、入力（記事入力＋教室設定）と機械的に照合し、以下を検出してパネルに一覧表示する（各項目は前後15字付き。0件なら「要確認なし」）：
1. 「」内の文言で入力に含まれないもの
2. 曜日表記（`（月）`〜`（日）`・`〜曜日`）で入力に無いもの
3. 数字＋単位（名・人・点・回・問・％・分・時間・日・か月・年・位・倍・円）で入力に無いもの

比較は全角/半角・空白の違いを無視する正規化（`normalizeForMatch`：NFKC＋空白除去）で行う。純粋関数のため `tests/mock-chatgpt.html` を使わずNode（`module.exports`経由）からも呼べる。

### サムネイル画像の文字設計と場面描写（v0.4.1.3）

2026-09-28に実機で確認：サムネがメイン＋サブ2行だけで要素が少なく「さみしい」、教室・人物の服装や向きが指定されておらず場面が安定しない、という不具合を修正した。

**文字設計（作り込み型・広告バナー風・複数レイヤー）**：本部の実例（西浦和校のブログ一覧）に寄せ、文字を役割ごとに4〜6層重ねる設計に変更（サムネ生成プロンプトの「■ 文字設計（作り込み型・広告バナー風・複数レイヤー）」節）：
- ラベル（左上・角丸の色バッジ、任意）：2〜10字
- メイン（特大・主役、必須）：全角8〜12字
- サブ帯（色の帯の上に白文字、サブ1・サブ2として最大2個）：各6〜14字
- 補足（小さめの1〜2行、任意）：〜14字
- タグ（下部・チップ状、1〜3個、任意）：各〜12字
- 小物（成績表・グラフ・矢印・表彰の掲示など、任意。記事にある数字の範囲だけ）

ChatGPTは応答の末尾に `[[EISAI_IMG_TEXT]] ラベル：…／メイン：…／サブ1：…／サブ2：…／補足：…／タグ：…,…` の形式で、画像に描き込む文字を1行で出力する（ラベル・サブ1・サブ2・補足・タグは使った時だけ。旧形式＝メイン／サブ1／サブ2のみの行も後方互換で読める）。`extractImgTextMeta(raw)` がこの行を解析し `{label, main, sub1, sub2, note, tags}` を返す（タグは`,`または`、`区切りで配列化）。`buildForcedImageTextInstruction(meta, fallbackTitle)` が、各要素の置き場所（左上の角丸ラベル／特大のメイン文字／色帯の上のサブ文字／小さめの補足／下部のタグ）を明記した「必ず描き込む」強制指示文を組み立て、画像生成の送信文の先頭に付ける。

**教室と場面の描写**：`CLASSROOM_DESCRIPTION`（教室設定）・`TUTORING_STYLE`（授業の場面）は定義だけされサムネ生成プロンプトに一度も埋め込まれておらず、「写真が無い時は下記の描写を使う」という案内が空振りしていた不具合も修正した。`buildSceneDescriptionSection()` が「■ 教室と場面の描写（写真が無いとき必ず使う）」節を組み立て、サムネ生成プロンプトに実際に埋め込む：
- 授業の場面（`tutoringSceneStyleText`）：先生と生徒が横並びで個別指導。先生は必ず白衣（white lab coat）。生徒は制服または私服
- 面談の場面（`meetingSceneStyleText`。新設）：机をはさんで向かい合って面談。室長はダークスーツ＋ネクタイ、保護者・生徒は私服
- 記事の内容から場面を判断する基準も明記：授業・点数アップ・自習・対策会の内容→授業の場面、面談・相談・進路・保護者向けの内容→面談の場面

画像生成の送信文（`imgExecBtn`クリック時。`buildImageGenerateMessage(requestId, forcedTextInstruction, imgPrompt)`）には、サムネ生成プロンプト作成時と場面判断がずれても人物の服装・向きだけは必ず守られるよう、「人物がいる場合：授業場面は先生と生徒が横並び、先生は白衣。面談場面は向かい合わせ、室長はスーツ。」という短い場面ルールを毎回付ける。

いずれも純粋関数のため `tests/thumbnail-text-and-scene.test.mjs` でNode（`module.exports`経由）から確認できる。

### 送信の統一：`sendAndConfirm`（v0.4.1.6）

2026-09-29に実機で確認：記事は裏のまま送信〜完成まで成功したが、次のサムネ指示で止まった。原因は`setComposerAndSend`→すぐ`watchThumbnailPrompt`という作りで、送信確認・再送が記事にしか無かったこと。送信できていなくても完成監視だけが（裏の時間はタイムアウトに数えないため）永久に待ってしまう。画像生成の送信も同じ作りだった。

`sendAndConfirm(text, requestId, statusDiv, opts)`に、入力欄へ入れる→送信→`confirmSendSucceeded`→（裏でも安全な時だけ）再送→失敗表示、までを1つにまとめ、記事（`genBtn`）・サムネ指示（`imgGenBtn`）・画像生成（`imgExecBtn`）の3か所すべてで使う（画像生成の送信文にも依頼番号の行があるため、同じ判定が使える）。`opts.sendingHintText`／`opts.retryText`で、どの送信かが分かる文言を呼び出し側から渡す。

**完成監視は送信確認より先に、並行して始める**：3か所とも、依頼番号を発行した直後（送信の成否にかかわらず）に完成監視（`watchBlogResponseAndEnableCopy`／`watchThumbnailPrompt`／`watchGeneratedImage`）を先に始めてから`sendAndConfirm`を呼ぶ。理由：ChromeのIntensive Throttling等で`sendAndConfirm`側の待ちが長く伸びても、あるいは人が手で送信した場合でも、完成監視は既に動いているため拾える。`sendAndConfirm`が最終的に失敗した場合も、監視自体は止めない（`setGenerateBusy(false)`等は監視側の8分タイムアウト・完成コールバックに任せる）。3か所とも、送信〜完成検知の間の想定外の例外をtry/catchで囲み、パネルに「何ができなかったか・次にすること」を出す。

### 送信ボタンの探し方・待ち方：MutationObserver優先（v0.4.1.5・v0.4.1.6）

`CHATGPT_ADAPTER.send`は、送信ボタンを`findSendButtonNear`（入力欄の入れ物＝`closest('form')`の中を優先、無ければ画面全体）で探す。2026-09-29に実機で確認：タブが裏にあるとChatGPT側の描画が遅れ、送信直後の一瞬にはまだ送信ボタンが無く、Enterキー送信に落ちてしまう画面があった（Enterでは送れない）。加えて、タブが裏にある状態が長引くと、ChromeのIntensive Throttlingにより、setTimeoutの連鎖（sleepを繰り返す待ち方）が数十分に間引かれることがあった。

`waitForDomCondition(checkFn, timeoutMs, pollMs, extendDeadlineWhileHidden)`という汎用ヘルパーで、DOM変化（MutationObserver）を優先して待つように変更した：checkFnがtruthyを返すまで、(1)DOM変化があった時は毎回すぐ再チェックし、(2)保険としてpollMsごとの再チェックも行う。timeoutMsで必ず終わる（extendDeadlineWhileHiddenがtrueなら、裏で過ごした分だけ期限を後ろにずらす）。`send`（送信ボタンを最大5秒探す）・`confirmSendSucceeded`（入力欄が空になった等を最大8秒待つ）の両方がこれを使う。DOM変化は（setTimeoutの間引きの影響を受けにくい）MutationObserverのコールバックで即座に検知できるため、sleepの繰り返しよりも間引きに強い。

裏にある間の再送（送信を確認できなかった時）も、以前は`waitUntilTabVisible()`で表に戻るまで永久に待っていたが、`canSafelyRetrySendWhileHidden(requestId)`の条件判定に変更した：入力欄に今回のプロンプト（依頼番号「依頼番号：<ID>」を含む）がまだそのまま残っていて、かつその依頼番号が入力欄の外（会話・ChatGPTの応答）にまだ一切見えていない場合だけ「まだ確実に送れていない」と確定できるので、入力欄への打ち直しはせず送信ボタンをもう一度押すだけの再試行を、裏でもそのまま行う（入力欄の内容を変えないため二重送信にならない）。条件を満たさない時は、打ち直し・再送はせず確認だけをやり直す。

### サムネ指示の軽量化：`buildThumbnailArticleSummary`／`buildThumbnailPromptRequest`（v0.4.1.6）

2026-09-29に実機で確認：サムネ生成プロンプト（`promptRequest`）に記事HTMLを丸ごと入れていたため、依頼文が17,133字になることがあった。裏にある状態で入力欄に入れた直後、ページがCDP／表示のどちらにも数分反応しなくなり、その後も送信されていなかった。

`buildThumbnailArticleSummary(blogHtml, maxChars)`（既定`maxChars=2500`）が、記事HTMLをタグを除いた本文テキストに軽量化する：見出し（`h1`〜`h4`）は行頭に「■」、段落（`p`／`li`）は改行区切り。HTMLコメント（旧`CTA_DATA`・`EISAI_TITLES`等のマーカーもすべてHTMLコメントの形のため、まとめて除去できる）は除く。字数超過時は、見出し（構成が分かるように必ず残す）→数字を含む文（点数・人数など記事の事実の中心）→残りの本文（元の順）の優先順で入るところまで残す。確定ファクト（メモ）はそのまま全部使う。

`buildThumbnailPromptRequest(opts)`が、サムネ生成プロンプト全体の組み立てを`imgGenBtn.onclick`から純粋関数として切り出したもの（`buildBlogPromptV3`と同じ考え方）。色・型・レイアウト候補などの選択肢一覧（`colorStyles`・`thumbnailTypeOptions`・`visualExpressionOptions`・`textImpactOptions`・`artDirections`・`layoutVariants`）は呼び出し側が実際の定数（`COLOR_STYLES`等）を渡す。

**実測（`tests/thumbnail-text-and-scene.test.mjs`。実際の記事fixtureで計測）**：記事本文（`buildThumbnailArticleSummary`の出力）は2,500字以内に収まる。依頼文全体は、記事の長さに比例して伸びる問題は解消したが、記事に依存しない固定の指示文＋選択肢一覧だけで既に約9,800字あり、実際の記事fixtureでは依頼文全体が約15,000字になる（実機で確認した17,133字は明確に下回るが、目安として挙げられていた「8,000字以下」には、固定の指示文自体を削らない限り届かない）。固定の指示文の圧縮は今回の対応範囲外（サムネ生成の質に関わるため）とし、TROUBLESHOOTING.mdに既知の制限として記録した。

### 入力欄への書き込み：貼り付け方式と7,500字の上限（v0.4.1.7）
- 本物のChatGPTで計測した結果：入力欄（ProseMirror）への`execCommand('insertText')`は文字数の2乗に近い割合で重い（3,000字で約1秒・15,000字で約17秒、その間ページ全体が固まる）。貼り付け（`paste`イベント）は8,000字でも約0.04秒。ChatGPTは10,000字以上の貼り付けを「貼り付けたテキスト.txt」の添付に変える。
- `CHATGPT_ADAPTER.setComposerText`は、全選択→削除→`paste`イベント（`DataTransfer`に`text/plain`）で書き込む。貼り付けが処理されなかった（`defaultPrevented`にならない）画面だけ`insertText`に戻す。
- `setComposerAndSend`は、書き込み後に「本文に入った」か「添付になった」かを`waitForDomCondition`で待つ。添付になった場合は、依頼番号入りの短い案内文（`buildAttachmentCoverMessage`）を本文に入れ、送信ボタンが押せるようになるまで最大30秒待って送る。送信失敗時は自分が付けた添付だけを外す。
- 依頼文はすべて7,500字以内に収める（サムネ指示：実際の記事・メモで約4,800字、長めのメモで約5,700字。`tests/thumbnail-text-and-scene.test.mjs`で確認）。サムネ指示は、創作の禁止・4〜6層の文字設計・場面と服装（授業＝横並び・白衣／面談＝向かい合い・スーツ）・紙の向き・出力形式を残したまま短く書き直した。記事の要約は最大1,800字。
- `waitForDomCondition`：保険タイマーは常に1本、DOM変化での確認は最短150msに1回。裏にある間の期限の延長は実時間で数える。

### テスト
`tests/mock-chatgpt.html`（+ `tests/fixtures/*.txt`）で、chatgpt.comのDOMを模した静的ページ上で自動送信・完了検知・失敗時のプロンプトコピー導線を確認する。モックは送信文から依頼番号を読み取り、fixture本文を目印（`[[EISAI-START-<ID>]]`〜`[[EISAI-END-<ID>]]`）で包んで返す。`layout`パラメータ（`writing-block`/`markdown`/`stale`/`v2dom`＋`echo=1`/`random`＋`seed=`）でDOM構造を変え、読み取りがDOM構造に依存しないことを確認できる。

`tests/run-matrix.mjs`（Node組み込みWebSocketでChrome DevTools Protocolを直接操作するヘッドレスChromeテスト）が、{記事生成→HTMLコピー→サムネ指示生成→画像生成}の一連の流れを、`layout`×{表のまま／裏→表}×{`heavy`なし／`heavy=1`}の全組み合わせ＋以下の専用ケースで自動実行し、合否・所要時間・ロングタスク（50ms超）件数を表で出力する。画像生成ステップでは、送信直後の大きい画像（プレビュー段階）ではまだ完成と表示されないこと、`mock-chatgpt.html`がプレビュー→本番差し替えを再現した後に完成と表示されることも確認する。使い方は `tests/README.md` 参照。
- 「貼り付けて読み込む」（目印あり／目印なし・素の全文／目印なし・コードブロックの3ケース）
- 「ずっと裏のまま」（記事→サムネ指示→画像・`renderHidden`）
- 「composer誤認防止」（`composerNoId=1`。`#prompt-textarea`が無い画面で書き物キャンバスを入力欄と誤認しないこと）
- 「ずっと裏のまま・送信ボタン遅延」（`lateSendBtn=1`。記事→サムネ指示→画像の3か所すべてで送信ボタンが遅れて出ても完成まで進むこと）
- 「ずっと裏のまま・throttle近似＋送信ボタン遅延」（`throttle=1`＋`lateSendBtn=1`。ChromeのIntensive Throttlingの近似下でも記事生成が完成すること。本物のIntensive Throttlingの完全な再現ではない点に注意。詳細はTROUBLESHOOTING.md参照）

純粋関数のNode単体テスト（`node tests/<name>.test.mjs`で個別実行可能）：
- `tests/unverified.test.mjs`：`findUnverifiedClaims`（要確認）
- `tests/thumbnail-text-and-scene.test.mjs`：`extractImgTextMeta`／`buildForcedImageTextInstruction`／`buildSceneDescriptionSection`／`buildImageGenerateMessage`（サムネの文字設計・教室と場面の描写）／`buildThumbnailArticleSummary`／`buildThumbnailPromptRequest`（サムネ指示の軽量化・依頼文全体の字数計測）

## エディター（editor-icons.html）

拡張機能（Gemini / ChatGPT）が生成したブログ記事HTMLを、装飾・整形してブログ管理画面に貼り付けるための単体HTMLツール。拡張機能とは別ファイルで、ブラウザで直接開いて使う。

### 主要動線
1. 「拡張機能（Gemini / ChatGPT）からコピーしたHTML」欄に貼り付け
2. 「🎨 テーマ選択」でテーマを選び「テーマを適用」
3. 必要に応じてアイコンツールバーで装飾・編集
4. 表題バーの「タイトル」→「本文」の順にクリックしてブログ管理画面へそれぞれ貼り付け

### 出力パイプライン
本文コピー・サイドバーのHTML出力・サンプルチェックの3箇所は、必ず単一関数 `buildBlogHtml()` を経由し、常に同じ出力になる：
1. `stripExtensionInjectedNodes` — ブラウザ拡張（LanguageTool / Grammarly等）の注入要素を除去
2. `convertThemeClassesToInlineStyles` — テーマclassをインラインスタイルに変換（ブログ貼付用）
3. `formatHtmlForBlog` — ブロック要素間の改行整形など、ブログ用の最終整形

### データ保護
- 未保存ガード（`guardUnsaved`）：履歴を開く・新規作成・テーマ再適用の前に、未保存の変更があれば確認ダイアログを表示
- 離脱警告（`beforeunload`）：未保存の変更がある状態でタブを閉じる／リロードしようとすると警告
- 履歴上書き防止：テーマ適用時に `Drafts.clearCurrentId()` を呼び、既存履歴を意図せず上書きしない
- 破損データの退避：履歴の保存データ（JSON）が壊れて読み込めない場合、生データを別キーへ退避してから空リストとして起動する

### 履歴の保存先（localStorage）
- `eisai_editor_drafts_v2`（`DRAFTS_KEY`）：履歴（下書き）本体。最大50件、`_dedupe`でID重複を排除して保存
- `eisai_editor_drafts_v2_broken_<タイムスタンプ>`：読み込みに失敗した破損データの退避先
- 「現在編集中のID」はインメモリ変数（`_currentDraftId`）のみで保持し、localStorageには保存しない（リロードでリセットされる）

### バージョン
- 0.11.0

## 保存データ

### ストレージキー
- `STORAGE_KEY`: `eisai_blog_info_v06000`（バージョン依存）
- `CLASSROOM_STORAGE_KEY`: `eisai_classroom_settings_persistent`（永続）

### 保存される情報
- 教室名、責任者名、URL、電話番号
- 最後に使用した設定値
- バージョン情報

## バージョン管理

### バージョン形式
- セマンティックバージョニング: `0.60.00`
- 主要コンポーネントの同期:
  - `@version`
  - `TOOL_ID`
  - `BTN_ID`
  - `STORAGE_KEY`
  - `CURRENT_VERSION`

### 更新ルール
1. **コード変更時**: 必ずバージョンをインクリメント
2. **Gitコミット**: バージョン更新と同時に実行
3. **GitHubプッシュ**: コミット後に必ず実行
4. **Tampermonkey同期**: ローカル版もバージョン合わせ

## セキュリティ

### データ保護
- Tampermonkeyスコープ内でのみデータ保存
- 外部APIへの送信なし
- ユーザーデータのローカル保持

### 入力検証
- URL形式のバリデーション
- 必須項目のチェック
- XSS対策のエスケープ処理

## 互換性

### ブラウザ対応
- Chrome 88+
- Firefox 85+
- Edge 88+
- Safari 14+

### Tampermonkeyバージョン
- 4.11以上を推奨
- GM_setValue/GM_getValue API必須

## パフォーマンス

### 最適化
- 遅延読み込み
- イベント委譲
- メモリリーク防止

### 制限事項
- GeminiのAPI制限に依存
- 大量データの一括処理は非推奨

## 拡張性

### 追加機能の実装方法
1. BLOG_TYPES定数に新しいタイプを追加
2. generatePrompt()にケースを追加
3. テンプレートを定義
4. UIに選択肢を追加

### カスタマイズポイント
- カラースキームの追加
- 新しい記事タイプの定義
- プロンプトテンプレートの修正

## トラブルシューティング

### 既知の問題
1. 教室情報の保存失敗 → CLASSROOM_STORAGE_KEYの確認
2. サムネイル生成の不具合 → 人物紹介タイプの条件分岐を確認
3. バージョン不一致 → 全コンポーネントのバージョンを同期

### デバッグ方法
- コンソールログの確認
- ストレージデータの検証
- Gemini APIの応答確認
