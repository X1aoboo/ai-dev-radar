"""数据管理工作台的领域计算与导入规则。

这个模块是数据管理的深 seam：HTTP 路由只负责认证、查询和事务，字段规范化、
临时批次差异和指标计算都在这里保持确定性，后续数据域可以复用同样的接口。
"""

from __future__ import annotations

import csv
import io
import math
import zipfile
from collections.abc import Iterable, Mapping, Sequence
from datetime import date, datetime
from pathlib import PurePath
from typing import Any
from xml.etree import ElementTree


from .ir_fields import (
    IR_BOOL_FIELDS,
    IR_DATE_FIELDS,
    IR_DB_FIELDS,
    IR_ENUM_ALIASES,
    IR_ENUM_FIELDS,
    IR_FIELD_BY_KEY,
    IR_FIELD_LABELS,
    IR_FIELDS,
    IR_HEADER_ALIASES,
    IR_IMPORT_REQUIRED_FIELDS,
    IR_INT_FIELDS,
    IR_LEGACY_REQUIRED_FIELDS,
    IR_NUMERIC_FIELDS,
    IR_OWNER_FIELDS,
    IR_REQUIRED_FIELDS,
)


IR_FLOAT_FIELDS = IR_NUMERIC_FIELDS
IR_FIELD_KEYS = frozenset(IR_FIELDS)


def _clean(value: Any) -> Any:
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


_EXCEL_EPOCH = date(1899, 12, 30)


def _excel_serial_to_date(value: float) -> date | None:
    if value < 1 or value > 2_958_465:
        return None
    return _EXCEL_EPOCH.fromordinal(_EXCEL_EPOCH.toordinal() + int(value))


def _parse_date(value: Any) -> date | None:
    value = _clean(value)
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        serial = _excel_serial_to_date(float(value))
        if serial is not None:
            return serial
    text = str(value).strip()
    if not text:
        return None
    if text.isdigit() and len(text) == 8:
        return date(int(text[:4]), int(text[4:6]), int(text[6:]))
    if text.isdigit() and len(text) <= 7:
        serial = _excel_serial_to_date(float(text))
        if serial is not None:
            return serial
    normalized = text.replace("/", "-").replace(".", "-")
    if " " in normalized:
        normalized = normalized.split(" ", 1)[0]
    try:
        return date.fromisoformat(normalized)
    except ValueError:
        parts = normalized.split("-")
        if len(parts) == 3 and all(part.isdigit() for part in parts):
            return date(int(parts[0]), int(parts[1]), int(parts[2]))
        raise ValueError("must be a valid date") from None


def _parse_bool(value: Any) -> bool | None:
    value = _clean(value)
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    normalized = str(value).lower()
    if normalized in {"1", "true", "yes", "y", "是", "有"}:
        return True
    if normalized in {"0", "false", "no", "n", "否", "无"}:
        return False
    raise ValueError("must be a boolean")


def _normalize_enum(field: str, value: Any) -> Any:
    value = _clean(value)
    if value is None:
        return None
    aliases = IR_ENUM_ALIASES.get(field, {})
    normalized = aliases.get(str(value))
    if normalized is None:
        options = " / ".join(IR_FIELD_BY_KEY[field].options)
        raise ValueError(f"must be one of {options}")
    return normalized


def _has_any(normalized: Mapping[str, Any], keys: Sequence[str]) -> bool:
    return any(_clean(normalized.get(key)) is not None for key in keys)


