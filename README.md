# mc-stats-tracker

Simple node.js app to track statistics from the Modrinth API and present them in a json endpoint.

To setup and run, assuming [npm](https://www.npmjs.com/) is available:

```sh
npm install
npm run build
npm run start
```

*You can use the following pm2 command if you want to run it in the background:*

```sh
npm install
npm run build
pm2 start npm --name "mc_stats_tracker" -- start
```