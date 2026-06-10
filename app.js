/**
 * Personalized Classic Sudoku for iPad
 * 100% Accurate Generator & Solver Engine
 * Version 2: Home Dashboard & Stats Hub
 */

// --- STATE MANAGEMENT ---
const state = {
  board: Array(81).fill(0),         // Current board values (0-9)
  initialBoard: Array(81).fill(0),  // Original clues (0-9)
  solutionBoard: Array(81).fill(0), // The solved board
  notes: Array(81).fill(null).map(() => Array(10).fill(false)), // Pencil marks
  checkedErrors: Array(81).fill(false), // Track error checker highlights
  
  history: [],               // Undo stack
  selectedCell: null,        // Index (0-80) of active cell
  notesMode: false,          // Pencil notes active
  
  timer: 0,                  // Time elapsed in seconds
  timerInterval: null,       // Timer interval pointer
  gameInProgress: false,     // Game state flag
  playerName: '',            // Custom name for header personalization
  
  difficulty: 'medium',      // 'easy' or 'medium'
  theme: 'paper',            // 'paper', 'midnight', 'emerald', 'lavender', 'newspaper'
  soundMuted: false,         // Control dynamic chime sounds

  currentView: 'dashboard',  // 'dashboard' or 'game'
  puzzleNumber: 1,           // Current selected puzzle number (1-1000)
  currentLevelPage: 1,       // Current page in level grid (1-50)
  
  // Game statistics
  stats: {
    completedEasy: [],       // List of solved Easy puzzle numbers
    completedMedium: [],     // List of solved Medium puzzle numbers
    completedHard: [],       // List of solved Hard puzzle numbers
    bestEasy: null,
    bestMedium: null,
    bestHard: null,
    timesEasy: {},           // { puzzleNum: solveTimeInSeconds }
    timesMedium: {},         // { puzzleNum: solveTimeInSeconds }
    timesHard: {}            // { puzzleNum: solveTimeInSeconds }
  }
};

// --- AUDIO SYNTHESIS (Web Audio API) ---
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playSound(type) {
  if (state.soundMuted) return;
  try {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'click') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'notes') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'erase') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(150, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(130, now); // Low C
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'success') {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const noteOsc = audioCtx.createOscillator();
        const noteGain = audioCtx.createGain();
        noteOsc.connect(noteGain);
        noteGain.connect(audioCtx.destination);
        
        noteOsc.type = 'sine';
        noteOsc.frequency.setValueAtTime(freq, now + idx * 0.08);
        noteGain.gain.setValueAtTime(0.0, now + idx * 0.08);
        noteGain.gain.linearRampToValueAtTime(0.12, now + idx * 0.08 + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);
        
        noteOsc.start(now + idx * 0.08);
        noteOsc.stop(now + idx * 0.08 + 0.4);
      });
    }
  } catch (err) {
    console.error('Audio synthesis failed:', err);
  }
}

// --- SUDOKU ENGINE (Generator, Solver, Validator) ---

function isValid(board, index, val) {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;

  for (let i = 0; i < 9; i++) {
    if (i !== col && board[row * 9 + i] === val) return false;
    if (i !== row && board[i * 9 + col] === val) return false;
    const r = boxRow + Math.floor(i / 3);
    const c = boxCol + (i % 3);
    const boxIdx = r * 9 + c;
    if (boxIdx !== index && board[boxIdx] === val) return false;
  }
  return true;
}

function solve(board, countMode = false) {
  let solutionsCount = 0;
  const tempBoard = [...board];

  function backtrack(index) {
    if (index === 81) {
      solutionsCount++;
      return !countMode || solutionsCount < 2;
    }

    if (tempBoard[index] !== 0) {
      return backtrack(index + 1);
    }

    for (let val = 1; val <= 9; val++) {
      if (isValid(tempBoard, index, val)) {
        tempBoard[index] = val;
        if (!backtrack(index + 1)) {
          if (countMode && solutionsCount >= 2) return false;
        }
        tempBoard[index] = 0;
      }
    }
    return false;
  }

  backtrack(0);
  return solutionsCount;
}

function createRandom(seed) {
  let s = seed;
  return function() {
    let t = s += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateSolvedBoard(random) {
  const board = Array(81).fill(0);
  
  function fill(index) {
    if (index === 81) return true;
    
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }

    for (let num of numbers) {
      if (isValid(board, index, num)) {
        board[index] = num;
        if (fill(index + 1)) return true;
        board[index] = 0;
      }
    }
    return false;
  }

  fill(0);
  return board;
}

function generatePuzzle(difficulty, puzzleNumber) {
  const seed = (difficulty === 'easy' ? 10000 : (difficulty === 'medium' ? 20000 : 30000)) + puzzleNumber;
  const random = createRandom(seed);

  const solved = generateSolvedBoard(random);
  const puzzle = [...solved];
  let targetClues = difficulty === 'easy' ? 40 : (difficulty === 'medium' ? 31 : 24);
  
  const indices = Array.from({ length: 81 }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  let cluesCount = 81;

  for (let idx of indices) {
    if (cluesCount <= targetClues) break;

    const tempVal = puzzle[idx];
    puzzle[idx] = 0;

    if (solve(puzzle, true) === 1) {
      cluesCount--;
    } else {
      puzzle[idx] = tempVal;
    }
  }

  return { puzzle, solved };
}

function findErrors(board) {
  const errors = new Set();
  for (let i = 0; i < 81; i++) {
    const val = board[i];
    if (val !== 0) {
      if (!isValid(board, i, val)) {
        errors.add(i);
      }
    }
  }
  return Array.from(errors);
}

// --- CONFETTI SYSTEM (Game Win Celebration) ---
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas.getContext('2d');
let confettiActive = false;
let confettiParticles = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', () => {
  resizeCanvas();
  renderCarousel();
});

