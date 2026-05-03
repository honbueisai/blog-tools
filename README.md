# 英才ブログ生成ツール

英才個別学院のブログ記事とサムネイル画像を作成するためのツールです。

このリポジトリには、以下の2つのツールが入っています。

- `blog-generator.user.js`
  Gemini上で動くブログ生成用のTampermonkeyスクリプト
- `editor-icons.html`
  生成したHTMLを貼り付けて、見出し・マーカー・CTAなどを整える装飾ツール

---

## 社員・室長向けマニュアル

目的に合わせて、以下のどちらかを見てください。

### 1. 初回準備をする人

[インストール〜簡易マニュアル](INSTALL_MANUAL.md)

Chrome、Tampermonkey、ブログ生成ツール、装飾ツールの準備方法をまとめています。

### 2. 実際にブログを作る人

[操作マニュアル](OPERATION_MANUAL.md)

Geminiでの記事生成、HTMLコピー、装飾ツール、写真挿入、サムネイル作成、ブログ管理画面への貼り付けまでをまとめています。

---

## 主な流れ

1. ChromeでGeminiを開く
2. ブログツールを開く
3. 教室情報を確認する
4. 記事タイプを選ぶ
5. 必要情報を入力する
6. Geminiへ送信して記事を作る
7. ブログHTMLをコピーする
8. 装飾ツールでデザインを適用する
9. 写真を差し込む
10. サムネイル画像を作る
11. ブログ管理画面へ貼り付ける

---

## インストールリンク

### Tampermonkey

https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo

### ブログ生成ツール

https://github.com/honbueisai/blog-tools/raw/refs/heads/main/blog-generator.user.js

### 装飾ツール

https://tools.eisai.org/blogs/editor-icons.html

---

## 管理者・開発者向け

開発・運用ルールは [AGENTS.md](AGENTS.md) を確認してください。

仕様は [SPEC.md](SPEC.md)、変更履歴は [CHANGELOG.md](CHANGELOG.md) に記録します。
