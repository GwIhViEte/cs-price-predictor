const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('../src/app');

const sampleGood = {
  code: 200,
  msg: 'Success',
  data: {
    goods_info: {
      id: 7310,
      market_hash_name: 'AK-47 | Redline (Field-Tested)',
      buff_sell_price: 100,
      yyyp_sell_price: 98,
      steam_sell_price: 120,
      buff_sell_num: 10,
      yyyp_sell_num: 8,
      steam_sell_num: 3,
      turnover_number: 5,
      sell_price_rate_1: 1.25,
      sell_price_rate_7: -2,
      sell_price_rate_30: 4.5
    }
  }
};

function createLogger() {
  return {
    errors: [],
    error(...args) {
      this.errors.push(args);
    }
  };
}

function createFakeCsqaqClient() {
  const calls = [];

  return {
    calls,
    async searchItems(query) {
      calls.push(['searchItems', query]);
      return [{ id: '7310', name: 'AK-47 | 红线', market_hash_name: 'AK-47 | 红线' }];
    },
    async getGood(itemId) {
      calls.push(['getGood', itemId]);
      return sampleGood;
    },
    async getChart(request) {
      calls.push(['getChart', request]);
      if (request.key === 'turnover_number') {
        throw new Error('turnover unavailable');
      }

      return {
        timestamp: [1718726899000],
        num_data: [12],
        main_data: request.key === 'sell_price' ? [100] : [12]
      };
    },
    async getHotSeries() {
      calls.push(['getHotSeries']);
      return [{ id: 1, name: '无涂装', total_value: 115535, sell_price_7: 0.62 }];
    }
  };
}

function createFakeOpenAiClient() {
  const calls = [];

  return {
    calls,
    async createResponse(messages) {
      calls.push(messages);
      return '1. 价格趋势与供需分析: 测试预测';
    }
  };
}

async function request(app, path, options = {}) {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: options.method || 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    return {
      status: response.status,
      body: await response.json()
    };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function createTestApp() {
  const logger = createLogger();
  const csqaqClient = createFakeCsqaqClient();
  const openaiClient = createFakeOpenAiClient();
  const app = createApp({ csqaqClient, openaiClient, logger });

  return { app, csqaqClient, openaiClient, logger };
}

test('GET /api/search-item returns normalized CSQAQ suggestions', async () => {
  const { app, csqaqClient } = createTestApp();
  const response = await request(app, '/api/search-item?query=AK');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    success: true,
    data: [{ id: '7310', name: 'AK-47 | 红线', market_hash_name: 'AK-47 | 红线' }]
  });
  assert.deepEqual(csqaqClient.calls[0], ['searchItems', 'AK']);
});

test('GET /api/search-item rejects empty queries', async () => {
  const { app } = createTestApp();
  const response = await request(app, '/api/search-item');

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { success: false, error: '请提供搜索关键词' });
});

test('GET /api/price-data/:itemId returns raw upstream payload inside data', async () => {
  const { app, csqaqClient } = createTestApp();
  const response = await request(app, '/api/price-data/7310');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.data.goods_info.id, 7310);
  assert.deepEqual(csqaqClient.calls[0], ['getGood', '7310']);
});

test('GET /api/sales-data/:itemId tolerates partial chart failures', async () => {
  const { app, csqaqClient, logger } = createTestApp();
  const response = await request(app, '/api/sales-data/7310?platform=2');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.sell_num_data.main_data, [12]);
  assert.equal(response.body.turnover_data, null);
  assert.deepEqual(response.body.price_data.main_data, [100]);
  assert.equal(logger.errors.length, 1);
  assert.deepEqual(
    csqaqClient.calls.filter(([name]) => name === 'getChart').map(([, call]) => [call.key, call.platform]),
    [
      ['sell_num', 2],
      ['turnover_number', 3],
      ['sell_price', 2]
    ]
  );
});

test('GET /api/hot-items keeps the public endpoint while returning hot series', async () => {
  const { app } = createTestApp();
  const response = await request(app, '/api/hot-items');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    success: true,
    data: [{ id: 1, name: '无涂装', total_value: 115535, sell_price_7: 0.62 }]
  });
});

test('POST /api/predict-price validates required prediction data', async () => {
  const { app } = createTestApp();
  const response = await request(app, '/api/predict-price', {
    method: 'POST',
    body: { itemName: 'AK-47' }
  });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { success: false, error: '缺少必要的预测数据' });
});

test('POST /api/predict-price sends built prompts to OpenAI client', async () => {
  const { app, openaiClient } = createTestApp();
  const response = await request(app, '/api/predict-price', {
    method: 'POST',
    body: { priceData: sampleGood, itemName: 'AK-47' }
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { success: true, prediction: '1. 价格趋势与供需分析: 测试预测' });
  assert.equal(openaiClient.calls.length, 1);
  assert.match(openaiClient.calls[0].systemPrompt, /10年经验/);
  assert.match(openaiClient.calls[0].userPrompt, /AK-47 \| Redline/);
});
