lucide.createIcons();

// ============================================================
//  DOM References
// ============================================================
const emptyState        = document.getElementById('empty-state');
const feedContainer     = document.getElementById('feed-container');
const imagePreview      = document.getElementById('image-preview');
const btnCamera         = document.getElementById('btn-camera');
const btnCameraText     = document.getElementById('btn-camera-text');
const btnCameraIcon     = document.getElementById('btn-camera-icon');
const videoStream       = document.getElementById('video-stream');
const snapshotCanvas    = document.getElementById('snapshot-canvas');
const zoomControl       = document.getElementById('zoom-control');
const zoomSlider        = document.getElementById('zoom-slider');
const zoomValue         = document.getElementById('zoom-value');
const btnUpload         = document.getElementById('btn-upload');
const videoUpload       = document.getElementById('video-upload');
const loadingState      = document.getElementById('loading-state');
const loadingTitle      = document.getElementById('loading-title');
const loadingDesc       = document.getElementById('loading-desc');
const playbackVideo     = document.getElementById('playback-video');
const btnNextSet        = document.getElementById('btn-next-set');
const btnAudioToggle    = document.getElementById('btn-audio-toggle');
const audioIcon         = document.getElementById('audio-icon');

// Auth & Session DOM
const authModal         = document.getElementById('auth-modal');
const authForm          = document.getElementById('auth-form');
const authTitle         = document.getElementById('auth-title');
const authDesc          = document.getElementById('auth-desc');
const authUsername      = document.getElementById('auth-username');
const authEmail         = document.getElementById('auth-email');
const authEmailGroup    = document.getElementById('auth-email-group');
const authPassword      = document.getElementById('auth-password');
const authPasswordConfirm = document.getElementById('auth-password-confirm');
const authPasswordConfirmGroup = document.getElementById('auth-password-confirm-group');
const authError         = document.getElementById('auth-error');
const btnAuthSubmit     = document.getElementById('btn-auth-submit');
const btnAuthSwitch     = document.getElementById('btn-auth-switch');
const authSwitchText    = document.getElementById('auth-switch-text');
const userInfo          = document.getElementById('user-info');
const userName          = document.getElementById('user-name');
const btnLogout         = document.getElementById('btn-logout');
const btnEndSession     = document.getElementById('btn-end-session');

// New config UI refs
const btnRepMinus       = document.getElementById('btn-rep-minus');
const btnRepPlus        = document.getElementById('btn-rep-plus');
const targetDisplay     = document.getElementById('target-display');
const targetInput       = document.getElementById('target-input');
const setTypeInput      = document.getElementById('set-type');
const setTypeGroup      = document.getElementById('set-type-group');
const setPreview        = document.getElementById('set-preview');
const setDots           = document.getElementById('set-dots');
const nextSetWrapper    = document.getElementById('next-set-wrapper');

// ============================================================
//  WORKOUT CONFIG UI — Set Type Buttons + Rep Stepper
// ============================================================

// FSM target_array calculator (mirrors Python logic)
function calcTargetArray(base, type) {
  if (type === 'standard') return [base, base, base];
  if (type === 'pyramid')  return [base, Math.max(base-2,1), Math.max(base-4,1), Math.max(base-6,1)];
  if (type === 'drop')     return [base, Math.max(base-3,1), Math.max(base-6,1)];
  return [base];
}

function renderSetPreview(currentSetIdx) {
  const base    = parseInt(targetInput.value) || 15;
  const type    = setTypeInput.value;
  const targets = calcTargetArray(base, type);
  const idx     = currentSetIdx !== undefined ? currentSetIdx : -1;

  setPreview.innerHTML = targets.map((t, i) => {
    let cls = 'set-preview-tag';
    if (i < idx)  cls += ' done';
    if (i === idx) cls += ' active';
    return `<span class="${cls}">Set ${i+1}: ${t} reps</span>`;
  }).join('');

  // Progress dots
  setDots.innerHTML = targets.map((_, i) => {
    let cls = 'set-dot';
    if (i < idx)   cls += ' done';
    if (i === idx) cls += ' active';
    return `<div class="${cls}"></div>`;
  }).join('');
}

