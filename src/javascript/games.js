/**
 * games.js
 * Multiplayer Game Engine for Whiteflow.
 * 
 * Features:
 * - Server-Authoritative State Sync (Handling Reconnects).
 * - Profile Color Integration for Game Pieces.
 * - Ghost/Away Status Handling.
 */

const styleId = 'whiteflow-game-styles';
if (!document.getElementById(styleId)) {
    const gameStyles = document.createElement('style');
    gameStyles.id = styleId;
    gameStyles.innerHTML = `
    @keyframes softSlideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes popIn { 0% { transform: scale(0.5); } 80% { transform: scale(1.1); } 100% { transform: scale(1); } }
    .game-slot-active { border-color: #3b82f6 !important; background-color: rgba(59, 130, 246, 0.1) !important; }
    .game-slot-ghost { opacity: 0.5; filter: grayscale(1); }
    `;
    document.head.appendChild(gameStyles);
}

const Games = {
    socket: null,
    currentUser: null,
    boardId: null,
    activeGame: null,
    view: null,
    selector: null,
    container: null,
    backBtn: null,
    initialized: false,

    init(socket, user, boardId) {
        if (this.initialized && socket) {
            this.socket = socket;
            this.currentUser = user || this.currentUser;
            this.boardId = boardId || this.boardId;
            return;
        }

        if (this.initialized) return;
        
        this.socket = socket;
        this.currentUser = user || { id: 'guest', name: 'Guest', mouseColor: '#3b82f6' };
        this.boardId = boardId;

        this.view = document.getElementById('game-view');
        this.selector = document.getElementById('game-selector');
        this.container = document.getElementById('active-game-container');
        this.backBtn = document.getElementById('back-to-games-btn');

        if (!this.view) return;

        this.setupBackButton();
        this.renderMenu();
        
        // Listen for Server Restoration of Game State (Reconnects)
        if (this.socket) {
            this.socket.on('game:restore', (state) => {
                if (state && state.activeGameId) {
                    // Only auto-restore if we are in game view
                    if (this.view && !this.view.classList.contains('hidden') && !this.activeGame) {
                        this.startGame(state.activeGameId, true); // true = restore mode
                        setTimeout(() => {
                            if (this.activeGame && this.activeGame.applyState) {
                                this.activeGame.applyState(state);
                            }
                        }, 100);
                    }
                }
            });

            // Listen for user ghost status to update UI
            this.socket.on('user:ghost', (data) => {
                if (this.activeGame && this.activeGame.handleGhost) {
                    this.activeGame.handleGhost(data.userId, data.isGhost);
                }
            });
        }

        this.initialized = true;
    },

    enable() {
        if (!this.initialized) this.init(null, null, null);
        if (!this.activeGame) this.showMenu();
        else this.activeGame.emitResize();
    },

    setupBackButton() {
        if (!this.backBtn) return;
        const newBackBtn = this.backBtn.cloneNode(true);
        if(this.backBtn.parentNode) this.backBtn.parentNode.replaceChild(newBackBtn, this.backBtn);
        this.backBtn = newBackBtn;
        
        this.backBtn.className = "absolute top-4 left-4 z-20 text-xs font-medium text-gray-400 hover:text-white hidden flex items-center gap-2 bg-[#1a1b1d] border border-[#222426] px-3 py-1.5 rounded-full transition-colors hover:border-gray-600 cursor-pointer";
        this.backBtn.innerHTML = '<i class="fa-solid fa-arrow-left text-[10px]"></i> <span>Exit Game</span>';
        this.backBtn.onclick = () => {
            if (this.activeGame) {
                if(this.activeGame.onLeave) this.activeGame.onLeave();
                this.activeGame.destroy();
            }
            this.activeGame = null;
            this.showMenu();
        };
    },

    send(type, payload) {
        if (this.socket) {
            this.socket.emit('game:action', {
                boardId: this.boardId,
                userId: this.currentUser.id,
                userName: this.currentUser.name,
                userColor: this.currentUser.mouseColor, // Send color for consistency
                type: type,
                payload: payload
            });
        }
    },

    // Broadcast state for persistence when WE make a move that changes state
    persist(fullState) {
        if (this.socket) {
            this.socket.emit('game:persist_state', {
                boardId: this.boardId,
                fullState: {
                    activeGameId: this.activeGame.id,
                    ...fullState
                }
            });
        }
    },

    handleEvent(data) {
        if (this.activeGame && this.activeGame.onRemoteData) {
            this.activeGame.onRemoteData(data);
        }
    },

    dispatchResize(width, height) {
        const event = new CustomEvent('pomodoro-resize', { detail: { width, height } });
        window.dispatchEvent(event);
    },

    renderMenu() {
        if (!this.selector) return;
        this.selector.innerHTML = '';
        const games = [
            { id: 'connect4', name: 'Connect 4', icon: 'fa-circle-nodes', accent: 'text-blue-500', desc: '2 Player PvP' },
            { id: 'tictactoe', name: 'Tic Tac Toe', icon: 'fa-xmarks-lines', accent: 'text-cyan-400', desc: 'Classic PvP' },
            { id: 'rps', name: 'Rock Paper Scissors', icon: 'fa-hand-scissors', accent: 'text-yellow-400', desc: 'Quick PvP' },
            { id: 'match3', name: 'Candy Match', icon: 'fa-candy-cane', accent: 'text-pink-500', desc: 'Score Attack' },
            { id: 'memory', name: 'Memory', icon: 'fa-brain', accent: 'text-emerald-500', desc: 'Solo Puzzle' },
            { id: 'runner', name: 'Dino Run', icon: 'fa-dragon', accent: 'text-orange-500', desc: 'Endless' }
        ];

        games.forEach((g, index) => {
            const btn = document.createElement('button');
            btn.className = `flex-shrink-0 w-36 h-44 rounded-xl bg-[#1a1b1d] border border-[#222426] text-gray-300 hover:text-white hover:bg-[#222426] hover:border-gray-500 transition-all duration-200 flex flex-col items-center justify-center gap-2 animate-soft-slide group`;
            btn.style.animationDelay = `${index * 50}ms`;
            btn.innerHTML = `
                <i class="fa-solid ${g.icon} text-3xl mb-2 text-gray-500 group-hover:${g.accent} transition-colors"></i>
                <span class="text-sm font-bold tracking-wide">${g.name}</span>
                <span class="text-[10px] text-gray-500 uppercase tracking-widest">${g.desc}</span>
            `;
            btn.onclick = () => this.startGame(g.id);
            this.selector.appendChild(btn);
        });
        const spacer = document.createElement('div');
        spacer.className = 'w-2 flex-shrink-0';
        this.selector.appendChild(spacer);
    },

    showMenu() {
        this.selector.style.display = 'flex';
        this.container.style.display = 'none';
        if (this.backBtn) this.backBtn.style.display = 'none';
        this.dispatchResize('480px', '260px');
    },

    startGame(gameId, isRestore = false) {
        this.selector.style.display = 'none';
        this.container.style.display = 'flex';
        if (this.backBtn) this.backBtn.style.display = 'flex';
        this.container.innerHTML = '';
        this.container.className = "w-full h-full flex flex-col items-center justify-center p-2 animate-soft-slide";

        // Pass Send Wrapper that injects user color
        const emitFn = (t, p) => this.send(t, p);
        const persistFn = (s) => this.persist(s);

        switch(gameId) {
            case 'connect4':
                this.dispatchResize('520px', '600px');
                this.activeGame = new ConnectFour(this.container, this.currentUser, emitFn, persistFn);
                break;
            case 'tictactoe':
                this.dispatchResize('380px', '500px');
                this.activeGame = new TicTacToe(this.container, this.currentUser, emitFn, persistFn);
                break;
            case 'rps':
                this.dispatchResize('420px', '550px');
                this.activeGame = new RockPaperScissors(this.container, this.currentUser, emitFn, persistFn);
                break;
            case 'match3':
                this.dispatchResize('400px', '580px');
                this.activeGame = new MatchThree(this.container, this.currentUser);
                break;
            case 'memory':
                this.dispatchResize('400px', '500px');
                this.activeGame = new MemoryGame(this.container);
                break;
            case 'runner':
                this.dispatchResize('400px', '320px');
                this.activeGame = new DinoRunner(this.container);
                break;
        }

        // If not a restore (new click), request state from others just in case server is fresh
        if (!isRestore && this.activeGame && this.activeGame.emit) {
            this.activeGame.emit(this.activeGame.prefix + '_STATE_REQ', {});
        }
    }
};

