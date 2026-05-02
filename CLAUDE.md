# blog-tools 運用ルール

このリポジトリ (`honbueisai/blog-tools`) における Claude Code の作業ルール。

---

## 1. 基本姿勢

- **main 直push禁止**。すべての変更は作業ブランチ → PR → マージ。
- **勝手にcommit / push / PR作成しない**。ユーザーの明示指示があった時のみ実行。
- **破壊的操作は必ず事前確認**（force push, reset --hard, branch -D, ファイル一括削除 等）。
- 作業前に `git status` / `git pull` で状態を確認。

---

## 2. ブランチ戦略

| 種類 | プレフィックス | 例 |
|---|---|---|
| 機能追加 | `feature/` | `feature/add-export-csv` |
| バグ修正 | `fix/` | `fix/template-render-bug` |
| リファクタ | `refactor/` | `refactor/split-modules` |
| ドキュメント | `docs/` | `docs/update-readme` |
| 緊急対応 | `hotfix/` | `hotfix/critical-xss` |

- 作業開始時に `git checkout -b <branch>` で必ず分岐。
- 1ブランチ = 1目的。混ぜない。

---

## 3. コミット規約

[Conventional Commits](https://www.conventionalcommits.org/) に準拠。

```
<type>: <subject>

<body>
```

**type**: `feat` / `fix` / `docs` / `refactor` / `style` / `test` / `chore` / `perf`

**例**:
```
feat: ブログ記事のCSVエクスポート機能を追加

- カテゴリ別フィルタ対応
- UTF-8 BOM付きで出力
```

- 件名は日本語OK、50文字以内推奨。
- WHY を本文に書く（WHATはdiffが語る）。
- 1コミット = 1論理変更。

---

## 4. バージョン管理（2系統）

このリポジトリは **拡張機能** と **エディター** の2つのツールを管理する。
それぞれ独立してバージョン管理する。

### 4-1. 拡張機能 `blog-generator.user.js`
`@version` ヘッダーで管理。

### 4-2. エディター `editor-icons.html`
HTMLコメント (`<!-- 英才ブログエディタ Ver.X.Y.Z -->`) と `<title>` 内のVer表記で管理。
**両方を同時に更新**すること。

### 共通バージョニングルール（semver）
- **patch (x.x.+1)**: バグ修正、文言修正
- **minor (x.+1.0)**: 機能追加、UI追加（後方互換あり）
- **major (+1.0.0)**: 破壊的変更、データ構造変更

バージョン変更時は **必ず `CHANGELOG.md` も同時更新**。
CHANGELOGエントリは **どちらのツールの変更か明記**：

```markdown
## [Editor 0.9.0] - 2026-05-02
### Added
- 新テーマ追加

## [Userscript 1.2.0] - 2026-05-02
### Fixed
- ...
```

```markdown
## [1.2.0] - 2026-05-02
### Added
- CSVエクスポート機能

### Fixed
- テンプレート描画時の改行バグ
```

---

## 5. ドキュメント更新義務

以下の変更時は **対応するドキュメントを必ず同じPRで更新**。

| 変更内容 | 更新対象 |
|---|---|
| 機能追加・変更 | `README.md` / `SPEC.md` / `CHANGELOG.md` |
| バグ修正 | `CHANGELOG.md` / 必要なら `TROUBLESHOOTING.md` |
| 既知の問題追加 | `TROUBLESHOOTING.md` |
| インストール手順変更 | `README.md` |

---

## 6. PR ルール

- タイトル: `<type>: <概要>` (コミット規約と同じ)
- 本文テンプレ:
  ```
  ## 概要
  なぜこの変更が必要か

  ## 変更内容
  - 何を変えたか（箇条書き）

  ## 動作確認
  - [ ] Tampermonkeyで読み込み確認
  - [ ] 対象ブログサービスで動作確認
  - [ ] CHANGELOG更新済み
  - [ ] @version更新済み
  ```
- レビュー前に **自分でdiffを読み返す**。

---

## 7. 動作確認

自動テストが難しいため、**手動確認チェックリスト**を必ず通す。

### 拡張機能 `blog-generator.user.js`
- [ ] Tampermonkey / Violentmonkey でインストール可能
- [ ] `@match` 対象ページ（Gemini）で起動する
- [ ] コンソールにエラーが出ない
- [ ] 既存機能のリグレッションがない

### エディター `editor-icons.html`
- [ ] ブラウザで直接開いてレイアウト崩れなし
- [ ] 入力 → テーマ適用 → コピー の主要動線が動く
- [ ] コンソールにエラーが出ない
- [ ] 全テーマで描画確認

確認できない変更は PR 本文に **「未検証」と明記**。

## 7-1. デプロイ（エディター）

`editor-icons.html` は `tools.eisai.org/blogs/` 配下にApacheで配信されている。
**現状はFTP/SFTP等で手動アップロード**（GitHub Pages連携なし）。

- リポジトリのmainマージ ≠ 本番反映
- 本番反映は **明示指示があった時のみ実施**
- デプロイ手段が確立したらこのセクションを更新する

---

## 8. 禁止事項

- `--no-verify` でフックスキップ（明示指示時のみ可）
- `git config` の変更
- `.env` / 認証情報のコミット
- main / master への force push
- 他人のブランチへの push

---

## 9. Claude Code への指示

- ユーザーが「コミットして」「PR作って」と明示するまで実行しない。
- 不明点は推測せず質問する。
- 大きな変更は事前に方針を提示してから着手。
- セキュリティに関わる変更（入力処理、外部通信、認証）は必ず指摘する。

---

## 10. リポジトリ構成

```
.
├── blog-generator.user.js   # 拡張機能（Tampermonkey用 / Gemini連携）
├── editor-icons.html         # エディター（装飾ツール / 単体HTML）
├── README.md                 # 概要・インストール・使い方
├── SPEC.md                   # 仕様書
├── TROUBLESHOOTING.md        # 既知の問題と対処
├── CHANGELOG.md              # 変更履歴
└── CLAUDE.md                 # 本ファイル（運用ルール）
```

### 2つのツールの関係
1. **拡張機能（blog-generator.user.js）**: Geminiに記事を生成させ、HTMLとしてコピー
2. **エディター（editor-icons.html）**: コピーしたHTMLを貼り付けて装飾・整形

ユーザーは①→②の順で使うため、**両方の整合性を意識して改変**する。