// Initial render
renderSetPreview(-1);

// Set-type button toggle
setTypeGroup.querySelectorAll('.set-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setTypeGroup.querySelectorAll('.set-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    setTypeInput.value = btn.dataset.value;
    renderSetPreview(-1);
  });
});

// Rep stepper
let repTarget = 15;

function updateRepTarget(val) {
  repTarget = Math.max(1, Math.min(100, val));
  // Sync ke elemen display input (jika ada) dan hidden input
  const dispEl = document.getElementById('target-display');
  if (dispEl.tagName === 'INPUT') {
    dispEl.value = repTarget;
  } else {
    dispEl.textContent = repTarget;
  }
  targetInput.value = repTarget;
  renderSetPreview(-1);
}

// Hold-to-repeat — tanpa click event terpisah (menghindari double increment)
let stepInterval  = null;
let stepTimeout   = null;

function startHold(direction) {
  // Increment sekali langsung saat tombol ditekan
  updateRepTarget(repTarget + direction);
  // Setelah 350ms tahan, mulai repeat setiap 100ms
  stepTimeout = setTimeout(() => {
    stepInterval = setInterval(() => updateRepTarget(repTarget + direction), 100);
  }, 350);
}

function stopHold() {
  clearTimeout(stepTimeout);
  clearInterval(stepInterval);
  stepTimeout  = null;
  stepInterval = null;
}

// Mouse events
btnRepMinus.addEventListener('mousedown', (e) => { e.preventDefault(); startHold(-1); });
btnRepPlus.addEventListener('mousedown',  (e) => { e.preventDefault(); startHold(+1); });
['mouseup', 'mouseleave'].forEach(ev => {
  btnRepMinus.addEventListener(ev, stopHold);
  btnRepPlus.addEventListener(ev, stopHold);
});

// Touch events (mobile)
btnRepMinus.addEventListener('touchstart', (e) => { e.preventDefault(); startHold(-1); }, { passive: false });
btnRepPlus.addEventListener('touchstart',  (e) => { e.preventDefault(); startHold(+1); }, { passive: false });
['touchend', 'touchcancel'].forEach(ev => {
  btnRepMinus.addEventListener(ev, stopHold);
  btnRepPlus.addEventListener(ev, stopHold);
});

// Keyboard / direct typing support
targetDisplay.addEventListener('input', () => {
  const val = parseInt(targetDisplay.value);
  if (!isNaN(val)) {
    repTarget = Math.max(1, Math.min(100, val));
    targetInput.value = repTarget;
    renderSetPreview(-1);
  }
});
targetDisplay.addEventListener('blur', () => {
  // Pastikan nilai valid dan tampilkan kembali dengan benar saat fokus hilang
  updateRepTarget(repTarget);
});
targetDisplay.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp')   { e.preventDefault(); updateRepTarget(repTarget + 1); }
  if (e.key === 'ArrowDown') { e.preventDefault(); updateRepTarget(repTarget - 1); }
  if (e.key === 'Enter')     { targetDisplay.blur(); }
});

// History DOM
const historyList       = document.getElementById('history-list');
const historyEmpty      = document.getElementById('history-empty');
const btnClearHistory   = document.getElementById('btn-clear-history');
const btnViewAllHistory = document.getElementById('btn-view-all-history');
const historyModal      = document.getElementById('history-modal');
const modalHistoryList  = document.getElementById('modal-history-list');
const btnCloseModal     = document.getElementById('btn-close-modal');

let isStreaming   = false;
let stream        = null;
let analysisInterval = null;

