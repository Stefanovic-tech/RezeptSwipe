// PM2 ecosystem fuer RezeptSwipe (Windows Server)
// Start: pm2 start ecosystem.config.cjs --only rezeptswipe
// Reload: pm2 reload rezeptswipe
// Logs:   pm2 logs rezeptswipe

module.exports = {
  apps: [
    {
      name: "rezeptswipe",
      cwd: __dirname,
      // Auf Windows wird npm.cmd ueber Node aufgerufen.
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3015",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      time: true,
      env_production: {
        NODE_ENV: "production",
        APP_PORT: "3015",
        // Restliche Variablen kommen aus .env (von Next.js geladen).
      },
      // Logs werden zusaetzlich von pm2-logrotate gerollt
      error_file: "logs/pm2-error.log",
      out_file: "logs/pm2-out.log",
      merge_logs: true,
      kill_timeout: 5000,
      listen_timeout: 8000,
    },
  ],
};
