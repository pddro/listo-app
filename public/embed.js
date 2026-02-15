(function () {
  var s = document.currentScript;
  if (!s) return;

  var siteId = s.getAttribute('data-site');
  if (!siteId) {
    console.error('[ListMango] data-site attribute is required');
    return;
  }

  var color = s.getAttribute('data-color') || '#FF6B35';
  var position = s.getAttribute('data-position') || 'bottom-right';
  var label = '\uD83E\uDD6D Make it a List';
  var host = s.getAttribute('data-host') || 'https://listmango.com';

  // Relative luminance check (WCAG formula)
  function isLight(hex) {
    var c = hex.replace('#', '');
    var r = parseInt(c.substring(0, 2), 16) / 255;
    var g = parseInt(c.substring(2, 4), 16) / 255;
    var b = parseInt(c.substring(4, 6), 16) / 255;
    r = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    g = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    b = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4;
  }

  var textColor = isLight(color) ? '#1A1A1A' : '#fff';

  var btn = document.createElement('button');
  btn.textContent = label;
  btn.setAttribute('aria-label', label);

  // Shared styles
  var baseStyles =
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
    'font-size:14px;font-weight:600;border:none;cursor:pointer;' +
    'color:' + textColor + ';background:' + color + ';' +
    'padding:10px 18px;border-radius:24px;' +
    'box-shadow:0 2px 12px rgba(0,0,0,0.15);' +
    'transition:transform 0.15s ease,box-shadow 0.15s ease;' +
    'z-index:9999;';

  if (position === 'inline') {
    btn.style.cssText = baseStyles + 'position:relative;';
  } else {
    var posStyles =
      position === 'bottom-left'
        ? 'bottom:20px;left:20px;'
        : 'bottom:20px;right:20px;';
    btn.style.cssText = baseStyles + 'position:fixed;' + posStyles;
  }

  btn.onmouseenter = function () {
    btn.style.transform = 'scale(1.05)';
    btn.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
  };
  btn.onmouseleave = function () {
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)';
  };

  btn.onclick = function () {
    var url = encodeURIComponent(window.location.href);
    window.open(host + '/mango?url=' + url + '&site=' + siteId, '_blank');
  };

  document.body.appendChild(btn);
})();
