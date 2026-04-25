import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSalesChartModel } from '../public/js/chart-data.mjs';
import { changeClass, fallbackText, formatCurrency, formatPercent, toNumber } from '../public/js/format.mjs';

test('frontend format helpers keep price and change display stable', () => {
  assert.equal(toNumber('12.5'), 12.5);
  assert.equal(toNumber('bad', 9), 9);
  assert.equal(formatCurrency(1200), '¥1,200');
  assert.equal(formatPercent(1.234), '+1.23%');
  assert.equal(formatPercent(-2), '-2.00%');
  assert.equal(changeClass(-0.1), 'negative');
  assert.equal(fallbackText(null), '-');
});

test('buildSalesChartModel merges chart timestamps into aligned series', () => {
  const model = buildSalesChartModel(
    {
      sell_num_data: {
        timestamp: [1000, 3000],
        main_data: [12, 10]
      },
      turnover_data: {
        timestamp: [2000],
        main_data: [4]
      },
      price_data: {
        timestamp: [1000, 3000],
        main_data: [99, 101]
      }
    },
    'BUFF'
  );

  assert.equal(model.hasData, true);
  assert.deepEqual(model.legendData, ['在售数量 (BUFF)', '成交量 (Steam)', '价格 (BUFF)']);
  assert.deepEqual(model.series.map((series) => series.name), ['在售数量 (BUFF)', '成交量 (Steam)', '价格 (BUFF)']);
  assert.deepEqual(model.series[0].data, [12, null, 10]);
  assert.deepEqual(model.series[1].data, [null, 4, null]);
  assert.deepEqual(model.series[2].data, [99, null, 101]);
});

test('buildSalesChartModel reports empty state when all upstream charts are missing', () => {
  const model = buildSalesChartModel(
    { sell_num_data: null, turnover_data: null, price_data: null },
    'Steam'
  );

  assert.equal(model.hasData, false);
  assert.deepEqual(model.series, []);
});
