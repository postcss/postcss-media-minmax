import { gatherNodeAncestry } from '@csstools/css-parser-algorithms';
import { TokenType } from '@csstools/css-tokenizer';
import { isMediaAnd, isMediaCondition, isMediaConditionListWithAnd, isMediaFeature, isMediaFeatureRange, isMediaFeatureRangeNameValue, isMediaFeatureRangeValueName, isMediaInParens, isMediaQuery, MediaAnd, MediaCondition, MediaConditionListWithAnd, MediaFeature, MediaInParens, MediaQuery, MediaFeatureLT, parse } from '@csstools/media-query-list-parser';
import { transformSingleNameValuePair } from './transform-single-pair';

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

export function transform(mediaQueryListString: string) {
  const mediaQueries = parse(mediaQueryListString, {
    preserveInvalidMediaQueries: true,
    onParseError: () => {
      throw new Error(`Unable to parse media query "${mediaQueryListString}"`);
    },
  });

  return mediaQueries.map((mediaQuery) => {
    const ancestry = gatherNodeAncestry(mediaQuery);

    mediaQuery.walk((entry) => {
      const node = entry.node;
      if (!isMediaFeatureRange(node)) {
        return;
      }

      const parent = entry.parent;
      if (!isMediaFeature(parent)) {
        return;
      }

      const name = node.name.getName();
      if (!supportedFeatureNames.has(name.toLowerCase())) {
        return;
      }

      if (isMediaFeatureRangeNameValue(node) || isMediaFeatureRangeValueName(node)) {
        const operator = node.operatorKind();
        if (operator === false) {
          return;
        }

        const transformed = transformSingleNameValuePair(name, operator, node.value, isMediaFeatureRangeNameValue(node));
        if (transformed) {
          parent.feature = transformed.feature;
        }

        return;
      }

      const grandParent: unknown | MediaInParens = ancestry.get(parent);
      if (!isMediaInParens(grandParent)) {
        return;
      }

      let featureOne: MediaFeature | null = null;
      let featureTwo: MediaFeature | null = null;
      {
        const operator = node.valueOneOperatorKind();
        if (operator === false) {
          return;
        }

        const transformed = transformSingleNameValuePair(name, operator, node.valueOne, false);
        if (!transformed) {
          return;
        }

        if (operator === MediaFeatureLT.LT || operator === MediaFeatureLT.LT_OR_EQ) {
          featureOne = transformed;
        } else {
          featureTwo = transformed;
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

        if (operator === MediaFeatureLT.LT || operator === MediaFeatureLT.LT_OR_EQ) {
          featureTwo = transformed;
        } else {
          featureOne = transformed;
        }
      }

      const parensOne = new MediaInParens(
        featureOne,
      );

      const parensTwo = new MediaInParens(
        featureTwo,
      );

      // ((color) and (300px < width < 400px))
      // ((300px < width < 400px) and (color))
      const andList = getMediaConditionListWithAndFromAncestry(grandParent, ancestry);
      if (andList) {
        if (andList.leading === grandParent) {
          andList.leading = parensOne;

          andList.list = [
            new MediaAnd(
              [
                [TokenType.Whitespace, ' ', -1, -1, undefined],
                [TokenType.Ident, 'and', -1, -1, { value: 'and' }],
                [TokenType.Whitespace, ' ', -1, -1, undefined],
              ],
              parensTwo,
            ),
            ...andList.list,
          ];

          return;
        }

        andList.list.splice(
          andList.indexOf(ancestry.get(grandParent) as MediaAnd) as number,
          1,
          new MediaAnd(
            [
              [TokenType.Whitespace, ' ', -1, -1, undefined],
              [TokenType.Ident, 'and', -1, -1, { value: 'and' }],
              [TokenType.Whitespace, ' ', -1, -1, undefined],
            ],
            parensOne,
          ),
          new MediaAnd(
            [
              [TokenType.Whitespace, ' ', -1, -1, undefined],
              [TokenType.Ident, 'and', -1, -1, { value: 'and' }],
              [TokenType.Whitespace, ' ', -1, -1, undefined],
            ],
            parensTwo,
          ),
        );

        return;
      }

      const conditionList = new MediaConditionListWithAnd(
        parensOne,
        [
          new MediaAnd(
            [
              [TokenType.Whitespace, ' ', -1, -1, undefined],
              [TokenType.Ident, 'and', -1, -1, { value: 'and' }],
              [TokenType.Whitespace, ' ', -1, -1, undefined],
            ],
            parensTwo,
          ),
        ],
        [
          [TokenType.Whitespace, ' ', -1, -1, undefined],
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
      grandParent.media = new MediaCondition(
        new MediaInParens(
          new MediaCondition(
            conditionList,
          ),
          [
            [TokenType.Whitespace, ' ', -1, -1, undefined],
            [TokenType.OpenParen, '(', -1, -1, undefined],
          ],
          [
            [TokenType.CloseParen, ')', -1, -1, undefined],
          ],
        ),
      );
    });

    return mediaQuery.toString();
  }).join(',');
}

function getMediaConditionListWithAndFromAncestry(mediaInParens: MediaInParens, ancestry: Map<unknown, unknown>): MediaConditionListWithAnd | null {
  let focus: unknown = mediaInParens;
  if (!focus) {
    return;
  }

  focus = ancestry.get(focus);
  if (isMediaConditionListWithAnd(focus)) {
    return focus;
  }

  if (!isMediaAnd(focus)) {
    return;
  }

  focus = ancestry.get(focus);
  if (isMediaConditionListWithAnd(focus)) {
    return focus;
  }

  return;
}

function getMediaConditionInShallowMediaQueryFromAncestry(mediaInParens: MediaInParens, mediaQuery: MediaQuery, ancestry: Map<unknown, unknown>): MediaCondition | null {
  let focus: unknown = mediaInParens;
  if (!focus) {
    return;
  }

  focus = ancestry.get(focus);
  if (!isMediaCondition(focus)) {
    return;
  }

  const condition = focus;

  focus = ancestry.get(focus);
  if (!isMediaQuery(focus)) {
    return;
  }

  if (focus !== mediaQuery) {
    return;
  }

  return condition;
}