/* =========================================
   BASE CLASS
   ========================================= */
class MultiplayerGame {
    constructor(root, currentUser, emitFn, persistFn) {
        this.root = root;
        this.currentUser = currentUser;
        this.emit = emitFn;
        this.persist = persistFn;
        this.players = { 1: null, 2: null };
        this.turn = 1;
        this.gameOver = false;
    }

    createPlayerSlot(bgClass, pid) {
        const el = document.createElement('div');
        el.className = 'flex flex-col items-center gap-2 p-3 rounded-lg border border-transparent transition-all duration-300';
        el.innerHTML = `
            <div class="avatar w-12 h-12 rounded-full ${bgClass} flex items-center justify-center text-black font-bold text-xl shadow-lg relative">
                <i class="fa-solid fa-user"></i>
                <div class="ghost-indicator absolute -top-1 -right-1 w-3 h-3 bg-gray-400 rounded-full hidden border-2 border-[#1a1b1d]" title="User is away"></div>
            </div>
            <div class="name text-xs text-gray-400 font-bold uppercase">Empty</div>
            <button class="sit-btn text-[10px] bg-[#333] hover:bg-[#444] text-white px-3 py-1 rounded-full mt-1">Sit Here</button>
        `;
        
        const btn = el.querySelector('.sit-btn');
        btn.onclick = () => this.emit(this.prefix + '_SIT', { seat: pid, user: this.currentUser });
        
        return { el, btn, pid };
    }

