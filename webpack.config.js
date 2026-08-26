const CopyPlugin = require('copy-webpack-plugin');
const HandlebarsPlugin = require('handlebars-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const RemoveEmptyScriptsPlugin = require('webpack-remove-empty-scripts');
const TerserPlugin = require('terser-webpack-plugin');
const path = require('path');
const pkg = require('./package.json');

const site = require('./src/data/site.json');
const menu = require('./src/data/menu.json');

const paths = {
  src: {
    favicon: './src/favicon',
    img: './src/optimized',
    static: './src/static',
    js: './src/js',
    scss: './src/scss',
  },
  dist: {
    css: './assets/css',
    favicon: './assets/favicon',
    img: './assets/img',
    js: './assets/js',
  },
};

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    // Source maps used to be emitted unconditionally, which published 5.95 MB of
    // .map files to the CDN for no user benefit.
    devtool: isProduction ? false : 'source-map',
    mode: argv.mode || 'development',
    entry: {
      theme: [paths.src.js + '/theme.js', paths.src.scss + '/theme.scss'],
    },
    module: {
      rules: [
        {
          test: /\.(sass|scss)$/,
          include: path.resolve(__dirname, paths.src.scss.slice(2)),
          use: [
            { loader: MiniCssExtractPlugin.loader },
            { loader: 'css-loader', options: { url: false } },
            {
              loader: 'postcss-loader',
              options: { postcssOptions: { plugins: [['autoprefixer']] } },
            },
            { loader: 'sass-loader' },
          ],
        },
      ],
    },
    optimization: {
      minimizer: [
        new CssMinimizerPlugin(),
        new TerserPlugin({
          extractComments: false,
          terserOptions: { output: { comments: false } },
        }),
      ],
    },
    output: {
      filename: paths.dist.js + '/[name].bundle.js',
      clean: true,
    },
    performance: {
      // Guard rail, not a style preference. theme.bundle.js is ~3 KB of hand-written
      // vanilla and the CSS is a trimmed Bootstrap at ~213 KB raw / ~30 KB gzip.
      // If either blows past this, a heavy dependency has crept back in — the old
      // vendor bundle was 2.99 MB and would trip this instantly.
      // Images are excluded: they are budgeted by tools/optimize-images.py.
      hints: isProduction ? 'error' : false,
      maxEntrypointSize: 260 * 1024,
      maxAssetSize: 260 * 1024,
      assetFilter: (asset) => /\.(js|css)$/.test(asset),
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          { from: paths.src.favicon, to: paths.dist.favicon },
          // Only the generated derivatives ship. src/img holds the ~180 MB of
          // camera originals and must never be copied into the build.
          { from: paths.src.img, to: paths.dist.img },
          // robots.txt / sitemap.xml land at the site root.
          { from: paths.src.static, to: '.' },
        ],
      }),
      new HandlebarsPlugin({
        entry: path.join(process.cwd(), 'src', 'html', '**', '*.html'),
        output: path.join(process.cwd(), 'dist', '[path]', '[name].html'),
        partials: [path.join(process.cwd(), 'src', 'partials', '**', '*.{html,svg}')],

        data: { menu, site },

        helpers: {
          is: function (v1, v2, options) {
            const variants = v2.split(' || ');
            return variants.some((variant) => v1 === variant) ? options.fn(this) : options.inverse(this);
          },
          isnt: function (v1, v2, options) {
            return v1 !== v2 ? options.fn(this) : options.inverse(this);
          },
          eq: function (v1, v2) {
            return v1 === v2;
          },
          themeVersion: function () {
            return '{{themeVersion}}';
          },

          // Menu images are addressed by the derivative stem, not the original
          // filename: "orange.chicken.jpg" -> "orange-chicken".
          imgStem: function (filename) {
            if (!filename) return '';
            return filename.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          },

          // 52 of 97 dishes carry the placeholder filename, meaning "no photo".
          // Those rows render as text rather than repeating one grey image.
          hasPhoto: function (filename, options) {
            const real = filename && filename !== 'default.jpg';
            return real ? options.fn(this) : options.inverse(this);
          },

          // Group the flat menu.json into its categories, preserving the order
          // declared in site.json so the page and the nav can't drift apart.
          menuByCategory: function (items, options) {
            return site.menuCategories
              .map((category) => ({
                ...category,
                items: items.filter((item) => item.category === category.name),
              }))
              .filter((category) => category.items.length)
              .map((category) => options.fn(category))
              .join('');
          },

          year: function () {
            return String(new Date().getFullYear());
          },
        },

        onBeforeSave: function (Handlebars, resultHtml) {
          return resultHtml.replaceAll('{{themeVersion}}', pkg.version);
        },
      }),
      new RemoveEmptyScriptsPlugin(),
      new MiniCssExtractPlugin({ filename: paths.dist.css + '/[name].bundle.css' }),
    ],
    devServer: {
      static: { directory: path.join(__dirname, 'dist') },
      watchFiles: ['src/html/**/*', 'src/partials/**/*', 'src/data/**/*'],
    },
    target: 'web',
  };
};
