<?php
/**
 * ListMango Settings Page
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register settings page under Settings menu.
 */
function listmango_add_settings_page() {
	add_options_page(
		__( 'ListMango Settings', 'listmango' ),
		__( 'ListMango', 'listmango' ),
		'manage_options',
		'listmango',
		'listmango_render_settings_page'
	);
}
add_action( 'admin_menu', 'listmango_add_settings_page' );

/**
 * Enqueue admin styles on our settings page only.
 */
function listmango_admin_enqueue( $hook ) {
	if ( 'settings_page_listmango' !== $hook ) {
		return;
	}
	wp_enqueue_style( 'wp-color-picker' );
	wp_enqueue_script( 'wp-color-picker' );
	wp_enqueue_style(
		'listmango-admin',
		plugins_url( 'settings.css', __FILE__ ),
		array(),
		LISTMANGO_VERSION
	);
}
add_action( 'admin_enqueue_scripts', 'listmango_admin_enqueue' );

/**
 * Handle the site registration form submission.
 */
function listmango_handle_registration() {
	if ( ! isset( $_POST['listmango_register_nonce'] ) ) {
		return;
	}

	if ( ! wp_verify_nonce( $_POST['listmango_register_nonce'], 'listmango_register' ) ) {
		add_settings_error( 'listmango', 'nonce_failed', __( 'Security check failed. Please try again.', 'listmango' ) );
		return;
	}

	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	$url = isset( $_POST['listmango_site_url'] ) ? esc_url_raw( wp_unslash( $_POST['listmango_site_url'] ) ) : '';

	if ( empty( $url ) ) {
		add_settings_error( 'listmango', 'empty_url', __( 'Please enter your website URL.', 'listmango' ) );
		return;
	}

	// Call ListMango API to register the site.
	$response = wp_remote_post(
		LISTMANGO_API_URL . '/api/embed/setup',
		array(
			'timeout' => 30,
			'headers' => array( 'Content-Type' => 'application/json' ),
			'body'    => wp_json_encode( array( 'url' => $url ) ),
		)
	);

	if ( is_wp_error( $response ) ) {
		add_settings_error(
			'listmango',
			'api_error',
			sprintf(
				/* translators: %s: error message */
				__( 'Could not connect to ListMango: %s', 'listmango' ),
				$response->get_error_message()
			)
		);
		return;
	}

	$status = wp_remote_retrieve_response_code( $response );
	$body   = json_decode( wp_remote_retrieve_body( $response ), true );

	if ( 200 !== $status || empty( $body['site']['id'] ) ) {
		$error_msg = isset( $body['error'] ) ? $body['error'] : '';

		// Detect common issues and provide helpful messages.
		if ( preg_match( '/localhost|127\.0\.0\.1|\.local$/i', $url ) ) {
			$error_msg = __( 'The URL must be a publicly accessible website. Local/development URLs (localhost, .local) cannot be reached by ListMango.', 'listmango' );
		} elseif ( 400 === $status ) {
			$error_msg = __( 'ListMango could not read that URL. Make sure it is a publicly accessible website.', 'listmango' );
		} elseif ( 500 === $status ) {
			$error_msg = __( 'ListMango encountered a server error. Please try again in a few minutes.', 'listmango' );
		} elseif ( empty( $error_msg ) ) {
			$error_msg = sprintf(
				/* translators: %d: HTTP status code */
				__( 'Unexpected response (HTTP %d). Please try again.', 'listmango' ),
				$status
			);
		}

		add_settings_error( 'listmango', 'api_error', $error_msg );
		return;
	}

	$site = $body['site'];

	update_option( 'listmango_site_id', sanitize_text_field( $site['id'] ) );
	update_option( 'listmango_site_url', esc_url_raw( $url ) );
	update_option( 'listmango_site_name', sanitize_text_field( $site['name'] ?? '' ) );

	// Use brand primary color if available, otherwise keep current.
	if ( ! empty( $site['colors']['primary'] ) ) {
		$brand_color = sanitize_hex_color( $site['colors']['primary'] );
		if ( $brand_color ) {
			update_option( 'listmango_button_color', $brand_color );
		}
	}

	add_settings_error( 'listmango', 'registered', __( 'Site registered successfully!', 'listmango' ), 'success' );
}
add_action( 'admin_init', 'listmango_handle_registration' );

/**
 * Handle the auto-insert settings form submission.
 */
