# Thiết kế Journal

## Component/class view

```mermaid
classDiagram
  class JournalWorkspace {
    +section: Overview|Trades|AI Review
    +range: Filter
  }
  class JournalProvider {
    +load()
    +applyFilter(filter)
    +save()
    +retry()
    +remove()
  }
  class JournalEvaluationPanel {
    +startSavedReview()
  }
  JournalWorkspace --> JournalProvider
  JournalWorkspace --> JournalEvaluationPanel
```

## Sequence

```mermaid
sequenceDiagram
  actor User
  participant UI as JournalWorkspace
  participant State as JournalProvider
  participant API as Journal API
  participant AI as Evaluation provider
  User->>UI: chọn Overview / Trades / AI Review
  UI->>State: applyFilter hoặc select(id)
  State->>API: GET summary/list/detail (owner-scoped)
  API-->>State: totals, entries, immutable version
  User->>UI: lưu entry hoặc yêu cầu AI review
  UI->>State: save/retry cùng requestId
  State->>API: optimistic version mutation
  API-->>State: saved version hoặc conflict
  State->>AI: chỉ gửi snapshot đã lưu
  AI-->>State: rubric hoặc provider failure
```

## Data/ERD impact

Không thêm bảng. Luồng dùng `trading.journal_entry`, các version/request hash và `trading.journal_evaluation` hiện có; report tính realized values theo `exit_time` của bản CLOSED trong timezone được kiểm tra.

## Security

Owner id được lấy từ authenticated principal; UI không render HTML từ reason/notes. Request retry giữ nguyên body hash và expected version để ngăn duplicate/replay. AI failure được trả về như trạng thái unavailable, không sinh review giả.