// ============================================================
//  AUDIO ENGINE  (Web Audio API — tidak perlu file eksternal)
// ============================================================
let audioCtx = null;
let audioEnabled = (localStorage.getItem('audioEnabled') !== 'false'); // default: ON

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume jika suspended (kebijakan autoplay browser)
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/**
 * playSound(type)
 *  'warning'  → tone tinggi pendek (dua kali) — peringatan form
 *  'success'  → tone naik — rep berhasil
 *  'finish'   → melodi kecil 3 nada — sesi/set selesai
 */
function playSound(type) {
  if (!audioEnabled) return;
  const ctx = getAudioCtx();

  const now = ctx.currentTime;

  if (type === 'warning') {
    // Dua beep nada tinggi
    [0, 0.18].forEach(offset => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now + offset);
      gain.gain.setValueAtTime(0.15, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);
      osc.start(now + offset);
      osc.stop(now + offset + 0.14);
    });

  } else if (type === 'success') {
    // Satu beep nada naik (up-chirp)
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(660, now + 0.12);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.start(now);
    osc.stop(now + 0.2);

  } else if (type === 'finish') {
    // Melodi 3 nada: do-mi-sol
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.18);
      gain.gain.setValueAtTime(0.2, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.22);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.25);
    });
  }
}

function updateAudioUI() {
  if (audioEnabled) {
    audioIcon.setAttribute('data-lucide', 'volume-2');
    btnAudioToggle.classList.add('audio-toggle-on');
    btnAudioToggle.classList.remove('audio-toggle-off');
  } else {
    audioIcon.setAttribute('data-lucide', 'volume-x');
    btnAudioToggle.classList.remove('audio-toggle-on');
    btnAudioToggle.classList.add('audio-toggle-off');
  }
  lucide.createIcons();
}

btnAudioToggle.addEventListener('click', () => {
  audioEnabled = !audioEnabled;
  localStorage.setItem('audioEnabled', audioEnabled);
  updateAudioUI();
  // Mainkan preview suara ketika dinyalakan
  if (audioEnabled) playSound('success');
});

// Inisialisasi UI audio saat load
updateAudioUI();

// ============================================================
//  SESSION MANAGER  — tracking sesi aktif
// ============================================================
let session = {
  startTime: null,
  setType: 'standard',
  target: 15,
  targetArray: [],
  totalReps: 0,
  setsCompleted: 0,
  incompleteReps: 0,
  lastFeedback: ''
};

async function sessionStart() {
  const targetVal  = document.getElementById('target-input').value;
  const setTypeVal = document.getElementById('set-type').value;
  
  try {
    const res = await fetch('/start_session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: parseInt(targetVal) || 15,
        set_type: setTypeVal
      })
    });
    
    if (res.status === 401) {
      alert("Harap login terlebih dahulu.");
      return false;
    }
    
    const data = await res.json();
    if (res.ok) {
      session = {
        startTime:      Date.now(),
        setType:        setTypeVal,
        target:         parseInt(targetVal) || 15,
        targetArray:    [],
        totalReps:      0,
        setsCompleted:  0,
        incompleteReps: 0,
        lastFeedback:   ''
      };
      return true;
    } else {
      console.error(data.error);
      return false;
    }
  } catch (err) {
    console.error("Gagal memulai sesi DB", err);
    return false;
  }
}

function sessionUpdate(result) {
  if (!session.startTime) return;

  // Update target_array dari respons server
  if (result.target_array && result.target_array.length > 0) {
    session.targetArray = result.target_array;
  }

  // Deteksi penambahan rep
  if (result.reps !== undefined && result.reps > session.totalReps) {
    session.totalReps = result.reps;
  }

  // Ambil jumlah gerakan salah langsung dari server (sudah dihitung FSM)
  if (result.incomplete_reps !== undefined) {
    session.incompleteReps = result.incomplete_reps;
  }

  // Deteksi set selesai
  if (result.is_resting && result.current_set_index !== undefined) {
    const setIdx = result.current_set_index;
    if (setIdx + 1 > session.setsCompleted) {
      session.setsCompleted = setIdx + 1;
    }
  }
}

