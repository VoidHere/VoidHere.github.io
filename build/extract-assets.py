import json, base64

src = r"C:\Users\Void Here\.local\share\opencode\tool-output\tool_144f840a3001sDfwmNmDW9PfUO"
with open(src, encoding="utf-8", errors="replace") as f:
    raw = f.read()

# The tool output is a JSON-ish dump; find the first '{' and parse from there.
start = raw.index("{")
data = json.loads(raw[start:raw.rindex("}") + 1])

with open("test-assets/test.mp4", "wb") as f:
    f.write(base64.b64decode(data["mp4"]))
with open("test-assets/tone.mp3", "wb") as f:
    f.write(base64.b64decode(data["mp3"]))

print("mp4 bytes:", len(base64.b64decode(data["mp4"])))
print("mp3 bytes:", len(base64.b64decode(data["mp3"])))
