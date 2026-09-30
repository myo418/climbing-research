#!/usr/bin/env node
// 動画・音声ファイルをローカルの whisper.cpp で文字起こしする。
// 使い方: node scripts/transcribe.mjs <入力ファイル> [出力ディレクトリ]
// 出力: <出力ディレクトリ>/<ベース名>.txt / .srt / .vtt

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { basename, extname, join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';

const MODEL = join(process.env.HOME, '.local/share/whisper-models/ggml-large-v3-turbo.bin');
// VADモデル。無音区間を除いてから認識させないと、同じ行を数百回繰り返す
// ループ誤認識が起きる（large-v3-turbo で実際に発生した）。
const VAD_MODEL = join(process.env.HOME, '.local/share/whisper-models/ggml-silero-v5.1.2.bin');
const LANG = process.env.WHISPER_LANG || 'ja';

const [, , inputArg, outDirArg] = process.argv;
if (!inputArg) {
  console.error('使い方: node scripts/transcribe.mjs <入力ファイル> [出力ディレクトリ]');
  process.exit(1);
}

const input = resolve(inputArg);
if (!existsSync(input)) {
  console.error(`ファイルが見つかりません: ${input}`);
  process.exit(1);
}
if (!existsSync(MODEL)) {
  console.error(`モデルが見つかりません: ${MODEL}`);
  console.error('curl -L -o "$MODEL" https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin');
  process.exit(1);
}
if (!existsSync(VAD_MODEL)) {
  console.error(`VADモデルが見つかりません: ${VAD_MODEL}`);
  console.error(`curl -L -o "${VAD_MODEL}" https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin`);
  process.exit(1);
}

const stem = basename(input, extname(input));
const outDir = resolve(outDirArg || dirname(input));
mkdirSync(outDir, { recursive: true });

const work = mkdtempSync(join(tmpdir(), 'transcribe-'));
const wav = join(work, `${stem}.wav`);

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) {
    rmSync(work, { recursive: true, force: true });
    console.error(`\n${cmd} が失敗しました (exit ${r.status})`);
    process.exit(r.status ?? 1);
  }
};

console.log(`[1/2] 音声を抽出: ${input}`);
run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);

console.log(`[2/2] 文字起こし (lang=${LANG})`);
run('whisper-cli', [
  '-m', MODEL,
  '-f', wav,
  '-l', LANG,
  '--vad', '-vm', VAD_MODEL,
  '-vsd', '300',   // 300ms以上の無音でセグメントを切る
  '-vp', '200',    // 発話の前後に200msの余白
  '-et', '2.8',    // エントロピー閾値を上げてループ出力を弾く
  '-otxt', '-osrt', '-ovtt',
  '-of', join(outDir, stem),
  '-pp',
]);

rmSync(work, { recursive: true, force: true });
console.log(`\n完了:\n  ${join(outDir, stem)}.txt\n  ${join(outDir, stem)}.srt\n  ${join(outDir, stem)}.vtt`);
