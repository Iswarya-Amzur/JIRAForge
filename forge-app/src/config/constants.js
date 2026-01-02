/**
 * Application-wide constants
 */

// Screenshot Configuration
export const SCREENSHOT_THUMBNAIL_SIZE = { width: 400, height: 300 };
export const SCREENSHOT_QUALITY = 70;
export const SCREENSHOT_THUMBNAIL_FORMAT = 'jpg';
export const SCREENSHOT_FULL_FORMAT = 'png';
export const SIGNED_URL_EXPIRY = 3600; // 1 hour in seconds
export const MAX_SCREENSHOTS_PER_PAGE = 50;
export const DEFAULT_SCREENSHOT_INTERVAL = 300; // 5 minutes in seconds

// BRD Configuration
export const ALLOWED_BRD_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword'
];
export const MAX_BRD_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

// Jira Configuration
export const JQL_ACTIVE_STATUSES = ['In Progress'];
export const MAX_JIRA_SEARCH_RESULTS = 50;
export const ISSUE_BATCH_SIZE = 20;

// Permission Configuration
export const REQUIRED_ADMIN_PERMISSION = 'ADMINISTER';
export const REQUIRED_PROJECT_ADMIN_PERMISSION = 'ADMINISTER_PROJECTS';
export const REQUIRED_CREATE_PERMISSION = 'CREATE_ISSUES';
export const REQUIRED_EDIT_PERMISSION = 'EDIT_ISSUES';

// Cache Configuration
export const ISSUE_CACHE_TTL = 120000; // 2 minutes in milliseconds

// Storage Configuration
export const STORAGE_BUCKET_SCREENSHOTS = 'screenshots';
export const STORAGE_BUCKET_DOCUMENTS = 'documents';

// Default Settings (Global Admin Settings - stored in Forge storage)
export const DEFAULT_SETTINGS = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  supabaseServiceRoleKey: '',
  aiServerUrl: '',
  aiServerApiKey: ''
};

// Default Tracking/Timesheet Settings (for screenshot monitoring, app lists, etc.)
export const DEFAULT_TRACKING_SETTINGS = {
  screenshotMonitoringEnabled: true,
  screenshotIntervalSeconds: 900, // 15 minutes
  intervalTrackingEnabled: true, // Capture at fixed intervals
  eventTrackingEnabled: false, // Capture on activity changes
  trackWindowChanges: true,
  trackIdleTime: true,
  idleThresholdSeconds: 300, // 5 minutes
  whitelistEnabled: true,
  whitelistedApps: ['vscode', 'code', 'chrome', 'slack', 'jira', 'github', 'zoom', 'teams', 'postman'],
  blacklistEnabled: true,
  blacklistedApps: ['netflix', 'youtube', 'spotify', 'facebook', 'instagram', 'twitter', 'tiktok'],
  nonWorkThresholdPercent: 30,
  flagExcessiveNonWork: true,
  privateSitesEnabled: true,
  privateSites: []
};

// Pagination
export const DEFAULT_PAGINATION_LIMIT = 50;
export const DEFAULT_PAGINATION_OFFSET = 0;

// Time Analytics
export const MAX_DAILY_SUMMARY_DAYS = 30;
export const MAX_WEEKLY_SUMMARY_WEEKS = 12;
export const MAX_ISSUES_IN_ANALYTICS = 50;
