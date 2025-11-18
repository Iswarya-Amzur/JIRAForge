const { ipcRenderer } = require('electron');

// Tab switching
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;

        // Remove active class from all tabs and contents
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        // Add active class to clicked tab and corresponding content
        btn.classList.add('active');
        document.getElementById(tabId).classList.add('active');
    });
});

// Dashboard elements
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const statusIndicator = document.getElementById('tracking-status');
const statusText = document.getElementById('status-text');
const authCard = document.getElementById('auth-card');
const authBtn = document.getElementById('auth-btn');
const statsGrid = document.getElementById('stats-grid');

// Settings elements
const supabaseUrlInput = document.getElementById('supabase-url');
const supabaseKeyInput = document.getElementById('supabase-key');
const screenshotIntervalInput = document.getElementById('screenshot-interval');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const settingsMessage = document.getElementById('settings-message');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');

// Screenshots elements
const screenshotsGrid = document.getElementById('screenshots-grid');
const refreshScreenshotsBtn = document.getElementById('refresh-screenshots-btn');

// Load settings on startup
loadSettings();

// Event Listeners
startBtn.addEventListener('click', () => {
    ipcRenderer.send('start-tracking');
    updateTrackingUI(true);
});

pauseBtn.addEventListener('click', () => {
    ipcRenderer.send('pause-tracking');
    updateTrackingUI(false);
});

authBtn.addEventListener('click', () => {
    ipcRenderer.send('start-auth');
});

saveSettingsBtn.addEventListener('click', () => {
    const settings = {
        supabaseUrl: supabaseUrlInput.value,
        supabaseAnonKey: supabaseKeyInput.value,
        screenshotInterval: parseInt(screenshotIntervalInput.value)
    };

    ipcRenderer.send('save-settings', settings);
});

logoutBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
        ipcRenderer.send('logout');
    }
});

refreshScreenshotsBtn.addEventListener('click', () => {
    loadScreenshots();
});

// IPC Listeners
ipcRenderer.on('settings', (event, settings) => {
    supabaseUrlInput.value = settings.supabaseUrl || '';
    screenshotIntervalInput.value = settings.screenshotInterval || 300;
    updateTrackingUI(settings.isTracking);

    if (settings.hasAuth) {
        authCard.style.display = 'none';
        statsGrid.style.display = 'grid';
    } else {
        authCard.style.display = 'block';
        statsGrid.style.display = 'none';
    }
});

ipcRenderer.on('settings-saved', () => {
    showMessage(settingsMessage, 'Settings saved successfully!', 'success');
});

ipcRenderer.on('tracking-status', (event, isTracking) => {
    updateTrackingUI(isTracking);
});

ipcRenderer.on('error', (event, message) => {
    alert(`Error: ${message}`);
});

ipcRenderer.on('auth-error', (event, message) => {
    alert(`Authentication error: ${message}`);
});

ipcRenderer.on('logged-out', () => {
    authCard.style.display = 'block';
    statsGrid.style.display = 'none';
    userInfo.innerHTML = '<p>Not signed in</p>';
});

ipcRenderer.on('navigate-to', (event, tab) => {
    const tabBtn = document.querySelector(`[data-tab="${tab}"]`);
    if (tabBtn) {
        tabBtn.click();
    }
});

// Helper Functions
function loadSettings() {
    ipcRenderer.send('get-settings');
}

function updateTrackingUI(isTracking) {
    if (isTracking) {
        statusIndicator.classList.add('active');
        statusText.textContent = 'Tracking active';
        startBtn.disabled = true;
        pauseBtn.disabled = false;
    } else {
        statusIndicator.classList.remove('active');
        statusText.textContent = 'Not tracking';
        startBtn.disabled = false;
        pauseBtn.disabled = true;
    }
}

function showMessage(element, message, type) {
    element.textContent = message;
    element.className = `message ${type} show`;

    setTimeout(() => {
        element.classList.remove('show');
    }, 5000);
}

async function loadScreenshots() {
    // This would normally fetch from Supabase
    // For now, show a placeholder
    screenshotsGrid.innerHTML = '<p class="empty-state">Screenshot loading not yet implemented. This will fetch screenshots from Supabase.</p>';
}

// Auto-refresh screenshots when tab is visible
const screenshotsTab = document.querySelector('[data-tab="screenshots"]');
if (screenshotsTab) {
    screenshotsTab.addEventListener('click', () => {
        loadScreenshots();
    });
}
