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

## 데이터 저장 방식 (Firebase 연결)
- `app.js`의 `FIREBASE_CONFIG`가 `null`이면 **localStorage 모드**입니다. 데이터가 그 브라우저·기기에만 저장되어 PC와 아이폰이 서로 보이지 않습니다.
- `FIREBASE_CONFIG`를 채우면 **Firebase Firestore 공유 DB 모드**로 동작해 모든 기기가 같은 데이터를 봅니다. 연결에 실패하면 자동으로 로컬 모드로 돌아가며, 화면 상단에 현재 모드가 표시됩니다.

### Firebase 설정 (무료 Spark 플랜, 카드 불필요)
1. https://console.firebase.google.com 에서 프로젝트 생성 (Analytics는 꺼도 됨)
2. 프로젝트 설정 → 내 앱 → 웹(`</>`) 앱 등록 → 표시되는 `firebaseConfig` 값 복사
3. Product categories → Databases & Storage → Firestore 
4. Build → Firestore Database → 데이터베이스 만들기 (프로덕션 모드, 가까운 리전 예: `asia-northeast3` 서울)
5. Firestore → 규칙 탭에 이 폴더의 `firestore.rules` 내용을 붙여넣고 게시
6. `app.js`의 `const FIREBASE_CONFIG = null;`을 복사한 설정(`apiKey`, `authDomain`, `projectId`, `appId`)으로 교체 → push
7. 첫 방문 시 `data/*.csv`가 Firestore에 한 번만 시드됨 (`meta/seed` 문서로 표시)

### 보안 한계
로그인이 없는 공개 데모라서, 사이트 주소를 아는 누구나 공지·예약을 읽고 만들고 삭제할 수 있습니다. 규칙은 입력 형식·길이만 검증합니다(수정은 불가). 웹 `apiKey`는 공개돼도 되는 값입니다. 무료 Spark 플랜에는 사용량 이메일 알림이 없으므로, 가끔 Firebase 콘솔 → Firestore Database → **사용량** 탭에서 읽기·쓰기 횟수를 확인하세요. 일일 무료 한도를 넘으면 요금이 청구되지 않고 그날은 서비스가 제한됩니다(결제 카드가 필요한 Blaze 플랜으로 올리지 않는 한 과금 없음). 남용이 문제가 되면 Firebase Auth나 App Check 도입을 검토하세요. 중요한 데이터는 넣지 마세요.

## GitHub Pages 배포 메모
빌드가 없는 정적 사이트라 GitHub Actions는 필요 없습니다. 브랜치 배포만 사용하세요.

1. `index.html`이 저장소 루트(또는 `/docs`)에 오도록 push
2. Settings → Pages → Build and deployment → Source: **Deploy from a branch** → 브랜치(`main`)와 폴더 `/ (root)` (또는 `/docs`) 선택 → Save
3. 잠시 후 `https://<user>.github.io/<repo>/` 로 접속 (첫 화면이 `/`)
4. 모든 경로는 선행 `/` 없는 상대경로(`style.css`, `app.js`, `data/*.csv`)라 `/<repo>/` 하위 경로에서도 동작
5. CSV 수정 후에는 이미 시드된 데이터(localStorage 또는 Firestore)에는 반영되지 않음(시드는 최초 1회)

### 배포 확인 체크리스트
- [ ] `https://<user>.github.io/<repo>/` 첫 화면이 열리고 스타일(`style.css`)이 적용된다
- [x] 개발자도구 Network 탭에서 `app.js`, `style.css`, `data/*.csv` 가 모두 200이다 (404 없음)
- [x] 공지·예약 목록이 보이고(CSV 시드 로드), 새로고침해도 유지된다
- [x] 콘솔 에러가 0건이다 (favicon 404 포함)
- [x] 다른 기기/시크릿 창에서 강력 새로고침(Ctrl+Shift+R) 후에도 동일하게 동작한다
