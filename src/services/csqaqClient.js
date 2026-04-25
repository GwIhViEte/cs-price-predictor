const axios = require('axios');
const { createRateLimiter } = require('./rateLimiter');

class CsqaqApiError extends Error {
  constructor(message, payload) {
    super(message);
    this.name = 'CsqaqApiError';
    this.payload = payload;
  }
}

function assertSuccess(payload, fallbackMessage) {
  if (payload && payload.code === 200) {
    return payload;
  }

  throw new CsqaqApiError(payload?.msg || fallbackMessage, payload);
}

function createCsqaqClient({ axiosInstance = axios, config, rateLimiter } = {}) {
  const limiter = rateLimiter || createRateLimiter({ intervalMs: config.rateLimitMs });
  const headers = {
    ApiToken: config.apiToken,
    'Content-Type': 'application/json'
  };

  async function request(method, endpoint, options = {}) {
    await limiter.wait();

    const response = await axiosInstance.request({
      method,
      url: `${config.baseURL}${endpoint}`,
      params: options.params,
      data: options.data,
      headers
    });

    return response.data;
  }

  return {
    async searchItems(query) {
      const payload = assertSuccess(
        await request('get', '/search/suggest', { params: { text: query } }),
        '搜索失败'
      );

      return (payload.data || []).map((item) => ({
        id: item.id,
        name: item.value,
        market_hash_name: item.value
      }));
    },

    async getGood(itemId) {
      return assertSuccess(
        await request('get', '/info/good', { params: { id: Number.parseInt(itemId, 10) } }),
        '获取价格数据失败'
      );
    },

    async getChart({ itemId, key, platform, period = 30, style = 'all_style' }) {
      const payload = assertSuccess(
        await request('post', '/info/chart', {
          data: {
            good_id: Number.parseInt(itemId, 10),
            key,
            platform,
            period,
            style
          }
        }),
        '获取图表数据失败'
      );

      return payload.data;
    },

    async getHotSeries() {
      const payload = assertSuccess(
        await request('post', '/info/get_series_list', { data: { page: 1, page_size: 10 } }),
        '获取热门系列失败'
      );

      return payload.data || [];
    }
  };
}

module.exports = {
  CsqaqApiError,
  createCsqaqClient
};
