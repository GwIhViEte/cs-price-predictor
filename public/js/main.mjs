import { getHotItems, getPriceData, getSalesData, predictPrice, searchItems } from './api.mjs';
import { renderSalesChart } from './chart.mjs';
import { createElement, hideNotice, scrollIntoView, setButtonBusy, showNotice } from './dom.mjs';
import { changeClass, fallbackText, formatCurrency, formatInteger, formatPercent } from './format.mjs';

const state = {
  currentItemData: null,
  currentItemId: null,
  currentSalesData: null,
  searchResults: []
};

const elements = {
  itemSearch: document.getElementById('itemSearch'),
  searchBtn: document.getElementById('searchBtn'),
  itemSelector: document.getElementById('itemSelector'),
  itemDropdown: document.getElementById('itemDropdown'),
  selectItemBtn: document.getElementById('selectItemBtn'),
  stateBanner: document.getElementById('stateBanner'),
  priceDataCard: document.getElementById('priceDataCard'),
  predictionCard: document.getElementById('predictionCard'),
  currentPrice: document.getElementById('currentPrice'),
  priceChange: document.getElementById('priceChange'),
  priceChart: document.getElementById('priceChart'),
  itemName: document.getElementById('itemName'),
  itemMeta: document.getElementById('itemMeta'),
  itemType: document.getElementById('itemType'),
  itemImage: document.getElementById('itemImage'),
  itemImageFrame: document.getElementById('itemImageFrame'),
  predictBtn: document.getElementById('predictBtn'),
  loadingSpinner: document.getElementById('loadingSpinner'),
  predictionResult: document.getElementById('predictionResult'),
  hotItems: document.getElementById('hotItems'),
  salesPlatformSelector: document.getElementById('salesPlatformSelector'),
  salesChartContainer: document.getElementById('salesChartContainer'),
  salesChart: document.getElementById('salesChart')
};

document.addEventListener('DOMContentLoaded', init);

function init() {
  elements.searchBtn.addEventListener('click', handleSearch);
  elements.selectItemBtn.addEventListener('click', handleItemSelect);
  elements.predictBtn.addEventListener('click', handlePredict);
  elements.salesPlatformSelector.addEventListener('change', handlePlatformChange);
  elements.itemSearch.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  });
  elements.itemDropdown.addEventListener('change', () => {
    elements.selectItemBtn.disabled = !elements.itemDropdown.value;
  });

  loadHotSeries();
}

async function handleSearch() {
  const searchTerm = elements.itemSearch.value.trim();
  if (!searchTerm) {
    showNotice(elements.stateBanner, '请输入饰品名称或关键词', 'warning');
    elements.itemSearch.focus();
    return;
  }

  try {
    hideNotice(elements.stateBanner);
    setButtonBusy(elements.searchBtn, true, '搜索中');
    const searchData = await searchItems(searchTerm);

    if (searchData.data?.length) {
      state.searchResults = searchData.data;
      renderItemSelector(state.searchResults);
      return;
    }

    hideItemSelector();
    showNotice(elements.stateBanner, '未找到相关饰品', 'warning');
  } catch (error) {
    hideItemSelector();
    showNotice(elements.stateBanner, `搜索失败: ${error.message}`, 'error');
  } finally {
    setButtonBusy(elements.searchBtn, false, '搜索');
  }
}

function renderItemSelector(items) {
  const placeholder = createElement('option', {
    text: '请选择具体饰品',
    attrs: { value: '' }
  });

  const options = items.map((item) =>
    createElement('option', {
      text: item.name,
      attrs: { value: item.id }
    })
  );

  elements.itemDropdown.replaceChildren(placeholder, ...options);
  elements.itemSelector.hidden = false;
  elements.selectItemBtn.disabled = true;
  elements.priceDataCard.hidden = true;
  elements.predictionCard.hidden = true;
  elements.salesChartContainer.hidden = true;
  scrollIntoView(elements.itemSelector);
}

