# tests/ - ChatGPT版拡張機能の動作確認用モック・自動テスト

`blog-generator-chatgpt.user.js` は本物の `chatgpt.com` を必要とする自動送信・完了検知（合言葉方式）を持つため、
**chatgpt.com のDOMを模した静的ページ**（`mock-chatgpt.html`）と、それをヘッドレスChromeで自動操作する
**`run-matrix.mjs`** の2段構成で確認する。外部への通信は一切行わない。

## v0.4.1.0：合言葉（依頼番号）方式について

拡張機能は、ChatGPTの「画面の作り」（`data-message-author-role`・`data-testid`・停止ボタン等）を一切見ない。
送信ごとに短いランダムな依頼番号（例：`ab12cd`）を発行し、プロンプトの末尾で「回答の最初の行に開始目印
`[[EISAI-START-<ID>]]`、最後の行に終了目印`[[EISAI-END-<ID>]]`を書く」よう指示する。読み取り側は`main`内の
全テキストノードを連結した1本の文字列の中で、この目印だけを探す（DOM構造・役割属性・停止ボタンは無視する）。

このため `mock-chatgpt.html` も、送信されたプロンプトから依頼番号を読み取り、fixtureの本文をその目印で
包んで返す役割に作り替えている。DOM構造（`layout`パラメータ）をどれだけ変えても、拡張機能が同じように
読み取れることを確認するのが主な目的。

## ファイル

- `mock-chatgpt.html` - chatgpt.comの必要最小限のDOM（入力欄・送信ボタン・ユーザー発言・AI応答・停止ボタン）を
  再現し、`<script src="../blog-generator-chatgpt.user.js">` で拡張機能を素の `<script>` として読み込む
  （`@grant none` なのでそのまま動く）。送信文から依頼番号（`依頼番号：ID`）を読み取り、fixtureの本文を
  `[[EISAI-START-ID]]`〜`[[EISAI-END-ID]]`で包んで応答として流し込む。`layout`パラメータでDOM構造だけを
  変える（本文の組み立て方は変わらない）。
- `run-matrix.mjs` - Node 22の組み込み`WebSocket`でChrome DevTools Protocol (CDP) を直接操作するヘッドレス
  Chromeテスト。`{記事生成→HTMLコピー→サムネ指示生成→画像生成}`の一連の流れを、`layout`×{表のまま／裏→表}×
  {`heavy`なし／`heavy=1`}の全組み合わせ＋「貼り付けて読み込む」1ケースで自動実行し、結果表を出力する。
  Puppeteer等の外部パッケージは使わない。
- `fixtures/<name>.txt` - ChatGPTの実際の出力（`<h1>`〜`EISAI_CHECK`/`CTA_DATA_END` まで）を保存したテキスト。
  モックがこの内容を目印で包んで少しずつ流し込む。
  - `sc_yanokuchi-chatgpt.txt` - 悩み解決型・矢野口校
  - `higashioozima-chatgpt.txt` - ストーリー型・東大島校
  - `img-prompt-sample.txt` - サムネイルの「画像用の指示を作る」を押した後の応答用（記事とは別経路で流し込む）。
    `[[EISAI_IMG_PROMPT]]`〜`[[/EISAI_IMG_PROMPT]]`と
    `[[EISAI_IMG_TEXT]] メイン：75点アップ／サブ1：中3・5教科／サブ2：320→395`を含む

## 開き方（手動確認）

このリポジトリのルート（`blog-tools`）以上の階層で、`dev-server.py`（または任意の静的サーバー）を起動する。

```bash
cd /Users/yuanob/Documents/EISAI_KOBETSU.localized/MIRAIMO/EISAI/BLOG
python3 dev-server.py
```

ブラウザで以下のように開く（`.claude/worktrees/chatgpt-v0.4/` の部分は、実際にサーバーを起動した階層からの
相対パスに合わせる）。テストモード（`eisai_test=1`）を付けると、教室情報にダミー値が自動で入る。

```
http://localhost:8090/.claude/worktrees/chatgpt-v0.4/tests/mock-chatgpt.html?eisai_test=1&fixture=sc_yanokuchi-chatgpt
```

