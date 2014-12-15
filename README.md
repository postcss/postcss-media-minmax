# PostCSS Media Minmax [![Build Status](https://travis-ci.org/postcss/postcss-media-minmax.svg)](https://travis-ci.org/postcss/postcss-media-minmax)


> Writing simple and graceful Media Queries!

The `min-width`,`max-width` and many other propertys of Media Queries are really confused, every time I see them, I want to cry. Right now in the new specs, you can use more intuitive  <= or >= to instead of the  min-/max- prefix of media queries.

This is a supporting [CSS Media Queries Level 4](http://dev.w3.org/csswg/mediaqueries/) Polyfill plugin,which let you can ues these features right now. Mom won't never worry  about my study, so amazing!


[简体中文](README-zh.md)

-----

![Gif Demo](http://gtms02.alicdn.com/tps/i2/TB1UIjyGVXXXXcCaXXXx274FpXX-877-339.gif)


## Installation

    $ npm install postcss-media-minmax

## Quick Start

Example 1:

```js
var fs = require('fs')
var postcss = require('postcss')
var minmax = require('postcss-media-minmax')

var css = fs.readFileSync('input.css', 'utf8')

var output = postcss()
  .use(minmax())
  .process(css)
  .css
  
console.log('\n====>Output CSS:\n', output)  
```

Or just:

```js
var output = postcss(minmax())
  .process(css)
  .css
```

input.css：

```css
@media screen and (width >= 500px) and (width <= 1200px) {
  .bar {
    display: block;
  }
}
```

You will get：

```css
@media screen and (min-width: 500px) and (max-width: 1200px) {
  .bar {
    display: block;
  }
}
```

## CSS syntax

### [Syntax](http://dev.w3.org/csswg/mediaqueries/#mq-syntax)

```
<mf-range> = <mf-name> [ '<' | '>' ]? '='? <mf-value>
           | <mf-value> [ '<' | '>' ]? '='? <mf-name>
           | <mf-value> '<' '='? <mf-name> '<' '='? <mf-value>
           | <mf-value> '>' '='? <mf-name> '>' '='? <mf-value>
```

PostCSS Media Minmax doesn't implement such syntax as `200px > = width` or `200px < = width` currently, because the syntax readability is not good enough.

## [Values](http://dev.w3.org/csswg/mediaqueries/#values)
 
**The special values:**

* [<ratio>](http://dev.w3.org/csswg/mediaqueries/#typedef-ratio)

    The <ratio> value type is a positive (not zero or negative) <integer> followed by optional whitespace, followed by a solidus ('/'), followed by optional whitespace, followed by a positive <integer>. <ratio>s can be ordered or compared by transforming them into the number obtained by dividing their first <integer> by their second <integer>.

    ```css
    @media screen and (device-aspect-ratio: 16 /   9) {
      /* rules */
    }

    /* equivalent to */
    @media screen and (device-aspect-ratio: 16/9) {
      /* rules */
    }
    ```

* [<mq-boolean>](http://dev.w3.org/csswg/mediaqueries/#typedef-mq-boolean)

    The <mq-boolean> value type is an <integer> with the value 0 or 1. Any other integer value is invalid. Note that -0 is always equivalent to 0 in CSS, and so is also accepted as a valid <mq-boolean> value. 

    ```css
    @media screen and (grid: -0) {
      /* rules */
    }

    /* equivalent to */
    @media screen and (grid: 0) {
      /* rules */
    }
    ```

## How to use

### Shorthand

In Example 1, the same feature name is >= and <=, which will be abbreviated as the following:

```css
@media screen and (500px <= width <= 1200px) {
  .bar {
    display: block;
  }
}
/* Or */
@media screen and (1200px >= width >= 500px) {
  .bar {
    display: block;
  }
}
```

Will get the same output results:

```css
@media screen and (min-width: 500px) and (max-width: 1200px) {
  .bar {
    display: block;
  }
}
```

**Note**: When the Media features name in the middle, we must ensure that two `<=` or `>=` in the same direction, otherwise which will not be converted.

E.g. in the example below, width is greater than or equal to 500px and is greater than or equal to 1200px, this is the wrong in grammar and logic.


```css
@media screen and (1200px <= width >= 500px) {
  .bar {
    display: block;
  }
}
```

### Media features name

The following property supports the min-/max prefix in specification at present, which will be automatically converted by PostCSS Media Minmax.

* `width`
* `height`
* `device-width`
* `device-height`
* `aspect-ratio`
* `device-aspect-ratio`
* `color`
* `color-index`
* `monochrome`
* `resolution`



### Support for use in `@custom-media` & Node Watch

```js
var fs = require('fs')
var chokidar = require('chokidar')
var postcss = require('postcss')
var minmax = require('postcss-media-minmax')
var customMedia = require('postcss-custom-media')

var src = 'input.css'

console.info('Watching…\nModify the input.css and save.')


chokidar.watch(src, {
  ignored: /[\/\\]\./,
  persistent: true
}).on('all',
  function(event, path, stats) {
    var css = fs.readFileSync(src, 'utf8')
    var output = postcss()
      .use(customMedia())
      .use(minmax())
      .process(css)
      .css;
    fs.writeFileSync('output.css', output)
  })

```


input.css:

```css
@custom-media --foo (width >= 20em) and (width <= 50em);
@custom-media --bar (height >= 300px) and (height <= 600px);

@media (--foo) and (--bar) {
  
}
```

output.css:

```css
@media (min-width: 20em) and (max-width: 50em) and (min-height: 300px) and (max-height: 600px) {
  
}
```

### Grunt

```js
module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    postcss: {
      options: {
        processors: [
          require('autoprefixer-core')({ browsers: ['> 0%'] }).postcss, //Other plugin
          require('postcss-media-minmax')(),
        ]
      },
      dist: {
        src: ['src/*.css'],
        dest: 'build/grunt.css'
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-postcss');

  grunt.registerTask('default', ['postcss']);
}
```

### Gulp

```js
var gulp = require('gulp');
var rename = require('gulp-rename');
var postcss = require('gulp-postcss');
var selector = require('postcss-media-minmax')
var autoprefixer = require('autoprefixer-core')

gulp.task('default', function () {
    var processors = [
        autoprefixer({ browsers: ['> 0%'] }), //Other plugin
        minmax()
    ];
    gulp.src('src/*.css')
        .pipe(postcss(processors))
        .pipe(rename('gulp.css'))
        .pipe(gulp.dest('build'))
});
gulp.watch('src/*.css', ['default']);
```


## Contributing

* Install the relevant dependent module.
* Respect coding style（Use [EditorConfig](http://editorconfig.org/)）.
* Add test cases in the [test](test) directory.
* Run test.

```
$ git clone https://github.com/postcss/postcss-media-minmaxs.git
$ git checkout -b patch
$ npm install
$ npm test
```

## Acknowledgements

* Thank the author of PostCSS [Andrey Sitnik](https://github.com/ai) for giving us so simple and easy CSS syntax analysis tools.

* Thank [Tab Atkins Jr.](http://xanthir.com/contact/) for writing the specs of  Media Queries Level 4.

* Thank [ziyunfei](http://weibo.com/p/1005051708684567) for suggestion and help of this plugin.


## [Changelog](CHANGELOG.md)

## [License](LICENSE)
