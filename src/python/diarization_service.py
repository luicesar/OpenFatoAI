#!/usr/bin/env python3
"""
Diarization microservice — communicates via stdin/stdout (newline-delimited JSON).

Input:  {"chunk_id": str, "audio": base64(float32 LE bytes), "sample_rate": int}
        {"action": "reset"}   → clears speaker registry (call at session start)
Output: {"chunk_id": str, "speakers": [{"label": str, "start": float, "end": float}]}
        {"chunk_id": str, "error": str}   on failure
        {"status": "ready"}               on startup
        {"status": "reset"}               after reset
"""

import sys
import json
import base64
import numpy as np

# ── Global speaker registry — persists across chunks ─────────────
# Each entry: {"centroid": ndarray (normalised), "count": int}
_registry       = []
_next_id        = 0

MATCH_THRESHOLD = 0.78   # cosine similarity to consider same speaker
MIN_WINDOWS     = 3      # discard clusters smaller than this (noise)
CLUSTER_THRESH  = 0.45   # agglomerative distance threshold within a chunk

# ── lazy-load heavy models ────────────────────────────────────────
_encoder = None


def get_encoder():
    global _encoder
    if _encoder is None:
        from resemblyzer import VoiceEncoder
        _encoder = VoiceEncoder()
    return _encoder


def reset_registry():
    global _registry, _next_id
    _registry = []
    _next_id  = 0


def _normalise(v):
    norm = np.linalg.norm(v)
    return v / norm if norm > 1e-8 else v


def global_speaker_id(centroid: np.ndarray) -> int:
    """
    Match centroid to an existing registry entry or create a new one.
    Returns the global speaker index (0-based).
    """
    global _next_id

    centroid = _normalise(centroid)
    best_sim = -1.0
    best_idx = -1

    for i, entry in enumerate(_registry):
        sim = float(np.dot(centroid, entry["centroid"]))
        if sim > best_sim:
            best_sim = sim
            best_idx = i

    if best_sim >= MATCH_THRESHOLD:
        # Update centroid with running average
        entry  = _registry[best_idx]
        n      = entry["count"]
        entry["centroid"] = _normalise((entry["centroid"] * n + centroid) / (n + 1))
        entry["count"]   += 1
        return best_idx
    else:
        # New speaker
        _registry.append({"centroid": centroid, "count": 1})
        sid = _next_id
        _next_id += 1
        return sid


def diarize(audio: np.ndarray, sample_rate: int, min_segment_sec: float = 1.5):
    from resemblyzer import preprocess_wav
    from sklearn.cluster import AgglomerativeClustering
    from sklearn.preprocessing import normalize

    encoder = get_encoder()

    # ── 1. Resample to 16 kHz if needed ──────────────────────────
    if sample_rate != 16000:
        import librosa
        audio = librosa.resample(audio, orig_sr=sample_rate, target_sr=16000)
    audio = audio.astype(np.float32)

    # ── 2. Preprocess ─────────────────────────────────────────────
    wav = preprocess_wav(audio)

    # ── 3. Sliding-window speaker embeddings ─────────────────────
    _, cont_embeds, _ = encoder.embed_utterance(wav, return_partials=True, rate=16)
    if len(cont_embeds) == 0:
        return []

    # ── 4. Cluster within this chunk ─────────────────────────────
    embeds_norm = normalize(cont_embeds)

    clust = AgglomerativeClustering(
        n_clusters=None,
        distance_threshold=CLUSTER_THRESH,
        metric="cosine",
        linkage="average",
    )
    local_labels = clust.fit_predict(embeds_norm)

    # ── 5. Drop noise clusters (too few windows) ──────────────────
    unique, counts = np.unique(local_labels, return_counts=True)
    valid = set(u for u, c in zip(unique, counts) if c >= MIN_WINDOWS)
    if not valid:
        valid = {unique[np.argmax(counts)]}  # keep the biggest at minimum

    # Remap invalid windows to nearest valid centroid
    valid_centroids = {u: embeds_norm[local_labels == u].mean(axis=0) for u in valid}
    for i, lbl in enumerate(local_labels):
        if lbl not in valid:
            best = max(valid, key=lambda u: np.dot(embeds_norm[i], valid_centroids[u]))
            local_labels[i] = best

    # ── 6. Map local cluster IDs → global speaker IDs via registry ─
    local_to_global = {}
    for u in np.unique(local_labels):
        centroid = embeds_norm[local_labels == u].mean(axis=0)
        local_to_global[u] = global_speaker_id(centroid)

    global_labels = np.array([local_to_global[l] for l in local_labels])

    # ── 7. Build contiguous time segments ─────────────────────────
    duration   = len(wav) / 16000.0
    n          = len(global_labels)
    window_dur = duration / n if n > 0 else 0

    segments  = []
    cur_label = global_labels[0]
    cur_start = 0.0

    for i, lbl in enumerate(global_labels[1:], start=1):
        if lbl != cur_label:
            end = i * window_dur
            if (end - cur_start) >= min_segment_sec:
                segments.append({
                    "label": f"SPEAKER_{cur_label}",
                    "start": round(cur_start, 3),
                    "end":   round(end, 3),
                })
            cur_label = lbl
            cur_start = end

    if (duration - cur_start) >= min_segment_sec:
        segments.append({
            "label": f"SPEAKER_{cur_label}",
            "start": round(cur_start, 3),
            "end":   round(duration, 3),
        })

    return segments


def main():
    print(json.dumps({"status": "ready"}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        req = {}
        try:
            req = json.loads(line)

            if req.get("action") == "reset":
                reset_registry()
                print(json.dumps({"status": "reset"}), flush=True)
                continue

            chunk_id = req["chunk_id"]
            audio    = np.frombuffer(base64.b64decode(req["audio"]), dtype=np.float32)
            sr       = int(req.get("sample_rate", 16000))

            speakers = diarize(audio, sr)
            print(json.dumps({"chunk_id": chunk_id, "speakers": speakers}), flush=True)

        except Exception as exc:
            chunk_id = req.get("chunk_id", "unknown")
            print(json.dumps({"chunk_id": chunk_id, "error": str(exc)}), flush=True)


if __name__ == "__main__":
    main()
