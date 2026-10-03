# 프로젝트 개발 가이드 (team-board)

## 제품 목표
- 공지 게시판과 회의실 예약을 단일 페이지에서 제공한다(PoC 난이도).

## 규약
- 브라우저 저장소 키: `tb_announcements`, `tb_reservations`, `tb_rooms`, `tb_schema_v`(선택 마이그레이션 버전 문자열). 모든 키에 `tb_` 접두사 필수(github.io 계정 단위로 localStorage 공유되어 다른 프로젝트와 충돌 방지).
- 시간은 동일 영업일 안에서만: `HH:mm` 문자열 또는 분 단위 정수 변환 규약을 명시 후 일관되게 적용한다.

## 데이터 계층
- `app.js`의 백엔드는 `LocalBackend`(localStorage) / `CloudBackend`(Firestore) 교체형이며 인터페이스는 `subscribe/put/remove`로 동일하다.
- 상태는 항상 `subscribe` 콜백으로만 갱신하고 Render를 호출한다 (Actions에서 state를 직접 변경하지 않는다).
- `FIREBASE_CONFIG`가 `null`이면 로컬 모드, 연결 실패 시 로컬로 폴백. Firestore 컬렉션: `announcements`, `reservations`, `rooms`, `meta`. 규칙은 `firestore.rules`.

## HTML
- `section/article/nav` 우선 사용. 라벨-입력 매핑 필수.

## CSS
- 클래스는 BEM. 색상·간격은 CSS 변수만 사용한다.

## JavaScript
- `loadX/saveX/renderX/bindEvents` 패턴 분리 권장.
- 삭제는 제목 포함 confirm 또는 모달. Undo는 과제 또는 v2.
- 사용자 입력 렌더는 `Util.setText`/`Util.el({text})` 단일 진입점만 사용 (innerHTML·outerHTML·insertAdjacentHTML 금지)

## DoD 스모크(필수)
1-a) 제목·작성자·본문을 모두 채워 등록하면 목록에 표시되고 새로고침 후에도 유지
1-b) 필드를 비우고 등록하면 필드별 한국어 메시지("제목을 입력하세요." 등)가 뜨고, 해당 입력에 aria-invalid="true"와 aria-describedby(에러 id)가 연결되며 첫 오류 필드로 포커스 이동, 저장 안 됨
1-c) 오류 필드에 입력을 시작하면 그 필드의 메시지와 aria-invalid만 해제되고 나머지 오류는 유지
2) 고정 공지가 항상 상단
3) 삭제 confirm 후 제거
4) 예약 충돌 시 저장 거부 + 메시지
5) 필터로 목록 축소
6) 모바일 360px에서 폼·카드 스크롤 가능
7) 콘솔 에러 0
8) Pages 배포 후 경로 상대 링크 정상 로딩(JS/CSS 상대경로 깨짐 없음)
9) `grep -nE "innerHTML|outerHTML|insertAdjacentHTML" app.js` 결과 0건, 제목에 `<img src=x onerror=alert(1)>` 입력 시 문자열 그대로 표시
