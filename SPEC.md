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

Gemini版とは別ファイルの、`chatgpt.com` / `chat.openai.com` で動作するTampermonkeyユーザースクリプト（`@grant none`）。単一ファイル・localStorageのまま。バージョンは `0.4.1`（設計書 `reference/chatgpt-extension-v0.4-design.md` 参照）。

### 入力項目
- **記事の型**：`ba`（ビフォー・アフター型：生徒の変化・成果。v0.4.1〜の標準）／`story`（ストーリー型：事例・イベント・体験）／`solve`（悩み解決型：情報提供。自分で選んだ時だけ）／`auto`（おまかせ：かんたんモードのみ。変化・成果ならba、イベント報告ならstory）。ビフォー・アフター型は、導入で結果（前→後）を先に見せ、本論の見出し3つを「以前の状態→教室でやったこと→変化・結果」の順で書き、点数の変化は表、本人の言葉は吹き出し、最後に「ご家庭でできること」をまとめる。タイトル1案目には必ず前→後の変化を入れる。v0.4.0以前の下書き（型の印`typeScheme`が無いもの）は、読み込み時にbaへ切り替える。しっかりモードで型が`auto`の時もbaに直す
- **サムネイルの主役と構図（v0.4.4）**：サムネ指示で、記事ごとに主役を1人（生徒／白衣の先生／スーツの室長／人物なし）に決めさせ、主役と画面上の位置を最終プロンプトに書かせる。人物は片側に寄せ、文字は反対側にまとめ、顔に文字・帯・バッジを重ねない（画像生成の送信文にも毎回付ける）。教室設定の近隣対象校は依頼文に渡さない
- **エディタを開く・テストモード（v0.4.3）**：「エディタを開く（新しいタブ）」は`target="_blank"`のリンクで、必ず新しいタブで開く。テストモードはURLに`eisai_test=1`がある時だけ有効（パネルに切替ボタンは無い）。それ以外の読み込み時は毎回オフに戻す
- **結果パネル（v0.4.2）**：「タイトルを選ぶ」は表示しない（3案は`EISAI_TITLES`としてHTMLに残し、エディタで選ぶ）。結果は「① チェック」「② 要確認」「③ サムネイル画像を作る」の順。記事ができた時点でサムネイル欄を表示し、結果の一番上に「🖼 次へ：サムネイル画像を作る」ボタン（押すとサムネイル欄へ移動）を出す。記事の最後の教室情報に対象校の行は出さない。手順（`<ol class="eisai-steps">`）には`data-title`（中身が分かる12字以内のタイトル）を付けさせ、エディタ0.13.2以降は「Step ＋そのタイトル」で表示する
- **最後の申込枠（v0.4.1で復活）**：記事の一番最後に、必ず「まずはお気軽にご相談ください」の保護CTA（`data-cta-protected`。無料学習相談でできること4つ・無料体験授業でできること4つ・申込ボタン・電話ボタン）を付ける。文章（説明文1・2、相談ポイント1〜4、体験ポイント1〜4、締めの言葉）はChatGPTが記事に合わせて`CTA_DATA`に書き、拡張機能が組み立てる（無い項目は既定の文で補う）。AIが本文に書いた最後のCTA（`eisai-cta` `data-kind="final"`）は重なるので取り除き、中間CTA（`data-kind="mid"`）はリンクを教室設定に差し替えて残す。電話番号が未設定なら電話ボタンは出さない
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

### ファイル構成（v0.13.0: 新旧2エディタ）
- `editor-icons.html`（新エディタ・推奨）：12テーマ・新パーツに対応。履歴は`eisai_editor_drafts_v3`に保存する
- `editor-icons-legacy.html`（旧バージョン・Ver.0.11.0で固定）：v0.12.0以前と同じ操作感（旧10テーマ・MOCAパーツのみ）を維持するための保存版。`main`ブランチの最終コミット時点の`editor-icons.html`を元に、①先頭コメント／`<title>`を「旧バージョン」表記へ変更、②`<body>`直下に新エディタへの案内バナー（固定リンク付き）を追加した以外はコード・挙動を一切変更していない。履歴は従来通り`eisai_editor_drafts_v2`に保存する（新エディタとは独立したキー）
- 新エディタは起動時に一度だけ、`eisai_editor_drafts_v3`が空（未使用）で`eisai_editor_drafts_v2`にデータが1件以上ある場合、v2の内容をv3へコピーする（`migrateDraftsFromLegacyIfNeeded()`。一方向コピーでv2は削除しない）。以後は両エディタが完全に独立して履歴を保存し、新エディタ側での保存・削除はv2に影響しない（旧バージョン側の履歴はそのまま残る）
- 相互リンク：新エディタの上部バーに「旧バージョン」リンク（`target="_blank"`で`editor-icons-legacy.html`を開く）、旧バージョンの案内バナーに新エディタ（`editor-icons.html`）へのリンクを常設する（いずれも同一フォルダ内の相対リンク）

### デプロイ
- 本番は`tools.eisai.org/blogs/`配下にApacheで配信（現状FTP/SFTP等で手動アップロード。GitHub Pages連携なし）。`editor-icons.html`と`editor-icons-legacy.html`の**両方**を同じディレクトリへ配置すること（相対リンクで相互参照しているため、片方のみを配置すると相手へのリンクが404になる）

### 画面構成（v0.12.0 アプリシェル）
- `#topbar`（上部バー）：ブランド表示・保存状態チップ・「プレビュー」「タイトル」「本文」コピー・左パネル/履歴パネルの表示切替を集約
- `#sidebar`（左パネル）：拡張機能からコピーしたHTMLの貼り付け欄と「テーマを適用」。上部バーのボタンで表示/非表示を切替可能
- `#playground`（ワークスペース）：テーマ選択・パーツ・書式ツールバー（`fixedHeader`、常時表示）＋表題行・候補チップ＋記事本文
  - `.eisai-editor-container` のみが独立スクロールする領域で、ツールバー・表題行はスクロールしても常に画面上部に固定表示される
- `#panel-right`（右パネル）：履歴（件数バッジ付き）と開発用サンプル。上部バーのボタンで表示/非表示を切替可能
- `#preview-modal`（プレビューモーダル）：本文コピー前に記事全体をモーダルで確認できる（Escまたは「閉じる」で閉じる）

### 表示状態の保存（localStorage）
- `eisai_ui_left_open`：左パネル（`#sidebar`）の表示/非表示（`'1'`/`'0'`）
- `eisai_ui_history_open`：右パネル（`#panel-right`）の表示/非表示（`'1'`/`'0'`）

### 主要動線
1. 「原稿を貼り付け」欄に拡張機能（Gemini / ChatGPT）からコピーしたHTMLを貼り付け
2. 「テーマ」でテーマを選び「テーマを適用」
3. 必要に応じてアイコンツールバーで装飾・編集
4. 上部バーの「プレビュー」で記事全体を確認
5. 上部バーの「タイトル」→「本文」の順にクリックしてブログ管理画面へそれぞれ貼り付け

