# skills.md

## 스킬 목록

### add-feature
- 목적: 기존 모듈 구조를 지키며 기능 추가
- 절차: Actions에 로직 추가 → Render 갱신 → Events에 위임 핸들러 연결 → CLAUDE.md 규칙 확인

### update-sample-data
- 목적: `data/*.csv` 스키마 변경 시 초기화/마이그레이션 동기화
- 절차: CSV 헤더 수정 → `init()` 시드 매핑 수정 → `SCHEMA_VERSION` 증가 및 `migrate*` 추가

### a11y-check
- 목적: 접근성 최소 기준 점검
- 체크: label-for 연결, aria-label, 키보드 포커스 링, 에러 `role="alert"`

### feat_notice_delete_confirm
- 목적: 공지 삭제 UX를 안전하게 만든다.
- 절차: 삭제 버튼을 `data-id`로 식별 → 이벤트 위임으로 클릭 처리 → 확인창에 제목 포함 → localStorage에서 제거 후 render 재호출
- 검증: confirm 취소 시 유지, 확인 시 제거되고 새로고침 후에도 반영 (DoD 3)

### feat_parse_csv_to_json
- 목적: UTF-8 CSV를 파싱해 배열로 만든다.
- 절차: 헤더 검증 → 따옴표 이스케이프 케이스 고려(가능하면 작은 파서 함수) → 실패 시 사용자 메시지
- 검증: fetch/파싱 실패를 try/catch로 처리해 콘솔 에러 0 유지, 경로는 상대경로(`data/*.csv`) (DoD 7, 8)