def normalize_ir_row(
    row: Mapping[str, Any],
    *,
    strict_template: bool = False,
) -> tuple[dict[str, Any], list[str]]:
    """Normalize API/CSV/Excel row values and return field-level errors.

    ``strict_template`` is used for the user-facing Excel template; it requires
    progress and SE, which legacy collector rows do not provide.
    """

    normalized: dict[str, Any] = {}
    errors: list[str] = []
    for raw_key, raw_value in row.items():
        key = IR_HEADER_ALIASES.get(str(raw_key).strip())
        if key is None:
            continue
        value = _clean(raw_value)
        try:
            if key in IR_OWNER_FIELDS:
                value = value
            elif key in IR_FLOAT_FIELDS and value is not None:
                value = float(value)
                if not math.isfinite(value) or value < 0:
                    raise ValueError("must be a finite non-negative number")
            elif key in IR_INT_FIELDS and value is not None:
                value = int(value)
                if value < 1:
                    raise ValueError("must be positive")
            elif key in IR_DATE_FIELDS and value is not None:
                value = _parse_date(value)
            elif key in IR_BOOL_FIELDS:
                value = _parse_bool(value)
            elif key in IR_ENUM_FIELDS:
                value = _normalize_enum(key, value)
            elif isinstance(value, str):
                value = value.strip() or None
        except (TypeError, ValueError) as exc:
            errors.append(f"{IR_FIELD_LABELS.get(key, key)}：{exc}")
            continue
        normalized[key] = value

    if _clean(normalized.get("requirement_type")) is None:
        normalized["requirement_type"] = "IR"

    if not _has_any(normalized, ("team_name", "product_id")):
        errors.append("缺少归属组或产品")
    if not _has_any(normalized, ("version_name", "version_id")):
        errors.append("缺少PI或版本")
    if not _has_any(normalized, ("iteration_name", "iteration_id")):
        errors.append("缺少迭代")

    required = IR_IMPORT_REQUIRED_FIELDS if strict_template else IR_LEGACY_REQUIRED_FIELDS
    for field in required:
        if field in {"team_name", "version_name", "iteration_name"}:
            # Name-based references are validated by the resolver; the
            # corresponding id is an acceptable legacy alternative.
            continue
        if _clean(normalized.get(field)) is None:
            errors.append(f"缺少{IR_FIELD_LABELS.get(field, field)}")

    return normalized, errors