async function sessionSave() {
  if (!session.startTime) return;

  try {
    const res = await fetch('/end_session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        total_reps: session.totalReps,
        sets_completed: session.setsCompleted,
        incomplete_reps: session.incompleteReps
      })
    });
    if (res.ok) {
      session.startTime = null; // Tandai sudah disimpan
      renderHistoryPanel();
    }
  } catch (err) {
    console.error("Gagal menyimpan sesi", err);
  }
}

// Handler Akhiri Sesi Button
btnEndSession.addEventListener('click', async () => {
  await sessionSave();
  stopCamera();
});

// ============================================================
//  HISTORY RENDERING
// ============================================================
const SET_TYPE_LABEL = { standard: 'Standard', pyramid: 'Pyramid', drop: 'Drop Set' };

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function buildHistoryCard(record, compact = true) {
  // Support data lama (warnings) dan baru (incompleteReps)
  const badCount = record.incompleteReps !== undefined
    ? record.incompleteReps
    : (record.warnings ? record.warnings.length : 0);

  const formBadge = badCount > 0
    ? `<span class="history-badge warning">${badCount}\u00d7 gerakan salah</span>`
    : `<span class="history-badge good">\u2713 Siklus penuh</span>`;

  const setLabel = SET_TYPE_LABEL[record.setType] || record.setType;

  const incompleteDetail = (!compact && badCount > 0)
    ? `<div class="mt-2 p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/10">
        <p class="text-xs text-rose-400 font-medium">
          <span class="font-bold">${badCount}\u00d7</span> siklus tidak terpenuhi
          <span class="text-zinc-600 ml-1">(UP\u2192DOWN\u2192UP tidak komplit)</span>
        </p>
       </div>`
    : '';

  const statusBadge = record.status === 'Tercapai'
    ? `<span class="history-badge good">\u2714 Tercapai</span>`
    : `<span class="history-badge warning">\u2716 Tidak Tercapai</span>`;

  return `
    <div class="history-card">
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold text-white truncate">${formatDate(record.date)}</p>
          <p class="text-xs text-zinc-500 mt-0.5">${setLabel} \u00b7 ${formatDuration(record.durationSeconds)}</p>
        </div>
        <div class="flex flex-col items-end gap-1 shrink-0">
          <span class="text-2xl font-black text-emerald-400">${record.totalReps}</span>
          <span class="text-xs text-zinc-500">reps</span>
        </div>
      </div>
      <div class="flex items-center gap-2 mt-2 flex-wrap">
        ${statusBadge}
        ${formBadge}
        <span class="history-badge neutral">${record.setsCompleted} set</span>
      </div>
      ${incompleteDetail}
    </div>
  `;
}

async function fetchHistoryData() {
  try {
    const res = await fetch('/get_history');
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error("Gagal ambil history", err);
    return [];
  }
}

async function renderHistoryPanel() {
  const history = await fetchHistoryData();

  if (history.length === 0) {
    historyEmpty.classList.remove('hidden');
    historyList.innerHTML = '';
    return;
  }

  historyEmpty.classList.add('hidden');
  const recent = history.slice(0, 6);
  historyList.innerHTML = recent.map(r => buildHistoryCard(r, true)).join('');
}

async function renderHistoryModal() {
  const history = await fetchHistoryData();

  if (history.length === 0) {
    modalHistoryList.innerHTML = `
      <div class="flex flex-col items-center justify-center py-16 text-center">
        <i data-lucide="inbox" class="w-12 h-12 text-zinc-700 mb-3"></i>
        <p class="text-zinc-500">Belum ada riwayat latihan.</p>
      </div>`;
    lucide.createIcons();
    return;
  }

  modalHistoryList.innerHTML = history.map(r => buildHistoryCard(r, false)).join('');
}

// Event: Lihat Semua
btnViewAllHistory.addEventListener('click', () => {
  renderHistoryModal();
  historyModal.classList.remove('hidden');
  historyModal.classList.add('flex');
  lucide.createIcons();
});

