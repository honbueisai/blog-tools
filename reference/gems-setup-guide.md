# 英才ブログ用Gem 作成手順

## 作るGem
2つ作成します。

1. 英才ブログHTML生成
2. 英才ブログサムネイル生成

## 1. 英才ブログHTML生成Gem

### 目的
BROGTESTから送られた入力情報をもとに、ブログ本文HTMLとCTA_DATAを作成するGemです。

CTA_DATAは最終記事にそのまま貼るための文章ではなく、BROGTESTが読み取って整形済みCTA HTMLに変換するための素材です。

### 作成手順
1. Geminiを開く
2. 左側のGemsから新しいGemを作成
3. Gem名を `英才ブログHTML生成` にする
4. Instructionsに `reference/gem-blog-html-instructions.md` の内容を貼る
5. 保存する
6. 共有URLを取得する

## 2. 英才ブログサムネイル生成Gem

### 目的
ブログ本文や入力情報をもとに、ブログ用サムネイル画像を生成するGemです。

### 作成手順
1. Geminiを開く
2. 左側のGemsから新しいGemを作成
3. Gem名を `英才ブログサムネイル生成` にする
4. Instructionsに `reference/gem-thumbnail-instructions.md` の内容を貼る
5. 保存する
6. 共有URLを取得する

## BROGTESTとのつなぎ方
BROGTESTには以下の2つのGem URLを設定します。

- ブログHTML生成Gem URL: https://gemini.google.com/gem/1IcERsiUCgrBSktbOY6SjAxIcc7-ry7rf?usp=sharing
- サムネイル生成Gem URL: https://gemini.google.com/gem/1CghC28sQu1ViOe9E4TgfC5LGGj23pPTQ?usp=sharing

室長の操作は以下になります。

1. BROGTESTを開く
2. `ブログ生成Gemを開く` を押す
3. フォームに入力
4. `Geminiへ送信して記事生成` を押す
5. BROGTESTがGemの出力からCTA_DATAを読み取り、整形済みCTA付きHTMLをコピー
6. `サムネイル生成Gemを開く` を押す
7. サムネイル生成へ進む

## 運用上の注意
- 室長がGemを自分で作る必要はありません。
- 本部で作成したGemを共有します。
- GemのInstructionsを更新した場合は、共有先で反映されるか必ずテストしてください。
- Gem URLが変わった場合は、BROGTEST側の設定も更新します。
