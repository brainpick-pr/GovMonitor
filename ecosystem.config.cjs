const path = require('path');

module.exports = {
  apps: [
    {
      name: 'govmonitor-backend',
      cwd: __dirname,
      script: 'npx',
      args: 'wrangler dev --port 8787',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development',
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
    },
    {
      name: 'govmonitor-frontend',
      cwd: path.join(__dirname, 'frontend'),
      script: 'npx',
      args: 'vite --port 5174 --host',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development',
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
    },
  ],
};
