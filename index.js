const cssParserAlgorithms = require("@csstools/css-parser-algorithms");
const cssTokenizer = require("@csstools/css-tokenizer");
const mediaQueryListParser = require("@csstools/media-query-list-parser");

const unitsForFeature = {
  'aspect-ratio': '',
  'color': '',
  'color-index': '',
  'device-aspect-ratio': '',
  'device-height': 'px',
  'device-width': 'px',
  'height': 'px',
  'monochrome': '',
  'resolution': 'dpi',
  'width': 'px',
};

function featureNamePrefix(operator) {
  if (
    operator === mediaQueryListParser.MediaFeatureLT.LT ||
    operator === mediaQueryListParser.MediaFeatureLT.LT_OR_EQ
  ) {
    return 'max-';
  }

  if (
    operator === mediaQueryListParser.MediaFeatureGT.GT ||
    operator === mediaQueryListParser.MediaFeatureGT.GT_OR_EQ
  ) {
    return 'min-';
  }

  return '';
}

const power = {
  '>': 1,
  '<': -1,
};

const step = .001; // smallest even number that won’t break complex queries (1in = 96px)

function transformSingleNameValuePair(name, operator, value, nameBeforeValue) {
  let tokensBefore = value.before;
  let tokensAfter = value.after;
  if (!nameBeforeValue) {
    tokensBefore = value.after;
    tokensAfter = value.before;
  }

  if (!nameBeforeValue) {
    const invertedOperator = mediaQueryListParser.invertComparison(operator);
    if (invertedOperator === false) {
      return;
    }

    operator = invertedOperator;
  }

  if (
    operator === mediaQueryListParser.MediaFeatureEQ.EQ ||
    operator === mediaQueryListParser.MediaFeatureLT.LT_OR_EQ ||
    operator === mediaQueryListParser.MediaFeatureGT.GT_OR_EQ
  ) {
    if (Array.isArray(value.value)) {
      return mediaQueryListParser.newMediaFeaturePlain(
        featureNamePrefix(operator) + name,
        ...tokensBefore,
        ...value.value.flatMap(x => x.tokens()),
        ...tokensAfter,
      );
    } else {
      return mediaQueryListParser.newMediaFeaturePlain(
        featureNamePrefix(operator) + name,
        ...tokensBefore,
        ...value.value.tokens(),
        ...tokensAfter,
      );
    }
  }

  if (Array.isArray(value.value) && mediaQueryListParser.matchesRatioExactly(value.value)) {
    // TODO : handle ratio
    return;
  }

  let valueNode;
  if (Array.isArray(value.value)) {
    valueNode = value.value.find((x) => {
      return cssParserAlgorithms.isFunctionNode(x) || cssParserAlgorithms.isTokenNode(x);
    });
  } else {
    valueNode = value.value;
  }

  if (
    cssParserAlgorithms.isFunctionNode(valueNode) &&
    valueNode.getName().toLowerCase() === 'calc'
  ) {
    let valueToken;
    if (unitsForFeature[name.toLowerCase()]) {
      const tokenValue = power[operator];
      const tokenUnit = unitsForFeature[name.toLowerCase()];

      valueToken = [cssTokenizer.TokenType.Dimension, `${tokenValue.toString()}${tokenUnit}`, -1, -1, { value: tokenValue, unit: tokenUnit, type: cssTokenizer.NumberType.Integer }];
    } else {
      const tokenValue = power[operator];

      valueToken = [cssTokenizer.TokenType.Number, tokenValue.toString(), -1, -1, { value: tokenValue, type: cssTokenizer.NumberType.Integer }];
    }

    return mediaQueryListParser.newMediaFeaturePlain(
      featureNamePrefix(operator) + name,
      ...tokensBefore,
      [cssTokenizer.TokenType.Function, 'calc(', -1, -1, { value: 'calc(' }],
      [cssTokenizer.TokenType.OpenParen, '(', -1, -1, undefined],
      ...valueNode.tokens().slice(1),
      [cssTokenizer.TokenType.Whitespace, ' ', -1, -1, undefined],
      [cssTokenizer.TokenType.Delim, '+', -1, -1, undefined],
      [cssTokenizer.TokenType.Whitespace, ' ', -1, -1, undefined],
      valueToken,
      [cssTokenizer.TokenType.CloseParen, ')', -1, -1, undefined],
      ...tokensAfter,
    );
  } else if (cssParserAlgorithms.isTokenNode(valueNode)) {
    let token = valueNode.value;
    let tokenValue;
    let tokenUnit = false;

    if (
      (token[0] === cssTokenizer.TokenType.Dimension || token[0] === cssTokenizer.TokenType.Number) &&
      token[4].value === 0
    ) {

      // Zero values:
      // - convert to "1" or "-1"
      // - assign a unit when needed
      tokenValue = power[operator];
      tokenUnit = unitsForFeature[name.toLowerCase()];
    } else if (
      token[0] === cssTokenizer.TokenType.Dimension &&
      token[4].unit.toLowerCase() === 'px' &&
      token[4].type === cssTokenizer.NumberType.Integer
    ) {

      // Integer pixel values
      // - add "+1" or "-1"
      tokenValue = token[4].value + power[operator];
    } else if (
      token[0] === cssTokenizer.TokenType.Dimension ||
      token[0] === cssTokenizer.TokenType.Number
    ) {

      // Float or non-pixel values
      // - add "+step" or "-step"
      tokenValue = Number(Math.round(Number(token[4].value + step * power[operator] + 'e6')) + 'e-6');
    } else {
      return;
    }

    if (tokenUnit !== false) {
      token = [
        cssTokenizer.TokenType.Dimension,
        token[1],
        token[2],
        token[3],
        {
          value: token[4].value,
          unit: tokenUnit,
          type: token[4].type,
        },
      ];
    }

    token[4].value = tokenValue;
    if (token[0] === cssTokenizer.TokenType.Dimension) {
      token[1] = token[4].value.toString() + token[4].unit;
    } else {
      token[1] = token[4].value.toString();
    }

    return mediaQueryListParser.newMediaFeaturePlain(
      featureNamePrefix(operator) + name,
      ...tokensBefore,
      token,
      ...tokensAfter,
    );
  }
}

