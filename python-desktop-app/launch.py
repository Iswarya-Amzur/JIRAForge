"""
Time Tracker Launcher

Automatically checks and installs OCR dependencies before starting the app.
This keeps desktop_app.py clean and dependency management separate.

Usage:
    python launch.py              # Check deps and start app
    python launch.py --skip-deps  # Skip dependency check, start app directly
    python launch.py --deps-only  # Only check deps, don't start app
"""

import sys
import argparse


def main():
    parser = argparse.ArgumentParser(description='Time Tracker Launcher')
    parser.add_argument(
        '--skip-deps',
        action='store_true',
        help='Skip dependency check and start app directly'
    )
    parser.add_argument(
        '--deps-only',
        action='store_true',
        help='Only check and install dependencies, do not start app'
    )
    parser.add_argument(
        '--silent',
        action='store_true',
        help='Suppress dependency check output'
    )
    
    args = parser.parse_args()
    
    # Check and install dependencies (unless skipped)
    if not args.skip_deps:
        try:
            from ocr.auto_installer import check_and_install_dependencies
            
            print("[INFO] Checking OCR dependencies...")
            result = check_and_install_dependencies(
                auto_install=True,
                silent=args.silent
            )
            
            if not args.silent:
                if result.get('installed'):
                    print(f"[INFO] Installed: {', '.join(result['installed'])}")
                if result.get('already_installed'):
                    print(f"[INFO] Already installed: {', '.join(result['already_installed'])}")
            
        except Exception as e:
            print(f"[WARN] Dependency check failed: {e}")
            print("[INFO] Continuing anyway...")
    
    # Exit if only checking dependencies
    if args.deps_only:
        print("[INFO] Dependency check complete. Exiting.")
        return
    
    # Start the main application
    print("[INFO] Starting Time Tracker...")
    from desktop_app import main
    main()


if __name__ == '__main__':
    main()