function hideItemSelector() {
  elements.itemSelector.hidden = true;
}

async function handleItemSelect() {
  const selectedId = elements.itemDropdown.value;
  if (!selectedId) {
    showNotice(elements.stateBanner, '请选择一个饰品', 'warning');
    return;
  }

  try {
    hideNotice(elements.stateBanner);
    setButtonBusy(elements.selectItemBtn, true, '加载中');
    state.currentItemId = selectedId;
    await Promise.all([loadPriceData(selectedId), loadSalesData(selectedId)]);
  } catch (error) {
    showNotice(elements.stateBanner, `加载失败: ${error.message}`, 'error');
  } finally {
    setButtonBusy(elements.selectItemBtn, false, '查看价格');
    elements.selectItemBtn.disabled = !elements.itemDropdown.value;
  }
}

async function loadPriceData(itemId) {
  const data = await getPriceData(itemId);
  state.currentItemData = data.data;
  renderPriceData(state.currentItemData);
}

async function loadSalesData(itemId) {
  try {
    const selectedPlatform = elements.salesPlatformSelector.value;
    const data = await getSalesData(itemId, selectedPlatform);
    state.currentSalesData = data;

    const selectedPlatformText =
      elements.salesPlatformSelector.options[elements.salesPlatformSelector.selectedIndex].text;

    renderSalesChart({
      data,
      container: elements.salesChartContainer,
      chartElement: elements.salesChart,
      selectedPlatformText
    });
  } catch (error) {
    elements.salesChartContainer.hidden = true;
    showNotice(elements.stateBanner, `供需图表暂时不可用: ${error.message}`, 'warning');
  }
}

function renderPriceData(data) {
  const itemInfo = data?.data?.goods_info;
  if (!itemInfo) {
    showNotice(elements.stateBanner, '价格数据格式异常', 'error');
    return;
  }

  elements.itemName.textContent = itemInfo.market_hash_name || itemInfo.name || '未命名饰品';
  elements.itemMeta.textContent = [
    itemInfo.name,
    itemInfo.exterior_localized_name,
    itemInfo.rarity_localized_name,
    itemInfo.updated_at ? `更新于 ${new Date(itemInfo.updated_at).toLocaleString('zh-CN')}` : null
  ]
    .filter(Boolean)
    .join(' · ');
  elements.itemType.textContent = itemInfo.type_localized_name || 'Selected asset';

  if (itemInfo.img) {
    elements.itemImage.src = itemInfo.img;
    elements.itemImage.alt = itemInfo.market_hash_name || itemInfo.name || '饰品图片';
    elements.itemImageFrame.hidden = false;
  } else {
    elements.itemImage.removeAttribute('src');
    elements.itemImage.alt = '';
    elements.itemImageFrame.hidden = true;
  }

  elements.currentPrice.textContent = formatCurrency(itemInfo.buff_sell_price);
  const change = itemInfo.sell_price_rate_7 || 0;
  elements.priceChange.textContent = formatPercent(change);
  elements.priceChange.className = `change ${changeClass(change)}`;

  renderMetricGrid(itemInfo);
  elements.priceDataCard.hidden = false;
  elements.predictionCard.hidden = false;
  elements.predictionResult.hidden = true;
  elements.predictionResult.textContent = '';
  scrollIntoView(elements.priceDataCard);
}

