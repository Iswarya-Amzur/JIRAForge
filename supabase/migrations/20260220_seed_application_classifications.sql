-- ============================================================================
-- Migration: Seed default application classifications
-- Date: 2026-02-20
--
-- Inserts 208 default classification entries (99 process-based, 109 URL-based)
-- for productive, non_productive, and private applications/websites.
-- These are global defaults (organization_id = NULL, is_default = TRUE).
-- ============================================================================

INSERT INTO public.application_classifications (organization_id, project_key, identifier, display_name, classification, match_by, is_default)
VALUES
    -- ========================================================================
    -- PROCESS-BASED: Productive (76 entries)
    -- ========================================================================
    -- IDEs & Code Editors
    (NULL, NULL, 'code.exe', 'Visual Studio Code', 'productive', 'process', TRUE),
    (NULL, NULL, 'devenv.exe', 'Visual Studio', 'productive', 'process', TRUE),
    (NULL, NULL, 'idea64.exe', 'IntelliJ IDEA', 'productive', 'process', TRUE),
    (NULL, NULL, 'pycharm64.exe', 'PyCharm', 'productive', 'process', TRUE),
    (NULL, NULL, 'webstorm64.exe', 'WebStorm', 'productive', 'process', TRUE),
    (NULL, NULL, 'phpstorm64.exe', 'PhpStorm', 'productive', 'process', TRUE),
    (NULL, NULL, 'rider64.exe', 'JetBrains Rider', 'productive', 'process', TRUE),
    (NULL, NULL, 'goland64.exe', 'GoLand', 'productive', 'process', TRUE),
    (NULL, NULL, 'sublime_text.exe', 'Sublime Text', 'productive', 'process', TRUE),
    (NULL, NULL, 'notepad++.exe', 'Notepad++', 'productive', 'process', TRUE),
    (NULL, NULL, 'eclipse.exe', 'Eclipse', 'productive', 'process', TRUE),
    (NULL, NULL, 'atom.exe', 'Atom', 'productive', 'process', TRUE),
    (NULL, NULL, 'cursor.exe', 'Cursor', 'productive', 'process', TRUE),
    (NULL, NULL, 'AndroidStudio64.exe', 'Android Studio', 'productive', 'process', TRUE),

    -- Office & Productivity Suite
    (NULL, NULL, 'WINWORD.EXE', 'Microsoft Word', 'productive', 'process', TRUE),
    (NULL, NULL, 'EXCEL.EXE', 'Microsoft Excel', 'productive', 'process', TRUE),
    (NULL, NULL, 'POWERPNT.EXE', 'Microsoft PowerPoint', 'productive', 'process', TRUE),
    (NULL, NULL, 'ONENOTE.EXE', 'Microsoft OneNote', 'productive', 'process', TRUE),
    (NULL, NULL, 'MSACCESS.EXE', 'Microsoft Access', 'productive', 'process', TRUE),
    (NULL, NULL, 'VISIO.EXE', 'Microsoft Visio', 'productive', 'process', TRUE),
    (NULL, NULL, 'MSPUB.EXE', 'Microsoft Publisher', 'productive', 'process', TRUE),

    -- Design & Creative Tools
    (NULL, NULL, 'Figma.exe', 'Figma', 'productive', 'process', TRUE),
    (NULL, NULL, 'Photoshop.exe', 'Adobe Photoshop', 'productive', 'process', TRUE),
    (NULL, NULL, 'Illustrator.exe', 'Adobe Illustrator', 'productive', 'process', TRUE),
    (NULL, NULL, 'XD.exe', 'Adobe XD', 'productive', 'process', TRUE),
    (NULL, NULL, 'AfterFX.exe', 'Adobe After Effects', 'productive', 'process', TRUE),
    (NULL, NULL, 'Premiere Pro.exe', 'Adobe Premiere Pro', 'productive', 'process', TRUE),
    (NULL, NULL, 'InDesign.exe', 'Adobe InDesign', 'productive', 'process', TRUE),
    (NULL, NULL, 'SketchUp.exe', 'SketchUp', 'productive', 'process', TRUE),
    (NULL, NULL, 'Blender.exe', 'Blender', 'productive', 'process', TRUE),
    (NULL, NULL, 'AutoCAD.exe', 'AutoCAD', 'productive', 'process', TRUE),

    -- API & Dev Tools
    (NULL, NULL, 'Postman.exe', 'Postman', 'productive', 'process', TRUE),
    (NULL, NULL, 'insomnia.exe', 'Insomnia', 'productive', 'process', TRUE),
    (NULL, NULL, 'docker.exe', 'Docker Desktop', 'productive', 'process', TRUE),
    (NULL, NULL, 'com.docker.backend.exe', 'Docker Backend', 'productive', 'process', TRUE),

    -- Git Clients
    (NULL, NULL, 'GitHubDesktop.exe', 'GitHub Desktop', 'productive', 'process', TRUE),
    (NULL, NULL, 'SourceTree.exe', 'Sourcetree', 'productive', 'process', TRUE),
    (NULL, NULL, 'gitkraken.exe', 'GitKraken', 'productive', 'process', TRUE),

    -- Terminals & Shells
    (NULL, NULL, 'WindowsTerminal.exe', 'Windows Terminal', 'productive', 'process', TRUE),
    (NULL, NULL, 'powershell.exe', 'PowerShell', 'productive', 'process', TRUE),
    (NULL, NULL, 'cmd.exe', 'Command Prompt', 'productive', 'process', TRUE),
    (NULL, NULL, 'git-bash.exe', 'Git Bash', 'productive', 'process', TRUE),
    (NULL, NULL, 'putty.exe', 'PuTTY', 'productive', 'process', TRUE),
    (NULL, NULL, 'wsl.exe', 'WSL', 'productive', 'process', TRUE),
    (NULL, NULL, 'mintty.exe', 'MinTTY Git Bash', 'productive', 'process', TRUE),

    -- Database Tools
    (NULL, NULL, 'dbeaver.exe', 'DBeaver', 'productive', 'process', TRUE),
    (NULL, NULL, 'pgAdmin4.exe', 'pgAdmin', 'productive', 'process', TRUE),
    (NULL, NULL, 'ssms.exe', 'SQL Server Management Studio', 'productive', 'process', TRUE),
    (NULL, NULL, 'DataGrip64.exe', 'DataGrip', 'productive', 'process', TRUE),
    (NULL, NULL, 'MongoDB Compass.exe', 'MongoDB Compass', 'productive', 'process', TRUE),
    (NULL, NULL, 'MySQLWorkbench.exe', 'MySQL Workbench', 'productive', 'process', TRUE),

    -- Browsers (classified as productive - URL-based rules handle specific sites)
    (NULL, NULL, 'chrome.exe', 'Google Chrome', 'productive', 'process', TRUE),
    (NULL, NULL, 'msedge.exe', 'Microsoft Edge', 'productive', 'process', TRUE),
    (NULL, NULL, 'firefox.exe', 'Mozilla Firefox', 'productive', 'process', TRUE),
    (NULL, NULL, 'brave.exe', 'Brave Browser', 'productive', 'process', TRUE),
    (NULL, NULL, 'opera.exe', 'Opera', 'productive', 'process', TRUE),
    (NULL, NULL, 'vivaldi.exe', 'Vivaldi', 'productive', 'process', TRUE),
    (NULL, NULL, 'arc.exe', 'Arc Browser', 'productive', 'process', TRUE),

    -- Communication & Collaboration
    (NULL, NULL, 'slack.exe', 'Slack', 'productive', 'process', TRUE),
    (NULL, NULL, 'Teams.exe', 'Microsoft Teams', 'productive', 'process', TRUE),
    (NULL, NULL, 'Zoom.exe', 'Zoom', 'productive', 'process', TRUE),
    (NULL, NULL, 'Discord.exe', 'Discord', 'productive', 'process', TRUE),
    (NULL, NULL, 'Skype.exe', 'Skype', 'productive', 'process', TRUE),
    (NULL, NULL, 'Webex.exe', 'Cisco Webex', 'productive', 'process', TRUE),

    -- Email Clients
    (NULL, NULL, 'OUTLOOK.EXE', 'Microsoft Outlook', 'productive', 'process', TRUE),
    (NULL, NULL, 'Thunderbird.exe', 'Thunderbird', 'productive', 'process', TRUE),

    -- Note-taking & Project Management
    (NULL, NULL, 'Notion.exe', 'Notion', 'productive', 'process', TRUE),
    (NULL, NULL, 'Obsidian.exe', 'Obsidian', 'productive', 'process', TRUE),
    (NULL, NULL, 'Trello.exe', 'Trello', 'productive', 'process', TRUE),
    (NULL, NULL, 'Evernote.exe', 'Evernote', 'productive', 'process', TRUE),

    -- System Utilities
    (NULL, NULL, 'explorer.exe', 'File Explorer', 'productive', 'process', TRUE),
    (NULL, NULL, 'SnippingTool.exe', 'Snipping Tool', 'productive', 'process', TRUE),
    (NULL, NULL, 'mspaint.exe', 'Paint', 'productive', 'process', TRUE),
    (NULL, NULL, 'calc.exe', 'Calculator', 'productive', 'process', TRUE),

    -- PDF Readers
    (NULL, NULL, 'Acrobat.exe', 'Adobe Acrobat', 'productive', 'process', TRUE),
    (NULL, NULL, 'FoxitPDFReader.exe', 'Foxit PDF Reader', 'productive', 'process', TRUE),

    -- ========================================================================
    -- PROCESS-BASED: Non-productive (14 entries)
    -- ========================================================================
    -- Music & Media
    (NULL, NULL, 'spotify.exe', 'Spotify', 'non_productive', 'process', TRUE),

    -- Gaming Platforms
    (NULL, NULL, 'steam.exe', 'Steam', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'steamwebhelper.exe', 'Steam Web Helper', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'epicgameslauncher.exe', 'Epic Games Launcher', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'Battle.net.exe', 'Battle.net', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'Origin.exe', 'EA Origin', 'non_productive', 'process', TRUE),

    -- Media Players
    (NULL, NULL, 'vlc.exe', 'VLC Media Player', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'wmplayer.exe', 'Windows Media Player', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'iTunes.exe', 'iTunes', 'non_productive', 'process', TRUE),

    -- Streaming
    (NULL, NULL, 'Netflix.exe', 'Netflix Desktop', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'Twitch.exe', 'Twitch', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'foobar2000.exe', 'foobar2000', 'non_productive', 'process', TRUE),

    -- Games
    (NULL, NULL, 'CandyCrush*.exe', 'Candy Crush', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'Solitaire.exe', 'Microsoft Solitaire', 'non_productive', 'process', TRUE),

    -- ========================================================================
    -- PROCESS-BASED: Private (9 entries)
    -- ========================================================================
    -- Password Managers
    (NULL, NULL, '1Password.exe', '1Password', 'private', 'process', TRUE),
    (NULL, NULL, 'Bitwarden.exe', 'Bitwarden', 'private', 'process', TRUE),
    (NULL, NULL, 'KeePass.exe', 'KeePass', 'private', 'process', TRUE),
    (NULL, NULL, 'LastPass.exe', 'LastPass', 'private', 'process', TRUE),
    (NULL, NULL, 'Dashlane.exe', 'Dashlane', 'private', 'process', TRUE),

    -- Personal Messaging
    (NULL, NULL, 'WhatsApp.exe', 'WhatsApp', 'private', 'process', TRUE),
    (NULL, NULL, 'Telegram.exe', 'Telegram', 'private', 'process', TRUE),
    (NULL, NULL, 'Signal.exe', 'Signal', 'private', 'process', TRUE),
    (NULL, NULL, 'Messenger.exe', 'Facebook Messenger', 'private', 'process', TRUE),

    -- ========================================================================
    -- URL-BASED: Productive (56 entries)
    -- ========================================================================
    -- Source Control & Developer Platforms
    (NULL, NULL, 'github.com', 'GitHub', 'productive', 'url', TRUE),
    (NULL, NULL, 'gitlab.com', 'GitLab', 'productive', 'url', TRUE),
    (NULL, NULL, 'bitbucket.org', 'Bitbucket', 'productive', 'url', TRUE),

    -- Developer Communities & Learning
    (NULL, NULL, 'stackoverflow.com', 'Stack Overflow', 'productive', 'url', TRUE),
    (NULL, NULL, 'stackexchange.com', 'Stack Exchange', 'productive', 'url', TRUE),
    (NULL, NULL, 'dev.to', 'DEV Community', 'productive', 'url', TRUE),
    (NULL, NULL, 'medium.com', 'Medium', 'productive', 'url', TRUE),

    -- Google Workspace
    (NULL, NULL, 'docs.google.com', 'Google Docs', 'productive', 'url', TRUE),
    (NULL, NULL, 'sheets.google.com', 'Google Sheets', 'productive', 'url', TRUE),
    (NULL, NULL, 'slides.google.com', 'Google Slides', 'productive', 'url', TRUE),
    (NULL, NULL, 'drive.google.com', 'Google Drive', 'productive', 'url', TRUE),

    -- Email & Calendar
    (NULL, NULL, 'mail.google.com', 'Gmail', 'productive', 'url', TRUE),
    (NULL, NULL, 'outlook.office.com', 'Outlook Web', 'productive', 'url', TRUE),
    (NULL, NULL, 'outlook.live.com', 'Outlook.com', 'productive', 'url', TRUE),
    (NULL, NULL, 'calendar.google.com', 'Google Calendar', 'productive', 'url', TRUE),

    -- Video Conferencing
    (NULL, NULL, 'meet.google.com', 'Google Meet', 'productive', 'url', TRUE),
    (NULL, NULL, 'zoom.us', 'Zoom Web', 'productive', 'url', TRUE),

    -- Communication & Collaboration
    (NULL, NULL, 'app.slack.com', 'Slack Web', 'productive', 'url', TRUE),
    (NULL, NULL, 'teams.microsoft.com', 'Teams Web', 'productive', 'url', TRUE),

    -- Project Management
    (NULL, NULL, '*.atlassian.net', 'Atlassian Jira/Confluence', 'productive', 'url', TRUE),
    (NULL, NULL, 'trello.com', 'Trello Web', 'productive', 'url', TRUE),
    (NULL, NULL, 'asana.com', 'Asana', 'productive', 'url', TRUE),
    (NULL, NULL, 'monday.com', 'Monday.com', 'productive', 'url', TRUE),
    (NULL, NULL, 'clickup.com', 'ClickUp', 'productive', 'url', TRUE),
    (NULL, NULL, 'linear.app', 'Linear', 'productive', 'url', TRUE),
    (NULL, NULL, 'notion.so', 'Notion Web', 'productive', 'url', TRUE),

    -- Design & Whiteboarding
    (NULL, NULL, 'figma.com', 'Figma Web', 'productive', 'url', TRUE),
    (NULL, NULL, 'canva.com', 'Canva', 'productive', 'url', TRUE),
    (NULL, NULL, 'miro.com', 'Miro', 'productive', 'url', TRUE),
    (NULL, NULL, 'lucidchart.com', 'Lucidchart', 'productive', 'url', TRUE),

    -- Cloud & Hosting Platforms
    (NULL, NULL, 'vercel.com', 'Vercel', 'productive', 'url', TRUE),
    (NULL, NULL, 'netlify.com', 'Netlify', 'productive', 'url', TRUE),
    (NULL, NULL, 'aws.amazon.com', 'AWS Console', 'productive', 'url', TRUE),
    (NULL, NULL, 'console.cloud.google.com', 'Google Cloud Console', 'productive', 'url', TRUE),
    (NULL, NULL, 'portal.azure.com', 'Azure Portal', 'productive', 'url', TRUE),
    (NULL, NULL, 'app.supabase.com', 'Supabase Dashboard', 'productive', 'url', TRUE),
    (NULL, NULL, 'firebase.google.com', 'Firebase Console', 'productive', 'url', TRUE),

    -- Package Registries
    (NULL, NULL, 'hub.docker.com', 'Docker Hub', 'productive', 'url', TRUE),
    (NULL, NULL, 'npmjs.com', 'npm', 'productive', 'url', TRUE),
    (NULL, NULL, 'pypi.org', 'PyPI', 'productive', 'url', TRUE),
    (NULL, NULL, 'packagist.org', 'Packagist', 'productive', 'url', TRUE),
    (NULL, NULL, 'nuget.org', 'NuGet', 'productive', 'url', TRUE),

    -- Online IDEs & Playgrounds
    (NULL, NULL, 'codepen.io', 'CodePen', 'productive', 'url', TRUE),
    (NULL, NULL, 'codesandbox.io', 'CodeSandbox', 'productive', 'url', TRUE),
    (NULL, NULL, 'replit.com', 'Replit', 'productive', 'url', TRUE),

    -- Documentation & Learning
    (NULL, NULL, 'w3schools.com', 'W3Schools', 'productive', 'url', TRUE),
    (NULL, NULL, 'developer.mozilla.org', 'MDN Web Docs', 'productive', 'url', TRUE),
    (NULL, NULL, 'learn.microsoft.com', 'Microsoft Learn', 'productive', 'url', TRUE),
    (NULL, NULL, 'udemy.com', 'Udemy', 'productive', 'url', TRUE),
    (NULL, NULL, 'coursera.org', 'Coursera', 'productive', 'url', TRUE),
    (NULL, NULL, 'pluralsight.com', 'Pluralsight', 'productive', 'url', TRUE),
    (NULL, NULL, 'linkedin.com/learning', 'LinkedIn Learning', 'productive', 'url', TRUE),

    -- AI Assistants
    (NULL, NULL, 'chat.openai.com', 'ChatGPT', 'productive', 'url', TRUE),
    (NULL, NULL, 'claude.ai', 'Claude AI', 'productive', 'url', TRUE),
    (NULL, NULL, 'gemini.google.com', 'Gemini AI', 'productive', 'url', TRUE),
    (NULL, NULL, 'copilot.microsoft.com', 'Microsoft Copilot', 'productive', 'url', TRUE),

    -- ========================================================================
    -- URL-BASED: Non-productive (27 entries)
    -- ========================================================================
    -- Video Streaming
    (NULL, NULL, 'youtube.com', 'YouTube', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'netflix.com', 'Netflix', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'disneyplus.com', 'Disney+', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'hulu.com', 'Hulu', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'primevideo.com', 'Amazon Prime Video', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'twitch.tv', 'Twitch', 'non_productive', 'url', TRUE),

    -- Social Media & Entertainment
    (NULL, NULL, 'reddit.com', 'Reddit', 'non_productive', 'url', TRUE),
    (NULL, NULL, '9gag.com', '9GAG', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'imgur.com', 'Imgur', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'facebook.com', 'Facebook', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'instagram.com', 'Instagram', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'twitter.com', 'Twitter / X', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'x.com', 'X Twitter', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'tiktok.com', 'TikTok', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'pinterest.com', 'Pinterest', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'snapchat.com', 'Snapchat', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'tumblr.com', 'Tumblr', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'buzzfeed.com', 'BuzzFeed', 'non_productive', 'url', TRUE),

    -- Music Streaming
    (NULL, NULL, 'open.spotify.com', 'Spotify Web', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'music.youtube.com', 'YouTube Music', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'soundcloud.com', 'SoundCloud', 'non_productive', 'url', TRUE),

    -- Gaming
    (NULL, NULL, 'store.steampowered.com', 'Steam Store', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'epicgames.com', 'Epic Games Store', 'non_productive', 'url', TRUE),

    -- Shopping
    (NULL, NULL, 'amazon.com', 'Amazon Shopping', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'ebay.com', 'eBay', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'flipkart.com', 'Flipkart', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'myntra.com', 'Myntra', 'non_productive', 'url', TRUE),

    -- ========================================================================
    -- URL-BASED: Private (26 entries)
    -- ========================================================================
    -- Banking & Finance
    (NULL, NULL, '*.bank.*', 'Banking Sites pattern', 'private', 'url', TRUE),
    (NULL, NULL, '*.bankofamerica.com', 'Bank of America', 'private', 'url', TRUE),
    (NULL, NULL, '*.chase.com', 'Chase Bank', 'private', 'url', TRUE),
    (NULL, NULL, '*.wellsfargo.com', 'Wells Fargo', 'private', 'url', TRUE),
    (NULL, NULL, '*.citi.com', 'Citibank', 'private', 'url', TRUE),
    (NULL, NULL, '*.hdfcbank.com', 'HDFC Bank', 'private', 'url', TRUE),
    (NULL, NULL, '*.icicibank.com', 'ICICI Bank', 'private', 'url', TRUE),
    (NULL, NULL, '*.sbi.co.in', 'SBI', 'private', 'url', TRUE),
    (NULL, NULL, '*.axisbank.com', 'Axis Bank', 'private', 'url', TRUE),
    (NULL, NULL, '*.kotak.com', 'Kotak Mahindra Bank', 'private', 'url', TRUE),
    (NULL, NULL, 'paypal.com', 'PayPal', 'private', 'url', TRUE),
    (NULL, NULL, '*.venmo.com', 'Venmo', 'private', 'url', TRUE),

    -- Personal Messaging (Web)
    (NULL, NULL, 'web.whatsapp.com', 'WhatsApp Web', 'private', 'url', TRUE),
    (NULL, NULL, 'web.telegram.org', 'Telegram Web', 'private', 'url', TRUE),
    (NULL, NULL, 'messages.google.com', 'Google Messages', 'private', 'url', TRUE),
    (NULL, NULL, 'messenger.com', 'Facebook Messenger Web', 'private', 'url', TRUE),

    -- Account Management
    (NULL, NULL, 'myaccount.google.com', 'Google Account', 'private', 'url', TRUE),
    (NULL, NULL, 'account.microsoft.com', 'Microsoft Account', 'private', 'url', TRUE),

    -- Healthcare
    (NULL, NULL, '*.healthcare.gov', 'Healthcare.gov', 'private', 'url', TRUE),
    (NULL, NULL, '*.mycharthealth.com', 'MyChart Health', 'private', 'url', TRUE),
    (NULL, NULL, '*.patient.*', 'Patient Portals pattern', 'private', 'url', TRUE),
    (NULL, NULL, '*.health.*', 'Health Portals pattern', 'private', 'url', TRUE),

    -- Personal Finance & Tax
    (NULL, NULL, 'mint.intuit.com', 'Mint Finance', 'private', 'url', TRUE),
    (NULL, NULL, '*.creditkarma.com', 'Credit Karma', 'private', 'url', TRUE),
    (NULL, NULL, '*.turbotax.com', 'TurboTax', 'private', 'url', TRUE),
    (NULL, NULL, '*.hrblock.com', 'H&R Block', 'private', 'url', TRUE)
ON CONFLICT (identifier, match_by) WHERE organization_id IS NULL AND project_key IS NULL DO NOTHING;
