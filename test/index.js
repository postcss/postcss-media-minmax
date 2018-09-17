var fs = require("fs")

var test = require("tape")

var postcss = require("postcss")
var plugin = require("..")

function filename(name) { return "test/" + name + ".css" }
function read(name) { return fs.readFileSync(name, "utf8") }

function compareFixtures(t, name, msg, opts, postcssOpts) {
  postcssOpts = postcssOpts || {}
  postcssOpts.from = filename("fixtures/" + name)
  opts = opts || {}
  var actual = postcss().use(plugin(opts)).process(read(postcssOpts.from), postcssOpts).css
  var expected = read(filename("fixtures/" + name + ".output"))
  fs.writeFileSync(filename("fixtures/" + name + ".actual"), actual)
  t.equal(actual.trim(), expected.trim(), msg)
}

test("@media", function(t) {
  compareFixtures(t, "width-height", "should transform")
  compareFixtures(t, "device-width-height", "should transform")
  compareFixtures(t, "aspect-ratio", "should transform")
  compareFixtures(t, "device-aspect-ratio", "should transform")
  compareFixtures(t, "color", "should transform")
  compareFixtures(t, "color-index", "should transform")
  compareFixtures(t, "monochrome", "should transform")
  compareFixtures(t, "resolution", "should transform")

  compareFixtures(t, "comment", "should transform")
  compareFixtures(t, "line-break", "should transform")
  compareFixtures(t, "other-name", "should transform")
  compareFixtures(t, "more-units", "should transform")

  compareFixtures(t, "min-max", "should transform")
  compareFixtures(t, "shorthands", "should transform shorthands")

  t.end()
})
