"""Check planted feet against world travel, including travel direction.

This checks guide geometry only. Painted pixels and a game clip still need
validation; JSON cannot certify that an artist kept the same leading leg.
"""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
for direction, axis, body_step in [('up', 'y', -25), ('right', 'x', 25)]:
    data = json.loads((ROOT / f'art/rig/soldier_walk_{direction}_pose_guide.json').read_text())
    tracks = data['footTrack']
    assert len(tracks) == 6 and data['cell'] == [256, 384]
    assert data['pivot'] == [128, 330]
    for start, side in [(0, 'right'), (3, 'left')]:
        opposite = 'left' if side == 'right' else 'right'
        for frame in range(start, start + 3):
            assert tracks[frame][side]['planted']
            assert not tracks[frame][opposite]['planted']
        for frame in range(start, start + 2):
            local_step = tracks[frame + 1][side][axis] - tracks[frame][side][axis]
            assert abs(body_step + local_step) < 0.01, (direction, frame, body_step, local_step)
    print(f'{direction}: opposite stance legs; world-planted foot displacement zero')