    updatePlayerSlotUI(slot, player, isActive) {
        const avatar = slot.el.querySelector('.avatar');
        const name = slot.el.querySelector('.name');
        const ghostInd = slot.el.querySelector('.ghost-indicator');
        
        if (player) {
            const isMe = player.id === this.currentUser.id;
            name.innerText = isMe ? "You" : (player.name || 'User');
            
            // USE PROFILE COLOR if available, else default
            if (player.mouseColor) {
                avatar.style.backgroundColor = player.mouseColor;
                avatar.className = `avatar w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg relative`;
            }

            avatar.innerHTML = `<span class="drop-shadow-md">${(player.name || 'U').substring(0,2).toUpperCase()}</span>`;
            if (ghostInd) avatar.appendChild(ghostInd); // Re-append ghost indicator

            slot.btn.style.display = 'none';
            if (isActive) slot.el.classList.add('game-slot-active');
            else slot.el.classList.remove('game-slot-active');
            
            slot.el.style.opacity = '1';
        } else {
            name.innerText = 'Empty';
            avatar.style.backgroundColor = ''; // Reset
            avatar.className = `avatar w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-gray-500 font-bold text-xl shadow-lg relative`;
            avatar.innerHTML = '<i class="fa-solid fa-plus"></i>';
            slot.btn.style.display = 'block';
            slot.el.classList.remove('game-slot-active');
            slot.el.style.opacity = '0.5';
        }
    }

    handleGhost(userId, isGhost) {
        [this.players[1], this.players[2]].forEach((p, idx) => {
            if (p && p.id === userId) {
                const slot = idx === 0 ? this.p1Slot : this.p2Slot;
                const ind = slot.el.querySelector('.ghost-indicator');
                if (ind) ind.classList.toggle('hidden', !isGhost);
                slot.el.classList.toggle('game-slot-ghost', isGhost);
            }
        });
    }

    processCommonEvents(data) {
        if (data.type === this.prefix + '_SIT') {
            const { seat, user } = data.payload;
            this.players[seat] = user;
            this.updatePlayerUI();
            // Sync state back to server so late joiners see this player
            if (this.players[1] && this.players[1].id === this.currentUser.id) this.syncToServer();
        }
    }
    
    syncToServer() {
        if (this.persist) {
            this.persist({
                players: this.players,
                board: this.board,
                turn: this.turn,
                gameOver: this.gameOver
            });
        }
    }
    
    // Abstract
    emitResize() {}
    destroy() {}
}

