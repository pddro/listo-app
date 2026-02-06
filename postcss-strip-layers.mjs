/**
 * PostCSS plugin to strip @layer wrappers for Android WebView compatibility.
 * Tailwind CSS 4 wraps output in @layer (properties, theme, base, utilities).
 * Older Android WebViews (pre-Chrome 99) don't support @layer, causing all
 * layered styles to be ignored. This plugin unwraps the contents while
 * preserving source order.
 */
const plugin = () => ({
  postcssPlugin: 'postcss-strip-layers',
  AtRule: {
    layer: (atRule) => {
      if (atRule.nodes && atRule.nodes.length > 0) {
        atRule.replaceWith(atRule.nodes);
      } else {
        atRule.remove();
      }
    }
  }
});

plugin.postcss = true;
export default plugin;
