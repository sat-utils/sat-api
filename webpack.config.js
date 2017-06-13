const path = require('path');
const glob = require('glob');
const pckg = require('./package.json');

function getEntries() {
  const output = glob.sync('./lambdas/*')
    .map((filename) => {
      const entry = {};
      entry[path.basename(filename)] = filename;
      return entry;
    })
    .reduce((finalObject, entry) => Object.assign(finalObject, entry), {});

  return output;
}

module.exports = {
  entry: getEntries(),
  output: {
    path: path.join(__dirname, 'dist'),
    library: '[name]',
    libraryTarget: 'commonjs2',
    filename: '[name]/index.js'
  },
  target: 'node',
  externals: [
    'aws-sdk'
  ],
  node: {
    __dirname: false,
    __filename: false
  },
  resolve: {
    symlinks: false,
    alias: {
      'aws-sdk': 'aws-sdk/dist/aws-sdk'
    }
  },
  module: {
    rules: [
      {
        test: /\.json$/,
        loader: 'json-loader'
      },
      {
        test: /\.js$/,
        loader: './lib/fix-loader'
      },
      {
        include: glob.sync('./lambdas/*/index.js', { realpath: true })
                     .map(filename => path.resolve(__dirname, filename)),
        exclude: /node_modules/,
        loader: 'prepend-loader',
        query: {
          data: "if (!global._babelPolyfill) require('babel-polyfill');"
        }
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        options: pckg.babel
      }
    ]
  }
};