// Event: Tutup Modal
btnCloseModal.addEventListener('click', () => {
  historyModal.classList.add('hidden');
  historyModal.classList.remove('flex');
});

// Event: Tutup modal ketika klik backdrop
historyModal.addEventListener('click', (e) => {
  if (e.target === historyModal) {
    historyModal.classList.add('hidden');
    historyModal.classList.remove('flex');
  }
});

// Event: Hapus Semua
// Event: Hapus Semua
btnClearHistory.addEventListener('click', () => {
  // Fitur dihapus karena history sudah di database
});

// Render history dihapus dari sini, dipindah ke checkAuth()

// ============================================================
//  CAMERA
// ============================================================
async function startCamera() {
  // Cek Auth sebelum start
  const authRes = await fetch('/check_auth');
  const authData = await authRes.json();
  if (!authData.is_authenticated) {
    authModal.classList.remove('hidden');
    authModal.classList.add('flex');
    return;
  }

  // Mulai session tracking di database
  const startOk = await sessionStart();
  if (!startOk) return;

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoStream.srcObject = stream;
    isStreaming = true;
    
    emptyState.classList.add('hidden');
    feedContainer.classList.remove('hidden');
    playbackVideo.classList.add('hidden');
    playbackVideo.src = '';
    
    loadingTitle.textContent = "Memuat Model AI...";
    loadingDesc.textContent = "Harap tunggu, AI sedang bersiap...";
    loadingState.classList.remove('hidden');
    zoomControl.classList.remove('hidden');
    zoomControl.classList.add('flex');
    
    btnCameraText.textContent = 'Stop Camera';
    btnCameraIcon.setAttribute('data-lucide', 'square');
    btnCamera.classList.replace('bg-emerald-500', 'bg-rose-500');
    btnCamera.classList.replace('hover:bg-emerald-400', 'hover:bg-rose-400');
    btnCamera.classList.replace('text-zinc-950', 'text-white');
    btnCamera.classList.replace('shadow-[0_0_20px_rgba(16,185,129,0.3)]', 'shadow-[0_0_20px_rgba(244,63,94,0.3)]');
    
    btnEndSession.classList.remove('hidden');
    btnEndSession.classList.add('flex');

    lucide.createIcons();

    startAnalysisLoop();
  } catch (err) {
    console.error("Error accessing camera: ", err);
    alert("Could not access the camera. Please grant permission.");
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  isStreaming = false;
  clearTimeout(analysisInterval);
  
  loadingState.classList.add('hidden');
  feedContainer.classList.add('hidden');
  emptyState.classList.remove('hidden');
  zoomControl.classList.add('hidden');
  zoomControl.classList.remove('flex');
  imagePreview.src = '';
  imagePreview.style.transform = `scale(1)`;
  imagePreview.classList.remove('hidden');
  playbackVideo.classList.add('hidden');
  playbackVideo.src = '';
  zoomSlider.value = 1;
  zoomValue.textContent = '1.0x';
  
  btnCameraText.textContent = 'Start Workout';
  btnCameraIcon.setAttribute('data-lucide', 'camera');
  btnCamera.classList.replace('bg-rose-500', 'bg-emerald-500');
  btnCamera.classList.replace('hover:bg-rose-400', 'hover:bg-emerald-400');
  btnCamera.classList.replace('text-white', 'text-zinc-950');
  btnCamera.classList.replace('shadow-[0_0_20px_rgba(244,63,94,0.3)]', 'shadow-[0_0_20px_rgba(16,185,129,0.3)]');
  
  btnEndSession.classList.add('hidden');
  btnEndSession.classList.remove('flex');

  lucide.createIcons();
  
  // Sembunyikan form feedback
  feedbackBanner.classList.add('opacity-0', 'scale-95');
  feedbackBanner.classList.remove('scale-100', 'opacity-100');
  
  // Reset Stats
  document.getElementById('res-state').textContent = '--';
  document.getElementById('res-state').className = 'text-xl font-bold text-white tracking-wide';
  document.getElementById('res-class').innerHTML = '--';
  document.getElementById('res-conf').textContent = '--';
}

