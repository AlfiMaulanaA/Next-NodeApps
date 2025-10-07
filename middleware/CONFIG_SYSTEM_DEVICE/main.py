# main.py
import multiprocessing
import subprocess

def run_script(script_name):
    try:
        print(f"Starting {script_name}...")
        subprocess.run(['python3', script_name])
    except Exception as e:
        print(f"Error while running {script_name}: {e}")

if __name__ == '__main__':
    scripts = [
        'openvpn_service.py',
        'ikev2_service.py',
        'wireguard_service.py',
    ]
    
    processes = []
    
    for script in scripts:
        p = multiprocessing.Process(target=run_script, args=(script,))
        p.start()
        processes.append(p)
    
    try:
        for p in processes:
            p.join()
    except KeyboardInterrupt:
        print("\nShutting down all VPN services...")
        for p in processes:
            p.terminate()