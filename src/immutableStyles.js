const elementPropertyWhitelist = require('./elementPropertyWhitelist');
const forbiddenPropertyCombinations = require('./forbiddenPropertyCombinations');
const {
  saveSourceMap,
  clearSourceMaps,
  logInvalidAttribute,
  logDuplicateProperty,
  logExactOverrideFound,
  logPartialOverrideFound,
  logNestedMediaQuery,
  logUnknownBaseClass,
  logNestedSubclass,
  logElementPropertyMismatch,
  logBuildError,
  logEnableWebpackSourceMaps
} = require('./errorReporting');

const {
  BLANK,
  SPACE,
  DOT,
  COLON,
  SEMI_COLON,
  DASH,
  CHILD_COMBINATOR,
  OPEN_PARENTHESIS,
  CLOSE_PARENTHESIS,
  OPEN_BRACE,
  CLOSE_BRACE,
  ZERO,
  MEDIA_UNIT
} = require('./constants');


const AST = new Map();


function createStyle(element, attrs, ...children) {
  let styles = BLANK;
  const childNodes = [];
  // children can contain styles for current element or child nodes
  children.forEach(child => child.element
    ? childNodes.push(child)
    : styles += child);

  return {
    element,
    attrs: attrs || {},
    styles,
    children: childNodes
  }
}

function attrsValid(attrs) {
  if (attrs) {
    const permittedAttrs = [
      'className',
      'minWidth',
      'maxWidth',
      'pseudo',
      '__source' // generated by `transform-react-jsx-source`
    ];

    Object.keys(attrs).forEach(attr => {
      if (!permittedAttrs.includes(attr)) {
        logInvalidAttribute(attrs.__source, attr, permittedAttrs);
        throw new Error(`[Invalid Attribute] \`${attr}\` is not a valid attribute`);
      }
    });
  }

  return true;
}

function createCSS(styles) {
  Array.isArray(styles)
      ? styles.forEach(block => parseStyles(block))
      : parseStyles(styles);

  parseAst();
  return makeCSS();
}

function parseStyles(block, parentRef = null, inheritedMedia = null) {
  if (attrsValid(block.attrs)) {
    const ref = makeRef(block);
    const fullyQualifiedRef = parentRef
      ? `${parentRef}${SPACE}${ref}`
      : ref;
    const {
      minWidth,
      maxWidth,
      className,
      __source
    } = block.attrs;

    if (inheritedMedia) {
      if (
        minWidth ||
        maxWidth
      ) {
        logNestedMediaQuery(inheritedMedia.__source, inheritedMedia.minWidth, __source, minWidth);
        throw new Error(`[Nested Media Query] Nested media query found in \`${inheritedMedia.setBy}\``);
      } else {
        // add inherited media queries to child block
        block.attrs = {
          ...block.attrs,
          ...inheritedMedia.minWidth && { minWidth: inheritedMedia.minWidth },
          ...inheritedMedia.maxWidth && { maxWidth: inheritedMedia.maxWidth }
        }
      }
    }

    if (isSubclass(parentRef, className, __source)) {
      const baseClass = className.split(DOT)[0]; // upto (but not including) dot
      const baseRef = `${block.element}${DOT}${baseClass}`;

      if (AST.has(baseRef)) {
        cloneBaseStyles(baseRef, fullyQualifiedRef);
        // todo: generate run-time validations
      } else {
        logUnknownBaseClass(__source, baseClass);
        throw new Error(`[Unknown Base Class] The base class \`${baseRef}\` does not exist`);
      }
    }

    saveRef(fullyQualifiedRef, block);

    if (block.children.length) {
      // save parent path for children
      parentRef
        ? parentRef += `${SPACE}${ref}`
        : parentRef = ref;

      // save inferred media queries if any
      if (
        minWidth ||
        maxWidth
      ) {
        inheritedMedia = {
          ...minWidth && { minWidth },
          ...maxWidth && { maxWidth },
          setBy: parentRef,
          __source
        }
      }

      // parse children
      block.children.forEach(child => parseStyles(child, parentRef, inheritedMedia));
    }
  }
}

function cloneBaseStyles(baseRef, clonedRef) {
  for (var ref of AST.keys()) {
    if (
      ref === baseRef ||
      ref.startsWith(`${baseRef}${SPACE}`)
    ) {
      // clone and save base styles
      const fullyQualifiedClonedRef = ref.replace(baseRef, clonedRef);
      AST.set(fullyQualifiedClonedRef, AST.get(ref).map(style => ({...style})));
      AST.get(fullyQualifiedClonedRef).isCloned = true;
    }
  }
}

function isSubclass(parentRef, className, source) {
  // for now only support single inheritance & top level nodes
  if (
    className &&
    className.includes(DOT)
  ) {
    if (parentRef === null) {
      return true;
    }
    logNestedSubclass(source, className);
    throw new Error(`[Nested Subclass] Nested subclass \`${className}\` found in \`${parentRef}\``);
  }

  return false;
}

