const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// CSQAQ API 配置
const CSQAQ_CONFIG = {
    baseURL: 'https://api.csqaq.com/api/v1',
    headers: {
        'ApiToken': process.env.CSQAQ_API_TOKEN || '',
        'Content-Type': 'application/json'
    }
};

// OpenAI API 配置
const OPENAI_CONFIG = {
    baseURL: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
    headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
    }
};

// 请求频率限制 (1次/秒)
let lastRequestTime = 0;
const RATE_LIMIT = 1000; // 1秒

function checkRateLimit() {
    const now = Date.now();
    if (now - lastRequestTime < RATE_LIMIT) {
        const waitTime = RATE_LIMIT - (now - lastRequestTime);
        return new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastRequestTime = now;
    return Promise.resolve();
}

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 搜索饰品API
app.get('/api/search-item', async (req, res) => {
    try {
        const { query } = req.query;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                error: '请提供搜索关键词'
            });
        }

        await checkRateLimit();
        
        const response = await axios.get(`${CSQAQ_CONFIG.baseURL}/search/suggest`, {
            params: { 
                text: query
            },
            headers: {
                'ApiToken': process.env.CSQAQ_API_TOKEN,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('搜索响应:', response.data);
        
        if (response.data.code === 200) {
            const items = [];
            
            // 正确处理返回的数组结构
            if (response.data.data && Array.isArray(response.data.data)) {
                response.data.data.forEach(item => {
                    items.push({
                        id: item.id,
                        name: item.value, 
                        market_hash_name: item.value
                    });
                });
            }
            
            res.json({
                success: true,
                data: items
            });
        } else {
            res.status(400).json({
                success: false,
                error: response.data.msg || '搜索失败'
            });
        }
        
    } catch (error) {
        console.error('搜索饰品失败:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: '搜索服务暂时不可用'
        });
    }
});


