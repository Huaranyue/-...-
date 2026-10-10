const STAKES = [10, 50, 100];

export const CASINO_GAMES = [
  {
    id: 'blackjack', name: '21点', economic: true, stakes: [...STAKES],
    rules: '与一位系统模拟玩家比点数。A计1或11点，J/Q/K计10点；对手到17点停牌。普通胜利返还下注的2倍，起手21点胜利返还2.5倍，平局返还本金，失败不返还。双方起手21点为平局；起手21点胜过后续凑成的21点。无加注。',
  },
  {
    id: 'doudizhu', name: '斗地主', economic: true, stakes: [...STAKES],
    rules: '你固定担任地主，与两位系统模拟玩家对局。支持单张、对子、三张、三带一/对、顺子、连对、飞机及单/对翅膀、四带二单/两对、炸弹和王炸。2和王不能进入顺子、连对或飞机主干。飞机单翅可用对子拆作单张，翅膀不能与主干同点数。先出完手牌者获胜。三人各投入同档筹码；你胜利返还3倍下注，失败不返还。炸弹不加注，最多损失本局下注。',
  },
  {
    id: 'slots', name: '老虎机', economic: false, stakes: [...STAKES],
    rules: '三个转轮各自等概率抽取六种图案。三同返还8倍下注，概率1/36；恰好两同返还本金，概率5/12；三个不同不返还，概率5/9。结算金额已含返还本金。',
  },
  {
    id: 'lottery', name: '彩票', economic: false, stakes: [...STAKES],
    rules: '自动取得000至999的随机号码，再独立开奖。三位全中返还100倍下注，概率0.1%；仅末两位相同返还10倍，概率0.9%；仅末位相同返还2倍，概率9%；未中不返还，概率90%。奖项不叠加，结算金额已含返还本金。',
  },
];

const SUITS = [['S', '♠'], ['H', '♥'], ['C', '♣'], ['D', '♦']];
const RANK_LABELS = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2', 16: '小王', 17: '大王' };
const SLOT_SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '💎', '7'];
const COMBO_NAMES = {
  single: '单张', pair: '对子', triple: '三张', 'triple-single': '三带一',
  'triple-pair': '三带一对', straight: '顺子', 'pair-straight': '连对',
  airplane: '飞机', 'airplane-single': '飞机带单翅', 'airplane-pair': '飞机带对翅',
  'four-single': '四带二单', 'four-pair': '四带两对', bomb: '炸弹', rocket: '王炸',
};

function random(rng) {
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('随机数必须在0至1之间。');
  return value;
}

function deck(withJokers = false) {
  const cards = SUITS.flatMap(([suit, symbol]) => Array.from({ length: 13 }, (_, index) => {
    const rank = index + 3;
    return { id: `${suit}${rank}`, rank, label: `${symbol}${RANK_LABELS[rank] || rank}` };
  }));
  if (withJokers) cards.push({ id: 'J16', rank: 16, label: '小王' }, { id: 'J17', rank: 17, label: '大王' });
  return cards;
}

function shuffle(cards, rng) {
  for (let index = cards.length - 1; index > 0; index--) {
    const swap = Math.floor(random(rng) * (index + 1));
    [cards[index], cards[swap]] = [cards[swap], cards[index]];
  }
  return cards;
}

function sortCards(cards) {
  return [...cards].sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
}

function groups(cards) {
  const byRank = new Map();
  for (const card of sortCards(cards)) {
    if (!byRank.has(card.rank)) byRank.set(card.rank, []);
    byRank.get(card.rank).push(card);
  }
  return byRank;
}

function consecutive(ranks) {
  return ranks.length > 0 && ranks.at(-1) <= 14 && ranks.every((rank, index) => index === 0 || rank === ranks[index - 1] + 1);
}

function combo(kind, count, high, span = 1) {
  return { kind, count, high, span, name: COMBO_NAMES[kind] };
}