### 出力パイプライン
本文コピー・サイドバーのHTML出力・サンプルチェックの3箇所は、必ず単一関数 `buildBlogHtml()` を経由し、常に同じ出力になる：
1. `stripExtensionInjectedNodes` — ブラウザ拡張（LanguageTool / Grammarly等）の注入要素を除去。あわせてテーマv3のエディタ専用マーカー属性（`data-part`/`data-role`/`data-index`/`data-step`/`data-theme`/`data-color-*`/`data-catalog-no`/`data-side`）もここで除去する（`data-cta-protected`/`data-photo-placeholder`は保持）。`data-side`は吹き出しの左右判定用（v0.13.0）。v0.13.0：パーツ間の「スペーサー」段落（`p[data-spacer="1"]`、中身が空のもの）は段落ごと除去し、文字が入って本物の段落になったものは`data-spacer`属性だけを外す。パーツ選択マーカー`data-selected`も除去する
2. `convertThemeClassesToInlineStyles` — **旧テーマ（v0.12.0以前のクラスベース下書き）専用**の変換。`.theme-heading`等のクラスをインラインスタイルへ変換する。新テーマ（v3）のパーツは最初からインラインのみなのでここでは何もしない
3. `formatHtmlForBlog` — ブロック要素間の改行整形など、ブログ用の最終整形

### テーマ / パーツ（v0.13.0: トークン方式・12テーマ）
- `window.THEME_TOKENS_V3`：12テーマの色トークン一覧（`reference/color-compare-v3-assets/themes.json` と同一）。各テーマは `id` / `number`（01〜12） / `name` / `note` / `tokens` を持つ。トークンキー：`hero`（薄色背景）/ `soft`（サブ背景）/ `accent`（見出し・アクセント色）/ `cta` / `onCta` / `hover` / `decor`（装飾線）/ `ink`（本文色）/ `muted`（補助テキスト）/ `paper` / `line`（区切り線）/ `ctaBorder`
- `buildThemeFromTokens(t)`：1テーマのトークンから `window.PRESET_THEMES[t.id]` の形（`name` / `color` / `subColor` / `lightColor` / `description` / `tokens` / `html` / `inlineStyles`）を組み立てる。`html`と`inlineStyles`は同一オブジェクト（すべてインラインスタイルのため区別が不要）
- パーツキー（`theme.html.<key>`）：`hero`（H1相当の大見出し）/ `heading`（H2相当・01,02…連番）/ `subheading`（H3〜H6相当）/ `box`（枠）/ `list`（リスト。行はdivベースで01,02…連番。アクセント欄のラベルは`{{label}}`で可変・既定`Practice`）/ `bubbleLeft` / `bubbleRight`（吹き出し）/ `button`（CTAリンク。`<a>`タグ、旧版の`<button onclick>`は廃止）/ `consult`（申込枠）/ `empathy`（ポイント/保護者の方へ）/ `note`（室長より・引用）/ `highlight`（マーカー行）/ `table`（結果テーブル／通常テーブルの2パターン。後述）/ `placeholder`（写真プレースホルダー）/ `toc`（目次・v0.13.0生成語彙対応）/ `summary`（まとめ・同）/ `related`（関連記事・同）/ `schoolinfo`（教室情報・同）/ `cta`（中間・本CTA・同。`{{kind}}`=`mid`|`final`で見た目を切替）
- 各パーツのルート要素には `data-part="<key>"` を、色付けされた内側要素には `data-role="bg|accent|text|line"` を付与する（いずれもエディタ内部専用マーカーで、`buildBlogHtml()`の出力からは除去される）
- `bubbleLeft`/`bubbleRight`（v0.13.0: 尾つきバブルへ再構築）：`<table>`ではなく`display:flex`の行として実装する（CMS制約により擬似要素／`position:absolute`／`transform`／負マージンは使えないため）。左＝アバター列→尾→本文バブル、右＝本文バブル→尾→アバター列（`justify-content:flex-end`でミラー）。尾は`data-role="tail"`のボーダー三角`<span>`（`border-top/bottom:9px solid transparent`＋進行方向の辺だけ`12px solid`色付き）。ルートには左右判定用に`data-side="left"|"right"`を付与する（`buildBlogHtml()`の出力からは他のマーカー同様除去される）。本文バブルの`<div>`だけが`data-role="bg text"`（背景・文字の2ロールを兼ねる）を持ち、線ロールは持たない。デフォルトの名前・イニシャル（先頭に`<strong>NAME：</strong>`が無い場合）は左＝先生(先)・右＝生徒(生)
- 連番：見出し（`data-index="true"`）は `renumberHeadings(rootEl)`、リスト行（`data-step="true"`）は `renumberListRows(listRoot)` で01,02,…に振り直す。テーマ適用直後・見出しやリストをツールバーから挿入した直後に呼ばれる
- CMS制約（クラスCSS禁止／`<style>`禁止／擬似要素禁止／`:hover`禁止／JS禁止）に合わせ、パーツのルート要素には `box-sizing:border-box;max-width:100%;word-break:break-word;overflow-wrap:break-word` を付与する
- `window.LEGACY_THEME_MAP`：v0.12.0以前の10テーマキー→新12テーマキーの対応表（例：`business-blue`→`calm-blue`、`impact-red`→`magenta-pop`）。`getTheme(key)`ヘルパーが `PRESET_THEMES[key] || PRESET_THEMES[LEGACY_THEME_MAP[key]] || PRESET_THEMES['girly-pink']` の順で解決し、古い下書きのテーマキーでも例外を出さない
- `data-cta-protected` ブロックはテキスト・`href`を一切変更せず、背景色（角丸`14px`）とCTAボタンの配色だけを選択中テーマのトークンで塗り直す（`restyleCtaProtectedNode`。ボタンは`.cta-btn`と同じ`buildMainButtonStyle`の丸型ピルへ統一し、`data-role="bg"`を付与、`margin:8px 4px 0`で複数ボタンが並んでも詰まらないようにする）

### 生成語彙コントラクト（v0.13.0: 拡張機能→エディタの新パーツ変換）
新しい記事生成ツール（拡張機能／ChatGPT版）が出力する追加クラス・タグを、テーマ適用（`applyThemeToGeminiHtml`/`walkNode`）が対応するパーツへ自動変換するためのインターフェース。**これは生成ツールが従うべき契約であり、クラス名・属性名・構造を変更する場合は本セクションと生成ツール側の両方を同時に更新すること。** 見出しの番号剥がし（後述）はこの変換（`walkNode`）の中だけで行い、ツールバーからの手動パーツ挿入には適用しない。

