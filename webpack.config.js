const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
    mode: 'development',
    devtool: 'source-map',
    entry: './src/index.ts',
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'dist'),
        library: {
            type: 'module'
        }
    },
    experiments: {
        outputModule: true
    },
    externalsType: 'module',
    externals: [
        function ({ context, request }, callback) {
            // Only externalize paths that go OUTSIDE the extension directory
            // (i.e., paths to SillyTavern core files)
            if (request.includes('../../..')) {
                // Resolve the full path to check if it's outside our extension
                const resolved = path.resolve(context, request);
                const extensionRoot = path.resolve(__dirname, 'src');
                const nodeModulesRoot = path.resolve(__dirname, 'node_modules');

                // If the resolved path is NOT inside our src directory AND
                // NOT inside our node_modules directory, it's external
                if (!resolved.startsWith(extensionRoot) && !resolved.startsWith(nodeModulesRoot)) {
                    return callback(null, `module ${request}`);
                }
            }
            callback();
        },
    ],
    resolve: {
        extensions: ['.ts', '.tsx', '.js'],
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: 'src/ui/stateDisplay.css', to: 'stateDisplay.css' },
                { from: 'src/ui/stateEditor.css', to: 'stateEditor.css' },
                { from: 'src/ui/settings.css', to: 'settings.css' },
                { from: 'src/ui/cardDefaults.css', to: 'cardDefaults.css' },
                { from: 'src/v2/ui/V2NarrativeModal.css', to: 'V2NarrativeModal.css' },
            ]
        }),
    ],
};
