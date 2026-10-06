"""Generate original, small demo thumbnails, silent slide videos, and study notes.

Run from any directory: python3 backend/scripts/generateDemoAssets.py
Requires ffmpeg with libx264. No third-party Python packages or network access.
"""
from pathlib import Path
import math
import struct
import subprocess
import zlib

ROOT = Path(__file__).resolve().parent.parent / 'assets' / 'demo'
TOPICS = [
    ('programming', 'Programming Foundations', '#123b49', [
        ('Variables and Types', 'A variable names a value. Strings hold text; integers hold whole numbers. Assign once, then use the name in an expression.', 'Set score to 4. Add 3 and explain why the result is 7.'),
        ('Conditions and Loops', 'A condition chooses a branch when a Boolean test is true. A loop repeats work until its stopping condition is met.', 'Write pseudocode that prints even numbers from 2 through 10.'),
    ]),
    ('web', 'Web Essentials', '#634a2c', [
        ('Semantic HTML', 'HTML describes meaning: headings introduce sections, links navigate, and labels identify form inputs.', 'Sketch a page with a heading, paragraph, link, and labeled input.'),
        ('CSS Layout', 'Flexbox aligns items on one axis. Grid places items in rows and columns. Use relative units so layouts adapt.', 'Describe a two-column layout that stacks on narrow screens.'),
    ]),
    ('data', 'Data Literacy', '#315444', [
        ('Tables and Missing Values', 'A row is an observation and a column is a variable. Missing values are not zero; inspect them before calculating averages.', 'Find the mean of 2, 4, and 6; state what changes if one value is missing.'),
        ('Charts and Claims', 'A bar chart compares categories; a line chart shows change over time. Check axis scales and sample sizes before drawing conclusions.', 'Choose a chart for monthly signups and explain your choice.'),
    ]),
    ('python', 'Python Practice Lab', '#374e71', [
        ('Functions and Parameters', 'A function groups reusable steps. Parameters are inputs; return values pass results back to the caller.', 'Define a function that doubles a number and test it with 5.'),
        ('Lists and Dictionaries', 'A list stores ordered values. A dictionary maps unique keys to values for quick lookup.', 'Store three book titles in a list and one title-to-author mapping.'),
    ]),
    ('design', 'Interface Design Lab', '#734d56', [
        ('Visual Hierarchy', 'Contrast, size, and spacing help readers prioritize information. Consistent typography makes relationships predictable.', 'Redesign a crowded card using a heading, supporting text, and one action.'),
        ('Accessible Forms', 'Visible labels explain inputs; helpful error messages identify how to recover. Keyboard focus must remain visible.', 'Draft a signup form with labels and an actionable email error.'),
    ]),
    ('analytics', 'Practical Analytics', '#625b3c', [
        ('Questions and Metrics', 'A useful metric answers a specific decision question. Define its numerator, denominator, and time window first.', 'Define a weekly completion rate and name one limitation.'),
        ('Experiments and Bias', 'Random assignment reduces selection bias. Compare groups over the same period and avoid treating correlation as causation.', 'Describe a fair test of two onboarding messages.'),
    ]),
]


def rgb(hex_color):
    return bytes.fromhex(hex_color.lstrip('#'))


def png(path, base):
    width, height = 640, 360
    color = rgb(base)
    rows = []
    for y in range(height):
        row = bytearray()
        for x in range(width):
            stripe = x < 18 or (y > 300 and x < 270)
            row.extend((222, 198, 134) if stripe else tuple(min(255, c + (x // 100) * 3) for c in color))
        rows.append(b'\0' + bytes(row))
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b''.join(rows), 9)) + chunk(b'IEND', b''))


def pdf(path, title, explanation, exercise):
    def escape(s):
        return s.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
    lines = ['EXAMPLE STUDY NOTE - ORIGINAL DEMO MATERIAL', title, '', 'Concept', *wrap(explanation), '', 'Exercise', *wrap(exercise), '', 'Try the exercise before checking your understanding.']
    stream = 'BT /F1 13 Tf 48 780 Td 19 TL ' + ' '.join(f'({escape(line)}) Tj T*' for line in lines) + ' ET'
    objects = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>', b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', f'<< /Length {len(stream.encode())} >>\nstream\n{stream}\nendstream'.encode()]
    output = bytearray(b'%PDF-1.4\n')
    offsets = [0]
    for n, obj in enumerate(objects, 1):
        offsets.append(len(output))
        output.extend(f'{n} 0 obj\n'.encode() + obj + b'\nendobj\n')
    start = len(output)
    output.extend(f'xref\n0 {len(offsets)}\n0000000000 65535 f \n'.encode())
    for offset in offsets[1:]:
        output.extend(f'{offset:010d} 00000 n \n'.encode())
    output.extend(f'trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n'.encode())
    path.write_bytes(output)


def wrap(text):
    import textwrap
    return textwrap.wrap(text, width=72)


def drawtext(text):
    return text.replace('\\', '\\\\').replace(':', '\\:').replace("'", "\\'").replace(',', '\\,')


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    for slug, title, color, lessons in TOPICS:
        directory = ROOT / slug
        directory.mkdir(exist_ok=True)
        png(directory / 'thumbnail.png', color)
        original = directory / 'base.png'
        (directory / 'thumbnail.png').rename(original)
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(original), '-vf', f"drawtext=text='{drawtext('EXAMPLE COURSE')}':fontcolor=white:fontsize=24:x=45:y=85,drawtext=text='{drawtext(title)}':fontcolor=white:fontsize=36:x=45:y=155", '-frames:v', '1', str(directory / 'thumbnail.png')], check=True)
        original.unlink()
        for number, (heading, explanation, exercise) in enumerate(lessons, 1):
            pdf(directory / f'module-{number}-notes.pdf', f'{title} - {heading}', explanation, exercise)
            filters = ','.join([
                f"drawtext=text='{drawtext('EXAMPLE DEMO SLIDE - NOT A NARRATED COURSE')}':fontcolor=white:fontsize=20:x=40:y=55",
                f"drawtext=text='{drawtext(title)}':fontcolor=white:fontsize=34:x=40:y=120",
                f"drawtext=text='{drawtext(heading)}':fontcolor=white:fontsize=28:x=40:y=195",
                f"drawtext=text='{drawtext('Read the study note for explanation and exercise')}':fontcolor=white:fontsize=20:x=40:y=285",
            ])
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', f'color=c={color}:s=640x360:r=12:d=5', '-vf', filters, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(directory / f'module-{number}-slide.mp4')], check=True)


if __name__ == '__main__':
    main()
