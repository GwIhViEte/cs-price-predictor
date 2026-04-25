const assert = require('node:assert/strict');
const test = require('node:test');
const { createOpenAiClient, extractResponseText } = require('../src/services/openaiClient');

test('extractResponseText reads the Responses API output_text convenience field', () => {
  assert.equal(extractResponseText({ output_text: '预测结果' }), '预测结果');
});

test('extractResponseText reads nested Responses API content blocks', () => {
  assert.equal(
    extractResponseText({
      output: [
        {
          type: 'message',
          content: [
            { type: 'output_text', text: '第一段' },
            { type: 'output_text', text: '第二段' }
          ]
        }
      ]
    }),
    '第一段第二段'
  );
});

test('createOpenAiClient posts prediction prompts to /responses', async () => {
  const calls = [];
  const axiosInstance = {
    async post(url, body, options) {
      calls.push({ url, body, options });
      return { data: { output_text: '1. 测试预测' } };
    }
  };
  const client = createOpenAiClient({
    axiosInstance,
    config: {
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'test-key',
      model: 'gpt-4.1-mini'
    }
  });

  const text = await client.createResponse({
    systemPrompt: '系统提示',
    userPrompt: '用户提示'
  });

  assert.equal(text, '1. 测试预测');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.openai.com/v1/responses');
  assert.deepEqual(calls[0].body, {
    model: 'gpt-4.1-mini',
    instructions: '系统提示',
    input: '用户提示',
    store: false
  });
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-key');
});
