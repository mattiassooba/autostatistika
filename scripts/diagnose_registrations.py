"""Parse every downloaded Infoleht and report what each layout yields."""
from __future__ import annotations

import json
import sys
import traceback
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingestion.config import DOWNLOAD_DIR  # noqa: E402
from ingestion.discovery.transpordiamet import _period_from_text  # noqa: E402
from ingestion.parsers.excel import open_workbook  # noqa: E402
from ingestion.parsers.fleet import parse_infoleht_stock  # noqa: E402
from ingestion.parsers.registrations import parse_registrations  # noqa: E402

rows = []
for path in sorted((DOWNLOAD_DIR / "registration_infoleht").glob("*.xls*")):
    period = _period_from_text(path.name)
    info = {"file": path.name, "period": period}
    try:
        xl = open_workbook(path)
        info["sheets"] = xl.sheet_names
        facts = parse_registrations(path, period)
        stock = parse_infoleht_stock(path, None)
        totals = {f.category_code: f.value for f in facts if f.metric_code == "first_registrations" and not f.brand_slug and not f.fuel_code}
        info["cats"] = len(totals)
        info["car_first"] = totals.get("passenger_car")
        info["car_brands"] = sum(1 for f in facts if f.extra.get("rollup") == "brand_month_total" and f.category_code == "passenger_car")
        info["truck_brands"] = sum(1 for f in facts if f.extra.get("rollup") == "brand_month_total" and f.category_code == "truck")
        info["fuels"] = sum(1 for f in facts if f.fuel_code)
        info["models"] = sum(1 for f in facts if f.model_source and f.metric_code == "new_vehicles")
        info["stock_cats"] = sorted({f.category_code for f in stock if f.extra.get("grain") == "stock_total"})
        info["stock_dates"] = sorted({f.snapshot_date for f in stock})
    except Exception as exc:  # noqa: BLE001
        info["error"] = f"{type(exc).__name__}: {exc}"
        info["trace"] = traceback.format_exc(limit=2)[-300:]
    rows.append(info)
    print(json.dumps({k: v for k, v in info.items() if k not in ("sheets", "trace")}, ensure_ascii=False), flush=True)
(DOWNLOAD_DIR / "diagnose_registrations.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