1. **目次**：`<div class="eisai-toc"><strong>目次</strong><ol><li>…</li></ol></div>` → `toc`パーツ。ラベルチップ（`Contents`のイタリックGeorgia＋`<strong>`のテキスト、既定「目次」）のあと、行`<div><span data-step>01</span><span>項目</span></div>`を`<li>`ごとに生成する（`buildTocHtml`/`buildThemeTocRowHtml`）。`<li>`内の`<a>`はCMS側でリンクが不安定なため**テキストだけに展開して除去**する（`stripAnchorsKeepText`）。行は`renumberListRows`で連番を振り直す
2. **中間／本CTA**：`<div class="eisai-cta" data-kind="mid|final"><p>文言</p><a class="cta-btn" href="URL">ボタン</a>[<a class="cta-sub" href="tel:…">電話</a>][<a class="cta-sub" href>LINE</a>]</div>` → `cta`パーツ（申込枠と同系統の見た目を再利用）。ラッパーは`data-part="cta" data-cta-kind="mid|final" data-role="bg"`、背景は`soft`固定・角丸`14px`、`padding`/`margin`は`mid: 22px 20px / 28px 0`・`final: 32px 24px / 44px 0 0`、リード文（`<p>`→`data-role="text"`）は`mid: 15px 700`・`final: serif 20px 600`。`.cta-btn`は塗りの丸型ピルボタン（`buildMainButtonStyle`：`background:cta;color:onCta;border-radius:999px;box-shadow`付き・`min-width:240px`・`border:0`、`data-role="bg"`を付与）で、文末が矢印記号で終わっていなければ`→`を付ける（`appendCtaArrowIfNeeded`。既に→等で終わっていれば付けない）。`.cta-sub`は`buildSubButtonStyle`（`background:paper;color:accent;border:2px solid accent`の丸型ピル、`margin:8px 4px 0`）。**内側の`.cta-btn`/`.cta-sub`には`data-part`を付けない**（`normalizeParts`の`unnestPartRoots`が「他パーツに入れ子になったパーツ根」を外へ追い出す仕組みのため、`data-part`を持たせるとCTA本体から自動的に追い出されてしまう）。テキスト・`href`は一切変更しない。CTAパーツは`data-cta-protected`ではない（生成ツールから実リンク付きで来るため）。拡張機能側の`[data-cta-protected]`ブロックの扱いは変更しない
3. **まとめ**：`<div class="eisai-summary"><strong>まとめ</strong><ul><li>…</li></ul></div>` → `summary`パーツ。`list`パーツと同じ見た目（背景`hero`・padding/margin共通）だが、ラベルチップは`Summary`のイタリック＋`<strong>`のテキスト（既定「まとめ」）、行の先頭マークは連番の代わりに固定の`✓`（`buildThemeSummaryRowHtml`。連番を持たないため`renumberListRows`の対象外）
4. **STEP**：`<ol class="eisai-steps"><li>…</li></ol>` → 既存の`list`パーツを再利用（タイトル固定「STEP」・アクセント欄ラベルは`{{label}}`＝「Step」、行は`renumberListRows`で連番）
5. **関連記事**：`<div class="eisai-related"><strong>あわせて読みたい</strong><a href="URL">タイトル</a>…</div>` → `related`パーツ。ラッパーは`border:1px solid line;border-radius:6px`（`data-role="line"`）、ラベルは11pxの控えめな文字（`<strong>`のテキスト、既定「あわせて読みたい」）。各`<a>`は行として`justify-content:space-between`で末尾に`→`（`data-role="accent"`のspan）を置き、2行目以降に`border-top:1px solid line`を付ける（1行目は`border-top:0`）。`href`はすべて維持する
6. **教室情報**：`<div class="eisai-school-info">…</div>` → `schoolinfo`パーツ。`border-top:1px solid line;color:muted;font-size:13px;line-height:1.8`。内部の`<br>`/`<p>`はそのまま維持する
7. **見出しの番号剥がし**：`<h2>`/`<h3>`（および`<h4>`〜`<h6>`）のテキストが`①`〜`⑳`／`STEP n`／`(n)`／`n.`／`n）`のいずれかで始まる場合、テーマ側が振る01,02,…の連番と二重にならないよう、`walkNode`が先頭の番号表記を`stripHeadingNumberPrefix()`で1回だけ剥がしてからテンプレートへ渡す（正規表現は`HEADING_NUMBER_PREFIX_RE`）。手動でのパーツ挿入（`insertPresetElement`）には適用しない
8. **表の自動判定**：`<table>`は内容から「点数系（結果表）」か「通常表」かを`isScoreLikeTableEl()`が判定する。最終列の**データセル**（`<th>`は対象外）が1つでも存在し、かつ全てが`/^\s*[\d０-９.,]+\s*(点|%|位|人)?\s*$/`に一致すれば点数系（従来の結果表スタイル＝最終列右寄せ＋Georgia数字フォント、最終行×最終列は`accent`色）。それ以外は通常表スタイル（`th`/`td`とも左揃え・serifなし。`th`は既定で`background:hero;color:muted;12px`だが、先頭列の`th`＝行見出しは`background:transparent;color:ink;font-weight:700;width:auto`で強調する）。どちらの場合も`data-part="table"`・`data-role`によるパーツの色連携は維持する
9. **保護者の方へ（リスト対応）**：`.eisai-empathy-box`は本文が`<p>`の代わりに`<ul>`/`<ol>`になっている場合がある。この場合はリストへ直接インラインスタイル（`padding-left:1.2em;margin:0;serif;16px;line-height:1.9`、`li{margin:4px 0}`）を当てて本文と揃った見た目にする（`buildStrongTitledPartHtml`）。ラベルチップの扱いは変わらない
10. **ポイント（保護者の方へ以外）**：`.eisai-point-list`のタイトルは`<strong>`のテキストをそのまま使う（既に対応済み）。`<strong>`が無い・空の場合のみ既定の「ポイント」にフォールバックする。「ポイント」を強制しない

