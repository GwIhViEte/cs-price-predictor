const express = require('express');
const { buildPredictionMessages } = require('../services/predictionPrompt');
const { parsePlatform } = require('../utils/platforms');

function getUpstreamMessage(error, fallback) {
  return error?.payload?.msg || error?.response?.data?.msg || error?.message || fallback;
}

function createApiRouter({ csqaqClient, openaiClient, logger = console }) {
  const router = express.Router();

  router.get('/search-item', async (req, res) => {
    try {
      const query = String(req.query.query || '').trim();
      if (!query) {
        return res.status(400).json({ success: false, error: '请提供搜索关键词' });
      }

      const items = await csqaqClient.searchItems(query);
      return res.json({ success: true, data: items });
    } catch (error) {
      logger.error('搜索饰品失败:', getUpstreamMessage(error, '搜索服务暂时不可用'));
      return res.status(500).json({ success: false, error: '搜索服务暂时不可用' });
    }
  });

  router.get('/price-data/:itemId', async (req, res) => {
    try {
      const data = await csqaqClient.getGood(req.params.itemId);
      return res.json({ success: true, data });
    } catch (error) {
      logger.error('获取价格数据失败:', getUpstreamMessage(error, '价格数据服务暂时不可用'));
      return res.status(500).json({ success: false, error: '价格数据服务暂时不可用' });
    }
  });

  router.get('/sales-data/:itemId', async (req, res) => {
    const { itemId } = req.params;
    const platform = parsePlatform(req.query.platform, 1);

    async function readChart(label, request) {
      try {
        return await request();
      } catch (error) {
        logger.error(`未能获取 [${itemId}] 的${label}:`, getUpstreamMessage(error, '图表数据不可用'));
        return null;
      }
    }

    const sellNumData = await readChart('在售数量数据', () =>
      csqaqClient.getChart({ itemId, key: 'sell_num', platform })
    );
    const turnoverData = await readChart('Steam成交量数据', () =>
      csqaqClient.getChart({ itemId, key: 'turnover_number', platform: 3 })
    );
    const priceData = await readChart('价格数据', () =>
      csqaqClient.getChart({ itemId, key: 'sell_price', platform })
    );

    return res.json({
      success: true,
      sell_num_data: sellNumData,
      turnover_data: turnoverData,
      price_data: priceData
    });
  });

  router.get('/hot-items', async (req, res) => {
    try {
      const data = await csqaqClient.getHotSeries();
      return res.json({ success: true, data });
    } catch (error) {
      logger.error('获取热门系列失败:', getUpstreamMessage(error, '热门系列服务暂时不可用'));
      return res.status(500).json({ success: false, error: '获取热门系列服务暂时不可用' });
    }
  });

  router.post('/predict-price', async (req, res) => {
    try {
      const { priceData, itemName } = req.body;
      if (!priceData || !itemName) {
        return res.status(400).json({ success: false, error: '缺少必要的预测数据' });
      }

      const messages = buildPredictionMessages({ priceData, itemName });
      const createPrediction = openaiClient.createResponse || openaiClient.createChatCompletion;
      const prediction = await createPrediction(messages);
      return res.json({ success: true, prediction });
    } catch (error) {
      logger.error('价格预测失败:', getUpstreamMessage(error, '价格预测服务暂时不可用'));
      return res.status(500).json({ success: false, error: '价格预测服务暂时不可用' });
    }
  });

  return router;
}

module.exports = {
  createApiRouter,
  getUpstreamMessage
};
