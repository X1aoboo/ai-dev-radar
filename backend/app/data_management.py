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


IR_FIELDS = (
    "requirement_no",
    "requirement_name",
    "responsible_employee_id",
    "parent_requirement_no",
    "product_id",
    "version_id",
    "iteration_id",
    "completed_at",
    "business_module",
    "requirement_scenario",
    "estimated_workload",
    "actual_workload",
    "sa_estimated_workload",
    "sa_actual_workload",
    "se_estimated_workload",
    "se_actual_workload",
    "ai_assisted",
)

IR_REQUIRED_FIELDS = (
    "requirement_no",
    "requirement_name",
    "product_id",
    "version_id",
    "iteration_id",
    "completed_at",
    "business_module",
    "requirement_scenario",
)

IR_FIELD_LABELS = {
    "requirement_no": "需求编号",
    "requirement_name": "需求名称",
    "responsible_employee_id": "需求责任人工号",
    "parent_requirement_no": "父需求编号",
    "product_id": "产品ID",
    "version_id": "版本ID",
    "iteration_id": "迭代ID",
    "completed_at": "完成时间",
    "business_module": "业务模块",
    "requirement_scenario": "需求场景",
    "estimated_workload": "预估工作量",
    "actual_workload": "实际工作量",
    "sa_estimated_workload": "SA设计预估工作量",
    "sa_actual_workload": "SA设计实际工作量",
    "se_estimated_workload": "SE设计预估工作量",
    "se_actual_workload": "SE设计实际工作量",
    "ai_assisted": "是否使用AI辅助研发",
}

_HEADER_ALIASES = {
    **{field: field for field in IR_FIELDS},
    **{label: field for field, label in IR_FIELD_LABELS.items()},
    "需求责任人": "responsible_employee_id",
    "是否使用AI": "ai_assisted",
    "是否使用AI辅助研发": "ai_assisted",
}

_FLOAT_FIELDS = {
    "estimated_workload",
    "actual_workload",
    "sa_estimated_workload",
    "sa_actual_workload",
    "se_estimated_workload",
    "se_actual_workload",
}
_INT_FIELDS = {"product_id", "version_id", "iteration_id"}


def _clean(value: Any) -> Any:
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def _parse_date(value: Any) -> date | None:
    value = _clean(value)
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value))


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


def normalize_ir_row(row: Mapping[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """把 API/CSV/Excel 行规范化为 IR 字段，并返回字段格式错误。"""

    normalized: dict[str, Any] = {}
    errors: list[str] = []
    for raw_key, raw_value in row.items():
        key = _HEADER_ALIASES.get(str(raw_key).strip())
        if key is None:
            continue
        value = _clean(raw_value)
        try:
            if key in _FLOAT_FIELDS and value is not None:
                value = float(value)
                if not math.isfinite(value) or value < 0:
                    raise ValueError("must be a finite non-negative number")
            elif key in _INT_FIELDS and value is not None:
                value = int(value)
                if value < 1:
                    raise ValueError("must be positive")
            elif key == "completed_at" and value is not None:
                value = _parse_date(value)
            elif key == "ai_assisted":
                value = _parse_bool(value)
        except (TypeError, ValueError) as exc:
            errors.append(f"{IR_FIELD_LABELS[key]}：{exc}")
            continue
        normalized[key] = value

    for field in IR_REQUIRED_FIELDS:
        if _clean(normalized.get(field)) is None:
            errors.append(f"缺少{IR_FIELD_LABELS[field]}")
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


def field_diff(existing: Any | None, payload: Mapping[str, Any]) -> dict[str, dict[str, Any]]:
    """返回导入确认将采取的字段动作，不把差异直接写入数据库。"""

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
        if current is None and incoming is not None:
            action = "fill"
        elif incoming is None or current_serialized == incoming_serialized:
            action = "unchanged"
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

        sheet_name = "xl/worksheets/sheet1.xml"
        if sheet_name not in archive.namelist():
            raise ValueError("Excel 文件缺少第一个工作表")
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
            if values:
                rows.append([values.get(index, "") for index in range(max(values) + 1)])
        return rows


def parse_import_file(content: bytes, filename: str) -> list[dict[str, Any]]:
    """解析 CSV 或不依赖第三方库的基础 XLSX 文件。"""

    suffix = PurePath(filename).suffix.lower()
    if suffix == ".csv":
        text = content.decode("utf-8-sig")
        return [dict(row) for row in csv.DictReader(io.StringIO(text))]
    if suffix == ".xlsx":
        rows = _xlsx_rows(content)
        if not rows:
            return []
        headers = rows[0]
        return [dict(zip(headers, row, strict=False)) for row in rows[1:]]
    raise ValueError("仅支持 CSV 或 XLSX 文件")


def json_changes(changes: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    return {str(index): dict(change) for index, change in enumerate(changes)}
