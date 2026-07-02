/* YapUI in-browser feedback widget — injected by relay/server.js.
   Five ways to tell Claude something, all landing in feedback.md:
     • type a note            • talk (live transcription)
     • record the screen      • screenshot (html2canvas)
     • pick an element        (its exact identity in the code)
   Live updates arrive over SSE (/events) — task flips, agent activity and
   replies push instantly; polling only kicks in as a fallback. */
(function () {
  if (window.__kfb) return; window.__kfb = true;

  var CSS = [
    '#kfb-launch{position:fixed;left:18px;bottom:18px;z-index:2147483000;display:flex;align-items:center;gap:8px;font:600 13px/1 -apple-system,system-ui,sans-serif;color:#fff;background:#0E8C7E;border:0;border-radius:999px;padding:11px 16px;cursor:pointer;box-shadow:0 8px 22px rgba(11,111,100,.42),0 2px 6px rgba(0,0,0,.18)}',
    '#kfb-launch:active{transform:scale(.95)}#kfb-launch svg{width:16px;height:16px}',
    '#kfb-rec-dot{position:fixed;left:18px;bottom:18px;z-index:2147483002;display:none;align-items:center;gap:8px;font:700 12px/1 -apple-system,system-ui,sans-serif;color:#fff;background:#C0392B;border-radius:999px;padding:10px 14px;box-shadow:0 8px 22px rgba(192,57,43,.45);cursor:pointer}',
    '#kfb-rec-dot.show{display:flex}#kfb-rec-dot .d{width:10px;height:10px;border-radius:50%;background:#fff;animation:kfbpulse 1s infinite}',
    '#kfb-hl{position:fixed;z-index:2147483040;pointer-events:none;display:none;border:2px solid #0E8C7E;background:rgba(14,140,126,.12);border-radius:6px;box-shadow:0 0 0 2000px rgba(15,27,45,.18)}',
    '#kfb-pickbar{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483041;display:none;align-items:center;gap:10px;font:600 13px/1 -apple-system,system-ui,sans-serif;color:#fff;background:#0F1B2D;border-radius:999px;padding:11px 18px;box-shadow:0 10px 30px rgba(0,0,0,.3)}',
    '#kfb-pickbar.show{display:flex}#kfb-pickbar b{color:#7FE3D6}',
    '#kfb-panel{position:fixed;left:18px;bottom:18px;z-index:2147483001;width:340px;max-width:calc(100vw - 36px);background:#fff;border:1px solid #E2E8F1;border-radius:18px;box-shadow:0 24px 60px rgba(16,38,63,.28);font:14px/1.45 -apple-system,system-ui,sans-serif;color:#0F1B2D;transform:translateY(12px) scale(.98);opacity:0;pointer-events:none;transition:transform .26s cubic-bezier(.32,.72,0,1),opacity .2s}',
    '#kfb-panel.show{transform:none;opacity:1;pointer-events:auto}',
    '.kfb-hd{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 8px}',
    '.kfb-hd b{font:700 15px/1 "Plus Jakarta Sans",-apple-system,system-ui,sans-serif}',
    '.kfb-x{border:0;background:#F1F5FA;width:28px;height:28px;border-radius:50%;cursor:pointer;color:#46596F;font-size:17px;line-height:1}',
    '.kfb-chip{margin:0 16px;display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:#0A6F64;background:#E1F4F0;border-radius:999px;padding:5px 10px;max-width:calc(100% - 32px);box-sizing:border-box}',
    '.kfb-chip svg{width:12px;height:12px;flex:0 0 auto}.kfb-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#kfb-text{display:block;width:calc(100% - 32px);margin:10px 16px 0;min-height:64px;max-height:150px;resize:vertical;font:14px/1.45 inherit;color:#0F1B2D;border:1.5px solid #DCE5EF;border-radius:12px;padding:11px 12px;outline:none;box-sizing:border-box}',
    '#kfb-text:focus{border-color:#0E8C7E;box-shadow:0 0 0 4px #E1F4F0}',
    '.kfb-el{display:none;margin:10px 16px 0;align-items:center;gap:8px;background:#EEF6FF;border:1px solid #D4E6FA;border-radius:11px;padding:8px 10px;font-size:12px;color:#2C5684}',
    '.kfb-el.show{display:flex}.kfb-el .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}',
    '.kfb-el .t small{font-weight:500;color:#5E7DA0}.kfb-el button{border:0;background:none;color:#C0392B;font-weight:700;cursor:pointer;font-size:14px}',
    '.kfb-prev{display:none;margin:10px 16px 0;border:1px solid #DCE5EF;border-radius:12px;overflow:hidden}.kfb-prev.show{display:block}',
    '.kfb-prev video,.kfb-prev img{display:block;width:100%;background:#0F1B2D;max-height:170px;object-fit:contain}',
    '.kfb-prev .bar{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;font-size:12px;font-weight:600;color:#46596F;background:#F7F9FC}.kfb-prev .bar button{border:0;background:none;color:#C0392B;font-weight:700;cursor:pointer;font-size:12px}',
    '.kfb-row{display:flex;gap:7px;align-items:center;padding:12px 16px 0;flex-wrap:wrap}',
    '.kfb-btn{display:inline-flex;align-items:center;gap:6px;border:1.5px solid #DCE5EF;background:#fff;border-radius:11px;padding:9px 11px;cursor:pointer;font:600 12px/1 inherit;color:#46596F}',
    '.kfb-btn:disabled{opacity:.45;cursor:default}.kfb-btn svg{width:15px;height:15px}',
    '#kfb-mic.on,#kfb-rec.on{background:#FDEBEC;border-color:#E8B4B8;color:#B23B47}',
    '#kfb-pick.on{background:#E1F4F0;border-color:#9AD8CD;color:#0A6F64}',
    '.kfb-btn .d{width:9px;height:9px;border-radius:50%;background:#C0392B;display:none}.kfb-btn.on .d{display:block;animation:kfbpulse 1s infinite}',
    '@keyframes kfbpulse{0%,100%{opacity:1}50%{opacity:.25}}',
    '.kfb-send{display:block;width:calc(100% - 32px);margin:12px 16px 4px;border:0;background:#0E8C7E;color:#fff;border-radius:12px;padding:13px;cursor:pointer;font:700 14px/1 inherit}',
    '.kfb-send:disabled{opacity:.5;cursor:default}',
    '.kfb-foot{display:flex;justify-content:space-between;align-items:center;padding:2px 16px 10px;font-size:11px;color:#8294A8;gap:8px}',
    '.kfb-foot .msg{color:#0A6F64;font-weight:700;opacity:0;transition:opacity .2s;text-align:right}.kfb-foot .msg.show{opacity:1}.kfb-foot .msg.err{color:#C0392B}',
    '#kfb-log{max-height:110px;overflow-y:auto;border-top:1px solid #EEF2F7;padding:4px 10px 8px}#kfb-log:empty{display:none}',
    '.kfb-item{font-size:12px;color:#46596F;padding:7px 6px}.kfb-item+.kfb-item{border-top:1px solid #F1F5FA}',
    '.kfb-item .s{display:block;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#A0AFC0;margin-bottom:2px}',
    '#kfb-queue{position:fixed;right:18px;top:18px;z-index:2147483003;width:286px;max-width:calc(100vw - 36px);max-height:76vh;display:flex;flex-direction:column;background:#fff;border:1px solid #E2E8F1;border-radius:16px;box-shadow:0 16px 44px rgba(16,38,63,.22);font:13px/1.4 -apple-system,system-ui,sans-serif;color:#0F1B2D;overflow:hidden}',
    '#kfb-qhd{display:flex;align-items:center;gap:8px;padding:11px 13px;border-bottom:1px solid #EEF2F7}',
    '#kfb-qstate{display:inline-flex;align-items:center;gap:6px;font:700 12.5px/1 inherit}#kfb-qstate .em{font-size:14px;line-height:1}',
    '#kfb-qcount{margin-left:auto;font-size:11px;font-weight:700;color:#46596F;background:#F1F5FA;border-radius:999px;padding:3px 9px}',
    '#kfb-qlist{list-style:none;margin:0;padding:8px;overflow-y:auto;display:flex;flex-direction:column;gap:7px}',
    '.kfb-qempty{padding:6px 13px 13px;font-size:12px;color:#8294A8}',
    '.kfb-task{display:flex;align-items:flex-start;gap:8px;padding:9px 11px;border-radius:10px;color:#fff;font-size:12.5px;line-height:1.35;box-shadow:0 2px 6px rgba(16,38,63,.12)}',
    '.kfb-task.kfb-in{animation:kfbpop .28s cubic-bezier(.32,.72,0,1)}',
    '@keyframes kfbpop{from{opacity:0;transform:translateY(-7px)}to{opacity:1;transform:none}}',
    '.kfb-task .ic{flex:0 0 auto;font-size:14px;line-height:1.3}.kfb-task .bd{flex:1;min-width:0}',
    '.kfb-task .tx{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}',
    '.kfb-task .nt{display:block;margin-top:3px;font-size:11px;opacity:.95;font-weight:500}',
    '.kfb-task.queued{background:#E5484D}.kfb-task.working{background:#F08C32}.kfb-task.done{background:#23A65A}.kfb-task.needs{background:#5B6B7B}',
    '.kfb-task .x{flex:0 0 auto;margin:-1px -2px 0 2px;width:18px;height:18px;border:0;border-radius:6px;background:rgba(255,255,255,.16);color:#fff;font:700 11px/1 inherit;cursor:pointer;opacity:.7;display:grid;place-items:center}.kfb-task .x:hover{opacity:1;background:rgba(255,255,255,.34)}',
    '.kfb-dig{display:inline-block;animation:kfbdig .55s ease-in-out infinite;transform-origin:70% 70%}',
    '@keyframes kfbdig{0%,100%{transform:rotate(-22deg)}45%{transform:rotate(26deg) translateY(1px)}}',
    '#kfb-qfoot{padding:9px 11px;border-top:1px solid #EEF2F7;display:none;align-items:center;gap:8px;font-size:12px}#kfb-qfoot.show{display:flex}',
    '#kfb-qfoot .cd{font-weight:700;color:#0A6F64}',
    '.kfb-qbtn{border:0;border-radius:9px;padding:7px 11px;cursor:pointer;font:700 12px/1 inherit}.kfb-qbtn.go{margin-left:auto;background:#0E8C7E;color:#fff}.kfb-qbtn.cancel{background:#F1F5FA;color:#46596F}',
    '#kfb-cursor{display:none;padding:5px 13px;border-bottom:1px solid #EEF2F7;font-size:11px;color:#5B6B7B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#kfb-cursor.show{display:block}#kfb-cursor b{color:#0A6F64}'
  ].join('');
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  var PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>';

  var launch = document.createElement('button'); launch.id = 'kfb-launch';
  launch.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z"/></svg>Feedback';
  var recDot = document.createElement('button'); recDot.id = 'kfb-rec-dot';
  recDot.innerHTML = '<span class="d"></span><span id="kfb-rec-timer">REC 0:00</span> · tap to stop';
  var hl = document.createElement('div'); hl.id = 'kfb-hl';
  var pickBar = document.createElement('div'); pickBar.id = 'kfb-pickbar';
  pickBar.innerHTML = '<span>Click an element to attach it</span> · <b>Esc</b> to cancel';

  var panel = document.createElement('div'); panel.id = 'kfb-panel';
  panel.innerHTML =
    '<div class="kfb-hd"><b>Feedback to Claude</b><button class="kfb-x" id="kfb-x" title="Close (Esc)">&times;</button></div>' +
    '<span class="kfb-chip">' + PIN + '<span id="kfb-chiptxt">App</span></span>' +
    '<textarea id="kfb-text" placeholder="Type a note — or use Talk / Pick / Snap below. Cmd/Ctrl+Enter to send."></textarea>' +
    '<div class="kfb-el" id="kfb-el"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.5 18 2.3-7.2L20 11.5z"/></svg><span class="t" id="kfb-eltxt"></span><button id="kfb-elx" title="Remove">&times;</button></div>' +
    '<div class="kfb-prev" id="kfb-clip"><video id="kfb-video" controls playsinline muted></video><div class="bar"><span id="kfb-cliplbl">Clip</span><button id="kfb-clipx">Discard</button></div></div>' +
    '<div class="kfb-prev" id="kfb-shot"><img id="kfb-img" alt="screenshot"><div class="bar"><span id="kfb-shotlbl">Screenshot</span><button id="kfb-shotx">Discard</button></div></div>' +
    '<div class="kfb-row">' +
      '<button class="kfb-btn" id="kfb-mic"><span class="d"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg><span class="lbl">Talk</span></button>' +
      '<button class="kfb-btn" id="kfb-rec"><span class="d"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="14" height="14" rx="3"/><path d="M21.5 8.5v7l-5-3.5z"/></svg><span class="lbl">Record</span></button>' +
      '<button class="kfb-btn" id="kfb-pick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.5 18 2.3-7.2L20 11.5z"/></svg><span class="lbl">Pick</span></button>' +
      '<button class="kfb-btn" id="kfb-snap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h3l1.5-2h7L18 7h2a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.4"/></svg><span class="lbl">Snap</span></button>' +
    '</div>' +
    '<button class="kfb-send" id="kfb-send">Send to Claude</button>' +
    '<div class="kfb-foot"><span>Lands in your terminal session</span><span class="msg" id="kfb-msg"></span></div>' +
    '<div id="kfb-log"></div>';

  document.body.appendChild(launch); document.body.appendChild(recDot);
  document.body.appendChild(hl); document.body.appendChild(pickBar); document.body.appendChild(panel);

  var $ = function (s) { return panel.querySelector(s); };
  var ta = $('#kfb-text'), chiptxt = $('#kfb-chiptxt'),
      mic = $('#kfb-mic'), micLbl = mic.querySelector('.lbl'),
      recBtn = $('#kfb-rec'), recLbl = recBtn.querySelector('.lbl'),
      pickBtn = $('#kfb-pick'), snapBtn = $('#kfb-snap'),
      sendBtn = $('#kfb-send'), log = $('#kfb-log'), msg = $('#kfb-msg'),
      elBox = $('#kfb-el'), elTxt = $('#kfb-eltxt'),
      clipBox = $('#kfb-clip'), video = $('#kfb-video'), clipLbl = $('#kfb-cliplbl'),
      shotBox = $('#kfb-shot'), shotImg = $('#kfb-img'), shotLbl = $('#kfb-shotlbl');

  function currentScreen() {
    // generic page/context label for any HTML
    var cur = document.querySelector('[data-state="current"]');
    if (cur && cur.id) return cur.id + (location.hash ? ' ' + location.hash : '');
    var h = document.querySelector('h1, h2, [role="heading"]');
    var base = (h && h.textContent.trim()) ? h.textContent.trim().slice(0, 60) : (document.title || 'page');
    return base + (location.hash ? ' ' + location.hash : '');
  }
  function openP(noFocus) { composeStart = Date.now(); panel.classList.add('show'); launch.style.display = 'none'; chiptxt.textContent = currentScreen(); try { localStorage.setItem('kfb-open', '1'); } catch (e) {} if (!noFocus) setTimeout(function () { ta.focus(); }, 60); }
  function closeP() { panel.classList.remove('show'); try { localStorage.setItem('kfb-open', '0'); } catch (e) {} if (!recording && !picking) launch.style.display = ''; }
  launch.onclick = function () { openP(); }; $('#kfb-x').onclick = closeP;
  setInterval(function () { if (panel.classList.contains('show')) chiptxt.textContent = currentScreen(); }, 700);

  var msgT;
  function flash(text, isErr) { msg.textContent = text; msg.classList.toggle('err', !!isErr); msg.classList.add('show'); clearTimeout(msgT); msgT = setTimeout(function () { msg.classList.remove('show'); }, 3200); }
  function esc(s) { return (s || '').replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  /* ---- voice dictation ---- */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null, listening = false, usedVoice = false, voiceMarks = [], lastTranscript = '', base = '';
  function setMic(on) { mic.classList.toggle('on', on); micLbl.textContent = on ? 'Stop' : 'Talk'; }
  if (SR) {
    rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US';
    rec.onresult = function (e) { var fin = '', intr = ''; for (var i = e.resultIndex; i < e.results.length; i++) { var r = e.results[i]; if (r.isFinal) fin += r[0].transcript; else intr += r[0].transcript; } if (fin) base = (base ? base + ' ' : '') + fin.trim(); ta.value = (base || '') + (intr ? (base ? ' ' : '') + intr : ''); var cur = ta.value; if (cur.length > lastTranscript.length && cur.indexOf(lastTranscript) === 0) { voiceMarks.push({ ms: Date.now() - composeStart, t: cur.slice(lastTranscript.length).replace(/\s+/g, ' ').trim().slice(0, 80) }); if (voiceMarks.length > 80) voiceMarks.shift(); } lastTranscript = cur; };
    rec.onerror = function (ev) { if (ev.error === 'no-speech') return; listening = false; setMic(false); flash(ev.error === 'not-allowed' ? 'Allow the mic in the address bar' : 'Mic: ' + ev.error, true); };
    rec.onend = function () { if (listening) { try { rec.start(); } catch (e) {} } };
    mic.onclick = function () { if (listening) { listening = false; setMic(false); try { rec.stop(); } catch (e) {} } else { base = ta.value.trim(); lastTranscript = ta.value; listening = true; usedVoice = true; setMic(true); try { rec.start(); } catch (e) { listening = false; setMic(false); flash('Could not start mic', true); } } };
  } else { micLbl.textContent = 'Voice n/a'; mic.disabled = true; mic.title = 'Live dictation needs Chrome or Edge'; }

  /* ---- screen recording ---- */
  var recording = false, mr = null, recChunks = [], recStream = null, recBlob = null, recSecs = 0, recTimer = null;
  var canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia && window.MediaRecorder);
  if (!canRecord) { recBtn.disabled = true; recLbl.textContent = 'Rec n/a'; }
  function pickMime() { var c = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']; for (var i = 0; i < c.length; i++) { if (MediaRecorder.isTypeSupported(c[i])) return c[i]; } return ''; }
  function fmt(s) { var m = Math.floor(s / 60), x = s % 60; return m + ':' + (x < 10 ? '0' : '') + x; }
  function setRec(on) { recording = on; recBtn.classList.toggle('on', on); recLbl.textContent = on ? 'Stop' : 'Record'; recDot.classList.toggle('show', on && !panel.classList.contains('show')); }
  async function startRec() {
    try {
      recStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
      var micStream = null; try { micStream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) {}
      var tracks = recStream.getVideoTracks(); if (micStream) tracks = tracks.concat(micStream.getAudioTracks());
      recStream.__mic = micStream; recChunks = []; recBlob = null;
      mr = new MediaRecorder(new MediaStream(tracks), pickMime() ? { mimeType: pickMime() } : undefined);
      mr.ondataavailable = function (e) { if (e.data && e.data.size) recChunks.push(e.data); };
      mr.onstop = finishRec; mr.start(250);
      recStream.getVideoTracks()[0].onended = function () { if (recording) stopRec(); };
      recSecs = 0; setRec(true); flash('Recording… narrate if you like');
      recTimer = setInterval(function () { recSecs++; document.getElementById('kfb-rec-timer').textContent = 'REC ' + fmt(recSecs); recLbl.textContent = 'Stop ' + fmt(recSecs); }, 1000);
    } catch (e) {
      // don't leave captured screen/mic tracks running if MediaRecorder setup failed mid-way
      if (recStream) { try { recStream.getTracks().forEach(function (t) { t.stop(); }); if (recStream.__mic) recStream.__mic.getTracks().forEach(function (t) { t.stop(); }); } catch (e2) {} recStream = null; }
      setRec(false); flash(e && e.name === 'NotAllowedError' ? 'Screen share cancelled' : 'Could not start recording', true);
    }
  }
  function stopRec() {
    if (mr && mr.state !== 'inactive') { try { mr.stop(); } catch (e) {} }
    clearInterval(recTimer);
    if (recStream) { recStream.getTracks().forEach(function (t) { t.stop(); }); if (recStream.__mic) recStream.__mic.getTracks().forEach(function (t) { t.stop(); }); }
    setRec(false); recDot.classList.remove('show');
  }
  function freeUrl(el) { try { if (el.src && el.src.indexOf('blob:') === 0) URL.revokeObjectURL(el.src); } catch (e) {} }
  function finishRec() {
    recBlob = new Blob(recChunks, { type: (mr && mr.mimeType) || 'video/webm' });
    freeUrl(video); video.src = URL.createObjectURL(recBlob); clipBox.classList.add('show'); shotBox.classList.remove('show'); shotBlob = null;
    clipLbl.textContent = 'Clip ' + fmt(recSecs) + ' · ' + Math.round(recBlob.size / 1024) + ' KB';
    if (!panel.classList.contains('show')) openP(); flash('Clip ready — add a note + Send');
  }
  recBtn.onclick = function () { if (!canRecord) return; if (recording) stopRec(); else startRec(); };
  recDot.onclick = function () { if (recording) stopRec(); openP(); };
  $('#kfb-clipx').onclick = function () { recBlob = null; clipBox.classList.remove('show'); freeUrl(video); video.src = ''; };

  /* ---- element picker ---- */
  var picking = false, picked = null;
  function cssEsc(s) { return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, function (c) { return '\\' + c; }); }
  function cssPath(el) {
    var parts = [], node = el, depth = 0;
    while (node && node.nodeType === 1 && depth < 5) {
      if (node.id) { parts.unshift('#' + cssEsc(node.id)); break; }
      var seg = node.tagName.toLowerCase();
      var cn = typeof node.className === 'string' ? node.className : (node.className && node.className.baseVal) || '';
      var cls = cn.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(cssEsc);
      if (cls.length) seg += '.' + cls.join('.');
      var p = node.parentNode;
      if (p && p.children) { var same = [].filter.call(p.children, function (c) { return c.tagName === node.tagName; }); if (same.length > 1) seg += ':nth-of-type(' + (1 + same.indexOf(node)) + ')'; }
      parts.unshift(seg); node = node.parentNode; depth++;
    }
    return parts.join(' > ');
  }
  function describe(el) {
    var data = {}; for (var i = 0; i < el.attributes.length; i++) { var a = el.attributes[i]; if (a.name.indexOf('data-') === 0) data[a.name] = a.value; }
    var r = el.getBoundingClientRect();
    return { selector: cssPath(el), tag: el.tagName.toLowerCase(), id: el.id || '', data: data,
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90),
      rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }, screen: currentScreen() };
  }
  function isOurs(el) { return !el || el.closest('#kfb-panel,#kfb-launch,#kfb-rec-dot,#kfb-hl,#kfb-pickbar'); }
  function targetAt(x, y) { var el = document.elementFromPoint(x, y); return isOurs(el) ? null : el; }
  function onPickMove(e) { var el = targetAt(e.clientX, e.clientY); if (!el) { hl.style.display = 'none'; return; } var r = el.getBoundingClientRect(); hl.style.display = 'block'; hl.style.left = r.left + 'px'; hl.style.top = r.top + 'px'; hl.style.width = r.width + 'px'; hl.style.height = r.height + 'px'; }
  function onPick(e) { e.preventDefault(); e.stopPropagation(); var el = targetAt(e.clientX, e.clientY); if (!el) return; picked = describe(el); exitPick(); openP(); renderPicked(); flash('Element attached'); }
  function onPickKey(e) { if (e.key === 'Escape') { e.preventDefault(); exitPick(); openP(); } }
  function enterPick() {
    if (picking) return; picking = true; pickBtn.classList.add('on'); closeP();
    document.documentElement.style.cursor = 'crosshair';
    hl.style.display = 'none'; pickBar.classList.add('show');
    document.addEventListener('mousemove', onPickMove, true);
    document.addEventListener('click', onPick, true);
    document.addEventListener('keydown', onPickKey, true);
  }
  function exitPick() {
    picking = false; pickBtn.classList.remove('on'); document.documentElement.style.cursor = '';
    hl.style.display = 'none'; pickBar.classList.remove('show');
    document.removeEventListener('mousemove', onPickMove, true);
    document.removeEventListener('click', onPick, true);
    document.removeEventListener('keydown', onPickKey, true);
  }
  function renderPicked() {
    if (!picked) { elBox.classList.remove('show'); return; }
    var label = (picked.id ? '#' + picked.id : picked.tag) + (picked.data['data-id'] ? ' [' + picked.data['data-id'] + ']' : '');
    elTxt.innerHTML = esc(label) + (picked.text ? ' <small>“' + esc(picked.text.slice(0, 40)) + '”</small>' : '');
    elBox.classList.add('show');
  }
  pickBtn.onclick = enterPick;
  $('#kfb-elx').onclick = function () { picked = null; renderPicked(); };

  /* ---- screenshot (html2canvas, lazy) ---- */
  var shotBlob = null;
  function loadH2C() { return new Promise(function (res, rej) { if (window.html2canvas) return res(); var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'; s.integrity = 'sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H'; s.crossOrigin = 'anonymous'; s.onload = function () { res(); }; s.onerror = function () { rej(); }; document.head.appendChild(s); }); }
  function snap() {
    var target = null;
    if (picked) { try { target = document.querySelector(picked.selector); } catch (e) {} }
    if (!target) target = document.querySelector('main') || document.body;
    if (!target) { flash('Nothing to capture', true); return; }
    flash('Capturing…');
    loadH2C().then(function () {
      return window.html2canvas(target, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
    }).then(function (canvas) {
      canvas.toBlob(function (b) { if (!b) { flash('Capture failed', true); return; } shotBlob = b; freeUrl(shotImg); shotImg.src = URL.createObjectURL(b); shotBox.classList.add('show'); clipBox.classList.remove('show'); recBlob = null; shotLbl.textContent = 'Screenshot · ' + Math.round(b.size / 1024) + ' KB' + (picked ? ' · ' + (picked.id ? '#' + picked.id : picked.tag) : ' · full page'); flash('Screenshot ready — add a note + Send'); }, 'image/png');
    }).catch(function () { flash('Screenshot needs internet (html2canvas)', true); });
  }
  snapBtn.onclick = snap;
  $('#kfb-shotx').onclick = function () { shotBlob = null; shotBox.classList.remove('show'); freeUrl(shotImg); shotImg.src = ''; };

  /* ---- send ---- */
  function addLog(screen, text, kind) { var d = document.createElement('div'); d.className = 'kfb-item'; d.innerHTML = '<span class="s">' + esc(screen) + (kind ? ' · ' + kind : '') + '</span>' + esc(text || '(no note)'); log.insertBefore(d, log.firstChild); }
  function clearAll() { if (listening) { listening = false; setMic(false); try { rec.stop(); } catch (e) {} } ta.value = ''; base = ''; usedVoice = false; voiceMarks = []; lastTranscript = ''; picked = null; renderPicked(); recBlob = null; clipBox.classList.remove('show'); freeUrl(video); video.src = ''; shotBlob = null; shotBox.classList.remove('show'); freeUrl(shotImg); shotImg.src = ''; composeStart = Date.now(); try { localStorage.removeItem('kfb-draft'); } catch (e) {} }

  function sendText() {
    var text = ta.value.trim();
    if (!text && !picked) { flash('Add a note, pick an element, or attach media', true); return; }
    var tid = newTaskId(), label = text || ('element ' + (picked.id || picked.tag));
    var payload = { text: text, screen: currentScreen(), ts: new Date().toISOString(), voice: usedVoice || listening, element: picked, taskId: tid, cursor: cursor.desc ? { desc: cursor.desc, label: cursor.phone, scene: cursor.scene, el: cursor.el } : null, pointing: trailSince(composeStart), voiceMarks: voiceMarks.length ? voiceMarks.slice() : null };
    sendBtn.disabled = true; flash('Sending…');
    queueTask(tid, label); postTask(tid, label);
    fetch('/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function () { addLog(payload.screen, label, picked ? 'element' : (payload.voice ? 'voice' : null)); clearAll(); flash('Queued ✓'); showWorking(); })
      .catch(function () { dismissTask(tid); flash('Send failed — relay down?', true); })  // roll the optimistic card back so it can't sit red forever
      .finally(function () { sendBtn.disabled = false; });
  }
  function sendBinary(urlPath, blob, kindLabel) {
    // two-step: upload the raw bytes, then send the metadata as a normal JSON note
    // (headers have hard size limits — long pointing/voice timelines don't)
    var note = ta.value.trim(), screen = currentScreen();
    var tid = newTaskId(), label = note || kindLabel;
    sendBtn.disabled = true; flash('Uploading ' + kindLabel + '…');
    var ptStart = (urlPath === '/upload') ? (Date.now() - (recSecs * 1000 || 0)) : composeStart;
    queueTask(tid, label); postTask(tid, label);
    fetch(urlPath, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: blob })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (up) {
        var payload = { text: note, screen: screen, ts: new Date().toISOString(), taskId: tid, voice: usedVoice || listening, secs: recSecs,
          cursor: cursor.desc ? { desc: cursor.desc, label: cursor.phone, scene: cursor.scene, el: cursor.el } : null,
          pointing: trailSince(ptStart).slice(-40), voiceMarks: voiceMarks.length ? voiceMarks.slice() : null, element: picked || null };
        payload[urlPath === '/upload' ? 'recording' : 'screenshot'] = up.file;
        return fetch('/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function () { addLog(screen, label, kindLabel); clearAll(); flash(kindLabel + ' queued ✓'); showWorking(); })
      .catch(function () { dismissTask(tid); flash('Upload failed — relay down?', true); })
      .finally(function () { sendBtn.disabled = false; });
  }
  sendBtn.onclick = function () {
    if (shotBlob) return sendBinary('/shot', shotBlob, 'screenshot');
    if (recBlob) return sendBinary('/upload', recBlob, 'clip ' + fmt(recSecs));
    return sendText();
  };
  ta.addEventListener('keydown', function (e) { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); sendBtn.onclick(); } });
  document.addEventListener('keydown', function (e) {
    if (picking) return;
    var tag = (e.target && e.target.tagName || '').toLowerCase();
    if (e.key === 'Escape' && panel.classList.contains('show')) closeP();
    else if ((e.key === 'f' || e.key === 'F') && tag !== 'input' && tag !== 'textarea' && !panel.classList.contains('show')) openP();
  });

  /* ---- Claude status + replies (real-time loop) ---- */
  var spin = document.createElement('style');
  spin.textContent = '.kfb-spin{width:14px;height:14px;border-radius:50%;border:2.5px solid rgba(255,255,255,.35);border-top-color:#fff;display:inline-block;animation:kfbspin .7s linear infinite;flex:0 0 auto}@keyframes kfbspin{to{transform:rotate(360deg)}}.kfb-eyes{display:inline-block;transform-origin:center;animation:kfbblink 4s infinite}@keyframes kfbblink{0%,90%,100%{transform:scaleY(1)}95%{transform:scaleY(.08)}}';
  document.head.appendChild(spin);

  // "Claude is working" indicator — shown the moment you send, cleared when a reply lands
  var workPill = document.createElement('div'); workPill.id = 'kfb-working';
  workPill.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483004;display:none;align-items:center;gap:9px;background:#0E8C7E;color:#fff;border-radius:999px;padding:11px 17px;font:600 13px/1 -apple-system,system-ui,sans-serif;box-shadow:0 12px 34px rgba(11,111,100,.45);cursor:pointer';
  workPill.innerHTML = '<span class="kfb-spin"></span><span>Claude is working on it…</span>';
  document.body.appendChild(workPill);
  /* ---- task queue (top-right) — the live to-do board ---- */
  var queue = document.createElement('div'); queue.id = 'kfb-queue';
  queue.innerHTML =
    '<div id="kfb-qhd"><span id="kfb-qstate"><span class="em kfb-eyes">👀</span><span id="kfb-qstxt">Claude is watching</span></span><span id="kfb-qcount" style="display:none">0/0</span></div>' +
    '<div id="kfb-cursor"></div>' +
    '<div class="kfb-qempty" id="kfb-qempty">Send feedback and it queues here — <b>red</b> waiting, <b>orange</b> ⛏️ in progress, <b>green</b> done. Auto-refreshes when all clear.</div>' +
    '<ul id="kfb-qlist"></ul>' +
    '<div id="kfb-qfoot"><span class="cd" id="kfb-qcd"></span><button class="kfb-qbtn cancel" id="kfb-qcancel">Cancel</button><button class="kfb-qbtn go" id="kfb-qgo">Refresh now</button></div>';
  document.body.appendChild(queue);
  var qList = queue.querySelector('#kfb-qlist'), qEmpty = queue.querySelector('#kfb-qempty'),
      qStxt = queue.querySelector('#kfb-qstxt'), qEm = queue.querySelector('#kfb-qstate .em'),
      qCount = queue.querySelector('#kfb-qcount'), qFoot = queue.querySelector('#kfb-qfoot'),
      qCd = queue.querySelector('#kfb-qcd'), qCancel = queue.querySelector('#kfb-qcancel'), qGo = queue.querySelector('#kfb-qgo'),
      cursEl = queue.querySelector('#kfb-cursor');

  // showWatching/hideWatching are called by the existing reply/working code — just re-render the header
  function showWatching() { render(); }
  function hideWatching() {}

  /* ---- live cursor tracking — tells Claude which phone / element you're pointing at ---- */
  var cursor = { phone: '', scene: '', el: '', desc: '', x: 0, y: 0, ts: 0 };
  var pend = null, rafQ = false, trail = [], composeStart = 0;
  function describeEl(el) {
    if (!el) return '';
    var tag = (el.tagName || '').toLowerCase();
    if (!tag || tag === 'body' || tag === 'html') return '';
    var full = (el.textContent || '').trim().replace(/\s+/g, ' ');
    if (full && full.length <= 40) return '“' + full + '”';
    if (el.id) return '#' + el.id;
    var c = (typeof el.className === 'string' && el.className) ? '.' + el.className.split(' ')[0].slice(0, 24) : '';
    return tag + c;
  }
  // a human label for an iframe the cursor is over — use its title (falls back to "frame")
  function phoneOf(frame) { return (frame.title || frame.getAttribute('aria-label') || 'frame').toString().trim().slice(0, 40) || 'frame'; }
  function onMove(frame, x, y) { pend = { frame: frame, x: x, y: y }; if (rafQ) return; rafQ = true; setTimeout(flushMove, 40); }
  function flushMove() {
    rafQ = false; if (!pend) return; var p = pend; pend = null;
    var phone = 'page', scene = '', el = null;
    if (p.frame) {
      phone = phoneOf(p.frame);
      var sc = p.frame.closest ? p.frame.closest('[data-scene]') : null; scene = sc ? sc.getAttribute('data-scene') : '';
      try { el = p.frame.contentDocument.elementFromPoint(p.x, p.y); } catch (e) {}
    } else { el = document.elementFromPoint(p.x, p.y); }
    cursor.phone = phone; cursor.scene = scene; cursor.el = describeEl(el); cursor.x = p.x; cursor.y = p.y; cursor.ts = Date.now();
    cursor.desc = phone + [scene, cursor.el].filter(Boolean).map(function (s) { return ' › ' + s; }).join('');
    var lastT = trail[trail.length - 1];
    if (!lastT || lastT.desc !== cursor.desc) { trail.push({ t: cursor.ts, desc: cursor.desc, phone: cursor.phone, scene: cursor.scene, el: cursor.el }); if (trail.length > 240) trail.shift(); }
    paintCursor(); schedulePush();
  }
  function paintCursor() {
    if (!cursEl) return;
    if (cursor.desc) { cursEl.className = 'show'; cursEl.innerHTML = '🖥 <b>' + esc(cursor.phone) + '</b>' + esc([cursor.scene, cursor.el].filter(Boolean).map(function (s) { return ' › ' + s; }).join('')); }
    else cursEl.className = '';
  }
  var lastPushed = '', pushT = 0, pushTrail = null;
  function doPush() {
    if (cursor.desc === lastPushed) return; pushT = Date.now(); lastPushed = cursor.desc;
    try { fetch('/cursor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ desc: cursor.desc, phone: cursor.phone, scene: cursor.scene, el: cursor.el, x: cursor.x, y: cursor.y, ts: new Date().toISOString() }) }); } catch (e) {}
  }
  function schedulePush() { if (cursor.desc === lastPushed) return; var now = Date.now(); if (now - pushT >= 800) doPush(); else { clearTimeout(pushTrail); pushTrail = setTimeout(doPush, 800 - (now - pushT)); } }
  // the timeline of what you pointed at during a message — lets a voice note's "this"/"that" resolve to real elements
  function trailSince(start) { var s = start || (Date.now() - 15000); var out = []; for (var i = 0; i < trail.length; i++) { if (trail[i].t >= s) out.push({ ms: trail[i].t - s, desc: trail[i].desc, phone: trail[i].phone, scene: trail[i].scene, el: trail[i].el }); } return out.slice(-60); }
  function wireDoc(frame) { var d; try { d = frame.contentDocument; } catch (e) { return; } if (!d || d.__kfbDoc) return; d.__kfbDoc = true; d.addEventListener('mousemove', function (ev) { onMove(frame, ev.clientX, ev.clientY); }, { passive: true }); }
  function wireFrames() { var fr = document.querySelectorAll('iframe'); for (var i = 0; i < fr.length; i++) { wireDoc(fr[i]); if (!fr[i].__kfbLoad) { fr[i].__kfbLoad = true; fr[i].addEventListener('load', function () { wireDoc(this); }); } } }
  document.addEventListener('mousemove', function (ev) { var el = document.elementFromPoint(ev.clientX, ev.clientY); if (el && (el.tagName === 'IFRAME' || (el.closest && el.closest('[id^="kfb-"]')))) return; onMove(null, ev.clientX, ev.clientY); }, { passive: true });
  wireFrames(); setInterval(wireFrames, 2000);

  var ICON = { queued:'🔴', working:'<span class="kfb-dig">⛏️</span>', done:'✅', needs:'🙋' };
  var tasks = {}, order = [], local = {}, dismissedIds = {}, lastSig = null, shownIds = {};
  var agentState = '', agentLabel = '';
  function setAgent(state, label) { agentState = state || ''; agentLabel = label || ''; render(); }
  function newTaskId() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function normStatus(s) { return (s === 'needs-you' || s === 'needs') ? 'needs' : ((s === 'working' || s === 'done' || s === 'queued') ? s : 'queued'); }
  function hasWorking() { return order.some(function (id) { return tasks[id].status === 'working'; }); }

  function queueTask(id, text) {  // optimistic local card the instant you hit send
    local[id] = { id: id, text: text || '(no note)', status: 'queued', note: '', ts: Date.now() };
    if (!tasks[id]) { tasks[id] = local[id]; order.push(id); }
    render();
  }
  function postTask(id, text) { try { fetch('/task', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id, text: text, screen: currentScreen(), ts: new Date().toISOString() }) }); } catch (e) {} }
  function dismissTask(id) {  // ✕ on a card — remove it from the queue (works on "needs you" cards too)
    dismissedIds[id] = 1; delete local[id]; delete tasks[id];
    var ix = order.indexOf(id); if (ix >= 0) order.splice(ix, 1);
    render(); checkRefresh();
    try { fetch('/task/dismiss', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id }) }); } catch (e) {}
  }

  function reduceFile(txt) {
    var map = {}, ord = [];
    txt.split('\n').filter(Boolean).forEach(function (line) {
      try { var o = JSON.parse(line);
        if (o.type === 'task') { if (!map[o.id]) { map[o.id] = { id: o.id, text: o.text || '(no note)', status: normStatus(o.status), note: '', ts: o.ts }; ord.push(o.id); } }
        else if (o.type === 'status' && map[o.id]) {
          if (o.status === 'dismissed') { delete map[o.id]; var dx = ord.indexOf(o.id); if (dx >= 0) ord.splice(dx, 1); }
          else { map[o.id].status = normStatus(o.status); if (o.note) map[o.id].note = o.note; }
        }
      } catch (e) {}
    });
    Object.keys(local).forEach(function (id) { if (map[id]) { delete local[id]; } else { map[id] = local[id]; ord.push(id); } });
    Object.keys(dismissedIds).forEach(function (id) { if (map[id]) { delete map[id]; var k = ord.indexOf(id); if (k >= 0) ord.splice(k, 1); } });
    tasks = map; order = ord; render(); checkRefresh();
  }

  function render() {
    var sig = agentState + '§' + order.map(function (id) { return id + ':' + tasks[id].status + ':' + (tasks[id].note || ''); }).join('|');
    if (sig === lastSig) return;   // nothing changed since last render — skip the rebuild (no periodic flashing)
    lastSig = sig;
    qList.innerHTML = '';
    var nextShown = {};
    order.forEach(function (id) {
      var t = tasks[id], li = document.createElement('li'); li.className = 'kfb-task ' + t.status + (shownIds[id] ? '' : ' kfb-in');
      nextShown[id] = 1;
      li.innerHTML = '<span class="ic">' + ICON[t.status] + '</span><span class="bd"><span class="tx">' + esc(t.text) + '</span>' + (t.note ? '<span class="nt">' + esc(t.note) + '</span>' : '') + '</span>';
      var x = document.createElement('button'); x.className = 'x'; x.title = 'Remove from queue'; x.textContent = '✕';
      x.onclick = function () { dismissTask(id); };
      li.appendChild(x);
      qList.appendChild(li);
    });
    shownIds = nextShown;
    qEmpty.style.display = order.length ? 'none' : '';
    var done = order.filter(function (id) { return tasks[id].status === 'done'; }).length;
    var needs = order.filter(function (id) { return tasks[id].status === 'needs'; }).length;
    qCount.style.display = order.length ? '' : 'none'; qCount.textContent = done + '/' + order.length;
    if (!order.length) {
      if (agentState === 'ready' || agentState === 'busy') { qEm.textContent = '⚡'; qEm.className = 'em'; qStxt.textContent = 'Claude is ready — instant fixes'; }
      else if (agentState === 'booting') { qEm.textContent = '⚡'; qEm.className = 'em kfb-eyes'; qStxt.textContent = 'Claude is warming up…'; }
      else { qEm.textContent = '👀'; qEm.className = 'em kfb-eyes'; qStxt.textContent = 'Claude is watching'; }
    }
    else if (hasWorking()) { qEm.innerHTML = '<span class="kfb-dig">⛏️</span>'; qEm.className = 'em'; qStxt.textContent = 'Claude is digging in…'; }
    else if (needs) { qEm.textContent = '🙋'; qEm.className = 'em'; qStxt.textContent = needs === 1 ? '1 needs you' : needs + ' need you'; }
    else if (done === order.length) { qEm.textContent = '✅'; qEm.className = 'em'; qStxt.textContent = 'All done'; }
    else { qEm.textContent = '👀'; qEm.className = 'em kfb-eyes'; qStxt.textContent = 'Queued — ' + (order.length - done) + ' waiting'; }
  }

  /* auto-refresh once EVERY card is green (done); a "needs you" card blocks it so a question is never refreshed away */
  var cdTimer = null, manualShown = false;
  // only hold the refresh if you're genuinely mid-compose (unsent text/media), not just because the panel is open
  function busyComposing() { return recording || picking || ta.value.trim().length > 0 || !!picked || !!recBlob || !!shotBlob; }
  function checkRefresh() {
    if (!order.length) { cancelCd(); hideManual(); return; }
    var allDone = order.every(function (id) { return tasks[id].status === 'done'; });
    if (allDone) { if (!cdTimer && !manualShown && !busyComposing()) startCd(); }
    else { cancelCd(); hideManual(); }
  }
  function startCd() {
    var n = 3; qFoot.classList.add('show'); qGo.style.display = 'none'; qCancel.style.display = ''; qCd.textContent = 'All done — refreshing in ' + n + '…';
    cdTimer = setInterval(function () { n--; if (n <= 0) { clearInterval(cdTimer); cdTimer = null; doRefresh(); } else qCd.textContent = 'All done — refreshing in ' + n + '…'; }, 1000);
  }
  function cancelCd() { if (cdTimer) { clearInterval(cdTimer); cdTimer = null; } if (!manualShown) qFoot.classList.remove('show'); }
  function showManual() { manualShown = true; qFoot.classList.add('show'); qCd.textContent = 'All done.'; qCancel.style.display = 'none'; qGo.style.display = ''; }
  function hideManual() { manualShown = false; if (!cdTimer) qFoot.classList.remove('show'); }
  function doRefresh() { try { fetch('/tasks/clear', { method: 'POST' }).finally(function () { location.reload(); }); } catch (e) { location.reload(); } }
  qCancel.onclick = function () { cancelCd(); showManual(); };
  qGo.onclick = doRefresh;

  function pollTasks() { fetch('/tasks', { cache: 'no-store' }).then(function (r) { return r.text(); }).then(reduceFile).catch(function () {}); }

  var workSince = 0;
  function showWorking() { workSince = Date.now(); hideWatching(); repToast.style.display = 'none'; workPill.style.display = 'flex'; launch.style.boxShadow = '0 0 0 4px rgba(14,140,126,.35), 0 8px 22px rgba(11,111,100,.42)'; }
  function hideWorking() { workPill.style.display = 'none'; launch.style.boxShadow = ''; workSince = 0; showWatching(); }
  workPill.onclick = hideWorking;
  setInterval(function () { if (workSince && Date.now() - workSince > 180000) hideWorking(); }, 10000); // stale guard must not depend on the polling fallback

  var repSeen = -1;
  var repToast = document.createElement('div'); repToast.id = 'kfb-reply';
  repToast.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483005;max-width:360px;display:none;align-items:flex-start;gap:10px;background:#0F1B2D;color:#fff;border-radius:14px;padding:12px 15px;font:13px/1.45 -apple-system,system-ui,sans-serif;box-shadow:0 16px 44px rgba(0,0,0,.34);cursor:pointer';
  document.body.appendChild(repToast);
  var repHideT;
  function showReply(text) {
    hideWorking();
    repToast.innerHTML = '<span style="flex:0 0 auto;width:22px;height:22px;border-radius:50%;background:#0E8C7E;display:grid;place-items:center;font-weight:700;font-size:11px;color:#fff">C</span><span><b>Claude</b> · refresh to see the change<br>' + esc(text) + '</span>';
    repToast.style.display = 'flex';
    clearTimeout(repHideT); repHideT = setTimeout(function () { repToast.style.display = 'none'; }, 12000);
  }
  repToast.onclick = function () { repToast.style.display = 'none'; };
  function pollReplies() {
    fetch('/replies', { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (t) {
      var lines = t.split('\n').filter(Boolean);
      if (repSeen < 0) { repSeen = lines.length; return; }           // baseline on first poll
      if (lines.length > repSeen) {
        for (var i = repSeen; i < lines.length; i++) { try { var o = JSON.parse(lines[i]); showReply(o.text); addLog('Claude', o.text, 'reply'); } catch (e) {} }
        repSeen = lines.length;
      }
    }).catch(function () {});
    if (workSince && Date.now() - workSince > 180000) hideWorking(); // stale guard (3 min)
  }

  // restore an unsent draft + keep persisting it as you type (survives a reload)
  try { var d0 = localStorage.getItem('kfb-draft'); if (d0) { ta.value = d0; base = d0; } } catch (e) {}
  ta.addEventListener('input', function () { try { localStorage.setItem('kfb-draft', ta.value); } catch (e) {} });
  // panel starts EXPANDED by default; a deliberate collapse is remembered across reloads
  var startOpen = true; try { if (localStorage.getItem('kfb-open') === '0') startOpen = false; } catch (e) {}
  if (startOpen) openP(true); else launch.style.display = '';

  // self-reload: when the widget or relay changes, reload to pick it up (deferred while you're composing)
  var lastVer = null;
  function applyVersion(v) { if (!v) return; if (lastVer === null) { lastVer = v; return; } if (v !== lastVer && !busyComposing()) location.reload(); }
  function pollVersion() { fetch('/version', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (o) { applyVersion(o.v); }).catch(function () {}); }

  /* ---- live update channel: SSE first (instant), polling only as fallback ---- */
  var es = null, pollT = [];
  function startPolling() { if (pollT.length) return; pollT = [setInterval(pollTasks, 1200), setInterval(pollReplies, 2500)]; }
  function stopPolling() { pollT.forEach(clearInterval); pollT = []; }
  function connectSSE() {
    if (!window.EventSource) { startPolling(); return; }
    try { es = new EventSource('/events'); } catch (e) { startPolling(); return; }
    es.onopen = function () { stopPolling(); };
    es.onerror = function () { startPolling(); };   // EventSource retries itself; poll meanwhile
    es.addEventListener('hello', function (m) { try { var o = JSON.parse(m.data);
      if (o.agent) setAgent(o.agent.state, o.agent.label);
      if (typeof o.replies === 'number' && repSeen < 0) repSeen = o.replies;
      if (typeof o.tasks === 'string') reduceFile(o.tasks);
      applyVersion(o.v); pollReplies();             // pollReplies catches anything missed during a reconnect
    } catch (e) {} });
    es.addEventListener('tasks', function (m) { try { reduceFile(JSON.parse(m.data).text || ''); } catch (e) {} });
    es.addEventListener('reply', function (m) { try { var o = JSON.parse(m.data);
      if (typeof o.n === 'number') { if (repSeen >= 0 && o.n <= repSeen) return; repSeen = o.n; }
      showReply(o.text); addLog('Claude', o.text, 'reply');
    } catch (e) {} });
    es.addEventListener('agent', function (m) { try { var o = JSON.parse(m.data); setAgent(o.state, o.label); } catch (e) {} });
    es.addEventListener('version', function (m) { try { applyVersion(JSON.parse(m.data).v); } catch (e) {} });
  }
  connectSSE();
  pollTasks(); pollReplies();                        // paint once immediately, even before SSE opens
  setInterval(pollVersion, 3000); pollVersion();     // slow safety net (also retries a reload deferred while composing)
})();
