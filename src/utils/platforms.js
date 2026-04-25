const SUPPORTED_PLATFORMS = new Set([1, 2, 3]);

function parsePlatform(value, fallback = 1) {
  const platform = Number.parseInt(value, 10);
  return SUPPORTED_PLATFORMS.has(platform) ? platform : fallback;
}

module.exports = {
  parsePlatform
};
