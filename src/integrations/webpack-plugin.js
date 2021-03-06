const fs = require('fs');

const { createCSS, tearDown } = require('../core');
const { saveSourceMap, logBuildError, logEnableWebpackSourceMaps } = require('../errorReporting');

function isImmutableStylesModule(resourceName) {
  return typeof(resourceName) !== 'undefined' &&
    resourceName.endsWith('.iss.jsx'); // .iss => Immutable Styles Sheet
}

function isSoureMapEnabled(moduleSource) {
  return typeof(moduleSource._sourceMap) !== 'undefined';
}

// throws error when file:
// - contains a JavaScript error (i.e: variable is not defined)
// - contains shorthand helper with invalid arity
function buildAST(modules) {
  return modules.filter(module => isImmutableStylesModule(module.resource))
    .map(module => {
      const fileName = module.resource;
      const fileSource = module._source;

      try {
        if (isSoureMapEnabled(fileSource)) {
          saveSourceMap(fileName, fileSource._sourceMap.sourcesContent[0]);
          return eval(fileSource._value); // use https://www.npmjs.com/package/safer-eval instead?
        } else {
          logEnableWebpackSourceMaps();
        }
      } catch ({name, message}) {
        logBuildError(fileName, name, message);
        throw new Error(`[${name}] ${message}`);
      }
    })
    // flatten AST
    .reduce((acc, curr) => Array.isArray(curr)
      ? acc.concat([...curr])
      : acc.concat(curr)
    , []);
}

class ImmutableStylesWebpackPlugin {
  constructor({dist = './dist/bundle.css'}) {
    this.dist = dist;
  }

  apply(compiler) {
    compiler.hooks.compilation.tap('compilation', compilation => {
      compilation.hooks.finishModules.tap('finish-modules', modules => {
        // Discard the previous AST and build a new one. This is because (like CSS)
        // immutable styles are global. A style in fileA can effect styles in fileB,
        // fileC, fileD et-cetera.
        tearDown();

        try {
          const CSS = createCSS(buildAST(modules), true);

          fs.writeFile(this.dist, CSS, 'utf8', (err) => {
            if (err) throw err;
          });
        } catch (err) {
          compilation.errors.push(err);
        }
      });
    });
  }
}

module.exports = ImmutableStylesWebpackPlugin;