function listmango_handle_auto_insert() {
	if ( ! isset( $_POST['listmango_auto_insert_nonce'] ) ) {
		return;
	}

	if ( ! wp_verify_nonce( $_POST['listmango_auto_insert_nonce'], 'listmango_auto_insert' ) ) {
		add_settings_error( 'listmango', 'nonce_failed', __( 'Security check failed.', 'listmango' ) );
		return;
	}

	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	$post_types = isset( $_POST['listmango_auto_insert'] ) && is_array( $_POST['listmango_auto_insert'] )
		? array_map( 'sanitize_key', $_POST['listmango_auto_insert'] )
		: array();

	update_option( 'listmango_auto_insert', $post_types );

	add_settings_error( 'listmango', 'saved', __( 'Auto-insert settings saved.', 'listmango' ), 'success' );
}
add_action( 'admin_init', 'listmango_handle_auto_insert' );

/**
 * Handle the appearance settings form submission.
 */
function listmango_handle_appearance() {
	if ( ! isset( $_POST['listmango_appearance_nonce'] ) ) {
		return;
	}

	if ( ! wp_verify_nonce( $_POST['listmango_appearance_nonce'], 'listmango_appearance' ) ) {
		add_settings_error( 'listmango', 'nonce_failed', __( 'Security check failed.', 'listmango' ) );
		return;
	}

	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	$color  = isset( $_POST['listmango_button_color'] ) ? sanitize_hex_color( wp_unslash( $_POST['listmango_button_color'] ) ) : '#FF6B35';
	$radius = isset( $_POST['listmango_button_radius'] ) ? absint( $_POST['listmango_button_radius'] ) : 8;

	if ( $radius > 24 ) {
		$radius = 24;
	}

	update_option( 'listmango_button_color', $color ? $color : '#FF6B35' );
	update_option( 'listmango_button_radius', $radius );

	add_settings_error( 'listmango', 'saved', __( 'Settings saved.', 'listmango' ), 'success' );
}
add_action( 'admin_init', 'listmango_handle_appearance' );

/**
 * Render the settings page.
 */
