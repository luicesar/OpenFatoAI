#!/usr/bin/env python3
"""
Whisper transcription microservice — stdin/stdout JSON (faster-whisper/CTranslate2).

Input:  {"req_id": str, "audio": base64(float32 LE bytes), "language": str}
Output: {"req_id": str, "text": str}
        {"req_id": str, "error": str}   on failure
        {"status": "ready"}             on startup
"""
import sys
import json
import base64
import re
import numpy as np

MODEL_SIZE = "small"
_model = None


def get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        _model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
    return _model


def transcribe(audio_np, language):
    model = get_model()
    lang = "pt" if language in ("pt-BR", "pt") else "en"
    segments, _ = model.transcribe(
        audio_np,
        language=lang,
        task="transcribe",
        condition_on_previous_text=False,
        no_speech_threshold=0.6,
        log_prob_threshold=-1.0,
        vad_filter=True,
    )
    return "".join(s.text for s in segments).strip()


def filter_output(text):
    """Remove hallucination tokens like [MUSIC], (applause), etc."""
    text = re.sub(r'\[[^\]]{1,40}\]', '', text)
    text = re.sub(r'\([^)]{1,40}\)', '', text)
    return text.strip()


def main():
    get_model()  # pre-load before announcing ready
    print(json.dumps({"status": "ready"}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        req = {}
        try:
            req = json.loads(line)
            audio_bytes = base64.b64decode(req["audio"])
            audio_np = np.frombuffer(audio_bytes, dtype=np.float32).copy()
            raw  = transcribe(audio_np, req.get("language", "pt-BR"))
            text = filter_output(raw)
            print(json.dumps({"req_id": req["req_id"], "text": text}), flush=True)
        except Exception as e:
            print(json.dumps({"req_id": req.get("req_id", "unknown"), "error": str(e)}), flush=True)


if __name__ == "__main__":
    main()
