const fs = require('fs');


const ImmutableStyles = require('immutable-styles');
const { ErrorWithData } = ImmutableStyles;


function isImmutableStyleModule(resourceName) {
  return typeof(resourceName) !== 'undefined' &&
    resourceName.endsWith('.iss.jsx'); // .iss => Immutable Style Sheet 
}

function isSoureMapEnabled(moduleSource) {
  return typeof(moduleSource._sourceMap) !== 'undefined';
}

// throws error: when file contains a JavaScript error (i.e: variable is not defined)
function buildAST(modules) {
  return modules.filter(module => isImmutableStyleModule(module.resource))
    .map(module => {
      const fileName = module.resource;
      const fileSource = module._source;

      try {
        if (isSoureMapEnabled(fileSource)) {
          ImmutableStyles.saveSourceMap(fileName, fileSource._sourceMap.sourcesContent[0]);
          return eval(fileSource._value); // todo: use https://www.npmjs.com/package/safer-eval
        } else {
          // todo: log prompt to enable source maps (https://webpack.js.org/configuration/devtool/)
          console.log('source maps not enabled 🙁');
        }
      } catch (err) {
        // todo: log error to console `ImmutableStyles.logError`
        throw new ErrorWithData(
          err.message,
          {
            fileName,
            fileSource
          }
        );
      }
    })
    // flatten AST
    .reduce((acc, curr) => Array.isArray(curr)
      ? acc.concat([...curr])
      : acc.concat(curr)
    , []);
}

class ImmutableStylesPlugin {
  constructor({dist = './dist/bundle.css'}) {
    this.dist = dist;
  }

  apply(compiler) {
    compiler.plugin('compilation', (compilation) => {
      compilation.plugin('finish-modules', (modules) => {
        // Discard the previous AST and build a new one. This is because (like CSS)
        // immutable styles are global. A style in fileA can effect styles in fileB,
        // fileC, fileD et-cetera.
        ImmutableStyles.tearDown();

        try {
          const CSS = ImmutableStyles.createCSS(buildAST(modules));

          fs.writeFile(this.dist, CSS, 'utf8', (err) => {
            if (err) throw err;
          });
        } catch (err) {
          console.log(err);
          compilation.errors.push(err);
        }
      });
    });
  }
}

module.exports = ImmutableStylesPlugin;