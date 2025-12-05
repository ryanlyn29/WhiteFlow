// Load partial HTML into a container
async function loadHTML(path, containerId) {
    const container = document.getElementById(containerId);
    try {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<p>Error loading page: ${path}</p>`;
        console.error("Failed to load HTML:", path, err);
    }
}

// --- ROUTER ---

// Get the base path from the current location
function getBasePath() {
    const path = window.location.pathname;
    // If accessing mainapp.html or index.html, get the directory
    if (path.includes('/src/')) {
        return '/src';
    }
    return '';
}

const BASE_PATH = getBasePath();
console.log("Base path detected:", BASE_PATH || "(root)");

// Centralized route map
const routes = {
    "/": "Pages/homepage.html",
    "/home": "Pages/homepage.html",
    "/board": "Pages/board.html",
    "/chat": "Pages/chats.html",
    "/login": "Pages/login.html",
    "/signin": "Pages/signin.html",
    "/room": "Pages/room.html",
};

// Normalize path helper - removes base path and trailing slashes
function normalizePath(path) {
    // Remove base path if present
    if (BASE_PATH && path.startsWith(BASE_PATH)) {
        path = path.substring(BASE_PATH.length);
    }
    // Remove trailing slash, but keep single "/" as is
    path = path.replace(/\/$/, "") || "/";
    return path;
}

// Build full path with base
function buildPath(route) {
    return BASE_PATH + route;
}

// Optimized Script Loader
// 1. Checks if script is already loaded to prevent redundant network requests.
// 2. Returns promise for async/await usage.
const loadScript = (src) => {
    return new Promise((resolve, reject) => {
        // Check if script already exists (performance optimization)
        const existing = document.querySelector(`script[src^="${src}"]`);
        if (existing) {
            return resolve(); // Already loaded, resolve immediately
        }
        
        const script = document.createElement("script");
        script.src = src; // Browser handles caching headers automatically
        script.async = true; // Non-blocking
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
    });
};

// Helper to ensure Socket is ready before init
async function getSocket() {
    if (window.socket) return window.socket;
    return new Promise(resolve => {
        if (typeof io !== 'undefined') {
            window.socket = io();
            resolve(window.socket);
        } else {
            // Fallback polling only if io script is loading but not ready
            const i = setInterval(() => {
                if (typeof io !== 'undefined') {
                    clearInterval(i);
                    window.socket = io();
                    resolve(window.socket);
                }
            }, 10);
        }
    });
}

// Navigate to a route (no reload)
async function navigate(path) {
    const pageContainer = document.getElementById("page-content");
    const navbarContainer = document.getElementById("navbar-container");

    // Normalize path
    path = normalizePath(path);
    console.log("Navigating to:", path);

    // Check for a valid route
    const route = routes[path] || null;
    if (!route) {
        pageContainer.innerHTML = `<h2>404 Page Not Found</h2><p>Path: ${path}</p>`;
        window.history.replaceState({}, "", buildPath(path));
        if (window.setActiveNavState) window.setActiveNavState();
        return;
    }

    // --- Navigation Cleanup & Reset ---
    
    // 1. Clean up homepage scroll listener
    if (window.homepageScrollListener) {
        window.removeEventListener('scroll', window.homepageScrollListener);
        window.homepageScrollListener = null;
    }

    // 2. Reset Navbar Appearance
    const navbar = document.getElementById('mainNavbar');
    if (navbar) {
        navbar.classList.remove('navbar-blur');
    }

    // 3. CLEANUP ROOM JS (Prevent duplicate listeners)
    if (window.cleanupRoom) {
        window.cleanupRoom();
    }

    // 4. Reset scroll position to top
    window.scrollTo(0, 0);

    // Show/Hide Navbar based on route
    if (navbarContainer) {
        if (path === "/board" || path === "/chat" || path === "/login" || path === "/signin") {
            navbarContainer.style.display = 'none';
        } else {
            navbarContainer.style.display = '';
        }
    }

    // 5. Load HTML Content (Wait for this to ensure DOM exists)
    await loadHTML(route, "page-content");

    // Update Navbar Active State
    if (window.setActiveNavState) window.setActiveNavState();

    // ----------------------------------------------------------------------
    // --- LOAD ROUTE-SPECIFIC JS ---
    // ----------------------------------------------------------------------

    // --- HOMEPAGE ROUTE ---
    if (path === "/" || path === "/home") {
        try {
            await loadScript("javascript/homepage.js");
            if (window.initHomepage) window.initHomepage();
        } catch (err) {
            console.error("Failed to load homepage script:", err);
        }
    }

    // --- BOARD ROUTE (Optimized for Speed & Race Conditions) ---
    else if (path === "/board") {
        try {
            // 1. Load all scripts in parallel (Performance Boost)
            await Promise.all([
                loadScript("javascript/games.js"),
                loadScript("javascript/board.js"),
                loadScript("javascript/chat.js"),
                loadScript("javascript/pomodoro.js")
            ]);

            // 2. Ensure socket is ready (Prevent connection errors)
            await getSocket();

            // 3. Initialize synchronously in correct order (No Timeouts)
            // Fixes "Blank Menu" by ensuring DOM + Scripts + Socket are ready
            if (window.initGames) window.initGames();
            if (window.initBoard) window.initBoard();
            if (window.initChat) window.initChat();
            if (window.initPomodoro) window.initPomodoro();

        } catch (err) {
            console.error("Failed to load board scripts:", err);
        }
    } 
    
    // --- AUTH ROUTES ---
    else if (path === "/login") {
        try {
            await loadScript("javascript/login.js");
            // Always dispatch event to handle re-renders
            const event = new Event('DOMContentLoaded');
            document.dispatchEvent(event);
        } catch (err) { console.error(err); }
    } 
    else if (path === "/signin") {
        try {
            await loadScript("javascript/signin.js");
            const event = new Event('DOMContentLoaded');
            document.dispatchEvent(event);
        } catch (err) { console.error(err); }
    }
    
    // --- ROOM ROUTE ---
    else if (path === "/room") { 
        try {
            await loadScript("javascript/room.js"); 
            // ALWAYS initialize when entering this route
            if (window.initRoom) window.initRoom();
        } catch (err) { console.error(err); }
    }
}

// Initialize the SPA
async function initApp() {
    console.log("Initializing app...");

    // --- Inject Socket.IO Client (Optimized) ---
    if (!window.socket) {
        if (!document.querySelector('script[src="/socket.io/socket.io.js"]')) {
            const socketScript = document.createElement('script');
            socketScript.src = '/socket.io/socket.io.js';
            socketScript.async = true; 
            document.head.appendChild(socketScript);
            
            // We don't await the script load here to allow UI to render first
            // navigate() handles the await if the route needs the socket
        }
    }

    // --- Load the Navbar First ---
    await loadHTML("components/navbar.html", "navbar-container");
    await loadScript("javascript/navbar.js");
    if (window.initNavbar) window.initNavbar();

    // --- Initial route ---
    const initialPath = window.location.pathname;
    
    if (initialPath.endsWith('mainapp.html') || initialPath.endsWith('index.html')) {
        window.history.replaceState({}, "", buildPath('/'));
        await navigate('/');
    } else {
        await navigate(initialPath);
    }

    // --- Handle link clicks (SPA) ---
    document.body.addEventListener("click", (e) => {
        const link = e.target.closest("a[href]");
        if (!link) return;
        const href = link.getAttribute("href");
        if (!href || href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) return;

        try {
            const url = new URL(href, window.location.origin);
            const path = normalizePath(url.pathname);
            if (routes[path]) {
                e.preventDefault();
                window.history.pushState({}, "", buildPath(path));
                navigate(path);
            }
        } catch (err) {
            console.error("Error processing link:", href, err);
        }
    });

    // --- Handle browser navigation ---
    window.addEventListener("popstate", () => {
        navigate(window.location.pathname);
    });

    console.log("App initialized successfully");
}

// --- Boot up ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