function listmango_render_settings_page() {
	$site_id    = get_option( 'listmango_site_id', '' );
	$site_url   = get_option( 'listmango_site_url', '' );
	$site_name  = get_option( 'listmango_site_name', '' );
	$color      = get_option( 'listmango_button_color', '#FF6B35' );
	$radius     = absint( get_option( 'listmango_button_radius', 8 ) );
	$configured = ! empty( $site_id );
	?>
	<div class="wrap listmango-settings">
		<h1><?php esc_html_e( 'ListMango Settings', 'listmango' ); ?></h1>

		<?php settings_errors( 'listmango' ); ?>

		<!-- Step 1: Register Site -->
		<div class="listmango-card">
			<h2><?php esc_html_e( '1. Connect Your Site', 'listmango' ); ?></h2>
			<?php if ( $configured ) : ?>
				<div class="listmango-status listmango-status--connected">
					<span class="dashicons dashicons-yes-alt"></span>
					<?php
					printf(
						/* translators: %s: site name or ID */
						esc_html__( 'Connected as %s', 'listmango' ),
						'<strong>' . esc_html( $site_name ? $site_name : $site_id ) . '</strong>'
					);
					?>
				</div>
			<?php endif; ?>

			<form method="post" action="">
				<?php wp_nonce_field( 'listmango_register', 'listmango_register_nonce' ); ?>
				<table class="form-table">
					<tr>
						<th scope="row">
							<label for="listmango_site_url"><?php esc_html_e( 'Website URL', 'listmango' ); ?></label>
						</th>
						<td>
							<input
								type="url"
								id="listmango_site_url"
								name="listmango_site_url"
								value="<?php echo esc_attr( $site_url ? $site_url : get_site_url() ); ?>"
								class="regular-text"
								placeholder="https://example.com"
								required
							/>
							<p class="description">
								<?php esc_html_e( 'Your website URL. ListMango will extract your branding automatically.', 'listmango' ); ?>
							</p>
						</td>
					</tr>
				</table>
				<?php submit_button( $configured ? __( 'Re-register', 'listmango' ) : __( 'Register Site', 'listmango' ), 'primary', 'listmango_register_submit' ); ?>
			</form>
		</div>

		<?php if ( $configured ) : ?>
		<!-- Step 2: Customize -->
		<div class="listmango-card">
			<h2><?php esc_html_e( '2. Customize Button', 'listmango' ); ?></h2>
			<form method="post" action="">
				<?php wp_nonce_field( 'listmango_appearance', 'listmango_appearance_nonce' ); ?>
				<table class="form-table">
					<tr>
						<th scope="row">
							<label for="listmango_button_color"><?php esc_html_e( 'Button Color', 'listmango' ); ?></label>
						</th>
						<td>
							<input
								type="text"
								id="listmango_button_color"
								name="listmango_button_color"
								value="<?php echo esc_attr( $color ); ?>"
								class="listmango-color-picker"
								data-default-color="#FF6B35"
							/>
						</td>
					</tr>
					<tr>
						<th scope="row">
							<label for="listmango_button_radius"><?php esc_html_e( 'Border Radius', 'listmango' ); ?></label>
						</th>
						<td>
							<input
								type="range"
								id="listmango_button_radius"
								name="listmango_button_radius"
								value="<?php echo esc_attr( $radius ); ?>"
								min="0"
								max="24"
								step="1"
							/>
							<span id="listmango-radius-value"><?php echo esc_html( $radius ); ?>px</span>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Preview', 'listmango' ); ?></th>
						<td>
							<div id="listmango-preview">
								<button
									type="button"
									id="listmango-preview-btn"
									style="
										font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
										font-size: 14px;
										font-weight: 600;
										border: none;
										cursor: default;
										padding: 8px 16px;
										background: <?php echo esc_attr( $color ); ?>;
										border-radius: <?php echo esc_attr( $radius ); ?>px;
										color: #fff;
									"
								>&#x1F96D; Make it a List</button>
							</div>
						</td>
					</tr>
				</table>
				<?php submit_button( __( 'Save Appearance', 'listmango' ), 'primary', 'listmango_appearance_submit' ); ?>
			</form>
		</div>

		<!-- Step 3: Auto-Insert -->
		<div class="listmango-card">
			<h2><?php esc_html_e( '3. Auto-Insert Button', 'listmango' ); ?></h2>
			<p><?php esc_html_e( 'Automatically add the button at the end of every post or page — no block or shortcode needed.', 'listmango' ); ?></p>
			<form method="post" action="">
				<?php
				wp_nonce_field( 'listmango_auto_insert', 'listmango_auto_insert_nonce' );
				$auto_insert = get_option( 'listmango_auto_insert', array() );
				if ( ! is_array( $auto_insert ) ) {
					$auto_insert = array();
				}
				$post_types = get_post_types( array( 'public' => true ), 'objects' );
				?>
				<fieldset>
					<?php foreach ( $post_types as $pt ) : ?>
						<label style="display:block; margin-bottom:8px;">
							<input
								type="checkbox"
								name="listmango_auto_insert[]"
								value="<?php echo esc_attr( $pt->name ); ?>"
								<?php checked( in_array( $pt->name, $auto_insert, true ) ); ?>
							/>
							<?php echo esc_html( $pt->labels->name ); ?>
						</label>
					<?php endforeach; ?>
				</fieldset>
				<p class="description" style="margin-top:8px;">
					<?php esc_html_e( 'The button will appear at the end of every published post of the selected types. You can still use the block or shortcode for more precise placement.', 'listmango' ); ?>
				</p>
				<?php submit_button( __( 'Save', 'listmango' ), 'primary', 'listmango_auto_insert_submit' ); ?>
			</form>
		</div>

		<!-- Step 4: Manual Placement -->
		<div class="listmango-card">
			<h2><?php esc_html_e( '4. Manual Placement', 'listmango' ); ?></h2>
			<h3><?php esc_html_e( 'Block Editor (Gutenberg)', 'listmango' ); ?></h3>
			<p><?php esc_html_e( 'Search for "ListMango" in the block inserter and add the ListMango Button block wherever you want the button to appear.', 'listmango' ); ?></p>

			<h3><?php esc_html_e( 'Shortcode (Classic Editor)', 'listmango' ); ?></h3>
			<p><?php esc_html_e( 'Paste this shortcode into any post or page:', 'listmango' ); ?></p>
			<code class="listmango-shortcode">[listmango]</code>

			<p class="description" style="margin-top: 12px;">
				<?php esc_html_e( 'You can override the color and radius per-button:', 'listmango' ); ?>
				<br/>
				<code>[listmango color="#1A73E8" radius="12"]</code>
			</p>
		</div>
		<?php endif; ?>
	</div>

	<script>
	jQuery(document).ready(function($) {
		$('.listmango-color-picker').wpColorPicker({
			change: function(event, ui) {
				$('#listmango-preview-btn').css('background-color', ui.color.toString());
			}
		});

		$('#listmango_button_radius').on('input', function() {
			var val = $(this).val();
			$('#listmango-radius-value').text(val + 'px');
			$('#listmango-preview-btn').css('border-radius', val + 'px');
		});
	});
	</script>
	<?php
}
