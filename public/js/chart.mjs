import { buildSalesChartModel } from './chart-data.mjs';

let salesChartInstance = null;
let resizeObserver = null;

function createChartOption(model) {
  return {
    color: ['#147d64', '#b7791f', '#295c8a'],
    tooltip: { trigger: 'axis' },
    legend: {
      data: model.legendData,
      top: 0,
      textStyle: { color: '#3e4a45' }
    },
    grid: { top: 44, left: 48, right: 52, bottom: 48 },
    xAxis: {
      type: 'category',
      data: model.dates,
      axisLabel: { hideOverlap: true, color: '#66736e' },
      axisLine: { lineStyle: { color: '#cfd8d2' } }
    },
    yAxis: [
      {
        type: 'value',
        name: '数量',
        nameTextStyle: { color: '#66736e' },
        axisLabel: { color: '#66736e' },
        splitLine: { lineStyle: { color: '#edf1ec' } }
      },
      {
        type: 'value',
        name: '价格',
        nameTextStyle: { color: '#66736e' },
        axisLabel: { color: '#66736e' },
        splitLine: { show: false }
      }
    ],
    dataZoom: [{ type: 'slider', start: 45, end: 100, bottom: 6, height: 20 }],
    series: model.series
  };
}

export function renderSalesChart({ data, container, chartElement, selectedPlatformText }) {
  const model = buildSalesChartModel(data, selectedPlatformText);

  if (!model.hasData || !window.echarts) {
    container.hidden = true;
    return false;
  }

  container.hidden = false;

  if (!salesChartInstance) {
    salesChartInstance = window.echarts.init(chartElement);
  }

  salesChartInstance.setOption(createChartOption(model), true);

  if (resizeObserver) {
    resizeObserver.disconnect();
  }

  resizeObserver = new ResizeObserver(() => {
    salesChartInstance?.resize();
  });
  resizeObserver.observe(container);

  requestAnimationFrame(() => salesChartInstance?.resize());
  return true;
}

export function disposeSalesChart() {
  resizeObserver?.disconnect();
  resizeObserver = null;
  salesChartInstance?.dispose();
  salesChartInstance = null;
}
