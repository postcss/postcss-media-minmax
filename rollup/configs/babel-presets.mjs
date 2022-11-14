export const packageBabelPreset = [
  ['@babel/preset-env', {
    loose: true,
    modules: false,
    targets: { node: 10 },
    useBuiltIns: false,
  }],
];
