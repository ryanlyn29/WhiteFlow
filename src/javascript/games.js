/**
 * games.js
 * Multiplayer Game Engine for Whiteflow.
 * 
 * Updates:
 * - Event-driven architecture for Socket.IO integration.
 * - Real-time multiplayer Connect 4 with user identity.
 * - Logic-fixed Candy Match with gravity, turn limits, and no-gap generation.
 */

// Inject styles for animations and game-specific UI
const gameStyles = document.createElement('style');
gameStyles.innerHTML = `
@keyframes softSlideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes popIn { 0% { transform: scale(0.5); } 80% { transform: scale(1.1); } 100% { transform: scale(1); } }
@keyframes dropDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.animate-soft-slide { animation: softSlideUp 0.4s ease-out forwards; }
.animate-pop { animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
.animate-drop { animation: dropDown 0.3s ease-out forwards; }
.game-slot-active { border-color: #3b82f6 !important; background-color: rgba(59, 130, 246, 0.1) !important; }
.c4-cell { will-change: transform, background-color; }
`;
document.head.appendChild(gameStyles);

const Games = {
    socket: null,
    currentUser: null,
    boardId: null,
    activeGame: null,
    
    // UI Elements
    view: null,
    selector: null,
    container: null,
    backBtn: null,
    initialized: false,

    /**
     * Initialize the Game Engine.
     * Called by board.js after user session and socket are ready.
     */
    init(socket, user, boardId) {
        if (this.initialized) return;
        
        this.socket = socket;
        this.currentUser = user || { id: 'guest-' + Date.now(), name: 'Guest', email: 'guest@example.com' };
        this.boardId = boardId;

        this.view = document.getElementById('game-view');
        this.selector = document.getElementById('game-selector');
        this.container = document.getElementById('active-game-container');
        this.backBtn = document.getElementById('back-to-games-btn');

        if (!this.view || !this.selector) return;

        this.setupBackButton();
        this.renderMenu();
        
        this.initialized = true;
        console.log("🎮 Games Engine Initialized for", this.currentUser.name);
    },

    setupBackButton() {
        if (!this.backBtn) return;
        
        // Clone to remove old listeners
        const newBackBtn = this.backBtn.cloneNode(true);
        if(this.backBtn.parentNode) this.backBtn.parentNode.replaceChild(newBackBtn, this.backBtn);
        this.backBtn = newBackBtn;
        
        this.backBtn.className = "absolute top-4 left-4 z-20 text-xs font-medium text-gray-400 hover:text-white hidden flex items-center gap-2 bg-[#1a1b1d] border border-[#222426] px-3 py-1.5 rounded-full transition-colors hover:border-gray-600 cursor-pointer";
        this.backBtn.innerHTML = '<i class="fa-solid fa-arrow-left text-[10px]"></i> <span>Exit Game</span>';
        
        this.backBtn.onclick = () => {
            // If in a multiplayer game, notify others we are leaving context (optional)
            if (this.activeGame && this.activeGame.id === 'connect4') {
                this.send('C4_LEAVE', {}); 
            }
            this.stopActiveGame();
            this.showMenu();
        };
    },

    /**
     * Send game action to server via board.js socket connection
     */
    send(type, payload) {
        if (this.socket) {
            this.socket.emit('game:action', {
                boardId: this.boardId,
                userId: this.currentUser.id,
                userName: this.currentUser.name || this.currentUser.email,
                type: type,
                payload: payload
            });
        }
    },

    /**
     * Handle incoming game events from the server
     */
    handleEvent(data) {
        // Route event to the active game if it matches the game type context
        if (this.activeGame && typeof this.activeGame.onRemoteData === 'function') {
            this.activeGame.onRemoteData(data);
        }
    },

    renderMenu() {
        this.selector.innerHTML = '';
        const games = [
            { id: 'connect4', name: 'Connect 4', icon: 'fa-circle-nodes', accent: 'text-blue-500', desc: '2 Player PvP' },
            { id: 'match3', name: 'Candy Match', icon: 'fa-candy-cane', accent: 'text-pink-500', desc: 'Score Attack' },
            { id: 'memory', name: 'Memory', icon: 'fa-brain', accent: 'text-emerald-500', desc: 'Solo Puzzle' },
            { id: 'runner', name: 'Dino Run', icon: 'fa-dragon', accent: 'text-orange-500', desc: 'Endless' }
        ];

        games.forEach((g, index) => {
            const btn = document.createElement('button');
            btn.className = `
                flex-shrink-0 w-36 h-44 rounded-xl 
                bg-[#1a1b1d] border border-[#222426] 
                text-gray-300 hover:text-white
                hover:bg-[#222426] hover:border-gray-500 hover:shadow-lg
                transition-all duration-200 ease-out
                flex flex-col items-center justify-center gap-2
                animate-soft-slide cursor-pointer group relative overflow-hidden
            `;
            btn.style.animationDelay = `${index * 50}ms`;
            
            const icon = document.createElement('i');
            icon.className = `fa-solid ${g.icon} text-3xl mb-2 text-gray-500 group-hover:${g.accent} transition-colors duration-200`;
            
            const label = document.createElement('span');
            label.className = 'text-sm font-bold tracking-wide';
            label.innerText = g.name;

            const sub = document.createElement('span');
            sub.className = 'text-[10px] text-gray-500 uppercase tracking-widest';
            sub.innerText = g.desc;

            btn.appendChild(icon);
            btn.appendChild(label);
            btn.appendChild(sub);

            btn.onclick = () => this.startGame(g.id);
            this.selector.appendChild(btn);
        });
    },

    showMenu() {
        this.selector.style.display = 'flex';
        this.container.style.display = 'none';
        this.backBtn.style.display = 'none';
        // Re-render menu to replay animations
        this.renderMenu();
    },

    startGame(gameId) {
        this.selector.style.display = 'none';
        this.container.style.display = 'flex';
        this.backBtn.style.display = 'flex';
        this.container.innerHTML = '';
        this.container.className = "w-full h-full flex flex-col items-center justify-center p-2 animate-soft-slide";

        // Initialize specific game class
        switch(gameId) {
            case 'connect4':
                this.activeGame = new ConnectFour(this.container, this.currentUser, (t, p) => this.send(t, p));
                break;
            case 'match3':
                this.activeGame = new MatchThree(this.container, this.currentUser);
                break;
            case 'memory':
                this.activeGame = new MemoryGame(this.container);
                break;
            case 'runner':
                this.activeGame = new DinoRunner(this.container);
                break;
        }
    },

    stopActiveGame() {
        if (this.activeGame && typeof this.activeGame.destroy === 'function') {
            this.activeGame.destroy();
        }
        this.activeGame = null;
        this.container.innerHTML = '';
    }
};

