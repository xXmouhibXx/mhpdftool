// Converts a number to French words, and an amount to Tunisian dinars and millimes.
(function (root) {
  var UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
    'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  var TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

  // 0..99. "final" is false when another number word follows (affects "quatre-vingts").
  function below100(n, final) {
    if (n < 20) return UNITS[n];
    var t = Math.floor(n / 10), u = n % 10;
    if (t === 7 || t === 9) {
      if (t === 7 && u === 1) return 'soixante et onze';
      return TENS[t] + '-' + UNITS[10 + u];
    }
    if (u === 0) return t === 8 ? (final ? 'quatre-vingts' : 'quatre-vingt') : TENS[t];
    if (u === 1 && t !== 8) return TENS[t] + ' et un';
    return TENS[t] + '-' + UNITS[u];
  }

  // 1..999
  function below1000(n, final) {
    var h = Math.floor(n / 100), r = n % 100, out = '';
    if (h === 1) out = 'cent';
    else if (h > 1) out = UNITS[h] + (r === 0 && final ? ' cents' : ' cent');
    if (r > 0) out += (out ? ' ' : '') + below100(r, final);
    return out;
  }

  function numberToFrench(n) {
    if (n === 0) return 'zéro';
    var millions = Math.floor(n / 1000000);
    var thousands = Math.floor(n / 1000) % 1000;
    var rest = n % 1000;
    var parts = [];
    if (millions) parts.push(below1000(millions, true) + (millions > 1 ? ' millions' : ' million'));
    // "mille" is invariable and the number before it never takes a final "s"
    if (thousands) parts.push(thousands === 1 ? 'mille' : below1000(thousands, false) + ' mille');
    if (rest) parts.push(below1000(rest, true));
    return parts.join(' ');
  }

  // dinars: integer 0..999999999, millimes: integer 0..999
  function amountToFrench(dinars, millimes) {
    var parts = [];
    if (dinars > 0 || millimes === 0) {
      var w = numberToFrench(dinars);
      // "un million de dinars": "de" after a round number of millions
      var de = dinars >= 1000000 && dinars % 1000000 === 0 ? ' de' : '';
      parts.push(w + de + (dinars > 1 ? ' dinars' : ' dinar'));
    }
    if (millimes > 0) parts.push(numberToFrench(millimes) + (millimes > 1 ? ' millimes' : ' millime'));
    return parts.join(' et ');
  }

  var api = { numberToFrench: numberToFrench, amountToFrench: amountToFrench };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FrWords = api;
})(this);
