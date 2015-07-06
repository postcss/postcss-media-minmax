var postcss = require('postcss');

module.exports = postcss.plugin('postcss-media-minmax', function () {
  return function(css) {
    //支持 min-/max- 前缀的属性
    var feature_name = [
      'width',
      'height',
      'device-width',
      'device-height',
      'aspect-ratio',
      'device-aspect-ratio',
      'color',
      'color-index',
      'monochrome',
      'resolution'
    ]

    // 读取 media-feature
    css.eachAtRule(function(rule, i) {
      if (rule.name !== "media" && rule.name !== "custom-media") {
        return
      }

      /**
       * 转换 <mf-name> <=|>= <mf-value>
       *    $1  $2   $3
       * (width >= 300px) => (min-width: 300px)
       * (width <= 900px) => (max-width: 900px)
       */

      //取值不支持负值
      //But -0 is always equivalent to 0 in CSS, and so is also accepted as a valid <mq-boolean> value.

      rule.params = rule.params.replace(/\(\s*([a-z-]+?)\s*([<>]=)\s*((?:-?\d*\.?(?:\s*\/?\s*)?\d+[a-z]*)?)\s*\)/gi, function($0, $1, $2, $3) {

        var params = '';

        if (feature_name.indexOf($1) > -1) {
          if ($2 === '<=') {
            params = '(' + 'max-' + $1 + ': ' + $3 + ')';
          }
          if ($2 === '>=') {
            params += '(' + 'min-' + $1 + ': ' + $3 + ')';
          }
          return params;
        }
        //如果不是指定的属性，不做替换
        return $0;
      })

      /**
       * 转换  <mf-value> <=|>= <mf-name> <=|>= <mf-value>
       *   $1   $2  $3   $4   $5
       * (500px <= width <= 1200px) => (min-width: 500px) and (max-width: 1200px)
       * (900px >= width >= 300px)  => (min-width: 300px) and (max-width: 900px)
       */

      rule.params = rule.params.replace(/\(\s*((?:-?\d*\.?(?:\s*\/?\s*)?\d+[a-z]*)?)\s*(<=|>=)\s*([a-z-]+)\s*(<=|>=)\s*((?:-?\d*\.?(?:\s*\/?\s*)?\d+[a-z]*)?)\s*\)/gi, function($0, $1, $2, $3, $4, $5) {

        if (feature_name.indexOf($3) > -1) {
          if ($2 === '<=' && $4 === '<=' || $2 === '>=' && $4 === '>=') {
            var min = ($2 === '<=') ? $1 : $5;
            var max = ($2 === '<=') ? $5 : $1;
            return '(' + 'min-' + $3 + ': ' + min + ') and (' + 'max-' + $3 + ': ' + max + ')';
          }
        }
        //如果不是指定的属性，不做替换
        return $0;

      });

    });

  }
});
