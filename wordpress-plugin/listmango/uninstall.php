<?php
/**
 * Fired when the plugin is uninstalled.
 */

if ( ! defined( 'ABSPATH' ) || ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'listmango_site_id' );
delete_option( 'listmango_site_url' );
delete_option( 'listmango_site_name' );
delete_option( 'listmango_button_color' );
delete_option( 'listmango_button_radius' );
delete_option( 'listmango_auto_insert' );