function combinations(cards) {
  if (!Array.isArray(cards) || cards.length === 0 || cards.some(card => !Number.isInteger(card.rank) || card.rank < 3 || card.rank > 17)) return [];
  const byRank = groups(cards);
  if ([...byRank].some(([rank, same]) => same.length > (rank >= 16 ? 1 : 4))) return [];
  const ranks = [...byRank.keys()];
  const counts = [...byRank.values()].map(same => same.length);
  const count = cards.length;
  const out = [];
  if (count === 1) out.push(combo('single', count, ranks[0]));
  if (count === 2 && ranks.length === 1) out.push(combo('pair', count, ranks[0]));
  if (count === 2 && ranks[0] === 16 && ranks[1] === 17) out.push(combo('rocket', count, 17));
  if (count === 3 && ranks.length === 1) out.push(combo('triple', count, ranks[0]));
  if (count === 4 && ranks.length === 1) out.push(combo('bomb', count, ranks[0]));
  const triple = ranks.find(rank => byRank.get(rank).length === 3);
  if (count === 4 && triple !== undefined) out.push(combo('triple-single', count, triple));
  if (count === 5 && triple !== undefined && counts.includes(2)) out.push(combo('triple-pair', count, triple));
  if (count >= 5 && counts.every(size => size === 1) && consecutive(ranks)) out.push(combo('straight', count, ranks.at(-1), count));
  if (count >= 6 && count % 2 === 0 && counts.every(size => size === 2) && consecutive(ranks)) out.push(combo('pair-straight', count, ranks.at(-1), count / 2));
  if (count >= 6 && count % 3 === 0 && counts.every(size => size === 3) && consecutive(ranks)) out.push(combo('airplane', count, ranks.at(-1), count / 3));
  for (const [kind, unit] of [['airplane-single', 4], ['airplane-pair', 5]]) {
    if (count % unit !== 0 || count / unit < 2) continue;
    const span = count / unit;
    for (let start = 3; start + span - 1 <= 14; start++) {
      const main = Array.from({ length: span }, (_, index) => start + index);
      if (!main.every(rank => byRank.get(rank)?.length === 3)) continue;
      const wings = [...byRank].filter(([rank]) => !main.includes(rank));
      const valid = kind === 'airplane-single'
        ? wings.reduce((sum, [, same]) => sum + same.length, 0) === span
        : wings.length === span && wings.every(([, same]) => same.length === 2);
      if (valid) out.push(combo(kind, count, main.at(-1), span));
    }
  }
  for (const rank of ranks.filter(value => byRank.get(value).length === 4)) {
    const wings = [...byRank].filter(([value]) => value !== rank);
    if (count === 6) out.push(combo('four-single', count, rank));
    if (count === 8 && wings.length === 2 && wings.every(([, same]) => same.length === 2)) out.push(combo('four-pair', count, rank));
  }
  return out;
}

export function classifyCombination(cards, expected = null) {
  const options = combinations(cards);
  if (expected) return options.filter(value => value.kind === expected.kind && value.count === expected.count && value.span === expected.span).sort((a, b) => b.high - a.high)[0] || null;
  return options[0] || null;
}

export function beatsCombination(candidate, previous) {
  if (!candidate) return false;
  if (!previous) return true;
  if (previous.kind === 'rocket') return false;
  if (candidate.kind === 'rocket') return true;
  if (candidate.kind === 'bomb' && previous.kind !== 'bomb') return true;
  return candidate.kind === previous.kind && candidate.count === previous.count && candidate.span === previous.span && candidate.high > previous.high;
}

function blackjackValue(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === 14) { total += 11; aces++; }
    else total += card.rank === 15 ? 2 : Math.min(card.rank, 10);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function finish(game, multiplier, text) {
  game.stage = 'done';
  game.payout = Math.round(game.stake * multiplier);
  game.resultText = `${text}；下注${game.stake}筹码，返还${game.payout}筹码，净${game.payout - game.stake >= 0 ? '得' : '失'}${Math.abs(game.payout - game.stake)}筹码。`;
  game.log.push(game.resultText);
}

