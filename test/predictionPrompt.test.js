const assert = require('node:assert/strict');
const test = require('node:test');
const { buildPredictionMessages, formatRate, getGoodsInfo } = require('../src/services/predictionPrompt');

test('formatRate keeps numeric rates stable and fills missing values', () => {
  assert.equal(formatRate(1.234), '1.23');
  assert.equal(formatRate('2'), '2.00');
  assert.equal(formatRate(undefined), '0.00');
});

test('getGoodsInfo reads the CSQAQ good detail shape used by the frontend', () => {
  const goodsInfo = { id: 7310 };
  assert.equal(getGoodsInfo({ data: { goods_info: goodsInfo } }), goodsInfo);
  assert.equal(getGoodsInfo({}), null);
});

test('buildPredictionMessages keeps the investment-analysis prompt contract', () => {
  const messages = buildPredictionMessages({
    itemName: '兜底名称',
    priceData: {
      data: {
        goods_info: {
          market_hash_name: 'M4A1-S | Printstream',
          buff_sell_price: 100,
          yyyp_sell_price: 99,
          steam_sell_price: 120,
          buff_sell_num: 12,
          yyyp_sell_num: 8,
          steam_sell_num: 3,
          turnover_number: 5,
          sell_price_rate_1: 1.1,
          sell_price_rate_7: -2.25,
          sell_price_rate_30: 3
        }
      }
    }
  });

  assert.match(messages.systemPrompt, /顶级CS饰品市场数据分析师/);
  assert.match(messages.userPrompt, /M4A1-S \| Printstream/);
  assert.match(messages.userPrompt, /1日涨跌: 1.10%/);
  assert.match(messages.userPrompt, /7日涨跌: -2.25%/);
  assert.match(messages.userPrompt, /每个问题的回答用数字序号开头/);
});

test('buildPredictionMessages rejects malformed price payloads', () => {
  assert.throws(
    () => buildPredictionMessages({ itemName: 'AK-47', priceData: { data: {} } }),
    /缺少饰品价格详情/
  );
});
