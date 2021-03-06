# Install

Immutable styles can be integrated with Webpack using the [Webpack plugin](https://github.com/callum-hart/immutable-styles/blob/master/src/integrations/webpack-plugin.js).

> 🔮 Support for other build systems (such as Parcel) will be added in future releases.

The first step is to install the dependency `immutable-styles`:

```
npm install immutable-styles
```

Next, since immutable styles uses JSX the following devDependencies are required:

```
npm install --save-dev @babel/core
npm install --save-dev @babel/preset-env
npm install --save-dev @babel/plugin-transform-react-jsx
npm install --save-dev @babel/plugin-transform-react-jsx-source
npm install --save-dev babel-loader
```

> ###### Note on devDependencies

> It would be reasonable to assume the packages `@babel/plugin-transform-react-jsx` and `@babel/plugin-transform-react-jsx-source` indicate that immutable styles is coupled to React. Don't let the package names fool you! These packages enable immutable styles to use JSX and nothing more. Immutable styles is markup agnostic – meaning it isn’t coupled or biased to a specific way of generating HTML.

## Configure Plugin

In `webpack.config.js` add the `ImmutableStylesWebpackPlugin`:

```js
var { ImmutableStylesWebpackPlugin } = require('immutable-styles');

module.exports = {
  plugins: [
    new ImmutableStylesWebpackPlugin()
  ]
}
```

Then enable source-maps and set nodes `fs` module to [empty](https://webpack.js.org/configuration/node/#other-node-core-libraries):

```js
module.exports = {
  /* ... */
  devtool: "source-map",
  node: {
    fs: 'empty'
  }
}
```

> ###### Note on Source Maps

> Source maps are required for compile-time errors. If source maps are not enabled the error `Missing Source Maps` will be thrown.

By default the CSS generated by immutable styles is located in `dist/bundle.css`. This can be *optionally* configured when initialising the plugin:

```js
module.exports = {
  plugins: [
    new ImmutableStylesWebpackPlugin({
      dist: './custom-path-to-file.css'
    })
  ],
  /* ... */
}
```

Then make sure the immutable style sheets are passed through `babel-loader`:

```js
module.exports = {
  /* .. */
  module: {
    rules: [
      {
        test: /\.iss\.jsx)$/,
        exclude: /node_modules/,
        use: 'babel-loader'
      }
    ]
  },
  /* ... */
]
```

And lastly in `.babelrc` register the following presets and plugins:

```js
{
  "presets": [
    [
      "@babel/preset-env",
      {
        "modules": "commonjs"
      }
    ]
  ],
  "plugins": [
    "@babel/plugin-transform-react-jsx",
    "@babel/transform-react-jsx-source"
  ]
}
```

## Examples

Some examples of using immutable styles with Webpack can be found in the following repos:

- [immutable-styles-html-example](https://github.com/callum-hart/immutable-styles-html-examples): which shows how to use immutable styles with plain HTML
- [immutable-styles-react-example](https://github.com/callum-hart/immutable-styles-react-examples): which shows how to use immutable styles with React