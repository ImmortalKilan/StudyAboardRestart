const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const MpPlugin = require('mp-webpack-plugin');

// Minifier deps (optimize-css-assets-webpack-plugin / terser-webpack-plugin)
// deliberately left out of package.json for this spike — the former only
// supports webpack@4 as a peer, which conflicts with webpack@5 here. Not
// worth pulling in for a feasibility test; revisit when this becomes the
// real build.
const isOptimize = false;

module.exports = {
  mode: 'production', // kbone docs: avoid 'development' — it can emit eval(), which mini programs reject
  entry: {
    alloc: path.resolve(__dirname, 'src/alloc/main.mp.js'),
  },
  output: {
    path: path.resolve(__dirname, './miniprogram/common'),
    filename: '[name].js',
    library: 'createApp',      // required — do not rename
    libraryExport: 'default',  // required — do not rename
    libraryTarget: 'window',   // required — do not rename
  },
  target: 'web', // required
  optimization: {
    runtimeChunk: false, // required
    splitChunks: {
      chunks: 'all', minSize: 1000, maxSize: 0, minChunks: 1,
      maxAsyncRequests: 100, maxInitialRequests: 100, automaticNameDelimiter: '~',
      cacheGroups: {
        vendors: { test: /[\\/]node_modules[\\/]/, priority: -10 },
        default: { minChunks: 2, priority: -20, reuseExistingChunk: true },
      },
    },
    minimizer: isOptimize ? [
      // re-add optimize-css-assets-webpack-plugin / terser-webpack-plugin
      // here (and to package.json) once this graduates from spike to real build
    ] : [],
  },
  module: {
    rules: [
      { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] },
      {
        // images: kbone can't resolve relative paths, must inline as base64
        // (this spike has none yet, but the real port will need this for
        // assets/avatars, assets/ui/qr-code.png, achievement icons, etc.)
        test: /\.(png|jpg|jpeg|gif|svg)$/,
        type: 'asset/inline',
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.isMiniprogram': process.env.isMiniprogram || 'true',
    }),
    new MiniCssExtractPlugin({ filename: '[name].wxss' }),
    new MpPlugin({
      origin: 'https://alloc-spike.local',
      entry: '/',
      router: {
        alloc: ['/', '/alloc'],
      },
      projectConfig: {
        // "touristappid" lets WeChat DevTools open this project locally
        // without a real registered AppID — useful for testing this spike
        // before the real developer account comes through.
        appid: 'touristappid',
        projectname: 'alloc-spike',
      },
    }),
  ],
};