## URLパラメータ

| パラメータ | 例 | 説明 |
|---|---|---|
| `eisai_test` | `?eisai_test=1` | 拡張機能側のテストモード（`syncTestModeFlagFromLocation`）。教室情報にダミー値（`英才テスト校`等）が自動で入り、教室情報の入力を省略できる。 |
| `fixture` | `?fixture=sc_yanokuchi-chatgpt` | `tests/fixtures/<name>.txt` を読み込んで、記事生成の応答として流し込む（拡張子 `.txt` は付けない）。省略時・読み込み失敗時は画面上部に赤字で「fixtureなし」と表示され、送信自体は成功するが応答は再現されない。 |
| `fail` | `?fail=send` | 送信ボタンを無効化し、拡張機能のキーボードEnterフォールバックにも反応しない状態にする。「送信を確認できないので1回だけ再送 → それでも失敗 → 📋プロンプトをコピーへの誘導」を確認するための異常系。 |
| `speed` | `?speed=20` | 応答をチャンクで流し込む間隔（ms）。省略時は `40`。値を大きくすると「🧠 生成中です…（n文字）」表示の確認がしやすい。 |
| `layout` | `?layout=markdown` | 応答を包むDOM構造だけを変える（本文の組み立て・目印は共通）。`writing-block`（既定）＝文書カード構造。`markdown`＝`.markdown`直下にテキストが直接入る旧構造。`stale`＝`.markdown`に書き出し途中の残骸「`<h`」だけが残り、本文が別divに入る実機不具合の再現。`v2dom`＝役割属性・停止ボタンが一切無いDOM（送信すると会話URLが`/c/mock-test`から`/c/mock-v2`に変わる）。`random`＝ランダムな深さの入れ子div/span＋テキストノードの任意分割（目印もまたいで分割される）。`seed=`で再現できる。 |
| `seed` | `?layout=random&seed=2` | `layout=random`限定。乱数のシード（既定`1`）。同じシードなら同じDOM構造になる。 |
| `echo` | `?layout=v2dom&echo=1` | `layout=v2dom`限定。ユーザー発言（送信したプロンプト全文）を改行ごとに個別の`<p>`へ分割して表示する（実機のより厳しい見え方の再現）。 |
| `hideDuring` | `?hideDuring=1` | 実機で確認した「タブが裏（`document.hidden`）にある間、ChatGPTが回答のDOM反映を止める」挙動を再現する。裏にある間は本文をごく短い状態で止めたままにし、`visibilitychange`で表に戻った瞬間に、裏で進んでいた分をまとめて反映する。 |
| `renderHidden` | `?renderHidden=1` | v0.4.1.2追加。もう一つの実機パターン（裏にあってもChatGPTが本文を最後まで描画し終える）を再現する。`hideDuring=1`と同時に指定した場合はこちらを優先し、裏でも本文の描画を止めずに最後まで書き終える。`hideDuring=1`が無い既定でも本文は裏でも描画され続けるため、主に「裏のまま最後まで完成すること」を明示的に確認したいテスト用のフラグ。 |
| `heavy` | `?heavy=1` | 実機同等の巨大DOM（サイドバー風の要素3,000個＋過去の会話ターン40個、要素数を数千〜数万にする）を`main`内に追加し、拡張機能の1秒ごとの監視（`collectMainTextIndex`のTreeWalker走査）が大きなDOMでもメインスレッドを長時間ブロックしない（ロングタスク0件）ことを確認する。画面上部に50ms超のロングタスク件数を表示し（`window.__eisaiLongTasks`にも生データを積む）。 |
| `imgFail` | `?imgFail=1` | 「このプロンプトで画像を生成する」を押した後の応答を、失敗の言い回し＋下書きimg（`naturalWidth`>500）の両方がある状態にする。 |
| `imgNone` | `?imgNone=1` | 「このプロンプトで画像を生成する」を押した後の応答を、失敗の言い回しのみ・imgなしの状態にする。`imgFail`と同時に指定した場合は`imgNone`が優先される。 |