const supportedFeatureNames = new Set([
  'aspect-ratio',
  'color',
  'color-index',
  'device-aspect-ratio',
  'device-height',
  'device-width',
  'height',
  'horizontal-viewport-segments',
  'monochrome',
  'resolution',
  'vertical-viewport-segments',
  'width',
]);

function transform(mediaQueries) {
  return mediaQueries.map((mediaQuery, mediaQueryIndex) => {
    const ancestry = cssParserAlgorithms.gatherNodeAncestry(mediaQuery);

    mediaQuery.walk((entry) => {
      const node = entry.node;
      if (!mediaQueryListParser.isMediaFeatureRange(node)) {
        return;
      }

      const parent = entry.parent;
      if (!mediaQueryListParser.isMediaFeature(parent)) {
        return;
      }

      const name = node.name.getName();
      if (!supportedFeatureNames.has(name.toLowerCase())) {
        return;
      }

      if (mediaQueryListParser.isMediaFeatureRangeNameValue(node) || mediaQueryListParser.isMediaFeatureRangeValueName(node)) {
        const operator = node.operatorKind();
        if (operator === false) {
          return;
        }

        const transformed = transformSingleNameValuePair(name, operator, node.value, mediaQueryListParser.isMediaFeatureRangeNameValue(node));
        if (transformed) {
          parent.feature = transformed.feature;
        }

        return;
      }

      const grandParent = ancestry.get(parent);
      if (!mediaQueryListParser.isMediaInParens(grandParent)) {
        return;
      }

      let featureOne = null;
      let featureTwo = null;
      {
        const operator = node.valueOneOperatorKind();
        if (operator === false) {
          return;
        }

        const transformed = transformSingleNameValuePair(name, operator, node.valueOne, false);
        if (!transformed) {
          return;
        }

        if (operator === mediaQueryListParser.MediaFeatureLT.LT || operator === mediaQueryListParser.MediaFeatureLT.LT_OR_EQ) {
          featureOne = transformed;
          featureOne.before = parent.before
        } else {
          featureTwo = transformed;
          featureTwo.after = parent.after
        }
      }

      {
        const operator = node.valueTwoOperatorKind();
        if (operator === false) {
          return;
        }

        const transformed = transformSingleNameValuePair(name, operator, node.valueTwo, true);
        if (!transformed) {
          return;
        }

        if (operator === mediaQueryListParser.MediaFeatureLT.LT || operator === mediaQueryListParser.MediaFeatureLT.LT_OR_EQ) {
          featureTwo = transformed;
          featureTwo.before = parent.before
        } else {
          featureOne = transformed;
          featureOne.after = parent.after
        }
      }

      const parensOne = new mediaQueryListParser.MediaInParens(
        featureOne,
      );

      const parensTwo = new mediaQueryListParser.MediaInParens(
        featureTwo,
      );

      // ((color) and (300px < width < 400px))
      // ((300px < width < 400px) and (color))
      const andList = getMediaConditionListWithAndFromAncestry(grandParent, ancestry);
      if (andList) {
        if (andList.leading === grandParent) {
          andList.leading = parensOne;

          andList.list = [
            new mediaQueryListParser.MediaAnd(
              [
                [cssTokenizer.TokenType.Whitespace, ' ', -1, -1, undefined],
                [cssTokenizer.TokenType.Ident, 'and', -1, -1, { value: 'and' }],
                [cssTokenizer.TokenType.Whitespace, ' ', -1, -1, undefined],
              ],
              parensTwo,
            ),
            ...andList.list,
          ];

          return;
        }

        andList.list.splice(
          andList.indexOf(ancestry.get(grandParent)),
          1,
          new mediaQueryListParser.MediaAnd(
            [
              [cssTokenizer.TokenType.Whitespace, ' ', -1, -1, undefined],
              [cssTokenizer.TokenType.Ident, 'and', -1, -1, { value: 'and' }],
              [cssTokenizer.TokenType.Whitespace, ' ', -1, -1, undefined],
            ],
            parensOne,
          ),
          new mediaQueryListParser.MediaAnd(
            [
              [cssTokenizer.TokenType.Whitespace, ' ', -1, -1, undefined],
              [cssTokenizer.TokenType.Ident, 'and', -1, -1, { value: 'and' }],
              [cssTokenizer.TokenType.Whitespace, ' ', -1, -1, undefined],
            ],
            parensTwo,
          ),
        );

        return;
      }

      const conditionList = new mediaQueryListParser.MediaConditionListWithAnd(
        parensOne,
        [
          new mediaQueryListParser.MediaAnd(
            [
              [cssTokenizer.TokenType.Whitespace, ' ', -1, -1, undefined],
              [cssTokenizer.TokenType.Ident, 'and', -1, -1, { value: 'and' }],
              [cssTokenizer.TokenType.Whitespace, ' ', -1, -1, undefined],
            ],
            parensTwo,
          ),
        ],
        [
          [cssTokenizer.TokenType.Whitespace, ' ', -1, -1, undefined],
        ],
      );

      // @media screen and (300px < width < 400px)
      // @media (300px < width < 400px)
      const conditionInShallowQuery = getMediaConditionInShallowMediaQueryFromAncestry(grandParent, mediaQuery, ancestry);
      if (conditionInShallowQuery) {
        conditionInShallowQuery.media = conditionList;
        return;
      }

      // Remaining (more complex) cases.
      // Wrapped in extra parens.
      grandParent.media = new mediaQueryListParser.MediaCondition(
        new mediaQueryListParser.MediaInParens(
          new mediaQueryListParser.MediaCondition(
            conditionList,
          ),
          [
            [cssTokenizer.TokenType.Whitespace, ' ', -1, -1, undefined],
            [cssTokenizer.TokenType.OpenParen, '(', -1, -1, undefined],
          ],
          [
            [cssTokenizer.TokenType.CloseParen, ')', -1, -1, undefined],
          ],
        ),
      );
    });

    const tokens = mediaQuery.tokens();
    return cssTokenizer.stringify(
      ...tokens.filter((x, i) => {
        // The algorithms above will err on the side of caution and might insert to much whitespace.

        if (i === 0 && mediaQueryIndex === 0 && x[0] === cssTokenizer.TokenType.Whitespace) {
          // Trim leading whitespace from the first media query.
          return false;
        }

        if (x[0] === cssTokenizer.TokenType.Whitespace && tokens[i + 1] && tokens[i + 1][0] === cssTokenizer.TokenType.Whitespace) {
          // Collapse multiple sequential whitespace tokens
          return false;
        }

        return true;
      })
    );
  }).join(',');
}

