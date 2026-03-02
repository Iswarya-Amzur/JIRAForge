/**
 * Application Alias Database
 * 
 * Maps canonical application keys to their display names and all known identifiers.
 * When an admin searches for an app, we search across all aliases and identifiers.
 * The selected identifier gets stored in the database.
 * 
 * Structure:
 * - key: canonical app key (lowercase, no spaces)
 * - displayName: Human-readable name shown in UI
 * - identifiers: Array of known process names, executable names, bundle IDs
 * - category: App category for organization
 * - defaultClassification: Suggested classification (productive/non_productive/private)
 */

export const APP_ALIAS_DATABASE = {
  // ============================================================================
  // IDEs & Code Editors
  // ============================================================================
  vscode: {
    displayName: 'Visual Studio Code',
    identifiers: ['code.exe', 'Code.app', 'code', 'vscode', 'Visual Studio Code'],
    category: 'IDE',
    defaultClassification: 'productive',
  },
  visualstudio: {
    displayName: 'Visual Studio',
    identifiers: ['devenv.exe', 'Visual Studio', 'vs', 'visualstudio'],
    category: 'IDE',
    defaultClassification: 'productive',
  },
  cursor: {
    displayName: 'Cursor',
    identifiers: ['cursor.exe', 'Cursor.app', 'cursor', 'Cursor IDE'],
    category: 'IDE',
    defaultClassification: 'productive',
  },
  intellij: {
    displayName: 'IntelliJ IDEA',
    identifiers: ['idea64.exe', 'idea.exe', 'IntelliJ IDEA.app', 'intellij', 'idea'],
    category: 'IDE',
    defaultClassification: 'productive',
  },
  pycharm: {
    displayName: 'PyCharm',
    identifiers: ['pycharm64.exe', 'pycharm.exe', 'PyCharm.app', 'pycharm'],
    category: 'IDE',
    defaultClassification: 'productive',
  },
  webstorm: {
    displayName: 'WebStorm',
    identifiers: ['webstorm64.exe', 'webstorm.exe', 'WebStorm.app', 'webstorm'],
    category: 'IDE',
    defaultClassification: 'productive',
  },
  phpstorm: {
    displayName: 'PhpStorm',
    identifiers: ['phpstorm64.exe', 'phpstorm.exe', 'PhpStorm.app', 'phpstorm'],
    category: 'IDE',
    defaultClassification: 'productive',
  },
  rider: {
    displayName: 'JetBrains Rider',
    identifiers: ['rider64.exe', 'rider.exe', 'Rider.app', 'rider'],
    category: 'IDE',
    defaultClassification: 'productive',
  },
  goland: {
    displayName: 'GoLand',
    identifiers: ['goland64.exe', 'goland.exe', 'GoLand.app', 'goland'],
    category: 'IDE',
    defaultClassification: 'productive',
  },
  sublime: {
    displayName: 'Sublime Text',
    identifiers: ['sublime_text.exe', 'Sublime Text.app', 'sublime', 'subl'],
    category: 'IDE',
    defaultClassification: 'productive',
  },
  notepadplusplus: {
    displayName: 'Notepad++',
    identifiers: ['notepad++.exe', 'notepad++', 'npp'],
    category: 'IDE',
    defaultClassification: 'productive',
  },
  eclipse: {
    displayName: 'Eclipse',
    identifiers: ['eclipse.exe', 'Eclipse.app', 'eclipse'],
    category: 'IDE',
    defaultClassification: 'productive',
  },
  atom: {
    displayName: 'Atom',
    identifiers: ['atom.exe', 'Atom.app', 'atom'],
    category: 'IDE',
    defaultClassification: 'productive',
  },
  androidstudio: {
    displayName: 'Android Studio',
    identifiers: ['AndroidStudio64.exe', 'Android Studio.app', 'androidstudio', 'studio64.exe'],
    category: 'IDE',
    defaultClassification: 'productive',
  },
  xcode: {
    displayName: 'Xcode',
    identifiers: ['Xcode.app', 'xcode'],
    category: 'IDE',
    defaultClassification: 'productive',
  },
  zed: {
    displayName: 'Zed Editor',
    identifiers: ['zed.exe', 'Zed.app', 'zed'],
    category: 'IDE',
    defaultClassification: 'productive',
  },
  neovim: {
    displayName: 'Neovim',
    identifiers: ['nvim.exe', 'nvim-qt.exe', 'nvim', 'neovim'],
    category: 'IDE',
    defaultClassification: 'productive',
  },
  vim: {
    displayName: 'Vim',
    identifiers: ['vim.exe', 'gvim.exe', 'vim', 'gvim'],
    category: 'IDE',
    defaultClassification: 'productive',
  },

  // ============================================================================
  // Browsers
  // ============================================================================
  chrome: {
    displayName: 'Google Chrome',
    identifiers: ['chrome.exe', 'Google Chrome.app', 'chrome', 'googlechrome'],
    category: 'Browser',
    defaultClassification: 'productive',
  },
  firefox: {
    displayName: 'Mozilla Firefox',
    identifiers: ['firefox.exe', 'Firefox.app', 'firefox', 'mozillafirefox'],
    category: 'Browser',
    defaultClassification: 'productive',
  },
  edge: {
    displayName: 'Microsoft Edge',
    identifiers: ['msedge.exe', 'Microsoft Edge.app', 'edge', 'msedge'],
    category: 'Browser',
    defaultClassification: 'productive',
  },
  safari: {
    displayName: 'Safari',
    identifiers: ['Safari.app', 'safari'],
    category: 'Browser',
    defaultClassification: 'productive',
  },
  brave: {
    displayName: 'Brave Browser',
    identifiers: ['brave.exe', 'Brave Browser.app', 'brave'],
    category: 'Browser',
    defaultClassification: 'productive',
  },
  opera: {
    displayName: 'Opera',
    identifiers: ['opera.exe', 'Opera.app', 'opera'],
    category: 'Browser',
    defaultClassification: 'productive',
  },
  vivaldi: {
    displayName: 'Vivaldi',
    identifiers: ['vivaldi.exe', 'Vivaldi.app', 'vivaldi'],
    category: 'Browser',
    defaultClassification: 'productive',
  },
  arc: {
    displayName: 'Arc Browser',
    identifiers: ['arc.exe', 'Arc.app', 'arc'],
    category: 'Browser',
    defaultClassification: 'productive',
  },

  // ============================================================================
  // Communication & Collaboration
  // ============================================================================
  slack: {
    displayName: 'Slack',
    identifiers: ['slack.exe', 'Slack.app', 'slack'],
    category: 'Communication',
    defaultClassification: 'productive',
  },
  teams: {
    displayName: 'Microsoft Teams',
    identifiers: ['Teams.exe', 'ms-teams.exe', 'Microsoft Teams.app', 'teams', 'msteams'],
    category: 'Communication',
    defaultClassification: 'productive',
  },
  zoom: {
    displayName: 'Zoom',
    identifiers: ['Zoom.exe', 'zoom.us.app', 'zoom', 'zoomus', 'Zoom Workplace.exe'],
    category: 'Communication',
    defaultClassification: 'productive',
  },
  discord: {
    displayName: 'Discord',
    identifiers: ['Discord.exe', 'Discord.app', 'discord'],
    category: 'Communication',
    defaultClassification: 'productive',
  },
  skype: {
    displayName: 'Skype',
    identifiers: ['Skype.exe', 'Skype.app', 'skype'],
    category: 'Communication',
    defaultClassification: 'productive',
  },
  webex: {
    displayName: 'Cisco Webex',
    identifiers: ['Webex.exe', 'Webex.app', 'webex', 'CiscoWebex'],
    category: 'Communication',
    defaultClassification: 'productive',
  },
  telegram: {
    displayName: 'Telegram',
    identifiers: ['Telegram.exe', 'Telegram.app', 'telegram', 'telegramdesktop'],
    category: 'Communication',
    defaultClassification: 'productive',
  },
  whatsapp: {
    displayName: 'WhatsApp',
    identifiers: ['WhatsApp.exe', 'WhatsApp.app', 'whatsapp', 'whatsappdesktop'],
    category: 'Communication',
    defaultClassification: 'productive',
  },

  // ============================================================================
  // Office & Productivity
  // ============================================================================
  word: {
    displayName: 'Microsoft Word',
    identifiers: ['WINWORD.EXE', 'Microsoft Word.app', 'word', 'winword'],
    category: 'Office',
    defaultClassification: 'productive',
  },
  excel: {
    displayName: 'Microsoft Excel',
    identifiers: ['EXCEL.EXE', 'Microsoft Excel.app', 'excel'],
    category: 'Office',
    defaultClassification: 'productive',
  },
  powerpoint: {
    displayName: 'Microsoft PowerPoint',
    identifiers: ['POWERPNT.EXE', 'Microsoft PowerPoint.app', 'powerpoint', 'ppt'],
    category: 'Office',
    defaultClassification: 'productive',
  },
  outlook: {
    displayName: 'Microsoft Outlook',
    identifiers: ['OUTLOOK.EXE', 'Microsoft Outlook.app', 'outlook'],
    category: 'Office',
    defaultClassification: 'productive',
  },
  onenote: {
    displayName: 'Microsoft OneNote',
    identifiers: ['ONENOTE.EXE', 'Microsoft OneNote.app', 'onenote'],
    category: 'Office',
    defaultClassification: 'productive',
  },
  notion: {
    displayName: 'Notion',
    identifiers: ['Notion.exe', 'Notion.app', 'notion'],
    category: 'Office',
    defaultClassification: 'productive',
  },
  obsidian: {
    displayName: 'Obsidian',
    identifiers: ['Obsidian.exe', 'Obsidian.app', 'obsidian'],
    category: 'Office',
    defaultClassification: 'productive',
  },
  evernote: {
    displayName: 'Evernote',
    identifiers: ['Evernote.exe', 'Evernote.app', 'evernote'],
    category: 'Office',
    defaultClassification: 'productive',
  },

  // ============================================================================
  // Design & Creative
  // ============================================================================
  figma: {
    displayName: 'Figma',
    identifiers: ['Figma.exe', 'Figma.app', 'figma'],
    category: 'Design',
    defaultClassification: 'productive',
  },
  photoshop: {
    displayName: 'Adobe Photoshop',
    identifiers: ['Photoshop.exe', 'Adobe Photoshop.app', 'photoshop', 'ps'],
    category: 'Design',
    defaultClassification: 'productive',
  },
  illustrator: {
    displayName: 'Adobe Illustrator',
    identifiers: ['Illustrator.exe', 'Adobe Illustrator.app', 'illustrator', 'ai'],
    category: 'Design',
    defaultClassification: 'productive',
  },
  xd: {
    displayName: 'Adobe XD',
    identifiers: ['XD.exe', 'Adobe XD.app', 'xd', 'adobexd'],
    category: 'Design',
    defaultClassification: 'productive',
  },
  aftereffects: {
    displayName: 'Adobe After Effects',
    identifiers: ['AfterFX.exe', 'Adobe After Effects.app', 'aftereffects', 'ae'],
    category: 'Design',
    defaultClassification: 'productive',
  },
  premiere: {
    displayName: 'Adobe Premiere Pro',
    identifiers: ['Premiere Pro.exe', 'Adobe Premiere Pro.app', 'premiere', 'premierepro'],
    category: 'Design',
    defaultClassification: 'productive',
  },
  indesign: {
    displayName: 'Adobe InDesign',
    identifiers: ['InDesign.exe', 'Adobe InDesign.app', 'indesign', 'id'],
    category: 'Design',
    defaultClassification: 'productive',
  },
  sketch: {
    displayName: 'Sketch',
    identifiers: ['Sketch.app', 'sketch'],
    category: 'Design',
    defaultClassification: 'productive',
  },
  blender: {
    displayName: 'Blender',
    identifiers: ['Blender.exe', 'Blender.app', 'blender'],
    category: 'Design',
    defaultClassification: 'productive',
  },
  autocad: {
    displayName: 'AutoCAD',
    identifiers: ['AutoCAD.exe', 'AutoCAD.app', 'autocad', 'acad'],
    category: 'Design',
    defaultClassification: 'productive',
  },

  // ============================================================================
  // Dev Tools & API
  // ============================================================================
  postman: {
    displayName: 'Postman',
    identifiers: ['Postman.exe', 'Postman.app', 'postman'],
    category: 'DevTools',
    defaultClassification: 'productive',
  },
  insomnia: {
    displayName: 'Insomnia',
    identifiers: ['insomnia.exe', 'Insomnia.app', 'insomnia'],
    category: 'DevTools',
    defaultClassification: 'productive',
  },
  docker: {
    displayName: 'Docker Desktop',
    identifiers: ['Docker Desktop.exe', 'docker.exe', 'Docker.app', 'docker', 'com.docker.backend.exe'],
    category: 'DevTools',
    defaultClassification: 'productive',
  },
  github: {
    displayName: 'GitHub Desktop',
    identifiers: ['GitHubDesktop.exe', 'GitHub Desktop.app', 'github', 'githubdesktop'],
    category: 'DevTools',
    defaultClassification: 'productive',
  },
  sourcetree: {
    displayName: 'Sourcetree',
    identifiers: ['SourceTree.exe', 'Sourcetree.app', 'sourcetree'],
    category: 'DevTools',
    defaultClassification: 'productive',
  },
  gitkraken: {
    displayName: 'GitKraken',
    identifiers: ['gitkraken.exe', 'GitKraken.app', 'gitkraken'],
    category: 'DevTools',
    defaultClassification: 'productive',
  },

  // ============================================================================
  // Database Tools
  // ============================================================================
  dbeaver: {
    displayName: 'DBeaver',
    identifiers: ['dbeaver.exe', 'DBeaver.app', 'dbeaver'],
    category: 'Database',
    defaultClassification: 'productive',
  },
  pgadmin: {
    displayName: 'pgAdmin',
    identifiers: ['pgAdmin4.exe', 'pgAdmin 4.app', 'pgadmin', 'pgadmin4'],
    category: 'Database',
    defaultClassification: 'productive',
  },
  ssms: {
    displayName: 'SQL Server Management Studio',
    identifiers: ['ssms.exe', 'ssms', 'Ssms.exe'],
    category: 'Database',
    defaultClassification: 'productive',
  },
  datagrip: {
    displayName: 'DataGrip',
    identifiers: ['DataGrip64.exe', 'datagrip.exe', 'DataGrip.app', 'datagrip'],
    category: 'Database',
    defaultClassification: 'productive',
  },
  mongodbcompass: {
    displayName: 'MongoDB Compass',
    identifiers: ['MongoDB Compass.exe', 'MongoDB Compass.app', 'mongodbcompass', 'compass'],
    category: 'Database',
    defaultClassification: 'productive',
  },
  mysqlworkbench: {
    displayName: 'MySQL Workbench',
    identifiers: ['MySQLWorkbench.exe', 'MySQLWorkbench.app', 'mysqlworkbench'],
    category: 'Database',
    defaultClassification: 'productive',
  },

  // ============================================================================
  // Terminals
  // ============================================================================
  windowsterminal: {
    displayName: 'Windows Terminal',
    identifiers: ['WindowsTerminal.exe', 'wt.exe', 'windowsterminal', 'wt'],
    category: 'Terminal',
    defaultClassification: 'productive',
  },
  powershell: {
    displayName: 'PowerShell',
    identifiers: ['powershell.exe', 'pwsh.exe', 'powershell', 'pwsh'],
    category: 'Terminal',
    defaultClassification: 'productive',
  },
  cmd: {
    displayName: 'Command Prompt',
    identifiers: ['cmd.exe', 'cmd'],
    category: 'Terminal',
    defaultClassification: 'productive',
  },
  gitbash: {
    displayName: 'Git Bash',
    identifiers: ['git-bash.exe', 'mintty.exe', 'gitbash'],
    category: 'Terminal',
    defaultClassification: 'productive',
  },
  iterm: {
    displayName: 'iTerm2',
    identifiers: ['iTerm.app', 'iterm', 'iterm2'],
    category: 'Terminal',
    defaultClassification: 'productive',
  },
  terminal: {
    displayName: 'Terminal (macOS)',
    identifiers: ['Terminal.app', 'terminal'],
    category: 'Terminal',
    defaultClassification: 'productive',
  },

  // ============================================================================
  // Non-Productive: Entertainment & Media
  // ============================================================================
  spotify: {
    displayName: 'Spotify',
    identifiers: ['spotify.exe', 'Spotify.app', 'spotify'],
    category: 'Entertainment',
    defaultClassification: 'non_productive',
  },
  netflix: {
    displayName: 'Netflix',
    identifiers: ['Netflix.exe', 'Netflix.app', 'netflix'],
    category: 'Entertainment',
    defaultClassification: 'non_productive',
  },
  vlc: {
    displayName: 'VLC Media Player',
    identifiers: ['vlc.exe', 'VLC.app', 'vlc'],
    category: 'Entertainment',
    defaultClassification: 'non_productive',
  },
  twitch: {
    displayName: 'Twitch',
    identifiers: ['Twitch.exe', 'Twitch.app', 'twitch'],
    category: 'Entertainment',
    defaultClassification: 'non_productive',
  },
  itunes: {
    displayName: 'iTunes',
    identifiers: ['iTunes.exe', 'iTunes.app', 'itunes'],
    category: 'Entertainment',
    defaultClassification: 'non_productive',
  },

  // ============================================================================
  // Non-Productive: Gaming
  // ============================================================================
  steam: {
    displayName: 'Steam',
    identifiers: ['steam.exe', 'Steam.app', 'steam', 'steamwebhelper.exe'],
    category: 'Gaming',
    defaultClassification: 'non_productive',
  },
  epicgames: {
    displayName: 'Epic Games Launcher',
    identifiers: ['epicgameslauncher.exe', 'Epic Games Launcher.app', 'epicgames'],
    category: 'Gaming',
    defaultClassification: 'non_productive',
  },
  battlenet: {
    displayName: 'Battle.net',
    identifiers: ['Battle.net.exe', 'Battle.net.app', 'battlenet', 'bnet'],
    category: 'Gaming',
    defaultClassification: 'non_productive',
  },
  origin: {
    displayName: 'EA Origin',
    identifiers: ['Origin.exe', 'Origin.app', 'origin', 'ea'],
    category: 'Gaming',
    defaultClassification: 'non_productive',
  },

  // ============================================================================
  // Private: Password Managers
  // ============================================================================
  onepassword: {
    displayName: '1Password',
    identifiers: ['1Password.exe', '1Password.app', '1password', 'onepassword'],
    category: 'Security',
    defaultClassification: 'private',
  },
  bitwarden: {
    displayName: 'Bitwarden',
    identifiers: ['Bitwarden.exe', 'Bitwarden.app', 'bitwarden'],
    category: 'Security',
    defaultClassification: 'private',
  },
  keepass: {
    displayName: 'KeePass',
    identifiers: ['KeePass.exe', 'KeePass.app', 'keepass'],
    category: 'Security',
    defaultClassification: 'private',
  },
  lastpass: {
    displayName: 'LastPass',
    identifiers: ['LastPass.exe', 'LastPass.app', 'lastpass'],
    category: 'Security',
    defaultClassification: 'private',
  },
  dashlane: {
    displayName: 'Dashlane',
    identifiers: ['Dashlane.exe', 'Dashlane.app', 'dashlane'],
    category: 'Security',
    defaultClassification: 'private',
  },

  // ============================================================================
  // Low-Code / No-Code Platforms
  // ============================================================================
  base44: {
    displayName: 'Base44',
    identifiers: ['base44.exe', 'Base44.app', 'base44', 'Base44'],
    category: 'Low-Code Platform',
    defaultClassification: 'productive',
  },
};

