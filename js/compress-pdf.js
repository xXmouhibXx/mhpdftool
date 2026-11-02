// Compress a PDF under a target size by re-rendering each page as a JPEG image.
(function () {
  var SCALES = [1.5, 1.25, 1.0, 0.8, 0.65, 0.5];      // 1.0 = 72 dpi
  var QUALITIES = [0.85, 0.72, 0.6, 0.48, 0.36, 0.26];
  var OVERHEAD_PER_PAGE = 700, OVERHEAD_BASE = 1500;  // rough PDF structure cost in bytes

  var UNIT = 'KB';
  function kb(bytes) { return (bytes / 1024).toFixed(0) + ' ' + UNIT; }

  function renderPage(pdf, n, scale) {
    return pdf.getPage(n).then(function (page) {
      var vp = page.getViewport({ scale: scale });
      var canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(vp.width));
      canvas.height = Math.max(1, Math.floor(vp.height));
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      var base = page.getViewport({ scale: 1 });
      return page.render({ canvasContext: ctx, viewport: vp }).promise.then(function () {
        return { canvas: canvas, w: base.width, h: base.height };
      });
    });
  }

  function jpegSize(canvas, q) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (b) { resolve(b ? b.size : Infinity); }, 'image/jpeg', q);
    });
  }

  // Total JPEG bytes for the whole document at one scale, for every quality level
  async function measure(pdf, scale, onProgress) {
    var totals = QUALITIES.map(function () { return 0; });
    for (var n = 1; n <= pdf.numPages; n++) {
      onProgress(n, pdf.numPages);
      var r = await renderPage(pdf, n, scale);
      for (var i = 0; i < QUALITIES.length; i++) totals[i] += await jpegSize(r.canvas, QUALITIES[i]);
      r.canvas.width = r.canvas.height = 0; // free memory
    }
    return totals;
  }

  async function build(pdf, scale, quality, onProgress) {
    var jsPDF = window.jspdf.jsPDF, doc = null;
    for (var n = 1; n <= pdf.numPages; n++) {
      onProgress(n, pdf.numPages);
      var r = await renderPage(pdf, n, scale);
      var orientation = r.w > r.h ? 'landscape' : 'portrait';
      if (!doc) doc = new jsPDF({ unit: 'pt', format: [r.w, r.h], orientation: orientation });
      else doc.addPage([r.w, r.h], orientation);
      doc.addImage(r.canvas.toDataURL('image/jpeg', quality), 'JPEG', 0, 0, r.w, r.h);
      r.canvas.width = r.canvas.height = 0;
    }
    return doc.output('blob');
  }

  function init(t) {
    if (t.unit) UNIT = t.unit;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    var drop = document.getElementById('drop'), input = document.getElementById('file');
    var statusEl = document.getElementById('status'), results = document.getElementById('results');
    var go = document.getElementById('go'), targetEl = document.getElementById('target');
    var file = null;

    function setFile(f) {
      results.innerHTML = '';
      if (!f) return;
      if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { statusEl.textContent = t.notPdf; return; }
      file = f;
      go.disabled = false;
      statusEl.textContent = f.name + ' · ' + kb(f.size);
    }
    input.addEventListener('change', function () { setFile(input.files[0]); });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('over'); setFile(e.dataTransfer.files[0]); });
    document.querySelectorAll('[data-kb]').forEach(function (b) {
      b.addEventListener('click', function () { targetEl.value = b.getAttribute('data-kb'); });
    });

    go.addEventListener('click', async function () {
      if (!file) return;
      var targetKb = parseFloat(targetEl.value);
      if (!targetKb || targetKb < 20) { statusEl.textContent = t.minSize; return; }
      var target = targetKb * 1024;
      results.innerHTML = '';
      if (file.size <= target) { statusEl.textContent = t.alreadySmall.replace('{size}', kb(file.size)); return; }
      go.disabled = true;
      try {
        var pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        var budget = target - OVERHEAD_BASE - OVERHEAD_PER_PAGE * pdf.numPages;
        var blob = null, smallest = Infinity;
        search:
        for (var s = 0; s < SCALES.length; s++) {
          var totals = await measure(pdf, SCALES[s], function (n, total) {
            statusEl.textContent = t.analysing.replace('{n}', n).replace('{total}', total);
          });
          smallest = Math.min(smallest, totals[totals.length - 1]);
          for (var q = 0; q < QUALITIES.length; q++) {
            if (totals[q] > budget) continue;
            var out = await build(pdf, SCALES[s], QUALITIES[q], function (n, total) {
              statusEl.textContent = t.building.replace('{n}', n).replace('{total}', total);
            });
            if (out.size <= target) { blob = out; break search; } // otherwise try the next lower quality
          }
        }
        if (!blob) {
          statusEl.textContent = t.tooSmall.replace('{size}', kb(smallest + OVERHEAD_BASE + OVERHEAD_PER_PAGE * pdf.numPages));
        } else {
          var link = document.createElement('a');
          link.className = 'btn';
          link.href = URL.createObjectURL(blob);
          link.download = file.name.replace(/\.pdf$/i, '') + '-' + Math.round(targetKb) + 'kb.pdf';
          link.textContent = t.download;
          results.appendChild(link);
          statusEl.textContent = t.done.replace('{from}', kb(file.size)).replace('{to}', kb(blob.size)).replace('{pages}', pdf.numPages);
        }
      } catch (err) {
        statusEl.textContent = err && err.name === 'PasswordException' ? t.password : t.unreadable;
      }
      go.disabled = false;
    });
  }

  window.CompressPdf = { init: init };
})();