def serialize_value(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def serializable_payload(payload: Mapping[str, Any]) -> dict[str, Any]:
    return {key: serialize_value(value) for key, value in payload.items()}


def record_is_valid(record: Any) -> bool:
    """仅判断记录自身的核心字段是否完整；责任人工号不参与有效性判断。"""

    return all(_clean(getattr(record, field, None)) is not None for field in IR_REQUIRED_FIELDS)


def field_diff(
    existing: Any | None,
    payload: Mapping[str, Any],
    *,
    mode: str = "fill_empty",
) -> dict[str, dict[str, Any]]:
    """Return the field actions the batch would take without writing data."""

    diff: dict[str, dict[str, Any]] = {}
    for field in IR_FIELDS:
        incoming = payload.get(field)
        if existing is None:
            if incoming is not None:
                diff[field] = {"action": "add", "from": None, "to": serialize_value(incoming)}
            continue
        current = getattr(existing, field, None)
        current_serialized = serialize_value(current)
        incoming_serialized = serialize_value(incoming)
        if incoming is None or current_serialized == incoming_serialized:
            action = "unchanged"
        elif current is None:
            action = "fill"
        elif mode == "upsert":
            action = "overwrite"
        else:
            action = "keep"
        diff[field] = {
            "action": action,
            "from": current_serialized,
            "to": incoming_serialized,
        }
    return diff


def merge_empty_fields(existing: Any, payload: Mapping[str, Any]) -> list[dict[str, Any]]:
    """只把 incoming 非空值写入正式记录的空字段，返回实际变化。"""

    changes: list[dict[str, Any]] = []
    for field in IR_FIELDS:
        incoming = payload.get(field)
        current = getattr(existing, field, None)
        if current is not None or incoming is None:
            continue
        setattr(existing, field, incoming)
        changes.append({"field": field, "from": None, "to": serialize_value(incoming)})
    return changes


def overwrite_non_empty_fields(existing: Any, payload: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Use non-empty incoming values to update an existing record."""

    changes: list[dict[str, Any]] = []
    for field in IR_FIELDS:
        incoming = payload.get(field)
        current = getattr(existing, field, None)
        if incoming is None or serialize_value(current) == serialize_value(incoming):
            continue
        setattr(existing, field, incoming)
        changes.append({
            "field": field,
            "from": serialize_value(current),
            "to": serialize_value(incoming),
        })
    return changes


def effective_estimated_workload(record: Any) -> float | None:
    stored = getattr(record, "estimated_workload", None)
    if stored is not None:
        return float(stored)
    parts = [
        getattr(record, "sa_estimated_workload", None),
        getattr(record, "se_estimated_workload", None),
    ]
    if all(part is None for part in parts):
        return None
    return float(sum(part or 0 for part in parts))


def effective_actual_workload(record: Any) -> float | None:
    stored = getattr(record, "actual_workload", None)
    if stored is not None:
        return float(stored)
    parts = [
        getattr(record, "sa_actual_workload", None),
        getattr(record, "se_actual_workload", None),
    ]
    if all(part is None for part in parts):
        return None
    return float(sum(part or 0 for part in parts))


def derive_ai_assisted(values: Mapping[str, Any]) -> bool | None:
    """Derive the aggregate AI flag from SA/SE flags, preserving legacy values."""

    sa = values.get("sa_ai_assisted")
    se = values.get("se_ai_assisted")
    if sa is None and se is None:
        return values.get("ai_assisted")
    if sa is True or se is True:
        return True
    if sa is False and se is False:
        return False
    return None


def effective_ai_assisted(record: Any) -> bool | None:
    sa = getattr(record, "sa_ai_assisted", None)
    se = getattr(record, "se_ai_assisted", None)
    if sa is None and se is None:
        return getattr(record, "ai_assisted", None)
    if sa is True or se is True:
        return True
    if sa is False and se is False:
        return False
    return None


def apply_filter(records: Iterable[Any], filters: Mapping[str, Any]) -> list[Any]:
    selected = []
    for record in records:
        if not record_is_valid(record):
            continue
        matched = True
        for field, expected in filters.items():
            if expected is None or expected == "":
                continue
            actual = getattr(record, field, None)
            if field in {"completed_from", "completed_to"} and isinstance(expected, str):
                expected = date.fromisoformat(expected)
            if field == "completed_from" and actual < expected:
                matched = False
                break
            if field == "completed_to" and actual > expected:
                matched = False
                break
            if field not in {"completed_from", "completed_to"} and str(actual) != str(expected):
                matched = False
                break
        if matched:
            selected.append(record)
    return selected


def _number(value: Any) -> float:
    return 0.0 if value is None else float(value)


def calculate_data_metric(records: Iterable[Any], definition: Any, filters: Mapping[str, Any] | None = None) -> dict[str, Any]:
    """计算源数据指标；只接收已确认记录，结果不写回业务表。"""

    filter_definition = dict(getattr(definition, "filter_definition", {}) or {})
    filter_definition.update(filters or {})
    selected = apply_filter(records, filter_definition)
    metric_type = getattr(definition, "metric_type")
    numerator_field = getattr(definition, "numerator_field")
    denominator_field = getattr(definition, "denominator_field", None)

    if metric_type == "penetration":
        numerator = sum(1 for record in selected if getattr(record, numerator_field, None) is True)
        denominator = len(selected)
        value = numerator / denominator if denominator else None
    elif metric_type == "efficiency":
        numerator = sum(_number(getattr(record, numerator_field, None)) for record in selected)
        denominator = sum(_number(getattr(record, denominator_field, None)) for record in selected)
        if numerator == 0 and denominator == 0:
            value = None
        else:
            value = (numerator - denominator) / (denominator if denominator > 0 else 0.5)
    elif metric_type == "count":
        numerator = sum(_number(getattr(record, numerator_field, None)) for record in selected)
        denominator = len(selected)
        value = numerator
    elif metric_type == "ratio":
        numerator = sum(_number(getattr(record, numerator_field, None)) for record in selected)
        denominator = sum(_number(getattr(record, denominator_field, None)) for record in selected)
        value = numerator / denominator if denominator > 0 else None
    else:
        raise ValueError(f"unsupported data metric type: {metric_type}")

    return {
        "numerator": numerator,
        "denominator": denominator,
        "value": value,
        "record_count": len(selected),
    }


def build_ir_overview_series(records: Iterable[Any], teams: Sequence[Any], period_ids: Sequence[str]) -> dict[str, Any]:
    records_by_team_period: dict[tuple[int, str], list[Any]] = {}
    records_by_period: dict[str, list[Any]] = {}
    team_ids = {team.id for team in teams}
    for record in records:
        team_id = record.product.team_id
        period_id = record.completed_at.strftime("%Y-%m")
        if team_id not in team_ids or period_id not in period_ids:
            continue
        records_by_team_period.setdefault((team_id, period_id), []).append(record)
        records_by_period.setdefault(period_id, []).append(record)

    def point(period_id: str, period_records: Sequence[Any]) -> dict[str, Any]:
        known_ai_records = [
            record for record in period_records
            if effective_ai_assisted(record) is not None
        ]
        ai_records = [
            record for record in known_ai_records
            if effective_ai_assisted(record) is True
        ]
        workload_records = [
            record for record in ai_records
            if all(
                isinstance(value, (int, float)) and math.isfinite(value)
                for value in (
                    effective_estimated_workload(record),
                    effective_actual_workload(record),
                )
            )
        ]
        return {
            "period_id": period_id,
            "fact_count": len(period_records),
            "known_ai_count": len(known_ai_records),
            "ai_assisted_count": len(ai_records) if known_ai_records else None,
            "ai_workload_count": len(workload_records),
            "ai_estimated_workload": sum(effective_estimated_workload(record) for record in workload_records) if workload_records else None,
            "ai_actual_workload": sum(effective_actual_workload(record) for record in workload_records) if workload_records else None,
        }

    return {
        "period_ids": list(period_ids),
        "series": [
            {
                "team_id": team.id,
                "team_name": team.name,
                "values": [point(period_id, records_by_team_period.get((team.id, period_id), [])) for period_id in period_ids],
            }
            for team in teams
        ],
        "domain_summary": [point(period_id, records_by_period.get(period_id, [])) for period_id in period_ids],
    }


def _xml_local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _xlsx_column_index(cell_ref: str) -> int:
    letters = "".join(char for char in cell_ref if char.isalpha()).upper()
    result = 0
    for char in letters:
        result = result * 26 + ord(char) - ord("A") + 1
    return result - 1


def _xlsx_rows(content: bytes) -> list[list[str]]:
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.iter():
                if _xml_local_name(item.tag) == "si":
                    shared_strings.append("".join(node.text or "" for node in item.iter() if _xml_local_name(node.tag) == "t"))

        sheet_names = sorted(
            name for name in archive.namelist()
            if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")
        )
        if not sheet_names:
            raise ValueError("Excel 文件缺少工作表")
        sheet_name = sheet_names[0]
        root = ElementTree.fromstring(archive.read(sheet_name))
        rows: list[list[str]] = []
        for row in root.iter():
            if _xml_local_name(row.tag) != "row":
                continue
            values: dict[int, str] = {}
            for cell in row:
                if _xml_local_name(cell.tag) != "c":
                    continue
                reference = cell.attrib.get("r", "A1")
                cell_type = cell.attrib.get("t")
                raw = ""
                for child in cell:
                    if _xml_local_name(child.tag) == "v":
                        raw = child.text or ""
                    elif _xml_local_name(child.tag) == "is":
                        raw = "".join(node.text or "" for node in child.iter() if _xml_local_name(node.tag) == "t")
                if cell_type == "s" and raw:
                    raw = shared_strings[int(raw)]
                values[_xlsx_column_index(reference)] = raw
            if values and any(str(value).strip() for value in values.values()):
                rows.append([values.get(index, "") for index in range(max(values) + 1)])
        return rows


def _decode_csv(content: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "gb18030"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError("CSV 文件编码无法识别，请使用 UTF-8 或 GB18030")


def _rows_to_dicts(rows: list[list[str]]) -> list[dict[str, Any]]:
    if not rows:
        return []
    headers = [str(value).strip() for value in rows[0]]
    if not any(headers):
        return []
    non_empty = [header for header in headers if header]
    if len(non_empty) != len(set(non_empty)):
        raise ValueError("文件存在重复列名")
    result: list[dict[str, Any]] = []
    for row in rows[1:]:
        if not any(str(value).strip() for value in row):
            continue
        result.append({header: row[index] if index < len(row) else "" for index, header in enumerate(headers) if header})
    return result


def parse_import_file(content: bytes, filename: str) -> list[dict[str, Any]]:
    """解析 CSV 或不依赖第三方库的基础 XLSX 文件。"""

    suffix = PurePath(filename).suffix.lower()
    if suffix == ".csv":
        reader = csv.reader(io.StringIO(_decode_csv(content)))
        rows = [[value.strip() for value in row] for row in reader]
        return _rows_to_dicts(rows)
    if suffix == ".xlsx":
        return _rows_to_dicts(_xlsx_rows(content))
    raise ValueError("仅支持 CSV 或 XLSX 文件")


def json_changes(changes: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    return {str(index): dict(change) for index, change in enumerate(changes)}
