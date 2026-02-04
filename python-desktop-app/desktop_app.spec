# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for Time Tracker Desktop App
Generates a single-file Windows executable with all dependencies bundled.
"""

import sys

block_cipher = None

a = Analysis(
    ['desktop_app.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        # Flask and web
        'flask',
        'flask_cors',
        'jinja2',
        'markupsafe',
        'werkzeug',
        'itsdangerous',
        'click',
        'blinker',
        # Supabase and related
        'supabase',
        'postgrest',
        'gotrue',
        'realtime',
        'storage3',
        'supafunc',
        'httpx',
        'httpcore',
        'h11',
        'anyio',
        'sniffio',
        'certifi',
        'httpx._transports',
        'httpx._transports.default',
        # Image handling
        'PIL',
        'PIL.Image',
        'PIL.ImageGrab',
        'PIL.ImageDraw',
        # System tray
        'pystray',
        'pystray._win32',
        # Windows APIs
        'win32gui',
        'win32process',
        'win32con',
        'win32event',
        'win32api',
        'winerror',
        'pywintypes',
        'pythoncom',
        # Input monitoring
        'pynput',
        'pynput.mouse',
        'pynput.keyboard',
        'pynput.mouse._win32',
        'pynput.keyboard._win32',
        # Desktop notifications
        'winotify',
        # Secure storage
        'keyring',
        'keyring.backends',
        'keyring.backends.Windows',
        # Timezone
        'tzlocal',
        'tzdata',
        # Networking
        'requests',
        'urllib3',
        'charset_normalizer',
        'idna',
        'certifi',
        # Environment
        'dotenv',
        # Crypto
        'cryptography',
        # Process management
        'psutil',
        # Tkinter (for pause popup)
        'tkinter',
        'tkinter.ttk',
        # SQLite
        'sqlite3',
        # jaraco (required by pkg_resources)
        'jaraco',
        'jaraco.text',
        'jaraco.functools',
        'jaraco.context',
        # Standard library
        'ctypes',
        'json',
        'threading',
        'webbrowser',
        'tempfile',
        'secrets',
        'hashlib',
        'base64',
        'socket',
        'logging',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
        'test',
        'unittest',
        'xmlrpc',
    ],
    noarchive=False,
    cipher=block_cipher,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='TimeTracker',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
