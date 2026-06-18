lucide.createIcons();

const emptyState = document.getElementById('empty-state');
const feedContainer = document.getElementById('feed-container');
const imagePreview = document.getElementById('image-preview');
const btnCamera = document.getElementById('btn-camera');
const btnCameraText = document.getElementById('btn-camera-text');
const btnCameraIcon = document.getElementById('btn-camera-icon');
const videoStream = document.getElementById('video-stream');
const snapshotCanvas = document.getElementById('snapshot-canvas');
const zoomControl = document.getElementById('zoom-control');
const zoomSlider = document.getElementById('zoom-slider');
const zoomValue = document.getElementById('zoom-value');
const btnUpload = document.getElementById('btn-upload');
const videoUpload = document.getElementById('video-upload');
const loadingState = document.getElementById('loading-state');
const loadingTitle = document.getElementById('loading-title');
const loadingDesc = document.getElementById('loading-desc');
const playbackVideo = document.getElementById('playback-video');
const btnNextSet = document.getElementById('btn-next-set');

let isStreaming = false;
let stream = null;
let analysisInterval = null;

async function startCamera() {
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
    
    btnCameraText.textContent = 'Stop Workout';
    btnCameraIcon.setAttribute('data-lucide', 'square');
    btnCamera.classList.replace('bg-emerald-500', 'bg-rose-500');
    btnCamera.classList.replace('hover:bg-emerald-400', 'hover:bg-rose-400');
    btnCamera.classList.replace('text-zinc-950', 'text-white');
    btnCamera.classList.replace('shadow-[0_0_20px_rgba(16,185,129,0.3)]', 'shadow-[0_0_20px_rgba(244,63,94,0.3)]');
    lucide.createIcons();
    
    startAnalysisLoop();
    
    const targetVal = document.getElementById('target-input').value;
    const setTypeVal = document.getElementById('set-type').value;
    fetch('/set_target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: targetVal, set_type: setTypeVal })
    });
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
  lucide.createIcons();
  
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
        btnNextSet.classList.add('hidden');
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
    
    const targetVal = document.getElementById('target-input').value;
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

function startAnalysisLoop() {
  if (!isStreaming) return;

  const canvas = snapshotCanvas;
  const context = canvas.getContext('2d');
  
  if (videoStream.videoWidth && videoStream.videoHeight) {
    canvas.width = videoStream.videoWidth;
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

function updateDashboard(result) {
  const stateEl = document.getElementById('res-state');
  
  let stateColor = 'text-white';
  if (result.fsm_state === 'DOWN') stateColor = 'text-rose-400';
  else if (result.fsm_state === 'UP') stateColor = 'text-emerald-400';
  else if (result.fsm_state === 'GOING_DOWN' || result.fsm_state === 'GOING_UP') stateColor = 'text-cyan-400';
  
  stateEl.textContent = result.fsm_state || 'ERR';
  stateEl.className = `text-xl font-bold tracking-wide ${stateColor}`;
  
  document.getElementById('res-class').textContent = result.yolo_class || '--';
  document.getElementById('res-conf').textContent = result.confidence !== null ? result.confidence : '--';
  
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
      btnNextSet.classList.remove('hidden');
  } else {
      btnNextSet.classList.add('hidden');
  }
  
  // Feedback UI
  const feedbackBanner = document.getElementById('feedback-banner');
  const feedbackText = document.getElementById('feedback-text');
  
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
}
