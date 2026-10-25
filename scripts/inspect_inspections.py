from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
files = [
    ROOT / "data" / "source-samples" / "kuuaruanne_2010_01.xls",
    ROOT / "data" / "source-samples" / "kuuaruanne_2019_04.xls",
    ROOT / "data" / "source-samples" / "INFOLEHT-092026.xlsx",
]


def dump(path: Path) -> None:
    print("=" * 80)
    print(path.name)
    xl = pd.ExcelFile(path)
    print("SHEETS:", xl.sheet_names)
    for sheet in xl.sheet_names:
        df = pd.read_excel(path, sheet_name=sheet, header=None)
        print(f"\n--- {sheet} {df.shape} ---")
        print(df.iloc[:25, :10].to_string())
        if path.name.startswith("INFOLEHT-092026") and "Uued" in sheet:
            print("COLUMNS", list(range(min(26, df.shape[1]))))
            print(df.iloc[3:6, :20].to_string())


if __name__ == "__main__":
    pd.set_option("display.max_colwidth", 60)
    pd.set_option("display.width", 200)
    for path in files:
        dump(path)