/* =========================================
   GAME 1: CONNECT FOUR (MULTIPLAYER)
   ========================================= */
class ConnectFour {
    constructor(root, currentUser, emitFn) {
        this.root = root;
        this.currentUser = currentUser;
        this.emit = emitFn;
        this.id = 'connect4';
        
        this.rows = 6;
        this.cols = 7;
        this.board = Array(this.rows).fill().map(() => Array(this.cols).fill(0));
        
        this.players = { 1: null, 2: null }; // 1: Red, 2: Yellow (Stores User Objects)
        this.turn = 1; 
        this.gameOver = false;
        
        this.initUI();
        
        // Announce presence and request current state from anyone in the room
        this.emit('C4_STATE_REQ', {});
    }

    initUI() {
        const wrapper = document.createElement('div');
        wrapper.className = 'flex flex-col items-center gap-6 w-full h-full justify-center max-w-lg';

        // --- Player Header ---
        const header = document.createElement('div');
        header.className = 'flex justify-between w-full px-4 items-center';
        
        // Player 1 (Red)
        this.p1Slot = this.createPlayerSlot('Red', 'bg-red-500', 1);
        // VS
        const vs = document.createElement('div');
        vs.className = 'text-gray-600 font-bold text-xl italic';
        vs.innerText = 'VS';
        // Player 2 (Yellow)
        this.p2Slot = this.createPlayerSlot('Yellow', 'bg-yellow-400', 2);

        header.appendChild(this.p1Slot.el);
        header.appendChild(vs);
        header.appendChild(this.p2Slot.el);
        wrapper.appendChild(header);

        // --- Status Bar ---
        this.statusEl = document.createElement('div');
        this.statusEl.className = 'text-sm font-mono text-gray-300 bg-[#222426] px-4 py-2 rounded-full border border-[#333] transition-all';
        this.statusEl.innerText = 'Waiting for players...';
        wrapper.appendChild(this.statusEl);

        // --- The Board ---
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-7 gap-2 bg-blue-900 p-3 rounded-xl border-b-8 border-blue-950 shadow-2xl relative';
        
        this.cells = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = document.createElement('div');
                cell.className = 'w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#0f172a] shadow-inner transition-all duration-300 c4-cell';
                cell.dataset.r = r;
                cell.dataset.c = c;
                
                // Hover effect only for top row or entire col tracking logic could be added
                cell.onclick = () => this.handleLocalClick(c);
                
                grid.appendChild(cell);
                this.cells.push(cell);
            }
        }
        wrapper.appendChild(grid);
        this.root.appendChild(wrapper);
    }

    createPlayerSlot(colorName, bgClass, pid) {
        const el = document.createElement('div');
        el.className = 'flex flex-col items-center gap-2 p-3 rounded-lg border border-transparent transition-all duration-300';
        
        const avatar = document.createElement('div');
        avatar.className = `w-12 h-12 rounded-full ${bgClass} flex items-center justify-center text-black font-bold text-xl shadow-lg`;
        avatar.innerHTML = '<i class="fa-solid fa-user"></i>';
        
        const name = document.createElement('div');
        name.className = 'text-xs text-gray-400 font-bold uppercase';
        name.innerText = 'Empty';

        const btn = document.createElement('button');
        btn.className = 'text-[10px] bg-[#333] hover:bg-[#444] text-white px-3 py-1 rounded-full transition-colors mt-1';
        btn.innerText = 'Sit Here';
        btn.onclick = () => this.emit('C4_SIT', { seat: pid });

        el.appendChild(avatar);
        el.appendChild(name);
        el.appendChild(btn);

        return { el, avatar, name, btn };
    }

    updatePlayerUI() {
        const updateSlot = (slot, player, isActive) => {
            if (player) {
                // If player is me, indicate that
                const isMe = player.id === this.currentUser.id;
                slot.name.innerText = isMe ? "You" : (player.userName || player.name);
                slot.avatar.innerHTML = (player.userName || player.name).substring(0,2).toUpperCase();
                slot.btn.style.display = 'none'; // Seat taken
                if (isActive) {
                    slot.el.classList.add('game-slot-active');
                } else {
                    slot.el.classList.remove('game-slot-active');
                }
            } else {
                slot.name.innerText = 'Empty';
                slot.avatar.innerHTML = '<i class="fa-solid fa-plus"></i>';
                slot.btn.style.display = 'block';
                slot.el.classList.remove('game-slot-active');
            }
            
            // Turn opacity visual
            slot.el.style.opacity = isActive ? '1' : (player ? '0.7' : '0.5');
        };

        updateSlot(this.p1Slot, this.players[1], this.turn === 1 && !this.gameOver);
        updateSlot(this.p2Slot, this.players[2], this.turn === 2 && !this.gameOver);

        // Status Text
        if (!this.players[1] || !this.players[2]) {
            this.statusEl.innerText = 'Waiting for opponent...';
            this.statusEl.className = 'text-sm font-mono text-gray-300 bg-[#222426] px-4 py-2 rounded-full border border-[#333]';
        } else if (this.gameOver) {
            // Text set by game over logic
        } else {
            const isMyTurn = this.players[this.turn]?.id === this.currentUser.id;
            this.statusEl.innerText = isMyTurn ? "YOUR TURN" : `${this.players[this.turn].name || 'Opponent'}'s Turn`;
            this.statusEl.className = `text-sm font-mono px-4 py-2 rounded-full border border-[#333] transition-colors ${isMyTurn ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-[#222426] text-gray-400'}`;
        }
    }

    handleLocalClick(col) {
        if (this.gameOver) return;
        
        // 1. Check if I am a player
        const mySeat = this.players[1]?.id === this.currentUser.id ? 1 : (this.players[2]?.id === this.currentUser.id ? 2 : 0);
        
        if (mySeat === 0) {
            window.showCustomAlert("Spectator", "You are spectating. Click 'Sit Here' to play.", "info");
            return;
        }

        // 2. Validate Turn
        if (this.turn !== mySeat) {
            // Not my turn
            return;
        }
        
        // 3. Emit move
        this.emit('C4_MOVE', { col: col, player: mySeat });
        
        // Optimistic update
        // this.performMove(col, mySeat); // Let's wait for server echo for simpler synchronization in this architecture
    }

    onRemoteData(data) {
        if (data.type === 'C4_SIT') {
            const { seat, user } = data.payload;
            this.players[seat] = user;
            this.updatePlayerUI();
            
            // If I am the other player, I should send my state so they sync up?
            // Or if I am sitting, I just requested it.
            // Simplified: The room acts as truth.
        }
        else if (data.type === 'C4_MOVE') {
            this.performMove(data.payload.col, data.payload.player);
        }
        else if (data.type === 'C4_RESET') {
            this.resetBoard();
        }
        else if (data.type === 'C4_STATE_REQ') {
            // A new player joined and asked for state. 
            // If I am player 1 (host-ish), I reply.
            if (this.players[1] && this.players[1].id === this.currentUser.id) {
                this.emit('C4_STATE_SYNC', {
                    players: this.players,
                    board: this.board,
                    turn: this.turn,
                    gameOver: this.gameOver
                });
            }
        }
        else if (data.type === 'C4_STATE_SYNC') {
            // Received full state
            this.players = data.payload.players;
            this.board = data.payload.board;
            this.turn = data.payload.turn;
            this.gameOver = data.payload.gameOver;
            this.redrawBoard();
            this.updatePlayerUI();
        }
        else if (data.type === 'C4_LEAVE') {
            // Reset the player slot if someone leaves
            if (this.players[1] && this.players[1].id === data.userId) this.players[1] = null;
            if (this.players[2] && this.players[2].id === data.userId) this.players[2] = null;
            this.updatePlayerUI();
        }
    }

    performMove(col, playerIdx) {
        // Find drop row
        let r = -1;
        for (let i = this.rows - 1; i >= 0; i--) {
            if (this.board[i][col] === 0) {
                r = i;
                break;
            }
        }
        if (r === -1) return; // Column full

        // Update State
        this.board[r][col] = playerIdx;
        
        // Animate Drop
        const cell = this.cells[r * this.cols + col];
        cell.classList.remove('bg-[#0f172a]');
        cell.classList.add(playerIdx === 1 ? 'bg-red-500' : 'bg-yellow-400');
        cell.classList.add('animate-pop');

        // Check Win
        if (this.checkWin(r, col, playerIdx)) {
            this.gameOver = true;
            this.statusEl.innerText = `${this.players[playerIdx].name || 'Player'} Wins!`;
            this.statusEl.className = 'text-sm font-bold bg-green-900/50 text-green-400 px-4 py-2 rounded-full border border-green-700';
            
            // Auto restart countdown if I am player 1
            if (this.players[1] && this.players[1].id === this.currentUser.id) {
                setTimeout(() => this.emit('C4_RESET', {}), 5000);
            }
        } else if (this.board.every(row => row.every(c => c !== 0))) {
            this.gameOver = true;
            this.statusEl.innerText = "Draw!";
            if (this.players[1] && this.players[1].id === this.currentUser.id) {
                setTimeout(() => this.emit('C4_RESET', {}), 5000);
            }
        } else {
            this.turn = playerIdx === 1 ? 2 : 1;
        }
        this.updatePlayerUI();
    }

    redrawBoard() {
        this.cells.forEach((cell, i) => {
            const r = Math.floor(i / this.cols);
            const c = i % this.cols;
            const val = this.board[r][c];
            
            // Clean classes
            cell.className = 'w-9 h-9 sm:w-10 sm:h-10 rounded-full shadow-inner transition-all duration-300 c4-cell';
            
            if (val === 0) cell.classList.add('bg-[#0f172a]');
            else if (val === 1) cell.classList.add('bg-red-500');
            else if (val === 2) cell.classList.add('bg-yellow-400');
        });
    }

    resetBoard() {
        this.board = Array(this.rows).fill().map(() => Array(this.cols).fill(0));
        this.gameOver = false;
        this.turn = 1; // Red starts
        this.redrawBoard();
        this.updatePlayerUI();
    }

    checkWin(r, c, player) {
        const dirs = [[0,1], [1,0], [1,1], [1,-1]];
        return dirs.some(([dr, dc]) => {
            let count = 1;
            for(let k=1; k<4; k++) {
                const nr = r + dr*k, nc = c + dc*k;
                if(nr<0||nr>=this.rows||nc<0||nc>=this.cols||this.board[nr][nc]!==player) break;
                count++;
            }
            for(let k=1; k<4; k++) {
                const nr = r - dr*k, nc = c - dc*k;
                if(nr<0||nr>=this.rows||nc<0||nc>=this.cols||this.board[nr][nc]!==player) break;
                count++;
            }
            return count >= 4;
        });
    }

    destroy() {
        // Optional cleanup
    }
}

