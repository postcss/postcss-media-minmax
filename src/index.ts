import type { PluginCreator } from 'postcss';
import { transform } from './transform';
import { parse, parseCustomMedia } from '@csstools/media-query-list-parser';

const creator: PluginCreator<never> = () => {
  return {
    postcssPlugin: 'postcss-media-minmax',
    AtRule: {
      media: (atRule) => {
        if (!(atRule.params.includes('<') || atRule.params.includes('>') || atRule.params.includes('='))) {
          return;
        }

        const mediaQueries = parse(atRule.params, {
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

        const customMedia = parseCustomMedia(atRule.params, {
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
  };
};

creator.postcss = true;

export default creator;
