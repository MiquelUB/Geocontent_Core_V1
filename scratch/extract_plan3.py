import json

log_path = '/home/akaun/.gemini/antigravity/brain/5ea19cb2-47cc-4066-8622-dc9f233befdc/.system_generated/logs/transcript_full.jsonl'

with open(log_path, 'r') as f:
    for line in f:
        try:
            data = json.loads(line)
            if 'tool_calls' in data:
                for call in data['tool_calls']:
                    args_json = json.dumps(call.get('args', {}))
                    if 'omnivoice' in args_json.lower():
                        print(f"Found in step {data.get('step_index')}, tool: {call['name']}")
                        if call['name'] in ['write_to_file', 'replace_file_content', 'multi_replace_file_content']:
                            print(args_json[:1000])
                            with open('scratch/omnivoice_plan.md', 'w') as out:
                                out.write(args_json)
        except Exception as e:
            pass
