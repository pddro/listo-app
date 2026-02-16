<?php
/**
 * Plugin Name:       ListMango – Make it a List
 * Plugin URI:        https://listmango.com/wordpress
 * Description:       Readers don't share articles — they share lists. Add a "Make it a List" button and let readers turn your content into shareable checklists that link back to your site.
 * Version:           1.0.1
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            ListMango
 * Author URI:        https://listmango.com
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       listmango
 * Domain Path:       /languages
 *
 * @package ListMango
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'LISTMANGO_VERSION', '1.0.1' );
define( 'LISTMANGO_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'LISTMANGO_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'LISTMANGO_API_URL', 'https://listmango.com' );

// Admin settings page.
require_once LISTMANGO_PLUGIN_DIR . 'admin/settings.php';

/**
 * Register the Gutenberg block.
 */
function listmango_register_block() {
	wp_register_script(
		'listmango-button-editor',
		plugins_url( 'blocks/listo-button/edit.js', __FILE__ ),
		array( 'wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-i18n', 'wp-hooks' ),
		LISTMANGO_VERSION,
		true
	);

	wp_localize_script(
		'listmango-button-editor',
		'listmangoSettings',
		array(
			'siteId'      => get_option( 'listmango_site_id', '' ),
			'buttonColor' => get_option( 'listmango_button_color', '#FF6B35' ),
			'buttonRadius' => intval( get_option( 'listmango_button_radius', 8 ) ),
			'configured'  => ! empty( get_option( 'listmango_site_id' ) ),
			'settingsUrl' => admin_url( 'options-general.php?page=listmango' ),
		)
	);

	register_block_type(
		LISTMANGO_PLUGIN_DIR . 'blocks/listo-button',
		array( 'editor_script' => 'listmango-button-editor' )
	);
}
add_action( 'init', 'listmango_register_block' );

/**
 * Shortcode: [listmango] or [listmango color="#FF6B35" radius="8"]
 */
function listmango_shortcode( $atts ) {
	$atts = shortcode_atts(
		array(
			'color'  => '',
			'radius' => '',
		),
		$atts,
		'listmango'
	);

	$site_id = get_option( 'listmango_site_id' );
	if ( empty( $site_id ) ) {
		return '<!-- ListMango: Plugin not configured. Go to Settings > ListMango. -->';
	}

	$color  = ! empty( $atts['color'] ) ? sanitize_hex_color( $atts['color'] ) : get_option( 'listmango_button_color', '#FF6B35' );
	$radius = $atts['radius'] !== '' ? absint( $atts['radius'] ) : absint( get_option( 'listmango_button_radius', 8 ) );

	// phpcs:disable WordPress.WP.EnqueuedResources.NonEnqueuedScript -- SaaS embed requires per-instance data attributes.
	return sprintf(
		'<script src="%s" data-site="%s" data-color="%s" data-radius="%s"></script>',
		esc_url( LISTMANGO_API_URL . '/embed.js' ),
		esc_attr( $site_id ),
		esc_attr( $color ),
		esc_attr( $radius )
	);
	// phpcs:enable WordPress.WP.EnqueuedResources.NonEnqueuedScript
}
add_shortcode( 'listmango', 'listmango_shortcode' );

/**
 * Auto-insert the button at the end of post content.
 */
function listmango_auto_insert_button( $content ) {
	if ( ! is_singular() || ! is_main_query() ) {
		return $content;
	}

	$auto_insert = get_option( 'listmango_auto_insert', array() );
	if ( empty( $auto_insert ) || ! is_array( $auto_insert ) ) {
		return $content;
	}

	$post_type = get_post_type();
	if ( ! in_array( $post_type, $auto_insert, true ) ) {
		return $content;
	}

	$site_id = get_option( 'listmango_site_id', '' );
	if ( empty( $site_id ) ) {
		return $content;
	}

	$color  = get_option( 'listmango_button_color', '#FF6B35' );
	$radius = absint( get_option( 'listmango_button_radius', 8 ) );

	// phpcs:disable WordPress.WP.EnqueuedResources.NonEnqueuedScript -- SaaS embed requires per-instance data attributes.
	$button = sprintf(
		'<div class="listmango-auto-insert" style="margin-top:24px;"><script src="%s" data-site="%s" data-color="%s" data-radius="%s"></script></div>',
		esc_url( LISTMANGO_API_URL . '/embed.js' ),
		esc_attr( $site_id ),
		esc_attr( $color ),
		esc_attr( $radius )
	);
	// phpcs:enable WordPress.WP.EnqueuedResources.NonEnqueuedScript

	return $content . $button;
}
add_filter( 'the_content', 'listmango_auto_insert_button' );

/**
 * Plugin activation — set default options.
 */
function listmango_activate() {
	add_option( 'listmango_site_id', '' );
	add_option( 'listmango_site_url', '' );
	add_option( 'listmango_site_name', '' );
	add_option( 'listmango_button_color', '#FF6B35' );
	add_option( 'listmango_button_radius', '8' );
	add_option( 'listmango_auto_insert', array() );
}
register_activation_hook( __FILE__, 'listmango_activate' );

/**
 * Add Settings link on the Plugins page.
 */
function listmango_plugin_action_links( $links ) {
	$settings_link = sprintf(
		'<a href="%s">%s</a>',
		admin_url( 'options-general.php?page=listmango' ),
		esc_html__( 'Settings', 'listmango' )
	);
	array_unshift( $links, $settings_link );
	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'listmango_plugin_action_links' );
