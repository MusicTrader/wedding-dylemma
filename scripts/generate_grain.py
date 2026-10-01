"""Generate deterministic, pixel-sharp monochrome grain at native screen densities."""
from pathlib import Path
import random
import struct
import zlib

ROOT = Path(__file__).resolve().parent.parent

def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)

for density in (1, 2, 3):
    size = 512 * density
    rng = random.Random(1945 + density)
    rows = bytearray()
    for y in range(size):
        rows.append(0)  # PNG scanline: no filter.
        rows.extend(rng.randrange(256) for _ in range(size))
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 0, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(rows, 9))
    png += chunk(b'IEND', b'')
    (ROOT / 'assets' / f'print-grain-{density}x.png').write_bytes(png)