function parseAst() {
  for (var ref of AST.keys()) {
    const paths = ref.split(SPACE);
    let i = paths.length - 1;
    let accumulator = BLANK;

    // traverse tree (right to left) to see whether ref exists as part of another ref
    do {
      accumulator = (accumulator === BLANK)
        ? paths[i]
        : `${paths[i]}${SPACE}` + accumulator;

      if (
        ref !== accumulator &&
        AST.has(accumulator)
      ) {
        // ref exists as part of another ref, check if styles are unique
        AST.get(ref).forEach(existingStyle => {
          AST.get(accumulator).forEach(accumulatedStyle => checkForOverrides(accumulatedStyle, existingStyle));
        });
      }

      i--;
    } while (i >= 0);
  }
}

function makeCSS() {
  let CSS = BLANK;

  for (var ref of AST.keys()) {
    const selector = makeSelectorFromRef(ref);

    AST.get(ref).filter(({styles}) => styles !== BLANK)
                .forEach(({styles, minWidth, maxWidth}) => {
      if (
        minWidth === ZERO &&
        maxWidth === Infinity
      ) {
        CSS += `${selector}${SPACE}${OPEN_BRACE}\n`;
        CSS += `${SPACE.repeat(2)}${styles}\n`;
      } else {
        // optimization: one media query per unique range containing all styles for that range
        const ranges = [];

        if (minWidth !== ZERO) {
          ranges.push(`${OPEN_PARENTHESIS}min-width:${minWidth}${MEDIA_UNIT}${CLOSE_PARENTHESIS}`);
        }

        if (maxWidth !== Infinity) {
          ranges.push(`${OPEN_PARENTHESIS}max-width:${maxWidth}${MEDIA_UNIT}${CLOSE_PARENTHESIS}`);
        }

        CSS += `@media${SPACE}${ranges.join(`${SPACE}and${SPACE}`)}${SPACE}${OPEN_BRACE}\n`;
        CSS += `${SPACE.repeat(2)}${selector}${SPACE}${OPEN_BRACE}\n`;
        CSS += `${SPACE.repeat(4)}${styles}\n`;
        CSS += `${SPACE.repeat(2)}${CLOSE_BRACE}\n`;
      }

      CSS += `${CLOSE_BRACE}\n`;
    });
  }

  return CSS;
}

function saveRef(ref, {element, attrs, styles}) {
  if (stylesValid(ref, element, attrs, styles)) {
    if (AST.has(ref)) {
      // ref already exists
      const newStyle = createStyleEntry(styles, attrs);

      if (AST.get(ref).isCloned) {
        // find existing style whose min & max width are equal to new style (if any)
        const equivalentStyle = AST.get(ref).find(({minWidth, maxWidth}) => minWidth === newStyle.minWidth && maxWidth === newStyle.maxWidth);

        if (equivalentStyle) {
          // merge new style with an equivalent style
          mergeNewStyleWithEquivalentStyle(newStyle, equivalentStyle);
        } else {
          // treat new style as a new entry in AST
          saveNewStyleForExistingRef(newStyle, ref);
        }
      } else {
        // merge new styles with existing styles if no overrides present
        saveNewStyleForExistingRef(newStyle, ref);
      }
    } else {
      AST.set(ref, [createStyleEntry(styles, attrs)]);
    }
  }
}

/**
 * @param reas composed of ref, element, attrs, styles
 */
function stylesValid(...reas) {
  return propertiesAreUnique(...reas) &&
         elementCanUseProperty(...reas);
}

function propertiesAreUnique(ref, element, attrs, styles) {
  try {
    stylesAsMap(styles, attrs, ref);
  } catch (e) {
    throw e;
  }

  return true;
}

function elementCanUseProperty(ref, element, attrs, styles) {
  elementPropertyWhitelist.forEach(({elements, properties}) => {
    const whitelistedProperty = properties.find(property => stylesAsMap(styles).get(property));

    if (
      whitelistedProperty &&
      !elements.includes(element)
    ) {
      logElementPropertyMismatch(attrs.__source, element, whitelistedProperty, elements);
      throw new Error(
        `[Element Property Mismatch] The HTML element \`${element}\` (${ref}) cannot use the property \`${whitelistedProperty}\``
      );
    }
  });

  return true;
}

function saveNewStyleForExistingRef(newStyle, ref) {
  AST.get(ref).forEach(existingStyle => checkForOverrides(existingStyle, newStyle));
  AST.get(ref).push(newStyle); // save styles
}

function mergeNewStyleWithEquivalentStyle(newStyle, equivalentStyle) {
  const newStyles = stylesAsMap(newStyle.styles);
  const equivalentStyles = stylesAsMap(equivalentStyle.styles);

  for (var property of newStyles.keys()) {
    if (equivalentStyles.has(property)) {
      // style already exists, override it
      equivalentStyles.set(
        property,
        `${newStyles.get(property)} /* (original value: ${equivalentStyles.get(property)}) */`
      );
    } else {
      // add style
      equivalentStyles.set(property, `${newStyles.get(property)}`);
    }
  }

  equivalentStyle.styles = stylesToString(equivalentStyles);
}

