// Converts an amount to Arabic words (tafqit) in Tunisian dinars and millimes.
(function (root) {
  var ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة'];
  var TEENS = ['', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  var TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  var HUNDREDS = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];

  // Noun forms: one = alone for 1, two = alone for 2, plural = after 3..10,
  // acc = after 11..99, sing = after round hundreds / thousands / millions.
  var DINAR = { sing: 'دينار', one: 'دينار واحد', two: 'ديناران', plural: 'دنانير', acc: 'ديناراً' };
  var MILLIME = { sing: 'مليم', one: 'مليم واحد', two: 'مليمان', plural: 'مليمات', acc: 'مليماً' };
  var THOUSAND = { sing: 'ألف', one: 'ألف', two: 'ألفان', plural: 'آلاف', acc: 'ألفاً' };
  var MILLION = { sing: 'مليون', one: 'مليون', two: 'مليونان', plural: 'ملايين', acc: 'مليوناً' };

  // 3..99 as number words
  function below100(n) {
    if (n <= 10) return ONES[n];
    if (n < 20) return TEENS[n - 10];
    var t = Math.floor(n / 10), u = n % 10;
    return u ? ONES[u] + ' و' + TENS[t] : TENS[t];
  }

  // A dual directly followed by its noun loses the final "ن": مئتان -> مئتا دينار
  function construct(word) {
    return word.replace(/ان$/, 'ا');
  }

  // n (1..999) of a noun, as a list of parts to be joined with " و"
  function count(n, noun) {
    var h = Math.floor(n / 100), r = n % 100, parts = [];
    if (r === 0) return [construct(HUNDREDS[h]) + ' ' + noun.sing];
    if (h) {
      // 101 and 102 repeat the noun: مئة ألف وألف (not مئة وألف, which reads as 1100)
      if (r <= 2 && noun !== DINAR && noun !== MILLIME) parts.push(HUNDREDS[h] + ' ' + noun.sing);
      else parts.push(HUNDREDS[h]);
    }
    if (r === 1) parts.push(noun.one);
    else if (r === 2) parts.push(noun.two);
    else if (r <= 10) parts.push(below100(r) + ' ' + noun.plural);
    else parts.push(below100(r) + ' ' + noun.acc);
    return parts;
  }

  // Whole amount of a currency noun, 1..999999999
  function countAll(n, noun) {
    var millions = Math.floor(n / 1000000);
    var thousands = Math.floor(n / 1000) % 1000;
    var rest = n % 1000;
    var parts = [];
    if (millions) parts = parts.concat(count(millions, MILLION));
    if (thousands) parts = parts.concat(count(thousands, THOUSAND));
    if (rest) {
      parts = parts.concat(count(rest, noun));
    } else {
      // Round thousands or millions: the currency follows in the singular, e.g. ألفا دينار
      var last = parts.pop();
      var words = last.split(' ');
      words[words.length - 1] = construct(words[words.length - 1]).replace(/اً$/, '');
      // "أحد عشر ألفاً" keeps its ending before the currency: أحد عشر ألف دينار
      parts.push(words.join(' ') + ' ' + noun.sing);
    }
    return parts.join(' و');
  }

  // dinars: integer 0..999999999, millimes: integer 0..999
  function amountToArabic(dinars, millimes) {
    var parts = [];
    if (dinars > 0) parts.push(countAll(dinars, DINAR));
    if (millimes > 0) parts.push(countAll(millimes, MILLIME));
    if (!parts.length) return 'صفر دينار';
    return parts.join(' و');
  }

  var api = { amountToArabic: amountToArabic };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ArWords = api;
})(this);
