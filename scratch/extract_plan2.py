import json

log_path = '/home/akaun/.gemini/antigravity/brain/5ea19cb2-47cc-4066-8622-dc9f233befdc/.system_generated/logs/transcript_full.jsonl'

with open(log_path, 'r') as f:
    for line in f:
        try:
            data = json.loads(line)
            content = data.get('content', '')
            if isinstance(content, str) and ('omnivoice' in content.lower()):
                print(f"Found in step {data.get('step_index')}, type: {data.get('type')}")
        except Exception as e:
            pass