btnCamera.addEventListener('click', () => {
  if (isStreaming) {
    stopCamera();
  } else {
    startCamera();
  }
});

btnUpload.addEventListener('click', () => {
    videoUpload.click();
});

btnNextSet.addEventListener('click', async () => {
    try {
        await fetch('/next_set', { method: 'POST' });
        nextSetWrapper.classList.add('hidden');
    } catch (err) {
        console.error("Failed to start next set", err);
    }
});

videoUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (isStreaming) {
        stopCamera();
    }
    
    emptyState.classList.add('hidden');
    feedContainer.classList.remove('hidden');
    imagePreview.classList.add('hidden');
    playbackVideo.classList.add('hidden');
    zoomControl.classList.add('hidden');
    zoomControl.classList.remove('flex');
    
    loadingTitle.textContent = "Memproses Video...";
    loadingDesc.textContent = "AI sedang menganalisis form Anda frame-demi-frame.";
    loadingState.classList.remove('hidden');
    
    const targetVal  = document.getElementById('target-input').value;
    const setTypeVal = document.getElementById('set-type').value;
    
    const formData = new FormData();
    formData.append('video', file);
    formData.append('target', targetVal);
    formData.append('set_type', setTypeVal);
    
    try {
        const response = await fetch('/analyze_video', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        
        loadingState.classList.add('hidden');
        
        if (result.video_url) {
            playbackVideo.src = result.video_url;
            playbackVideo.classList.remove('hidden');
        } else {
            alert(result.error || "Failed to process video");
            emptyState.classList.remove('hidden');
            feedContainer.classList.add('hidden');
        }
        
    } catch (err) {
        console.error(err);
        loadingState.classList.add('hidden');
        emptyState.classList.remove('hidden');
        feedContainer.classList.add('hidden');
        alert("An error occurred during video analysis.");
    }
    
    videoUpload.value = '';
});

zoomSlider.addEventListener('input', (e) => {
  const scale = parseFloat(e.target.value).toFixed(1);
  zoomValue.textContent = `${scale}x`;
  imagePreview.style.transform = `scale(${scale})`;
});