/**
 * Search the alias database for matching applications
 * @param {string} query - Search query from the user
 * @returns {Array} Array of matching app entries with canonical key, display name, and identifiers
 */
export function searchAppAliases(query) {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();
  const results = [];

  for (const [canonicalKey, appData] of Object.entries(APP_ALIAS_DATABASE)) {
    // Check if query matches canonical key, display name, or any identifier
    const matchesKey = canonicalKey.includes(normalizedQuery);
    const matchesDisplayName = appData.displayName.toLowerCase().includes(normalizedQuery);
    const matchesIdentifier = appData.identifiers.some(id => 
      id.toLowerCase().includes(normalizedQuery)
    );

    if (matchesKey || matchesDisplayName || matchesIdentifier) {
      results.push({
        canonicalKey,
        displayName: appData.displayName,
        identifiers: appData.identifiers,
        category: appData.category,
        defaultClassification: appData.defaultClassification,
        // Compute relevance score for sorting
        relevanceScore: matchesDisplayName ? 3 : (matchesKey ? 2 : 1),
      });
    }
  }

  // Sort by relevance score (higher first), then alphabetically
  return results.sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    return a.displayName.localeCompare(b.displayName);
  });
}

/**
 * Get all categories from the database
 * @returns {Array} Sorted array of unique categories
 */
export function getCategories() {
  const categories = new Set();
  for (const appData of Object.values(APP_ALIAS_DATABASE)) {
    categories.add(appData.category);
  }
  return Array.from(categories).sort();
}

/**
 * Get all apps in a specific category
 * @param {string} category - Category name
 * @returns {Array} Array of app entries in that category
 */
export function getAppsByCategory(category) {
  return Object.entries(APP_ALIAS_DATABASE)
    .filter(([_, appData]) => appData.category === category)
    .map(([canonicalKey, appData]) => ({
      canonicalKey,
      ...appData,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export default APP_ALIAS_DATABASE;
