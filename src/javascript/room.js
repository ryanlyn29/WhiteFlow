
/**
 * room.js - SPA Adapted
 * Handles UI logic for Room Creation/Joining.
 * Wrapped in init/cleanup functions to support page navigation.
 */

let roomAbortController = null; // Used to clean up event listeners automatically

window.initRoom = function() {
    console.log("Initializing Room Page Logic...");

    // 1. Select DOM Elements (Freshly selected every time the page loads)
    const actionSelection = document.getElementById('action-selection');
    const createRoomForm = document.getElementById('create-room-form');
    const joinRoomForm = document.getElementById('join-room-form');
    const titleText = document.getElementById('title-text');
    const descriptionText = document.getElementById('description-text');
    const backButtons = document.querySelectorAll('.back-to-selection');
    const roomNameInput = document.getElementById('room-name');
    const customCodeInput = document.getElementById('custom-code');
    const roomCodeInput = document.getElementById('room-code');

    // Initialize AbortController for easy event cleanup
    if (roomAbortController) roomAbortController.abort();
    roomAbortController = new AbortController();
    const signal = { signal: roomAbortController.signal };

    // 2. Define UI Helper Functions
    
    function hideAll() {
        if (actionSelection) actionSelection.style.display = 'none';
        if (createRoomForm) createRoomForm.style.display = 'none';
        if (joinRoomForm) joinRoomForm.style.display = 'none';
    }

    // Expose these to window so inline HTML onclick attributes (if any) still work,
    // or simply for external control.
    window.showCreateRoom = function () {
        hideAll();
        if (createRoomForm) createRoomForm.style.display = 'flex';
        if (titleText) titleText.textContent = 'Create Your Room';
        if (descriptionText) descriptionText.textContent = 'Enter a name and an optional custom code to start a new collaborative session.';
    };

    window.showJoinRoom = function () {
        hideAll();
        if (joinRoomForm) joinRoomForm.style.display = 'flex';
        if (titleText) titleText.textContent = 'Join a Room';
        if (descriptionText) descriptionText.textContent = 'Enter the unique room code provided by the host to join an existing session.';
    };

    window.resetPage = function () {
        hideAll();
        if (actionSelection) actionSelection.style.display = 'flex';
        if (titleText) titleText.textContent = 'Join or Create a Room';
        if (descriptionText) descriptionText.textContent = 'Choose an option below to either create a new collaborative space or join an existing one with a room code.';
    };

    // 3. Attach Event Listeners (using signal for easy cleanup)

    // Create Room Handler
    if (createRoomForm) {
        createRoomForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const nameVal = roomNameInput ? roomNameInput.value : '';
            const codeVal = customCodeInput ? customCodeInput.value : '';
            
            console.log('Creating room with Name:', nameVal, 'and Code:', codeVal);
            
            // TODO: Add actual room creation and redirection logic (e.g., navigate('/board?room=new_id'))
            // Example: socket.emit('create_room', ...)
        }, signal);
    }

    // Join Room Handler
    if (joinRoomForm) {
        joinRoomForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const codeVal = roomCodeInput ? roomCodeInput.value : '';

            console.log('Joining room with Code:', codeVal);
            
            // TODO: Add actual room joining and redirection logic
            // Example: socket.emit('join_room', ...)
        }, signal);
    }

    // Back Buttons Handler
    backButtons.forEach(button => {
        button.addEventListener('click', window.resetPage, signal);
    });

    // Initialize view
    window.resetPage();
};

/**
 * Cleans up event listeners and resets global state when leaving the room page.
 */
window.cleanupRoom = function() {
    console.log("Cleaning up Room Page Logic...");
    
    // Remove event listeners
    if (roomAbortController) {
        roomAbortController.abort();
        roomAbortController = null;
    }

    // Optional: Nullify DOM references to prevent memory leaks
    window.showCreateRoom = null;
    window.showJoinRoom = null;
    window.resetPage = null;
};

// Check if script was loaded after DOM ready (hot reload/direct navigation)
if (document.getElementById('action-selection')) {
    window.initRoom();
}