// ============================================================
//  ANALYSIS LOOP
// ============================================================
function startAnalysisLoop() {
  if (!isStreaming) return;

  const canvas  = snapshotCanvas;
  const context = canvas.getContext('2d');
  
  if (videoStream.videoWidth && videoStream.videoHeight) {
    canvas.width  = videoStream.videoWidth;
    canvas.height = videoStream.videoHeight;
    context.drawImage(videoStream, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(async (blob) => {
      if (!blob) return scheduleNext();
      
      const formData = new FormData();
      formData.append('image', blob, 'frame.jpg');

      try {
        const response = await fetch('/analyze', {
          method: 'POST',
          body: formData
        });
        const result = await response.json();
        
        if (result.image) {
          imagePreview.src = 'data:image/jpeg;base64,' + result.image;
          imagePreview.classList.remove('hidden');
          
          if (!loadingState.classList.contains('hidden') && isStreaming) {
              loadingState.classList.add('hidden');
          }
        }
        
        sessionUpdate(result);
        updateDashboard(result);
      } catch (err) {
        console.error("Analysis error:", err);
      }
      
      scheduleNext();
    }, 'image/jpeg', 0.8);
  } else {
    scheduleNext();
  }
}

function scheduleNext() {
  if (isStreaming) {
    analysisInterval = setTimeout(startAnalysisLoop, 100);
  }
}

// ============================================================
//  DASHBOARD UPDATE + AUDIO TRIGGER
// ============================================================
let _lastFeedback = '';
let _lastReps     = 0;

function updateDashboard(result) {
  const stateEl = document.getElementById('res-state');
  
  let stateColor = 'text-white';
  if (result.fsm_state === 'DOWN')       stateColor = 'text-rose-400';
  else if (result.fsm_state === 'UP')    stateColor = 'text-emerald-400';
  else if (result.fsm_state === 'GOING_DOWN' || result.fsm_state === 'GOING_UP') stateColor = 'text-cyan-400';
  
  stateEl.textContent = result.fsm_state || 'ERR';
  stateEl.className   = `text-xl font-bold tracking-wide ${stateColor}`;
  
  document.getElementById('res-class').textContent = result.yolo_class || '--';
  document.getElementById('res-conf').textContent  = result.confidence !== null ? result.confidence : '--';
  
  if (result.reps !== undefined && result.target !== undefined) {
      const repCountEl = document.getElementById('rep-count');
      repCountEl.textContent = result.reps;
      if (result.reps >= result.target && result.target > 0) {
          repCountEl.classList.add('text-emerald-400');
      } else {
          repCountEl.classList.remove('text-emerald-400');
      }
  }
  
  if (result.current_set_index !== undefined) {
      document.getElementById('set-indicator').textContent = `Total Reps (Set ${result.current_set_index + 1})`;
  }
  
  if (result.is_resting) {
      nextSetWrapper.classList.remove('hidden');
  } else {
      nextSetWrapper.classList.add('hidden');
  }

  // Update set progress dots live
  if (result.current_set_index !== undefined) {
    renderSetPreview(result.current_set_index);
  }
  
  // ---- Feedback UI ----
  const feedbackBanner = document.getElementById('feedback-banner');
  const feedbackText   = document.getElementById('feedback-text');
  
  if (result.feedback && result.feedback !== "Siap dimulai!") {
      feedbackText.textContent = result.feedback;
      
      if (result.feedback.includes("⚠️")) {
          feedbackBanner.className = "absolute top-4 right-4 max-w-sm px-5 py-3 rounded-2xl bg-rose-600/90 backdrop-blur-md shadow-[0_0_20px_rgba(225,29,72,0.5)] flex items-center gap-3 transition-all duration-300 transform scale-100 opacity-100 z-30";
      } else if (result.feedback.includes("✅")) {
          feedbackBanner.className = "absolute top-4 right-4 max-w-sm px-5 py-3 rounded-2xl bg-emerald-600/90 backdrop-blur-md shadow-[0_0_20px_rgba(5,150,105,0.5)] flex items-center gap-3 transition-all duration-300 transform scale-100 opacity-100 z-30";
      } else {
          feedbackBanner.className = "absolute top-4 right-4 max-w-sm px-5 py-3 rounded-2xl bg-zinc-800/90 backdrop-blur-md border border-white/10 flex items-center gap-3 transition-all duration-300 transform scale-100 opacity-100 z-30";
      }
  } else {
      feedbackBanner.classList.add('opacity-0', 'scale-95');
      feedbackBanner.classList.remove('scale-100', 'opacity-100');
  }

  // ---- Audio Trigger ----
  const currentFeedback = result.feedback || '';
  const currentReps     = result.reps || 0;

  if (currentFeedback !== _lastFeedback) {
    if (currentFeedback.includes('⚠️')) {
      playSound('warning');
    } else if (currentFeedback.includes('🎉') || currentFeedback.includes('🏆')) {
      playSound('finish');
      // Auto-save sesi ketika latihan selesai
      if (currentFeedback.includes('🏆')) {
        setTimeout(() => sessionSave(), 500);
      }
    } else if (currentFeedback.includes('✅')) {
      // Hanya bunyi sukses ketika rep bertambah (bukan feedback lama)
      if (currentReps > _lastReps) {
        playSound('success');
      }
    }
    _lastFeedback = currentFeedback;
  }

  _lastReps = currentReps;
}

// ============================================================
//  AUTHENTICATION LOGIC
// ============================================================
let isLoginMode = true;

// Toggle mode form
btnAuthSwitch.addEventListener('click', () => {
  isLoginMode = !isLoginMode;
  if (isLoginMode) {
    authTitle.textContent = "Login ke RepCount";
    authDesc.textContent = "Masuk untuk menyimpan riwayat latihan Anda.";
    btnAuthSubmit.textContent = "Login";
    authSwitchText.textContent = "Belum punya akun?";
    btnAuthSwitch.textContent = "Daftar sekarang";
    authEmailGroup.classList.add('hidden');
    authEmail.required = false;
    authPasswordConfirmGroup.classList.add('hidden');
    authPasswordConfirm.required = false;
  } else {
    authTitle.textContent = "Daftar Akun Baru";
    authDesc.textContent = "Buat akun untuk memulai melacak progress Anda.";
    btnAuthSubmit.textContent = "Register";
    authSwitchText.textContent = "Sudah punya akun?";
    btnAuthSwitch.textContent = "Login di sini";
    authEmailGroup.classList.remove('hidden');
    authEmail.required = true;
    authPasswordConfirmGroup.classList.remove('hidden');
    authPasswordConfirm.required = true;
  }
  authError.classList.add('hidden');
});

// Check auth status on load
async function checkAuth() {
  try {
    const res = await fetch('/check_auth');
    const data = await res.json();
    if (data.is_authenticated) {
      authModal.classList.add('hidden');
      authModal.classList.remove('flex');
      userInfo.classList.remove('hidden');
      userInfo.classList.add('flex');
      userName.textContent = data.username;
      renderHistoryPanel();
    } else {
      authModal.classList.remove('hidden');
      authModal.classList.add('flex');
      userInfo.classList.add('hidden');
      userInfo.classList.remove('flex');
    }
  } catch(e) {
    console.error(e);
  }
}

// Handle Form Submit
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = authUsername.value;
  const password = authPassword.value;
  const email = authEmail.value;
  const passwordConfirm = authPasswordConfirm.value;
  const endpoint = isLoginMode ? '/login' : '/register';
  
  if (!isLoginMode && password !== passwordConfirm) {
    authError.classList.remove('hidden');
    authError.classList.replace('text-emerald-400', 'text-rose-400');
    authError.textContent = "Konfirmasi password tidak cocok!";
    return;
  }
  
  const payload = isLoginMode 
    ? { username, password } 
    : { username, email, password };
  
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    
    if (res.ok) {
      if (isLoginMode) {
        authModal.classList.add('hidden');
        authModal.classList.remove('flex');
        userInfo.classList.remove('hidden');
        userInfo.classList.add('flex');
        userName.textContent = data.username;
        renderHistoryPanel();
      } else {
        // Jika register sukses, langsung ganti mode ke login dan isi form
        isLoginMode = true;
        authTitle.textContent = "Login ke RepCount";
        btnAuthSubmit.textContent = "Login";
        authSwitchText.textContent = "Belum punya akun?";
        btnAuthSwitch.textContent = "Daftar sekarang";
        authEmailGroup.classList.add('hidden');
        authEmail.required = false;
        authPasswordConfirmGroup.classList.add('hidden');
        authPasswordConfirm.required = false;
        authError.classList.remove('hidden');
        authError.classList.replace('text-rose-400', 'text-emerald-400');
        authError.textContent = "Registrasi berhasil! Silakan login.";
      }
    } else {
      authError.classList.remove('hidden');
      authError.classList.replace('text-emerald-400', 'text-rose-400');
      authError.textContent = data.error || "Terjadi kesalahan";
    }
  } catch(e) {
    authError.classList.remove('hidden');
    authError.textContent = "Koneksi ke server gagal.";
  }
});

// Handle Logout
btnLogout.addEventListener('click', async () => {
  try {
    await fetch('/logout', { method: 'POST' });
    window.location.reload(); // Reload halaman untuk reset semua state
  } catch(e) {
    console.error(e);
  }
});

// Run auth check on load
checkAuth();
