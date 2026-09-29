// v0.4.0: 入力モード（かんたん／しっかり）追加の確認用。
// buildBlogPromptV3 を3パターンで呼び、tests/prompts/*.txt に保存する。
// 使い方: node tests/gen-prompts.js
'use strict';

const fs = require('fs');
const path = require('path');
const { buildBlogPromptV3 } = require('../blog-generator-chatgpt.user.js');

const outDir = path.join(__dirname, 'prompts');
fs.mkdirSync(outDir, { recursive: true });

function writePrompt(filename, articleData, classroomInfo) {
  const prompt = buildBlogPromptV3(articleData, classroomInfo);
  const outPath = path.join(outDir, filename);
  fs.writeFileSync(outPath, prompt, 'utf8');
  return { outPath, chars: prompt.length };
}

const results = [];

// (a) かんたん・おまかせ・メモのみ（東大島校）
results.push(writePrompt('free-oozima.txt', {
  mode: 'easy',
  type: 'auto',
  memo: [
    '9/6にテスト前の無料対策会やった。マック大作戦。40人来た！前回32人だったから増えた',
    '二大島中3年のHくん 社会の暗記苦手→新里先生の説明でわかったって',
    '小松川二中3年Kちゃん 数学のワーク終わってなかったけど髙橋先生と全部終わらせた',
    '外部生の大島中1年Kちゃん 理科の化学 田村先生の解説で理解',
    '亀戸中3年の5人組 数学の応用 髙橋先生で全員わかった',
    '頑張った子にはマック。前回から続けて来た外部生もいた'
  ].join('\n')
}, {
  name: '東大島校',
  manager: '山田',
  url: 'https://www.eisai.org/free_trial/?school=103',
  line: 'https://lin.ee/mjiSS82'
}));

// (b) かんたん・おまかせ・もっと短いメモ（矢野口校）
results.push(writePrompt('free-short.txt', {
  mode: 'easy',
  type: 'auto',
  memo: '中3の夏期講習、毎日自習室が満席だった。数学の関数が苦手な子が多かったので講師が個別に解説。9月の実力テストに向けて週1で確認テスト予定。'
}, {
  name: '矢野口校',
  manager: '山田',
  url: 'https://www.eisai.org/free_trial/?school=13'
}));

// (c) しっかり・必須だけ（学年=中2、事実のみ／矢野口校）
results.push(writePrompt('detailed-min.txt', {
  mode: 'detailed',
  type: 'solve',
  grade: '中2',
  facts: '・前期期末は10/8〜10/10\n・テスト2週間前から土曜に自習会（13:00〜17:00）\n・理科の計算問題プリントを学年別に用意'
}, {
  name: '矢野口校',
  manager: '山田',
  url: 'https://www.eisai.org/free_trial/?school=13'
}));

console.log('生成結果:');
results.forEach(r => console.log(`- ${r.outPath} (${r.chars}文字)`));

// 確認：
// 1. 「◯◯」が出ないこと
// 2. 悩みが空欄なので「よく聞くお悩み」の引用指示（元の文言）は出ず、
//    「こんなお悩みはありませんか？」という問いかけ指示に切り替わっていること
console.log('\n検証:');
results.forEach(r => {
  const text = fs.readFileSync(r.outPath, 'utf8');
  const hasMaru = text.includes('◯◯');
  const hasOriginalQuoteInstruction = text.includes('悩みを3つ「よく聞くお悩み」としてセリフをそのまま引用して並べる');
  const hasQuestionInstruction = text.includes('こんなお悩みはありませんか？') && text.includes('という問いかけの形で並べる');
  console.log(`  ${path.basename(r.outPath)}: ◯◯を含む=${hasMaru} / 旧「よく聞く」引用指示が残っている=${hasOriginalQuoteInstruction} / 問いかけ指示あり=${hasQuestionInstruction}`);
});
