module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module:react-native-dotenv', {
        moduleName: '@env',
        path: '.env',
        blacklist: null,
        whitelist: ['API_BASE_URL', 'OPENAI_API_KEY'],
        safe: true,
        allowUndefined: false,
      }],
      '@babel/plugin-proposal-optional-chaining',
      '@babel/plugin-proposal-nullish-coalescing-operator',
      'react-native-reanimated/plugin',
    ],
  };
};
