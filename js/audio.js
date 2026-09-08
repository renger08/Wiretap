// ---------- Audio ----------
// Ring is synthesized (no external file needed). The call itself plays
// your own recorded file through callAudio, routed through the analyser
// so the waveform panel reacts to your real recording.
let audioCtx, analyser, dataArray, masterGain, fileSource;
function initAudio(){
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  dataArray = new Uint8Array(analyser.frequencyBinCount);
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.0;
  masterGain.connect(analyser);
  analyser.connect(audioCtx.destination);

  // Hook the <audio> element into the same graph so the waveform
  // reacts to the real recording instead of synthesized noise.
  fileSource = audioCtx.createMediaElementSource(audioEl);
  fileSource.connect(masterGain);
}

function playCallRecording(){
  return new Promise((resolve) => {
    masterGain.gain.setValueAtTime(0.6, audioCtx.currentTime);
    audioEl.currentTime = 0;
    audioEl.onended = resolve;
    audioEl.onerror = () => {
      console.error(`Could not load "${audioEl.src}" — check the filename/path in CALLS (servers are usually case-sensitive) and that the file was actually uploaded.`);
      resolve();
    };
    audioEl.play().catch(err => {
      console.warn('Playback blocked or failed:', err.name, err.message);
      resolve();
    });
  });
}

function playRingTone(){
  // classic dual-tone ring approximation
  const now = audioCtx.currentTime;
  [440, 480].forEach(freq=>{
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    g.gain.value = 0.15;
    osc.connect(g); g.connect(masterGain);
    osc.start(now); osc.stop(now+2);
  });
  masterGain.gain.setValueAtTime(0.4, now);
}

function playCallTone(durationSec){
  // ambient line hum + voice-band noise standing in for a call
  const now = audioCtx.currentTime;
  masterGain.gain.setValueAtTime(0.3, now);

  const hum = audioCtx.createOscillator();
  hum.type = 'sine'; hum.frequency.value = 60;
  const humGain = audioCtx.createGain(); humGain.gain.value = 0.03;
  hum.connect(humGain); humGain.connect(masterGain);
  hum.start(now); hum.stop(now+durationSec);

  const bufferSize = audioCtx.sampleRate * durationSec;
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i=0;i<bufferSize;i++){ data[i] = (Math.random()*2-1) * 0.5; }
  const noise = audioCtx.createBufferSource();
  noise.buffer = noiseBuffer;

  const bandpass = audioCtx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 900;
  bandpass.Q.value = 0.7;

  const noiseGain = audioCtx.createGain();
  noiseGain.gain.value = 0.12;

  // slow amplitude modulation to feel like speech cadence
  const lfo = audioCtx.createOscillator();
  lfo.frequency.value = 2.3;
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 0.08;
  lfo.connect(lfoGain);
  lfoGain.connect(noiseGain.gain);
  lfo.start(now); lfo.stop(now+durationSec);

  noise.connect(bandpass); bandpass.connect(noiseGain); noiseGain.connect(masterGain);
  noise.start(now); noise.stop(now+durationSec);
}
