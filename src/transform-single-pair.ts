import { ComponentValue, isFunctionNode, isTokenNode } from '@csstools/css-parser-algorithms';
import { CSSToken, NumberType, TokenType } from '@csstools/css-tokenizer';
import { invertComparison, matchesRatioExactly, MediaFeature, MediaFeatureComparison, MediaFeatureEQ, MediaFeatureGT, MediaFeatureLT, MediaFeatureValue, newMediaFeaturePlain } from '@csstools/media-query-list-parser';

const unitsForFeature = {
  'width': 'px',
  'height': 'px',
  'device-width': 'px',
  'device-height': 'px',
  'aspect-ratio': '',
  'device-aspect-ratio': '',
  'color': '',
  'color-index': '',
  'monochrome': '',
  'resolution': 'dpi',
};

function featureNamePrefix(operator: MediaFeatureComparison) {
  if (operator === MediaFeatureLT.LT || operator === MediaFeatureLT.LT_OR_EQ) {
    return 'max-';
  }

  if (operator === MediaFeatureGT.GT || operator === MediaFeatureGT.GT_OR_EQ) {
    return 'min-';
  }

  return '';
}

const power = {
  '>': 1,
  '<': -1,
};

const step = .001; // smallest even number that won’t break complex queries (1in = 96px)

export function transformSingleNameValuePair(name: string, operator: MediaFeatureComparison, value: MediaFeatureValue, nameBeforeValue: boolean): MediaFeature | null {
  let tokensBefore: Array<CSSToken> = value.before;
  let tokensAfter: Array<CSSToken> = value.after;
  if (!nameBeforeValue) {
    tokensBefore = value.after;
    tokensAfter = value.before;
  }

  if (!nameBeforeValue) {
    const invertedOperator = invertComparison(operator);
    if (invertedOperator === false) {
      return;
    }

    operator = invertedOperator;
  }

  if (operator === MediaFeatureEQ.EQ || operator === MediaFeatureLT.LT_OR_EQ || operator === MediaFeatureGT.GT_OR_EQ) {
    if (Array.isArray(value.value)) {
      return newMediaFeaturePlain(
        featureNamePrefix(operator) + name,
        ...tokensBefore,
        ...value.value.flatMap(x => x.tokens()),
        ...tokensAfter,
      );
    } else {
      return newMediaFeaturePlain(
        featureNamePrefix(operator) + name,
        ...tokensBefore,
        ...value.value.tokens(),
        ...tokensAfter,
      );
    }
  }

  if (Array.isArray(value.value) && matchesRatioExactly(value.value)) {
    // TODO : handle ratio
    return;
  }

  let valueNode: ComponentValue;
  if (Array.isArray(value.value)) {
    valueNode = value.value.find((x) => {
      return isFunctionNode(x) || isTokenNode(x);
    });
  } else {
    valueNode = value.value;
  }

  if (isFunctionNode(valueNode) && valueNode.getName().toLowerCase() === 'calc') {
    let valueToken;
    if (unitsForFeature[name.toLowerCase()]) {
      const tokenValue = power[operator];
      const tokenUnit = unitsForFeature[name.toLowerCase()];

      valueToken = [TokenType.Dimension, `${tokenValue.toString()}${tokenUnit}`, -1, -1, { value: tokenValue, unit: tokenUnit, type: NumberType.Integer }];
    } else {
      const tokenValue = power[operator];

      valueToken = [TokenType.Number, tokenValue.toString(), -1, -1, { value: tokenValue, type: NumberType.Integer }];
    }

    return newMediaFeaturePlain(
      featureNamePrefix(operator) + name,
      ...tokensBefore,
      [TokenType.Function, 'calc(', -1, -1, { value: 'calc(' }],
      [TokenType.OpenParen, '(', -1, -1, undefined],
      ...valueNode.tokens().slice(1),
      [TokenType.Whitespace, ' ', -1, -1, undefined],
      [TokenType.Delim, '+', -1, -1, undefined],
      [TokenType.Whitespace, ' ', -1, -1, undefined],
      valueToken,
      [TokenType.CloseParen, ')', -1, -1, undefined],
      ...tokensAfter,
    );
  } else if (isTokenNode(valueNode)) {
    let token = valueNode.value;
    let tokenValue: number;
    let tokenUnit: string | false = false;

    if ((token[0] === TokenType.Dimension || token[0] === TokenType.Number) && token[4].value === 0) {
      // Zero values:
      // - convert to "1" or "-1"
      // - assign a unit when needed
      tokenValue = power[operator];
      tokenUnit = unitsForFeature[name.toLowerCase()];
    } else if (token[0] === TokenType.Dimension && token[4].unit === 'px' && token[4].type === NumberType.Integer) {
      // Integer pixel values
      // - add "+1" or "-1"
      tokenValue = token[4].value + power[operator];
    } else if (token[0] === TokenType.Dimension || token[0] === TokenType.Number) {
      // Float or non-pixel values
      // - add "+step" or "-step"
      tokenValue = Number(Math.round(Number(token[4].value + step * power[operator] + 'e6')) + 'e-6');
    } else {
      return;
    }

    if (tokenUnit !== false) {
      token = [
        TokenType.Dimension,
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
    if (token[0] === TokenType.Dimension) {
      token[1] = token[4].value.toString() + token[4].unit;
    } else {
      token[1] = token[4].value.toString();
    }

    return newMediaFeaturePlain(
      featureNamePrefix(operator) + name,
      ...tokensBefore,
      token,
      ...tokensAfter,
    );
  }
}
