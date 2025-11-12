module.exports = {
  extends: [
    'stylelint-config-standard-scss',
    'stylelint-config-recommended-vue',
  ],
  plugins: [
    'stylelint-scss',
    'stylelint-order',
  ],
  overrides: [
    {
      files: ['**/*.vue'],
      customSyntax: 'postcss-html',
    },
    {
      files: ['**/*.scss'],
      customSyntax: 'postcss-scss',
    },
  ],
  rules: {
    'at-rule-no-unknown': null,
    'scss/at-rule-no-unknown': true,
    'scss/dollar-variable-empty-line-before': null,
    'order/order': [
      'custom-properties',
      'dollar-variables',
      'declarations',
      {
        type: 'at-rule',
        name: 'include',
      },
      {
        type: 'rule',
        selector: /^&/,
      },
      {
        type: 'rule',
        selector: /.*/,
      },
    ],
    'color-function-notation': null,
    'color-function-alias-notation': null,
    'alpha-value-notation': null,
    'media-feature-range-notation': null,
    'declaration-empty-line-before': null,
    'rule-empty-line-before': null,
    'color-hex-length': null,
    'value-keyword-case': null,
    'declaration-property-value-no-unknown': null,
    'no-descending-specificity': null,
    'selector-class-pattern': null,
  },
};
