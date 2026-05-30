module.exports = {
  apps: [
    {
      name: "trade-api",
      script: "pnpm",
      args: "api:start",
      env: {
        NODE_ENV: "production",
        API_HOST: "127.0.0.1",
        PORT: "3000",
      },
      // Phase 1 uses scripts/run-ts.mjs for a minimal migration step.
      // Production should switch this process to a built dist/server entry.
      // DATABASE_URL and REDIS_URL are inherited from the server environment,
      // or loaded from a local .env file by src/server/trade-api.ts.
    },
  ],
};
