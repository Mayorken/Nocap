const config = require('./app.json');

module.exports = {
  ...config.expo,
  experiments: {
    ...config.expo.experiments,
    // GitHub Pages lives under /Nocap; Vercel serves the same app at the root.
    baseUrl: process.env.VERCEL ? '' : '/Nocap',
  },
};
