const { createApp } = require('./src/app');
const { loadConfig } = require('./src/config');

const config = loadConfig();
const app = createApp({ config });

app.listen(config.port, () => {
  console.log(`Server running at http://localhost:${config.port}`);
});
