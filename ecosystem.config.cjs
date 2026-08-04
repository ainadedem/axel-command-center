module.exports = {
  apps: [{
    name: "axel-command-center-ssr",
    script: "./.output/server/index.mjs",
    instances: 1,
    exec_mode: "fork",
    env: {
      NODE_ENV: "production",
      // Keep in sync with the nginx upstream on the VPS.
      // Override per-server with SSR_PORT to avoid an upstream/port mismatch.
      PORT: Number(process.env.SSR_PORT || 3009),
    },

    error_file: "./logs/ssr-error.log",
    out_file: "./logs/ssr-out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    merge_logs: true,
    autorestart: true,
    max_memory_restart: "1G",
    watch: false,
    ignore_watch: ["node_modules", ".output", "logs"],
  }],
};
