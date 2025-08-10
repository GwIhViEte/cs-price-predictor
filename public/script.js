// 全局变量
let currentItemData = null;
let currentItemId = null;
let searchResults = [];

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
// 新增：多普勒选择器相关DOM
const dopplerSelectorContainer = document.getElementById('dopplerSelectorContainer');
const dopplerStyleDropdown = document.getElementById('dopplerStyleDropdown');


// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
    console.log('页面加载完成');
    loadHotItems();
    
    // 绑定事件监听器
    searchBtn.addEventListener('click', handleSearch);
    selectItemBtn.addEventListener('click', handleItemSelect);
    predictBtn.addEventListener('click', handlePredict);
    // 新增：为多普勒样式下拉列表绑定事件
    dopplerStyleDropdown.addEventListener('change', handleDopplerStyleChange);
    
    // 回车键搜索
    itemSearch.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    
    // 下拉列表改变时启用/禁用按钮
    itemDropdown.addEventListener('change', function() {
        selectItemBtn.disabled = !this.value;
    });
});

// 搜索功能
async function handleSearch() {
    const searchTerm = itemSearch.value.trim();
    
    if (!searchTerm) {
        alert('请输入饰品名称或ID');
        return;
    }
    
    try {
        searchBtn.disabled = true;
        searchBtn.textContent = '🔍 搜索中...';
        
        const searchResponse = await fetch(`/api/search-item?query=${encodeURIComponent(searchTerm)}`);
        const searchData = await searchResponse.json();
        
        if (!searchData.success) {
            throw new Error(searchData.error || '搜索失败');
        }
        
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
    
    items.forEach((item, index) => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        option.dataset.index = index;
        itemDropdown.appendChild(option);
    });
    
    itemSelector.style.display = 'block';
    priceDataCard.style.display = 'none';
    predictionCard.style.display = 'none';
    itemSelector.scrollIntoView({ behavior: 'smooth' });
}

// 隐藏饰品选择器
function hideItemSelector() {
    itemSelector.style.display = 'none';
    priceDataCard.style.display = 'none';
    predictionCard.style.display = 'none';
}

// 处理饰品选择
async function handleItemSelect() {
    const selectedId = itemDropdown.value;
    const selectedIndex = itemDropdown.options[itemDropdown.selectedIndex].dataset.index;
    
    if (!selectedId) {
        alert('请选择一个饰品');
        return;
    }
    
    try {
        selectItemBtn.disabled = true;
        selectItemBtn.textContent = '📊 加载中...';
        
        // 重置多普勒选择器
        dopplerSelectorContainer.style.display = 'none';
        dopplerStyleDropdown.innerHTML = '';

        const selectedItem = searchResults[selectedIndex];
        currentItemId = selectedId;
        
        await loadPriceData(selectedId);
        
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
        
        if (!data.success) {
            throw new Error(data.error || '获取价格数据失败');
        }
        
        currentItemData = data.data;
        displayPriceData(currentItemData);
        
    } catch (error) {
        console.error('加载价格数据错误:', error);
        alert('加载价格数据失败: ' + error.message);
    }
}

// 显示价格数据 (已修改)
function displayPriceData(data) {
    if (data && data.data && data.data.goods_info) {
        const itemInfo = data.data.goods_info;
        
        const price = itemInfo.buff_sell_price || itemInfo.yyyp_sell_price || 0;
        currentPrice.textContent = `¥${price.toLocaleString()}`;
        
        const change = itemInfo.sell_price_rate_7 || 0;
        priceChange.textContent = `${change > 0 ? '+' : ''}${change.toFixed(2)}%`;
        priceChange.className = `change ${change >= 0 ? 'positive' : 'negative'}`;
        
        priceDataCard.style.display = 'block';
        predictionCard.style.display = 'block';
        
        updatePriceChart(itemInfo);
        
        // 检查并显示多普勒样式
        if (data.data.dpl && data.data.dpl.length > 0) {
            setupDopplerSelector(data.data.dpl);
        }
        
        priceDataCard.scrollIntoView({ behavior: 'smooth' });
    }
}

// 新增：设置多普勒样式选择器
function setupDopplerSelector(dplItems) {
    dopplerStyleDropdown.innerHTML = ''; // 清空旧选项

    // 添加一个默认选项，代表基础价格
    const defaultOption = document.createElement('option');
    defaultOption.value = 'default';
    defaultOption.textContent = '默认/综合';
    dopplerStyleDropdown.appendChild(defaultOption);

    // 添加API返回的各种样式
    dplItems.forEach(item => {
        const option = document.createElement('option');
        option.value = item.value; // e.g., "Phase1", "Ruby"
        option.textContent = item.label; // e.g., "P1", "红宝石"
        dopplerStyleDropdown.appendChild(option);
    });

    dopplerSelectorContainer.style.display = 'flex'; // 显示选择器
}