function settleBlackjack(game) {
  const own = blackjackValue(game.hand);
  const opponent = blackjackValue(game.opponent);
  if (own > 21) finish(game, 0, `你爆牌（${own}点）`);
  else if (opponent > 21) finish(game, 2, `对手玩家爆牌（${opponent}点），你获胜`);
  else if (own === opponent) finish(game, 1, `双方${own}点，平局`);
  else if (own > opponent) finish(game, 2, `你${own}点，对手玩家${opponent}点，你获胜`);
  else finish(game, 0, `你${own}点，对手玩家${opponent}点，你落败`);
}

function botCandidates(hand, target = null) {
  const byRank = groups(hand);
  const out = new Map();
  function add(cards) {
    if (!cards.length) return;
    const combination = classifyCombination(cards, target) || classifyCombination(cards);
    if (!combination || (target && !beatsCombination(combination, target))) return;
    out.set(cards.map(card => card.id).sort().join(','), { cards, combination });
  }
  for (const [rank, same] of byRank) {
    add(same.slice(0, 1));
    if (same.length >= 2) add(same.slice(0, 2));
    if (same.length >= 3) {
      add(same.slice(0, 3));
      for (const [wingRank, wing] of byRank) {
        if (wingRank === rank) continue;
        add([...same.slice(0, 3), wing[0]]);
        if (wing.length >= 2) add([...same.slice(0, 3), ...wing.slice(0, 2)]);
      }
    }
    if (same.length === 4) {
      add(same);
      const remaining = sortCards(hand.filter(card => card.rank !== rank));
      if (remaining.length >= 2) add([...same, ...remaining.slice(0, 2)]);
      const pairs = [...byRank].filter(([wingRank, wing]) => wingRank !== rank && wing.length >= 2).map(([, wing]) => wing.slice(0, 2));
      if (pairs.length >= 2) add([...same, ...pairs[0], ...pairs[1]]);
    }
  }
  if (byRank.has(16) && byRank.has(17)) add([byRank.get(16)[0], byRank.get(17)[0]]);
  for (const [size, minimum] of [[1, 5], [2, 3], [3, 2]]) {
    for (let start = 3; start <= 14; start++) {
      const main = [];
      const mainRanks = [];
      for (let rank = start; rank <= 14 && byRank.get(rank)?.length >= size; rank++) {
        main.push(...byRank.get(rank).slice(0, size));
        mainRanks.push(rank);
        if (mainRanks.length < minimum) continue;
        add([...main]);
        if (size !== 3) continue;
        const remaining = sortCards(hand.filter(card => !mainRanks.includes(card.rank)));
        if (remaining.length >= mainRanks.length) add([...main, ...remaining.slice(0, mainRanks.length)]);
        const pairs = [...byRank].filter(([wingRank, wing]) => !mainRanks.includes(wingRank) && wing.length >= 2).map(([, wing]) => wing.slice(0, 2));
        if (pairs.length >= mainRanks.length) add([...main, ...pairs.slice(0, mainRanks.length).flat()]);
      }
    }
  }
  return [...out.values()];
}

function playerName(player) {
  return ['你（地主）', '对手玩家甲（农民）', '对手玩家乙（农民）'][player];
}

function applyDouDizhuAction(game, player, action) {
  if (action.type === 'pass') {
    if (!game.lastPlay || game.lastPlay.player === player) throw new Error('新一轮必须出牌，不能跳过。');
    game.log.push(`${playerName(player)}：不出。`);
    game.passes++;
    if (game.passes === 2) {
      game.turn = game.lastPlay.player;
      game.lastPlay = null;
      game.passes = 0;
      return;
    }
  } else if (action.type === 'play') {
    if (!Array.isArray(action.cards) || !action.cards.length) throw new Error('请先选择要出的牌。');
    if (new Set(action.cards).size !== action.cards.length) throw new Error('同一张牌不能重复选择。');
    const selected = action.cards.map(id => game.hands[player].find(card => card.id === id));
    if (selected.some(card => !card)) throw new Error('所选牌不在你的手牌中。');
    const previous = game.lastPlay?.combo || null;
    const combination = classifyCombination(selected, previous) || classifyCombination(selected);
    if (!combination) throw new Error('这些牌不能组成有效牌型。');
    if (!beatsCombination(combination, previous)) throw new Error('本次出牌必须与上一手牌型和张数相同且更大，或使用炸弹、王炸。');
    game.hands[player] = game.hands[player].filter(card => !action.cards.includes(card.id));
    const ordered = sortCards(selected);
    game.lastPlay = { player, combo: combination, cards: ordered };
    game.passes = 0;
    game.log.push(`${playerName(player)}：${ordered.map(card => card.label).join(' ')}（${combination.name}）。`);
    if (game.hands[player].length === 0) {
      game.winner = player;
      finish(game, player === 0 ? 3 : 0, player === 0 ? '你先出完手牌，地主获胜' : `${playerName(player)}先出完手牌，农民获胜`);
      return;
    }
  } else throw new Error('请选择出牌或不出。');
  game.turn = (player + 1) % 3;
}