/* =========================================
   GAME 2: CANDY MATCH (LOGIC FIXED)
   ========================================= */
class MatchThree {
    constructor(root, currentUser) {
        this.root = root;
        this.width = 8;
        this.height = 8;
        this.colors = ['bg-red-500', 'bg-yellow-400', 'bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500'];
        this.board = [];
        this.score = 0;
        
        // Turn System
        this.movesLeft = 20;
        this.isGameOver = false;
        
        // Interaction
        this.draggedTile = null;
        this.replacedTile = null;
        this.isProcessing = false;

        this.init();
    }

    init() {
        const wrapper = document.createElement('div');
        wrapper.className = 'flex flex-col items-center justify-center h-full w-full gap-3';

        // Header (Score & Moves)
        const header = document.createElement('div');
        header.className = 'flex justify-between w-full max-w-[280px] text-xs font-mono text-gray-300 mb-2';
        
        this.scoreEl = document.createElement('div');
        this.scoreEl.className = 'bg-[#222426] px-3 py-1.5 rounded border border-[#333]';
        this.scoreEl.innerText = 'SCORE: 0';
        
        this.movesEl = document.createElement('div');
        this.movesEl.className = 'bg-[#222426] px-3 py-1.5 rounded border border-[#333] text-orange-400';
        this.movesEl.innerText = `MOVES: ${this.movesLeft}`;
        
        header.appendChild(this.scoreEl);
        header.appendChild(this.movesEl);
        wrapper.appendChild(header);

        // Grid
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-8 gap-1 bg-[#151313] p-2 rounded-xl border border-[#222426] select-none';
        this.gridEl = grid;
        wrapper.appendChild(grid);
        
        // Game Over Overlay (Hidden initially)
        this.gameOverEl = document.createElement('div');
        this.gameOverEl.className = 'absolute inset-0 bg-black/80 z-10 flex flex-col items-center justify-center hidden';
        this.gameOverEl.innerHTML = `
            <div class="text-2xl font-bold text-white mb-2">Time's Up!</div>
            <div class="text-sm text-gray-400 mb-4">Final Score: <span id="final-score" class="text-white">0</span></div>
            <button id="restart-match3" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full text-xs transition">Play Again</button>
        `;
        wrapper.appendChild(this.gameOverEl);
        
        // Bind Restart
        setTimeout(() => {
            const btn = document.getElementById('restart-match3');
            if(btn) btn.onclick = () => this.resetGame();
        }, 0);

        this.root.appendChild(wrapper);
        this.createBoard();
    }

    createBoard() {
        this.gridEl.innerHTML = '';
        this.board = [];
        
        // Generate valid initial board (No matches)
        for (let i = 0; i < this.width * this.height; i++) {
            const tile = document.createElement('div');
            tile.setAttribute('draggable', true);
            tile.setAttribute('id', i);
            
            // Events
            tile.addEventListener('dragstart', this.dragStart.bind(this));
            tile.addEventListener('dragover', (e) => e.preventDefault());
            tile.addEventListener('dragenter', (e) => e.preventDefault());
            tile.addEventListener('drop', this.dragDrop.bind(this));
            tile.addEventListener('dragend', this.dragEnd.bind(this));

            this.gridEl.appendChild(tile);
            this.board.push(tile);
        }

        // Fill recursively until stable without matches
        this.fillBoardNoMatches();
    }

    fillBoardNoMatches() {
        // Random fill checking for no initial 3-matches
        for (let i = 0; i < this.board.length; i++) {
            let color = this.randomColor();
            const c = i % this.width;
            const r = Math.floor(i / this.width);
            
            // Avoid immediate match
            let attempts = 0;
            while (
                (c >= 2 && this.board[i-1].dataset.color === color && this.board[i-2].dataset.color === color) ||
                (r >= 2 && this.board[i-this.width].dataset.color === color && this.board[i-this.width*2].dataset.color === color)
            ) {
                color = this.randomColor();
                attempts++;
                if(attempts > 10) break; // Fallback
            }
            
            this.board[i].className = `w-7 h-7 rounded-sm cursor-grab active:cursor-grabbing ${color} hover:brightness-110 transition-all duration-200`;
            this.board[i].dataset.color = color;
        }
    }

    randomColor() { return this.colors[Math.floor(Math.random() * this.colors.length)]; }

    dragStart(e) { 
        if (this.isProcessing || this.isGameOver) { e.preventDefault(); return; }
        this.draggedTile = e.target; 
        this.draggedTile.style.opacity = '0.5';
    }
    
    dragDrop(e) { this.replacedTile = e.target; }

    async dragEnd() {
        if (this.draggedTile) this.draggedTile.style.opacity = '1';
        if (!this.replacedTile || !this.draggedTile || this.isProcessing || this.isGameOver) return;

        let currId = parseInt(this.draggedTile.id);
        let targetId = parseInt(this.replacedTile.id);
        
        const validMoves = [currId - 1, currId - this.width, currId + 1, currId + this.width];
        const isRowWrap = Math.abs(currId % this.width - targetId % this.width) > 1;

        if (validMoves.includes(targetId) && !isRowWrap) {
            // Swap visual
            this.swapColors(this.draggedTile, this.replacedTile);
            
            const matches = this.findMatches();
            if (matches.length === 0) {
                // Invalid move, swap back
                await new Promise(r => setTimeout(r, 200));
                this.swapColors(this.draggedTile, this.replacedTile);
            } else {
                // Valid move
                this.movesLeft--;
                this.movesEl.innerText = `MOVES: ${this.movesLeft}`;
                await this.processMatches();
                
                if (this.movesLeft <= 0) this.endGame();
            }
        }
        this.draggedTile = null;
        this.replacedTile = null;
    }

    swapColors(t1, t2) {
        const c1 = t1.dataset.color;
        const c2 = t2.dataset.color;
        
        t1.className = t1.className.replace(c1, c2);
        t2.className = t2.className.replace(c2, c1);
        
        t1.dataset.color = c2;
        t2.dataset.color = c1;
    }

    findMatches() {
        const matches = new Set();
        // Horizontal
        for (let i = 0; i < this.height * this.width; i++) {
            if (i % this.width < this.width - 2) {
                const c1 = this.board[i].dataset.color;
                const c2 = this.board[i+1].dataset.color;
                const c3 = this.board[i+2].dataset.color;
                if (c1 === c2 && c2 === c3 && c1 !== 'transparent') {
                    matches.add(i); matches.add(i+1); matches.add(i+2);
                }
            }
        }
        // Vertical
        for (let i = 0; i < this.width * (this.height - 2); i++) {
            const c1 = this.board[i].dataset.color;
            const c2 = this.board[i+this.width].dataset.color;
            const c3 = this.board[i+this.width*2].dataset.color;
            if (c1 === c2 && c2 === c3 && c1 !== 'transparent') {
                matches.add(i); matches.add(i+this.width); matches.add(i+this.width*2);
            }
        }
        return Array.from(matches);
    }

    async processMatches() {
        this.isProcessing = true;
        let matches = this.findMatches();
        
        // Loop until board is stable (no matches)
        while (matches.length > 0) {
            this.score += matches.length * 10;
            this.scoreEl.innerText = `SCORE: ${this.score}`;

            // Clear matches (visual pop)
            matches.forEach(id => {
                this.board[id].dataset.color = 'transparent';
                this.board[id].className = 'w-7 h-7 rounded-sm bg-transparent transition-all';
            });

            await new Promise(r => setTimeout(r, 300));

            // Gravity Logic (Cascade)
            this.applyGravity();
            await new Promise(r => setTimeout(r, 300));
            
            // Check for new matches formed by falling blocks
            matches = this.findMatches();
        }
        this.isProcessing = false;
    }

    applyGravity() {
        // Process each column
        for (let c = 0; c < this.width; c++) {
            let columnIndices = [];
            for (let r = 0; r < this.height; r++) {
                columnIndices.push(r * this.width + c);
            }

            // Extract Colors from this column
            let colors = columnIndices.map(i => this.board[i].dataset.color);
            // Filter out empty spaces
            let validColors = colors.filter(c => c !== 'transparent');
            // Fill empty slots at top with new random colors
            let missing = this.height - validColors.length;
            for(let k=0; k<missing; k++) validColors.unshift(this.randomColor());

            // Re-apply sorted colors to board tiles
            for(let r=0; r<this.height; r++) {
                const idx = columnIndices[r];
                const color = validColors[r];
                this.board[idx].dataset.color = color;
                // Add animate-drop class for falling effect
                this.board[idx].className = `w-7 h-7 rounded-sm cursor-grab active:cursor-grabbing ${color} hover:brightness-110 transition-all duration-200 animate-drop`;
            }
        }
    }

    endGame() {
        this.isGameOver = true;
        document.getElementById('final-score').innerText = this.score;
        this.gameOverEl.classList.remove('hidden');
        this.gameOverEl.classList.add('flex');
    }

    resetGame() {
        this.score = 0;
        this.movesLeft = 20;
        this.isGameOver = false;
        this.scoreEl.innerText = 'SCORE: 0';
        this.movesEl.innerText = 'MOVES: 20';
        this.gameOverEl.classList.add('hidden');
        this.gameOverEl.classList.remove('flex');
        this.createBoard();
    }

    destroy() {}
}

/* =========================================
   GAME 3: MEMORY MATCH (SOLO)
   ========================================= */
class MemoryGame {
    constructor(root) {
        this.root = root;
        this.init();
    }
    init() {
        const wrapper = document.createElement('div');
        wrapper.className = 'flex flex-col items-center justify-center h-full gap-4';
        const info = document.createElement('div');
        info.innerText = 'Find Pairs';
        info.className = 'text-gray-400 text-xs font-bold uppercase tracking-widest';
        wrapper.appendChild(info);
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-4 gap-2 p-2';
        const icons = ['fa-cat', 'fa-dog', 'fa-fish', 'fa-crow', 'fa-dragon', 'fa-hippo', 'fa-spider', 'fa-horse'];
        const items = [...icons, ...icons].sort(() => 0.5 - Math.random());
        
        let firstCard = null, secondCard = null, lock = false, matches = 0;

        items.forEach(iconClass => {
            const card = document.createElement('div');
            card.className = 'w-12 h-12 sm:w-14 sm:h-14 bg-[#222426] border border-[#333] rounded-lg cursor-pointer flex items-center justify-center text-white text-xl transition-all duration-200 hover:border-gray-500';
            
            const front = document.createElement('i');
            front.className = `fa-solid ${iconClass} hidden animate-soft-slide`;
            const back = document.createElement('i');
            back.className = 'fa-solid fa-question text-[#333] text-sm';
            
            card.appendChild(front);
            card.appendChild(back);
            grid.appendChild(card);

            card.onclick = () => {
                if (lock || card === firstCard || card.classList.contains('matched')) return;
                
                card.classList.add('bg-emerald-600', 'border-emerald-500');
                back.classList.add('hidden');
                front.classList.remove('hidden');

                if (!firstCard) {
                    firstCard = card;
                    return;
                }

                secondCard = card;
                lock = true;

                if (firstCard.firstChild.className === secondCard.firstChild.className) {
                    firstCard.classList.add('matched', 'opacity-50');
                    secondCard.classList.add('matched', 'opacity-50');
                    matches++;
                    [firstCard, secondCard, lock] = [null, null, false];
                    if (matches === 8) info.innerText = "You Win!";
                } else {
                    setTimeout(() => {
                        [firstCard, secondCard].forEach(c => {
                            c.classList.remove('bg-emerald-600', 'border-emerald-500');
                            c.firstChild.classList.add('hidden');
                            c.lastChild.classList.remove('hidden');
                        });
                        [firstCard, secondCard, lock] = [null, null, false];
                    }, 800);
                }
            };
        });
        wrapper.appendChild(grid);
        this.root.appendChild(wrapper);
    }
    onRemoteData() {} // Solo game
    destroy() {}
}

/* =========================================
   GAME 4: DINO RUNNER (SOLO)
   ========================================= */
class DinoRunner {
    constructor(root) {
        this.root = root;
        this.init();
    }
    init() {
        const wrapper = document.createElement('div');
        wrapper.className = 'flex flex-col items-center justify-center h-full gap-3';
        this.canvas = document.createElement('canvas');
        this.canvas.width = 320;
        this.canvas.height = 160;
        this.canvas.className = 'bg-[#151313] border border-[#222426] rounded-lg cursor-pointer';
        wrapper.appendChild(this.canvas);
        const score = document.createElement('div');
        score.className = 'text-gray-500 text-[10px] font-mono uppercase';
        score.innerText = 'Click to Jump';
        wrapper.appendChild(score);
        this.root.appendChild(wrapper);
        this.ctx = this.canvas.getContext('2d');
        this.running = true;
        this.dino = { x: 30, y: 130, w: 16, h: 16, dy: 0, jump: 7, grounded: true };
        this.obs = [];
        this.frame = 0;
        this.score = 0;
        this.speed = 3.5;
        this.scoreEl = score;
        
        this.jump = () => { if(this.dino.grounded && this.running) { this.dino.dy = -this.dino.jump; this.dino.grounded = false; } };
        this.canvas.onclick = this.jump;
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }
    
