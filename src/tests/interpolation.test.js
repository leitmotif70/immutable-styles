/*
 Testing interpolation for things such as variables, detached rulesets.
*/

const { createStyle, tearDown } = require('../index.js');

beforeEach(() => tearDown());


test('[interpolation] Variable used by class name', () => {
  const dynamicClass = 'pageSubTitle';

  const input = createStyle(
    'h2',
    {
      className: `${dynamicClass}`
    },
    'font-size: 25px;'
  );

  const output = {
    element: 'h2',
    attrs: {
      className: 'pageSubTitle'
    },
    styles: 'font-size: 25px;',
    children: []
  };

  expect(input).toEqual(output);
});


test('[interpolation] Variable used by element type', () => {
  const elementType = 'div';

  const input = createStyle(
    `${elementType}`,
    {
      className: 'grid'
    },
    'display: flex;'
  );

  const output = {
    element: 'div',
    attrs: {
      className: 'grid'
    },
    styles: 'display: flex;',
    children: []
  };

  expect(input).toEqual(output);
});


test('[interpolation] Variable used by property name', () => {
  const property = 'font-size';

  const input = createStyle(
    'h1',
    {
      className: 'pageTitle'
    },
    `${property}: 30px;`
  );

  const output = {
    element: 'h1',
    attrs: {
      className: 'pageTitle'
    },
    styles: 'font-size: 30px;',
    children: []
  };

  expect(input).toEqual(output);
});


test('[interpolation] Variable used by property value', () => {
  const headingSize = '30px';

  const input = createStyle(
    'h1',
    {
      className: 'pageTitle'
    },
    `font-size: ${headingSize};`
  );

  const output = {
    element: 'h1',
    attrs: {
      className: 'pageTitle'
    },
    styles: 'font-size: 30px;',
    children: []
  };

  expect(input).toEqual(output);
});


test('[interpolation] Detached CSS ruleset', () => {
  const headingStyles = 'font-family: "Fira Code"; font-size: 30px; font-weight: bold;';

  const input = createStyle(
    'h1',
    {
      className: 'pageTitle'
    },
    `${headingStyles} color: black;`
  );

  const output = {
    element: 'h1',
    attrs: {
      className: 'pageTitle'
    },
    styles: 'font-family: "Fira Code"; font-size: 30px; font-weight: bold; color: black;',
    children: []
  };

  expect(input).toEqual(output);
});