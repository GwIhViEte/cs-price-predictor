async function readJson(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || `请求失败 (${response.status})`);
  }

  return payload;
}

export async function searchItems(query) {
  return readJson(await fetch(`/api/search-item?query=${encodeURIComponent(query)}`));
}

export async function getPriceData(itemId) {
  return readJson(await fetch(`/api/price-data/${encodeURIComponent(itemId)}`));
}

export async function getSalesData(itemId, platform) {
  const params = new URLSearchParams({ platform });
  return readJson(await fetch(`/api/sales-data/${encodeURIComponent(itemId)}?${params}`));
}

export async function getHotItems() {
  return readJson(await fetch('/api/hot-items'));
}

export async function predictPrice({ priceData, itemName, salesData }) {
  return readJson(
    await fetch('/api/predict-price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceData, itemName, salesData })
    })
  );
}