class ConfettiParticle {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * -canvas.height - 20;
    this.size = Math.random() * 8 + 6;
    this.speed = Math.random() * 3 + 2;
    this.angle = Math.random() * Math.PI * 2;
    this.spin = Math.random() * 0.2 - 0.1;
    
    const colors = ['#f59e0b', '#fbbf24', '#3b82f6', '#60a5fa', '#10b981', '#34d399', '#ec4899', '#f43f5e'];
    this.color = colors[Math.floor(Math.random() * colors.length)];
  }

  update() {
    this.y += this.speed;
    this.angle += this.spin;
    this.x += Math.sin(this.angle) * 0.5;
    if (this.y > canvas.height) {
      this.y = -20;
      this.x = Math.random() * canvas.width;
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    ctx.restore();
  }
}

function startConfetti() {
  resizeCanvas();
  confettiActive = true;
  confettiParticles = [];
  for (let i = 0; i < 120; i++) {
    confettiParticles.push(new ConfettiParticle());
  }
  animateConfetti();
}

function stopConfetti() {
  confettiActive = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function animateConfetti() {
  if (!confettiActive) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  confettiParticles.forEach((p) => {
    p.update();
    p.draw();
  });
  
  requestAnimationFrame(animateConfetti);
}

// Cache for puzzle layouts to make carousel rendering instantaneous
const puzzleCache = {};
function getPuzzleLayout(difficulty, num) {
  const key = `${difficulty}_${num}`;
  if (puzzleCache[key]) return puzzleCache[key];
  const data = generatePuzzle(difficulty, num);
  puzzleCache[key] = data;
  return data;
}

function setNextUnsolvedPuzzle() {
  const completed = state.difficulty === 'easy' ? state.stats.completedEasy : (state.difficulty === 'medium' ? state.stats.completedMedium : state.stats.completedHard);
  let nextNum = 1;
  while (completed.includes(nextNum) && nextNum < 1000) {
    nextNum++;
  }
  state.puzzleNumber = nextNum;
  updatePuzzleNumberUI(true);
}

function selectAndPlayPuzzle(num) {
  state.puzzleNumber = num;
  saveLobbySelection();
  updatePuzzleNumberUI();
}

function centerActiveCard() {
  const carouselEl = document.getElementById('puzzle-carousel');
  if (!carouselEl) return;
  const activeCard = carouselEl.querySelector('.puzzle-card.active');
  if (activeCard) {
    activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

function renderCarousel() {
  const carouselEl = document.getElementById('puzzle-carousel');
  if (!carouselEl) return;
  carouselEl.innerHTML = '';

  // Render 15 cards centered around state.puzzleNumber (sliding window)
  const startNum = Math.max(1, state.puzzleNumber - 7);
  const endNum = Math.min(1000, startNum + 14);
  const adjustedStartNum = Math.max(1, endNum - 14);

  // Update carousel arrows disabled state
  const prevBtn = document.getElementById('carousel-prev-btn');
  const nextBtn = document.getElementById('carousel-next-btn');
  if (prevBtn) prevBtn.disabled = state.puzzleNumber <= 1;
  if (nextBtn) nextBtn.disabled = state.puzzleNumber >= 1000;

  const completed = state.difficulty === 'easy' ? state.stats.completedEasy : (state.difficulty === 'medium' ? state.stats.completedMedium : state.stats.completedHard);

  // Load Saved Game Info
  let savedPuzzle = null;
  let savedDifficulty = null;
  let savedInProgress = false;

  const savedStateStr = localStorage.getItem('sudoku_grandpa_state');
  if (savedStateStr) {
    try {
      const savedData = JSON.parse(savedStateStr);
      savedPuzzle = savedData.puzzleNumber;
      savedDifficulty = savedData.difficulty;
      savedInProgress = savedData.gameInProgress ?? false;
    } catch (e) {}
  }

  for (let num = adjustedStartNum; num <= endNum; num++) {
    const card = document.createElement('div');
    card.classList.add('puzzle-card');
    card.setAttribute('data-num', num);
    if (num === state.puzzleNumber) {
      card.classList.add('active');
    }
    const isCompleted = completed.includes(num);
    const isInProgress = savedInProgress && savedPuzzle === num && savedDifficulty === state.difficulty;

    if (isCompleted) {
      card.classList.add('completed');
    } else if (isInProgress) {
      card.classList.add('in-progress');
    }

    // Mini visual 9x9 grid
    const miniGrid = document.createElement('div');
    miniGrid.classList.add('mini-grid');

    // Fetch cell layout pattern (cached)
    const { puzzle } = getPuzzleLayout(state.difficulty, num);

    for (let i = 0; i < 81; i++) {
      const cell = document.createElement('div');
      cell.classList.add('mini-cell');
      if (puzzle[i] !== 0) {
        cell.classList.add('clue');
      }
      miniGrid.appendChild(cell);
    }
    card.appendChild(miniGrid);

    // Level number label
    const label = document.createElement('div');
    label.classList.add('card-label');
    label.innerText = `#${num}`;
    card.appendChild(label);

    // Status label
    const status = document.createElement('div');
    status.classList.add('card-status');
    if (isCompleted) {
      const times = state.difficulty === 'easy' ? state.stats.timesEasy : state.stats.timesMedium;
      const solveTime = times[num];
      status.innerText = solveTime !== undefined ? formatTime(solveTime) : 'Solved';
    } else if (isInProgress) {
      status.innerText = 'In Progress';
    } else {
      status.innerText = 'Unsolved';
    }
    card.appendChild(status);

    card.addEventListener('click', () => {
      selectAndPlayPuzzle(num);
    });

    carouselEl.appendChild(card);
  }

  // Update action panel buttons & info card
  updatePlayButtonsUI();
}

function updatePlayButtonsUI() {
  const titleEl = document.getElementById('info-card-title');
  const statusEl = document.getElementById('info-card-status');
  const primaryPlayBtn = document.getElementById('primary-play-btn');
  
  if (!primaryPlayBtn) return;

  const currentDiff = state.difficulty;
  const currentNum = state.puzzleNumber;
  const completed = currentDiff === 'easy' ? state.stats.completedEasy : (currentDiff === 'medium' ? state.stats.completedMedium : state.stats.completedHard);
  const isCompleted = completed.includes(currentNum);

  // Update Details Card Info
  if (titleEl) {
    const capitalizedDiff = currentDiff.charAt(0).toUpperCase() + currentDiff.slice(1);
    titleEl.innerText = `${capitalizedDiff} Puzzle #${currentNum}`;
  }

  // Load Saved Game Info
  let savedPuzzle = null;
  let savedDifficulty = null;
  let savedTimer = 0;
  let savedInProgress = false;

  const savedStateStr = localStorage.getItem('sudoku_grandpa_state');
  if (savedStateStr) {
    try {
      const savedData = JSON.parse(savedStateStr);
      savedPuzzle = savedData.puzzleNumber;
      savedDifficulty = savedData.difficulty;
      savedTimer = savedData.timer || 0;
      savedInProgress = savedData.gameInProgress ?? false;
    } catch (e) {}
  }

  const isInProgress = savedInProgress && savedPuzzle === currentNum && savedDifficulty === currentDiff;

  if (statusEl) {
    if (isCompleted) {
      const times = currentDiff === 'easy' ? state.stats.timesEasy : state.stats.timesMedium;
      const solveTime = times[currentNum];
      statusEl.innerText = solveTime !== undefined ? `Solved in ${formatTime(solveTime)}` : 'Solved';
      statusEl.style.color = 'var(--text-user)';
    } else if (isInProgress) {
      statusEl.innerText = `In Progress (${formatTime(savedTimer)})`;
      statusEl.style.color = '#d97706';
    } else {
      statusEl.innerText = 'Unsolved';
      statusEl.style.color = 'var(--text-muted)';
    }
  }

  // Configure Primary Button
  if (isInProgress) {
    primaryPlayBtn.innerHTML = `▶ Resume Game`;
  } else {
    primaryPlayBtn.innerHTML = `▶ Start Puzzle #${currentNum}`;
  }
}

let carouselRenderTimeout = null;
function updatePuzzleNumberUI(immediate = false) {
  // Update the bottom play button/status details immediately for instant user feedback
  updatePlayButtonsUI();

  // If the target card is already rendered, update its active styling and scroll it into view immediately
  const carouselEl = document.getElementById('puzzle-carousel');
  if (carouselEl) {
    const prevActive = carouselEl.querySelector('.puzzle-card.active');
    if (prevActive) {
      prevActive.classList.remove('active');
    }
    const newActive = carouselEl.querySelector(`.puzzle-card[data-num="${state.puzzleNumber}"]`);
    if (newActive) {
      newActive.classList.add('active');
      newActive.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  // Debounce the heavy full DOM rebuild and dynamic puzzle generation (prevents freeze on fast clicks)
  if (carouselRenderTimeout) {
    clearTimeout(carouselRenderTimeout);
  }

  if (immediate) {
    renderCarousel();
    setTimeout(centerActiveCard, 50);
  } else {
    carouselRenderTimeout = setTimeout(() => {
      renderCarousel();
      setTimeout(centerActiveCard, 50);
    }, 150);
  }
}

function showModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.add('active');
}

function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.remove('active');
}

function showConfirmDialog(title, message, okText = 'Discard & Start') {
  return new Promise((resolve) => {
    const dialog = document.getElementById('confirm-dialog');
    const titleEl = document.getElementById('confirm-title');
    const bodyEl = document.getElementById('confirm-body');
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    const okBtn = document.getElementById('confirm-ok-btn');

    if (!dialog || !cancelBtn || !okBtn) {
      // Fallback to native confirm if elements are missing
      resolve(confirm(message));
      return;
    }

    if (titleEl) titleEl.innerText = title;
    if (bodyEl) bodyEl.innerText = message;
    if (okBtn) okBtn.innerText = okText;

    const cleanupAndResolve = (result) => {
      cancelBtn.removeEventListener('click', handleCancel);
      okBtn.removeEventListener('click', handleOk);
      closeModal(dialog);
      resolve(result);
    };

    const handleCancel = () => {
      playSound('click');
      cleanupAndResolve(false);
    };

    const handleOk = () => {
      playSound('click');
      cleanupAndResolve(true);
    };

    cancelBtn.addEventListener('click', handleCancel);
    okBtn.addEventListener('click', handleOk);

    showModal(dialog);
  });
}

function launchPuzzleGame() {
  const num = state.puzzleNumber;
  
  // Check if they are resuming the saved puzzle (i.e. puzzle, difficulty and gameInProgress are set)
  const savedStateStr = localStorage.getItem('sudoku_grandpa_state');
  let isSameAsSaved = false;
  let savedPuzzle = null;
  let savedDifficulty = null;
  let savedInProgress = false;
  if (savedStateStr) {
    try {
      const savedData = JSON.parse(savedStateStr);
      savedPuzzle = savedData.puzzleNumber;
      savedDifficulty = savedData.difficulty;
      savedInProgress = savedData.gameInProgress ?? false;
      if (savedPuzzle === num && savedDifficulty === state.difficulty && savedInProgress) {
        isSameAsSaved = true;
      }
    } catch (e) {}
  }

  if (isSameAsSaved) {
    playSound('click');
    showGame();
  } else {
    // Start a new game on this seed
    if (state.gameInProgress || savedInProgress) {
      const activeNum = savedPuzzle || state.puzzleNumber;
      const activeDiff = savedDifficulty || state.difficulty;
      const capitalizedDiff = activeDiff.charAt(0).toUpperCase() + activeDiff.slice(1);
      const targetDiffLabel = state.difficulty.charAt(0).toUpperCase() + state.difficulty.slice(1);
      
      showConfirmDialog(
        'Discard Progress?',
        `Discard your current game progress on ${capitalizedDiff} Puzzle #${activeNum} and start a new game on ${targetDiffLabel} Puzzle #${num}?`,
        'Discard & Start'
      ).then((confirmed) => {
        if (confirmed) {
          state.gameInProgress = false;
          startNewGame();
        }
      });
    } else {
      startNewGame();
    }
  }
}

// --- VIEW ROUTING & SCREEN TRANSITIONS ---

function showDashboard() {
  state.currentView = 'dashboard';
  stopTimer();
  
  if (state.gameInProgress) {
    saveGameData();
  }
  
  // Update state UI elements
  updateStatsDisplay();
  
  // Sync selected puzzle number selection
  const completed = state.difficulty === 'easy' ? state.stats.completedEasy : (state.difficulty === 'medium' ? state.stats.completedMedium : state.stats.completedHard);
  if (completed.includes(state.puzzleNumber)) {
    setNextUnsolvedPuzzle();
  } else {
    updatePuzzleNumberUI(true);
  }
  
  // Sync and update play buttons with dynamic informative text
  updatePlayButtonsUI();

  // Visual header greeting sync
  const greetingEl = document.getElementById('hub-greeting');
  greetingEl.innerText = state.playerName ? `Hello, ${state.playerName}!` : 'Hello, Player!';

  // Sync theme active bubbles
  document.querySelectorAll('.theme-bubble').forEach(b => {
    if (b.getAttribute('data-theme') === state.theme) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  // Sync sound toggle label
  const soundBtn = document.getElementById('sound-toggle-btn');
  soundBtn.innerText = state.soundMuted ? '🔇 Muted' : '🔊 Enabled';
  
  document.getElementById('game-view').classList.add('hidden');
  document.getElementById('dashboard-view').classList.remove('hidden');
  saveLobbySelection();
}

function showGame() {
  state.currentView = 'game';
  
  // Personalize title header: Name Sudoku - DIFFICULTY #PuzzleNumber
  const titleEl = document.getElementById('game-title');
  const formattedName = state.playerName ? `${state.playerName}'s` : 'Classic';
  const diffLabel = state.difficulty.toUpperCase();
  titleEl.innerText = `${formattedName} Sudoku - ${diffLabel} #${state.puzzleNumber}`;
  
  document.getElementById('dashboard-view').classList.add('hidden');
  document.getElementById('game-view').classList.remove('hidden');
  
  if (state.gameInProgress) {
    startTimer();
  }
  updateUI();
}

// --- STATS LOGIC ---

function loadStats() {
  try {
    const statsStr = localStorage.getItem('sudoku_grandpa_stats');
    if (statsStr) {
      const parsed = JSON.parse(statsStr);
      if (parsed && typeof parsed === 'object') {
        state.stats = {
          completedEasy: Array.isArray(parsed.completedEasy) ? parsed.completedEasy : [],
          completedMedium: Array.isArray(parsed.completedMedium) ? parsed.completedMedium : [],
          completedHard: Array.isArray(parsed.completedHard) ? parsed.completedHard : [],
          bestEasy: typeof parsed.bestEasy === 'number' ? parsed.bestEasy : null,
          bestMedium: typeof parsed.bestMedium === 'number' ? parsed.bestMedium : null,
          bestHard: typeof parsed.bestHard === 'number' ? parsed.bestHard : null,
          timesEasy: (parsed.timesEasy && typeof parsed.timesEasy === 'object') ? parsed.timesEasy : {},
          timesMedium: (parsed.timesMedium && typeof parsed.timesMedium === 'object') ? parsed.timesMedium : {},
          timesHard: (parsed.timesHard && typeof parsed.timesHard === 'object') ? parsed.timesHard : {}
        };
        return;
      }
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
  // Fallback to default
  state.stats = {
    completedEasy: [],
    completedMedium: [],
    completedHard: [],
    bestEasy: null,
    bestMedium: null,
    bestHard: null,
    timesEasy: {},
    timesMedium: {},
    timesHard: {}
  };
}

function saveStats() {
  localStorage.setItem('sudoku_grandpa_stats', JSON.stringify(state.stats));
}

function formatTime(seconds) {
  if (seconds === null || seconds === undefined) return '--:--';
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

function updateStatsDisplay() {
  const easyCount = state.stats.completedEasy ? state.stats.completedEasy.length : 0;
  const medCount = state.stats.completedMedium ? state.stats.completedMedium.length : 0;
  const hardCount = state.stats.completedHard ? state.stats.completedHard.length : 0;
  
  document.getElementById('stat-easy-solved').innerText = `${easyCount} / 1000`;
  document.getElementById('stat-medium-solved').innerText = `${medCount} / 1000`;
  document.getElementById('stat-hard-solved').innerText = `${hardCount} / 1000`;
  
  const bestTimesVal = `Easy: ${formatTime(state.stats.bestEasy)}\nMed: ${formatTime(state.stats.bestMedium)}\nHard: ${formatTime(state.stats.bestHard)}`;
  document.getElementById('stat-best-times').innerText = bestTimesVal;
}

function recordGameWin(difficulty, elapsedSeconds, puzzleNum) {
  if (difficulty === 'easy') {
    if (!state.stats.completedEasy.includes(puzzleNum)) {
      state.stats.completedEasy.push(puzzleNum);
    }
    if (state.stats.bestEasy === null || elapsedSeconds < state.stats.bestEasy) {
      state.stats.bestEasy = elapsedSeconds;
    }
    // Store solve time per puzzle (keep best time if replayed)
    const prevTime = state.stats.timesEasy[puzzleNum];
    if (prevTime === undefined || elapsedSeconds < prevTime) {
      state.stats.timesEasy[puzzleNum] = elapsedSeconds;
    }
  } else if (difficulty === 'medium') {
    if (!state.stats.completedMedium.includes(puzzleNum)) {
      state.stats.completedMedium.push(puzzleNum);
    }
    if (state.stats.bestMedium === null || elapsedSeconds < state.stats.bestMedium) {
      state.stats.bestMedium = elapsedSeconds;
    }
    // Store solve time per puzzle (keep best time if replayed)
    const prevTime = state.stats.timesMedium[puzzleNum];
    if (prevTime === undefined || elapsedSeconds < prevTime) {
      state.stats.timesMedium[puzzleNum] = elapsedSeconds;
    }
  } else if (difficulty === 'hard') {
    if (!state.stats.completedHard.includes(puzzleNum)) {
      state.stats.completedHard.push(puzzleNum);
    }
    if (state.stats.bestHard === null || elapsedSeconds < state.stats.bestHard) {
      state.stats.bestHard = elapsedSeconds;
    }
    // Store solve time per puzzle (keep best time if replayed)
    const prevTime = state.stats.timesHard[puzzleNum];
    if (prevTime === undefined || elapsedSeconds < prevTime) {
      state.stats.timesHard[puzzleNum] = elapsedSeconds;
    }
  }
  
  saveStats();
  updateStatsDisplay();
}

// --- GAME LOGIC & ACTIONS ---

function pushHistory() {
  const boardSnapshot = [...state.board];
  const notesSnapshot = state.notes.map(arr => [...arr]);
  state.history.push({ board: boardSnapshot, notes: notesSnapshot });
  if (state.history.length > 50) state.history.shift();
}

function setCellValue(val) {
  // Bug fix: only accept inputs during active play
  if (!state.gameInProgress || state.selectedCell === null) return;
  const idx = state.selectedCell;

  if (state.initialBoard[idx] !== 0) return;

  pushHistory();

  if (state.checkedErrors) {
    state.checkedErrors[idx] = false;
  }

  if (state.notesMode) {
    if (val === 0) {
      state.notes[idx] = Array(10).fill(false);
    } else {
      state.notes[idx][val] = !state.notes[idx][val];
      state.board[idx] = 0; 
    }
    playSound('notes');
  } else {
    state.board[idx] = val;
    state.notes[idx] = Array(10).fill(false); 
    
    if (val !== 0) {
      playSound('click');
    } else {
      playSound('erase');
    }
  }

  updateUI();

  saveGameData();
  checkWinCondition();
}

function createParticleBurst(cellIdx) {
  const cellEl = document.getElementById(`cell-${cellIdx}`);
  if (!cellEl) return;

  const particleCount = 16;
  const colors = ['#3b82f6', '#10b981', '#fbbf24', '#ef4444', '#a855f7', '#ec4899', '#06b6d4', '#f97316'];

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.classList.add('cell-particle');

    // Randomize angle and distance
    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 50; // Fly distance (40px to 90px)
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    // Set translation targets as CSS variables
    particle.style.setProperty('--x', `${x}px`);
    particle.style.setProperty('--y', `${y}px`);

    // Styling
    const size = 5 + Math.random() * 7; // Size (5px to 12px)
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;

    // Randomize background color
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    particle.style.setProperty('--particle-color', randomColor);

    // Randomize shape (50% circle, 30% square, 20% triangle)
    const shapeRand = Math.random();
    if (shapeRand < 0.5) {
      particle.style.borderRadius = '50%'; // Circle
    } else if (shapeRand < 0.8) {
      particle.style.borderRadius = '2px'; // Rounded Square
    } else {
      // Triangle using clip-path
      particle.style.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
    }

    // Add a tiny random delay to make the burst look natural
    const delay = Math.random() * 0.1;
    particle.style.animationDelay = `${delay}s`;

    cellEl.appendChild(particle);

    // Auto-cleanup DOM after animation finishes
    setTimeout(() => {
      particle.remove();
    }, 800);
  }
}


function handleUndo() {
  if (!state.gameInProgress || state.history.length === 0) return;
  const prevState = state.history.pop();
  state.board = prevState.board;
  state.notes = prevState.notes;
  
  playSound('click');
  updateUI();
  saveGameData();
}

function handleErase() {
  setCellValue(0);
}

function handleCheckErrors() {
  if (!state.gameInProgress) return;

  let hasErrors = false;
  let hasUserValues = false;

  state.checkedErrors.fill(false);

  for (let i = 0; i < 81; i++) {
    if (state.initialBoard[i] === 0 && state.board[i] !== 0) {
      hasUserValues = true;
      if (state.board[i] !== state.solutionBoard[i]) {
        state.checkedErrors[i] = true;
        hasErrors = true;
      }
    }
  }

  updateUI();
  saveGameData();

  if (hasErrors) {
    playSound('error');
  } else if (hasUserValues) {
    playSound('notes');
    for (let i = 0; i < 81; i++) {
      if (state.initialBoard[i] === 0 && state.board[i] !== 0) {
        const cellEl = document.getElementById(`cell-${i}`);
        if (cellEl) {
          cellEl.classList.add('check-correct');
          setTimeout(() => {
            cellEl.classList.remove('check-correct');
          }, 1500);
        }
      }
    }
  }
}

function handleCellSelect(idx) {
  // Bug fix: only select cells when playing
  if (!state.gameInProgress) return;
  state.selectedCell = idx;
  playSound('click');
  updateUI();
}

function checkWinCondition() {
  if (state.board.includes(0)) return;

  const errors = findErrors(state.board);
  if (errors.length > 0) return;

  for (let i = 0; i < 81; i++) {
    if (state.board[i] !== state.solutionBoard[i]) return;
  }

  handleGameWin();
}

function devCompleteGame() {
  if (!state.gameInProgress) return;
  state.board = [...state.solutionBoard];
  updateUI();
  checkWinCondition();
}

function handleGameWin() {
  stopTimer();
  state.gameInProgress = false;
  playSound('success');
  startConfetti();

  // Save statistics
  recordGameWin(state.difficulty, state.timer, state.puzzleNumber);

  const formattedName = state.playerName ? state.playerName : 'Player';
  const winTitle = document.getElementById('win-title');
  const winMessage = document.getElementById('win-message');
  
  winTitle.innerText = `Victory, ${formattedName}!`;
  winMessage.innerHTML = `You completed the <b>${state.difficulty}</b> puzzle in <b>${formatTime(state.timer)}</b>. Your mind is as sharp as ever!`;

  // Delete current save state so player doesn't resume a completed board
  localStorage.removeItem('sudoku_grandpa_state');
  
  setTimeout(() => {
    showModal(document.getElementById('win-dialog'));
  }, 600);
}

// --- STATE PERSISTENCE (auto-save) ---

function saveLobbySelection() {
  const lobbyData = {
    difficulty: state.difficulty,
    puzzleNumber: state.puzzleNumber,
    theme: state.theme,
    soundMuted: state.soundMuted,
    playerName: state.playerName
  };
  localStorage.setItem('sudoku_grandpa_lobby', JSON.stringify(lobbyData));
}

function loadLobbySelection() {
  try {
    const lobbyStr = localStorage.getItem('sudoku_grandpa_lobby');
    if (lobbyStr) {
      const lobbyData = JSON.parse(lobbyStr);
      if (lobbyData && typeof lobbyData === 'object') {
        state.difficulty = lobbyData.difficulty || 'medium';
        state.puzzleNumber = lobbyData.puzzleNumber || 1;
        state.theme = lobbyData.theme || 'paper';
        state.soundMuted = lobbyData.soundMuted ?? false;
        state.playerName = lobbyData.playerName || '';
        return true;
      }
    }
  } catch (err) {
    console.error('Failed to load lobby selection:', err);
  }
  return false;
}

function saveGameData() {
  const gameData = {
    board: state.board,
    initialBoard: state.initialBoard,
    solutionBoard: state.solutionBoard,
    notes: state.notes,
    checkedErrors: state.checkedErrors,
    timer: state.timer,
    difficulty: state.difficulty,
    gameInProgress: state.gameInProgress,
    puzzleNumber: state.puzzleNumber
  };
  localStorage.setItem('sudoku_grandpa_state', JSON.stringify(gameData));
}

function loadGameData() {
  // 1. Load settings and lobby selection first
  loadLobbySelection();

  // 2. Load active game progress if it exists
  try {
    const dataStr = localStorage.getItem('sudoku_grandpa_state');
    if (dataStr) {
      const gameData = JSON.parse(dataStr);
      if (gameData && typeof gameData === 'object' && Array.isArray(gameData.board) && gameData.board.length === 81) {
        state.board = gameData.board;
        state.initialBoard = gameData.initialBoard || [...gameData.board];
        state.solutionBoard = gameData.solutionBoard || [];
        state.notes = gameData.notes || Array(81).fill(null).map(() => Array(10).fill(false));
        state.checkedErrors = gameData.checkedErrors || Array(81).fill(false);
        state.timer = gameData.timer || 0;
        state.gameInProgress = gameData.gameInProgress ?? false;
        
        // If a game is in progress, sync the lobby selection to it on load
        if (state.gameInProgress) {
          state.puzzleNumber = gameData.puzzleNumber || 1;
          state.difficulty = gameData.difficulty || 'medium';
        }
      } else {
        localStorage.removeItem('sudoku_grandpa_state');
      }
    }
  } catch (err) {
    console.error('Failed to load saved game state:', err);
    localStorage.removeItem('sudoku_grandpa_state');
  }
  
  document.body.setAttribute('data-theme', state.theme);
  updateDifficultyTabsUI();
}

function updateDifficultyTabsUI() {
  document.querySelectorAll('.diff-tab-btn').forEach(btn => {
    if (btn.getAttribute('data-diff') === state.difficulty) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// --- TIMER CONTROLS ---

function startTimer() {
  stopTimer();
  state.timerInterval = setInterval(() => {
    state.timer++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function updateTimerDisplay() {
  document.getElementById('timer-display').innerText = formatTime(state.timer);
}

// --- UI RENDERING ---

function updateUI() {
  const boardEl = document.getElementById('sudoku-board');
  boardEl.innerHTML = '';

  const errors = findErrors(state.board);
  const selectedRow = state.selectedCell !== null ? Math.floor(state.selectedCell / 9) : null;
  const selectedCol = state.selectedCell !== null ? state.selectedCell % 9 : null;
  const selectedBoxRow = selectedRow !== null ? Math.floor(selectedRow / 3) * 3 : null;
  const selectedBoxCol = selectedCol !== null ? Math.floor(selectedCol / 3) * 3 : null;
  const selectedVal = state.selectedCell !== null ? state.board[state.selectedCell] : 0;

  for (let i = 0; i < 81; i++) {
    const val = state.board[i];
    const isGiven = state.initialBoard[i] !== 0;
    const isError = errors.includes(i);
    const isCheckError = state.checkedErrors && state.checkedErrors[i];
    
    const cellEl = document.createElement('div');
    cellEl.classList.add('cell');
    
    // Add checkerboard block shading (blocks 0, 2, 4, 6, 8 are shaded)
    const row = Math.floor(i / 9);
    const col = i % 9;
    const blockRow = Math.floor(row / 3);
    const blockCol = Math.floor(col / 3);
    if ((blockRow + blockCol) % 2 === 0) {
      cellEl.classList.add('shaded-block');
    }
    
    cellEl.id = `cell-${i}`;
    cellEl.setAttribute('role', 'gridcell');
    cellEl.setAttribute('aria-label', `Cell ${Math.floor(i / 9) + 1}, ${(i % 9) + 1}`);

    if (isGiven) {
      cellEl.classList.add('given');
      cellEl.innerText = val;
    } else if (val !== 0) {
      cellEl.classList.add('user-value');
      cellEl.innerText = val;
    } else {
      const notesGrid = document.createElement('div');
      notesGrid.classList.add('notes-grid');
      for (let n = 1; n <= 9; n++) {
        const noteSpan = document.createElement('span');
        noteSpan.classList.add('note-num');
        noteSpan.innerText = n;
        if (state.notes[i][n]) {
          noteSpan.classList.add('active');
        }
        notesGrid.appendChild(noteSpan);
      }
      cellEl.appendChild(notesGrid);
    }

    // Highlighting
    if (state.selectedCell === i) {
      cellEl.classList.add('selected');
    } else if (selectedRow !== null) {
      const row = Math.floor(i / 9);
      const col = i % 9;
      const boxRow = Math.floor(row / 3) * 3;
      const boxCol = Math.floor(col / 3) * 3;

      const isSameRow = row === selectedRow;
      const isSameCol = col === selectedCol;
      const isSameBox = boxRow === selectedBoxRow && boxCol === selectedBoxCol;

      if (isSameRow || isSameCol || isSameBox) {
        cellEl.classList.add('highlight-peer');
      }

      if (val !== 0 && val === selectedVal) {
        cellEl.classList.add('highlight-match');
      }
    }

    if (isError) {
      cellEl.classList.add('error');
    }

    if (isCheckError) {
      cellEl.classList.add('check-error');
    }

    cellEl.addEventListener('click', () => handleCellSelect(i));
    boardEl.appendChild(cellEl);
  }

  renderNumpad();

  document.getElementById('undo-btn').disabled = state.history.length === 0;
  
  const pencilBtn = document.getElementById('pencil-btn');
  if (state.notesMode) {
    pencilBtn.classList.add('toggle-active');
  } else {
    pencilBtn.classList.remove('toggle-active');
  }


}

function renderNumpad() {
  const numpadEl = document.getElementById('numpad');
  numpadEl.innerHTML = '';

  const counts = Array(10).fill(0);
  for (let i = 0; i < 81; i++) {
    const val = state.board[i];
    if (val !== 0 && state.solutionBoard[i] === val) {
      counts[val]++;
    }
  }

  for (let i = 1; i <= 9; i++) {
    const btn = document.createElement('button');
    btn.classList.add('numpad-btn');
    const numVal = document.createElement('span');
    numVal.classList.add('numpad-val');
    numVal.innerText = i;
    btn.appendChild(numVal);

    const remaining = 9 - counts[i];
    const countDot = document.createElement('span');
    countDot.classList.add('count-dot');
    countDot.innerText = remaining > 0 ? `${remaining} left` : '✓';
    btn.appendChild(countDot);

    if (remaining === 0) {
      btn.classList.add('completed');
    }

    btn.addEventListener('click', () => setCellValue(i));
    numpadEl.appendChild(btn);
  }
}

// --- CONTROLLER ACTIONS ---

function startNewGame() {
  stopConfetti();
  
  // Switch to game view and prepare generation message
  showGame();

  
  setTimeout(() => {
    const { puzzle, solved } = generatePuzzle(state.difficulty, state.puzzleNumber);
    state.initialBoard = [...puzzle];
    state.board = [...puzzle];
    state.solutionBoard = [...solved];
    state.notes = Array(81).fill(null).map(() => Array(10).fill(false));
    state.checkedErrors = Array(81).fill(false);
    state.history = [];
    state.selectedCell = null;
    
    state.timer = 0;
    state.gameInProgress = true;
    
    startTimer();
    updateTimerDisplay();
    updateUI();
    saveGameData();
  }, 60);
}

// --- SETUP EVENT LISTENERS & INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
  // Load Stats
  loadStats();
  
  // A. Hub / Dashboard View Event Listeners
  
  // Difficulty Tab buttons
  document.querySelectorAll('.diff-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      state.difficulty = e.target.getAttribute('data-diff');
      playSound('click');
      updateDifficultyTabsUI();
      setNextUnsolvedPuzzle(); // Load next unsolved puzzle for this difficulty
      saveLobbySelection();
    });
  });

  // Theme bubbles
  document.querySelectorAll('.theme-bubble').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const selectedTheme = e.target.getAttribute('data-theme');
      state.theme = selectedTheme;
      document.body.setAttribute('data-theme', selectedTheme);
      playSound('click');
      
      // Update UI active bubble
      document.querySelectorAll('.theme-bubble').forEach(b => {
        b.classList.remove('active');
      });
      e.target.classList.add('active');
      
      saveLobbySelection();
    });
  });

  // Sound toggle
  const soundBtn = document.getElementById('sound-toggle-btn');
  soundBtn.addEventListener('click', () => {
    state.soundMuted = !state.soundMuted;
    soundBtn.innerText = state.soundMuted ? '🔇 Muted' : '🔊 Enabled';
    playSound('click');
    saveLobbySelection();
  });

  // Puzzle carousel navigation arrows
  document.getElementById('carousel-prev-btn').addEventListener('click', () => {
    if (state.puzzleNumber > 1) {
      state.puzzleNumber--;
      playSound('click');
      updatePuzzleNumberUI();
      saveLobbySelection();
    }
  });

  document.getElementById('carousel-next-btn').addEventListener('click', () => {
    if (state.puzzleNumber < 1000) {
      state.puzzleNumber++;
      playSound('click');
      updatePuzzleNumberUI();
      saveLobbySelection();
    }
  });



  // Action Panel Play button
  document.getElementById('primary-play-btn').addEventListener('click', () => {
    launchPuzzleGame();
  });

  // Change Name (from Hub)
  const nameDialog = document.getElementById('name-dialog');
  document.getElementById('hub-change-name-btn').addEventListener('click', () => {
    playSound('click');
    document.getElementById('name-input').value = state.playerName;
    showModal(nameDialog);
  });

  // Reset Stats Button
  document.getElementById('reset-stats-btn').addEventListener('click', () => {
    showConfirmDialog(
      'Reset All Stats?',
      'Are you absolutely sure you want to reset all your stats and best times? This will also discard any active game in progress.',
      'Reset Stats'
    ).then((confirmed) => {
      if (confirmed) {
        playSound('erase');
        state.stats = {
          completedEasy: [],
          completedMedium: [],
          completedHard: [],
          bestEasy: null,
          bestMedium: null,
          bestHard: null,
          timesEasy: {},
          timesMedium: {},
          timesHard: {}
        };
        state.gameInProgress = false;
        state.timer = 0;
        localStorage.removeItem('sudoku_grandpa_state');
        saveStats();
        updateStatsDisplay();
        setNextUnsolvedPuzzle();
      }
    });
  });

  // B. Active Game View Event Listeners
  
  // Exit to Hub button
  document.getElementById('exit-to-hub-btn').addEventListener('click', () => {
    playSound('click');
    showDashboard();
  });

  // Restart this puzzle button
  document.getElementById('restart-game-btn').addEventListener('click', () => {
    if (!state.gameInProgress) return;
    showConfirmDialog(
      'Restart Puzzle?',
      'Restart this puzzle from the beginning?',
      'Restart'
    ).then((confirmed) => {
      if (confirmed) {
        playSound('erase');
        pushHistory();
        state.board = [...state.initialBoard];
        state.notes = Array(81).fill(null).map(() => Array(10).fill(false));
        state.checkedErrors.fill(false);
        state.selectedCell = null;
        state.timer = 0;
        updateTimerDisplay();
        updateUI();
        saveGameData();
      }
    });
  });

  // New Game (from Game View Header)


  // Keyboard Controls for Testing & Power Users
  document.addEventListener('keydown', (e) => {
    // Only accept keyboard inputs when in the active game screen
    if (state.currentView !== 'game' || !state.gameInProgress || state.selectedCell === null) return;
    
    if (e.key >= '1' && e.key <= '9') {
      setCellValue(parseInt(e.key));
    } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      handleErase();
    } else if (e.key.toLowerCase() === 'n') {
      state.notesMode = !state.notesMode;
      playSound('click');
      updateUI();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      handleUndo();
    } else if (e.key === 'ArrowUp') {
      const idx = state.selectedCell;
      if (idx >= 9) handleCellSelect(idx - 9);
    } else if (e.key === 'ArrowDown') {
      const idx = state.selectedCell;
      if (idx < 72) handleCellSelect(idx + 9);
    } else if (e.key === 'ArrowLeft') {
      const idx = state.selectedCell;
      if (idx % 9 > 0) handleCellSelect(idx - 1);
    } else if (e.key === 'ArrowRight') {
      const idx = state.selectedCell;
      if (idx % 9 < 8) handleCellSelect(idx + 1);
    }
  });

  // Game buttons hooks
  document.getElementById('undo-btn').addEventListener('click', handleUndo);
  document.getElementById('pencil-btn').addEventListener('click', () => {
    if (!state.gameInProgress) return;
    state.notesMode = !state.notesMode;
    playSound('click');
    updateUI();
  });
  document.getElementById('erase-btn').addEventListener('click', handleErase);
  document.getElementById('check-btn').addEventListener('click', handleCheckErrors);


  // C. Dialog overlay actions
  
  // Name dialog response handler
  const nameForm = document.getElementById('name-form');
  if (nameForm) {
    nameForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameVal = document.getElementById('name-input').value.trim();
      state.playerName = nameVal ? nameVal : 'Player';
      saveLobbySelection();
      closeModal(nameDialog);
      showDashboard();
    });
  }

  // Win dialog Play Again handler
  const winDialog = document.getElementById('win-dialog');
  document.getElementById('win-close-btn').addEventListener('click', () => {
    closeModal(winDialog);
    stopConfetti();
    showDashboard();
  });

  // --- SERVICE WORKER PWA BOOTSTRAP & AUTO-UPDATE ---
  if ('serviceWorker' in navigator) {
    let newWorker;
    let refreshing = false;

    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        console.log('PWA Service Worker registered:', reg.scope);

        // Check for updates on startup
        reg.update();

        // Listen for new worker installing
        reg.addEventListener('updatefound', () => {
          newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New worker is installed but waiting (skipWaiting needs to be called)
                showUpdateBanner(newWorker);
              }
            }
          });
        });
      })
      .catch((err) => console.error('PWA Service Worker registration failed:', err));

    // Listen for controller changes (when new worker takes over) and reload the page
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    function showUpdateBanner(worker) {
      const banner = document.getElementById('update-banner');
      const updateBtn = document.getElementById('update-btn');
      if (banner && updateBtn) {
        banner.classList.remove('hidden');
        updateBtn.onclick = () => {
          playSound('click');
          worker.postMessage({ action: 'skipWaiting' });
        };
      }
    }
  }

  // --- INITIALIZE VIEWS ---
  const loaded = loadGameData();
  
  if (state.playerName) {
    // Re-engage theme properties
    document.body.setAttribute('data-theme', state.theme);
    // Show Dashboard on load
    showDashboard();
  } else {
    // Force prompt name dialog for new users
    showModal(nameDialog);
  }
});
