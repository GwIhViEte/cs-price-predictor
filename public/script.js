// 全局变量
let currentItemData = null;
let currentItemId = null;
let currentSalesData = null;
let searchResults = [];
let salesChartInstance = null;

// DOM元素
const itemSearch = document.getElementById('itemSearch');
const searchBtn = document.getElementById('searchBtn');
const itemSelector = document.getElementById('itemSelector');
const itemDropdown = document.getElementById('itemDropdown');
const selectItemBtn = document.getElementById('selectItemBtn');
const priceDataCard = document.getElementById('priceDataCard');
const predictionCard = document.getElementById('predictionCard');
const currentPrice = document.getElementById('currentPrice');
const priceChange = document.getElementById('priceChange');
const predictBtn = document.getElementById('predictBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const predictionResult = document.getElementById('predictionResult');
const hotItems = document.getElementById('hotItems');
const salesPlatformSelector = document.getElementById('salesPlatformSelector');
const salesChartContainer = document.getElementById('salesChartContainer');

// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
    loadHotItems();

    // 绑定事件监听器
    searchBtn.addEventListener('click', handleSearch);
    selectItemBtn.addEventListener('click', handleItemSelect);
    predictBtn.addEventListener('click', handlePredict);
    salesPlatformSelector.addEventListener('change', handlePlatformChange);

    itemSearch.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });
    itemDropdown.addEventListener('change', () => { selectItemBtn.disabled = !itemDropdown.value; });
});

// 处理平台选择变化
function handlePlatformChange() {
    if (currentItemId) {
        loadSalesData(currentItemId);
    }
}

// 搜索功能
async function handleSearch() {
    const searchTerm = itemSearch.value.trim();
    if (!searchTerm) return alert('请输入饰品名称或ID');

    try {
        searchBtn.disabled = true;
        searchBtn.textContent = '🔍 搜索中...';
        const response = await fetch(`/api/search-item?query=${encodeURIComponent(searchTerm)}`);
        const searchData = await response.json();
        if (!searchData.success) throw new Error(searchData.error || '搜索失败');
        if (searchData.data && searchData.data.length > 0) {
            searchResults = searchData.data;
            displayItemSelector(searchResults);
        } else {
            alert('未找到相关饰品');
            hideItemSelector();
        }
    } catch (error) {
        console.error('搜索错误:', error);
        alert('搜索失败: ' + error.message);
        hideItemSelector();
    } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = '🔍 搜索';
    }
}

// 显示饰品选择器
function displayItemSelector(items) {
    itemDropdown.innerHTML = '<option value="">请选择具体饰品...</option>';
    items.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        itemDropdown.appendChild(option);
    });
    itemSelector.style.display = 'block';
    priceDataCard.style.display = 'none';
    predictionCard.style.display = 'none';
    salesChartContainer.style.display = 'none';
    selectItemBtn.disabled = true;
    itemSelector.scrollIntoView({ behavior: 'smooth' });
}

// 隐藏饰品选择器
function hideItemSelector() {
    itemSelector.style.display = 'none';
}

// 处理饰品选择
async function handleItemSelect() {
    const selectedId = itemDropdown.value;
    if (!selectedId) return alert('请选择一个饰品');

    try {
        selectItemBtn.disabled = true;
        selectItemBtn.textContent = '📊 加载中...';
        currentItemId = selectedId;
        await Promise.all([
            loadPriceData(selectedId),
            loadSalesData(selectedId)
        ]);
    } catch (error) {
        console.error('加载饰品数据错误:', error);
        alert('加载失败: ' + error.message);
    } finally {
        selectItemBtn.disabled = false;
        selectItemBtn.textContent = '📊 查看价格';
    }
}

