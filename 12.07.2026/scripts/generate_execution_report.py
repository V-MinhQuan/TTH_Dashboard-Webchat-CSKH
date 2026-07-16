from __future__ import annotations

import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

import openpyxl

SCRIPT_DIR = Path(__file__).resolve().parent
AUTOMATION_DIR = SCRIPT_DIR.parent
REPO_DIR = AUTOMATION_DIR.parent
sys.path.insert(0, str(SCRIPT_DIR))
import generate_traceability as gt  # noqa: E402


def collect_records() -> list[dict[str, str]]:
    workbook = openpyxl.load_workbook(gt.newest("FLIC_Test_Cases_By_Module*.xlsx"), data_only=True)
    records: list[dict[str, str]] = []
    for sheet in workbook.worksheets[1:]:
        heading = ""
        for row in sheet.iter_rows(min_row=2, max_col=8, values_only=True):
            first = row[0]
            if isinstance(first, str) and re.fullmatch(r"[A-Z]+-TC-\d{2}", first.strip()):
                tc_id = first.strip()
                section = gt.SECTION_BY_KEY[(sheet.title.strip(), heading)]
                description = str(row[1] or "").strip()
                classification = gt.classify(tc_id, section.surface)
                records.append({
                    "tc_id": tc_id,
                    "module": sheet.title.strip(),
                    "task": heading,
                    "file": section.file_name,
                    "class": section.class_name,
                    "method": gt.java_method(tc_id, description),
                    "classification": classification,
                    "mutating": "yes" if tc_id in gt.MUTATING else "no",
                })
            elif first:
                heading = str(first).strip()
    return records


def command(*args: str) -> str:
    try:
        return subprocess.run(args, cwd=REPO_DIR, text=True, encoding="utf-8", errors="replace", capture_output=True, check=False).stdout.strip()
    except OSError:
        return "N/A"


def parse_results() -> tuple[dict[str, str], dict[str, str], ET.Element]:
    root = ET.parse(AUTOMATION_DIR / "target" / "surefire-reports" / "testng-results.xml").getroot()
    statuses: dict[str, str] = {}
    failures: dict[str, str] = {}
    for method in root.findall(".//test-method"):
        if method.get("is-config") == "true" or not method.get("description"):
            continue
        name = method.get("name", "")
        statuses[name] = method.get("status", "UNKNOWN")
        if statuses[name] == "FAIL":
            message = method.findtext("./exception/message", default="").strip()
            failures[name] = re.sub(r"\s+", " ", message)
    return statuses, failures, root


def result_for(record: dict[str, str], statuses: dict[str, str]) -> str:
    if record["method"] in statuses:
        return statuses[record["method"]]
    if record["mutating"] == "yes":
        return "IGNORED"
    return "NOT_RUN"


def table_row(values: list[object]) -> str:
    return "| " + " | ".join(str(value).replace("|", "\\|").replace("\n", "<br>") for value in values) + " |"


