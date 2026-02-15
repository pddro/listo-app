(function () {
  var s = document.currentScript;
  if (!s) return;

  var siteId = s.getAttribute('data-site');
  if (!siteId) {
    console.error('[ListMango] data-site attribute is required');
    return;
  }

  var color = s.getAttribute('data-color') || '#FF6B35';
  var radius = s.getAttribute('data-radius') || '8';
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

  btn.style.cssText =
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
    'font-size:14px;font-weight:600;border:none;cursor:pointer;' +
    'color:' + textColor + ';background:' + color + ';' +
    'padding:8px 16px;border-radius:' + radius + 'px;' +
    'transition:opacity 0.15s ease;' +
    'display:inline-block;';

  btn.onmouseenter = function () { btn.style.opacity = '0.85'; };
  btn.onmouseleave = function () { btn.style.opacity = '1'; };

  btn.onclick = function () {
    var url = encodeURIComponent(window.location.href);
    window.open(host + '/mango?url=' + url + '&site=' + siteId, '_blank');
  };

  // Insert right where the script tag is (inline by default)
  s.parentNode.insertBefore(btn, s);
})();
