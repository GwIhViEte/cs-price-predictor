function dateLabel(timestamp) {
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit'
  });
}

function collectSeries(bucket, chartData, fieldName) {
  if (!chartData?.timestamp || !chartData?.main_data) {
    return;
  }

  chartData.timestamp.forEach((timestamp, index) => {
    if (!bucket.has(timestamp)) {
      bucket.set(timestamp, {});
    }

    bucket.get(timestamp)[fieldName] = chartData.main_data[index];
  });
}

function hasChartData(chartData) {
  return Array.isArray(chartData?.timestamp) && chartData.timestamp.length > 0;
}

export function buildSalesChartModel(data, selectedPlatformText) {
  const bucket = new Map();
  const legendData = [];

  if (hasChartData(data.sell_num_data)) {
    legendData.push(`在售数量 (${selectedPlatformText})`);
    collectSeries(bucket, data.sell_num_data, 'sellNum');
  }

  if (hasChartData(data.turnover_data)) {
    legendData.push('成交量 (Steam)');
    collectSeries(bucket, data.turnover_data, 'turnover');
  }

  if (hasChartData(data.price_data)) {
    legendData.push(`价格 (${selectedPlatformText})`);
    collectSeries(bucket, data.price_data, 'price');
  }

  const timestamps = [...bucket.keys()].sort((a, b) => a - b);
  const dates = timestamps.map(dateLabel);
  const series = [];

  if (legendData.includes(`在售数量 (${selectedPlatformText})`)) {
    series.push({
      name: `在售数量 (${selectedPlatformText})`,
      type: 'line',
      smooth: true,
      yAxisIndex: 0,
      data: timestamps.map((timestamp) => bucket.get(timestamp).sellNum ?? null)
    });
  }

  if (legendData.includes('成交量 (Steam)')) {
    series.push({
      name: '成交量 (Steam)',
      type: 'bar',
      yAxisIndex: 0,
      data: timestamps.map((timestamp) => bucket.get(timestamp).turnover ?? null)
    });
  }

  if (legendData.includes(`价格 (${selectedPlatformText})`)) {
    series.push({
      name: `价格 (${selectedPlatformText})`,
      type: 'line',
      smooth: true,
      yAxisIndex: 1,
      data: timestamps.map((timestamp) => bucket.get(timestamp).price ?? null)
    });
  }

  return {
    dates,
    legendData,
    series,
    hasData: series.length > 0
  };
}