function createStyleEntry(styles, {minWidth, maxWidth, __source}) {
  return {
    styles,
    minWidth: minWidth ? minWidth : ZERO,
    maxWidth: maxWidth ? maxWidth : Infinity,
    __source
  }
}

function propertiesAsArray(styles){
  return [...stylesAsMap(styles).keys()];
}

function checkForExactOverride(control, comparison) {
  const controlProperties = propertiesAsArray(control.styles);
  const comparisonProperties = propertiesAsArray(comparison.styles);

  controlProperties.forEach(property => {
    if (comparisonProperties.includes(property)) {
      logExactOverrideFound(control.__source, comparison.__source, property);
      throw new Error(`[Override Found] The property \`${property}\` has already been defined`);
    }
  });
}

function checkForPartialOverride(control, comparison) {
  const controlProperties = propertiesAsArray(control.styles);
  const comparisonProperties = propertiesAsArray(comparison.styles);

  controlProperties.forEach(property => {
    if (forbiddenPropertyCombinations[property]) {
      forbiddenPropertyCombinations[property].forEach(overiddingProperty => {
        if (comparisonProperties.includes(overiddingProperty)) {
          logPartialOverrideFound(control.__source, comparison.__source, property, overiddingProperty);
          throw new Error(
            `[Partial Override Found] The property \`${property}\` is overridden by \`${overiddingProperty}\``
          );
        }
      });
    }
  });
}

function checkForOverrides(control, comparison) {
  if (breakpointsOverlap(control, comparison)) {
    checkForExactOverride(control, comparison);
    checkForPartialOverride(control, comparison);
  }
}

function breakpointsOverlap(controlRange, comparisonRange) {
  const rangeBelow = (comparisonRange.minWidth < controlRange.minWidth) &&
                     (comparisonRange.maxWidth < controlRange.minWidth);
  const rangeAbove = (comparisonRange.minWidth > controlRange.maxWidth) &&
                     (comparisonRange.maxWidth > controlRange.maxWidth);

  if (
    rangeBelow ||
    rangeAbove
  ) {
    return false;
  } else {
    return true;
  }
}

function stylesAsMap(stylesAsString, attrs = null, ref = null) {
  const styles = new Map();

  stylesAsString.split(SEMI_COLON)
    .filter(res => res !== BLANK)
    .map(res => res.trim())
    .forEach(declaration => {
      const [property, value] = declaration.split(COLON).map(res => res.trim().toLowerCase());

      if (styles.has(property)) {
        logDuplicateProperty(attrs.__source, property, value);
        throw new Error(`[Duplicate Property] The CSS property \`${property}\` is defined twice by \`${ref}\``);
      } else if (forbiddenPropertyCombinations[property]) {
        forbiddenPropertyCombinations[property].forEach(overiddenProperty => {
          if (styles.has(overiddenProperty)) {
            logPartialOverrideFound(attrs.__source, attrs.__source, overiddenProperty, property);
            throw new Error(
              `[Partial Override Found] The property \`${overiddenProperty}\` is overridden by \`${property}\``
            )
          }
        });
      }

      styles.set(property, value);
    });

  return styles;
}

function stylesToString(stylesAsMap) {
  return [...stylesAsMap].reduce((acc, [property, value]) => {
    return acc += `${property}${COLON}${value}${SEMI_COLON}`;
  }, BLANK);
}

function makeRef({element, attrs}) {
  const { className, pseudo } = attrs;

  return element.concat(className ? `${DOT}${className}` : BLANK)
                .concat(pseudo ? pseudo : BLANK);
}

function makeSelectorFromRef(ref) {
  return ref.split(SPACE)
    .reduce((acc, selector) => {
      let pseudoSelector = BLANK;

      if (selector.includes(COLON)) {
        pseudoSelector = selector.match(/:.+/)[0];
        selector = selector.replace(pseudoSelector, BLANK);
      }

      if (selector.includes(DOT)) {
        const isSubclass = selector.split(DOT).length === 3; // [element, baseClass, subClass]

        if (isSubclass) {
          return acc.concat(`${makeSubclassSelector(selector)}${pseudoSelector}`);
        } else {
          return acc.concat(`${makeClassSelector(selector)}${pseudoSelector}`);
        }
      } else {
        return acc.concat(`${makeTagOnlySelector(selector)}${pseudoSelector}`);
      }
    }, [])
    .join(`${SPACE}${CHILD_COMBINATOR}${SPACE}`);
}

function makeTagOnlySelector(element) {
  return `${element}:not([class])`;
}

function makeClassSelector(elementWithClass) {
  const [element, cssClass] = elementWithClass.split(DOT);
  return `${element}[class="${cssClass}"]`;
}

function makeSubclassSelector(elementWithSubclass) {
  const [element, baseClass, subClass] = elementWithSubclass.split(DOT);
  return `${element}[class="${baseClass}${SPACE}${subClass}"]`;
}

// for testing / build tools
function tearDown() {
  AST.clear();
  clearSourceMaps();
}

module.exports = {
  createStyle,
  createCSS,
  saveSourceMap,
  tearDown,
  logBuildError,
  logEnableWebpackSourceMaps
};