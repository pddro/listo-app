jQuery( document ).ready( function ( $ ) {
	$( '.listmango-color-picker' ).wpColorPicker( {
		change: function ( event, ui ) {
			$( '#listmango-preview-btn' ).css( 'background-color', ui.color.toString() );
		},
	} );

	$( '#listmango_button_radius' ).on( 'input', function () {
		var val = $( this ).val();
		$( '#listmango-radius-value' ).text( val + 'px' );
		$( '#listmango-preview-btn' ).css( 'border-radius', val + 'px' );
	} );
} );
