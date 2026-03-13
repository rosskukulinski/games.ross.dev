#!/usr/bin/env python3
"""
Analyze K-Pop Rhythm Tap songs using librosa.
Produces beatmaps.js with pre-computed beat events for each song.

Usage:
  pip install librosa soundfile numpy
  python scripts/analyze-songs.py

Or with uvx:
  uvx --from librosa --with soundfile --with numpy python scripts/analyze-songs.py
"""

import json
import os
import sys

import librosa
import numpy as np

SONGS_DIR = os.path.join(os.path.dirname(__file__), '..', 'games', 'kpop-rythm-tap', 'public', 'songs')
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), '..', 'games', 'kpop-rythm-tap', 'src', 'beatmaps.js')

SONG_IDS = [
    'golden',
    'how-its-done',
    'soda-pop',
    'takedown',
    'your-idol',
    'free',
    'what-it-sounds-like',
    'strategy',
    'love-maybe',
    'path',
    'best-day',
    'zoo',
    'shake-it-off',
    'chicken-banana',
    'better-when-im-dancing',
]


def analyze_song(filepath, song_id):
    print(f'  Loading {song_id}...')
    y, sr = librosa.load(filepath, sr=22050, mono=True)

    # Beat tracking for BPM and beat grid
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    # tempo may be an array in newer librosa
    bpm = float(np.atleast_1d(tempo)[0])
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)

    if len(beat_times) == 0:
        print(f'  WARNING: No beats detected for {song_id}')
        return None

    first_beat = float(beat_times[0])
    print(f'  BPM: {bpm:.1f}, first beat: {first_beat:.3f}s, beats: {len(beat_times)}')

    # HPSS - separate harmonic and percussive
    y_harmonic, y_percussive = librosa.effects.hpss(y)

    # Onset detection on percussive (drums)
    onset_env_perc = librosa.onset.onset_strength(y=y_percussive, sr=sr)
    onset_frames_perc = librosa.onset.onset_detect(
        y=y_percussive, sr=sr, onset_envelope=onset_env_perc, backtrack=False
    )
    onset_times_perc = librosa.frames_to_time(onset_frames_perc, sr=sr)
    # Get strength values at onset frames
    onset_strengths_perc = onset_env_perc[onset_frames_perc] if len(onset_frames_perc) > 0 else np.array([])

    print(f'  Drum onsets: {len(onset_times_perc)}')

    # Onset detection on harmonic (melody)
    onset_env_harm = librosa.onset.onset_strength(y=y_harmonic, sr=sr)
    onset_frames_harm = librosa.onset.onset_detect(
        y=y_harmonic, sr=sr, onset_envelope=onset_env_harm, backtrack=False
    )
    onset_times_harm = librosa.frames_to_time(onset_frames_harm, sr=sr)
    onset_strengths_harm = onset_env_harm[onset_frames_harm] if len(onset_frames_harm) > 0 else np.array([])

    # Estimate pitch at melody onsets using the harmonic signal
    pitchfork_times = onset_times_harm
    pitches = []
    hop_length = 512
    for t in pitchfork_times:
        # Get a short segment around the onset
        center_sample = int(t * sr)
        start = max(0, center_sample - 2048)
        end = min(len(y_harmonic), center_sample + 2048)
        segment = y_harmonic[start:end]
        if len(segment) < 512:
            pitches.append(0.0)
            continue
        # Use autocorrelation for pitch estimation
        f0 = librosa.yin(segment, fmin=80, fmax=1000, sr=sr)
        median_f0 = float(np.median(f0[f0 > 0])) if np.any(f0 > 0) else 0.0
        pitches.append(median_f0)

    print(f'  Melody onsets: {len(onset_times_harm)}')

    # Build 16th-note grid from beat times
    beat_interval = 60.0 / bpm
    sixteenth = beat_interval / 4.0

    # Quantize function: snap to nearest 16th note
    def quantize(t):
        # Offset relative to first beat
        rel = t - first_beat
        q = round(rel / sixteenth) * sixteenth
        return first_beat + q

    # Build events
    events = []
    seen_times = set()

    # Add drum events
    for i, t in enumerate(onset_times_perc):
        qt = round(quantize(float(t)), 4)
        if qt < first_beat:
            continue
        s = float(onset_strengths_perc[i]) if i < len(onset_strengths_perc) else 1.0
        key = (qt, 'd')
        if key not in seen_times:
            seen_times.add(key)
            events.append({'t': qt, 'type': 'd', 's': round(s, 2)})

    # Add melody events
    for i, t in enumerate(onset_times_harm):
        qt = round(quantize(float(t)), 4)
        if qt < first_beat:
            continue
        s = float(onset_strengths_harm[i]) if i < len(onset_strengths_harm) else 1.0
        p = pitches[i] if i < len(pitches) else 0.0
        key = (qt, 'm')
        if key not in seen_times:
            seen_times.add(key)
            events.append({'t': qt, 'type': 'm', 's': round(s, 2), 'p': round(p, 1)})

    # Deduplicate: if drum and melody land on same quantized time, keep the stronger one
    time_map = {}
    for ev in events:
        t = ev['t']
        if t not in time_map:
            time_map[t] = ev
        else:
            # Keep the one with higher strength
            if ev['s'] > time_map[t]['s']:
                time_map[t] = ev

    events = sorted(time_map.values(), key=lambda e: e['t'])
    print(f'  Total events (deduplicated): {len(events)}')

    return {
        'bpm': round(bpm, 1),
        'offset': round(first_beat, 3),
        'events': events,
    }


def main():
    print('K-Pop Rhythm Tap — Song Analysis')
    print('=' * 40)

    beatmaps = {}
    for song_id in SONG_IDS:
        filepath = os.path.join(SONGS_DIR, f'{song_id}.mp3')
        if not os.path.exists(filepath):
            print(f'  SKIP: {filepath} not found')
            continue
        result = analyze_song(filepath, song_id)
        if result:
            beatmaps[song_id] = result

    print(f'\nAnalyzed {len(beatmaps)} songs')

    # Write beatmaps.js
    # Format events compactly
    lines = ['// Auto-generated by analyze-songs.py — do not edit manually', 'export const beatmaps = {']
    for song_id, data in beatmaps.items():
        lines.append(f"  '{song_id}': {{")
        lines.append(f"    bpm: {data['bpm']},")
        lines.append(f"    offset: {data['offset']},")
        lines.append(f'    events: [')
        for ev in data['events']:
            if ev['type'] == 'd':
                lines.append(f"      {{ t: {ev['t']}, type: 'd', s: {ev['s']} }},")
            else:
                lines.append(f"      {{ t: {ev['t']}, type: 'm', s: {ev['s']}, p: {ev['p']} }},")
        lines.append('    ],')
        lines.append('  },')
    lines.append('};')
    lines.append('')

    with open(OUTPUT_FILE, 'w') as f:
        f.write('\n'.join(lines))

    print(f'Wrote {OUTPUT_FILE}')

    # Print summary
    print('\nSummary:')
    print(f"{'Song':<25} {'BPM':>6} {'Offset':>8} {'Events':>8}")
    print('-' * 50)
    for song_id, data in beatmaps.items():
        print(f"{song_id:<25} {data['bpm']:>6.1f} {data['offset']:>7.3f}s {len(data['events']):>8}")


if __name__ == '__main__':
    main()
