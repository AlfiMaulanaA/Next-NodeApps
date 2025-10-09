#!/usr/bin/env python3
"""
Fix Microphone Permissions for Voice Control
Helper script to diagnose and fix microphone access issues on macOS.
"""

import subprocess
import sys
import os
from pathlib import Path

def run_command(cmd, description):
    """Run a command and return the result"""
    print(f"\n🔧 {description}")
    print(f"Command: {cmd}")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            print("✅ Success!")
            if result.stdout.strip():
                print(f"Output: {result.stdout.strip()}")
            return True
        else:
            print("❌ Failed!")
            if result.stderr.strip():
                print(f"Error: {result.stderr.strip()}")
            return False
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def check_mic_permissions():
    """Check current microphone permissions"""
    print("🎤 CHECKING MICROPHONE PERMISSIONS")
    print("=" * 50)

    # Check if AirPods/Bluetooth devices are connected
    print("\n1. Checking for connected audio devices...")
    run_command("system_profiler SPAudioDataType | grep -E '(AirPods|Bluetooth|Input|Microphone)' | head -10",
                "Checking connected audio devices")

    # Check microphone permissions in TCC database
    print("\n2. Checking microphone permissions in TCC database...")
    run_command("tccutil reset Microphone", "Resetting microphone permissions (will prompt for approval)")

    # Check Python executable permissions
    print("\n3. Checking Python executable permissions...")
    python_path = sys.executable
    print(f"Python executable: {python_path}")

    # Try to access microphone directly
    print("\n4. Testing direct microphone access...")
    test_script = '''
import speech_recognition as sr
try:
    with sr.Microphone() as source:
        print("SUCCESS: Microphone access granted")
except Exception as e:
    print(f"FAILED: {e}")
'''
    with open('/tmp/test_mic.py', 'w') as f:
        f.write(test_script)

    run_command("python3 /tmp/test_mic.py", "Testing microphone access with Python")

    # Clean up
    os.remove('/tmp/test_mic.py')

def install_dependencies():
    """Install required dependencies"""
    print("\n📦 INSTALLING DEPENDENCIES")
    print("=" * 50)

    print("\n1. Installing speech_recognition...")
    run_command("pip install speech_recognition", "Installing speech recognition library")

    print("\n2. Installing PyAudio (macOS)...")
    # Try different PyAudio installation methods for macOS
    methods = [
        ("pip install pyaudio", "Installing PyAudio via pip"),
        ("brew install portaudio && pip install pyaudio", "Installing PyAudio via Homebrew"),
        ("pip install --global-option='build_ext' --global-option='-I/usr/local/include' --global-option='-L/usr/local/lib' pyaudio", "Installing PyAudio with custom paths")
    ]

    for cmd, desc in methods:
        if run_command(cmd, desc):
            break

def main():
    """Main function"""
    print("🎤 VOICE CONTROL - MICROPHONE PERMISSIONS FIX")
    print("=" * 60)
    print("This script will help diagnose and fix microphone access issues.")
    print("Make sure your AirPods are connected and selected as input device.")
    print()

    if len(sys.argv) > 1 and sys.argv[1] == "--install":
        install_dependencies()
    else:
        check_mic_permissions()

        print("\n" + "=" * 60)
        print("🎯 MANUAL STEPS TO COMPLETE THE FIX:")
        print("=" * 60)
        print("1. Go to System Settings > Privacy & Security > Microphone")
        print("2. Make sure the checkbox next to your Python/terminal app is checked")
        print("3. If Python is not listed, run this script again after granting permissions")
        print("4. Restart any terminal/Python applications")
        print("5. Try disconnecting and reconnecting your AirPods")
        print()
        print("6. Test the fix by running:")
        print("   cd middleware/CONFIG_SYSTEM_DEVICE")
        print("   python3 -c \"import VoiceControlService; r = VoiceControlService.VoiceRecognizer(None); r.start_listening()\"")
        print()
        print("7. If still not working, try:")
        print("   python3 fix_microphone_permissions.py --install")
        print("=" * 60)

if __name__ == "__main__":
    main()
