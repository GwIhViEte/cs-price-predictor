const axios = require('axios');

function extractResponseText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text;
  }

  const outputText = (payload?.output || [])
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === 'output_text' && typeof content.text === 'string')
    .map((content) => content.text)
    .join('');

  return outputText.trim() ? outputText : null;
}

function createOpenAiClient({ axiosInstance = axios, config } = {}) {
  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json'
  };

  async function createResponse({ systemPrompt, userPrompt }) {
    const response = await axiosInstance.post(
      `${config.baseURL}/responses`,
      {
        model: config.model,
        instructions: systemPrompt,
        input: userPrompt,
        store: false
      },
      { headers }
    );

    const content = extractResponseText(response.data);
    if (!content) {
      throw new Error('OpenAI 响应为空');
    }

    return content;
  }

  return {
    createResponse,
    createChatCompletion: createResponse
  };
}

module.exports = {
  createOpenAiClient,
  extractResponseText
};