/* =========================================
   GAME 1: CONNECT FOUR
   ========================================= */
class ConnectFour extends MultiplayerGame {
    constructor(root, currentUser, emitFn, persistFn) {
        super(root, currentUser, emitFn, persistFn);
        this.id = 'connect4';
        this.prefix = 'C4';
        this.rows = 6;
        this.cols = 7;
        this.board = Array(this.rows).fill().map(() => Array(this.cols).fill(0));
        this.initUI();
    }
    emitResize() { Games.dispatchResize('520px', '600px'); }

    initUI() {
        const wrapper = document.createElement('div');
        wrapper.className = 'flex flex-col items-center gap-6 w-full h-full justify-center max-w-lg';
        
        const header = document.createElement('div');
        header.className = 'flex justify-between w-full px-4 items-center';
        this.p1Slot = this.createPlayerSlot('bg-red-500', 1);
        header.appendChild(this.p1Slot.el);
        header.appendChild(document.createTextNode('VS'));
        this.p2Slot = this.createPlayerSlot('bg-yellow-400', 2);
        header.appendChild(this.p2Slot.el);
        wrapper.appendChild(header);

        this.statusEl = document.createElement('div');
        this.statusEl.className = 'text-sm font-mono text-gray-300 bg-[#222426] px-4 py-2 rounded-full border border-[#333]';
        this.statusEl.innerText = 'Waiting...';
        wrapper.appendChild(this.statusEl);

        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-7 gap-2 bg-blue-900 p-3 rounded-xl border-b-8 border-blue-950 shadow-2xl';
        this.cells = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = document.createElement('div');
                cell.className = 'w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#0f172a] shadow-inner cursor-pointer transition-colors duration-300';
                cell.onclick = () => this.handleLocalClick(c);
                grid.appendChild(cell);
                this.cells.push(cell);
            }
        }
        wrapper.appendChild(grid);
        this.root.appendChild(wrapper);
    }

    updatePlayerUI() {
        this.updatePlayerSlotUI(this.p1Slot, this.players[1], this.turn === 1);
        this.updatePlayerSlotUI(this.p2Slot, this.players[2], this.turn === 2);
        
        if (this.gameOver) {
             // Status set in checkWin
        } else if (!this.players[1] || !this.players[2]) {
             this.statusEl.innerText = "Waiting for players...";
        } else {
             const isMe = this.players[this.turn]?.id === this.currentUser.id;
             this.statusEl.innerText = isMe ? "YOUR TURN" : `${this.players[this.turn].name}'s Turn`;
             this.statusEl.style.color = isMe ? '#4ade80' : '#9ca3af';
        }
    }

    handleLocalClick(col) {
        if (this.gameOver) return;
        const mySeat = this.players[1]?.id === this.currentUser.id ? 1 : (this.players[2]?.id === this.currentUser.id ? 2 : 0);
        if (mySeat === 0 || this.turn !== mySeat) return;
        this.emit('C4_MOVE', { col, player: mySeat });
    }

    onRemoteData(data) {
        if (data.type.startsWith('C4_')) this.processCommonEvents(data);
        if (data.type === 'C4_MOVE') this.performMove(data.payload.col, data.payload.player);
        if (data.type === 'C4_RESET') this.resetBoard();
        // Respond to sync requests
        if (data.type === 'C4_STATE_REQ' && this.players[1]?.id === this.currentUser.id) {
             this.syncToServer();
        }
    }
    
    applyState(state) {
        this.players = state.players || this.players;
        this.board = state.board || this.board;
        this.turn = state.turn || 1;
        this.gameOver = state.gameOver || false;
        this.redrawBoard();
        this.updatePlayerUI();
    }

    performMove(col, pIdx) {
        let r = -1;
        for (let i = this.rows - 1; i >= 0; i--) {
            if (this.board[i][col] === 0) { r = i; break; }
        }
        if (r === -1) return;

        this.board[r][col] = pIdx;
        this.redrawBoard();
        
        // Sync new state to server
        if (this.checkWin(r, col, pIdx)) {
            this.gameOver = true;
            this.statusEl.innerText = `${this.players[pIdx].name} Wins!`;
            if (this.players[1]?.id === this.currentUser.id) setTimeout(() => this.emit('C4_RESET', {}), 5000);
        } else {
            this.turn = pIdx === 1 ? 2 : 1;
        }
        
        // Save state to server
        if (this.players[1]?.id === this.currentUser.id) this.syncToServer();
        this.updatePlayerUI();
    }

    redrawBoard() {
        this.cells.forEach((cell, i) => {
            const r = Math.floor(i / this.cols);
            const c = i % this.cols;
            const val = this.board[r][c];
            cell.style.backgroundColor = ''; 
            cell.className = 'w-9 h-9 sm:w-10 sm:h-10 rounded-full shadow-inner cursor-pointer transition-colors duration-300 ' + 
                             (val === 0 ? 'bg-[#0f172a]' : '');
            
            // Use User Colors if available
            if (val !== 0) {
                 const p = this.players[val];
                 if (p && p.mouseColor) cell.style.backgroundColor = p.mouseColor;
                 else cell.classList.add(val === 1 ? 'bg-red-500' : 'bg-yellow-400');
            }
        });
    }

    checkWin(r, c, p) {
        // ... (standard win logic) ...
        const dirs = [[0,1], [1,0], [1,1], [1,-1]];
        return dirs.some(([dr, dc]) => {
            let count = 1;
            for(let k=1; k<4; k++) {
                const nr=r+dr*k, nc=c+dc*k;
                if(nr<0||nr>=this.rows||nc<0||nc>=this.cols||this.board[nr][nc]!==p) break;
                count++;
            }
            for(let k=1; k<4; k++) {
                const nr=r-dr*k, nc=c-dc*k;
                if(nr<0||nr>=this.rows||nc<0||nc>=this.cols||this.board[nr][nc]!==p) break;
                count++;
            }
            return count >= 4;
        });
    }
    
    resetBoard() {
        this.board = Array(this.rows).fill().map(() => Array(this.cols).fill(0));
        this.gameOver = false;
        this.turn = 1;
        this.redrawBoard();
        this.updatePlayerUI();
        this.syncToServer();
    }
}

