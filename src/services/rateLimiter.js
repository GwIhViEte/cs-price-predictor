function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createRateLimiter({ intervalMs = 1000, sleep = delay, now = Date.now } = {}) {
  let nextAvailableAt = 0;
  let queue = Promise.resolve();

  async function waitForTurn() {
    const current = now();
    const waitMs = Math.max(0, nextAvailableAt - current);

    if (waitMs > 0) {
      await sleep(waitMs);
    }

    nextAvailableAt = Math.max(now(), nextAvailableAt) + intervalMs;
  }

  return {
    wait() {
      const turn = queue.then(waitForTurn);
      queue = turn.catch(() => undefined);
      return turn;
    }
  };
}

function createNoopRateLimiter() {
  return {
    wait: async () => undefined
  };
}

module.exports = {
  createNoopRateLimiter,
  createRateLimiter
};