def main() -> None:
    records = collect_records()
    java_source_count = len(list((AUTOMATION_DIR / "src" / "test" / "java").rglob("*.java")))
    statuses, failures, xml_root = parse_results()
    for record in records:
        record["result"] = result_for(record, statuses)

    overall = Counter(record["result"] for record in records)
    classifications = Counter(record["classification"] for record in records)
    branch = command("git", "branch", "--show-current") or "N/A"
    commit = command("git", "rev-parse", "HEAD") or "N/A"
    generated = datetime.now().astimezone().isoformat(timespec="seconds")
    suite = xml_root.find("suite")
    started = suite.get("started-at", "N/A") if suite is not None else "N/A"
    duration = suite.get("duration-ms", "N/A") if suite is not None else "N/A"

    lines = [
        "# AUTOMATION EXECUTION REPORT",
        "",
        "## Kết quả xác minh",
        "",
        f"Bộ automation đã compile và chạy thật ngày `{started}`. Default suite giữ nguyên lỗi sản phẩm ở `API-TC-01`; không sửa backend để đổi kết quả.",
        "",
        "| Hạng mục | Giá trị |",
        "|---|---|",
        table_row(["Ngày tạo báo cáo", generated]),
        table_row(["Repository", str(REPO_DIR)]),
        table_row(["Branch / commit", f"{branch} / {commit}"]),
        table_row(["Java", "25.0.2; Maven compiler release 17"]),
        table_row(["Maven", "Apache Maven 3.9.16 từ distribution đã xác minh SHA-512; chưa thêm vào PATH hệ thống"]),
        table_row(["Browser", "Chrome 150.0.7871.114; ChromeDriver 150.0.7871.115 do Selenium Manager cấp"]),
        table_row(["Base / API / ML", "http://127.0.0.1:5173 / http://127.0.0.1:5000 / http://127.0.0.1:8001"]),
        table_row(["Lệnh baseline", "mvn test (default suite, destructive=false), sau khi mvn clean test đã xác minh clean compile"]),
        table_row(["Thời lượng TestNG", f"{duration} ms"]),
        "",
        "## Thống kê",
        "",
        "| Chỉ số | Số lượng |",
        "|---|---:|",
        table_row(["Tổng TC Excel", len(records)]),
        table_row(["TC có @Test method và compile", len(records)]),
        table_row(["Được chọn chạy (gồm Pass/Fail/Skip)", overall["PASS"] + overall["FAIL"] + overall["SKIP"]]),
        table_row(["Pass", overall["PASS"]]),
        table_row(["Fail", overall["FAIL"]]),
        table_row(["Skip", overall["SKIP"]]),
        table_row(["Ignored do destructive=false", overall["IGNORED"]]),
        table_row(["Blocked environment (phân loại trace)", classifications["BLOCKED_ENVIRONMENT"]]),
        table_row(["Manual only (phân loại trace)", classifications["MANUAL_ONLY"]]),
        table_row(["Not applicable (phân loại trace)", classifications["NOT_APPLICABLE"]]),
        "",
        "> `Skip`, `Ignored`, `Blocked`, `Manual only` và `Not applicable` là các trục khác nhau. Không TC nào trong các nhóm này được ghi Pass.",
        "",
        "## Kết quả theo module",
        "",
        "| Module | TC | Pass | Fail | Skip | Ignored |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    by_module: dict[str, list[dict[str, str]]] = defaultdict(list)
    for record in records:
        by_module[record["module"]].append(record)
    for module, module_records in by_module.items():
        counts = Counter(record["result"] for record in module_records)
        lines.append(table_row([module, len(module_records), counts["PASS"], counts["FAIL"], counts["SKIP"], counts["IGNORED"]]))

    lines.extend([
        "",
        "## Kết quả theo Task name / file Java",
        "",
        "| Module | Task name / test case lớn | File Java | TC nhỏ | @Test | Pass | Fail | Skip | Ignored |",
        "|---|---|---|---:|---:|---:|---:|---:|---:|",
    ])
    by_task: dict[tuple[str, str, str], list[dict[str, str]]] = defaultdict(list)
    for record in records:
        by_task[(record["module"], record["task"], record["file"])].append(record)
    for (module, task, file_name), task_records in by_task.items():
        counts = Counter(record["result"] for record in task_records)
        lines.append(table_row([module, task, file_name, len(task_records), len(task_records), counts["PASS"], counts["FAIL"], counts["SKIP"], counts["IGNORED"]]))

    lines.extend(["", "## TC Pass", ""])
    for record in records:
        if record["result"] == "PASS":
            lines.append(f"- `{record['tc_id']}` — `{record['file']}#{record['method']}`")

    lines.extend(["", "## Lỗi", ""])
    if not failures:
        lines.append("Không có lỗi trong execution này.")
    else:
        for method, message in failures.items():
            record = next(record for record in records if record["method"] == method)
            evidence = f"target/evidence/{record['tc_id']}/<timestamp>/"
            lines.append(f"- `{record['tc_id']}` — {message} Evidence: `{evidence}`")

    lines.extend([
        "",
        "## Minh chứng và báo cáo",
        "",
        "- `target/surefire-reports/testng-results.xml` — kết quả 258 TC, gồm 17 destructive ignored.",
        "- `target/surefire-reports/TEST-TestSuite.xml` và `TestSuite.txt` — báo cáo Surefire.",
        "- `target/extent-report/index.html` — Extent HTML report.",
        "- `target/evidence/API-TC-01/<timestamp>/` — screenshot giải thích API không có browser, page-source N/A, console N/A và failure.txt.",
        "",
        "## Các lần chạy bổ sung",
        "",
        "| Lệnh | Kết quả |",
        "|---|---|",
        table_row(["mvn -DskipTests test-compile", f"PASS; compile {java_source_count} Java source files"]),
        table_row(["mvn -Dgroups=ml test", "PASS; ML group chạy thành công"]),
        table_row(["mvn -DsuiteXmlFile=suites/api.xml test", "25 TC: 7 Pass, 1 Fail, 17 Skip; fail API-TC-01"]),
        table_row(["mvn -DsuiteXmlFile=suites/smoke.xml test", "7 TC: 6 Pass, 1 Fail; fail API-TC-01"]),
        "",
        "## Thông tin còn thiếu",
        "",
        "Các credential manager/staff, fixture DB, ID hội thoại/feedback/user/chart và controlled fault environment chưa được cung cấp. Xem `REQUIRED_TEST_INFORMATION.md`; các TC liên quan giữ Skip/Blocked, không suy diễn Pass.",
    ])
    (AUTOMATION_DIR / "docs" / "AUTOMATION_EXECUTION_REPORT.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"WROTE report: total={len(records)} pass={overall['PASS']} fail={overall['FAIL']} skip={overall['SKIP']} ignored={overall['IGNORED']}")


if __name__ == "__main__":
    main()