### パーツの色（v0.13.0 P2: 個別色上書き）
カーソル位置の `[data-part]` パーツだけ、背景／アクセント／文字／線を個別の色に上書きできる機能。ツールバー（書式グループ）の「パーツの色」ボタン（水滴アイコン）から開くポップオーバーで操作する。
- 対象要素の探索：`getCaretPartEl(editor)` がキャレットから最も内側の `[data-part]` 祖先を1つ返す（例：申込枠の中のボタンならボタン側が対象になる）。見つからない場合はポップオーバーに「色を変えるパーツの中にカーソルを置いてください」と表示し、それ以外の操作は出さない
- ターゲット（背景／アクセント／文字／線）は `data-role` の値と対応する。`data-role` は要素ごとに1つ以上の値をスペース区切りで持てる（例：`data-role="text line"`）。存在判定・要素収集は単語一致の属性セレクタ `[data-role~="bg|accent|text|line"]` で行う（`getPartRoleElements(partEl, role)`）。パーツ内にそのロールの要素が無いターゲットはセグメントコントロールに出さない（例：ボタンは「背景」のみ、吹き出しは「アクセント／文字／線」のみ）
- `line`ロールを持つ要素（v0.13.0 P2で追加）：リスト行（`border-top`、先頭行は幅0のまま付与）／ポイント（保護者の方へ）のルート（`border-left`）／ヒーロー見出しのルート（`border-bottom`）／テーブルのth・td（`border-bottom`。thとtdの本文セルは`text line`の2ロール）／（v0.13.0生成語彙対応）目次・まとめの行、関連記事のラッパーと各行の`<a>`、教室情報のルート（`border-top`。目次の行は視覚的な線を持たないが、Enterキーでの行検出`closestListRowEl`をlistと共通化するため同じ`line`ロールを流用している＝borderが元々無いのでborderColorだけ変えても見た目には影響しない）。v0.13.0で吹き出しを尾つきバブルへ再構築した際、本文セルの`border-bottom`（区切り線）は廃止したため**吹き出しは`line`ロールを持たない**（対象は背景／アクセント／文字の3種のみ）
- 色の適用は必ず `applyPartColor(partEl, role, color)` を経由する：`bg`→対象要素の`background`（マーカー行はグラデーション表現`linear-gradient(transparent 62%, color 62%)`を再構築）／`accent`→文字があれば`color`（円形装飾＝`border-radius:50%`の要素は`borderColor`も同色に）、文字が無い装飾バーは`background`／`text`→`color`／`line`→`borderColor`。適用後、対象パーツのルート要素に `data-color-bg` / `data-color-accent` / `data-color-text` / `data-color-line`（変更したロールのみ）を記録する。これらは`data-part`/`data-role`と同様、出力パイプラインの`stripExtensionInjectedNodes`で除去される。**吹き出しの`bg`は例外的にもう1箇所連動する**：本文バブルの`data-role~="bg"`要素に加え、尾（`data-role="tail"`。`bg`セレクタには含まれない）の`border-right-color`（左向き）／`border-left-color`（右向き、`data-side="right"`で判定）を`applyPartColor`内で同じ色に同期させる
- スワッチ構成：(a)「このテーマの色」＝選択中テーマの9トークン（hero/soft/decor/accent/cta/ink/muted/paper/line）、(b)「他のテーマから」＝12テーマ×2トークン（accent・soft）＝24色、(c)「自由に選ぶ」＝`<input type="color">`、(d)「テーマの色に戻す」
- 「テーマの色に戻す」は `defaultRoleColor(partKey, role, tokens, partEl)` が返す既定トークン値を`applyPartColor`で再適用し、対応する`data-color-*`属性を削除する（`partEl`は吹き出しの左右判定にのみ使う。呼び出し側は`partColorTargetEl`を渡す）。既定値の対応：`bg`→box/list/hero/toc/summary=`hero`、consult/highlight/cta=`soft`、button=`cta`、bubble=`data-side`が`right`なら`soft`・それ以外（`left`）は`hero`／`accent`→note・bubble=`decor`（引用符・丸アイコンの枠線を優先）、それ以外=`accent`／`text`→schoolinfo=`muted`、それ以外=`ink`／`line`→empathy・hero=`decor`、それ以外=`line`（吹き出しは`line`ロールを持たないため該当しない）
- 元に戻す（v0.13.0）：chipクリック（`partColorPick`）・「テーマの色に戻す」（`resetBtn`）はいずれも適用後に`EditorHistory.commit()`を呼ぶ。同じ対象（同じパーツ要素・同じロール）への1秒以内の連続クリックは`coalesceKey`（`EditorHistory.keyForElement(partColorTargetEl, partColorActiveRole)`）により1手にまとめる。旧v0.13.0 P2の「ポップオーバー限定で⌘Z/Ctrl+Zを横取りし`editor.innerHTML`を丸ごと復元する」独自実装（`partColorEnsureCheckpoint`/`partColorRevert`）は、下記の`EditorHistory`への統合により削除した
- `catalog`パーツ（下記）にも同じ仕組みがそのまま使える。`PART_COLOR_LABELS.catalog = 'カタログ パーツ'` がポップオーバー見出しに表示される。`data-role`はテーマ選択・色置換用に固定で振られているのではなく、挿入時に`scanCatalogPartRoles()`がインライン色から推定して付与する（後述）

### カスタムモード「ニュー」セット（v0.13.0: 承認済み47パーツカタログ）
カスタムモードをONにすると、装飾カテゴリの並びを「セット：ニュー（47）｜クラシック（MOCA）」で切り替えられる。既定は「ニュー」で、選択は`localStorage`の`eisai_custom_set`（`'new'`/`'classic'`）に保存される。「クラシック」は従来の`MOCA_TEMPLATES`ベースのカテゴリ（見出し／枠・BOX／吹き出し／ボタン／リスト＋挿入）をそのまま表示する。

