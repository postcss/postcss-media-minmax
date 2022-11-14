import type { PluginCreator } from 'postcss';
import { transform } from './transform';

type pluginOptions = { preserve?: boolean };

const creator: PluginCreator<pluginOptions> = (opts?: pluginOptions) => {
  const options = Object.assign(
    // Default options
    {
      preserve: false,
    },
    // Provided options
    opts,
  );

  return {
    postcssPlugin: 'postcss-media-minmax',
    AtRule: {
      media: (atRule) => {
        if (!(atRule.params.includes('<') || atRule.params.includes('>') || atRule.params.includes('='))) {
          return;
        }

        const transformed = transform(atRule.params);
        if (atRule.params === transformed) {
          return;
        }

        atRule.cloneBefore({
          params: transformed,
        });

        if (!options.preserve) {
          atRule.remove();
        }
      },
    },
  };
};

creator.postcss = true;

export default creator;
