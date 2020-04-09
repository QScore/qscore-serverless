const path = require('path');
const nodeExternals = require('webpack-node-externals');
const slsw = require('serverless-webpack');

module.exports = {
    context: __dirname,
    mode: slsw.lib.webpack.isLocal ? 'development' : 'production',
    entry: slsw.lib.entries,
    devtool: slsw.lib.webpack.isLocal ? 'cheap-module-eval-source-map' : 'source-map',
    target: 'node',
    externals: [nodeExternals()],
    output: {
        libraryTarget: 'commonjs',
        path: path.join(__dirname, '.webpack'),
        filename: '[name].js'
    },
    devtool: 'source-map',
    resolve: {
        extensions: ['.mjs', '.json', '.ts'],
        symlinks: false,
        cacheWithContext: false,
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                exclude: [
                    [
                        path.resolve(__dirname, 'node_modules'),
                        path.resolve(__dirname, '.serverless'),
                        path.resolve(__dirname, '.webpack'),
                    ],
                ],
                options: {
                    transpileOnly: true,
                    experimentalWatchApi: true,
                }
            }
        ]
    }
};