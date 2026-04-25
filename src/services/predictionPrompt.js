const SYSTEM_PROMPT = '你是一位拥有10年经验的顶级CS饰品市场数据分析师。';

function formatRate(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '0.00';
}

function valueOrFallback(value, fallback = 'N/A') {
  return value === undefined || value === null || value === '' ? fallback : value;
}

function getGoodsInfo(priceData) {
  return priceData?.data?.goods_info || null;
}

function buildPredictionMessages({ priceData, itemName }) {
  const itemInfo = getGoodsInfo(priceData);
  if (!itemInfo) {
    throw new Error('缺少饰品价格详情');
  }

  const salesSummary = `
- BUFF在售数量: ${valueOrFallback(itemInfo.buff_sell_num)}
- 悠悠有品在售数量: ${valueOrFallback(itemInfo.yyyp_sell_num)}
- Steam在售数量: ${valueOrFallback(itemInfo.steam_sell_num)}
- Steam市场最近日成交量: ${valueOrFallback(itemInfo.turnover_number)}`;

  const userPrompt = `你是一位顶级的CS饰品市场数据分析师。请根据以下提供的实时数据和历史价格，对饰品进行一次全面、深入的投资分析。

饰品名称: ${itemInfo.market_hash_name || itemName}

1. 历史价格参考:
- 1日涨跌: ${formatRate(itemInfo.sell_price_rate_1)}%
- 7日涨跌: ${formatRate(itemInfo.sell_price_rate_7)}%
- 30日涨跌: ${formatRate(itemInfo.sell_price_rate_30)}%

2. 当前市场快照 (价格):
- BUFF售价: ¥${valueOrFallback(itemInfo.buff_sell_price)}
- 悠悠有品售价: ¥${valueOrFallback(itemInfo.yyyp_sell_price)}
- Steam售价: ¥${valueOrFallback(itemInfo.steam_sell_price)}

3. 当前供需数据:
${salesSummary}

分析要求:
- 请注意：任何饰品在购买后会获得7天的交易冷却时间！
- 请注意：CS饰品市场是很情绪化的，你在分析的时候需要注意这一点。
- 请注意：在最近的更新中添加了交易撤回功能，现在卖饰品的钱要在交易平台冻结7天！
- 关于各交易平台手续费：悠悠有品：1%，BUFF：2.5%，Steam：15%（买家付款＝卖家收款+卖家收款×15％）。
- 关于各交易平台提现费：最低提现金额为10元，悠悠有品：1%（最低2元），BUFF：1%，Steam无法提现。
- 请注意：如果Steam平台的价格为0，则不考虑Steam平台。

请基于以上所有信息，进行分析并回答以下问题:
1. 价格趋势与供需分析: 结合价格历史和近期的在售数量、成交量变化，判断当前价格趋势，并分析供需关系。
2. 平台选择建议: 哪个平台可能存在购买机会？通过计算最后到手的钱，得出作为卖家，在考虑交易手续费和提现手续费的情况下去哪个平台出售会获得最佳收益？
3. 短期（1-7天）价格预测: 综合所有信息，预测接下来的短期价格走势（上涨、下跌、盘整），并给出核心理由。
4. 中期（8-15天）价格预测: 综合所有信息，预测接下来的短期价格走势（上涨、下跌、盘整），并给出核心理由。
5. 长期（15天以上）价格预测: 综合所有信息，预测接下来的短期价格走势（上涨、下跌、盘整），并给出核心理由。
6. 投资建议: 给出明确的投资建议。

重要格式要求:
- 使用简洁的文字格式回答，不要使用markdown语法
- 每个问题的回答用数字序号开头，如"1. "
- 段落之间用空行分隔`;

  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt
  };
}

module.exports = {
  SYSTEM_PROMPT,
  buildPredictionMessages,
  formatRate,
  getGoodsInfo
};