// 获取饰品价格数据API
app.get('/api/price-data/:itemId', async (req, res) => {
    try {
        const { itemId } = req.params;
        
        await checkRateLimit();
        
        // 使用单件饰品数据接口
        const response = await axios.get(`${CSQAQ_CONFIG.baseURL}/info/good`, {
            params: { id: itemId },
            headers: {
                'ApiToken': process.env.CSQAQ_API_TOKEN,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('价格数据响应:', response.data);
        
        if (response.data.code === 200) {
            res.json({
                success: true,
                data: response.data
            });
        } else {
            res.status(400).json({
                success: false,
                error: response.data.msg || '获取价格数据失败'
            });
        }
        
    } catch (error) {
        console.error('获取价格数据失败:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: '价格数据服务暂时不可用'
        });
    }
});

// 获取热门饰品API
app.get('/api/hot-items', async (req, res) => {
    try {
        await checkRateLimit();
        
        // 使用热门系列饰品列表接口
        const response = await axios.post(`${CSQAQ_CONFIG.baseURL}/info/get_series_list`, {
            page: 1,
            page_size: 10
        }, {
            headers: {
                'ApiToken': process.env.CSQAQ_API_TOKEN,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('热门饰品响应:', response.data);
        
        if (response.data.code === 200) {
            res.json({
                success: true,
                data: response.data.data || []
            });
        } else {
            res.status(400).json({
                success: false,
                error: response.data.msg || '获取热门饰品失败'
            });
        }
        
    } catch (error) {
        console.error('获取热门饰品失败:', error.response?.data || error.message);
        // 返回默认数据
        res.json({
            success: true,
            data: [
                { id: 1, name: 'AK-47 | 红线', price: 89.00, change: 2.5 },
                { id: 2, name: 'AWP | 龙狙', price: 1580.00, change: -1.2 },
                { id: 3, name: 'M4A4 | 龙王', price: 420.00, change: 5.8 },
                { id: 4, name: 'AK-47 | 火蛇', price: 890.00, change: 3.2 }
            ]
        });
    }
});

// 价格预测API - 使用专业的分析师prompt
app.post('/api/predict-price', async (req, res) => {
    try {
        const { priceData, itemName } = req.body;
        
        if (!priceData || !itemName) {
            return res.status(400).json({
                success: false,
                error: '缺少必要的预测数据'
            });
        }
        
        // 从CSQAQ API数据中提取关键信息
        const itemInfo = priceData.data.goods_info;
        
        // 构建历史价格摘要
        const history_summary = `
- 1日涨跌: ${itemInfo.sell_price_rate_1?.toFixed(2)}% (${itemInfo.sell_price_1 > 0 ? '+' : ''}${itemInfo.sell_price_1})
- 7日涨跌: ${itemInfo.sell_price_rate_7?.toFixed(2)}% (${itemInfo.sell_price_7 > 0 ? '+' : ''}${itemInfo.sell_price_7})
- 15日涨跌: ${itemInfo.sell_price_rate_15?.toFixed(2)}% (${itemInfo.sell_price_15 > 0 ? '+' : ''}${itemInfo.sell_price_15})
- 30日涨跌: ${itemInfo.sell_price_rate_30?.toFixed(2)}% (${itemInfo.sell_price_30 > 0 ? '+' : ''}${itemInfo.sell_price_30})
- 90日涨跌: ${itemInfo.sell_price_rate_90?.toFixed(2)}% (${itemInfo.sell_price_90 > 0 ? '+' : ''}${itemInfo.sell_price_90})
- 180日涨跌: ${itemInfo.sell_price_rate_180?.toFixed(2)}% (${itemInfo.sell_price_180 > 0 ? '+' : ''}${itemInfo.sell_price_180})
- 365日涨跌: ${itemInfo.sell_price_rate_365?.toFixed(2)}% (${itemInfo.sell_price_365 > 0 ? '+' : ''}${itemInfo.sell_price_365})`;
        
        // 构建当前市场快照
        const current_summary = `
- BUFF售价: ¥${itemInfo.buff_sell_price} (在售${itemInfo.buff_sell_num}件)
- BUFF求购价: ¥${itemInfo.buff_buy_price} (求购${itemInfo.buff_buy_num}件)
- 悠悠有品售价: ¥${itemInfo.yyyp_sell_price} (在售${itemInfo.yyyp_sell_num}件)
- 悠悠有品求购价: ¥${itemInfo.yyyp_buy_price} (求购${itemInfo.yyyp_buy_num}件)
- Steam售价: ¥${itemInfo.steam_sell_price} (在售${itemInfo.steam_sell_num}件)
- Steam求购价: ¥${itemInfo.steam_buy_price} (求购${itemInfo.steam_buy_num}件)
- 饰品类型: ${itemInfo.type_localized_name}
- 稀有度: ${itemInfo.rarity_localized_name}
- 品质: ${itemInfo.quality_localized_name}
- 磨损: ${itemInfo.exterior_localized_name}
- 市场统计数据: ${itemInfo.statistic}`;

        // 构建专业的分析师prompt
        const prompt = `你是一位顶级的CS饰品市场数据分析师。请根据以下提供的 **当前实时数据** 和 **7日历史均价**，对饰品进行一次全面、深入的投资分析。

**饰品名称**: ${itemInfo.market_hash_name || itemName}

**1. 官方历史价格参考**:
${history_summary}

**2. 当前市场快照**:
${current_summary}

请注意：任何饰品在购买后会获得7天的交易冷却时间！
请注意：CS饰品市场是很情绪化的，你在分析的时候需要注意这一点。
请注意：在最近的更新中添加了交易撤回功能，现在卖饰品的钱要交易在平台冻结7天！
关于各交易平台手续费：悠悠有品：1%，BUFF：2.5%，Steam：15%（买家付款＝卖家收款+卖家收款×15％）。
关于各交易平台提现费：悠悠有品：1%，BUFF：1%，Steam无法提现只能购买游戏。
请注意：如果Steam平台的价格为0，则不考虑这个平台。

**请基于以上所有信息，进行分析并回答以下问题**:

1. **价格趋势判断**: 对比当前各平台的在售价格与官方7日均价，当前价格是处于高位、低位还是正常范围？不考虑Steam平台的价格。

2. **平台选择建议**: 哪个平台的当前售价远低于7日均价，可能存在购买机会？通过计算得出作为卖家，在考虑交易手续费的情况下去哪个平台出售会获得最佳收益？

3. **短期（1-7天）价格预测**: 综合所有信息，预测接下来的短期价格走势（例如：可能会向7日均价回归，或继续偏离），并给出核心理由。

4. **中期（8-14天）价格预测**: 综合所有信息，预测接下来的中期价格走势（例如：可能会向7日均价回归，或继续偏离），并给出核心理由。

5. **长期（15天以上）价格预测**: 综合所有信息，预测接下来的长期价格走势（例如：可能会向7日均价回归，或继续偏离），并给出核心理由。

6. **投资建议**: 给出明确的投资建议（例如："当前价格低于7日均价，是较好的买入时机"、"价格已显著高于历史均价，风险较大，建议观望"）。

**重要格式要求**:
- 请使用简洁的文字格式回答，不要使用markdown语法
- 不要使用星号(*)、井号(#)、中括号[]等markdown标记
- 每个问题的回答用数字序号开头，如"1. 价格趋势判断："
- 段落之间用空行分隔
- 保持专业、有条理的格式，但避免markdown格式化`;


        // 调用OpenAI API
        const openaiResponse = await axios.post(`${OPENAI_CONFIG.baseURL}/chat/completions`, {
            model: 'gpt-4.1-mini',
            messages: [
                {
                    role: 'system',
                    content: '你是一位拥有10年经验的顶级CS饰品市场数据分析师，专门从事饰品投资分析和市场预测。你具有深厚的市场洞察力，能够准确分析价格趋势和投资机会。你的分析报告总是条理清晰、数据详实、结论明确。'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 1500,
            temperature: 0.7
        }, {
            headers: OPENAI_CONFIG.headers
        });

        res.json({
            success: true,
            prediction: openaiResponse.data.choices[0].message.content
        });
        
    } catch (error) {
        console.error('价格预测失败:', error.message);
        res.status(500).json({
            success: false,
            error: '价格预测服务暂时不可用，请稍后再试'
        });
    }
});


// =================================================================
// == 新增：获取多普勒等特定样式价格的API
// =================================================================
app.post('/api/doppler-price', async (req, res) => {
    try {
        const { itemId, style } = req.body;

        if (!itemId || !style) {
            return res.status(400).json({ success: false, error: '缺少饰品ID或样式参数' });
        }

        await checkRateLimit();

        // 调用CSQAQ的图表数据接口来获取特定样式价格
        const response = await axios.post(`${CSQAQ_CONFIG.baseURL}/info/chart`, {
            good_id: parseInt(itemId),
            key: 'sell_price', // 我们关心的是售价
            platform: 1,       // 平台1=BUFF
            period: 7,         // 查询周期7天，足够获取最新价格
            style: style       // 关键参数：饰品样式
        }, {
            headers: {
                'ApiToken': process.env.CSQAQ_API_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.code === 200 && response.data.data.main_data) {
            const priceData = response.data.data.main_data;
            // 获取价格数组中最后一个非null的值作为最新价格
            const latestPrice = priceData.reverse().find(p => p !== null) || 0;
            
            res.json({
                success: true,
                price: latestPrice
            });
        } else {
            throw new Error(response.data.msg || '获取样式价格失败');
        }

    } catch (error) {
        console.error('获取样式价格失败:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: '样式价格服务暂时不可用' });
    }
});


// 错误处理中间件
app.use((error, req, res, next) => {
    console.error('服务器错误:', error);
    res.status(500).json({
        success: false,
        error: '服务器内部错误'
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: '接口不存在'
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
    console.log(`📊 CSQAQ API: ${CSQAQ_CONFIG.baseURL}`);
    console.log(`🤖 OpenAI API: ${OPENAI_CONFIG.baseURL}`);
});
