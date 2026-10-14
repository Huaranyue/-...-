export const HkmShopLimits = (() => {
  const integer = value => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
  const status = (item, games, purchases = {}) => {
    const rule = item?.purchaseLimit;
    if (!rule) return { remaining: 99, limited: false, refreshIn: 0 };
    const limit = integer(rule.quantity), period = integer(rule.refreshGames);
    const record = purchases[item.id];
    const elapsed = record ? integer(games) - integer(record.games) : period;
    const used = record && elapsed < period ? integer(record.quantity) : 0;
    return { remaining: Math.max(0, limit - used), limited: true, refreshIn: used ? Math.max(0, period - elapsed) : 0 };
  };
  const purchase = (item, quantity, games, purchases = {}) => {
    const amount = integer(quantity), offer = status(item, games, purchases);
    if (!amount || amount > offer.remaining) throw Error('该商品已达到限购数量。');
    if (!offer.limited) return { ...purchases };
    const limit = integer(item.purchaseLimit.quantity);
    return { ...purchases, [item.id]: { games: integer(games), quantity: limit - offer.remaining + amount } };
  };
  return { status, purchase };
})();
