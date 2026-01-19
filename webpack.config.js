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
        function ({ request }, callback) {
            if (request.includes('../../..')) {
                return callback(null, `module ${request}`);
            }
            callback();
        },
    ],
    resolve: {
        extensions: ['.ts', '.tsx', '.js'],
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
                { from: 'src/ui/stateEditor.css', to: 'stateEditor.css' },  // Add this
            ]
        }),
    ],
};