function renderMetricGrid(itemInfo) {
  const trendPanel = createMetricPanel('价格趋势', [
    ['1天', formatPercent(itemInfo.sell_price_rate_1), changeClass(itemInfo.sell_price_rate_1)],
    ['7天', formatPercent(itemInfo.sell_price_rate_7), changeClass(itemInfo.sell_price_rate_7)],
    ['30天', formatPercent(itemInfo.sell_price_rate_30), changeClass(itemInfo.sell_price_rate_30)],
    ['180天', formatPercent(itemInfo.sell_price_rate_180), changeClass(itemInfo.sell_price_rate_180)]
  ]);

  const pricePanel = createMetricPanel('平台价格', [
    ['BUFF', formatCurrency(itemInfo.buff_sell_price)],
    ['悠悠有品', formatCurrency(itemInfo.yyyp_sell_price)],
    ['Steam', formatCurrency(itemInfo.steam_sell_price)]
  ]);

  const supplyPanel = createMetricPanel('供给快照', [
    ['BUFF在售', formatInteger(itemInfo.buff_sell_num)],
    ['悠悠有品在售', formatInteger(itemInfo.yyyp_sell_num)],
    ['Steam在售', formatInteger(itemInfo.steam_sell_num)],
    ['Steam日成交', formatInteger(itemInfo.turnover_number)]
  ]);

  const profilePanel = createMetricPanel('资产信息', [
    ['品质', fallbackText(itemInfo.rarity_localized_name)],
    ['类别', fallbackText(itemInfo.quality_localized_name)],
    ['存世量', formatInteger(itemInfo.statistic)],
    ['所属类型', fallbackText(itemInfo.group_hash_name)]
  ]);

  elements.priceChart.replaceChildren(trendPanel, pricePanel, supplyPanel, profilePanel);
}

function createMetricPanel(title, rows) {
  const rowElements = rows.map(([label, value, tone]) =>
    createElement('div', { className: 'metric-row' }, [
      createElement('span', { text: label }),
      createElement('strong', { className: tone || '', text: value })
    ])
  );

  return createElement('section', { className: 'metric-panel' }, [
    createElement('h3', { text: title }),
    ...rowElements
  ]);
}

async function handlePlatformChange() {
  if (state.currentItemId) {
    await loadSalesData(state.currentItemId);
  }
}

async function handlePredict() {
  if (!state.currentItemData) {
    showNotice(elements.stateBanner, '请先搜索并选择饰品', 'warning');
    return;
  }

  try {
    setButtonBusy(elements.predictBtn, true, '预测中');
    elements.loadingSpinner.hidden = false;
    elements.predictionResult.hidden = true;
    elements.predictionResult.textContent = '';

    const data = await predictPrice({
      priceData: state.currentItemData,
      itemName: elements.itemSearch.value,
      salesData: state.currentSalesData
    });

    elements.predictionResult.textContent = data.prediction;
    elements.predictionResult.hidden = false;
  } catch (error) {
    elements.predictionResult.textContent = `预测失败: ${error.message}`;
    elements.predictionResult.hidden = false;
  } finally {
    setButtonBusy(elements.predictBtn, false, '开始预测');
    elements.loadingSpinner.hidden = true;
  }
}

async function loadHotSeries() {
  elements.hotItems.replaceChildren(createElement('p', { className: 'muted-state', text: '正在加载热门系列' }));

  try {
    const data = await getHotItems();
    renderHotItems(data.data || []);
  } catch (error) {
    elements.hotItems.replaceChildren(
      createElement('p', { className: 'muted-state error-text', text: `热门系列加载失败: ${error.message}` })
    );
  }
}

function renderHotItems(items) {
  if (!items.length) {
    elements.hotItems.replaceChildren(createElement('p', { className: 'muted-state', text: '暂无热门系列数据' }));
    return;
  }

  const cards = items.slice(0, 10).map((item) => {
    const avgChange = item.sell_price_7 || 0;
    const card = createElement('button', { className: 'item-card', attrs: { type: 'button' } }, [
      createElement('span', { className: 'series-rank', text: String(item.key || item.id || '') }),
      createElement('strong', { text: item.name }),
      createElement('span', { text: `系列总值 ${formatCurrency(item.total_value)}` }),
      createElement('small', {
        className: changeClass(avgChange),
        text: `7日 ${formatPercent(avgChange)}`
      })
    ]);

    card.addEventListener('click', () => {
      elements.itemSearch.value = item.name;
      handleSearch();
    });

    return card;
  });

  elements.hotItems.replaceChildren(...cards);
}
