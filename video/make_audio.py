import json, wave, pathlib, numpy as np
here = pathlib.Path(__file__).parent
info = json.loads((here / 'events.json').read_text())
SR = 44100; total = info['total']; N = int(SR * (total + 0.2)); mix = np.zeros(N)
def env(n, a=0.008, curve=5.0):
    t = np.arange(n) / SR; e = np.exp(-curve * t / (n / SR)); k = max(1, int(a * SR)); e[:k] *= np.linspace(0, 1, k); return e
def wavef(kind, ph):
    if kind == 'tri': return 2 / np.pi * np.arcsin(np.sin(ph))
    if kind == 'saw': return 2 * (ph / (2 * np.pi) % 1) - 1
    return np.sin(ph)
def tone(f, t0, dur, vol=0.2, kind='sine', slide=None, curve=5.0, attack=0.008):
    n = int(dur * SR); i0 = int(t0 * SR)
    if i0 >= N: return
    n = min(n, N - i0); t = np.arange(n) / SR
    fr = f * (slide / f) ** (t / dur) if slide else np.full(n, f)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    mix[i0:i0 + n] += wavef(kind, ph) * env(n, attack, curve) * vol
def note(semi): return 196.0 * 2 ** (semi / 12)
scale = [0, 2, 4, 7, 9]
TA, TB, TC, TD = info['TA'], info['TB'], info['TC'], info['TD']
# pad: slow drone under everything
for semi, v in [(-12, 0.10), (-5, 0.07), (0, 0.05)]:
    n = N; t = np.arange(n) / SR; f = note(semi)
    swell = np.clip(t / 2.0, 0, 1) * (0.55 + 0.45 * np.clip((t - (TA + TB + TC - 0.5)) / 1.5, 0, 1)) * np.clip((total - t) / 1.2, 0, 1)
    mix[:n] += (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.003 * t)) * swell * v * (0.85 + 0.15 * np.sin(2 * np.pi * 0.21 * t))
for e in info['events']:
    t = e['t']
    if e['type'] == 'pair':
        i = e['i']; deg = scale[(i * 2) % 5] + 12 * ((i // 5) % 2) + (12 if e['cat'] == 'health' else 0)
        tone(note(deg + 12), t, 0.34, 0.085, 'tri'); tone(note(deg + 24), t + 0.01, 0.2, 0.03)
        if e.get('bonus') == 'rare':
            for k, s in enumerate([24, 28, 31, 36]): tone(note(s), t + 0.04 + k * 0.06, 0.5, 0.07, 'tri')
    elif e['type'] == 'shielded': tone(1318.5, t, 0.9, 0.09, curve=4); tone(1760, t + 0.07, 0.9, 0.06, curve=4)
    elif e['type'] == 'gap': tone(70, t, 0.7, 0.3, slide=42, curve=4)
    elif e['type'] == 'damaged': tone(150, t, 0.6, 0.16, 'saw', slide=46); tone(98, t + 0.02, 0.7, 0.12, slide=40)
    elif e['type'] == 'repaired':
        tone(220, t, 0.32, 0.05, 'saw', slide=880)
        for k, s in enumerate([19, 24, 31]): tone(note(s), t + 0.28 + k * 0.07, 0.8, 0.10, 'tri')
t0 = TA + TB + TC
for k, s in enumerate([-12, 0, 7, 12, 16, 19, 24, 28]): tone(note(s), t0 + 0.1 + k * 0.11, 3.6, 0.13, 'tri' if k > 1 else 'sine', curve=3.2, attack=0.02)
tone(note(0), t0 + 1.4, 3.2, 0.10, curve=2.5, attack=0.3); tone(note(7), t0 + 1.4, 3.2, 0.08, curve=2.5, attack=0.3)
# soft echo, normalize, fades
d = int(0.23 * SR); echo = np.zeros(N); echo[d:] = mix[:-d] * 0.28; mix += echo
mix /= max(1e-9, np.max(np.abs(mix))) / 0.7
fi = int(0.3 * SR); mix[:fi] *= np.linspace(0, 1, fi); fo = int(0.6 * SR); end = int(total * SR); mix[end - fo:end] *= np.linspace(1, 0, fo); mix[end:] = 0
st = np.stack([mix, np.roll(mix, 180)], axis=1)
with wave.open(str(here / 'soundtrack.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype('<i2').tobytes())
print('audio', round(N / SR, 2), 's')
