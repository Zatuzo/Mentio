module.exports = {
  apps: [
    {
      name: 'mentio-web',
      script: 'node_modules/.bin/next',
      args: 'start -p 9000',
      cwd: './',
      env: { NODE_ENV: 'production' },
      restart_delay: 3000,
      max_restarts: 10,
    },
    {
      name: 'mentio-listener',
      script: 'src/listener.js',
      cwd: './',
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 20,
    },
    {
      name: 'mentio-sessions',
      script: 'src/session-manager.js',
      cwd: './',
      env: { NODE_ENV: 'production' },
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