// 加载价格数据
async function loadPriceData(itemId) {
    try {
        const response = await fetch(`/api/price-data/${itemId}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        currentItemData = data.data;
        displayPriceData(currentItemData);
    } catch (error) {
        console.error('加载价格数据错误:', error);
        alert('加载价格数据失败: ' + error.message);
    }
}

// 加载销售和成交量数据
async function loadSalesData(itemId) {
    try {
        const selectedPlatform = salesPlatformSelector.value;
        const response = await fetch(`/api/sales-data/${itemId}?platform=${selectedPlatform}`);
        const data = await response.json();
        if (!data.success) {
             throw new Error(data.error || '获取销售数据时发生未知错误');
        }
        currentSalesData = data;
        if (data.sell_num_data || data.turnover_data || data.price_data) {
            displaySalesChart(data);
        } else {
            salesChartContainer.style.display = 'none';
        }
    } catch(error) {
        console.error('获取销售数据失败:', error.message);
        salesChartContainer.style.display = 'none';
    }
}

// 显示价格数据
function displayPriceData(data) {
    if (data && data.data && data.data.goods_info) {
        const itemInfo = data.data.goods_info;
        currentPrice.textContent = `¥${(itemInfo.buff_sell_price || 0).toLocaleString()}`;
        const change = itemInfo.sell_price_rate_7 || 0;
        priceChange.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
        priceChange.className = `change ${change >= 0 ? 'positive' : 'negative'}`;
        updatePriceChart(itemInfo);
        priceDataCard.style.display = 'block';
        predictionCard.style.display = 'block';
        predictionResult.style.display = 'none';
        priceDataCard.scrollIntoView({ behavior: 'smooth' });
    }
}

// 显示销售与成交量图表
function displaySalesChart(data) {
    if (salesChartInstance) {
        salesChartInstance.dispose();
    }
    salesChartContainer.style.display = 'block';
    salesChartInstance = echarts.init(document.getElementById('salesChart'));

    const legendData = [];
    const series = [];
    const allData = {};
    const selectedPlatformText = salesPlatformSelector.options[salesPlatformSelector.selectedIndex].text;
    
    // ... (图表数据处理逻辑保持不变)
    if (data.sell_num_data && data.sell_num_data.timestamp) {
        legendData.push(`在售数量 (${selectedPlatformText})`);
        data.sell_num_data.timestamp.forEach((ts, index) => {
            const date = new Date(ts).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
            if (!allData[date]) allData[date] = {};
            allData[date].sellNum = data.sell_num_data.main_data[index];
        });
    }
    if (data.turnover_data && data.turnover_data.timestamp) {
        legendData.push('成交量 (Steam)');
        data.turnover_data.timestamp.forEach((ts, index) => {
            const date = new Date(ts).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
            if (!allData[date]) allData[date] = {};
            allData[date].turnover = data.turnover_data.main_data[index];
        });
    }
    if (data.price_data && data.price_data.timestamp) {
        legendData.push(`价格 (${selectedPlatformText})`);
        data.price_data.timestamp.forEach((ts, index) => {
            const date = new Date(ts).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
            if (!allData[date]) allData[date] = {};
            allData[date].price = data.price_data.main_data[index];
        });
    }

    const dates = Object.keys(allData).sort((a, b) => new Date(a) - new Date(b));
    const sellNumSeriesData = dates.map(date => allData[date].sellNum || null);
    const turnoverSeriesData = dates.map(date => allData[date].turnover || null);
    const priceSeriesData = dates.map(date => allData[date].price || null);

    if (legendData.includes(`在售数量 (${selectedPlatformText})`)) {
        series.push({ name: `在售数量 (${selectedPlatformText})`, type: 'line', smooth: true, yAxisIndex: 0, data: sellNumSeriesData });
    }
    if (legendData.includes('成交量 (Steam)')) {
        series.push({ name: '成交量 (Steam)', type: 'bar', yAxisIndex: 0, data: turnoverSeriesData });
    }
    if (legendData.includes(`价格 (${selectedPlatformText})`)) {
        series.push({ name: `价格 (${selectedPlatformText})`, type: 'line', smooth: true, yAxisIndex: 1, data: priceSeriesData });
    }
    
    if (series.length === 0) {
        salesChartContainer.style.display = 'none';
        return;
    }

    const option = {
        tooltip: { trigger: 'axis' },
        legend: { data: legendData },
        grid: { top: '20%', left: '15%', right: '15%', bottom: '30%' },
        xAxis: { type: 'category', data: dates, axisLabel: { hideOverlap: true } },
        yAxis: [{ type: 'value', name: '数量' }, { type: 'value', name: '价格 (¥)' }],
        dataZoom: [{ type: 'slider', start: 50, end: 100 }],
        series: series
    };

    salesChartInstance.setOption(option);
    new ResizeObserver(() => salesChartInstance.resize()).observe(salesChartContainer);
}


// 更新价格图表
function updatePriceChart(itemInfo) {
    const priceChart = document.getElementById('priceChart');
    priceChart.innerHTML = `
        <div class="price-trend">
            <h4>价格趋势</h4>
            <div class="trend-item"><span>1天:</span><span class="${itemInfo.sell_price_rate_1 >= 0 ? 'positive' : 'negative'}">${itemInfo.sell_price_rate_1 > 0 ? '+' : ''}${(itemInfo.sell_price_rate_1 || 0).toFixed(2)}%</span></div>
            <div class="trend-item"><span>7天:</span><span class="${itemInfo.sell_price_rate_7 >= 0 ? 'positive' : 'negative'}">${itemInfo.sell_price_rate_7 > 0 ? '+' : ''}${(itemInfo.sell_price_rate_7 || 0).toFixed(2)}%</span></div>
            <div class="trend-item"><span>30天:</span><span class="${itemInfo.sell_price_rate_30 >= 0 ? 'positive' : 'negative'}">${itemInfo.sell_price_rate_30 > 0 ? '+' : ''}${(itemInfo.sell_price_rate_30 || 0).toFixed(2)}%</span></div>
        </div>
        <div class="platform-prices">
            <h4>平台价格</h4>
            <div class="platform-item"><span>BUFF:</span><span>¥${(itemInfo.buff_sell_price || 0).toLocaleString()}</span></div>
            <div class="platform-item"><span>悠悠有品:</span><span>¥${(itemInfo.yyyp_sell_price || 0).toLocaleString()}</span></div>
            <div class="platform-item"><span>Steam:</span><span>¥${(itemInfo.steam_sell_price || 0).toLocaleString()}</span></div>
        </div>
    `;
}

// 处理价格预测
async function handlePredict() {
    if (!currentItemData) return alert('请先搜索并选择饰品');

    try {
        predictBtn.disabled = true;
        predictBtn.textContent = '🔮 预测中...';
        loadingSpinner.style.display = 'block';
        predictionResult.style.display = 'none';

        const response = await fetch('/api/predict-price', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ priceData: currentItemData, itemName: itemSearch.value, salesData: currentSalesData })
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error);

        predictionResult.textContent = data.prediction;
        predictionResult.style.display = 'block';
    } catch (error) {
        console.error('预测错误:', error);
        predictionResult.textContent = '预测失败: ' + error.message;
        predictionResult.style.display = 'block';
    } finally {
        predictBtn.disabled = false;
        predictBtn.textContent = '🔮 开始预测';
        loadingSpinner.style.display = 'none';
    }
}

// 加载热门饰品
async function loadHotItems() {
    try {
        const response = await fetch('/api/hot-items');
        const data = await response.json();
        if (data.success && data.data) displayHotItems(data.data);
    } catch (error) {
        console.error('加载热门饰品失败:', error);
    }
}

// 显示热门饰品
function displayHotItems(items) {
    hotItems.innerHTML = '';
    items.slice(0, 10).forEach(item => {
        const itemCard = document.createElement('div');
        itemCard.className = 'item-card';
        const avgChange = (item.sell_price_7 || 0);
        const changeClass = avgChange >= 0 ? 'positive' : 'negative';

        itemCard.innerHTML = `
            <h4>${item.name}</h4>
            <p>系列总值: ¥${(item.total_value || 0).toLocaleString()}</p>
            <small class="${changeClass}">7日涨跌: ${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%</small>
        `;

        itemCard.addEventListener('click', () => {
            itemSearch.value = item.name;
            handleSearch();
        });
        hotItems.appendChild(itemCard);
    });
}
