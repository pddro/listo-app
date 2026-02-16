=== ListMango – Make it a List ===
Contributors: listmangoapp
Tags: checklist, list, recipe, grocery, share
Requires at least: 6.0
Tested up to: 6.9
Requires PHP: 7.4
Stable tag: 1.0.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Readers don't share articles — they share lists. Add a button that turns your content into shareable checklists that link back to your site.

== Description ==

**Your readers won't share your 2,000 word article. But they'll text the grocery list from it in a heartbeat.**

ListMango adds a "Make it a List" button to your posts. When a reader clicks it, your content is instantly turned into a clean, tappable checklist they can save, share, and use. Every list is branded with your site name, favicon, and a link back to the original page.

That means every shared list is an organic backlink to **your** site. You do nothing — your readers do the sharing for you.

**Why it works:**

Your article gets read once and forgotten. The list from your article gets texted to a partner, checked off at the store, forwarded to a friend. Lists are actionable and portable in a way articles never will be.

**How it works:**

1. Install the plugin and enter your website URL
2. ListMango auto-detects your branding (colors, favicon, site name)
3. Choose where the button appears — auto-insert on all posts, add to specific pages with the Gutenberg block, or use the `[listmango]` shortcode
4. Readers click and get an instant checklist from your content

**Features:**

* **Auto-insert** — add the button to every post automatically, no editing needed
* **Gutenberg block** — drag and drop for precise placement
* **Shortcode** — `[listmango]` for classic editor users
* **Branded lists** — your site name, favicon, and colors on every list
* **Backlinks built-in** — every list links back to the original page on your site
* **One-click setup** — enter your URL, branding is detected automatically
* **Customizable** — match your button color and style to your site
* **AI-powered** — content is intelligently parsed into organized, categorized items

**Perfect for:**

* Recipe blogs — ingredients become a grocery list
* Travel blogs — packing lists and itineraries
* How-to guides — steps become a checklist
* Gift guides — recommendations become a shopping list
* Resource roundups — links and tools to check off
* Fitness & health — workout plans and meal prep

[See it in action →](https://listmango.com/wordpress)

== Installation ==

1. Go to **Plugins → Add New** in your WordPress admin
2. Search for **"ListMango"**
3. Click **Install Now**, then **Activate**
4. Go to **Settings → ListMango** and enter your website URL
5. Choose to auto-insert on posts, or use the block/shortcode for manual placement

== Frequently Asked Questions ==

= Do I need a ListMango account? =

No. The plugin registers your site automatically when you enter your URL in the settings. No account, no sign-up.

= Is it free? =

Yes, completely free. No premium tiers, no locked features, no limits.

= How does this help my SEO? =

Every list created from your content shows your site name, favicon, and a direct link back to the original page. When readers share those lists — and they will — your site gets organic backlinks you didn't have to build.

= What data is sent to ListMango? =

When a reader clicks the button, the current page URL is sent to ListMango so the content can be converted into a checklist. During setup, your site URL is sent to detect your branding (name, favicon, colors). No personal data is collected or stored.

= Does it work with the classic editor? =

Yes. Use the `[listmango]` shortcode in any post or page. You can customize per-button: `[listmango color="#1A73E8" radius="12"]`.

= Can I auto-insert the button on all posts? =

Yes. In **Settings → ListMango**, check "Posts" under Auto-Insert and the button appears at the end of every post automatically. No editing required.

= What content formats work best? =

Anything with actionable items: recipes, step-by-step guides, packing lists, shopping guides, workout routines, resource lists. The AI handles any format.

== Screenshots ==

1. Settings page — register your site and customize the button
2. Auto-insert settings — choose which post types get the button automatically
3. The ListMango Button block in the Gutenberg editor
4. The button as it appears on your site
5. A branded checklist created from your content

== Changelog ==

= 1.0.0 =
* Initial release
* Auto-insert button on selected post types
* Gutenberg block with custom mango icon
* Shortcode support with color and radius overrides
* Automatic branding detection from your site
* Customizable button color and border radius

== Third-Party Service ==

This plugin relies on the [ListMango](https://listmango.com) service to function. ListMango is the external service that converts page content into interactive checklists.

**What connects to ListMango and when:**

1. **Site registration (admin only, user-initiated):** When you click "Register Site" in Settings → ListMango, your site URL is sent to `https://listmango.com/api/embed/setup` to detect your site's branding (name, favicon, colors). This only happens when you explicitly click the button.

2. **Frontend button script:** On pages where the button is displayed, a small JavaScript file (`https://listmango.com/embed.js`) is loaded. This script renders the "Make it a List" button. No data is sent until a reader clicks the button.

3. **Reader clicks the button:** When a reader clicks the button, they are directed to `https://listmango.com/mango?url=PAGE_URL` in a new tab, where the page content is converted into a checklist.

* Service URL: [https://listmango.com](https://listmango.com)
* Terms of Service: [https://listmango.com/privacy](https://listmango.com/privacy)
* Privacy Policy: [https://listmango.com/privacy](https://listmango.com/privacy)

No personal data, cookies, or tracking information is collected by the plugin or the service.
