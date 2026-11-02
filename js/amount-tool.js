// Shared page logic for the amount-in-words tools.
(function (root) {
  // Returns { dinars, millimes } or { error: 'invalid' | 'decimals' | 'tooBig' } or null when empty
  function parseAmount(text) {
    // Accept Arabic-Indic digits, spaces as thousands separators, comma or dot as decimal mark
    var s = String(text).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })
      .replace(/[\s  ]/g, '').replace(/[,٫]/g, '.');
    if (s === '') return null;
    if (!/^\d+(\.\d*)?$/.test(s)) return { error: 'invalid' };
    var parts = s.split('.');
    var dec = parts[1] || '';
    if (dec.length > 3) return { error: 'decimals' };
    var whole = parts[0].replace(/^0+(?=\d)/, '');
    if (whole.length > 9) return { error: 'tooBig' };
    return { dinars: parseInt(whole, 10), millimes: parseInt((dec + '000').slice(0, 3), 10) };
  }

  function init(opts) {
    var input = document.getElementById('amount');
    var out = document.getElementById('out');
    var copy = document.getElementById('copy');
    var status = document.getElementById('status');

    function update() {
      var r = parseAmount(input.value);
      status.textContent = '';
      if (!r || r.error) {
        out.textContent = '';
        copy.disabled = true;
        if (r) status.textContent = opts.messages[r.error];
        return;
      }
      var words = opts.convert(r.dinars, r.millimes);
      if (opts.capitalize) words = words.charAt(0).toUpperCase() + words.slice(1);
      out.textContent = words;
      copy.disabled = false;
    }

    input.addEventListener('input', update);
    copy.addEventListener('click', function () {
      var text = out.textContent;
      var done = function () { status.textContent = opts.messages.copied; };
      var fail = function () { status.textContent = opts.messages.copyFailed; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fail);
      else fail();
    });
    update();
  }

  var api = { init: init, parseAmount: parseAmount };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AmountTool = api;
})(this);
