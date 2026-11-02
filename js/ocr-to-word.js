// Read the text of a scanned PDF or photo (OCR) and save it as an editable Word file.
(function () {
  var MAX_PAGES = 30;

  function abs(path) { return new URL(path, window.location.href).href; }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0);
        resolve(c);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  async function renderPdfPage(pdf, n) {
    var page = await pdf.getPage(n);
    var base = page.getViewport({ scale: 1 });
    // Aim for about 2000 px on the long side: enough detail for OCR without exhausting memory
    var scale = Math.min(3, 2000 / Math.max(base.width, base.height));
    var vp = page.getViewport({ scale: scale });
    var c = document.createElement('canvas');
    c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return c;
  }

  // Join the lines of each paragraph; keep blank lines as paragraph breaks
  function toParagraphs(text) {
    return text.replace(/\r/g, '').split(/\n\s*\n/).map(function (p) {
      return p.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).join(' ');
    }).filter(Boolean);
  }

  function isRtl(text) {
    var ar = (text.match(/[؀-ۿ]/g) || []).length;
    var lat = (text.match(/[A-Za-zÀ-ſ]/g) || []).length;
    return ar > lat;
  }

  function buildDocx(pagesText) {
    var d = window.docx, children = [];
    pagesText.forEach(function (pageText, i) {
      var paras = pageText.split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
      if (!paras.length) paras = [''];
      paras.forEach(function (p, j) {
        var rtl = isRtl(p);
        var run = { text: p, size: 26, font: rtl ? 'Arial' : 'Calibri' };
        // In a right-to-left paragraph Word treats "start" as the right-hand side
        var para = { alignment: d.AlignmentType.START, pageBreakBefore: i > 0 && j === 0, spacing: { after: 160 } };
        if (rtl) { run.rightToLeft = true; para.bidirectional = true; }
        para.children = [new d.TextRun(run)];
        children.push(new d.Paragraph(para));
      });
    });
    return d.Packer.toBlob(new d.Document({ sections: [{ children: children }] }));
  }

  function init(t) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    var drop = document.getElementById('drop'), input = document.getElementById('file');
    var statusEl = document.getElementById('status'), langEl = document.getElementById('lang');
    var textEl = document.getElementById('text'), saveBtn = document.getElementById('save'), copyBtn = document.getElementById('copy');
    var busy = false, baseName = 'document';

    function setDir() { textEl.dir = isRtl(textEl.value) ? 'rtl' : 'ltr'; }

    async function run(files) {
      if (busy || !files.length) return;
      var first = files[0];
      var isPdf = first.type === 'application/pdf' || /\.pdf$/i.test(first.name);
      if (!isPdf && !first.type.startsWith('image/')) { statusEl.textContent = t.badType; return; }
      busy = true; saveBtn.disabled = copyBtn.disabled = true; textEl.value = '';
      baseName = first.name.replace(/\.[^.]+$/, '');
      var worker = null;
      try {
        statusEl.textContent = t.loading;
        var pageNo = 0, pageTotal = 0;
        worker = await Tesseract.createWorker(langEl.value.split('+'), 1, {
          workerPath: abs('vendor/tesseract/worker.min.js'),
          corePath: abs('vendor/tesseract/'),
          langPath: abs('vendor/tessdata'),
          gzip: true,
          logger: function (m) {
            if (m.status === 'recognizing text' && pageTotal) {
              statusEl.textContent = t.reading.replace('{n}', pageNo).replace('{total}', pageTotal)
                .replace('{pct}', Math.round(m.progress * 100));
            }
          }
        });
        var sources = [];
        if (isPdf) {
          var pdf = await pdfjsLib.getDocument({ data: await first.arrayBuffer() }).promise;
          pageTotal = Math.min(pdf.numPages, MAX_PAGES);
          for (var n = 1; n <= pageTotal; n++) (function (n) { sources.push(function () { return renderPdfPage(pdf, n); }); })(n);
          var skipped = pdf.numPages - pageTotal;
        } else {
          var imgs = Array.prototype.filter.call(files, function (f) { return f.type.startsWith('image/'); }).slice(0, MAX_PAGES);
          pageTotal = imgs.length;
          imgs.forEach(function (f) { sources.push(function () { return loadImage(f); }); });
        }
        var pages = [];
        for (var i = 0; i < sources.length; i++) {
          pageNo = i + 1;
          statusEl.textContent = t.reading.replace('{n}', pageNo).replace('{total}', pageTotal).replace('{pct}', 0);
          var canvas = await sources[i]();
          var res = await worker.recognize(canvas);
          canvas.width = canvas.height = 0;
          pages.push(toParagraphs(res.data.text).join('\n\n'));
          textEl.value = pages.join('\n\n\n');
          setDir();
        }
        var empty = pages.join('').trim() === '';
        statusEl.textContent = empty ? t.noText : t.done.replace('{pages}', pages.length) + (skipped > 0 ? ' ' + t.limit.replace('{max}', MAX_PAGES) : '');
        saveBtn.disabled = copyBtn.disabled = empty;
      } catch (err) {
        statusEl.textContent = err && err.name === 'PasswordException' ? t.password : t.failed;
      }
      if (worker) worker.terminate();
      busy = false;
    }

    input.addEventListener('change', function () { var f = Array.from(input.files); input.value = ''; run(f); });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('over'); run(Array.from(e.dataTransfer.files)); });
    textEl.addEventListener('input', setDir);

    saveBtn.addEventListener('click', async function () {
      // Three line breaks separate pages in the text box; the user may have edited the text
      var blob = await buildDocx(textEl.value.split(/\n{3,}/));
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = baseName + '.docx';
      document.body.appendChild(a); a.click(); a.remove();
    });
    copyBtn.addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textEl.value).then(function () { statusEl.textContent = t.copied; }, function () { statusEl.textContent = t.copyFailed; });
      } else statusEl.textContent = t.copyFailed;
    });
  }

  window.OcrToWord = { init: init };
})();