function runBots(game) {
  let steps = 0;
  while (game.stage === 'playing' && game.turn !== 0) {
    if (++steps > 200) throw new Error('对局未能继续，请重新载入保存的窗口。');
    const player = game.turn;
    const target = game.lastPlay?.combo || null;
    const choices = botCandidates(game.hands[player], target);
    choices.sort((a, b) => {
      if (target) return (a.combination.kind === 'rocket' ? 2 : a.combination.kind === 'bomb' ? 1 : 0) - (b.combination.kind === 'rocket' ? 2 : b.combination.kind === 'bomb' ? 1 : 0) || a.combination.high - b.combination.high;
      return b.cards.length - a.cards.length || a.combination.high - b.combination.high;
    });
    if (choices.length) applyDouDizhuAction(game, player, { type: 'play', cards: choices[0].cards.map(card => card.id) });
    else applyDouDizhuAction(game, player, { type: 'pass' });
  }
}

export function startGame(id, stake, rng = Math.random) {
  const spec = CASINO_GAMES.find(game => game.id === id);
  if (!spec) throw new Error('未找到这个赌场游戏。');
  if (!Number.isInteger(stake) || !spec.stakes.includes(stake)) throw new Error('请选择10、50或100筹码的固定档位。');
  const game = { version: 1, id, type: id, stake, economic: spec.economic, stage: 'playing', payout: 0, resultText: '', log: [] };
  if (id === 'blackjack') {
    game.deck = shuffle(deck(), rng);
    game.hand = [game.deck.pop(), game.deck.pop()];
    game.opponent = [game.deck.pop(), game.deck.pop()];
    game.log.push('你与对手玩家各投入本档筹码；可以要牌或停牌。');
    const ownNatural = blackjackValue(game.hand) === 21;
    const opponentNatural = blackjackValue(game.opponent) === 21;
    if (ownNatural && opponentNatural) finish(game, 1, '双方起手21点，平局');
    else if (ownNatural) finish(game, 2.5, '你起手21点，获胜');
    else if (opponentNatural) finish(game, 0, '对手玩家起手21点，你落败');
  } else if (id === 'doudizhu') {
    const cards = shuffle(deck(true), rng);
    game.hands = [[], [], []];
    for (let index = 0; index < 51; index++) game.hands[index % 3].push(cards[index]);
    game.bottom = cards.slice(51);
    game.hands[0].push(...game.bottom);
    game.hands = game.hands.map(sortCards);
    game.turn = 0;
    game.lastPlay = null;
    game.passes = 0;
    game.log.push(`你担任地主，获得三张底牌：${game.bottom.map(card => card.label).join(' ')}。三人各投入${stake}筹码，底池${stake * 3}筹码。`);
  } else if (id === 'slots') {
    game.reels = Array.from({ length: 3 }, () => SLOT_SYMBOLS[Math.floor(random(rng) * SLOT_SYMBOLS.length)]);
    const distinct = new Set(game.reels).size;
    finish(game, distinct === 1 ? 8 : distinct === 2 ? 1 : 0, `${game.reels.join(' | ')}：${distinct === 1 ? '三同奖' : distinct === 2 ? '两同，返还本金' : '未中奖'}`);
  } else {
    game.ticket = Math.floor(random(rng) * 1000).toString().padStart(3, '0');
    game.draw = Math.floor(random(rng) * 1000).toString().padStart(3, '0');
    const multiplier = game.ticket === game.draw ? 100 : game.ticket.slice(-2) === game.draw.slice(-2) ? 10 : game.ticket.slice(-1) === game.draw.slice(-1) ? 2 : 0;
    finish(game, multiplier, `彩票${game.ticket}，开奖${game.draw}：${multiplier === 100 ? '三位全中' : multiplier === 10 ? '末两位中奖' : multiplier === 2 ? '末位中奖' : '未中奖'}`);
  }
  return game;
}