複数パラメータは `&` で連結できる（例：`?eisai_test=1&fixture=sc_yanokuchi-chatgpt&layout=v2dom&echo=1&heavy=1`）。

## 自動テスト：`run-matrix.mjs`

前提：macOSに `/Applications/Google Chrome.app` が入っていること、Node 22以降（組み込み`WebSocket`を使用）。

1. 別ターミナルで開発サーバを起動する（落ちていたら起動する。既に動いていればそのまま）。
   ```bash
   cd /Users/yuanob/Documents/EISAI_KOBETSU.localized/MIRAIMO/EISAI/BLOG
   python3 dev-server.py
   ```
2. このディレクトリ（worktree）で実行する。
   ```bash
   cd /Users/yuanob/Documents/EISAI_KOBETSU.localized/MIRAIMO/EISAI/BLOG/.claude/worktrees/chatgpt-v0.4
   node tests/run-matrix.mjs
   ```
3. ヘッドレスChromeを一時プロファイル（`--user-data-dir`）で起動し、`tests/mock-chatgpt.html`をCDP経由で
   タブごとに開いて操作する。各ケースの終了時にタブを閉じ、全ケース終了後にChromeプロセスを終了する。
4. 実行対象：`{writing-block, markdown, stale, v2dom&echo=1, random(seed=1/2/3)}` × `{表のまま, 裏→表}` ×
   `{heavyなし, heavy=1}`（計28ケース）＋「貼り付けて読み込む」3ケース＋「ずっと裏のまま（`renderHidden=1`）」
   1ケース（計32ケース）。「ずっと裏のまま」ケースは、記事生成→サムネ指示生成→画像生成のすべてを、
   表に一度も戻さずに完成させられることを確認する（v0.4.1.2で追加）。
5. 結果表（ケース名・合否・所要時間・ロングタスク件数・最大時間・エラー）を標準出力に表示する。
   1件でも不合格、または1件でもロングタスク（50ms超）が発生していれば、終了コード1で終わる。

「裏→表」ケースは、`Object.defineProperty(document, 'hidden', ...)` で`document.hidden`を直接上書きし
（ヘッドレス・バックグラウンドタブは元々`document.hidden`が`true`になりがちなため、まず「表」に固定してから、
生成中に一度だけ「裏→表」を切り替える）、`visibilitychange`イベントを発火させて再現する。実際のOSレベルの
タブ切り替えではないが、拡張機能・モックのどちらも`document.hidden`だけを見ているため、これで十分に再現できる。

## 手順（手動：正常系）

1. 上記URLを `eisai_test=1&fixture=…` 付きで開く（画面上部の `fixture読込：読込OK（n文字）` を確認）。
2. ページ左側あたりに出る拡張機能の丸いボタンをクリックしてパネルを開く。
3. かんたんモードのメモ欄に「例を入れる」でサンプルを入れる（教室情報はテストモードで自動入力済み）。
4. 「ChatGPTで記事を作る」を押す。
   - 下部の入力欄にプロンプトが入り送信され、ユーザー発言が追加される。
   - 「🧠 ChatGPTが考えています…」→「🧠 ChatGPTが生成中です…（n文字）」→「⏳ 生成完了を確認しています…」の順に表示が進む。
   - 終了目印が見つかり2秒間本文が変わらなくなると「✅ 記事の生成が完了しました」と出て、HTMLコピー等のボタンが有効になる。
5. 「HTMLをコピー（エディタへ）」→「画像用の指示を作る」→「このプロンプトで画像を生成する」の順に押し、
   サムネ指示・画像生成もそれぞれ完了することを確認する。

## 手順（手動：異常系・貼り付けて読み込む）

1. `?fail=send` を付けて開き、「ChatGPTで記事を作る」を押す。8秒後の再送→さらに8秒後の失敗表示（「読み取り直す」
   ボタンと「📋 プロンプトをコピー」の強調表示）を確認する。