// 新增：处理多普勒样式选择变化的函数
async function handleDopplerStyleChange() {
    const selectedStyle = dopplerStyleDropdown.value;

    // 如果选择默认，则恢复显示基础价格
    if (selectedStyle === 'default') {
        const basePrice = currentItemData.data.goods_info.buff_sell_price || 0;
        currentPrice.textContent = `¥${basePrice.toLocaleString()}`;
        return;
    }

    // 如果选择具体样式，则向后端请求价格
    try {
        currentPrice.textContent = '查询中...'; // 提供加载反馈
        const response = await fetch('/api/doppler-price', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                itemId: currentItemId,
                style: selectedStyle
            })
        });

        const data = await response.json();
        if (data.success) {
            currentPrice.textContent = `¥${data.price.toLocaleString()}`;
        } else {
            throw new Error(data.error || '查询失败');
        }
    } catch (error) {
        console.error('查询样式价格失败:', error);
        currentPrice.textContent = '查询失败';
        alert('查询样式价格失败: ' + error.message);
    }
}


// 更新价格图表
function updatePriceChart(itemInfo) {
    const priceChart = document.getElementById('priceChart');
    if (priceChart) {
        priceChart.innerHTML = `
            <div class="price-trend">
                <h4>价格趋势 (7日均价)</h4>
                <div class="trend-item">
                    <span>1天:</span>
                    <span class="${itemInfo.sell_price_rate_1 >= 0 ? 'positive' : 'negative'}">
                        ${itemInfo.sell_price_rate_1 > 0 ? '+' : ''}${itemInfo.sell_price_rate_1.toFixed(2)}%
                    </span>
                </div>
                <div class="trend-item">
                    <span>7天:</span>
                    <span class="${itemInfo.sell_price_rate_7 >= 0 ? 'positive' : 'negative'}">
                        ${itemInfo.sell_price_rate_7 > 0 ? '+' : ''}${itemInfo.sell_price_rate_7.toFixed(2)}%
                    </span>
                </div>
                <div class="trend-item">
                    <span>30天:</span>
                    <span class="${itemInfo.sell_price_rate_30 >= 0 ? 'positive' : 'negative'}">
                        ${itemInfo.sell_price_rate_30 > 0 ? '+' : ''}${itemInfo.sell_price_rate_30.toFixed(2)}%
                    </span>
                </div>
                <div class="trend-item">
                    <span>90天:</span>
                    <span class="${itemInfo.sell_price_rate_90 >= 0 ? 'positive' : 'negative'}">
                        ${itemInfo.sell_price_rate_90 > 0 ? '+' : ''}${itemInfo.sell_price_rate_90.toFixed(2)}%
                    </span>
                </div>
            </div>
            <div class="platform-prices">
                <h4>平台价格对比</h4>
                <div class="platform-item">
                    <span>BUFF:</span>
                    <span>¥${itemInfo.buff_sell_price.toLocaleString()}</span>
                </div>
                <div class="platform-item">
                    <span>悠悠有品:</span>
                    <span>¥${itemInfo.yyyp_sell_price.toLocaleString()}</span>
                </div>
                <div class="platform-item">
                    <span>Steam:</span>
                    <span>¥${itemInfo.steam_sell_price.toLocaleString()}</span>
                </div>
            </div>
        `;
    }
}

// 处理价格预测
async function handlePredict() {
    if (!currentItemData) {
        alert('请先搜索并选择饰品');
        return;
    }
    
    try {
        predictBtn.disabled = true;
        predictBtn.textContent = '🔮 预测中...';
        loadingSpinner.style.display = 'block';
        predictionResult.style.display = 'none';
        
        const response = await fetch('/api/predict-price', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                priceData: currentItemData,
                itemName: itemSearch.value
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || '预测失败');
        }
        
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
        
        if (data.success && data.data) {
            displayHotItems(data.data);
        }
    } catch (error) {
        console.error('加载热门饰品失败:', error);
        displayDefaultHotItems();
    }
}

// 显示热门饰品
function displayHotItems(items) {
    hotItems.innerHTML = '';
    
    const displayItems = items.slice(0, 10);
    
    displayItems.forEach(item => {
        const itemCard = document.createElement('div');
        itemCard.className = 'item-card';
        
        const avgChange = (item.sell_price_7 || 0);
        const changeClass = avgChange >= 0 ? 'positive' : 'negative';
        
        itemCard.innerHTML = `
            <h4>${item.name}</h4>
            <p>系列总值: ¥${(item.total_value || 0).toLocaleString()}</p>
            <p>饰品数量: ${item.amount}</p>
            <small class="${changeClass}">7日涨跌: ${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%</small>
        `;
        
        itemCard.addEventListener('click', () => {
            itemSearch.value = item.name;
            handleSearch();
        });
        
        hotItems.appendChild(itemCard);
    });
}

// 显示默认热门饰品
function displayDefaultHotItems() {
    const defaultItems = [
        { name: 'AK-47', total_value: 89000, amount: 150, sell_price_7: 2.5 },
        { name: 'AWP', total_value: 158000, amount: 120, sell_price_7: -1.2 },
        { name: 'M4A4', total_value: 42000, amount: 200, sell_price_7: 5.8 },
        { name: 'AK-47', total_value: 89000, amount: 180, sell_price_7: 3.2 }
    ];
    
    displayHotItems(defaultItems);
}

// 错误处理
window.addEventListener('error', function(e) {
    console.error('页面错误:', e.error);
});

// 网络状态检查
window.addEventListener('online', function() {
    console.log('网络连接恢复');
});

window.addEventListener('offline', function() {
    console.log('网络连接断开');
    alert('网络连接断开，请检查网络设置');
});
