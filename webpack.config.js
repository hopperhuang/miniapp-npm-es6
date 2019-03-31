const path = require('path')

module.exports = {
    entry: './src/npm/index.js',
    output: {
        path: path.resolve(__dirname, 'dist/npm'),
        filename: 'index.js',
        libraryTarget: 'commonjs2',
    },
    mode: 'production'
}