function getMediaConditionListWithAndFromAncestry(mediaInParens, ancestry) {
  let focus = mediaInParens;
  if (!focus) {
    return;
  }

  focus = ancestry.get(focus);
  if (mediaQueryListParser.isMediaConditionListWithAnd(focus)) {
    return focus;
  }

  if (!mediaQueryListParser.isMediaAnd(focus)) {
    return;
  }

  focus = ancestry.get(focus);
  if (mediaQueryListParser.isMediaConditionListWithAnd(focus)) {
    return focus;
  }

  return;
}

function getMediaConditionInShallowMediaQueryFromAncestry(mediaInParens, mediaQuery, ancestry) {
  let focus = mediaInParens;
  if (!focus) {
    return;
  }

  focus = ancestry.get(focus);
  if (!mediaQueryListParser.isMediaCondition(focus)) {
    return;
  }

  const condition = focus;

  focus = ancestry.get(focus);
  if (!mediaQueryListParser.isMediaQuery(focus)) {
    return;
  }

  if (focus !== mediaQuery) {
    return;
  }

  return condition;
}

module.exports = () => ({
  postcssPlugin: 'postcss-media-minmax',
  AtRule: {
    media: (atRule) => {
      if (!(atRule.params.includes('<') || atRule.params.includes('>') || atRule.params.includes('='))) {
        return;
      }

      const mediaQueries = mediaQueryListParser.parse(atRule.params, {
        preserveInvalidMediaQueries: true,
        onParseError: () => {
          throw atRule.error(`Unable to parse media query "${atRule.params}"`);
        },
      });

      const transformed = transform(mediaQueries);
      if (atRule.params === transformed) {
        return;
      }

      atRule.params = transformed
    },
    'custom-media': (atRule) => {
      if (!(atRule.params.includes('<') || atRule.params.includes('>') || atRule.params.includes('='))) {
        return;
      }

      const customMedia = mediaQueryListParser.parseCustomMedia(atRule.params, {
        preserveInvalidMediaQueries: true,
        onParseError: () => {
          throw atRule.error(`Unable to parse media query "${atRule.params}"`);
        },
      });
      if (!customMedia) {
        return
      }

      if (!customMedia.hasMediaQueryList()) {
        return;
      }

      const originalMediaQueries = customMedia.mediaQueryList.map((x) => x.toString()).join(',');
      const transformed = transform(customMedia.mediaQueryList);
      if (originalMediaQueries === transformed) {
        return;
      }

      atRule.params = atRule.params.replace(originalMediaQueries, ' ' + transformed)
    },
  },
});

module.exports.postcss = true