- **データ**：`window.PARTS_CATALOG_V2`（`reference/parts-catalog-v2.html` の `#parts-json` を verbatim でコピーした配列）。各要素は `{ no, group, name, usage, risk, html, unit?, variable? }`。`group`は`window.CATALOG_GROUPS`の9キー（`A`見出し／`B`ボックス／`C`リスト・ステップ／`D`会話／`E`カード・リンク／`F`訴求・CTA／`G`その他／`H`教育コンテンツ／`I`校舎・キャンペーン）のいずれか
- **UI**：`renderCustomModeDropdowns()`が`customSet`に応じて`categoryContainer`の内容を丸ごと差し替える。「ニュー」側は`CATALOG_GROUPS`の順に9個のグループドロップダウン（`createCatalogGroupDropdown`）を生成し、各項目は`NN 名前`表示＋`variable`なら「行数可変」バッジ＋`usage`/`risk`をtitleツールチップに表示する。項目にマウスオーバーすると、現在のテーマ色・サンプルテキストで組み立てた縮小プレビュー（幅320px相当、`pointer-events:none`、`clampPopupToViewport`で画面内に収める）をポップオーバー表示する。クリックで`insertCatalogPart(editor, no)`を呼び、MOCAと同じ`insertBlockAtCursor`→`EditorHistory.commit()`の経路で挿入する
- **プレースホルダー置換**：テーマトークン（`substituteCatalogThemeTokens`。`T = getTheme(currentTheme).tokens`）は`{{color}}`→`T.accent`、`{{light}}`→`T.hero`、`{{dark}}`→`T.ink`、`{{accent}}`→`T.cta`を置換する（`{{text}}`/`{{title}}`のフォールバック処理も同関数内に残っているが、下記のフィールドトークン置換が先に走るため通常は素通りする。ホバー時のサンプルプレビューだけは今もこの関数のフォールバック値＝サンプルテキストをそのまま使う）
- **CTA文字色の自動補正**（`fixCatalogCtaTextColor`）：置換後、`style="…"`内で`background`/`background-color`が`T.cta`と一致する箇所に限り、`color:#fff`/`#ffffff`/`white`を`T.onCta`へ差し替える（`{{accent}}`＝`T.cta`は明るい配色のテーマもあるため）。`{{color}}`＝`T.accent`側は12テーマすべてaccentが濃色のため白文字のまま維持する
- **フィールドトークン（`{{title}}`/`{{text}}`/`{{url}}`/`{{img}}`/`{{tel}}`）の入力（v0.13.0）**：`openCatalogInsertDialog(part, selectedText)`が1つのダイアログにまとめて入力を受け取る（`insertCatalogPart`は`window.prompt`を呼ばない）。旧実装は`{{url}}`/`{{img}}`/`{{tel}}`ごとに`prompt()`を1回呼び、`substituteCatalogTokenAll`（`split/join`）でテンプレート内の**全出現**へ同じ値を一括置換していたため、1パーツ内に同じトークンが複数回出る場合（例：18 関連記事3件セットの`{{url}}`×3・`{{img}}`×3、23 ボタン3種の`{{url}}`×3、43 良い例／悪い例2カラム比較の各カラム内`{{text}}`×4）は全カード・全ボタン・全行が同じ値になっていた。入力は**プレースホルダーの出現1つにつき1つの入力欄**という単位で行う（同じユニット・同じトークンが複数回出ても、出現ごとに別々の値を持てる）：
  1. **ユニット検出**（`findCatalogFieldUnits`）：`findCatalogRepeatSpan`が見つけた繰り返し兄弟グループのうち、2つ以上の要素が`outerHTML`ベースで`{{title}}`/`{{text}}`/`{{url}}`/`{{img}}`/`{{tel}}`のいずれかを含む場合だけを「ユニット」として採用する（`catalogElHasFieldPlaceholder`は`outerHTML`で判定するため、`href="{{url}}"`のように表示テキストではなく属性側にしかプレースホルダーが無い要素＝ボタン等も正しく拾う）。`variable`パーツは、先にダイアログの「件数」ステッパーで確定した件数を`applyCatalogRowCount`へ渡し、そのあとの構造に対してユニット検出を行う。`variable`でないパーツも、テンプレートに実在する繰り返し（例：18の3枚のカード、23の3種のボタン）をそのまま検出する
  2. **出現の割り当て**（`walkCatalogFieldOccurrences`／共有の走査ロジック`walkCatalogFieldNodes`）：`TreeWalker`でDOM順（document order）にテキストノードと`href`/`src`属性を走査し、各`{{token}}`の出現をそれが属する要素（`catalogUnitIndexOf`でユニット配列との包含関係を判定）＝ユニット番号（0始まり）、またはどのユニットにも属さなければ「共通」（`unitIndex: null`）に割り当てる。さらに「同じユニット（または共通）・同じtoken」の中で何番目の出現かを`seq`（0始まり）として持たせる。1つのユニット内に同じtokenがさらに複数回出るパーツ（例：43の各カラム内`{{text}}`×4）でも、この`seq`によって出現ごとに区別できる
  3. **ダイアログのフィールド構成**：ユニットごとに「1件目」「2件目」…のセクションを作り、そのユニットに実際に出現するトークンの種類だけ（タイトル／本文／リンク先URL／画像URL／電話番号、`CATALOG_FIELD_LABELS`）を、**出現1つにつき1つの入力欄**として表示する。同じユニット（または共通）内に同じ種類のトークンが2回以上出る場合は、ラベルへ「 1」「 2」…を付けて区別する（例：43の各カラムは「本文 1」〜「本文 4」の4欄）。1回しか出現しない場合はラベルはそのまま（「本文」「リンク先URL」等）。既定値：タイトル＝すべて「タイトル」、本文＝ダイアログ全体で最初の本文欄だけ選択テキスト（無ければ「ここに本文を入れます」）・それ以外はすべて「ここに本文を入れます」、URL/画像URL/電話番号は空欄（プレースホルダー文言のみ表示）。`variable`パーツは「件数」ステッパー（1〜20、既定値は`catalogNativeUnitCount`＝そのテンプレートに実在するユニット数）を持ち、変更するたびに`analyzeCatalogPartFields`で再解析してセクションを作り直す（入力済みの値はユニット番号＋トークン＋出現順のキー単位でキャッシュし、件数を減らしてまた増やしても保持される）
  4. **検証（挿入ボタン押下時）**：URL/画像URLは、非空なら`http://`/`https://`/`/`のいずれかで始まらないとエラー（該当欄を赤枠にしてフォーカス、挿入は中断）。空欄のまま確定した場合はURLは`#`、画像URLは既定のプレースホルダー画像`https://placehold.co/600x400?text=IMAGE`で埋める（URLが空だった場合のみ`showToast('URLが未入力の項目があります（# を仮に入れました）', 'info')`で警告）。電話番号は空欄なら既定値`000-000-0000`で埋める（検証なし）。Escapeまたは「キャンセル」で`null`を返し、`insertCatalogPart`は何も挿入・変更しない
  5. **HTML組み立て**（`insertCatalogPart`）：`openCatalogInsertDialog`が返した`{ rowCount, unitValues, commonValues }`（`unitValues[i][token]`/`commonValues[token]`は出現順に値を並べた配列）を使い、`variable`パーツは`applyCatalogRowCount(part.html, rowCount)`で行数を先に確定→`parseCatalogInert`で解析専用DOMを作り直し→`findCatalogFieldUnits`でユニットを再検出→`applyCatalogFieldValues`が出現ごとに（属するユニット、または共通の、その中でのN番目の）値でテキストノード・`href`/`src`属性を書き換える（`walkCatalogFieldNodes`を使うため出現順は2と必ず一致する）→そのHTML文字列に対して`substituteCatalogThemeTokens`（テーマトークン）→`fixCatalogCtaTextColor`の順で従来どおり処理する
- **行数可変（`variable: true`）**：`applyCatalogRowCount(rawHtml, n)`が本体（フィールドトークンの入力方法が変わっても、行数の組み立てロジック自体は変更なし。`n`の入力元が`prompt()`から挿入ダイアログの「件数」ステッパーに変わっただけ）：
  1. `rawHtml`を`DOMParser`で解析した検証専用ドキュメント（画像等の副作用リクエストを起こさないよう、通常の`document.createElement('div')`ではなく隔離文書を使う）に読み込む
  2. `findCatalogRepeatSpan(root)`が、兄弟要素が2つ以上・同じ「タグ名＋直接の子要素数」（`catalogSignature`）を持つ最も浅いコンテナを探す（例：`#27`は`<table>`内に自動挿入される`<tbody>`が持つ5つの`<tr>`。`unit`欄の`行（<tr>）`等はUI表示用のヒントで、判定自体はこの署名比較のみで行う）
  3. 見つかった並びの**先頭要素をhead**・**末尾要素をtail**・（3つ以上あれば実際の中間要素、2つしかなければ先頭をそのまま）**middle**として、`N=1→head単体`／`N=2→head+tail`／`N>=3→head + (N-2)×middle + tail`で再構成する（`#27`の中間行パターンに対応）
  4. 各行クローンについて`renumberCatalogRowText`が、テキストノードが「1〜2桁の数字」（0埋めがあれば0埋めのまま）または「`STEP n`」に厳密一致する場合のみ行番号（1始まり）へ振り直す。それ以外の本文テキストは変更しない
  5. 内部に繰り返し構造が見つからない（単一ブロックの）パーツはhtmlをそのまま返す
  - 45 校舎情報カードのように、テンプレートに実在する「繰り返しに見える」要素（タイトル行＋住所2行がいずれもDIV・子要素0個で同じ署名になる）が、意味的には本来のユニット（カード1件分）と一致しない場合がある。この場合も`catalogNativeUnitCount`の既定値（＝そのまま復元される件数）では情報が失われないことを確認済み（`no.45`は既定の件数3でオリジナルのタイトル1行＋住所2行＋電話/URL共通欄を維持する）。件数を既定値以外に変更すると行の組み合わせが変わる点は他の行数可変パーツと同じ
- **data属性の付与**：挿入直前に、ラップした要素（トップレベル要素が1つならそれ自身、複数なら新しい`<div>`でまとめる。例：#31/#39/#44）へ`data-part="catalog"`・`data-catalog-no="<no>"`・`data-theme="<currentTheme>"`を付与する。`data-catalog-no`は`stripExtensionInjectedNodes`が他のマーカー属性と一緒に出力時除去する
- **パーツの色との連携**（`scanCatalogPartRoles(rootEl, tokens)`）：挿入直後、ルート配下の全要素のインライン`background`/`background-color`/`color`/`border*`を調べ、値が`T.accent`・`T.hero`・`T.cta`のいずれかに一致すれば`bg`、`color`が`T.accent`・`T.cta`のいずれかに一致すれば`accent`、`color`が`T.ink`に一致すれば`text`、`border`系に色があれば`line`を`data-role`へ追加する（既存の`getPartRoleElements`/`applyPartColor`がそのまま使えるようにするための後付けスキャン）
- **テーマを変更との連携**：`catalog`パーツは`data-part`/`data-theme`を持つ通常パーツと同じ扱いのため、`rethemeEditorContent()`のパス1（`[data-part]`ループ）で自動的に配色が入れ替わる。`data-part="button"`専用の「ボタン規則」は使わないが、`RETHEME_GENERIC_PRECEDENCE`の`bg`/`color`/`border`優先順位リストの末尾に`cta`/`onCta`/`ctaBorder`が含まれるため、置換自体は正しく行われる
- **出力**：`buildBlogHtml()`は`class=`/`<style>`/`onclick`を一切含まない（カタログは元からインラインスタイルのみで構成）。`data-part`/`data-role`/`data-theme`/`data-catalog-no`は`stripExtensionInjectedNodes`で除去される

