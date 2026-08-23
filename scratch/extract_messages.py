import json

log_path = '/home/akaun/.gemini/antigravity/brain/5ea19cb2-47cc-4066-8622-dc9f233befdc/.system_generated/logs/transcript_full.jsonl'

with open('scratch/all_messages.txt', 'w') as out:
    with open(log_path, 'r') as f:
        for line in f:
            try:
                data = json.loads(line)
                if data.get('type') in ['USER_INPUT', 'PLANNER_RESPONSE']:
                    content = data.get('content', '')
                    if content and isinstance(content, str):
                        out.write(f"\n--- STEP {data.get('step_index')} [{data.get('type')}] ---\n")
                        out.write(content)
            except Exception as e:
                pass
