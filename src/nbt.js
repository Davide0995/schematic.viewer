import { gunzipSync } from 'fflate';

const TAG = { END:0,BYTE:1,SHORT:2,INT:3,LONG:4,FLOAT:5,DOUBLE:6,BYTE_ARRAY:7,STRING:8,LIST:9,COMPOUND:10,INT_ARRAY:11,LONG_ARRAY:12 };

class NBTReader {
  constructor(buf) {
    this.view = new DataView(buf instanceof ArrayBuffer ? buf : buf.buffer, buf.byteOffset ?? 0, buf.byteLength);
    this.pos = 0;
  }
  u8()  { return this.view.getUint8(this.pos++); }
  i8()  { return this.view.getInt8(this.pos++); }
  i16() { const v = this.view.getInt16(this.pos, false); this.pos += 2; return v; }
  i32() { const v = this.view.getInt32(this.pos, false); this.pos += 4; return v; }
  f32() { const v = this.view.getFloat32(this.pos, false); this.pos += 4; return v; }
  f64() { const v = this.view.getFloat64(this.pos, false); this.pos += 8; return v; }
  i64() {
    const hi = this.view.getUint32(this.pos, false);
    const lo = this.view.getUint32(this.pos + 4, false);
    this.pos += 8;
    // Return as two uint32 parts to avoid BigInt in hot paths
    return { hi, lo };
  }
  str() {
    const len = this.view.getUint16(this.pos, false); this.pos += 2;
    const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.pos, len);
    this.pos += len;
    return new TextDecoder().decode(bytes);
  }
  tag(type) {
    switch (type) {
      case TAG.BYTE:       return this.i8();
      case TAG.SHORT:      return this.i16();
      case TAG.INT:        return this.i32();
      case TAG.LONG:       return this.i64();
      case TAG.FLOAT:      return this.f32();
      case TAG.DOUBLE:     return this.f64();
      case TAG.BYTE_ARRAY: { const n = this.i32(); const a = new Int8Array(this.view.buffer, this.view.byteOffset + this.pos, n); this.pos += n; return a; }
      case TAG.STRING:     return this.str();
      case TAG.LIST: {
        const itemType = this.u8();
        const len = this.i32();
        const list = [];
        for (let i = 0; i < len; i++) list.push(this.tag(itemType));
        list._listType = itemType;
        return list;
      }
      case TAG.COMPOUND: {
        const obj = {};
        while (true) {
          const t = this.u8();
          if (t === TAG.END) break;
          const name = this.str();
          obj[name] = this.tag(t);
        }
        return obj;
      }
      case TAG.INT_ARRAY: {
        const n = this.i32();
        const a = new Int32Array(n);
        for (let i = 0; i < n; i++) a[i] = this.i32();
        return a;
      }
      case TAG.LONG_ARRAY: {
        const n = this.i32();
        // Store as pairs of uint32 [hi0,lo0, hi1,lo1, ...]
        const a = new Uint32Array(n * 2);
        for (let i = 0; i < n; i++) {
          a[i*2]   = this.view.getUint32(this.pos, false);
          a[i*2+1] = this.view.getUint32(this.pos + 4, false);
          this.pos += 8;
        }
        a._longCount = n;
        return a;
      }
      default: throw new Error(`Unknown NBT tag type: ${type}`);
    }
  }
  parse() {
    const type = this.u8();
    const name = this.str();
    return { name, value: this.tag(type) };
  }
}

export function parseNBT(buffer) {
  let buf;
  // Check gzip magic bytes
  const header = new Uint8Array(buffer instanceof ArrayBuffer ? buffer : buffer.buffer, buffer.byteOffset ?? 0, 2);
  if (header[0] === 0x1f && header[1] === 0x8b) {
    buf = gunzipSync(new Uint8Array(buffer instanceof ArrayBuffer ? buffer : buffer.buffer));
  } else {
    buf = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  }
  return new NBTReader(buf).parse();
}
