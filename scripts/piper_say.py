# Speaks a batch of lines with one Piper voice, loading the voice only once.
# Called by voices.mjs:  python piper_say.py <model.onnx> <pace>
# Reads a JSON list of {"text": ..., "wav": ...} on standard input and writes each WAV file.
import json
import sys
import wave

from piper import PiperVoice, SynthesisConfig

model, pace = sys.argv[1], float(sys.argv[2])
jobs = json.loads(sys.stdin.buffer.read().decode("utf-8"))
voice = PiperVoice.load(model)
config = SynthesisConfig(length_scale=pace)
for job in jobs:
    with wave.open(job["wav"], "wb") as out:
        voice.synthesize_wav(job["text"], out, syn_config=config)
print(len(jobs))
