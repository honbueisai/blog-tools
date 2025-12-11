# トラブルシューティング (TROUBLESHOOTING)

## よくある問題と解決方法

### 1. 教室情報が保存されない

**症状**: 教室名、責任者名、URL、電話番号を入力して保存しても、次回起動時に消えている

**原因**: 
- CLASSROOM_STORAGE_KEYの保存・復元ロジックの問題
- バージョン管理ストレージとの競合

**解決方法**:
1. ブラウザの開発者ツールを開く（F12）
2. コンソールで以下を実行してストレージを確認：
```javascript
// Tampermonkeyストレージの確認
GM_getValues()
```
3. CLASSROOM_STORAGE_KEYの値を確認
4. 必要であればストレージをクリア：
```javascript
// ストレージのクリア（注意：全設定がリセットされます）
GM_deleteValue('eisai_blog_info_v05659')
GM_deleteValue('eisai_classroom_settings_persistent')
```

**予防策**:
- バージョンアップ時に必ずストレージキーを確認
- saveSetting/getSetting関数の同期を維持

---

### 2. サムネイル生成が意図通りに表示されない

**症状**: 人物紹介ブログのサムネイルが先生の写真を使用しない

**原因**:
- BLOG_TYPES.PERSONの条件分岐が正しく動作していない
- 人物紹介専用のプロンプトが組み込まれていない

**解決方法**:
1. blog-generator.user.jsの1240行目付近を確認
2. 以下のコードが存在するか確認：
```javascript
// 人物紹介タイプのサムネイルルール
if (blogType === BLOG_TYPES.PERSON) {
  const personThumbnailRules = `
  【人物紹介専用サムネイルルール】
  - ベース画像: アップロードされた先生の写真を使用
  - 背景: 透過背景にしておしゃれなグラフィック背景を配置
  - レイアウト: 右1/3に先生（バストアップ）、左2/3にテキストエリア
  - 名前表示: 日本語フルネーム＋ローマ字フルネームを2行で表示
  - 先生の描写: プロフェッショナルな白衣姿、清潔感のある大学風
  - テキスト配置: 左側エリアに中央揃えで配置
  `;
  // プロンプトに追加
}
```

**確認手順**:
1. Geminiで人物紹介ブログを生成
2. 画像生成プロンプトに人物紹介専用ルールが含まれているか確認
3. 含まれていない場合はコードを修正

---

### 3. バージョン不一致によるエラー

**症状**: 「バージョンが一致しません」というエラーが表示される

**原因**:
- blog-tools版とTampermonkey版でバージョンが異なる
- 一部のコンポーネントだけバージョン更新されている

**解決方法**:
1. 以下のコンポーネントのバージョンを確認：
   - `@version`（コメント）
   - `TOOL_ID`定数
   - `BTN_ID`定数
   - `STORAGE_KEY`定数
   - `CURRENT_VERSION`定数

2. 全て同じバージョン番号に合わせる：
```javascript
// 例：0.56.59に統一する場合
@version      0.56.59
const TOOL_ID = 'eisai-blog-tools-v05659';
const BTN_ID = 'eisai-blog-btn-v05659';
const STORAGE_KEY = 'eisai_blog_info_v05659';
const CURRENT_VERSION = '0.56.59';
```

3. 両方のファイルでバージョンを同期させる

---

### 4. Geminiの入力欄が見つからない

**症状**: 「Geminiの入力欄が見つかりませんでした」というアラートが表示される

**原因**:
- GeminiのUIが更新されてセレクタが変更された
- ページの読み込みが完了していない

**解決方法**:
1. Geminiのページが完全に読み込まれているか確認
2. 以下のセレクタを確認：
```javascript
// 現在のセレクタ
document.querySelector('div[contenteditable="true"], rich-textarea div[contenteditable="true"]')
```
3. 必要であればセレクタを更新（最新のGemini UIに対応）

**暫定対処**:
- ページを再読み込み
- 少し待ってから再度実行

---

