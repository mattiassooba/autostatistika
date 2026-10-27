"""Search index for the vehicle search page (/otsing), built from the latest
register snapshot ("Sõidukite staatused Eestis", one row per vehicle).

No plate, VIN or owner is in the source, and none is published. Dates are cut
to the year. Identical vehicles are stored once with a count. The site groups
results into variants and never shows a single vehicle as a record.

Layout (one directory per snapshot date):

* ``manifest.json``: families, makes, shard files, value fill rates, licence.
Every file is gzip-compressed (``.bin.gz``): GitHub Pages only compresses text
types, and the browser decompresses with DecompressionStream.

* ``lite-<family>.bin``: every vehicle of a family with the main filters
  (make, model, year, power, fuel, gearbox, body, status, county) for
  searches across all makes.
* ``m-<make>.bin`` (or ``m-misc-<n>.bin`` for small makes): every column, for
  the makes a search names.

Each ``.bin`` is ``u32 header length``, a UTF-8 JSON header and column buffers
(little-endian, 4-byte aligned). The header lists each column's name, type,
offset, scale, missing sentinel and, for text columns, its dictionary.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import shutil
import struct
from pathlib import Path

import numpy as np
import pandas as pd

from ingestion.normalization.brands import canonical_brand
from ingestion.normalization.categories import canonical_category
from ingestion.parsers.register import read_register

# Text columns: published as dictionary codes.
TEXT = {
    "category": "KATEGOORIA",
    "model": "MUDEL",
    "body": "KERE_NIMETUS",
    "body_code": "KERETYYP",
    "colour": "VARV",
    "status": "YLDINE_STAATUS",
    "status_detail": "STAATUS",
    "engine": "MOOTORI_TYYP",
    "gearbox": "KAIGUKASTI_TYYP",
    "hybrid": "HYBRIIDI_TYYP",
    "fuel_combination": "KYTUSEKOMBINATSIOON",
    "fuel_main": "KYTUSE_TYYP",
    "fuel_extra": "LISAKYTUS",
    "euro": "HEITMENORM",
    "county": "VKOM_MAAKOND",
    "owner": "VKOM_TYYP",
}
# Numeric columns: (source column, scale). Decimals are stored as integers × scale.
NUMBER = {
    "year": ("ESMANE_REG", 1),
    "year_ee": ("EESTIS_ESMAREG", 1),
    "power": ("MOOTORI_VOIMSUS", 10),
    "engine_cc": ("MOOTORI_MAHT", 1),
    "length": ("PIKKUS", 1),
    "width": ("LAIUS", 1),
    "height": ("KORGUS", 1),
    "mass_max": ("TAISMASS", 1),
    "mass_reg": ("REG_MASS", 1),
    "mass_empty": ("TYHIMASS", 1),
    "tow_braked": ("HAAGIS_PIDURITEGA", 1),
    "tow_unbraked": ("HAAGIS_PIDURITETA", 1),
    "train_mass": ("AUTORONGI_MASS", 1),
    "hitch_load": ("HAAKESEADME_KOORMUS", 1),
    "top_speed": ("SUURIM_KIIRUS", 1),
    "noise": ("SOIDUMYRA", 10),
    "co2_nedc": ("CO2_NEDC", 1),
    "co2_wltp": ("CO2_WLTP", 1),
    "cons_nedc": ("KYTUSEKULU_KESK_NEDC", 10),
    "cons_wltp": ("KYTUSEKULU_KESK_WLTP", 10),
    "ev_range": ("ELEKTRILINE_SOIDUULATUS", 1),
    "doors": ("UKSI", 1),
    "seats": ("ISTEKOHTI", 1),
    "axles": ("TELGI_KOKKU", 1),
    "wheels": ("RATTAID", 1),
    "steer_axles": ("JUHTTELGI", 1),
    "drive_axles": ("VEOTELGI", 1),
}
# Colour and owner type are left out of the light index (3.7 MB -> 2.1 MB for
# passenger cars); filtering on them needs the makes' own files.
LITE = ["variant", "make", "model", "year", "power_kw", "engine", "gearbox", "body", "status", "county"]
# A variant is the same make, model, year, fuel, whole kW, gearbox and body.
# Its id is the same in every file of a snapshot, so the browser counts per id.
VARIANT = ["make", "model", "year", "engine", "power_kw", "gearbox", "body"]
SMALL_MAKE = 300  # makes with fewer vehicles share bucket files
BUCKET_ROWS = 6000


def load_snapshot(paths: list[Path]) -> tuple[str, pd.DataFrame]:
    """One frame for the latest date found in the given register files."""
    frames: dict[str, list[pd.DataFrame]] = {}
    columns = ["MARK", *TEXT.values(), *(source for source, _ in NUMBER.values())]
    for path in paths:
        for snapshot, _name, frame in read_register(path, columns):
            frames.setdefault(snapshot, []).append(frame)
    latest = max(frames)
    return latest, pd.concat(frames[latest], ignore_index=True)


def normalise(raw: pd.DataFrame) -> pd.DataFrame:
    out = pd.DataFrame(index=raw.index)
    brands = {value: canonical_brand(value) for value in raw["MARK"].dropna().unique()}
    out["make"] = raw["MARK"].map(lambda value: brands[value][0] if value in brands else "unknown")
    out["make_name"] = raw["MARK"].map(lambda value: brands[value][1] if value in brands else "—")
    families = {value: canonical_category(value)[0] or "unclassified" for value in raw["KATEGOORIA"].dropna().unique()}
    out["family"] = raw["KATEGOORIA"].map(lambda value: families.get(value, "unclassified"))
    for name, source in TEXT.items():
        out[name] = raw[source].fillna("").str.strip()
    for name, (source, scale) in NUMBER.items():
        text = raw[source]
        if name.startswith("year"):
            number = pd.to_numeric(text.str[:4], errors="coerce")
        else:
            number = pd.to_numeric(text, errors="coerce")
        out[name] = (number * scale).round().astype("Int64")
    # Whole kW for the light index; the full files keep tenths.
    out["power_kw"] = (out["power"] / 10).round().astype("Int64")
    return out


def _encode(frame: pd.DataFrame, columns: list[str], text: set[str]) -> bytes:
    rows = len(frame)
    header_columns = []
    buffers = []
    offset = 0
    for name in columns:
        series = frame[name]
        if name in text or name == "make":
            codes, uniques = pd.factorize(series, sort=True)
            data = codes.astype(np.uint8 if len(uniques) < 256 else np.uint16 if len(uniques) < 65536 else np.uint32)
            meta = {"name": name, "kind": "text", "dict": [str(u) for u in uniques]}
        else:
            values = series.astype("Float64")
            top = values.max(skipna=True)
            top = 0 if pd.isna(top) else int(top)
            dtype = np.uint8 if top < 255 else np.uint16 if top < 65535 else np.uint32
            missing = np.iinfo(dtype).max
            data = values.fillna(missing).clip(lower=0).to_numpy(dtype=np.float64).astype(dtype)
            meta = {"name": name, "kind": "number", "missing": int(missing)}
            scale = NUMBER.get(name, (None, 1))[1]
            if scale != 1:
                meta["scale"] = scale
        meta["type"] = {np.uint8: "u8", np.uint16: "u16", np.uint32: "u32"}[data.dtype.type]
        meta["offset"] = offset
        raw = data.tobytes()
        pad = (-len(raw)) % 4
        buffers.append(raw + b"\0" * pad)
        offset += len(raw) + pad
        header_columns.append(meta)
    header = json.dumps({"rows": rows, "columns": header_columns}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    header += b" " * ((-len(header)) % 4)
    return struct.pack("<I", len(header)) + header + b"".join(buffers)


def build_index(paths: list[Path], dest: Path) -> dict:
    snapshot, raw = load_snapshot(paths)
    frame = normalise(raw)
    out = dest / snapshot
    # A rebuild of the same snapshot must not keep files the new build no longer writes.
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    frame["variant"] = frame.groupby(VARIANT, dropna=False, sort=True).ngroup().astype("Int64")
    full_columns = ["variant", "make", "family", *TEXT.keys(), *NUMBER.keys()]
    files: dict[str, int] = {}
    # Checksums of the uncompressed files: gzip output differs between zlib
    # builds (Windows vs the Linux runner), the data must not.
    contents: dict[str, bytes] = {}

    def write(name: str, payload: bytes) -> None:
        packed = gzip.compress(payload, compresslevel=9, mtime=0)
        (out / f"{name}.gz").write_bytes(packed)
        files[f"{name}.gz"] = len(packed)
        contents[f"{name}.gz"] = hashlib.sha256(payload).digest()
        raw_bytes[0] += len(payload)

    raw_bytes = [0]

    # Identical vehicles once, with a count.
    grouped = frame[full_columns].groupby(full_columns, dropna=False, sort=False).size().reset_index(name="count")
    for column in [*NUMBER, "variant"]:
        grouped[column] = grouped[column].astype("Int64")
    text = set(TEXT) | {"family"}

    families = {}
    for family, part in frame.groupby("family"):
        lite = part[LITE].groupby(LITE, dropna=False, sort=False).size().reset_index(name="count")
        for column in ("variant", "year", "power_kw"):
            lite[column] = lite[column].astype("Int64")
        name = f"lite-{family}.bin"
        write(name, _encode(lite, [*LITE, "count"], set(LITE) - {"variant", "year", "power_kw"}))
        families[family] = {"vehicles": int(len(part)), "registered": int((part["status"] == "REGISTREERITUD").sum()), "lite": f"{name}.gz"}

    vehicles = frame.groupby("make").size()
    names = frame.groupby("make")["make_name"].first()
    per_family = frame.groupby(["make", "family"]).size()
    parts = dict(tuple(grouped.groupby("make", sort=True)))
    makes = []
    small: list[str] = []
    for make in sorted(vehicles.index):
        entry = {"slug": make, "name": names[make], "vehicles": int(vehicles[make])}
        entry["families"] = {family: int(n) for family, n in per_family[make].items()}
        if vehicles[make] >= SMALL_MAKE:
            name = f"m-{make}.bin"
            write(name, _encode(parts[make], [*full_columns, "count"], text))
            entry["file"] = f"{name}.gz"
        else:
            small.append(make)
        makes.append(entry)
    # Small makes share bucket files of about BUCKET_ROWS rows.
    by_make = {entry["slug"]: entry for entry in makes}
    bucket: list[str] = []
    rows = 0
    for make in [*small, None]:
        size = len(parts[make]) if make else 0
        if bucket and (make is None or rows + size > BUCKET_ROWS):
            name = f"m-misc-{len([f for f in files if f.startswith('m-misc')]) + 1}.bin"
            write(name, _encode(pd.concat([parts[slug] for slug in bucket]), [*full_columns, "count"], text))
            for slug in bucket:
                by_make[slug]["file"] = f"{name}.gz"
            bucket, rows = [], 0
        if make:
            bucket.append(make)
            rows += size

    fill = {}
    for family, part in frame.groupby("family"):
        fill[family] = {
            column: round(float(part[column].notna().mean() if column in NUMBER else (part[column] != "").mean()), 4)
            for column in [*TEXT, *NUMBER]
        }
    manifest = {
        "snapshot": snapshot,
        "source": "https://andmed.eesti.ee/datasets/soidukite-staatused-eestis",
        "licence": "CC BY-SA 4.0, Transpordiamet",
        "vehicles": int(len(frame)),
        "variants": int(frame["variant"].max()) + 1,
        "families": families,
        "makes": makes,
        "fill": fill,
        "files": files,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    digest = hashlib.sha256()
    for name in sorted(contents):
        digest.update(name.encode() + contents[name])
    # The manifest without the compressed file sizes, which vary by zlib build.
    digest.update(json.dumps({**manifest, "files": sorted(files)}, ensure_ascii=False, sort_keys=True).encode())
    sha = digest.hexdigest()
    return {
        "snapshot": snapshot,
        "vehicles": int(len(frame)),
        "files": len(files) + 1,
        # Uncompressed size of the data files (the compressed size depends on the zlib build).
        "bytes": raw_bytes[0],
        "sha256": sha,
        "asset": f"register-index-{snapshot}-{sha[:12]}.tar",
    }
