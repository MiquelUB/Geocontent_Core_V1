import json

log_path = '/home/akaun/.gemini/antigravity/brain/5ea19cb2-47cc-4066-8622-dc9f233befdc/.system_generated/logs/transcript_full.jsonl'
output = open('scratch/all_contents.txt', 'w')

with open(log_path, 'r') as f:
    for line in f:
        try:
            data = json.loads(line)
            if 'content' in data and isinstance(data['content'], str):
                output.write(f"\n--- STEP {data.get('step_index')} [{data.get('type')}] ---\n")
                output.write(data['content'])
            
            if 'tool_calls' in data:
                for call in data['tool_calls']:
                    args_json = json.dumps(call.get('args', {}))
                    output.write(f"\n--- TOOL CALL STEP {data.get('step_index')} {call['name']} ---\n")
                    output.write(args_json)
        except Exception:
            pass

output.close()