### 5. 画像生成プロンプトが長すぎる

**症状**: プロンプトが途中で切れている、または生成に失敗する

**原因**:
- ブログ記事の内容が長すぎる
- Geminiの入力制限を超えている

**解決方法**:
1. ブログ記事の文字数を確認（2000文字以内推奨）
2. 不要な部分を削除して再度実行
3. プロンプトの一部を手動で編集

---

### 6. カラースタイルが反映されない

**症状**: 選択したカラーがサムネイルに反映されない

**原因**:
- COLOR_STYLES定数の定義が不足
- 「お任せ」モードの判定ロジックの問題

**解決方法**:
1. COLOR_STYLES定数を確認：
```javascript
const COLOR_STYLES = {
  '英才ブランドカラー': { main: '英才オレンジ', sub: '英才ブルー', hex: '#FF6B35', gradient: 'orange to white' },
  // 他のカラー定義...
};
```
2. お任せモードの判定を確認：
```javascript
if (mainColor === 'お任せ' || subColor === 'お任せ') {
  // 自動選択ロジック
}
```

---

### 7. UIが表示されない、またはレイアウトが崩れる

**症状**: ツールのパネルが表示されない、またはボタンが押せない

**原因**:
- CSSの競合
- GeminiのUI変更
- JavaScriptエラー

**解決方法**:
1. ブラウザの開発者ツールでエラーを確認
2. CSSセレクタの競合をチェック
3. 必要であればCSSを修正

**確認手順**:
1. F12で開発者ツールを開く
2. Consoleタブでエラーを確認
3. ElementsタブでUI要素を確認

---

## デバッグ方法

### コンソールログの確認

重要なログを確認して問題を特定：

```javascript
// 起動時のログ
console.log('英才ブログ生成ツール v0.56.59 起動');

// 設定保存時のログ
console.log('設定を保存:', savedData);

// 教室情報復元時のログ
console.log('教室情報を復元:', classroomData);
```

### ストレージデータの確認

```javascript
// 全ストレージデータの確認
console.log('全ストレージ:', GM_getValues());

// 特定キーの確認
console.log('バージョン管理データ:', GM_getValue('eisai_blog_info_v05659'));
console.log('教室情報データ:', GM_getValue('eisai_classroom_settings_persistent'));
```

### バージョン確認

```javascript
// 現在のバージョン確認
console.log('現在のバージョン:', CURRENT_VERSION);
console.log('ストレージキー:', STORAGE_KEY);
```

---

## リセット方法

### 完全リセット

すべての設定を初期化する場合：

```javascript
// 全ストレージを削除
GM_deleteValue('eisai_blog_info_v05659');
GM_deleteValue('eisai_classroom_settings_persistent');

// ページを再読み込み
location.reload();
```

### 部分リセット

教室情報のみリセットする場合：

```javascript
// 教室情報のみ削除
GM_deleteValue('eisai_classroom_settings_persistent');
```

---

## 連絡先

### サポート

問題が解決しない場合：

1. **エラー内容**: 具体的なエラーメッセージ
2. **再現手順**: 問題が発生するまでの操作
3. **環境情報**: ブラウザ、Tampermonkeyバージョン
4. **コンソールログ**: 開発者ツールのログ

### 開発者向け

- **リポジトリ**: https://github.com/honbueisai/blog-tools
- **Issues**: GitHubで問題報告を受け付けています
- **ドキュメント**: SPEC.mdを参照

---

## よくある質問

### Q: バージョンアップは必須ですか？
A: はい、機能追加やバグ修正のため、必ず最新バージョンをご使用ください。

### Q: 他の拡張機能と競合しますか？
A: 基本的には競合しませんが、Geminiを拡張する他のツールとは影響する場合があります。

### Q: データはどこに保存されますか？
A: ブラウザのTampermonkeyストレージ内に保存され、外部には送信されません。

### Q: オフラインで使用できますか？
A: いいえ、Gemini APIを使用するためインターネット接続が必要です。
