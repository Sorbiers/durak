# Speaks a batch of lines with Silero's Russian voices, loading the model only once.
# Called by voices.mjs with the Python of an environment that has torch installed.
# Reads a JSON list of {"ssml": ..., "speaker": ..., "wav": ...} on standard input and writes
# each WAV file (48 kHz, mono, 16-bit).
import json
import os
import sys
import wave

import numpy as np
import torch

RATE = 48000
jobs = json.loads(sys.stdin.buffer.read().decode("utf-8"))
# Once the model has been fetched it is loaded from torch's own cache, so recording needs no
# network. Asking GitHub every time, as the plain call does, fails whenever GitHub hiccups.
cached = os.path.join(torch.hub.get_dir(), "snakers4_silero-models_master")
source = {"repo_or_dir": cached, "source": "local"} if os.path.isdir(cached) else {
    "repo_or_dir": "snakers4/silero-models",
    "trust_repo": True,
}
model, _ = torch.hub.load(model="silero_tts", language="ru", speaker="v4_ru", verbose=False, **source)
model.to(torch.device("cuda" if torch.cuda.is_available() else "cpu"))
for job in jobs:
    with torch.no_grad():
        audio = model.apply_tts(
            ssml_text=job["ssml"],
            speaker=job["speaker"],
            sample_rate=RATE,
            put_accent=True,
            put_yo=True,
        )
    samples = (np.clip(audio.cpu().numpy(), -1.0, 1.0) * 32767).astype(np.int16)
    with wave.open(job["wav"], "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(samples.tobytes())
print(len(jobs))