### リンク編集（v0.13.0: 挿入済みパーツのリンク先URL／画像URLを後から直す）
カタログパーツ挿入時にダイアログで入力したURL・画像URLは、挿入後もツールバーの「リンク編集」ボタン（`ICONS.linkEdit`、書式ツールバーの`tbGroupStyle`グループ内・「パーツの色」の隣）で個別に修正できる。

- **対象の判定**（`getCaretLinkContext(editor)`）：キャレット/選択位置から見て、(1) 最も内側の`<a>`の中にいる場合はその`<a>`、(2) そうでなくても直近の`[data-part]`要素（カード等）が`<a>`を**ちょうど1つだけ**含む場合はその`<a>`、のいずれかを対象にする。どちらにも該当しなければ対象なし（ボタンは`disabled`）
- **有効/無効の更新**：`document`の`selectionchange`（選択がエディタ内のときのみ）のたびに`updateLinkEditButtonState()`が再判定する
- **ダイアログ**（`openLinkEditDialog(editor, linkCtx)`）：対象の`<a>`の`href`を「リンク先URL」欄にプリフィル。対象の`<a>`（または(2)のカード）が`<img>`を含む場合のみ「画像URL」欄も表示し、その`src`をプリフィルする。OKで`<a>`の`href`（と、あれば`<img>`の`src`）を書き換え、`markUnsavedChange()`→`EditorHistory.commit()`。Escapeまたはオーバーレイクリック／「キャンセル」で何もせず閉じる
  - **検証**：リンク先URLは非空なら`http://`/`https://`/`/`/`tel:`/`mailto:`/`#`のいずれかで始まらないとエラー（該当欄を赤枠にしてフォーカス、確定は中断）。空欄のまま確定した場合は`#`で埋め、`showToast('URLが未入力の項目があります（# を仮に入れました）', 'info')`を表示する。画像URLは非空なら`http(s)://`または`/`必須（不正ならエラー）、空欄なら既定のプレースホルダー画像で埋める
- **ダブルクリックからの起動**：`[data-part="catalog"]`配下の`<a>`をダブルクリックすると、同じ`openLinkEditDialog`をその`<a>`（とその`data-part="catalog"`ルート）を対象に開く（`editor`の`dblclick`イベントで判定）
- **見た目**：プレビューモーダル（`.preview-modal-overlay`/`.preview-modal-sheet`）と同じオーバーレイ／シートのスタイルを流用し、`.link-edit-sheet`で幅だけ420pxに絞る

### テーマを変更（v0.13.0 P3: 記事全体の配色を貼り直さずに入れ替える）
テーマ選択の隣にある「テーマを変更」ボタンで、エディタに表示中の記事全体の配色を選択中テーマへその場で置換する機能。「テーマを適用」と違い、貼り付け欄のHTMLを再解析せず、既存DOMのインラインスタイルだけをトークン単位で置換する。

- `rethemeEditorContent(newKey)`：本体。`document.querySelector('.eisai-editor')`を対象に、以下の順で処理し、実際に色が変わった要素数を返す
  1. **`[data-part]`パーツ**：各パーツルートについて`oldKey = 自分のdata-theme属性 || window.lastAppliedThemeKey`（`resolveThemeKey()`でLEGACY_THEME_MAP経由の解決も行う）。`oldKey === newKey`なら何もしない。それ以外は自分自身＋配下の`[style]`要素すべてを`retoneElementInlineColors()`で塗り替えたのち、`data-theme`属性を`newKey`に更新する
  2. **旧クラスベースのパーツ**（`.theme-heading` / `.theme-subheading` / `.theme-box` / `.theme-bubble-left` / `.theme-bubble-right` / `.theme-button` / `.theme-list`、いずれも`data-theme`付き）：インラインスタイルを持たないため`data-theme`属性の張り替えだけで済む（実際の配色は`addThemeStyles`が全テーマ分を常時注入している`[data-theme]`セレクタのCSSが担う）
  3. **`[data-cta-protected]`ブロック**：テキスト・`href`は一切変更しない。ラッパー自身とその配下の`<a>`だけを対象にする（`data-part`を持たないため1のループでは拾われない、独立した3番目のパスとして処理する）
  4. **その他（地の文の`<p>`・`<ol>`等）**：1〜3のいずれにも属さない`[style]`要素を`window.lastAppliedThemeKey`基準の色でフォールバック処理する。本文色（`ink`）は12テーマ共通のため実際に変化することはないが、将来のトークン差異に備えて通す
- **色の置換規則**（`retoneElementInlineColors()` / `substituteTokenColorInCssValue()`）：対象要素が`[data-part="button"]`（申込枠内のボタンを含む）またはCTA保護ブロック内の`<a>`なら「ボタン規則」、それ以外は「通常規則」を使う
  - 通常規則：`background`/`background-color`/`background-image` → 優先順位 `[hero, soft, paper, decor, accent, cta]` ／ `color` → `[ink, accent, muted, decor, onCta]` ／ `border-color`・`border`・`border-top/right/bottom/left(-color)` → `[line, decor, accent, ink, ctaBorder, hero, soft, paper]`（v0.13.0: 吹き出しの尾＝`border-right-color`/`border-left-color`がhero/softを直接使うため末尾に追加。アバターの枠線＝decorは既存の並びで解決する）
  - ボタン規則：`background`系 → `cta`のみ／`color` → `onCta`のみ／`border`系 → `ctaBorder`のみ
  - 各プロパティの値（例：`1px solid #DEDAD8`、`linear-gradient(transparent 62%,#FFE1EB 62%)`）から色表現（`#hex`または`rgb()`/`rgba()`。ブラウザがhex指定をrgb()へ正規化することがあるため`normalizeColorToHex()`で両方を`#RRGGBB`へ揃えてから比較する）を抜き出し、優先順位の先頭トークンから順に一致するものを探して、見つかった色だけを新テーマの同名トークンへ置換する。それ以外の値（`1px solid`、`transparent 62%`等）や、テーマトークンに一致しない値（パーツごとに自由に選んだ色＝`data-color-*`が付いている値）はそのまま維持される
  - `data-color-*`属性そのものには一切触れない（自由色の記録として残り続ける）
