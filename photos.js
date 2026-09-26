/* Photo prep, all on the phone before anything uploads:
   - reads the date the photo was taken (EXIF), so moments land in the right month
   - shrinks it to a full-size copy (2048px) and a thumbnail (480px), both JPEG.
     A 4 MB iPhone photo ends up around 400 KB, which keeps storage near free. */
const Photos = (() => {
  const FULL = { edge: 2048, quality: 0.82 };
  const THUMB = { edge: 480, quality: 0.75 };

  // Finds the EXIF block (JPEG or HEIC) and returns 'YYYY-MM-DD' of when the
  // photo was taken, or null. Only the start of the file is read.
  async function takenOn(file) {
    try {
      const buf = new Uint8Array(await file.slice(0, 512 * 1024).arrayBuffer());
      for (let i = 0; i < buf.length - 8; i++) {
        const le = buf[i] === 0x49 && buf[i + 1] === 0x49 && buf[i + 2] === 0x2a && buf[i + 3] === 0;
        const be = buf[i] === 0x4d && buf[i + 1] === 0x4d && buf[i + 2] === 0 && buf[i + 3] === 0x2a;
        if (!le && !be) continue;
        const found = readTiff(buf, i, le);
        if (found) return found;
      }
    } catch (e) { console.warn('Could not read photo date', e); }
    return null;
  }

  function readTiff(buf, start, le) {
    const view = new DataView(buf.buffer, buf.byteOffset + start);
    const len = buf.length - start;
    const u16 = o => view.getUint16(o, le);
    const u32 = o => view.getUint32(o, le);
    const ascii = (o, n) => String.fromCharCode(...buf.subarray(start + o, start + o + n)).replace(/\0.*$/, '');

    function entries(ifd) {
      if (ifd + 2 > len) return [];
      const n = u16(ifd), out = [];
      for (let k = 0; k < n; k++) {
        const e = ifd + 2 + k * 12;
        if (e + 12 > len) break;
        out.push({ tag: u16(e), count: u32(e + 4), value: u32(e + 8) });
      }
      return out;
    }
    const toDate = s => {
      const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(s);
      return m && m[1] !== '0000' ? `${m[1]}-${m[2]}-${m[3]}` : null;
    };

    const ifd0 = u32(4);
    if (ifd0 < 8 || ifd0 > len) return null;
    let fallback = null;
    for (const e of entries(ifd0)) {
      if (e.tag === 0x0132 && e.value + 19 <= len) fallback = toDate(ascii(e.value, 19));
      if (e.tag === 0x8769 && e.value < len) {
        for (const x of entries(e.value)) {
          if (x.tag === 0x9003 && x.value + 19 <= len) {
            const d = toDate(ascii(x.value, 19));
            if (d) return d;
          }
        }
      }
    }
    return fallback;
  }

  async function load(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } catch {
      throw new Error(`Couldn’t open "${file.name}". Try a different photo.`);
    } finally {
      // Safe to revoke after decode: the pixels are already loaded.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  function shrink(img, { edge, quality }) {
    const scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return new Promise((resolve, reject) => canvas.toBlob(blob => {
      canvas.width = canvas.height = 0; // frees memory right away on iPhone
      blob ? resolve({ blob, w, h }) : reject(new Error('Couldn’t shrink that photo.'));
    }, 'image/jpeg', quality));
  }

  // -> { date, full: {blob,w,h}, thumb: {blob,w,h} }
  async function prepare(file) {
    const date = (await takenOn(file)) || (file.lastModified ? Dates.iso(new Date(file.lastModified)) : null);
    const img = await load(file);
    const full = await shrink(img, FULL);
    const thumb = await shrink(img, THUMB);
    return { date, full, thumb };
  }

  return { takenOn, prepare };
})();
