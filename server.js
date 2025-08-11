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

// 请求频率限制
let lastRequestTime = 0;
const RATE_LIMIT = 1200; // 1.2秒

// 全局的请求速率控制器
async function rateLimiter(req, res, next) {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < RATE_LIMIT) {
        const waitTime = RATE_LIMIT - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    lastRequestTime = Date.now();
    next();
}


// --- API Routes ---

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const csqaqApiRouter = express.Router();
csqaqApiRouter.use(rateLimiter);
app.use('/api', csqaqApiRouter);


// 搜索饰品API
csqaqApiRouter.get('/search-item', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.status(400).json({ success: false, error: '请提供搜索关键词' });

        const response = await axios.get(`${CSQAQ_CONFIG.baseURL}/search/suggest`, { params: { text: query }, headers: CSQAQ_CONFIG.headers });
        if (response.data.code === 200) {
            const items = response.data.data.map(item => ({ id: item.id, name: item.value, market_hash_name: item.value }));
            res.json({ success: true, data: items });
        } else {
            res.status(400).json({ success: false, error: response.data.msg || '搜索失败' });
        }
    } catch (error) {
        console.error('搜索饰品失败:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: '搜索服务暂时不可用' });
    }
});
// 获取饰品价格数据API
csqaqApiRouter.get('/price-data/:itemId', async (req, res) => {
    try {
        const { itemId } = req.params;
        const response = await axios.get(`${CSQAQ_CONFIG.baseURL}/info/good`, { params: { id: itemId }, headers: CSQAQ_CONFIG.headers });
        if (response.data.code === 200) {
            res.json({ success: true, data: response.data });
        } else {
            res.status(400).json({ success: false, error: response.data.msg || '获取价格数据失败' });
        }
    } catch (error) {
        console.error('获取价格数据失败:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: '价格数据服务暂时不可用' });
    }
});
// 获取销售和价格历史数据API
csqaqApiRouter.get('/sales-data/:itemId', async (req, res, next) => {
    const { itemId } = req.params;
    const { platform = '1' } = req.query;
    let sellNumData = null;
    let turnoverData = null;
    let priceData = null;

    try {
        const sellNumResponse = await axios.post(`${CSQAQ_CONFIG.baseURL}/info/chart`, {
            good_id: parseInt(itemId), key: 'sell_num', platform: parseInt(platform), period: 30, style: 'all_style'
        }, { headers: CSQAQ_CONFIG.headers });
        if (sellNumResponse.data.code === 200) sellNumData = sellNumResponse.data.data;
    } catch (error) {
        console.error(`未能获取 [${itemId}] 在平台 [${platform}] 的在售数量数据:`, error.response?.data?.msg || error.message);
    }
    
    rateLimiter(req, res, async () => {
        try {
            const turnoverResponse = await axios.post(`${CSQAQ_CONFIG.baseURL}/info/chart`, {
                good_id: parseInt(itemId), key: 'turnover_number', platform: 3, period: 30, style: 'all_style'
            }, { headers: CSQAQ_CONFIG.headers });
            if (turnoverResponse.data.code === 200) turnoverData = turnoverResponse.data.data;
        } catch (error) {
            console.error(`未能获取 [${itemId}] 的成交量数据:`, error.response?.data?.msg || error.message);
        }
        
        rateLimiter(req, res, async () => {
             try {
                const priceResponse = await axios.post(`${CSQAQ_CONFIG.baseURL}/info/chart`, {
                    good_id: parseInt(itemId), key: 'sell_price', platform: parseInt(platform), period: 30, style: 'all_style'
                }, { headers: CSQAQ_CONFIG.headers });
                if (priceResponse.data.code === 200) priceData = priceResponse.data.data;
            } catch (error) {
                console.error(`未能获取 [${itemId}] 在平台 [${platform}] 的价格数据:`, error.response?.data?.msg || error.message);
            }

            res.json({
                success: true,
                sell_num_data: sellNumData,
                turnover_data: turnoverData,
                price_data: priceData
            });
        });
    });
});
// 获取热门饰品API
csqaqApiRouter.get('/hot-items', async (req, res) => {
    try {
        const response = await axios.post(`${CSQAQ_CONFIG.baseURL}/info/get_series_list`, { page: 1, page_size: 10 }, { headers: CSQAQ_CONFIG.headers });
        if (response.data.code === 200) {
            res.json({ success: true, data: response.data.data || [] });
        } else {
            res.status(400).json({ success: false, error: response.data.msg || '获取热门饰品失败' });
        }
    } catch (error) {
        console.error('获取热门饰品失败:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: '获取热门饰品服务暂时不可用' });
    }
});

// 价格预测API
app.post('/api/predict-price', async (req, res) => {
    try {
        const { priceData, itemName, salesData } = req.body;
        if (!priceData || !itemName) return res.status(400).json({ success: false, error: '缺少必要的预测数据' });

        const itemInfo = priceData.data.goods_info;
        
        const sales_summary = `
- BUFF在售数量: ${itemInfo.buff_sell_num}
- 悠悠有品在售数量: ${itemInfo.yyyp_sell_num}
- Steam在售数量: ${itemInfo.steam_sell_num}
- Steam市场最近日成交量: ${itemInfo.turnover_number || 'N/A'}`;
        
        const prompt = `你是一位顶级的CS饰品市场数据分析师。请根据以下提供的实时数据和历史价格，对饰品进行一次全面、深入的投资分析。

**饰品名称**: ${itemInfo.market_hash_name || itemName}

**1. 历史价格参考**:
- 1日涨跌: ${itemInfo.sell_price_rate_1?.toFixed(2)}%
- 7日涨跌: ${itemInfo.sell_price_rate_7?.toFixed(2)}%
- 30日涨跌: ${itemInfo.sell_price_rate_30?.toFixed(2)}%

**2. 当前市场快照 (价格)**:
- BUFF售价: ¥${itemInfo.buff_sell_price}
- 悠悠有品售价: ¥${itemInfo.yyyp_sell_price}
- Steam售价: ¥${itemInfo.steam_sell_price}

**3. 当前供需数据**:
${sales_summary}

**分析要求**:
- 请注意：任何饰品在购买后会获得7天的交易冷却时间！
- 请注意：CS饰品市场是很情绪化的，你在分析的时候需要注意这一点。
- 请注意：在最近的更新中添加了交易撤回功能，现在卖饰品的钱要在交易平台冻结7天！
- 关于各交易平台手续费：悠悠有品：1%，BUFF：2.5%，Steam：15%（买家付款＝卖家收款+卖家收款×15％）。
- 关于各交易平台提现费：最低提现金额为10元，悠悠有品：1%（最低2元），BUFF：1%，Steam无法提现。
- 请注意：如果Steam平台的价格为0，则不考虑Steam平台。

**请基于以上所有信息，进行分析并回答以下问题**:
1.  **价格趋势与供需分析**: 结合价格历史和近期的在售数量、成交量变化，判断当前价格趋势，并分析供需关系。
2.  **平台选择建议**: 哪个平台可能存在购买机会？通过计算最后到手的钱，得出作为卖家，在考虑交易手续费和提现手续费的情况下去哪个平台出售会获得最佳收益？
3.  **短期（1-7天）价格预测**: 综合所有信息，预测接下来的短期价格走势（上涨、下跌、盘整），并给出核心理由。
4.  **中期（8-15天）价格预测**: 综合所有信息，预测接下来的短期价格走势（上涨、下跌、盘整），并给出核心理由。
5.  **长期（15天以上）价格预测**: 综合所有信息，预测接下来的短期价格走势（上涨、下跌、盘整），并给出核心理由。
6.  **投资建议**: 给出明确的投资建议。

**重要格式要求**:
- 使用简洁的文字格式回答，不要使用markdown语法
- 每个问题的回答用数字序号开头，如"1. "
- 段落之间用空行分隔`;

        const openaiResponse = await axios.post(`${OPENAI_CONFIG.baseURL}/chat/completions`, {
            model: 'gpt-4.1-mini',
            messages: [{ role: 'system', content: '你是一位拥有10年经验的顶级CS饰品市场数据分析师。' }, { role: 'user', content: prompt }],
        }, { headers: OPENAI_CONFIG.headers });

        res.json({ success: true, prediction: openaiResponse.data.choices[0].message.content });
    } catch (error) {
        console.error('价格预测失败:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: '价格预测服务暂时不可用' });
    }
});


// --- Error Handling and Server Start ---
app.use((error, req, res, next) => {
    console.error('服务器错误:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
});
app.use((req, res) => {
    res.status(404).json({ success: false, error: '接口不存在' });
});
app.listen(PORT, () => console.log(`🚀 服务器运行在 http://localhost:${PORT}`));