- **`window.lastAppliedThemeKey`**：エディタの記事に最後に実際に適用されたテーマキー。「テーマを適用」成功時・「テーマを変更」成功時の両方で更新する。`data-theme`属性を持たないパーツ（CTA保護ブロック等）や、`data-theme`が欠落した古い下書きの`oldKey`フォールバックとして使う
- **UI**：ボタンはエディタが空（プレースホルダーのみを含む）の間は無効化（`updateRethemeBtnState()`、`.eisai-editor`のMutationObserverから毎回呼ばれる）。テーマ選択を変更すると、内容がある場合に限りボタンへ`.is-ready`クラスを一時的に付与してハイライトする。クリック時は確認ダイアログを出さず、塗り替え直後に`EditorHistory.commit()`で1手確定してから`showActionToast()`で「元に戻す」（8秒）付きのトーストを表示する（v0.13.0：塗り替え前の状態は`EditorHistory`のundoStackが保持するため、専用のスナップショット変数は持たない）。トーストの「元に戻す」は`EditorHistory.current.html`が塗り替え直後のHTMLと一致する場合のみ`EditorHistory.undo()`を呼ぶ（その間に別の編集があれば「その後に編集があったため戻せません」と表示して中止する）。選択中テーマが`window.lastAppliedThemeKey`と同じ場合は何もせず「すでにこのテーマです」と表示する

### EditorHistory（v0.13.0: エディタ専用のスナップショット式 undo/redo）
ツールバーの「元に戻す」「やり直し」ボタン用。長らく`document.execCommand('undo'/'redo')`（ネイティブundo）に頼っていたが、このエディタの操作の大半（テーマ適用・テーマ変更・パーツ挿入・パーツの色・装飾解除・履歴読込等）は`editor.innerHTML`の書き換え・DOM操作であり、ネイティブundoの対象外だったための刷新。

- **状態**：`undoStack` / `redoStack`（最大100手、`MAX_HISTORY`）／ `current = { html, sel }`（`html`＝直前に確定した`.eisai-editor`の`innerHTML`、`sel`＝そのときの選択範囲）
- **`EditorHistory.init(editor)` / `reset(editor)`**：同一実装。渡された要素を対象に登録し、その時点の`innerHTML`を起点として両スタックを空にする。「履歴読込」「新規作成」「サンプル読込」「内容をクリア」のように**別の記事に切り替える**操作はすべて`reset()`を呼び、undoが前の記事の内容へ越境しないようにする（`setPlaygroundHtml()`内に一本化）
- **`EditorHistory.commit(label, opts)`**：`editor.innerHTML`が直前の確定状態（`current.html`）と異なる場合のみ、直前の状態を`undoStack`へ積んで`current`を更新し、`redoStack`をクリアする（内容に変化がなければ何もしない安全なno-op）。`opts.coalesceKey`を渡すと、直前のコミットが同じキー・1秒以内なら`undoStack`への積み込みをスキップして`current`だけ更新する（＝1手にまとめる。「パーツの色」の連続クリックで使用）。v0.13.0：`current.html`を読む**前**に必ず`normalizeParts(state.editor)`を呼ぶため、コミットされるスナップショットは常にパーツ構造が正規化済みになる（`undo`/`redo`も復元直後に同様に呼び、`reset`も起点にする前に呼ぶ）
- **コミットポイント一覧**（＝`commit()`の呼び出し箇所）：
  - `applyThemeToGeminiHtml()`＝テーマを適用／`rethemeBtn.onclick`＝テーマを変更
  - `insertPresetElement()`終端＝プリセットパーツ挿入（見出し／サブ見出し／枠／吹き出し／ボタン／リスト／ポイント／室長より／申込枠／マーカー行／ヒーロー見出し）
  - `applyBlock()`終端＋`text`ケース＝カスタムモードの装飾カテゴリ・挿入ドロップダウン（引用／コードブロック等）、テーブル挿入ダイアログの`table-insert`＝表挿入
  - `partColorPick()` / 「テーマの色に戻す」＝パーツの色（前者は`coalesceKey`で連打をまとめる）
  - `clearBtn.onclick`＝装飾を外す／`allClearBtn.onclick`＝全装飾を外す
  - `createIconButton()`のラッパー＝太字／斜体／下線／取り消し線／左中右揃え（execCommand実行後に自動コミット。元に戻す/やり直し自身の呼び出しはno-opになる）
  - サイズドロップダウン（`applyFontSize`後）／文字色・背景色・マーカーの色ピッカー（`execCommand('foreColor'/'hiliteColor')`または`applyTextStyle('marker',…)`後）
  - `#playground`のEnter/Backspaceキー処理で`e.preventDefault()`して自前でDOM操作している4箇所（リストの最終行を抜ける、見出し/枠の末尾で段落を抜ける、枠内で改行、空の枠をBackspaceで削除）
  - タイピング：`input`イベントを600msデバウンスして`commit('typing')`（連続入力を1手にまとめる）。`beforeinput`で`inputType`が`delete*`／`insertParagraph`／`insertFromPaste`のときはその場で`commit()`し、直前までの入力を確定させてから本体の変更を別の手にする
- **`EditorHistory.undo()` / `redo()`**：スタックが空なら`showToast()`で「これ以上戻せません」／「これ以上やり直せません」と表示するのみ。それ以外は相手のスタックへ`current`を退避し、`editor.innerHTML`を差し替えて選択範囲を復元、`markUnsavedChange()`を呼ぶ。差し替え中は`EditorHistory.suppress`を立てて、`input`/`beforeinput`ハンドラの再入（自分自身の書き換えを新たな1手として拾ってしまうこと）を防ぐ
- **選択範囲の復元**：`.eisai-editor`を根としたノードパス（各階層の子インデックスの配列）＋オフセットで選択開始・終了を保存する（`serializeSelection`/`nodePath`）。復元時（`restoreSelection`/`nodeAtPath`）は同じパスを辿ってノードを再取得し、オフセットはノードの実際の長さでクランプする。パスが指すノードが見つからない場合（`innerHTML`置換で構造が変わった等）は例外を投げず、キャレットをエディタ末尾に置くフォールバックへ倒す
- **キーボード**：`.eisai-editor`自身の`keydown`で⌘Z/Ctrl+Z＝`undo()`、⌘⇧Z・Ctrl+Y・Ctrl+Shift+Z＝`redo()`を横取りし`preventDefault()`する（ネイティブundo/redoと競合しないようにするため）
- **ボタンの有効/無効**：`EditorHistory.setButtons(undoBtn, redoBtn)`で登録した2つのボタンの`disabled`を、`commit`/`undo`/`redo`/`reset`のたびに両スタックの長さで更新する

### パーツ構造の保護とパーツ境界のキー操作（v0.13.0）
パーツ（`[data-part]`／`[data-cta-protected]`）の前後でEnter・Backspace・Deleteを押すと、ブラウザ標準の分割・結合がパーツ内部（テーブルのセル・flexの列等）をただのブロックとして扱ってしまい、パーツ同士が合体・入れ子になったり、空行が積み重なったりする不具合への対応。

- **用語**：
  - **パーツ根**：`[data-part]`または`[data-cta-protected]`を持つ要素で、`.eisai-editor`を根までたどる間に他のパーツ根を挟まないもの（挟む場合は入れ子＝要修復）
  - **テキストコンテナ**：パーツ内の編集可能なテキストを持つ要素。`[data-role~="text"]`／`td`／`li`／`p`、または直下の子がテキスト・インライン要素のみの最深要素
  - **スペーサー**：`<p data-spacer="1"><br></p>`。パーツ同士の間・エディタの先頭/末尾がパーツの場合に、常にキャレットを置ける場所として確保する空段落
