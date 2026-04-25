export function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function formatCurrency(value) {
  const amount = toNumber(value);
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2
  }).format(amount);
}

export function formatInteger(value) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(toNumber(value));
}

export function formatPercent(value) {
  const number = toNumber(value);
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
}

export function changeClass(value) {
  return toNumber(value) >= 0 ? 'positive' : 'negative';
}

export function fallbackText(value, fallback = '-') {
  return value === undefined || value === null || value === '' ? fallback : String(value);
}
