// ClimberMbtiCard.astro の中身を動かす。
// 要素は全てコンポーネント側のテンプレートにある（Astro のスコープ付きCSSは
// JS で作った要素に当たらないため）。ここでやるのは中身の差し替えと状態の付け替えだけ。

import { axes, groups, types, typeIndex } from '../data/climber-mbti';

export interface CardHandle {
  /** 5軸の選択。0 が左の極、1 が右の極 */
  state: number[];
  /** 現在の state を画面に反映する */
  render(): void;
  /**
   * 診断結果として表示する。
   * scores を渡すとトレイトバーのマーカーが点数に比例した位置に出る
   */
  setResult(state: number[], scores: number[] | null, label?: string): void;
  /** 「例」の表示に戻す */
  reset(label?: string): void;
}

export function initCard(initial: number[] = [0, 1, 1, 0, 0]): CardHandle {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  const card = document.getElementById('cm-card') as HTMLElement;
  const groupEl = document.getElementById('cm-group') as HTMLElement;
  const codeSlots = document.querySelectorAll<HTMLElement>('#cm-code span');
  const nameEl = document.getElementById('cm-name') as HTMLElement;
  const enEl = document.getElementById('cm-en') as HTMLElement;
  const lettersEl = document.getElementById('cm-letters') as HTMLElement;
  const wordsEl = document.getElementById('cm-words') as HTMLElement;
  const bodyEl = document.getElementById('cm-body') as HTMLElement;
  const cardArt = document.getElementById('cm-card-art') as HTMLImageElement;
  const variantLabel = document.getElementById('cm-variant-label') as HTMLElement;
  const variantText = document.getElementById('cm-variant-text') as HTMLElement;
  const stateLabel = document.getElementById('cm-state-label') as HTMLElement;
  const traitRows = document.querySelectorAll<HTMLElement>('.cm-trait');

  const state = [...initial];
  let scores: number[] | null = null;

  // 絵は public/climber-mbti/<pattern>/ に lineart と poly の2種類あるが、
  // ページに出すのは poly だけ（線画版は作り直すまで寝かせる）
  const artSrc = (slug: string) => `${base}/climber-mbti/poly/${slug}.webp`;

  function render() {
    const g = groups.find((x) => x.ground === state[2] && x.commitment === state[3]) ?? groups[0];
    const t = types[typeIndex(state[0], state[1], state[2], state[3])];

    card.style.setProperty('--tape', g.tape);
    groupEl.textContent = `${g.jp} ${g.en}`;

    codeSlots.forEach((slot, i) => {
      slot.textContent = axes[i].poles[state[i]].kanji;
    });

    nameEl.textContent = t.jp;
    enEl.textContent = t.en;
    cardArt.dataset.slug = t.slug;
    cardArt.src = artSrc(t.slug);
    cardArt.alt = t.jp;
    const ls = axes.map((a, i) => a.poles[state[i]].letter);
    lettersEl.textContent = `${ls.slice(0, 4).join('')}-${ls[4]}`;
    wordsEl.textContent = axes.map((a, i) => a.poles[state[i]].word).join(' · ');
    bodyEl.textContent = t.body;
    variantLabel.textContent = state[4] === 0 ? '感 Feel' : '理 Logic';
    variantText.textContent = state[4] === 0 ? t.feel : t.logic;

    traitRows.forEach((row, i) => {
      row.style.setProperty('--tape', g.tape);
      // 診断後は点数に比例した位置に置く。ぎりぎりの人と振り切った人を見分けられるように
      let pos = state[i] === 0 ? 8 : 92;
      if (scores) {
        const max = 12; // 1軸6問 × ±2
        pos = 50 + (scores[i] / max) * 42;
      }
      (row.querySelector('.cm-thumb') as HTMLElement).style.left = `${pos}%`;
      row.querySelectorAll('.cm-side').forEach((btn, j) => {
        btn.setAttribute('aria-pressed', String(state[i] === j));
      });
    });

    const stem = axes
      .slice(0, 4)
      .map((a, i) => a.poles[state[i]].kanji)
      .join('');
    document.querySelectorAll<HTMLElement>('.cm-type-code').forEach((btn) => {
      btn.setAttribute('aria-current', String(btn.dataset.stem === stem));
    });
  }

  // トレイトバーを手で押したら比例表示は解除する（点数と表示が食い違わないように）
  document.querySelectorAll<HTMLElement>('.cm-side').forEach((btn) => {
    btn.addEventListener('click', () => {
      state[Number(btn.dataset.axis)] = Number(btn.dataset.pole);
      scores = null;
      if (stateLabel) stateLabel.textContent = '例';
      render();
    });
  });

  // 16タイプ一覧のコードを押したらカードに反映する（情報ページ）
  document.querySelectorAll<HTMLElement>('.cm-type-code').forEach((btn) => {
    btn.addEventListener('click', () => {
      const stem = btn.dataset.stem as string;
      axes.slice(0, 4).forEach((axis, i) => {
        state[i] = axis.poles[0].kanji === stem[i] ? 0 : 1;
      });
      scores = null;
      if (stateLabel) stateLabel.textContent = '例';
      render();
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  render();

  return {
    state,
    render,
    setResult(next, nextScores, label = 'あなたのタイプ') {
      next.forEach((v, i) => {
        state[i] = v;
      });
      scores = nextScores;
      if (stateLabel) stateLabel.textContent = label;
      render();
    },
    reset(label = '例') {
      scores = null;
      if (stateLabel) stateLabel.textContent = label;
      render();
    },
  };
}
