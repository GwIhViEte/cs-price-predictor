const express = require('express');
const cors = require('cors');
const path = require('path');
const { loadConfig } = require('./config');
const { createApiRouter } = require('./routes/apiRoutes');
const { createCsqaqClient } = require('./services/csqaqClient');
const { createOpenAiClient } = require('./services/openaiClient');

function createApp({ config = loadConfig(), csqaqClient, openaiClient, logger = console } = {}) {
  const app = express();
  const resolvedCsqaqClient = csqaqClient || createCsqaqClient({ config: config.csqaq });
  const resolvedOpenAiClient = openaiClient || createOpenAiClient({ config: config.openai });

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(config.publicDir));

  app.get('/', (req, res) => {
    res.sendFile(path.join(config.publicDir, 'index.html'));
  });

  app.use(
    '/api',
    createApiRouter({
      csqaqClient: resolvedCsqaqClient,
      openaiClient: resolvedOpenAiClient,
      logger
    })
  );

  app.use((error, req, res, next) => {
    logger.error('服务器错误:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  });

  app.use((req, res) => {
    res.status(404).json({ success: false, error: '接口不存在' });
  });

  return app;
}

module.exports = {
  createApp
};
