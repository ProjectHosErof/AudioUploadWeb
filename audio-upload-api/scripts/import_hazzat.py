"""
Build the app's controlled vocabulary from the hazzat.com catalogue.

Inputs (all under data/hazzat/):
  Coptic_Hymns_hazzat.xlsx  primary source, sheet "Hymns by Season"
  legacy-vocab.json         the vocabulary that existed before this import
  mappings.json             hand-maintained season/service/crosswalk rules

Outputs:
  src/data/vocab.generated.json             read by the Worker, seed and checks
  ../phe-landing-page/src/vocab.generated.json   identical copy for the form
  data/hazzat/import-report.md              what changed, for review

Existing slugs are never renamed or dropped: recordings reference them.
The output is deterministic, so re-running on the same inputs is a no-op.

Usage (from audio-upload-api/):
  pip install -r scripts/requirements.txt
  python3 scripts/import_hazzat.py
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "hazzat"
OUTPUTS = [
    ROOT / "src" / "data" / "vocab.generated.json",
    ROOT.parent / "phe-landing-page" / "src" / "vocab.generated.json",
]
REPORT = DATA / "import-report.md"
SHEET = "Hymns by Season"
LITURGIES = ["st-basil-liturgy", "st-gregory-liturgy", "st-cyril-liturgy"]


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def split(cell) -> list[str]:
    if pd.isna(cell) or not str(cell).strip():
        return []
    return [p.strip() for p in str(cell).split(";") if p.strip()]


def fail(errors: list[str]) -> None:
    for e in errors:
        print(f"ERROR {e}", file=sys.stderr)
    sys.exit(1)


def insert_after(rows: list[dict], new: list[dict]) -> list[dict]:
    """Insert each new {slug, label, after} right after its `after` slug."""
    out = [dict(r) for r in rows]
    for n in new:
        idx = next(i for i, r in enumerate(out) if r["slug"] == n["after"])
        out.insert(idx + 1, {k: v for k, v in n.items() if k != "after"})
    return out


def main() -> None:
    legacy = json.loads((DATA / "legacy-vocab.json").read_text())
    maps = json.loads((DATA / "mappings.json").read_text())
    sheet = pd.read_excel(DATA / "Coptic_Hymns_hazzat.xlsx", sheet_name=SHEET)
    ignore = set(maps["ignoreTuneOrType"])
    errors: list[str] = []

    # ---- seasons and services: legacy order, new ones slotted in place ----
    seasons = insert_after(legacy["seasons"], maps["newSeasons"])
    services = insert_after(legacy["services"], maps["newServices"])
    season_slugs = {s["slug"] for s in seasons}
    service_slugs = {s["slug"] for s in services}
    arabic_season = {}
    for name, ar in sheet[["Season", "Season (Arabic)"]].drop_duplicates().itertuples(index=False):
        if name in maps["seasons"] and isinstance(ar, str):
            arabic_season.setdefault(maps["seasons"][name], ar)
    for i, s in enumerate(seasons):
        s["labelAr"] = arabic_season.get(s["slug"])
        s["sortOrder"] = i + 1
    for i, s in enumerate(services):
        s["sortOrder"] = i + 1

    # ---- crosswalk: hazzat id -> existing app slug ----
    legacy_slugs = {h["slug"] for h in legacy["hymns"]}
    to_app = {}
    for app_slug, hz in maps["crosswalk"].items():
        if app_slug.startswith("_"):
            continue
        if app_slug not in legacy_slugs:
            errors.append(f"crosswalk: unknown app slug {app_slug!r}")
        to_app[hz] = app_slug
    sheet_ids = set(sheet["Hymn ID"])
    errors += [f"crosswalk: hazzat id {hz!r} not in the sheet" for hz in to_app if hz not in sheet_ids]

    # ---- walk the sheet ----
    hymns: dict[str, dict] = {}
    placements: set[tuple[str, str, str]] = set()
    unmapped = Counter()
    for row in sheet.to_dict("records"):
        hz_id = row["Hymn ID"]
        slug = to_app.get(hz_id) or slugify(hz_id)
        if slug in legacy_slugs and hz_id not in to_app:
            errors.append(f"slug collision: hazzat {hz_id!r} -> {slug!r} already exists")
        h = hymns.setdefault(slug, {
            "slug": slug, "hazzatId": hz_id, "hazzatTitle": row["Hymn Title"],
            "labelAr": row["Hymn Title (Arabic)"] if isinstance(row["Hymn Title (Arabic)"], str) else None,
            "sourceUrl": row["Link"], "types": set(), "tunes": set(), "hzServices": set(),
        })
        h["hzServices"] |= set(split(row["Service(s)"]))
        h["types"] |= {t for t in split(row["Hymn Type"]) if t not in ignore}
        h["tunes"] |= {t for t in split(row["Tune"]) if t not in ignore}

        season_name = row["Season"]
        if season_name in maps["occasions"]:
            occ = maps["occasions"][season_name]
            placements.add((slug, occ["season"], occ["service"]))
            continue
        season = maps["seasons"].get(season_name)
        if not season:
            unmapped[f"season {season_name!r}"] += 1
            continue
        for svc_name in split(row["Service(s)"]):
            targets = maps["services"].get(svc_name)
            if not targets:
                unmapped[f"service {svc_name!r} (season {season_name!r})"] += 1
                continue
            for svc in targets:
                placements.add((slug, season, svc))
    errors += [f"unmapped {k} x{n}" for k, n in unmapped.items()]

    # ---- legacy hymns: keep slug + label, add section placements ----
    retired = {k: v for k, v in maps["retired"].items() if not k.startswith("_")}
    out_hymns = []
    for lh in legacy["hymns"]:
        h = hymns.pop(lh["slug"], None) or {"hazzatId": None, "hazzatTitle": None, "labelAr": None,
                                              "sourceUrl": None, "types": set(), "tunes": set(),
                                              "hzServices": set()}
        active = lh["slug"] not in retired
        if active:
            for season, svc in maps["sectionPlacements"].get(lh["section"], []):
                placements.add((lh["slug"], season, svc))
        else:
            placements.difference_update({p for p in placements if p[0] == lh["slug"]})
        out_hymns.append({**h, "slug": lh["slug"], "label": lh["label"], "active": active, "legacy": True})
    for h in hymns.values():
        out_hymns.append({**h, "label": h["hazzatTitle"], "active": True, "legacy": False})

    # ---- types, tunes, rhythm ----
    type_labels = sorted({t for h in out_hymns for t in h["types"]})
    tune_labels = sorted({t for h in out_hymns for t in h["tunes"]})
    for h in out_hymns:
        legacy_rhythm = re.search(r"\((adam|watos|hazaeeni|farayhi)\)", h["label"], re.I)
        beats = [t.lower() for t in h["tunes"] if t.lower() in ("adam", "watos")]
        h["rhythm"] = legacy_rhythm.group(1).lower() if legacy_rhythm else (beats[0] if len(beats) == 1 else None)
        h["types"] = sorted(slugify(t) for t in h["types"])
        h["tunes"] = sorted(slugify(t) for t in h["tunes"])

    # ---- integrity ----
    for slug, season, svc in placements:
        if season not in season_slugs:
            errors.append(f"placement season {season!r} unknown")
        if svc not in service_slugs:
            errors.append(f"placement service {svc!r} unknown")
    if errors:
        fail(sorted(set(errors)))

    # Disambiguate labels that collide inside one (season, service) list.
    by_pair = defaultdict(list)
    active = {h["slug"]: h for h in out_hymns if h["active"]}
    for slug, season, svc in placements:
        if slug in active:
            by_pair[(season, svc)].append(slug)
    renamed = {}
    for (season, svc), slugs in sorted(by_pair.items()):
        counts = Counter(active[s]["label"] for s in slugs)
        for s in slugs:
            h = active[s]
            if counts[h["label"]] > 1 and not h["legacy"] and s not in renamed:
                where = ", ".join(sorted(h["hzServices"])) or h["hazzatId"]
                renamed[s] = f'{h["label"]} ({where})'
    if len(set(renamed.values())) < len(renamed):
        fail([f"labels still ambiguous after disambiguation: {renamed}"])
    for s, new_label in renamed.items():
        active[s]["label"] = new_label

    out_hymns.sort(key=lambda h: (not h["legacy"], h["label"].lower()))
    vocab = {
        "_comment": "GENERATED by scripts/import_hazzat.py from data/hazzat/. Do not edit by hand.",
        "seasons": seasons,
        "services": services,
        "languages": legacy["languages"],
        "hymnTypes": [{"slug": slugify(t), "label": t} for t in type_labels],
        "tunes": [{"slug": slugify(t), "label": t} for t in tune_labels],
        "hymns": [{k: h[k] for k in ("slug", "label", "labelAr", "hazzatId", "sourceUrl",
                                     "rhythm", "active", "types", "tunes")} for h in out_hymns],
        "placements": sorted(map(list, placements)),
    }
    text = json.dumps(vocab, ensure_ascii=False, indent=1) + "\n"
    for path in OUTPUTS:
        path.write_text(text)

    write_report(vocab, legacy, maps, renamed, by_pair)
    n_active = sum(h["active"] for h in vocab["hymns"])
    print(f"seasons {len(seasons)} (+{len(maps['newSeasons'])}), services {len(services)} "
          f"(+{len(maps['newServices'])}), hymns {len(vocab['hymns'])} "
          f"({n_active} active, {len(legacy['hymns'])} pre-existing, "
          f"{len(vocab['hymns']) - len(legacy['hymns'])} new), placements {len(placements)}, "
          f"hymn types {len(type_labels)}, tunes {len(tune_labels)}")
    print(f"crosswalk {len(to_app)}, retired {len(retired)}, labels disambiguated {len(renamed)}")
    for p in OUTPUTS:
        print(f"wrote {p.relative_to(ROOT.parent)} ({len(text) // 1024} KB)")
    print(f"wrote {REPORT.relative_to(ROOT.parent)}")


def write_report(vocab, legacy, maps, renamed, by_pair) -> None:
    labels = {h["slug"]: h["label"] for h in vocab["hymns"]}
    season_label = {s["slug"]: s["label"] for s in vocab["seasons"]}
    service_label = {s["slug"]: s["label"] for s in vocab["services"]}
    legacy_seasons = {s["slug"] for s in legacy["seasons"]}
    legacy_services = {s["slug"] for s in legacy["services"]}
    lines = [
        "# hazzat.com import report",
        "",
        "Generated by `scripts/import_hazzat.py`. Review this before running the seed.",
        "",
        "## Totals",
        "",
        "| | Total | New |",
        "| --- | --- | --- |",
        f"| Seasons | {len(vocab['seasons'])} | {', '.join(s['label'] for s in vocab['seasons'] if s['slug'] not in legacy_seasons)} |",
        f"| Services | {len(vocab['services'])} | {', '.join(s['label'] for s in vocab['services'] if s['slug'] not in legacy_services)} |",
        f"| Hymns | {len(vocab['hymns'])} | {len(vocab['hymns']) - len(legacy['hymns'])} |",
        f"| Hymn types | {len(vocab['hymnTypes'])} | all |",
        f"| Tunes | {len(vocab['tunes'])} | all |",
        f"| Hymn placements (hymn x season x service) | {len(vocab['placements'])} | all |",
        "",
        "## Pre-existing hymns matched to hazzat.com (crosswalk)",
        "",
        "These keep their slug and label and gain hazzat's placements, types and tunes.",
        "",
        "| App slug | App label | hazzat ID |",
        "| --- | --- | --- |",
    ]
    lines += [f"| `{a}` | {labels[a]} | `{h}` |" for a, h in maps["crosswalk"].items() if not a.startswith("_")]
    lines += ["", "## Retired (hidden from the form, rows kept)", "", "| Slug | Same hymn as |", "| --- | --- |"]
    lines += [f"| `{a}` | `{b}` |" for a, b in maps["retired"].items() if not a.startswith("_")]
    lines += ["", "## Needs review (not merged)", "", "| App slug | Possible hazzat match |", "| --- | --- |"]
    lines += [f"| `{a}` | {b} |" for a, b in maps["needsReview"].items() if not a.startswith("_")]
    lines += ["", "## Labels disambiguated", "",
              "Two different hymns had the same title inside one season + service list, "
              "so the hazzat service it belongs to was appended.", ""]
    lines += [f"- `{s}` -> {l}" for s, l in sorted(renamed.items())] or ["- none"]
    lines += ["", "## Hymns per season and service", "", "| Season | Service | Hymns |", "| --- | --- | --- |"]
    order_s = {s["slug"]: s["sortOrder"] for s in vocab["seasons"]}
    order_v = {s["slug"]: s["sortOrder"] for s in vocab["services"]}
    for (season, svc), slugs in sorted(by_pair.items(), key=lambda kv: (order_s[kv[0][0]], order_v[kv[0][1]])):
        lines.append(f"| {season_label[season]} | {service_label[svc]} | {len(slugs)} |")
    REPORT.write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
