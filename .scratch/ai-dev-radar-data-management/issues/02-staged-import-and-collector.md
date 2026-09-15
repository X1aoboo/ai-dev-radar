# 02 临时导入与采集器扩展 seam

Status: ready-for-human

CSV/XLSX 文件进入临时批次，展示逐行差异和校验结果；批次存在错误时禁止确认。新增 `SourceCollector` 接口和进程内注册表，真实平台适配器暂不实现。

## 验证

- CSV 与基础 XLSX 预览通过。
- 空值合并、整批原子确认和字段审计日志测试通过。