2. 失敗時に自動で開く「うまく検出できない場合：ChatGPTの回答を貼り付けて読み込む」欄に、`tests/fixtures/*.txt`の
   内容を（目印を付けずに）貼り付けて「読み込む」を押す。`<h1>`から本文が読み取られ、通常の完成状態になることを
   確認する（目印が無くても読める最後の逃げ道）。

## テスト版（TEST.user.js）の作り直し方

実機（本物のchatgpt.com）で試すために、本体 `blog-generator-chatgpt.user.js` とは別バージョンとして
Tampermonkeyに二重インストールできる「テスト版」を用意している。以下の2ファイルは、**本体から機械的に
作り直すだけ**で、内容を手で書き換えたりしない。

- `tests/blog-generator-chatgpt.TEST.user.js` - Tampermonkeyに直接インストールする用
- `tests/TEST-script-for-copy.txt` - 上と全く同じ内容（コピー＆ペーストでインストールしたい時用）。
  拡張子を`.txt`にしているのは、GitHub等でそのまま「素のテキスト」として開きやすくするため。

### 作り直し手順

1. 本体 `blog-generator-chatgpt.user.js` の内容をコピーする。
2. UserScriptヘッダーの3行だけを変更する。
   - `@name` … `Eisai Blog Generator for ChatGPT` → `Eisai Blog Generator for ChatGPT【TEST v0.4.1.0】`
     （版番号は今回のテスト版の番号。次回以降は下記「次回以降のバージョン番号」を参照）
   - `@namespace` … `http://tampermonkey.net/` → `eisai-test-v040`
     （本体と名前空間を分け、Tampermonkeyで別スクリプトとして共存させるため。`040`はメジャー.マイナー.パッチ部分で、
     本体が`0.5.0`など次のマイナー/メジャーに上がったら合わせて変える）
   - `@version` … 本体の値（例：`0.4.0`）→ `0.4.1.0`
3. `@updateURL` と `@downloadURL` の2行は**削除する**（テスト版は自動更新させない）。
4. 本文（ヘッダー以外）は本体と完全に同一のまま、変更しない。
5. できたテキストを `tests/blog-generator-chatgpt.TEST.user.js` と `tests/TEST-script-for-copy.txt` の
   両方に、同じ内容で保存する（この2ファイルは常に同一内容）。
6. `node --check tests/blog-generator-chatgpt.TEST.user.js` で構文エラーが無いことを確認する
   （`.txt`のまま`node --check`はできないので、拡張子を`.js`に変えた一時コピーで確認してもよい）。
7. 本体の `@version`（`blog-generator-chatgpt.user.js`）は**変更しない**。テスト版の番号だけを上げる。

### 次回以降のバージョン番号

今回（v0.4.1.0）は「ChatGPTとのやり取り層」自体を合言葉方式に作り替える大きな変更のため、テスト版の
バージョン系列を `0.4.0.N`（0.4.0.4 〜 0.4.0.9）から `0.4.1.0` に進めた。次回以降は、同じ系列内の小さな
作り直しは `0.4.1.N` の `N` を1ずつ上げ（`0.4.1.0` → `0.4.1.1` → …）、本体側で機能追加・修正があり
`@version` が `0.5.0` 等に上がった場合は、テスト版の番号も `0.5.0.1` のように区切り直し、`@namespace` の
末尾（`eisai-test-vXYZ`）もそれに合わせて変える。

## v0.4.1.7で追加したモックの性質（既定で有効）

- `slowInsert`（既定で有効。`slowInsert=0`で無効）：`execCommand('insertText'／'insertHTML')`を、本物のChatGPTの入力欄と同じように文字数の2乗に近い割合で重くする（3,000字で約1秒）。
- 貼り付け（`paste`イベント）は一瞬で入る。`pasteAttachAt`字（既定9,000字）を超える貼り付けは、本物と同じく「貼り付けたテキスト（n）.txt」の添付になり、約1.2秒は送信ボタンが押せない（アップロード中）。
- `run-matrix.mjs`は、500msを超える重い処理が1回でもあったケースを不合格にする。`EISAI_ONLY=名前の一部`で、表のケースを絞って実行できる（調査用）。
