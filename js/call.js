// Each entry = one caller ID number + its matching recording.
// File paths are relative to wiretap.html (served over http://, not file://).
const CALLS = [
  { number: "3019992486", file: "../audio/call1.mp3" },
  { number: "4105551234", file: "../audio/call2.mp3" },
  { number: "8005551212", file: "../audio/call3.mp3" },
  { number: "6005559686", file: "../audio/call4.mp3" },
  { number: "9605553541", file: "../audio/call5.mp3" },
  { number: "2505552148", file: "../audio/call6.mp3" },
  { number: "7005556542", file: "../audio/call7.mp3" },
  { number: "1205556317", file: "../audio/call8.mp3" },
  { number: "9005558741", file: "../audio/call9.mp3" },
  { number: "4508883247", file: "../audio/call10.mp3" },
  { number: "6005552879", file: "../audio/call11.mp3" },
  { number: "4102223967", file: "../audio/call12.mp3" },
  { number: "2307775129", file: "../audio/call13.mp3" },
  { number: "9354442155", file: "../audio/call14.mp3" },
  { number: "8804447513", file: "../audio/call15.mp3" },
  { number: "8745559486", file: "../audio/call16.mp3" },
  { number: "3125554845", file: "../audio/call17.mp3" },
  { number: "1205556060", file: "../audio/call18.mp3" },
  { number: "7204125055", file: "../audio/call19.mp3" },
  { number: "4516954845", file: "../audio/call20.mp3" },
  { number: "5487498413", file: "../audio/call21.mp3" },
];

// 'random'     -> picks a random call each loop (never repeats the same
//                 one twice in a row if you have more than one entry)
// 'sequential' -> cycles through the list in order, looping back to start
const CALL_ORDER = 'sequential';

let lastCallIndex = -1;
function pickNextCall(){
  if (CALLS.length === 1) return CALLS[0];
  if (CALL_ORDER === 'sequential'){
    lastCallIndex = (lastCallIndex + 1) % CALLS.length;
    return CALLS[lastCallIndex];
  }
  let idx;
  do { idx = Math.floor(Math.random() * CALLS.length); }
  while (idx === lastCallIndex);
  lastCallIndex = idx;
  return CALLS[idx];
}

// Formats a 10-digit number as XXX.XXX.XXXX to match the Target bar's
// original look (e.g. "410.968.1146"). Falls back to the raw string for
// any number that isn't exactly 10 digits.
function formatPhone(num){
  if (num.length === 10) return `${num.slice(0,3)}.${num.slice(3,6)}.${num.slice(6)}`;
  return num;
}

// ---------- Waveform rendering ----------
let scrollX = 0;
const history = [];
const MAX_POINTS = 400;

function drawWave(){
  requestAnimationFrame(drawWave);
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);

  // grid
  ctx.strokeStyle = 'rgba(80,110,180,0.25)';
  ctx.lineWidth = 1;
  for (let x=0; x<w; x+=w/20){
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke();
  }

  let level = 0;
  if (analyser){
    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i=0;i<dataArray.length;i++){
      const v = (dataArray[i]-128)/128;
      sum += Math.abs(v);
    }
    level = sum/dataArray.length;
  }
  history.push(level);
  if (history.length > MAX_POINTS) history.shift();

  // draw scrolling amplitude trace (orange, like screenshot)
  ctx.strokeStyle = '#e08a3c';
  ctx.lineWidth = 1.5 * devicePixelRatio;
  ctx.beginPath();
  const midY = h*0.5;
  history.forEach((v,i)=>{
    const x = (i/MAX_POINTS)*w;
    const y = midY - v * h * 3.2 * Math.sin(i*0.7 + performance.now()*0.005);
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();

  // fainter cyan secondary trace
  ctx.strokeStyle = 'rgba(120,200,255,0.6)';
  ctx.beginPath();
  history.forEach((v,i)=>{
    const x = (i/MAX_POINTS)*w;
    const y = midY + v * h * 2.2 * Math.cos(i*0.5 + performance.now()*0.004);
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();
}
drawWave();

// ---------- Dialing / loop sequence ----------
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function dialDigits(number){
  digitsEl.innerHTML = '';
  const spans = [];
  for (const ch of number){
    const s = document.createElement('span');
    s.textContent = ch;
    s.className = 'ghost';
    digitsEl.appendChild(s);
    spans.push(s);
  }
  for (let i=0;i<spans.length;i++){
    await sleep(DIAL_STEP_MS);
    playDTMFTone(spans[i].textContent);
    spans[i].className = '';
  }
}

async function runLoop(){
  while (true){
    footStatus.textContent = 'STANDBY';
    lineStatus.textContent = 'Payphone Active';
    digitsEl.innerHTML = '';
    elapsedStart = null;
    footTime.textContent = '00:00.00';
    await sleep(LOOP_GAP_MS);

    const call = pickNextCall();
    audioEl.src = call.file;
    audioEl.load();

    // 1) Dialing: number appears digit-by-digit with touch-tone beeps,
    //    and the Target bar updates to the caller's number right away.
    footStatus.textContent = 'DIALING';
    lineStatus.textContent = 'Dialing...';
    targetNumberEl.textContent = formatPhone(call.number);
    await dialDigits(call.number);

    // 2) Ring
    footStatus.textContent = 'RINGING';
    lineStatus.textContent = 'Incoming Call...';
    playRingTone();
    await sleep(1800);

    // 3) Connected — play the actual recording
    footStatus.textContent = 'CONNECTED — RECORDING';
    lineStatus.textContent = 'Payphone Active';
    elapsedStart = performance.now();
    await playCallRecording();

    footStatus.textContent = 'CALL ENDED';
    await sleep(3000);
  }
}
