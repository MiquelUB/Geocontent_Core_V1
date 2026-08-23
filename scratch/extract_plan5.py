import json

log_path = '/home/akaun/.gemini/antigravity/brain/5ea19cb2-47cc-4066-8622-dc9f233befdc/.system_generated/logs/transcript_full.jsonl'

with open(log_path, 'r') as f:
    for line in f:
        try:
            data = json.loads(line)
            if 'tool_calls' in data:
                for call in data['tool_calls']:
                    if call['name'] in ['write_to_file', 'replace_file_content', 'multi_replace_file_content']:
                        args = call.get('args', {})
                        target = args.get('TargetFile', '')
                        if 'implementation_plan.md' in target:
                            content = args.get('CodeContent', '') or args.get('ReplacementContent', '')
                            # look for plans about audio, video, tts, dubbing
                            if any(k in content.lower() for k in ['veu', 'audio', 'video', 'tts', 'dubbing']):
                                print(f"--- FOUND VERSION (Step {data['step_index']}) ---")
                                print(content[:800])
                                print("--- END VERSION ---\n")
        except Exception as e:
            pass
