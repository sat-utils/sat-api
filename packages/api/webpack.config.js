const path = require('path')
const ZipPlugin = require('zip-webpack-plugin')
const CopyPlugin = require('copy-webpack-plugin')

let mode = 'development'
let devtool = 'inline-source-map'

if (process.env.PRODUCTION) {
  mode = 'production'
  devtool = false
}

module.exports = {
  mode,
  entry: './index.js',
  output: {
    libraryTarget: 'commonjs2',
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist')
  },
  externals: [
    'aws-sdk'
  ],
  devtool,
  optimization: {
    usedExports: true
  },
  target: 'node',
  plugins: [
    new CopyPlugin([
      {
        from: 'api.yaml',
        to: 'api.yaml'
      }
    ]),
    new ZipPlugin({
      filename: 'api.zip'
    })
  ]
}
