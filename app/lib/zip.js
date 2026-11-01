'use strict';

const zlib = require('zlib');

const EOCD = 0x06054b50;
const CEN = 0x02014b50;
const LOC = 0x04034b50;

function findEocd(buf) {
  const min = Math.max(0, buf.length - 66000);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === EOCD) return i;
  }
  return -1;
}

function parseZipCentralDirectory(buf) {
  const eocd = findEocd(buf);
  if (eocd < 0) throw new Error('Not a ZIP archive (end of central directory not found)');
  const total = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (total === 0xffff || cdOffset === 0xffffffff) {
    throw new Error('ZIP64 archives are not supported by the previewer');
  }
  if (cdOffset + cdSize > buf.length) {
    throw new Error('Incomplete ZIP central directory (archive is larger than the preview window)');
  }
  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < total; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== CEN) break;
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const time = buf.readUInt16LE(p + 12);
    const date = buf.readUInt16LE(p + 14);
    const crc = buf.readUInt32LE(p + 16);
    const compSize = buf.readUInt32LE(p + 20);
    const uncompSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const external = buf.readUInt32LE(p + 38);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString(flags & 0x800 ? 'utf8' : 'latin1', p + 46, p + 46 + nameLen);
    const dir = name.endsWith('/');
    entries.push({
      name,
      dir,
      method,
      methodName: method === 0 ? 'Store' : method === 8 ? 'Deflate' : `Method ${method}`,
      compressedSize: compSize,
      size: uncompSize,
      crc: crc >>> 0,
      date: zipDate(date, time),
      ratio: uncompSize ? Math.round((1 - compSize / uncompSize) * 1000) / 10 : 0,
      externalAttributes: external,
      localOffset: localOff,
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { entries, total, cdSize };
}

function zipDate(date, time) {
  if (!date) return null;
  const y = 1980 + ((date >> 9) & 0x7f);
  const m = (date >> 5) & 0x0f;
  const d = date & 0x1f;
  const hh = (time >> 11) & 0x1f;
  const mm = (time >> 5) & 0x3f;
  const ss = (time & 0x1f) * 2;
  const pad = (n) => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)} ${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

module.exports = { parseZipCentralDirectory, findEocd, EOCD, CEN, LOC };
