module.exports = function (api) {
    api.cache(true);
    return {
        presets: [['babel-preset-expo', {unstable_transformImportMeta: true}]],
        plugins: [
            // Unistyles' Babel plugin rewrites StyleSheet.create calls so styles
            // resolve on the native side. It must run before Reanimated's.
            ['react-native-unistyles/plugin', {root: 'src'}],
            'react-native-worklets/plugin',
        ],
    };
};