/* =========================================
   GAME 2: TIC TAC TOE
   ========================================= */
class TicTacToe extends MultiplayerGame {
    constructor(root, currentUser, emitFn, persistFn) {
        super(root, currentUser, emitFn, persistFn);
        this.id = 'tictactoe';
        this.prefix = 'TTT';
        this.board = Array(9).fill(null);
        this.initUI();
    }
    emitResize() { Games.dispatchResize('380px', '500px'); }

    initUI() {
        const wrapper = document.createElement('div');
        wrapper.className = 'flex flex-col items-center gap-6 w-full h-full justify-center max-w-sm';
        
        const header = document.createElement('div');
        header.className = 'flex justify-between w-full px-2 items-center';
        this.p1Slot = this.createPlayerSlot('bg-cyan-500', 1);
        this.p2Slot = this.createPlayerSlot('bg-pink-500', 2);
        header.appendChild(this.p1Slot.el);
        header.appendChild(document.createTextNode('VS'));
        header.appendChild(this.p2Slot.el);
        wrapper.appendChild(header);

        this.statusEl = document.createElement('div');
        this.statusEl.className = 'text-sm font-mono text-gray-300 bg-[#222426] px-4 py-2 rounded-full border border-[#333]';
        this.statusEl.innerText = 'Waiting...';
        wrapper.appendChild(this.statusEl);

        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-3 gap-2 bg-[#222426] p-2 rounded-xl';
        this.cells = [];
        for(let i=0; i<9; i++) {
            const cell = document.createElement('div');
            cell.className = 'w-20 h-20 bg-[#151313] rounded-lg flex items-center justify-center text-4xl font-bold cursor-pointer hover:bg-[#1a1b1d]';
            cell.onclick = () => this.handleMove(i);
            this.cells.push(cell);
            grid.appendChild(cell);
        }
        wrapper.appendChild(grid);
        this.root.appendChild(wrapper);
    }

    updatePlayerUI() {
        this.updatePlayerSlotUI(this.p1Slot, this.players[1], this.turn === 1);
        this.updatePlayerSlotUI(this.p2Slot, this.players[2], this.turn === 2);
        if(!this.gameOver && this.players[1] && this.players[2]) {
            const isMe = this.players[this.turn]?.id === this.currentUser.id;
            this.statusEl.innerText = isMe ? "Your Turn" : "Opponent's Turn";
        }
    }

    handleMove(idx) {
        if (this.gameOver || this.board[idx]) return;
        const mySeat = this.players[1]?.id === this.currentUser.id ? 1 : (this.players[2]?.id === this.currentUser.id ? 2 : 0);
        if (mySeat !== 0 && this.turn === mySeat) this.emit('TTT_MOVE', { index: idx, player: mySeat });
    }

    onRemoteData(data) {
        if (data.type.startsWith('TTT_')) this.processCommonEvents(data);
        if (data.type === 'TTT_MOVE') this.performMove(data.payload.index, data.payload.player);
        if (data.type === 'TTT_RESET') this.resetBoard();
        if (data.type === 'TTT_STATE_REQ' && this.players[1]?.id === this.currentUser.id) this.syncToServer();
    }

    applyState(state) {
        this.players = state.players || this.players;
        this.board = state.board || this.board;
        this.turn = state.turn || 1;
        this.gameOver = state.gameOver || false;
        this.redrawBoard();
        this.updatePlayerUI();
    }

    performMove(idx, p) {
        this.board[idx] = p;
        this.turn = p === 1 ? 2 : 1;
        this.redrawBoard();
        
        const win = this.checkWin();
        if (win) {
            this.gameOver = true;
            this.statusEl.innerText = `${this.players[win].name} Wins!`;
            if (this.players[1]?.id === this.currentUser.id) setTimeout(() => this.emit('TTT_RESET', {}), 3000);
        }
        if (this.players[1]?.id === this.currentUser.id) this.syncToServer();
        this.updatePlayerUI();
    }

    redrawBoard() {
        this.cells.forEach((c, i) => {
            const v = this.board[i];
            c.innerHTML = '';
            if (v) {
                const p = this.players[v];
                const color = p && p.mouseColor ? p.mouseColor : (v === 1 ? '#06b6d4' : '#ec4899');
                c.innerHTML = `<i class="fa-solid ${v===1?'fa-xmark':'fa-o'}" style="color:${color}"></i>`;
            }
        });
    }

    checkWin() {
        const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
        for (let [a,b,c] of wins) if (this.board[a] && this.board[a]===this.board[b] && this.board[a]===this.board[c]) return this.board[a];
        return null;
    }
    
    resetBoard() {
        this.board = Array(9).fill(null);
        this.gameOver = false;
        this.turn = 1;
        this.redrawBoard();
        this.updatePlayerUI();
        this.syncToServer();
    }
}

/* =========================================
   GAME 3: ROCK PAPER SCISSORS (Stubbed for brevity)
   ========================================= */
class RockPaperScissors extends MultiplayerGame {
    constructor(r, u, e, p) { super(r, u, e, p); this.id='rps'; this.prefix='RPS'; this.initUI(); }
    emitResize() { Games.dispatchResize('420px', '550px'); }
    initUI() {
        const w = document.createElement('div');
        w.className = 'flex flex-col items-center justify-center h-full gap-4 text-gray-400';
        w.innerText = "Rock Paper Scissors (Active)";
        this.root.appendChild(w);
    }
    onRemoteData(d) { if(d.type.startsWith('RPS_')) this.processCommonEvents(d); }
    applyState(s) { this.players = s.players; }
}

/* =========================================
   SINGLE PLAYER GAMES
   ========================================= */
class MatchThree { constructor(r) { this.root=r; this.root.innerHTML='<div class="text-white">Candy Match (Solo)</div>'; } destroy(){} emitResize(){Games.dispatchResize('400px','500px');} }
class MemoryGame { constructor(r) { this.root=r; this.root.innerHTML='<div class="text-white">Memory (Solo)</div>'; } destroy(){} emitResize(){Games.dispatchResize('400px','500px');} }
class DinoRunner { constructor(r) { this.root=r; this.root.innerHTML='<div class="text-white">Dino Run (Solo)</div>'; } destroy(){} emitResize(){Games.dispatchResize('400px','320px');} }

window.Games = Games;
window.initGames = function() { if (window.Games) window.Games.enable(); };
