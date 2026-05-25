import json
import os

log_path = r"C:\Users\Miquel\.gemini\antigravity\brain\f50aec85-2621-4d2b-bcc8-9d5aa276231a\.system_generated\logs\overview.txt"
out_path = r"c:\Users\Miquel\Desktop\Projecte_Pxx\Geocontent_Core_V1\scratch\step439.txt"

if os.path.exists(log_path):
    with open(log_path, 'r', encoding='utf-8') as f:
        for line in f:
            if '"step_index":439' in line:
                data = json.loads(line)
                with open(out_path, 'w', encoding='utf-8') as out:
                    out.write(data['content'])
                print("Successfully extracted step 439 content to scratch/step439.txt")
                break
else:
    print("Log file not found.")
