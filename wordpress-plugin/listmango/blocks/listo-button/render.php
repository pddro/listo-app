<?php
/**
 * Server-side render for the ListMango Button block.
 *
 * @param array    $attributes Block attributes.
 * @param string   $content    Block content (empty for dynamic blocks).
 * @param WP_Block $block      Block instance.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$listmango_site_id = get_option( 'listmango_site_id', '' );
if ( empty( $listmango_site_id ) ) {
	return;
}

$listmango_color  = ! empty( $attributes['color'] ) ? sanitize_hex_color( $attributes['color'] ) : get_option( 'listmango_button_color', '#FF6B35' );
$listmango_radius = isset( $attributes['radius'] ) && $attributes['radius'] >= 0 ? absint( $attributes['radius'] ) : absint( get_option( 'listmango_button_radius', 8 ) );

// phpcs:disable WordPress.WP.EnqueuedResources.NonEnqueuedScript -- SaaS embed requires per-instance data attributes.
printf(
	'<div %s><script src="%s" data-site="%s" data-color="%s" data-radius="%s"></script></div>',
	wp_kses_post( get_block_wrapper_attributes() ),
	esc_url( LISTMANGO_API_URL . '/embed.js' ),
	esc_attr( $listmango_site_id ),
	esc_attr( $listmango_color ),
	esc_attr( $listmango_radius )
);
// phpcs:enable WordPress.WP.EnqueuedResources.NonEnqueuedScript