- **`normalizeParts(editor)`**：パーツ構造を正規化する共通基盤。`EditorHistory.commit()`／`undo()`／`redo()`／`reset()`の内部から自動的に呼ばれるため、テーマ適用・パーツ挿入・タイピングの確定・履歴読込・初期化など既存のあらゆる操作のあとに自動修復がかかる（呼び出し箇所を個別に追加する必要はない）。冪等・軽量。処理順：
  1. **入れ子修復**（`unnestPartRoots`）：他のパーツの内部に迷い込んだパーツ根を、外側パーツの直後へ移動する。多重入れ子は1階層ずつ解消するまで繰り返す
  2. **禁止要素の追い出し**（`releaseDisallowedBlocksFromParts`）：パーツ内に紛れ込んだ`h1`〜`h6`や、テンプレート外の`<table>`（`table`/`bubble`/`catalog`パーツ以外の中にあるもの）をパーツの直後へ移動する
  3. **ストレイなラッパーの除去**（`unwrapStrayPartWrappers`）：パーツ根とエディタの間に挟まった、子がパーツ1つだけの空div/pを剥がす
  4. **スペーサーの確保**（`ensurePartSpacers`）：パーツ同士が隣接する箇所・エディタの先頭/末尾がパーツの場合にスペーサーを新規作成、または既存の空段落があれば`data-spacer="1"`を付与して再利用する。並び替え等で連続する空段落が複数できた場合は1つにまとめる
  5. **空コンテナの畳み込み**（`collapsePartEmptyRuns`／`ensurePartTextContainerBr`）：パーツ内（`data-cta-protected`は対象外）で連続する空のdiv/p（2つ以上）を1つの`<br>`に畳む。テキストも`<br>`も無いテキストコンテナには`<br>`を補い、コンテナが潰れないようにする
  6. `renumberHeadings(editor)` ／ 各`[data-part="list"]`に`renumberListRows`
- **キー操作**（`.eisai-editor`の`keydown`、パーツ境界専用の分岐。処理したら`preventDefault()`＋`stopImmediatePropagation()`して既存の（装飾ブロック向け）Backspace/Delete処理や`#playground`側の旧処理を横取りする）：

  | 状況 | Enter（Shift無し） |
  |---|---|
  | 見出し／サブ見出し／ヒーロー見出し／マーカー行／写真プレースホルダー／ボタン／CTA保護ブロック（`[data-cta-protected]`。内部的に`kind='ctaProtected'`と呼ぶ。v0.13.0生成語彙対応の`data-part="cta"`とは名前空間を分けている） | パーツの直後（スペーサーがあれば再利用、無ければ新規作成）へ抜ける |
  | リスト／目次（toc）／まとめ（summary）：空行 | 行を削除してパーツの外へ抜ける |
  | リスト／目次／まとめ：行に文字あり | 現在行の直後に新しい行を追加（`renumberListRows`はtoc/listの連番のみ振り直す。まとめは固定`✓`のため対象外） |
  | 結果テーブル：セル | 同じ列の次の行へ（最終行なら抜ける） |
  | 枠／ポイント／室長より／申込枠／吹き出し／カタログパーツ／CTA（`data-part="cta"`）／関連記事／教室情報等 | パーツの実質末尾なら抜ける、それ以外は`<br>`を挿入（ブロックは割らない） |
  | 任意のパーツ内（Shift+Enter） | 常に`<br>` |

  - **Backspace**：パーツ先頭で押すと結合せず、直前が空段落かつその前がパーツでなければ空段落を除去、それ以外は直前段落の末尾へキャレットを移すだけ。パーツ内・非先頭は既定動作（空になったコンテナへの`<br>`維持は`input`ハンドラが補う）。パーツの外側、空段落＋直前がパーツ根なら1回目でパーツを選択状態（`data-selected="1"`、オレンジ色の枠線）にし、選択中に再度Backspace/Deleteを押すとパーツごと削除する（誤操作防止の2段階削除）
  - **Delete**：Backspaceの鏡像。パーツ末尾で押すと結合せず後続段落（無ければ新規作成）へキャレットを移す。パーツの外側、段落末尾＋直後がパーツ根なら1回目で選択、2回目で削除
  - **選択解除**：Enter/Backspace/Delete以外のキー・クリック・`selectionchange`・エディタのフォーカス喪失のいずれでも`data-selected`を解除する（選択中に通常入力すれば選択解除のうえ通常どおり入力される）
  - **範囲選択**：パーツ境界をまたぐ非collapsed選択でのBackspace/Deleteは`range.deleteContents()`のうえ`normalizeParts()`で残骸を修復する
- **貼り付け**：キャレットがパーツ内のテキストコンテナにあるとき、`paste`イベントを横取りして`clipboardData`の`text/plain`のみを挿入する（改行は`<br>`に変換。外部HTMLの装飾は一切持ち込まない）。パーツの外は従来どおりの挙動を維持し、貼り付け直後の`input`で`normalizeParts()`を1回走らせる
- **パーツ操作バー**（`.eisai-part-toolbar`）：キャレットがパーツ内にあるとき、`.eisai-editor-container`内にパーツ根の右上へ絶対配置で浮かぶ操作ピル（↑上へ／↓下へ／＋下に段落／🗑削除）。`selectionchange`・エディタのスクロール・ウィンドウのリサイズで再配置する。↑/↓は前後の要素（空段落なら1つ先まで飛ばして実質的なパーツ・段落）と入れ替えてから`normalizeParts()`、＋下に段落はパーツ直後にプレーンな`<p><br></p>`を追加してキャレットを移動、🗑削除はパーツ削除。いずれも`EditorHistory.commit()`で1手として確定する。パーツの余白（padding）を直接クリック（mousedownのtargetがパーツ根そのもの）した場合もパーツを選択状態にする

### データ保護
- 未保存ガード（`guardUnsaved`）：履歴を開く・新規作成・テーマ再適用の前に、未保存の変更があれば確認ダイアログを表示
- 離脱警告（`beforeunload`）：未保存の変更がある状態でタブを閉じる／リロードしようとすると警告
- 履歴上書き防止：テーマ適用時に `Drafts.clearCurrentId()` を呼び、既存履歴を意図せず上書きしない
- 破損データの退避：履歴の保存データ（JSON）が壊れて読み込めない場合、生データを別キーへ退避してから空リストとして起動する

### 履歴の保存先（localStorage）
- `eisai_editor_drafts_v3`（`DRAFTS_KEY`、v0.13.0〜。新エディタ`editor-icons.html`用）：履歴（下書き）本体。最大50件、`_dedupe`でID重複を排除して保存
- `eisai_editor_drafts_v3_broken_<タイムスタンプ>`：読み込みに失敗した破損データの退避先
- `eisai_editor_drafts_v2`（`LEGACY_DRAFTS_KEY`）：旧バージョン`editor-icons-legacy.html`が使い続けるキー。新エディタは初回起動時（v3が空の場合のみ）にここからv3へ一方向コピーする（`migrateDraftsFromLegacyIfNeeded()`）。コピー後もv2は削除せず、旧バージョン側では従来通りこのキーを読み書きする
- 「現在編集中のID」はインメモリ変数（`_currentDraftId`）のみで保持し、localStorageには保存しない（リロードでリセットされる）。起動時に掃除する残置キー名も`eisai_editor_current_id_v3`に追随（新エディタ側のみ。旧バージョンは`eisai_editor_current_id_v2`のまま）

### バージョン
- 0.13.0

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
