from ingestion.discovery.transpordiamet import _classify, _period_from_text, _trusted


def test_trusted_hosts() -> None:
    assert _trusted("https://www.transpordiamet.ee/sites/default/files/documents/x.xlsx")
    assert not _trusted("https://example.com/file.xlsx")


def test_classify_infoleht() -> None:
    result = _classify("/sites/default/files/documents/2026-10/INFOLEHT-092026.xlsx", "Infoleht 09-2026")
    assert result and result[0] == "ta-infoleht"


def test_classify_inspection() -> None:
    result = _classify("/documents/kuuaruanne_2019_04.xls", "aprilli kuuaruanne 2019")
    assert result and result[0] == "ta-inspections-xls"


def test_period_from_filename() -> None:
    assert _period_from_text("Infoleht 09-2026 (esmaste ja uute sõidukite statistika)") == "2026-09"
    assert _period_from_text("kuuaruanne_2010_01.xls") == "2010-01"
