=== ListMango – Make it a List ===
Contributors: listmango
Tags: checklist, list, recipe, grocery, embed
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Add a "Make it a List" button to your posts. Readers turn your content into shareable, interactive checklists.

== Description ==

ListMango lets your readers turn any page on your site into a tappable, shareable checklist — with one click.

Add the **"Make it a List"** button to your recipes, travel guides, how-to articles, gift guides, or any content with actionable items. When a reader clicks it, ListMango's AI reads your page and creates a clean, interactive checklist they can take to the grocery store, share with friends, or check off as they go.

**How it works:**

1. Install the plugin and enter your website URL
2. ListMango extracts your site's branding (colors, favicon) automatically
3. Add the ListMango Button block or `[listmango]` shortcode to your posts
4. Readers click the button and get an instant checklist from your content

**Features:**

* **One-click setup** — just enter your URL, branding is detected automatically
* **Gutenberg block** — drag and drop the button anywhere in the block editor
* **Shortcode support** — works with the classic editor too: `[listmango]`
* **Customizable** — pick your button color and border radius to match your site
* **Branded experience** — your site name and favicon appear on every list created from your content
* **AI-powered** — content is intelligently parsed into organized, categorized checklist items

**Perfect for:**

* Recipe blogs (ingredients become a grocery list)
* Travel blogs (packing lists, itineraries)
* How-to guides (step-by-step checklists)
* Gift guides (shopping lists)
* Event planning (to-do lists)

== Installation ==

1. Upload the `listmango` folder to `/wp-content/plugins/`
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Go to **Settings → ListMango**
4. Enter your website URL and click **Register Site**
5. Customize the button color and border radius
6. Add the **ListMango Button** block or `[listmango]` shortcode to your posts

== Frequently Asked Questions ==

= Do I need a ListMango account? =

No. The plugin registers your site automatically when you enter your URL in the settings. No account creation required.

= Is it free? =

Yes, completely free. There are no premium tiers or locked features.

= What data is sent to ListMango? =

When a reader clicks the button, the current page URL is sent to ListMango so the content can be converted into a checklist. During setup, your site URL is sent to detect your branding (name, favicon, colors). No personal data is collected or stored.

= Does it work with the classic editor? =

Yes. Use the `[listmango]` shortcode in any post or page. You can customize individual buttons: `[listmango color="#1A73E8" radius="12"]`.

= Can I place multiple buttons on the same page? =

Yes. Each button sends the current page URL, so multiple buttons on the same page will create the same checklist.

= What content formats work best? =

Any content with list-like items: recipes with ingredients, step-by-step guides, packing lists, shopping guides, etc. The AI is good at identifying actionable items in any format.

== Screenshots ==

1. Settings page — register your site and customize the button
2. The ListMango Button block in the Gutenberg editor
3. The button as it appears on your site
4. A checklist created from your content

== Changelog ==

= 1.0.0 =
* Initial release
* Gutenberg block support
* Shortcode support
* Automatic branding detection
* Customizable button color and border radius

== Privacy ==

This plugin connects to the ListMango service (listmango.com) in two ways:

1. **During setup:** Your site URL is sent to `listmango.com/api/embed/setup` to register your site and detect branding (name, favicon, colors). This happens only when you click "Register Site" in the settings.

2. **When readers click the button:** A small script (`listmango.com/embed.js`) loads and, on click, opens ListMango with the current page URL so the content can be converted into a checklist.

No personal data, cookies, or tracking information is collected. See the [ListMango Privacy Policy](https://listmango.com/privacy) for details.
