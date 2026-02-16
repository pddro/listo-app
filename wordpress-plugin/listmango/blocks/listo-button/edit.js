( function ( wp ) {
	var el = wp.element.createElement;
	var Fragment = wp.element.Fragment;
	var InspectorControls = wp.blockEditor.InspectorControls;
	var useBlockProps = wp.blockEditor.useBlockProps;
	var PanelBody = wp.components.PanelBody;
	var RangeControl = wp.components.RangeControl;
	var ColorPalette = wp.components.ColorPalette;
	var __ = wp.i18n.__;

	var settings = window.listmangoSettings || {};

	var mangoIcon = el( 'svg', { width: 24, height: 24, viewBox: '0 0 200 200', fill: 'none' },
		el( 'path', { d: 'M46.2308 165.637C45.8036 163.464 45.6608 157.552 45.6509 155.259C45.5592 133.858 49.4251 110.994 57.1301 91.0396C63.0473 75.7154 74.374 61.8724 89.6141 55.251C98.5209 51.3813 108.617 49.9808 118.177 52.1048C120.999 52.7316 123.594 53.7413 126.272 54.8032C127.834 55.5096 129.769 56.3502 131.09 57.4213C132.79 58.6271 135.602 60.456 137.011 61.8722C147.924 70.4287 155.569 84.2367 157.181 98.0099C161.744 137.011 122.946 165.577 91.2642 179.099C80.8551 183.54 63.7204 189.817 53.889 181.926C48.68 177.768 46.8175 172.083 46.2308 165.637Z', fill: '#FEC539' } ),
		el( 'path', { d: 'M137.011 61.8722C147.924 70.4287 155.569 84.2367 157.181 98.0099C161.744 137.011 122.946 165.577 91.2641 179.099C80.8551 183.54 63.7204 189.817 53.889 181.926C48.68 177.768 46.8175 172.083 46.2308 165.637C46.4163 165.819 46.4245 165.785 46.5073 165.973C47.5727 168.449 48.5244 170.913 51.0798 172.24C56.5207 175.065 62.718 172.284 67.7147 169.798C70.523 168.399 73.1909 166.854 75.8681 165.29C80.805 162.357 85.6009 159.192 90.24 155.807C107.811 143.197 124.859 127.368 135.356 108.322C142.367 95.5995 146.817 78.3699 139.106 65.0844C138.725 64.4278 137.052 62.4363 137.011 61.8722Z', fill: '#FE922B' } ),
		el( 'path', { d: 'M112.565 33.692L112.417 33.4812C111.705 32.4523 111.067 31.1294 110.352 30.0366C106.055 23.4826 99.4756 19.0208 91.7493 17.5886C79.3004 15.2807 65.9954 21.151 55.1727 26.8353C52.611 28.1804 55.4115 30.5343 56.4538 31.9215C64.498 40.9008 74.8365 49.8542 87.3966 50.7533C95.752 51.3516 105.806 48.0947 112.395 42.4651C112.983 41.9628 126.702 43.1608 127.231 42.6218C127.36 42.3682 127.165 41.1047 127.1 40.5494C127.072 40.316 114.077 39.1605 114.026 38.8954C113.674 37.0691 112.839 34.6406 112.565 33.692Z', fill: '#73A44B' } ),
		el( 'path', { d: 'M126.272 54.8032C127.105 49.9374 127.488 45.2105 126.993 40.2787C126.762 37.9713 126.243 35.6377 126.164 33.3246C126.13 32.3211 126.287 31.2937 127.029 30.5505C127.834 29.7423 129.327 29.3273 130.442 29.3782C131.434 29.4233 132.33 29.8563 132.972 30.6177C135.149 33.2023 134.453 43.6535 134.194 47.2225C134.022 49.2055 133.595 52.0746 132.431 54.3751C131.995 55.3953 131.547 56.4107 131.09 57.4213C129.769 56.3502 127.834 55.5097 126.272 54.8032Z', fill: '#76482E' } )
	);

	// Inject custom SVG icon via filter (block.json only supports dashicon strings).
	wp.hooks.addFilter(
		'blocks.registerBlockType',
		'listmango/set-icon',
		function ( blockSettings, blockName ) {
			if ( blockName === 'listmango/button' ) {
				blockSettings.icon = mangoIcon;
			}
			return blockSettings;
		}
	);

	/**
	 * WCAG relative luminance — determines text color.
	 */
	function isLight( hex ) {
		var c = hex.replace( '#', '' );
		var r = parseInt( c.substring( 0, 2 ), 16 ) / 255;
		var g = parseInt( c.substring( 2, 4 ), 16 ) / 255;
		var b = parseInt( c.substring( 4, 6 ), 16 ) / 255;
		r = r <= 0.03928 ? r / 12.92 : Math.pow( ( r + 0.055 ) / 1.055, 2.4 );
		g = g <= 0.03928 ? g / 12.92 : Math.pow( ( g + 0.055 ) / 1.055, 2.4 );
		b = b <= 0.03928 ? b / 12.92 : Math.pow( ( b + 0.055 ) / 1.055, 2.4 );
		return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4;
	}

	wp.blocks.registerBlockType( 'listmango/button', {
		edit: function ( props ) {
			var color = props.attributes.color || settings.buttonColor || '#FF6B35';
			var radius =
				props.attributes.radius >= 0
					? props.attributes.radius
					: settings.buttonRadius || 8;
			var textColor = isLight( color ) ? '#1A1A1A' : '#fff';
			var blockProps = useBlockProps();

			if ( ! settings.configured ) {
				return el(
					'div',
					blockProps,
					el(
						'div',
						{
							style: {
								padding: '16px 20px',
								background: '#fff3cd',
								border: '1px solid #ffc107',
								borderRadius: '4px',
								fontSize: '14px',
							},
						},
						el(
							'strong',
							null,
							__( 'ListMango: ', 'listmango' )
						),
						__( 'Please ', 'listmango' ),
						el(
							'a',
							{ href: settings.settingsUrl },
							__( 'configure the plugin', 'listmango' )
						),
						__( ' first.', 'listmango' )
					)
				);
			}

			return el(
				Fragment,
				null,
				el(
					InspectorControls,
					null,
					el(
						PanelBody,
						{
							title: __( 'Button Appearance', 'listmango' ),
							initialOpen: true,
						},
						el( 'p', { style: { marginBottom: '8px' } }, __( 'Button Color', 'listmango' ) ),
						el( ColorPalette, {
							value: color,
							onChange: function ( val ) {
								props.setAttributes( { color: val || '' } );
							},
						} ),
						el( RangeControl, {
							label: __( 'Border Radius', 'listmango' ),
							value: radius,
							onChange: function ( val ) {
								props.setAttributes( { radius: val } );
							},
							min: 0,
							max: 24,
						} )
					)
				),
				el(
					'div',
					blockProps,
					el(
						'button',
						{
							type: 'button',
							style: {
								fontFamily:
									"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
								fontSize: '14px',
								fontWeight: '600',
								border: 'none',
								cursor: 'default',
								color: textColor,
								background: color,
								padding: '8px 16px',
								borderRadius: radius + 'px',
							},
						},
						'\uD83E\uDD6D ' + __( 'Make it a List', 'listmango' )
					)
				)
			);
		},

		save: function () {
			return null;
		},
	} );
} )( window.wp );
