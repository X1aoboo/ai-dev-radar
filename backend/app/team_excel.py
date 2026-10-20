"""Team/member Excel template and export helpers without third-party dependencies."""

from __future__ import annotations

import io
import zipfile
from xml.sax.saxutils import escape

from .team_imports import TEAM_IMPORT_HEADERS, TEAM_ROLES


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


def _workbook(sheets: list[tuple[str, str]]) -> bytes:
    sheet_xml = "".join(
        f'<sheet name="{escape(name)}" sheetId="{index}" r:id="rId{index}"/>'
        for index, (name, _) in enumerate(sheets, start=1)
    )
    workbook = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f"<sheets>{sheet_xml}</sheets></workbook>"
    )
    rels = "".join(
        f'<Relationship Id="rId{index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{index}.xml"/>'
        for index in range(1, len(sheets) + 1)
    )
    workbook_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        f"{rels}"
        f'<Relationship Id="rId{len(sheets) + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        "</Relationships>"
    )
    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        "</Relationships>"
    )
    overrides = "".join(
        f'<Override PartName="/xl/worksheets/sheet{index}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        for index in range(1, len(sheets) + 1)
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        f"{overrides}"
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
        for index, (_, xml) in enumerate(sheets, start=1):
            archive.writestr(f"xl/worksheets/sheet{index}.xml", xml)
    return buffer.getvalue()


def build_team_import_template() -> bytes:
    header = [(label, 1) for label in TEAM_IMPORT_HEADERS]
    team_sheet = _sheet([header], [20, 16, 16, 12], freeze=True)

    instructions: list[list[tuple[str, int]]] = [
        [("团队人员导入说明", 1), ("", 0), ("", 0), ("", 0)],
        [("字段", 1), ("必填", 1), ("说明", 1), ("示例", 1)],
        [("团队名称", 0), ("是", 0), ("团队不存在时自动创建；多个成员可填写同一团队", 0), ("团队A", 0)],
        [("工号", 0), ("是", 0), ("全局唯一；已存在时更新姓名/角色/所属团队", 0), ("A003", 0)],
        [("姓名", 0), ("是", 0), ("成员姓名", 0), ("张三", 0)],
        [("角色", 0), ("是", 0), ("可选值：SA / SE / MDE / 开发 / 测试", 0), ("开发", 0)],
        [("导入方式", 1), ("", 0), ("", 0), ("", 0)],
        [("预览", 0), ("", 0), ("上传后先预览新增/更新/无变化和错误行", 0), ("", 0)],
        [("确认", 0), ("", 0), ("无错误时整批写入；任一行错误则整批不写入", 0), ("", 0)],
    ]
    instruction_sheet = _sheet(instructions, [18, 8, 60, 20], freeze=True)
    return _workbook([("团队成员", team_sheet), ("填写说明", instruction_sheet)])


def build_team_export(teams: list[tuple[str, list[tuple[str, str, str]]]]) -> bytes:
    member_rows: list[list[tuple[str, int]]] = [[(label, 1) for label in TEAM_IMPORT_HEADERS]]
    team_rows: list[list[tuple[str, int]]] = [[("团队名称", 1), ("成员数", 1)]]
    for team_name, members in teams:
        team_rows.append([(team_name, 0), (str(len(members)), 0)])
        for employee_id, name, role in members:
            member_rows.append([(team_name, 0), (employee_id, 0), (name, 0), (role, 0)])
    member_sheet = _sheet(member_rows, [20, 16, 16, 12], freeze=True)
    team_sheet = _sheet(team_rows, [24, 10], freeze=True)
    return _workbook([("团队成员", member_sheet), ("团队", team_sheet)])