export function actGame(original, action, rng = Math.random) {
  if (!original || !CASINO_GAMES.some(spec => spec.id === original.id)) throw new Error('对局数据无效。');
  if (original.stage !== 'playing') throw new Error('本局已经结束。');
  if (!action || typeof action.type !== 'string') throw new Error('请选择有效的游戏操作。');
  const game = JSON.parse(JSON.stringify(original));
  if (game.id === 'blackjack') {
    if (action.type === 'hit') {
      if (!game.deck.length) throw new Error('牌堆已用尽。');
      const card = game.deck.pop();
      game.hand.push(card);
      game.log.push(`你要牌：${card.label}，当前${blackjackValue(game.hand)}点。`);
      if (blackjackValue(game.hand) > 21) settleBlackjack(game);
    } else if (action.type === 'stand') {
      game.log.push(`你停牌：${blackjackValue(game.hand)}点。`);
      while (blackjackValue(game.opponent) < 17 && game.deck.length) {
        const card = game.deck.pop();
        game.opponent.push(card);
        game.log.push(`对手玩家要牌：${card.label}。`);
      }
      settleBlackjack(game);
    } else throw new Error('21点只能要牌或停牌。');
  } else if (game.id === 'doudizhu') {
    if (game.turn !== 0) throw new Error('请等待对手玩家出牌。');
    applyDouDizhuAction(game, 0, action);
    runBots(game);
  } else throw new Error('本局已自动开奖。');
  return game;
}

export function gameView(game) {
  const spec = CASINO_GAMES.find(item => item.id === game?.id);
  if (!spec) throw new Error('对局数据无效。');
  const lines = [`下注：${game.stake}筹码（${game.stake * 10}哈基币）`];
  let hand = [];
  let actions = [];
  if (game.id === 'blackjack') {
    hand = game.hand.map(({ id, label }) => ({ id, label }));
    lines.push(`你：${game.hand.map(card => card.label).join(' ')}，${blackjackValue(game.hand)}点`);
    lines.push(game.stage === 'done'
      ? `对手玩家：${game.opponent.map(card => card.label).join(' ')}，${blackjackValue(game.opponent)}点`
      : `对手玩家：${game.opponent[0].label} ＋ 暗牌`);
    if (game.stage === 'playing') actions = [{ id: 'hit', label: '要牌' }, { id: 'stand', label: '停牌' }];
  } else if (game.id === 'doudizhu') {
    hand = game.hands[0].map(({ id, label }) => ({ id, label }));
    lines.push(`你（地主）：${game.hands[0].length}张；对手玩家甲：${game.hands[1].length}张；对手玩家乙：${game.hands[2].length}张`);
    lines.push(`底牌：${game.bottom.map(card => card.label).join(' ')}；底池：${game.stake * 3}筹码`);
    lines.push(game.lastPlay ? `待跟牌：${playerName(game.lastPlay.player)}的${game.lastPlay.combo.name} ${game.lastPlay.cards.map(card => card.label).join(' ')}` : '新一轮，由你先出。');
    if (game.stage === 'playing') {
      actions = [{ id: 'play', label: '出牌' }];
      if (game.lastPlay && game.lastPlay.player !== 0) actions.push({ id: 'pass', label: '不出' });
    }
  } else if (game.id === 'slots') lines.push(game.reels.join(' | '));
  else lines.push(`你的号码：${game.ticket}；开奖：${game.draw}`);
  if (game.stage === 'done') lines.push(game.resultText);
  lines.push(...game.log.filter(line => line !== game.resultText).slice(-6));
  return { title: spec.name, lines, hand, actions, selectCards: game.id === 'doudizhu' && game.stage === 'playing' };
}
