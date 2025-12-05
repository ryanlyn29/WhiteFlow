/**
 * POMODORO TIMER - SOCKET SYNCED + LOCAL PERSISTENCE + GAME HOOKS
 * 
 * Features:
 * 1. Global Sync: Actions (Start/Stop) are sent to server.
 * 2. Persistence: Local UI state (open/closed) is saved; Server state (time) is synced.
 * 3. Adaptive Sizing: Expands correctly for games using the Hooks from the old version.
 */

window.initPomodoro = function() {
    console.log("Initializing Socket-Synced Pomodoro Timer (v3 - Fixes Applied)...");
    
    // Attempt to locate the global socket object (usually on window.socket or via Games)
    const socket = window.socket || (window.Games ? window.Games.socket : null);
    const boardId = window.currentBoardId || (new URLSearchParams(window.location.search).get('room'));

    if (!socket) {
        console.warn("Socket not found. Pomodoro running in local-only mode (No Sync).");
    }

    // --- 1. GLOBAL CLEANUP ---
    if (window.pomodoroIntervalId) {
        clearInterval(window.pomodoroIntervalId);
        window.pomodoroIntervalId = null;
    }

    // --- 2. DOM ELEMENTS ---
    const pomodoroContainer = document.getElementById('pomodoro-container');
    const collapsedButton = document.getElementById('pomodoro-toggle-collapsed');
    const collapsedTimerDisplay = document.getElementById('collapsed-timer-display');
    const collapsedStateIcon = document.getElementById('collapsed-state-icon');
    const expandedPanel = document.getElementById('pomodoro-expanded');
    const closeButton = document.getElementById('pomodoro-toggle-expanded');
    const timerDisplay = document.getElementById('timer-display');
    const startStopButton = document.getElementById('pomodoro-start-stop');
    const resetButton = document.getElementById('pomodoro-reset');
    const timerPhase = document.getElementById('timer-phase');
    const pomodoroCountDisplay = document.getElementById('pomodoro-count');
    
    // Game Toggle Elements
    const gamesToggleButton = document.getElementById('pomodoro-games-toggle');
    const timerView = document.getElementById('timer-view');
    const gameView = document.getElementById('game-view');

    if (!pomodoroContainer || !collapsedButton || !expandedPanel || !startStopButton) {
        console.warn("Pomodoro DOM elements missing. Aborting init.");
        return;
    }

    const startStopIcon = startStopButton.querySelector('i');

    // --- 3. CONSTANTS & CONFIG ---
    const CONFIG = {
        TIME_POMODORO: 25 * 60,
        TIME_SHORT_BREAK: 5 * 60,
        TIME_LONG_BREAK: 15 * 60,
        LONG_BREAK_INTERVAL: 4,
        STORAGE_KEY: 'pomodoro_ui_state' // Restored for local UI prefs
    };

    // --- 4. STATE MANAGEMENT ---
    let state = {
        currentPhase: 'pomodoro', 
        targetTime: null,         // Timestamp (Date.now() + remaining)
        remainingTime: CONFIG.TIME_POMODORO,
        isRunning: false,
        pomodoroCount: 0,
        isPomodoroOpen: false, // Local UI state
        isGameViewActive: false // Local UI state
    };

    // Initialize Games module without overriding board.js initialization
    // Copied from old-pomodoro.js to ensure Games can init DOM refs early
    if (window.Games && !window.Games.initialized) {
        window.Games.init(null, null, null); 
    }

    // --- 5. LOCAL PERSISTENCE (UI ONLY) ---
    // We only save/load UI state locally (open/close, game mode). 
    // Timer state comes from server (or defaults if local).
    const saveLocalState = () => {
        try {
            const uiState = {
                isPomodoroOpen: state.isPomodoroOpen,
                isGameViewActive: state.isGameViewActive
            };
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(uiState));
        } catch (e) { console.error("Save failed", e); }
    };

    const loadLocalState = () => {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                state.isPomodoroOpen = parsed.isPomodoroOpen || false;
                state.isGameViewActive = parsed.isGameViewActive || false;
            }
        } catch (e) { console.error("Load failed", e); }
    };

    // --- 6. UI UPDATES ---
    const formatTime = (seconds) => {
        if (seconds < 0) seconds = 0;
        const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        return `${minutes}:${secs}`;
    };

    const updateDisplay = () => {
        const time = formatTime(state.remainingTime);
        
        // Expanded display
        if (timerDisplay) timerDisplay.textContent = time;
        if (timerPhase) timerPhase.textContent = state.currentPhase.replace('-', ' ').toUpperCase();
        if (pomodoroCountDisplay) pomodoroCountDisplay.textContent = state.pomodoroCount;
        
        // Collapsed display
        if (collapsedTimerDisplay) collapsedTimerDisplay.textContent = time;
        
        // Icons
        if (state.isRunning) {
            if(startStopIcon) startStopIcon.className = "fa-solid fa-pause fa-lg";
            startStopButton.title = "Pause Timer (Global)";
            if (collapsedStateIcon) collapsedStateIcon.className = "fa-solid fa-pause text-red-500";
        } else {
            if(startStopIcon) startStopIcon.className = "fa-solid fa-play fa-lg ml-1";
            startStopButton.title = "Start Timer (Global)";
            if (collapsedStateIcon) collapsedStateIcon.className = "fa-solid fa-stopwatch text-red-500";
        }
        
        // Theme Colors
        const phaseColors = { 'pomodoro': 'text-red-400', 'short-break': 'text-green-400', 'long-break': 'text-blue-400' };
        timerPhase.classList.remove('text-red-400', 'text-green-400', 'text-blue-400');
        timerPhase.classList.add(phaseColors[state.currentPhase]);
    };

    const renderPomodoro = () => {
        // Dimensions
        const collapsedWidth = '120px'; 
        const collapsedHeight = '35.5px'; 
        const collapsedBorderRadius = '1.1rem';

        const expandedWidth = '320px'; // Timer View
        const expandedHeight = '380px'; 
        const expandedBorderRadius = '1.2rem'; 
        
        // Default Game Menu Size (fits 6 game cards comfortably)
        const defaultGameWidth = '450px';
        const defaultGameHeight = '550px';
        
        // LARGE Game Size (For Tic Tac Toe, RPS, Connect 4)
        const largeGameWidth = '700px';
        const largeGameHeight = '750px';

        pomodoroContainer.style.top = '7.5%';
        pomodoroContainer.style.left = '50%'; 
        pomodoroContainer.style.transform = 'translateX(-50%)'; 
        
        if (state.isPomodoroOpen) {
            // Expanded State - Determine Target Dimensions
            let targetWidth = expandedWidth;
            let targetHeight = expandedHeight;
            let targetRadius = expandedBorderRadius;

            if (state.isGameViewActive) {
                // Base size for Game Menu
                targetWidth = defaultGameWidth;
                targetHeight = defaultGameHeight;

                // Check active game for resizing
                if (window.Games && window.Games.activeGame) {
                    const activeId = window.Games.activeGame.id;
                    const largeGames = ['connect4', 'tictactoe', 'rps'];
                    
                    if (largeGames.includes(activeId)) {
                        targetWidth = largeGameWidth;
                        targetHeight = largeGameHeight;
                    }
                }
            }

            // Apply Dimensions
            pomodoroContainer.style.width = targetWidth;
            pomodoroContainer.style.height = targetHeight;
            pomodoroContainer.style.borderRadius = targetRadius;
            
            // Animation Visibility Logic (Restored from old version)
            collapsedButton.style.opacity = '0';
            collapsedButton.style.pointerEvents = 'none';
            
            expandedPanel.style.display = 'flex';
            // Double RAF for transition effect
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    expandedPanel.style.opacity = '1';
                    expandedPanel.style.pointerEvents = 'auto';
                    collapsedButton.style.display = 'none';
                });
            });

        } else {
            // Collapsed State
            pomodoroContainer.style.width = collapsedWidth;
            pomodoroContainer.style.height = collapsedHeight; 
            pomodoroContainer.style.borderRadius = collapsedBorderRadius; 

            expandedPanel.style.opacity = '0';
            expandedPanel.style.pointerEvents = 'none';
            
            setTimeout(() => {
                if (!state.isPomodoroOpen) {
                    expandedPanel.style.display = 'none';
                    collapsedButton.style.display = 'flex';
                    requestAnimationFrame(() => {
                        collapsedButton.style.opacity = '1';
                        collapsedButton.style.pointerEvents = 'auto';
                    });
                }
            }, 300);
        }
    };
    
    // CRITICAL: Expose for Games.js so it can call it when games start
    window.pomodoroResizeHandler = renderPomodoro;

    // --- 7. TICKER LOGIC ---
    const tick = () => {
        if (!state.isRunning) return;
        const now = Date.now();
        const secondsLeft = Math.ceil((state.targetTime - now) / 1000);
        state.remainingTime = secondsLeft;

        if (state.remainingTime <= 0) {
            state.remainingTime = 0;
            clearInterval(window.pomodoroIntervalId);
            window.pomodoroIntervalId = null;
            state.isRunning = false;
            
            handlePhaseEnd(); 
        } else {
            updateDisplay();
        }
    };

    // --- 8. ACTIONS (SEND TO SERVER) ---
    const toggleStartStop = () => {
        const action = state.isRunning ? 'pause' : 'start';
        if (socket && boardId) {
            socket.emit('pomodoro:action', { boardId, action });
        } else {
            // Local fallback
            if(action === 'start') { state.isRunning = true; state.targetTime = Date.now() + state.remainingTime*1000; window.pomodoroIntervalId = setInterval(tick, 1000); }
            else { state.isRunning = false; clearInterval(window.pomodoroIntervalId); }
            updateDisplay();
        }
    };

    const resetTimer = () => {
        const defaultTime = state.currentPhase === 'pomodoro' ? CONFIG.TIME_POMODORO : 
                           (state.currentPhase === 'short-break' ? CONFIG.TIME_SHORT_BREAK : CONFIG.TIME_LONG_BREAK);
        
        if (socket && boardId) {
            socket.emit('pomodoro:action', { 
                boardId, 
                action: 'reset',
                payload: { phase: state.currentPhase, time: defaultTime }
            });
        }
    };

    const handlePhaseEnd = () => {
        // Calculate next phase
        let nextPhase = state.currentPhase;
        let nextTime = CONFIG.TIME_POMODORO;
        
        if (state.currentPhase === 'pomodoro') {
            state.pomodoroCount++;
            if (state.pomodoroCount % CONFIG.LONG_BREAK_INTERVAL === 0) {
                nextPhase = 'long-break';
                nextTime = CONFIG.TIME_LONG_BREAK;
            } else {
                nextPhase = 'short-break';
                nextTime = CONFIG.TIME_SHORT_BREAK;
            }
            window.showCustomAlert("Pomodoro Complete!", "Break started.", "success");
        } else {
            nextPhase = 'pomodoro';
            nextTime = CONFIG.TIME_POMODORO;
            window.showCustomAlert("Break Over!", "Focus time.", "info");
        }

        // Send Sync to Server
        if (socket && boardId) {
            socket.emit('pomodoro:action', {
                boardId,
                action: 'sync',
                payload: {
                    phase: nextPhase,
                    remainingTime: nextTime,
                    isRunning: true 
                }
            });
        }
    };

    // --- 9. SOCKET LISTENERS ---
    if (socket) {
        socket.on('pomodoro:sync', (serverState) => {
            console.log("Syncing Pomodoro State:", serverState);
            // Update local state from server
            state.currentPhase = serverState.phase;
            state.remainingTime = serverState.remainingTime;
            state.isRunning = serverState.isRunning;
            
            // Clean existing interval
            if (window.pomodoroIntervalId) clearInterval(window.pomodoroIntervalId);
            
            if (state.isRunning) {
                // Determine target time relative to client clock based on remaining seconds
                state.targetTime = Date.now() + (state.remainingTime * 1000);
                window.pomodoroIntervalId = setInterval(tick, 1000);
            } else {
                window.pomodoroIntervalId = null;
            }
            
            updateDisplay();
        });
    }

    // --- 10. VIEW CONTROLS ---
    const toggleGameView = () => {
        state.isGameViewActive = !state.isGameViewActive;
        saveLocalState(); // Persist selection

        if (state.isGameViewActive) {
            timerView.classList.add('hidden');
            gameView.classList.remove('hidden');
            gameView.style.display = 'flex'; 
            if(window.Games && window.Games.enable) window.Games.enable();
            gamesToggleButton.classList.add('ring-2', 'ring-white');
        } else {
            gameView.classList.add('hidden');
            gameView.style.display = 'none';
            timerView.classList.remove('hidden');
            gamesToggleButton.classList.remove('ring-2', 'ring-white');
        }
        renderPomodoro();
    };

    const onPomodoroToggle = () => {
        state.isPomodoroOpen = !state.isPomodoroOpen;
        saveLocalState(); // Persist selection
        renderPomodoro();
    };

    // --- 11. HOOKS INTO GAME ENGINE (Restored from old version) ---
    // This allows the container to resize immediately when a game starts
    if (window.Games && !window.Games._pomodoroHooked) {
        const originalStart = window.Games.startGame;
        const originalStop = window.Games.stopActiveGame;

        window.Games.startGame = function(id) {
            originalStart.apply(window.Games, arguments);
            if (window.pomodoroResizeHandler) window.pomodoroResizeHandler();
        };

        window.Games.stopActiveGame = function() {
            originalStop.apply(window.Games, arguments);
            if (window.pomodoroResizeHandler) window.pomodoroResizeHandler();
        };

        window.Games._pomodoroHooked = true;
    }

    // Listeners
    collapsedButton.onclick = onPomodoroToggle;
    closeButton.onclick = onPomodoroToggle;
    startStopButton.onclick = toggleStartStop;
    resetButton.onclick = resetTimer;
    if(gamesToggleButton) gamesToggleButton.onclick = toggleGameView;

    // --- 12. INIT ---
    loadLocalState(); // Load UI prefs
    updateDisplay();
    renderPomodoro();
    
    // Resume View State if needed
    if (state.isGameViewActive) {
        timerView.classList.add('hidden');
        gameView.classList.remove('hidden');
        gameView.style.display = 'flex';
        gamesToggleButton.classList.add('ring-2', 'ring-white');
        if(window.Games && window.Games.enable) window.Games.enable();
    }

    console.log("Pomodoro Initialized.");
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initPomodoro);
} else {
    window.initPomodoro();
}
