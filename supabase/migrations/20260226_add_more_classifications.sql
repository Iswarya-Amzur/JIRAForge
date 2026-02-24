-- ============================================================================
-- Migration: Add additional application classifications
-- Date: 2026-02-26
--
-- Adds more process-based and URL-based classifications discovered from
-- comprehensive research of popular desktop apps and websites.
-- ON CONFLICT DO NOTHING ensures safe re-runs and no duplicates.
-- ============================================================================

INSERT INTO public.application_classifications (organization_id, project_key, identifier, display_name, classification, match_by, is_default)
VALUES

    -- ========================================================================
    -- PROCESS-BASED: Productive — IDEs & Code Editors (missing from seed)
    -- ========================================================================
    (NULL, NULL, 'zed.exe', 'Zed Editor', 'productive', 'process', TRUE),
    (NULL, NULL, 'nvim-qt.exe', 'Neovim Qt', 'productive', 'process', TRUE),
    (NULL, NULL, 'gvim.exe', 'GVim', 'productive', 'process', TRUE),
    (NULL, NULL, 'emacs.exe', 'Emacs', 'productive', 'process', TRUE),
    (NULL, NULL, 'lite-xl.exe', 'Lite XL', 'productive', 'process', TRUE),
    (NULL, NULL, 'lapce.exe', 'Lapce', 'productive', 'process', TRUE),
    (NULL, NULL, 'fleet.exe', 'JetBrains Fleet', 'productive', 'process', TRUE),
    (NULL, NULL, 'clion64.exe', 'CLion', 'productive', 'process', TRUE),
    (NULL, NULL, 'rubymine64.exe', 'RubyMine', 'productive', 'process', TRUE),
    (NULL, NULL, 'dataspell64.exe', 'DataSpell', 'productive', 'process', TRUE),
    (NULL, NULL, 'netbeans64.exe', 'NetBeans', 'productive', 'process', TRUE),
    (NULL, NULL, 'NetBeans IDE.exe', 'NetBeans IDE', 'productive', 'process', TRUE),
    (NULL, NULL, 'codeblocks.exe', 'Code::Blocks', 'productive', 'process', TRUE),
    (NULL, NULL, 'notepad.exe', 'Notepad', 'productive', 'process', TRUE),
    (NULL, NULL, 'winmerge.exe', 'WinMerge', 'productive', 'process', TRUE),
    (NULL, NULL, 'windiff.exe', 'WinDiff', 'productive', 'process', TRUE),

    -- ========================================================================
    -- PROCESS-BASED: Productive — Terminals & Shells (missing)
    -- ========================================================================
    (NULL, NULL, 'alacritty.exe', 'Alacritty', 'productive', 'process', TRUE),
    (NULL, NULL, 'wezterm-gui.exe', 'WezTerm', 'productive', 'process', TRUE),
    (NULL, NULL, 'Hyper.exe', 'Hyper Terminal', 'productive', 'process', TRUE),
    (NULL, NULL, 'warp.exe', 'Warp Terminal', 'productive', 'process', TRUE),
    (NULL, NULL, 'tabby.exe', 'Tabby Terminal', 'productive', 'process', TRUE),
    (NULL, NULL, 'ConEmu64.exe', 'ConEmu', 'productive', 'process', TRUE),
    (NULL, NULL, 'ConEmu.exe', 'ConEmu (32-bit)', 'productive', 'process', TRUE),
    (NULL, NULL, 'cmder.exe', 'Cmder', 'productive', 'process', TRUE),
    (NULL, NULL, 'bash.exe', 'Bash', 'productive', 'process', TRUE),
    (NULL, NULL, 'ssh.exe', 'SSH Client', 'productive', 'process', TRUE),
    (NULL, NULL, 'SecureCRT.exe', 'SecureCRT', 'productive', 'process', TRUE),
    (NULL, NULL, 'MobaXterm.exe', 'MobaXterm', 'productive', 'process', TRUE),
    (NULL, NULL, 'kitty.exe', 'KiTTY', 'productive', 'process', TRUE),
    (NULL, NULL, 'pwsh.exe', 'PowerShell 7', 'productive', 'process', TRUE),

    -- ========================================================================
    -- PROCESS-BASED: Productive — Database Tools (missing)
    -- ========================================================================
    (NULL, NULL, 'azuredatastudio.exe', 'Azure Data Studio', 'productive', 'process', TRUE),
    (NULL, NULL, 'TablePlus.exe', 'TablePlus', 'productive', 'process', TRUE),
    (NULL, NULL, 'HeidiSQL.exe', 'HeidiSQL', 'productive', 'process', TRUE),
    (NULL, NULL, 'DbVisualizer.exe', 'DbVisualizer', 'productive', 'process', TRUE),
    (NULL, NULL, 'Navicat.exe', 'Navicat', 'productive', 'process', TRUE),
    (NULL, NULL, 'RedisInsight.exe', 'RedisInsight', 'productive', 'process', TRUE),
    (NULL, NULL, 'robo3t.exe', 'Robo 3T', 'productive', 'process', TRUE),
    (NULL, NULL, 'Studio 3T.exe', 'Studio 3T', 'productive', 'process', TRUE),
    (NULL, NULL, 'SQLiteStudio.exe', 'SQLiteStudio', 'productive', 'process', TRUE),
    (NULL, NULL, 'DBBrowser.exe', 'DB Browser for SQLite', 'productive', 'process', TRUE),

    -- ========================================================================
    -- PROCESS-BASED: Productive — API & Dev Tools (missing)
    -- ========================================================================
    (NULL, NULL, 'Fiddler.exe', 'Fiddler', 'productive', 'process', TRUE),
    (NULL, NULL, 'Wireshark.exe', 'Wireshark', 'productive', 'process', TRUE),
    (NULL, NULL, 'charles.exe', 'Charles Proxy', 'productive', 'process', TRUE),
    (NULL, NULL, 'ngrok.exe', 'ngrok', 'productive', 'process', TRUE),
    (NULL, NULL, 'Lens.exe', 'Lens (Kubernetes)', 'productive', 'process', TRUE),
    (NULL, NULL, 'kubectl.exe', 'kubectl', 'productive', 'process', TRUE),
    (NULL, NULL, 'terraform.exe', 'Terraform', 'productive', 'process', TRUE),
    (NULL, NULL, 'vagrant.exe', 'Vagrant', 'productive', 'process', TRUE),
    (NULL, NULL, 'VirtualBox.exe', 'VirtualBox', 'productive', 'process', TRUE),
    (NULL, NULL, 'vmware.exe', 'VMware Workstation', 'productive', 'process', TRUE),
    (NULL, NULL, 'vmplayer.exe', 'VMware Player', 'productive', 'process', TRUE),
    (NULL, NULL, 'node.exe', 'Node.js', 'productive', 'process', TRUE),
    (NULL, NULL, 'python.exe', 'Python', 'productive', 'process', TRUE),
    (NULL, NULL, 'pythonw.exe', 'Python (windowed)', 'productive', 'process', TRUE),
    (NULL, NULL, 'java.exe', 'Java', 'productive', 'process', TRUE),
    (NULL, NULL, 'javaw.exe', 'Java (windowed)', 'productive', 'process', TRUE),
    (NULL, NULL, 'hoppscotch.exe', 'Hoppscotch', 'productive', 'process', TRUE),
    (NULL, NULL, 'bruno.exe', 'Bruno API Client', 'productive', 'process', TRUE),
    (NULL, NULL, 'httpie.exe', 'HTTPie', 'productive', 'process', TRUE),

    -- ========================================================================
    -- PROCESS-BASED: Productive — Git Clients (missing)
    -- ========================================================================
    (NULL, NULL, 'TortoiseGitProc.exe', 'TortoiseGit', 'productive', 'process', TRUE),
    (NULL, NULL, 'SmartGit.exe', 'SmartGit', 'productive', 'process', TRUE),
    (NULL, NULL, 'git.exe', 'Git CLI', 'productive', 'process', TRUE),
    (NULL, NULL, 'Fork.exe', 'Fork Git Client', 'productive', 'process', TRUE),

    -- ========================================================================
    -- PROCESS-BASED: Productive — Design & Creative (missing)
    -- ========================================================================
    (NULL, NULL, 'Sketch.exe', 'Sketch', 'productive', 'process', TRUE),
    (NULL, NULL, 'Inkscape.exe', 'Inkscape', 'productive', 'process', TRUE),
    (NULL, NULL, 'GIMP.exe', 'GIMP', 'productive', 'process', TRUE),
    (NULL, NULL, 'gimp-2.10.exe', 'GIMP 2.10', 'productive', 'process', TRUE),
    (NULL, NULL, 'krita.exe', 'Krita', 'productive', 'process', TRUE),
    (NULL, NULL, 'DaVinci Resolve.exe', 'DaVinci Resolve', 'productive', 'process', TRUE),
    (NULL, NULL, 'Lightroom.exe', 'Adobe Lightroom', 'productive', 'process', TRUE),
    (NULL, NULL, 'AcrobatDC.exe', 'Adobe Acrobat DC', 'productive', 'process', TRUE),
    (NULL, NULL, 'Audition.exe', 'Adobe Audition', 'productive', 'process', TRUE),
    (NULL, NULL, 'Animate.exe', 'Adobe Animate', 'productive', 'process', TRUE),
    (NULL, NULL, 'Bridge.exe', 'Adobe Bridge', 'productive', 'process', TRUE),
    (NULL, NULL, 'Dimension.exe', 'Adobe Dimension', 'productive', 'process', TRUE),
    (NULL, NULL, 'SolidWorks.exe', 'SolidWorks', 'productive', 'process', TRUE),
    (NULL, NULL, 'CATIA.exe', 'CATIA', 'productive', 'process', TRUE),
    (NULL, NULL, 'Revit.exe', 'Autodesk Revit', 'productive', 'process', TRUE),
    (NULL, NULL, 'Maya.exe', 'Autodesk Maya', 'productive', 'process', TRUE),
    (NULL, NULL, '3dsmax.exe', 'Autodesk 3ds Max', 'productive', 'process', TRUE),
    (NULL, NULL, 'Cinema 4D.exe', 'Cinema 4D', 'productive', 'process', TRUE),
    (NULL, NULL, 'CorelDRAW.exe', 'CorelDRAW', 'productive', 'process', TRUE),
    (NULL, NULL, 'penpot.exe', 'Penpot', 'productive', 'process', TRUE),

    -- ========================================================================
    -- PROCESS-BASED: Productive — Office & Productivity (missing)
    -- ========================================================================
    (NULL, NULL, 'soffice.exe', 'LibreOffice', 'productive', 'process', TRUE),
    (NULL, NULL, 'soffice.bin', 'LibreOffice (bin)', 'productive', 'process', TRUE),
    (NULL, NULL, 'wps.exe', 'WPS Office', 'productive', 'process', TRUE),
    (NULL, NULL, 'et.exe', 'WPS Spreadsheets', 'productive', 'process', TRUE),
    (NULL, NULL, 'wpp.exe', 'WPS Presentation', 'productive', 'process', TRUE),
    (NULL, NULL, 'FreeOffice.exe', 'FreeOffice', 'productive', 'process', TRUE),
    (NULL, NULL, 'OneDrive.exe', 'Microsoft OneDrive', 'productive', 'process', TRUE),
    (NULL, NULL, 'Dropbox.exe', 'Dropbox', 'productive', 'process', TRUE),
    (NULL, NULL, 'googledrivesync.exe', 'Google Drive Sync', 'productive', 'process', TRUE),
    (NULL, NULL, 'GoogleDriveFS.exe', 'Google Drive for Desktop', 'productive', 'process', TRUE),
    (NULL, NULL, 'Box.exe', 'Box Drive', 'productive', 'process', TRUE),
    (NULL, NULL, 'PowerToys.exe', 'Microsoft PowerToys', 'productive', 'process', TRUE),

    -- ========================================================================
    -- PROCESS-BASED: Productive — Communication (missing)
    -- ========================================================================
    (NULL, NULL, 'ms-teams.exe', 'Microsoft Teams (new)', 'productive', 'process', TRUE),
    (NULL, NULL, 'Gather.exe', 'Gather Town', 'productive', 'process', TRUE),
    (NULL, NULL, 'Loom.exe', 'Loom', 'productive', 'process', TRUE),
    (NULL, NULL, 'Krisp.exe', 'Krisp', 'productive', 'process', TRUE),
    (NULL, NULL, 'RingCentral.exe', 'RingCentral', 'productive', 'process', TRUE),
    (NULL, NULL, 'GoTo Meeting.exe', 'GoTo Meeting', 'productive', 'process', TRUE),

    -- ========================================================================
    -- PROCESS-BASED: Productive — Note-taking & Knowledge (missing)
    -- ========================================================================
    (NULL, NULL, 'Logseq.exe', 'Logseq', 'productive', 'process', TRUE),
    (NULL, NULL, 'Joplin.exe', 'Joplin', 'productive', 'process', TRUE),
    (NULL, NULL, 'typora.exe', 'Typora', 'productive', 'process', TRUE),
    (NULL, NULL, 'marktext.exe', 'Mark Text', 'productive', 'process', TRUE),
    (NULL, NULL, 'Todoist.exe', 'Todoist', 'productive', 'process', TRUE),
    (NULL, NULL, 'TickTick.exe', 'TickTick', 'productive', 'process', TRUE),
    (NULL, NULL, 'Asana.exe', 'Asana Desktop', 'productive', 'process', TRUE),
    (NULL, NULL, 'Basecamp 3.exe', 'Basecamp', 'productive', 'process', TRUE),

    -- ========================================================================
    -- PROCESS-BASED: Productive — System & Utilities (missing)
    -- ========================================================================
    (NULL, NULL, 'ScreenClippingHost.exe', 'Screen Clipping', 'productive', 'process', TRUE),
    (NULL, NULL, 'Greenshot.exe', 'Greenshot', 'productive', 'process', TRUE),
    (NULL, NULL, 'ShareX.exe', 'ShareX', 'productive', 'process', TRUE),
    (NULL, NULL, 'LICEcap.exe', 'LICEcap', 'productive', 'process', TRUE),
    (NULL, NULL, 'ScreenToGif.exe', 'ScreenToGif', 'productive', 'process', TRUE),
    (NULL, NULL, 'Everything.exe', 'Everything Search', 'productive', 'process', TRUE),
    (NULL, NULL, 'Wox.exe', 'Wox Launcher', 'productive', 'process', TRUE),
    (NULL, NULL, 'Flow.Launcher.exe', 'Flow Launcher', 'productive', 'process', TRUE),
    (NULL, NULL, 'Taskmgr.exe', 'Task Manager', 'productive', 'process', TRUE),
    (NULL, NULL, 'perfmon.exe', 'Performance Monitor', 'productive', 'process', TRUE),
    (NULL, NULL, 'resmon.exe', 'Resource Monitor', 'productive', 'process', TRUE),
    (NULL, NULL, 'regedit.exe', 'Registry Editor', 'productive', 'process', TRUE),
    (NULL, NULL, 'devmgmt.msc', 'Device Manager', 'productive', 'process', TRUE),
    (NULL, NULL, '7zFM.exe', '7-Zip', 'productive', 'process', TRUE),
    (NULL, NULL, 'WinRAR.exe', 'WinRAR', 'productive', 'process', TRUE),
    (NULL, NULL, 'Bandizip.exe', 'Bandizip', 'productive', 'process', TRUE),
    (NULL, NULL, 'ProcessExplorer.exe', 'Process Explorer', 'productive', 'process', TRUE),
    (NULL, NULL, 'procexp64.exe', 'Process Explorer (64-bit)', 'productive', 'process', TRUE),
    (NULL, NULL, 'Autoruns.exe', 'Autoruns', 'productive', 'process', TRUE),

    -- ========================================================================
    -- PROCESS-BASED: Productive — PDF & Document Readers (missing)
    -- ========================================================================
    (NULL, NULL, 'SumatraPDF.exe', 'Sumatra PDF', 'productive', 'process', TRUE),
    (NULL, NULL, 'PDFXEdit.exe', 'PDF-XChange Editor', 'productive', 'process', TRUE),
    (NULL, NULL, 'AcroRd32.exe', 'Adobe Reader (32-bit)', 'productive', 'process', TRUE),
    (NULL, NULL, 'Nitro Pro.exe', 'Nitro PDF Pro', 'productive', 'process', TRUE),

    -- ========================================================================
    -- PROCESS-BASED: Productive — Email Clients (missing)
    -- ========================================================================
    (NULL, NULL, 'olk.exe', 'New Outlook', 'productive', 'process', TRUE),
    (NULL, NULL, 'mailspring.exe', 'Mailspring', 'productive', 'process', TRUE),
    (NULL, NULL, 'eM Client.exe', 'eM Client', 'productive', 'process', TRUE),

    -- ========================================================================
    -- PROCESS-BASED: Non-productive — Gaming (missing)
    -- ========================================================================
    (NULL, NULL, 'obs64.exe', 'OBS Studio', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'obs32.exe', 'OBS Studio (32-bit)', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'GalaxyClient.exe', 'GOG Galaxy', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'Uplay.exe', 'Ubisoft Connect', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'UbisoftConnect.exe', 'Ubisoft Connect', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'RiotClientServices.exe', 'Riot Client', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'LeagueClient.exe', 'League of Legends', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'VALORANT.exe', 'Valorant', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'Minecraft.exe', 'Minecraft', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'javaw.exe', 'Minecraft (Java)', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'RobloxPlayerBeta.exe', 'Roblox', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'FortniteClient-Win64-Shipping.exe', 'Fortnite', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'csgo.exe', 'Counter-Strike', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'cs2.exe', 'Counter-Strike 2', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'GTA5.exe', 'GTA V', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'Overwatch.exe', 'Overwatch', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'dota2.exe', 'Dota 2', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'PUBG.exe', 'PUBG', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'ApexLegends.exe', 'Apex Legends', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'eldenring.exe', 'Elden Ring', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'Cyberpunk2077.exe', 'Cyberpunk 2077', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'Diablo IV.exe', 'Diablo IV', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'HogwartsLegacy.exe', 'Hogwarts Legacy', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'GeForceNOW.exe', 'GeForce NOW', 'non_productive', 'process', TRUE),

    -- ========================================================================
    -- PROCESS-BASED: Non-productive — Media & Music (missing)
    -- ========================================================================
    (NULL, NULL, 'AIMP.exe', 'AIMP', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'Winamp.exe', 'Winamp', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'MusicBee.exe', 'MusicBee', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'PotPlayer.exe', 'PotPlayer', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'PotPlayerMini64.exe', 'PotPlayer Mini', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'mpc-hc64.exe', 'MPC-HC', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'mpv.exe', 'mpv Player', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'Plex.exe', 'Plex', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'Kodi.exe', 'Kodi', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'AmazonMusic.exe', 'Amazon Music', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'AppleMusic.exe', 'Apple Music', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'Deezer.exe', 'Deezer', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'Tidal.exe', 'Tidal', 'non_productive', 'process', TRUE),

    -- ========================================================================
    -- PROCESS-BASED: Non-productive — Social & Misc (missing)
    -- ========================================================================
    (NULL, NULL, 'Snapchat.exe', 'Snapchat Desktop', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'TikTok.exe', 'TikTok Desktop', 'non_productive', 'process', TRUE),
    (NULL, NULL, 'Pinterest.exe', 'Pinterest Desktop', 'non_productive', 'process', TRUE),

    -- ========================================================================
    -- PROCESS-BASED: Private — Password Managers (missing)
    -- ========================================================================
    (NULL, NULL, 'NordPass.exe', 'NordPass', 'private', 'process', TRUE),
    (NULL, NULL, 'RoboForm.exe', 'RoboForm', 'private', 'process', TRUE),
    (NULL, NULL, 'Enpass.exe', 'Enpass', 'private', 'process', TRUE),
    (NULL, NULL, 'ProtonPass.exe', 'Proton Pass', 'private', 'process', TRUE),

    -- ========================================================================
    -- PROCESS-BASED: Private — VPN Clients (private by nature)
    -- ========================================================================
    (NULL, NULL, 'NordVPN.exe', 'NordVPN', 'private', 'process', TRUE),
    (NULL, NULL, 'ExpressVPN.exe', 'ExpressVPN', 'private', 'process', TRUE),
    (NULL, NULL, 'ProtonVPN.exe', 'ProtonVPN', 'private', 'process', TRUE),
    (NULL, NULL, 'Surfshark.exe', 'Surfshark', 'private', 'process', TRUE),
    (NULL, NULL, 'Windscribe.exe', 'Windscribe', 'private', 'process', TRUE),
    (NULL, NULL, 'CyberGhost.exe', 'CyberGhost VPN', 'private', 'process', TRUE),
    (NULL, NULL, 'Mullvad VPN.exe', 'Mullvad VPN', 'private', 'process', TRUE),
    (NULL, NULL, 'openvpn-gui.exe', 'OpenVPN', 'private', 'process', TRUE),
    (NULL, NULL, 'WireGuard.exe', 'WireGuard', 'private', 'process', TRUE),

    -- ========================================================================
    -- PROCESS-BASED: Private — Crypto & Finance (missing)
    -- ========================================================================
    (NULL, NULL, 'Exodus.exe', 'Exodus Wallet', 'private', 'process', TRUE),
    (NULL, NULL, 'Ledger Live.exe', 'Ledger Live', 'private', 'process', TRUE),
    (NULL, NULL, 'Electrum.exe', 'Electrum Wallet', 'private', 'process', TRUE),
    (NULL, NULL, 'MetaMask.exe', 'MetaMask', 'private', 'process', TRUE),
    (NULL, NULL, 'Trezor Suite.exe', 'Trezor Suite', 'private', 'process', TRUE),
    (NULL, NULL, 'Quicken.exe', 'Quicken Finance', 'private', 'process', TRUE),
    (NULL, NULL, 'GnuCash.exe', 'GnuCash', 'private', 'process', TRUE),

    -- ========================================================================
    -- PROCESS-BASED: Private — Personal Messaging (missing)
    -- ========================================================================
    (NULL, NULL, 'Viber.exe', 'Viber', 'private', 'process', TRUE),
    (NULL, NULL, 'Line.exe', 'LINE', 'private', 'process', TRUE),
    (NULL, NULL, 'WeChat.exe', 'WeChat', 'private', 'process', TRUE),
    (NULL, NULL, 'KakaoTalk.exe', 'KakaoTalk', 'private', 'process', TRUE),

    -- ========================================================================
    -- URL-BASED: Productive — Developer & Cloud (missing)
    -- ========================================================================
    (NULL, NULL, 'app.diagrams.net', 'draw.io', 'productive', 'url', TRUE),
    (NULL, NULL, 'draw.io', 'draw.io', 'productive', 'url', TRUE),
    (NULL, NULL, 'excalidraw.com', 'Excalidraw', 'productive', 'url', TRUE),
    (NULL, NULL, 'whimsical.com', 'Whimsical', 'productive', 'url', TRUE),
    (NULL, NULL, 'eraser.io', 'Eraser', 'productive', 'url', TRUE),
    (NULL, NULL, 'dbdiagram.io', 'dbdiagram.io', 'productive', 'url', TRUE),
    (NULL, NULL, 'regex101.com', 'regex101', 'productive', 'url', TRUE),
    (NULL, NULL, 'jsonformatter.org', 'JSON Formatter', 'productive', 'url', TRUE),

    -- Developer platforms
    (NULL, NULL, 'gitlab.io', 'GitLab Pages', 'productive', 'url', TRUE),
    (NULL, NULL, 'github.io', 'GitHub Pages', 'productive', 'url', TRUE),
    (NULL, NULL, 'gist.github.com', 'GitHub Gist', 'productive', 'url', TRUE),
    (NULL, NULL, 'sourcegraph.com', 'Sourcegraph', 'productive', 'url', TRUE),
    (NULL, NULL, 'launchdarkly.com', 'LaunchDarkly', 'productive', 'url', TRUE),
    (NULL, NULL, 'sentry.io', 'Sentry', 'productive', 'url', TRUE),
    (NULL, NULL, 'datadog.com', 'Datadog', 'productive', 'url', TRUE),
    (NULL, NULL, 'grafana.com', 'Grafana', 'productive', 'url', TRUE),
    (NULL, NULL, 'newrelic.com', 'New Relic', 'productive', 'url', TRUE),
    (NULL, NULL, 'pagerduty.com', 'PagerDuty', 'productive', 'url', TRUE),
    (NULL, NULL, 'circleci.com', 'CircleCI', 'productive', 'url', TRUE),
    (NULL, NULL, 'travis-ci.com', 'Travis CI', 'productive', 'url', TRUE),
    (NULL, NULL, 'jenkins.io', 'Jenkins', 'productive', 'url', TRUE),
    (NULL, NULL, 'app.terraform.io', 'Terraform Cloud', 'productive', 'url', TRUE),
    (NULL, NULL, 'render.com', 'Render', 'productive', 'url', TRUE),
    (NULL, NULL, 'railway.app', 'Railway', 'productive', 'url', TRUE),
    (NULL, NULL, 'fly.io', 'Fly.io', 'productive', 'url', TRUE),
    (NULL, NULL, 'heroku.com', 'Heroku', 'productive', 'url', TRUE),
    (NULL, NULL, 'digitalocean.com', 'DigitalOcean', 'productive', 'url', TRUE),
    (NULL, NULL, 'linode.com', 'Linode', 'productive', 'url', TRUE),
    (NULL, NULL, 'cloudflare.com', 'Cloudflare', 'productive', 'url', TRUE),
    (NULL, NULL, 'planetscale.com', 'PlanetScale', 'productive', 'url', TRUE),
    (NULL, NULL, 'neon.tech', 'Neon Database', 'productive', 'url', TRUE),
    (NULL, NULL, 'upstash.com', 'Upstash', 'productive', 'url', TRUE),
    (NULL, NULL, 'turso.tech', 'Turso', 'productive', 'url', TRUE),
    (NULL, NULL, 'cloud.mongodb.com', 'MongoDB Atlas', 'productive', 'url', TRUE),
    (NULL, NULL, 'console.aws.amazon.com', 'AWS Console', 'productive', 'url', TRUE),
    (NULL, NULL, 'aiven.io', 'Aiven', 'productive', 'url', TRUE),

    -- Package registries
    (NULL, NULL, 'crates.io', 'crates.io (Rust)', 'productive', 'url', TRUE),
    (NULL, NULL, 'mvnrepository.com', 'Maven Repository', 'productive', 'url', TRUE),
    (NULL, NULL, 'rubygems.org', 'RubyGems', 'productive', 'url', TRUE),
    (NULL, NULL, 'pkg.go.dev', 'Go Packages', 'productive', 'url', TRUE),
    (NULL, NULL, 'cocoapods.org', 'CocoaPods', 'productive', 'url', TRUE),
    (NULL, NULL, 'pub.dev', 'pub.dev (Dart)', 'productive', 'url', TRUE),
    (NULL, NULL, 'hex.pm', 'Hex (Elixir)', 'productive', 'url', TRUE),
    (NULL, NULL, 'anaconda.org', 'Anaconda', 'productive', 'url', TRUE),

    -- ========================================================================
    -- URL-BASED: Productive — Project Management & CRM (missing)
    -- ========================================================================
    (NULL, NULL, 'shortcut.com', 'Shortcut', 'productive', 'url', TRUE),
    (NULL, NULL, 'height.app', 'Height', 'productive', 'url', TRUE),
    (NULL, NULL, 'plane.so', 'Plane', 'productive', 'url', TRUE),
    (NULL, NULL, 'basecamp.com', 'Basecamp', 'productive', 'url', TRUE),
    (NULL, NULL, 'wrike.com', 'Wrike', 'productive', 'url', TRUE),
    (NULL, NULL, 'smartsheet.com', 'Smartsheet', 'productive', 'url', TRUE),
    (NULL, NULL, 'airtable.com', 'Airtable', 'productive', 'url', TRUE),
    (NULL, NULL, 'teamwork.com', 'Teamwork', 'productive', 'url', TRUE),
    (NULL, NULL, 'todoist.com', 'Todoist Web', 'productive', 'url', TRUE),
    (NULL, NULL, 'ticktick.com', 'TickTick Web', 'productive', 'url', TRUE),
    (NULL, NULL, 'app.reclaim.ai', 'Reclaim AI', 'productive', 'url', TRUE),

    -- CRM
    (NULL, NULL, '*.salesforce.com', 'Salesforce', 'productive', 'url', TRUE),
    (NULL, NULL, 'app.hubspot.com', 'HubSpot', 'productive', 'url', TRUE),
    (NULL, NULL, '*.zoho.com', 'Zoho', 'productive', 'url', TRUE),
    (NULL, NULL, 'pipedrive.com', 'Pipedrive', 'productive', 'url', TRUE),
    (NULL, NULL, 'app.freshdesk.com', 'Freshdesk', 'productive', 'url', TRUE),
    (NULL, NULL, '*.freshworks.com', 'Freshworks', 'productive', 'url', TRUE),
    (NULL, NULL, 'app.intercom.com', 'Intercom', 'productive', 'url', TRUE),
    (NULL, NULL, '*.zendesk.com', 'Zendesk', 'productive', 'url', TRUE),
    (NULL, NULL, '*.servicenow.com', 'ServiceNow', 'productive', 'url', TRUE),

    -- ========================================================================
    -- URL-BASED: Productive — Communication & Collaboration (missing)
    -- ========================================================================
    (NULL, NULL, 'discord.com', 'Discord Web', 'productive', 'url', TRUE),
    (NULL, NULL, 'loom.com', 'Loom Web', 'productive', 'url', TRUE),
    (NULL, NULL, 'whereby.com', 'Whereby', 'productive', 'url', TRUE),
    (NULL, NULL, 'around.co', 'Around', 'productive', 'url', TRUE),
    (NULL, NULL, 'gather.town', 'Gather Town', 'productive', 'url', TRUE),
    (NULL, NULL, 'app.gather.town', 'Gather Town App', 'productive', 'url', TRUE),
    (NULL, NULL, 'mmhmm.app', 'mmhmm', 'productive', 'url', TRUE),

    -- ========================================================================
    -- URL-BASED: Productive — Design & Creative (missing)
    -- ========================================================================
    (NULL, NULL, 'sketch.com', 'Sketch Web', 'productive', 'url', TRUE),
    (NULL, NULL, 'penpot.app', 'Penpot', 'productive', 'url', TRUE),
    (NULL, NULL, 'framer.com', 'Framer', 'productive', 'url', TRUE),
    (NULL, NULL, 'webflow.com', 'Webflow', 'productive', 'url', TRUE),
    (NULL, NULL, 'bubble.io', 'Bubble', 'productive', 'url', TRUE),
    (NULL, NULL, 'retool.com', 'Retool', 'productive', 'url', TRUE),
    (NULL, NULL, 'dribbble.com', 'Dribbble', 'productive', 'url', TRUE),
    (NULL, NULL, 'behance.net', 'Behance', 'productive', 'url', TRUE),
    (NULL, NULL, 'coolors.co', 'Coolors', 'productive', 'url', TRUE),
    (NULL, NULL, 'unsplash.com', 'Unsplash', 'productive', 'url', TRUE),
    (NULL, NULL, 'icons8.com', 'Icons8', 'productive', 'url', TRUE),

    -- ========================================================================
    -- URL-BASED: Productive — Documentation & Knowledge (missing)
    -- ========================================================================
    (NULL, NULL, 'docs.github.com', 'GitHub Docs', 'productive', 'url', TRUE),
    (NULL, NULL, 'readthedocs.io', 'Read the Docs', 'productive', 'url', TRUE),
    (NULL, NULL, 'gitbook.io', 'GitBook', 'productive', 'url', TRUE),
    (NULL, NULL, 'notion.site', 'Notion Sites', 'productive', 'url', TRUE),
    (NULL, NULL, 'obsidian.md', 'Obsidian Web', 'productive', 'url', TRUE),
    (NULL, NULL, 'logseq.com', 'Logseq', 'productive', 'url', TRUE),
    (NULL, NULL, 'hackmd.io', 'HackMD', 'productive', 'url', TRUE),
    (NULL, NULL, 'overleaf.com', 'Overleaf (LaTeX)', 'productive', 'url', TRUE),
    (NULL, NULL, 'grammarly.com', 'Grammarly', 'productive', 'url', TRUE),

    -- ========================================================================
    -- URL-BASED: Productive — Learning & Coding Practice (missing)
    -- ========================================================================
    (NULL, NULL, 'leetcode.com', 'LeetCode', 'productive', 'url', TRUE),
    (NULL, NULL, 'hackerrank.com', 'HackerRank', 'productive', 'url', TRUE),
    (NULL, NULL, 'codewars.com', 'Codewars', 'productive', 'url', TRUE),
    (NULL, NULL, 'exercism.org', 'Exercism', 'productive', 'url', TRUE),
    (NULL, NULL, 'freecodecamp.org', 'freeCodeCamp', 'productive', 'url', TRUE),
    (NULL, NULL, 'codecademy.com', 'Codecademy', 'productive', 'url', TRUE),
    (NULL, NULL, 'khanacademy.org', 'Khan Academy', 'productive', 'url', TRUE),
    (NULL, NULL, 'edx.org', 'edX', 'productive', 'url', TRUE),
    (NULL, NULL, 'skillshare.com', 'Skillshare', 'productive', 'url', TRUE),
    (NULL, NULL, 'egghead.io', 'Egghead', 'productive', 'url', TRUE),
    (NULL, NULL, 'frontendmasters.com', 'Frontend Masters', 'productive', 'url', TRUE),
    (NULL, NULL, 'laracasts.com', 'Laracasts', 'productive', 'url', TRUE),
    (NULL, NULL, 'scrimba.com', 'Scrimba', 'productive', 'url', TRUE),
    (NULL, NULL, 'datacamp.com', 'DataCamp', 'productive', 'url', TRUE),
    (NULL, NULL, 'kaggle.com', 'Kaggle', 'productive', 'url', TRUE),
    (NULL, NULL, 'hashnode.dev', 'Hashnode', 'productive', 'url', TRUE),

    -- ========================================================================
    -- URL-BASED: Productive — AI Tools (missing)
    -- ========================================================================
    (NULL, NULL, 'chatgpt.com', 'ChatGPT (new domain)', 'productive', 'url', TRUE),
    (NULL, NULL, 'deepseek.com', 'DeepSeek', 'productive', 'url', TRUE),
    (NULL, NULL, 'chat.deepseek.com', 'DeepSeek Chat', 'productive', 'url', TRUE),
    (NULL, NULL, 'perplexity.ai', 'Perplexity AI', 'productive', 'url', TRUE),
    (NULL, NULL, 'poe.com', 'Poe AI', 'productive', 'url', TRUE),
    (NULL, NULL, 'huggingface.co', 'Hugging Face', 'productive', 'url', TRUE),
    (NULL, NULL, 'phind.com', 'Phind', 'productive', 'url', TRUE),
    (NULL, NULL, 'v0.dev', 'v0 by Vercel', 'productive', 'url', TRUE),
    (NULL, NULL, 'bolt.new', 'Bolt', 'productive', 'url', TRUE),
    (NULL, NULL, 'cursor.com', 'Cursor Web', 'productive', 'url', TRUE),
    (NULL, NULL, 'openai.com', 'OpenAI', 'productive', 'url', TRUE),
    (NULL, NULL, 'anthropic.com', 'Anthropic', 'productive', 'url', TRUE),
    (NULL, NULL, 'midjourney.com', 'Midjourney', 'productive', 'url', TRUE),

    -- ========================================================================
    -- URL-BASED: Productive — Office & Productivity (missing)
    -- ========================================================================
    (NULL, NULL, 'office.com', 'Microsoft Office Web', 'productive', 'url', TRUE),
    (NULL, NULL, 'office365.com', 'Microsoft 365', 'productive', 'url', TRUE),
    (NULL, NULL, '*.sharepoint.com', 'SharePoint', 'productive', 'url', TRUE),
    (NULL, NULL, 'onedrive.live.com', 'OneDrive Web', 'productive', 'url', TRUE),
    (NULL, NULL, 'dropbox.com', 'Dropbox Web', 'productive', 'url', TRUE),
    (NULL, NULL, 'box.com', 'Box Web', 'productive', 'url', TRUE),
    (NULL, NULL, 'keep.google.com', 'Google Keep', 'productive', 'url', TRUE),
    (NULL, NULL, 'forms.google.com', 'Google Forms', 'productive', 'url', TRUE),
    (NULL, NULL, 'sites.google.com', 'Google Sites', 'productive', 'url', TRUE),
    (NULL, NULL, 'meet.jit.si', 'Jitsi Meet', 'productive', 'url', TRUE),
    (NULL, NULL, 'linkedin.com', 'LinkedIn', 'productive', 'url', TRUE),

    -- ========================================================================
    -- URL-BASED: Productive — Hiring & HR (missing)
    -- ========================================================================
    (NULL, NULL, 'indeed.com', 'Indeed', 'productive', 'url', TRUE),
    (NULL, NULL, 'glassdoor.com', 'Glassdoor', 'productive', 'url', TRUE),
    (NULL, NULL, 'lever.co', 'Lever', 'productive', 'url', TRUE),
    (NULL, NULL, 'greenhouse.io', 'Greenhouse', 'productive', 'url', TRUE),
    (NULL, NULL, 'bamboohr.com', 'BambooHR', 'productive', 'url', TRUE),
    (NULL, NULL, 'gusto.com', 'Gusto', 'productive', 'url', TRUE),

    -- ========================================================================
    -- URL-BASED: Non-productive — Video & Streaming (missing)
    -- ========================================================================
    (NULL, NULL, 'hotstar.com', 'Disney+ Hotstar', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'crunchyroll.com', 'Crunchyroll', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'hbomax.com', 'HBO Max', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'max.com', 'Max (HBO)', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'peacocktv.com', 'Peacock TV', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'paramountplus.com', 'Paramount+', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'apple.com/apple-tv-plus', 'Apple TV+', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'voot.com', 'Voot', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'zee5.com', 'Zee5', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'sonyliv.com', 'SonyLIV', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'jiocinema.com', 'JioCinema', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'bilibili.com', 'Bilibili', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'dailymotion.com', 'Dailymotion', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'vimeo.com', 'Vimeo', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'rumble.com', 'Rumble', 'non_productive', 'url', TRUE),

    -- ========================================================================
    -- URL-BASED: Non-productive — Social Media (missing)
    -- ========================================================================
    (NULL, NULL, 'threads.net', 'Threads', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'bsky.app', 'Bluesky', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'mastodon.social', 'Mastodon', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'vk.com', 'VKontakte', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'quora.com', 'Quora', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'fandom.com', 'Fandom Wiki', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'knowyourmeme.com', 'Know Your Meme', 'non_productive', 'url', TRUE),

    -- ========================================================================
    -- URL-BASED: Non-productive — Music Streaming (missing)
    -- ========================================================================
    (NULL, NULL, 'music.amazon.com', 'Amazon Music', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'music.apple.com', 'Apple Music Web', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'deezer.com', 'Deezer Web', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'tidal.com', 'Tidal Web', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'pandora.com', 'Pandora', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'gaana.com', 'Gaana', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'wynk.in', 'Wynk Music', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'jiosaavn.com', 'JioSaavn', 'non_productive', 'url', TRUE),

    -- ========================================================================
    -- URL-BASED: Non-productive — Gaming (missing)
    -- ========================================================================
    (NULL, NULL, 'roblox.com', 'Roblox Web', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'leagueoflegends.com', 'League of Legends Web', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'xbox.com', 'Xbox', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'playstation.com', 'PlayStation', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'itch.io', 'itch.io', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'gog.com', 'GOG', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'ea.com', 'EA Games', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'blizzard.com', 'Blizzard', 'non_productive', 'url', TRUE),

    -- ========================================================================
    -- URL-BASED: Non-productive — Shopping & E-commerce (missing)
    -- ========================================================================
    (NULL, NULL, 'aliexpress.com', 'AliExpress', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'wish.com', 'Wish', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'temu.com', 'Temu', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'shein.com', 'SHEIN', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'etsy.com', 'Etsy', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'walmart.com', 'Walmart', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'target.com', 'Target', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'bestbuy.com', 'Best Buy', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'amazon.in', 'Amazon India', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'amazon.co.uk', 'Amazon UK', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'amazon.de', 'Amazon Germany', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'amazon.co.jp', 'Amazon Japan', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'snapdeal.com', 'Snapdeal', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'ajio.com', 'AJIO', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'meesho.com', 'Meesho', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'nykaa.com', 'Nykaa', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'booking.com', 'Booking.com', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'airbnb.com', 'Airbnb', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'makemytrip.com', 'MakeMyTrip', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'goibibo.com', 'Goibibo', 'non_productive', 'url', TRUE),

    -- ========================================================================
    -- URL-BASED: Non-productive — News & Media (missing)
    -- ========================================================================
    (NULL, NULL, 'nytimes.com', 'New York Times', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'cnn.com', 'CNN', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'bbc.com', 'BBC', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'bbc.co.uk', 'BBC UK', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'msn.com', 'MSN', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'weather.com', 'Weather.com', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'espn.com', 'ESPN', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'cricbuzz.com', 'Cricbuzz', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'espncricinfo.com', 'ESPNcricinfo', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'sports.yahoo.com', 'Yahoo Sports', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'ndtv.com', 'NDTV', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'timesofindia.indiatimes.com', 'Times of India', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'hindustantimes.com', 'Hindustan Times', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'theguardian.com', 'The Guardian', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'washingtonpost.com', 'Washington Post', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'forbes.com', 'Forbes', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'reuters.com', 'Reuters', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'imdb.com', 'IMDb', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'rottentomatoes.com', 'Rotten Tomatoes', 'non_productive', 'url', TRUE),

    -- ========================================================================
    -- URL-BASED: Non-productive — Food Delivery (missing)
    -- ========================================================================
    (NULL, NULL, 'zomato.com', 'Zomato', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'swiggy.com', 'Swiggy', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'ubereats.com', 'Uber Eats', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'doordash.com', 'DoorDash', 'non_productive', 'url', TRUE),
    (NULL, NULL, 'grubhub.com', 'Grubhub', 'non_productive', 'url', TRUE),

    -- ========================================================================
    -- URL-BASED: Private — Banking (India - missing)
    -- ========================================================================
    (NULL, NULL, '*.yesbank.in', 'Yes Bank', 'private', 'url', TRUE),
    (NULL, NULL, '*.idbibank.in', 'IDBI Bank', 'private', 'url', TRUE),
    (NULL, NULL, '*.pnbindia.in', 'Punjab National Bank', 'private', 'url', TRUE),
    (NULL, NULL, '*.bankofbaroda.in', 'Bank of Baroda', 'private', 'url', TRUE),
    (NULL, NULL, '*.canarabank.com', 'Canara Bank', 'private', 'url', TRUE),
    (NULL, NULL, '*.unionbankofindia.co.in', 'Union Bank', 'private', 'url', TRUE),
    (NULL, NULL, '*.indianbank.in', 'Indian Bank', 'private', 'url', TRUE),
    (NULL, NULL, '*.federalbank.co.in', 'Federal Bank', 'private', 'url', TRUE),
    (NULL, NULL, '*.idfcfirstbank.com', 'IDFC First Bank', 'private', 'url', TRUE),
    (NULL, NULL, '*.bajajfinserv.in', 'Bajaj Finserv', 'private', 'url', TRUE),
    (NULL, NULL, '*.paytmbank.com', 'Paytm Bank', 'private', 'url', TRUE),

    -- ========================================================================
    -- URL-BASED: Private — Banking (US/UK/Global - missing)
    -- ========================================================================
    (NULL, NULL, '*.capitalone.com', 'Capital One', 'private', 'url', TRUE),
    (NULL, NULL, '*.usbank.com', 'US Bank', 'private', 'url', TRUE),
    (NULL, NULL, '*.tdbank.com', 'TD Bank', 'private', 'url', TRUE),
    (NULL, NULL, '*.pnc.com', 'PNC Bank', 'private', 'url', TRUE),
    (NULL, NULL, '*.ally.com', 'Ally Bank', 'private', 'url', TRUE),
    (NULL, NULL, '*.discover.com', 'Discover', 'private', 'url', TRUE),
    (NULL, NULL, '*.americanexpress.com', 'American Express', 'private', 'url', TRUE),
    (NULL, NULL, '*.barclays.co.uk', 'Barclays', 'private', 'url', TRUE),
    (NULL, NULL, '*.hsbc.com', 'HSBC', 'private', 'url', TRUE),
    (NULL, NULL, '*.hsbc.co.uk', 'HSBC UK', 'private', 'url', TRUE),
    (NULL, NULL, '*.lloydsbank.com', 'Lloyds Bank', 'private', 'url', TRUE),
    (NULL, NULL, '*.natwest.com', 'NatWest', 'private', 'url', TRUE),
    (NULL, NULL, '*.santander.co.uk', 'Santander UK', 'private', 'url', TRUE),
    (NULL, NULL, '*.revolut.com', 'Revolut', 'private', 'url', TRUE),
    (NULL, NULL, '*.monzo.com', 'Monzo', 'private', 'url', TRUE),
    (NULL, NULL, '*.n26.com', 'N26', 'private', 'url', TRUE),
    (NULL, NULL, '*.wise.com', 'Wise (TransferWise)', 'private', 'url', TRUE),

    -- ========================================================================
    -- URL-BASED: Private — Payment & Finance (missing)
    -- ========================================================================
    (NULL, NULL, '*.stripe.com', 'Stripe', 'private', 'url', TRUE),
    (NULL, NULL, '*.razorpay.com', 'Razorpay', 'private', 'url', TRUE),
    (NULL, NULL, '*.paytm.com', 'Paytm', 'private', 'url', TRUE),
    (NULL, NULL, '*.phonepe.com', 'PhonePe', 'private', 'url', TRUE),
    (NULL, NULL, '*.gpay.com', 'Google Pay', 'private', 'url', TRUE),
    (NULL, NULL, 'pay.google.com', 'Google Pay Web', 'private', 'url', TRUE),
    (NULL, NULL, 'cash.app', 'Cash App', 'private', 'url', TRUE),
    (NULL, NULL, '*.coinbase.com', 'Coinbase', 'private', 'url', TRUE),
    (NULL, NULL, '*.binance.com', 'Binance', 'private', 'url', TRUE),
    (NULL, NULL, '*.kraken.com', 'Kraken', 'private', 'url', TRUE),
    (NULL, NULL, '*.robinhood.com', 'Robinhood', 'private', 'url', TRUE),
    (NULL, NULL, '*.zerodha.com', 'Zerodha', 'private', 'url', TRUE),
    (NULL, NULL, '*.groww.in', 'Groww', 'private', 'url', TRUE),
    (NULL, NULL, '*.upstox.com', 'Upstox', 'private', 'url', TRUE),
    (NULL, NULL, '*.angelone.in', 'Angel One', 'private', 'url', TRUE),
    (NULL, NULL, '*.etrade.com', 'E*TRADE', 'private', 'url', TRUE),
    (NULL, NULL, '*.fidelity.com', 'Fidelity', 'private', 'url', TRUE),
    (NULL, NULL, '*.schwab.com', 'Charles Schwab', 'private', 'url', TRUE),
    (NULL, NULL, '*.vanguard.com', 'Vanguard', 'private', 'url', TRUE),
    (NULL, NULL, '*.tdameritrade.com', 'TD Ameritrade', 'private', 'url', TRUE),
    (NULL, NULL, 'app.youneedabudget.com', 'YNAB', 'private', 'url', TRUE),

    -- ========================================================================
    -- URL-BASED: Private — Healthcare (missing)
    -- ========================================================================
    (NULL, NULL, '*.practo.com', 'Practo', 'private', 'url', TRUE),
    (NULL, NULL, '*.1mg.com', '1mg', 'private', 'url', TRUE),
    (NULL, NULL, '*.pharmeasy.in', 'PharmEasy', 'private', 'url', TRUE),
    (NULL, NULL, '*.netmeds.com', 'Netmeds', 'private', 'url', TRUE),
    (NULL, NULL, '*.mayoclinic.org', 'Mayo Clinic', 'private', 'url', TRUE),
    (NULL, NULL, '*.webmd.com', 'WebMD', 'private', 'url', TRUE),
    (NULL, NULL, '*.nhs.uk', 'NHS', 'private', 'url', TRUE),
    (NULL, NULL, '*.cigna.com', 'Cigna', 'private', 'url', TRUE),
    (NULL, NULL, '*.unitedhealth*.com', 'UnitedHealthcare', 'private', 'url', TRUE),
    (NULL, NULL, '*.anthem.com', 'Anthem', 'private', 'url', TRUE),
    (NULL, NULL, '*.kaiser*.org', 'Kaiser Permanente', 'private', 'url', TRUE),

    -- ========================================================================
    -- URL-BASED: Private — Insurance & Tax (missing)
    -- ========================================================================
    (NULL, NULL, '*.policybazaar.com', 'PolicyBazaar', 'private', 'url', TRUE),
    (NULL, NULL, '*.incometax.gov.in', 'Income Tax India', 'private', 'url', TRUE),
    (NULL, NULL, '*.irs.gov', 'IRS', 'private', 'url', TRUE),
    (NULL, NULL, '*.hmrc.gov.uk', 'HMRC', 'private', 'url', TRUE),
    (NULL, NULL, '*.freetaxusa.com', 'FreeTaxUSA', 'private', 'url', TRUE),
    (NULL, NULL, '*.taxact.com', 'TaxAct', 'private', 'url', TRUE),

    -- ========================================================================
    -- URL-BASED: Private — Account & Identity (missing)
    -- ========================================================================
    (NULL, NULL, 'accounts.google.com', 'Google Accounts', 'private', 'url', TRUE),
    (NULL, NULL, 'login.microsoftonline.com', 'Microsoft Login', 'private', 'url', TRUE),
    (NULL, NULL, 'appleid.apple.com', 'Apple ID', 'private', 'url', TRUE),
    (NULL, NULL, '*.okta.com', 'Okta SSO', 'private', 'url', TRUE),
    (NULL, NULL, '*.auth0.com', 'Auth0', 'private', 'url', TRUE),
    (NULL, NULL, '*.onelogin.com', 'OneLogin', 'private', 'url', TRUE),
    (NULL, NULL, '*.uidai.gov.in', 'Aadhaar (UIDAI)', 'private', 'url', TRUE),
    (NULL, NULL, '*.digilocker.gov.in', 'DigiLocker', 'private', 'url', TRUE)

ON CONFLICT (identifier, match_by) WHERE organization_id IS NULL AND project_key IS NULL DO NOTHING;
