const original = require('./app.json').expo;

module.exports = () => ({
  ...original,
  plugins: original.plugins.map((plugin) =>
    plugin === 'expo-router' && process.env.INTELLIDEPLOY_COMPONENT_FIXTURE === '1'
      ? ['expo-router', { root: './e2e/component-fixture-app' }]
      : plugin,
  ),
});
