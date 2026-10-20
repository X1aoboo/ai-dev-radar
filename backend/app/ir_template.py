"""Generate the IR Excel import template without third-party dependencies."""

from __future__ import annotations

import io
import zipfile
from xml.sax.saxutils import escape

from .ir_fields import IR_TEMPLATE_HEADERS, IR_TEMPLATE_SPECS


_TEMPLATE_WIDTHS = {
    "requirement_type": 10,
    "requirement_no": 20,
    "requirement_name": 30,
    "business_module": 18,
    "progress": 10,
    "team_name": 18,
    "version_name": 20,
    "iteration_name": 14,
    "sa_owner": 20,
    "se_owner": 20,
    "sa_estimated_workload": 13,
    "sa_actual_workload": 13,
    "se_estimated_workload": 13,
    "se_actual_workload": 13,
    "ai_quality_level": 12,
    "ai_applicability": 10,
    "sa_ai_assisted": 11,
    "se_ai_assisted": 11,
    "ai_dev_mode": 18,
    "completed_at": 12,
    "remark": 26,
}


def _cell(reference: str, value: str, style: int = 0) -> str:
    return (
        f'<c r="{reference}" s="{style}" t="inlineStr">'
        f"<is><t>{escape(str(value))}</t></is></c>"
    )


def _column_letter(index: int) -> str:
    result = ""
    current = index
    while current > 0:
        current, remainder = divmod(current - 1, 26)
        result = chr(ord("A") + remainder) + result
    return result


def _sheet(rows: list[list[tuple[str, int]]], widths: list[int], freeze: bool = False) -> str:
    col_xml = "".join(
        f'<col min="{index}" max="{index}" width="{width}" customWidth="1"/>'
        for index, width in enumerate(widths, start=1)
    )
    row_xml = []
    for row_index, row in enumerate(rows, start=1):
        cells = "".join(
            _cell(f"{_column_letter(column_index)}{row_index}", value, style)
            for column_index, (value, style) in enumerate(row, start=1)
        )
        row_xml.append(f'<row r="{row_index}">{cells}</row>')
    pane = (
        '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
        if freeze else ""
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetViews><sheetView workbookViewId="0">{pane}</sheetView></sheetViews>'
        f"<cols>{col_xml}</cols>"
        f"<sheetData>{''.join(row_xml)}</sheetData>"
        "</worksheet>"
    )


def build_ir_import_template() -> bytes:
    header_row = [(label, 1) for label in IR_TEMPLATE_HEADERS]
    widths = [_TEMPLATE_WIDTHS.get(spec.key, 16) for spec in IR_TEMPLATE_SPECS]
    sheet1 = _sheet([header_row], widths, freeze=True)

    instruction_rows: list[list[tuple[str, int]]] = [
        [("IR 需求导入说明", 1), ("", 0), ("", 0), ("", 0)],
        [("字段", 1), ("必填", 1), ("类型", 1), ("说明 / 可选值", 1)],
    ]
    for spec in IR_TEMPLATE_SPECS:
        type_label = {
            "text": "文本",
            "float": "数字",
            "date": "日期",
            "bool": "是/否",
            "enum": "枚举",
            "owner": "姓名 工号",
            "team": "团队名称",
            "version": "产品版本名称",
            "iteration": "迭代名称",
        }.get(spec.value_type, spec.value_type)
        rules: list[str] = []
        if spec.required:
            rules.append("必填")
        if spec.options:
            rules.append("可选值：" + " / ".join(spec.options))
        if spec.suggestions:
            rules.append("常用值：" + " / ".join(spec.suggestions))
        if spec.value_type == "date":
            rules.append("支持 2026/8/5、2026-08-05 或 Excel 日期")
        if spec.value_type == "owner":
            rules.append("推荐填写“姓名 工号”，工号未匹配只警告")
        if not rules:
            rules.append("可空")
        instruction_rows.append([
            (spec.label, 0),
            ("是" if spec.required else "否", 0),
            (type_label, 0),
            ("；".join(rules), 0),
        ])
    instruction_rows.append([("示例", 1), ("", 0), ("", 0), ("", 0)])
    instruction_rows.append([("需求编号", 0), ("是", 0), ("文本", 0), ("IR20260709000000", 0)])
    instruction_rows.append([("归属组", 0), ("是", 0), ("团队名称", 0), ("SCC-AI MML（必须已存在）", 0)])
    instruction_rows.append([("PI", 0), ("是", 0), ("产品版本", 0), ("SCC 27.1.RC1（必须属于该团队）", 0)])
    instruction_rows.append([("迭代", 0), ("是", 0), ("迭代名称", 0), ("迭代 3（必须属于该 PI）", 0)])
    instruction_rows.append([("SA", 0), ("否", 0), ("姓名 工号", 0), ("XXX 00123456", 0)])
    instruction_rows.append([("SE", 0), ("是", 0), ("姓名 工号", 0), ("YYY 00654321", 0)])
    instruction_rows.append([("设计时间", 0), ("是", 0), ("日期", 0), ("2026/8/10", 0)])
    sheet2 = _sheet(instruction_rows, [18, 8, 14, 56], freeze=True)

    workbook = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets>'
        '<sheet name="IR需求" sheetId="1" r:id="rId1"/>'
        '<sheet name="填写说明" sheetId="2" r:id="rId2"/>'
        "</sheets></workbook>"
    )
    workbook_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        "</Relationships>"
    )
    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        "</Relationships>"
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        "</Types>"
    )
    styles = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFF4FF"/><bgColor indexed="64"/></patternFill></fill></fills>'
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>'
        "</styleSheet>"
    )

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", root_rels)
        archive.writestr("xl/workbook.xml", workbook)
        archive.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        archive.writestr("xl/styles.xml", styles)
        archive.writestr("xl/worksheets/sheet1.xml", sheet1)
        archive.writestr("xl/worksheets/sheet2.xml", sheet2)
    return buffer.getvalue()
