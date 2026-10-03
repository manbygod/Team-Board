# 팀 보드

팀 공지 게시판 + 회의실 예약 보드 (바닐라 HTML/CSS/JS 정적 SPA).

## 로컬 실행
CSV를 `fetch`로 읽기 때문에 `file://` 더블클릭 대신 로컬 서버로 여세요.

```bash
cd team-board
python -m http.server 8000
# 또는: npx serve .
```

브라우저에서 http://localhost:8000 접속.
`file://`로 열면 CSV 로드가 실패해 기본 회의실 3개와 빈 목록으로 동작합니다.

데이터를 초기화하려면 개발자도구 Console에서 아래를 실행한 뒤 새로고침하세요. (`localStorage.clear()`는 같은 도메인의 다른 프로젝트 데이터까지 지우므로 쓰지 마세요.)

```js
['tb_announcements', 'tb_reservations', 'tb_rooms', 'tb_schema_v'].forEach((k) => localStorage.removeItem(k));
```

## GitHub Pages 배포 메모
빌드가 없는 정적 사이트라 GitHub Actions는 필요 없습니다. 브랜치 배포만 사용하세요.

1. `index.html`이 저장소 루트(또는 `/docs`)에 오도록 push
2. Settings → Pages → Build and deployment → Source: **Deploy from a branch** → 브랜치(`main`)와 폴더 `/ (root)` (또는 `/docs`) 선택 → Save
3. 잠시 후 `https://<user>.github.io/<repo>/` 로 접속 (첫 화면이 `/`)
4. 모든 경로는 선행 `/` 없는 상대경로(`style.css`, `app.js`, `data/*.csv`)라 `/<repo>/` 하위 경로에서도 동작
5. CSV 수정 후에는 브라우저 localStorage에 이미 데이터가 있으면 반영되지 않음(시드는 최초 1회)

### 배포 확인 체크리스트
- [ ] `https://<user>.github.io/<repo>/` 첫 화면이 열리고 스타일(`style.css`)이 적용된다
- [ ] 개발자도구 Network 탭에서 `app.js`, `style.css`, `data/*.csv` 가 모두 200이다 (404 없음)
- [ ] 공지·예약 목록이 보이고(CSV 시드 로드), 새로고침해도 유지된다
- [ ] 콘솔 에러가 0건이다 (favicon 404 포함)
- [ ] 다른 기기/시크릿 창에서 강력 새로고침(Ctrl+Shift+R) 후에도 동일하게 동작한다
