"""Measure solid glyph/background contrast in recognized synthetic M1 profile text."""
import argparse
import collections
import csv
import io
import json
import subprocess
from pathlib import Path


def luminance(rgb):
    linear = [v / 255 / 12.92 if v / 255 <= .04045 else ((v / 255 + .055) / 1.055) ** 2.4 for v in rgb]
    return sum(v * weight for v, weight in zip(linear, (.2126, .7152, .0722)))


def ratio(a, b):
    bright, dark = sorted((luminance(a), luminance(b)), reverse=True)
    return (bright + .05) / (dark + .05)


def measure(path):
    result = subprocess.run(['tesseract', str(path), 'stdout', 'tsv'],
                            capture_output=True, text=True, check=True, timeout=15)
    words = list(csv.DictReader(io.StringIO(result.stdout), delimiter='\t'))
    text = ' '.join(w['text'].lower() for w in words)
    if not all(marker in text for marker in ('collaudo', 'dati', 'locali')):
        raise ValueError('Synthetic fixture marker required; no result produced.')
    checks = []
    header_bottom = 0
    # Header, first post body and its date; every sample must be visible OCR text.
    for name, options in [('header', {'tuoi'}), ('body', {'post'}), ('date', {'oct', 'ott'})]:
        candidates = [w for w in words if w['text'].strip().lower() in options and float(w['conf']) >= 70]
        if name == 'body':
            candidates = [w for w in candidates if int(w['top']) > header_bottom]
        if not candidates:
            raise ValueError('Missing visible synthetic sample: ' + name)
        word = candidates[0]
        if name == 'header':
            header_bottom = int(word['top']) + int(word['height'])
        geometry = '{width}x{height}+{left}+{top}'.format(**word)
        data = subprocess.run(['magick', str(path), '-crop', geometry, '+repage', '-depth', '8', 'rgb:-'],
                              capture_output=True, check=True, timeout=10).stdout
        colors = collections.Counter(tuple(data[i:i+3]) for i in range(0, len(data), 3))
        background = colors.most_common(1)[0][0]
        # Sample solid ink, not antialiased edges. Require multiple matching pixels.
        foreground = max((color for color, count in colors.items() if count >= 5),
                         key=lambda color: ratio(color, background))
        contrast = ratio(foreground, background)
        checks.append({'sample': name, 'foreground_rgb': foreground, 'background_rgb': background,
                       'ratio': round(contrast, 2), 'minimum': 4.5, 'passed': contrast >= 4.5})
    return {'scope': 'Three visible synthetic profile text samples; not a full screen accessibility audit',
            'checks': checks, 'status': 'passed' if all(c['passed'] for c in checks) else 'failed'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('image', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    report = measure(args.image)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(report['status'] + ': ' + ', '.join(c['sample'] + '=' + str(c['ratio']) for c in report['checks']))
    raise SystemExit(0 if report['status'] == 'passed' else 1)
