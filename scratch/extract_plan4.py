import re

with open('scratch/all_contents.txt', 'r') as f:
    text = f.read()

# Find blocks where an implementation plan might be.
# We look for artifacts created or updated
parts = text.split('--- STEP')
for part in parts:
    if 'implementation_plan.md' in part.lower() and ('omnivoice' in part.lower() or 'audio' in part.lower() or 'veu' in part.lower()):
        print("FOUND CANDIDATE STEP:")
        print(part[:1500])
        print("========================")

parts = text.split('--- TOOL CALL STEP')
for part in parts:
    if 'implementation_plan.md' in part.lower() and ('omnivoice' in part.lower() or 'veu' in part.lower()):
        print("FOUND CANDIDATE TOOL CALL:")
        print(part[:1500])
        print("========================")

