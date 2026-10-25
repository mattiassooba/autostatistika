from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
samples = sorted((ROOT / "data" / "source-samples").glob("*"))
print("SAMPLES", [f"{p.name} {p.stat().st_size}" for p in samples])


def inspect(path: Path) -> None:
    print("\n" + "=" * 80)
    print(path.name)
    xl = pd.ExcelFile(path)
    print("SHEETS:", xl.sheet_names)
    for sheet in xl.sheet_names[:14]:
        try:
            df = pd.read_excel(path, sheet_name=sheet, header=None)
        except Exception as exc:  # noqa: BLE001
            print(f"  FAIL {sheet}: {exc}")
            continue
        print(f"\n--- {sheet} shape={df.shape} ---")
        preview = df.iloc[:20, :8]
        pd.set_option("display.max_colwidth", 48)
        pd.set_option("display.width", 180)
        print(preview.to_string())


if __name__ == "__main__":
    for path in samples:
        inspect(path)