    loop() {
        if(!this.root.contains(this.canvas)) return;
        if(!this.running) {
            this.ctx.fillStyle = 'white';
            this.ctx.fillText("Game Over. Click to restart", 80, 80);
            this.canvas.onclick = () => { this.root.innerHTML=''; new DinoRunner(this.root); };
            return;
        }
        
        this.ctx.clearRect(0,0,320,160);
        this.dino.dy += 0.4;
        this.dino.y += this.dino.dy;
        if(this.dino.y > 130) { this.dino.y = 130; this.dino.dy=0; this.dino.grounded=true; }
        
        this.frame++;
        if(this.frame % 90 === 0) this.obs.push({x:320, y:130, w:10, h:16});
        
        this.ctx.fillStyle = '#10b981';
        this.ctx.fillRect(this.dino.x, this.dino.y, 16, 16);
        
        this.ctx.fillStyle = '#ef4444';
        this.obs.forEach((o, i) => {
            o.x -= this.speed;
            this.ctx.fillRect(o.x, o.y, o.w, o.h);
            if(o.x+o.w < 0) { this.obs.splice(i,1); this.score++; this.scoreEl.innerText = "SCORE: "+this.score; }
            if(this.dino.x < o.x + o.w && this.dino.x + 16 > o.x && this.dino.y < o.y + o.h && this.dino.y + 16 > o.y) this.running = false;
        });
        
        this.ctx.strokeStyle = '#333';
        this.ctx.beginPath(); this.ctx.moveTo(0,146); this.ctx.lineTo(320,146); this.ctx.stroke();
        
        requestAnimationFrame(this.loop);
    }
    onRemoteData() {}
    destroy() { this.running = false; }
}
