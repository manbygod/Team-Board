(function () {
  'use strict';

  // github.io 는 같은 계정의 모든 Pages 프로젝트가 localStorage 를 공유하므로 모든 키에 tb_ 접두사를 둔다.
  const KEYS = { announcements: 'tb_announcements', reservations: 'tb_reservations', rooms: 'tb_rooms' };
  const SCHEMA_KEY = 'tb_schema_v';
  const SCHEMA_VERSION = '2';

  const DEFAULT_ROOMS = [
    { id: 'r1', name: 'A회의실', capacity: '4' },
    { id: 'r2', name: 'B회의실', capacity: '8' },
    { id: 'r3', name: '대회의실', capacity: '20' }
  ];

  const ANN_RULES = {
    title: '제목을 입력하세요.',
    author: '작성자를 입력하세요.',
    body: '본문을 입력하세요.'
  };

  const state = {
    announcements: [],
    rooms: [],
    reservations: [],
    filter: { date: '', roomId: '' }
  };

  const $ = (id) => document.getElementById(id);

  /* ---------- CSV ---------- */
  const Csv = {
    parse(text) {
      const rows = [];
      let row = [], cell = '', quoted = false;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
          if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
          else if (c === '"') quoted = false;
          else cell += c;
        } else if (c === '"') quoted = true;
        else if (c === ',') { row.push(cell); cell = ''; }
        else if (c === '\n' || c === '\r') {
          if (c === '\r' && text[i + 1] === '\n') i++;
          row.push(cell); cell = '';
          if (row.some((v) => v !== '')) rows.push(row);
          row = [];
        } else cell += c;
      }
      if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
      const [header, ...body] = rows;
      if (!header) return [];
      return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] || '').trim()])));
    },
    async fetch(path) {
      try {
        const res = await fetch(path);
        if (!res.ok) return null;
        return Csv.parse(await res.text());
      } catch (e) {
        return null; // file:// 등에서 fetch 실패 시 폴백
      }
    }
  };

  /* ---------- 저장 (load / save) ---------- */
  const Store = {
    load(key) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? null : JSON.parse(raw);
      } catch (e) {
        return null;
      }
    },
    save(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        alert('저장에 실패했습니다. 브라우저 저장소 설정을 확인하세요.');
      }
    },
    // 구버전 예약(room 이름/id 필드)을 roomId 스키마로 변환
    migrateReservations(list, rooms) {
      return list.map((r) => {
        if (r.roomId) return r;
        const room = rooms.find((x) => x.id === r.room || x.name === r.room);
        const { room: _old, ...rest } = r;
        return { ...rest, roomId: room ? room.id : (r.room || '') };
      });
    }
  };

  /* ---------- 공지 정렬 (순수 함수) ---------- */
  // 규칙: pinned(desc: 고정이 먼저) → createdAt(desc: 최신이 먼저). 동률은 입력 순서 유지(안정 정렬).
  // 입력 배열을 변경하지 않고 새 배열을 반환한다.
  function compareAnnouncements(a, b) {
    const byPinned = Number(!!b.pinned) - Number(!!a.pinned);
    if (byPinned !== 0) return byPinned;
    return (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0);
  }

  function sortAnnouncements(list) {
    return list.slice().sort(compareAnnouncements);
  }

  /* 테스트 케이스 (단위 테스트 대체용 — 콘솔에 붙여 넣어 console.assert로 확인)
   * 공통 헬퍼: const ids = (l) => sortAnnouncements(l).map((x) => x.id).join(',');
   *
   * 1) 고정 우선:   [{id:'a',pinned:false,createdAt:'2026-10-03T00:00:00Z'},
   *                  {id:'b',pinned:true, createdAt:'2026-10-01T00:00:00Z'}]
   *                 → ids === 'b,a'   (오래됐어도 pinned가 먼저)
   * 2) 같은 pinned 안에서 최신 우선:
   *                 [{id:'a',pinned:false,createdAt:'2026-10-01T00:00:00Z'},
   *                  {id:'b',pinned:false,createdAt:'2026-10-03T00:00:00Z'}]
   *                 → ids === 'b,a'
   * 3) 고정끼리도 최신 우선 + 고정 그룹이 비고정 그룹보다 위:
   *                 [{id:'a',pinned:true, createdAt:'2026-10-01T00:00:00Z'},
   *                  {id:'b',pinned:false,createdAt:'2026-10-05T00:00:00Z'},
   *                  {id:'c',pinned:true, createdAt:'2026-10-02T00:00:00Z'}]
   *                 → ids === 'c,a,b'
   * 4) 동률(pinned·createdAt 동일)은 입력 순서 유지:
   *                 [{id:'a',pinned:false,createdAt:'2026-10-01T00:00:00Z'},
   *                  {id:'b',pinned:false,createdAt:'2026-10-01T00:00:00Z'}]
   *                 → ids === 'a,b'
   * 5) 원본 불변 + 빈 배열/비정상 값 허용:
   *                 const src = [{id:'a',createdAt:'2026-10-01T00:00:00Z'},
   *                              {id:'b',pinned:true,createdAt:'invalid'}];
   *                 sortAnnouncements(src) → ids === 'b,a' (pinned 누락=false, 파싱 불가 날짜=0),
   *                 src[0].id === 'a' (원본 순서 그대로), sortAnnouncements([]).length === 0
   */

  /* ---------- 예약 충돌 판정 (순수 함수) ---------- */
  // 시간은 'HH:mm'(0 패딩) 문자열이므로 사전식 비교 == 시간 비교. 같은 날(영업일) 안에서만 쓴다.
  // 팀 규약(R2): 종료 시각은 배타적(end-exclusive). 10:00~11:00 과 11:00~12:00 은 겹치지 않는다.
  //   endExclusive=true (기본) : a.start < b.end  && b.start < a.end   (맞닿음 허용)
  //   endExclusive=false       : a.start <= b.end && b.start <= a.end  (맞닿음도 충돌)
  function overlap(a, b, endExclusive = true) {
    return endExclusive
      ? a.start < b.end && b.start < a.end
      : a.start <= b.end && b.start <= a.end;
  }

  // 시작 < 종료 (R3: start >= end 는 거부 대상)
  function isValidRange(start, end) {
    return !!start && !!end && start < end;
  }

  // 같은 방·같은 날짜 예약 중 처음 겹치는 항목을 반환(없으면 null). list는 변경하지 않는다.
  function findConflict(list, room, date, start, end, endExclusive = true) {
    return list.find((r) =>
      r.roomId === room && r.date === date && overlap(r, { start, end }, endExclusive)) || null;
  }

  function hasConflict(list, room, date, start, end, endExclusive = true) {
    return findConflict(list, room, date, start, end, endExclusive) !== null;
  }

  /* 테스트 데이터 (교재 슬라이드 R1~R3 재현 — 콘솔에서 console.assert로 확인)
   * 기존 예약 목록:
   *   const list = [{ id: 'RES-001', roomId: 'r1', date: '2026-10-05', start: '10:00', end: '11:00', owner: '홍길동' }];
   *
   * R1) 동일 방·날짜 10:00~11:00 존재, 10:30~11:30 시도 → 거부(충돌)
   *     hasConflict(list, 'r1', '2026-10-05', '10:30', '11:30')          === true
   *     (다른 방/다른 날짜는 통과) hasConflict(list, 'r2', '2026-10-05', '10:30', '11:30') === false
   *                                hasConflict(list, 'r1', '2026-10-06', '10:30', '11:30') === false
   * R2) 10:00~11:00 vs 11:00~12:00 (끝=시작) → 기본 규약: 겹치지 않음(허용)
   *     hasConflict(list, 'r1', '2026-10-05', '11:00', '12:00')          === false
   *     hasConflict(list, 'r1', '2026-10-05', '11:00', '12:00', false)   === true   // 맞닿음도 충돌로 보는 옵션
   *     hasConflict(list, 'r1', '2026-10-05', '09:00', '10:00')          === false  // 앞쪽 맞닿음도 동일
   * R3) start >= end → 거부
   *     isValidRange('11:00', '10:00') === false
   *     isValidRange('10:00', '10:00') === false
   *     isValidRange('10:00', '10:01') === true
   */

  /* ---------- 유틸 ---------- */
  const Util = {
    uid: (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    roomName: (id) => (state.rooms.find((r) => r.id === id) || { name: id }).name,
    // 텍스트 렌더 단일 진입점: 사용자 데이터는 반드시 이 함수(textContent)로만 DOM에 넣는다.
    // HTML 문자열을 DOM에 직접 주입하는 API 사용 금지 (CLAUDE.md 참고).
    setText(node, value) {
      node.textContent = value == null ? '' : String(value);
    },
    el(tag, props = {}, ...children) {
      const node = document.createElement(tag);
      Object.entries(props).forEach(([k, v]) => {
        if (k === 'class') node.className = v;
        else if (k === 'text') Util.setText(node, v);
        else if (k === 'type') node.type = v;
        else if (k.startsWith('data-') || k.startsWith('aria-')) node.setAttribute(k, v);
        else throw new Error(`Util.el: 허용되지 않은 속성 "${k}" (HTML 주입·on* 속성 금지)`);
      });
      children.forEach((c) => {
        if (c == null || c === false) return;
        node.append(c instanceof Node ? c : document.createTextNode(String(c)));
      });
      return node;
    }
  };

  /* ---------- 렌더 ---------- */
  const Render = {
    announcements() {
      const ul = $('ann-list');
      ul.replaceChildren();
      if (!state.announcements.length) {
        ul.append(Util.el('li', { class: 'empty', text: '등록된 공지가 없습니다. 첫 공지를 작성해 보세요.' }));
        return;
      }
      sortAnnouncements(state.announcements).forEach((a) => {
        const head = Util.el('div', { class: 'card__head' },
          Util.el('h3', { class: 'card__title' }, a.pinned ? Util.el('span', { class: 'badge', text: '고정' }) : null, a.title),
          Util.el('button', {
            type: 'button', class: 'button button--danger', text: '삭제',
            'data-action': 'delete-announcement', 'data-id': a.id,
            'aria-label': `공지 삭제: ${a.title}`
          }));
        ul.append(Util.el('li', { class: 'card' + (a.pinned ? ' card--pinned' : '') },
          head,
          Util.el('p', { class: 'card__body', text: a.body }),
          Util.el('span', { class: 'card__meta', text: `${a.author} · ${new Date(a.createdAt).toLocaleString('ko-KR')}` })));
      });
    },

    roomOptions() {
      const form = $('res-room');
      const filter = $('filter-room');
      const prevForm = form.value, prevFilter = filter.value;
      form.replaceChildren(...state.rooms.map((r) => new Option(`${r.name} (${r.capacity}인)`, r.id)));
      filter.replaceChildren(new Option('전체', ''), ...state.rooms.map((r) => new Option(r.name, r.id)));
      form.value = prevForm || (state.rooms[0] && state.rooms[0].id) || '';
      filter.value = prevFilter;
    },

    reservations() {
      const ul = $('res-list');
      ul.replaceChildren();
      const { date, roomId } = state.filter;
      const items = state.reservations
        .filter((r) => (!date || r.date === date) && (!roomId || r.roomId === roomId))
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
      if (!items.length) {
        ul.append(Util.el('li', { class: 'empty', text: '조건에 맞는 예약이 없습니다.' }));
        return;
      }
      items.forEach((r) => {
        const title = `${Util.roomName(r.roomId)} ${r.date} ${r.start}~${r.end}`;
        ul.append(Util.el('li', { class: 'card' },
          Util.el('div', { class: 'card__head' },
            Util.el('h3', { class: 'card__title', text: title }),
            Util.el('button', {
              type: 'button', class: 'button button--danger', text: '취소',
              'data-action': 'delete-reservation', 'data-id': r.id,
              'aria-label': `예약 취소: ${title}`
            })),
          Util.el('span', { class: 'card__meta', text: `예약자 ${r.owner}` })));
      });
    },

    all() {
      Render.announcements();
      Render.roomOptions();
      Render.reservations();
    }
  };

  /* ---------- 액션 (상태 변경 + 저장) ---------- */
  const Actions = {
    addAnnouncement(data) {
      const values = {
        title: data.title.trim(), author: data.author.trim(), body: data.body.trim()
      };
      const errors = {};
      Object.keys(ANN_RULES).forEach((k) => { if (!values[k]) errors[k] = ANN_RULES[k]; });
      if (Object.keys(errors).length) return errors;
      const { title, author, body } = values;
      state.announcements.push({
        id: Util.uid('a'), title, body, author,
        pinned: !!data.pinned, createdAt: new Date().toISOString()
      });
      Store.save(KEYS.announcements, state.announcements);
      Render.announcements();
      return errors;
    },
    deleteAnnouncement(id) {
      const a = state.announcements.find((x) => x.id === id);
      if (!a || !confirm(`"${a.title}" 공지를 삭제할까요?`)) return;
      state.announcements = state.announcements.filter((x) => x.id !== id);
      Store.save(KEYS.announcements, state.announcements);
      Render.announcements();
    },
    addReservation(data) {
      const { roomId, date, start, end } = data;
      const owner = data.owner.trim();
      if (!roomId || !date || !start || !end || !owner) return '모든 항목을 입력하세요.';
      if (!isValidRange(start, end)) return '종료 시간은 시작 시간보다 늦어야 합니다.';
      const clash = findConflict(state.reservations, roomId, date, start, end);
      if (clash) return `이미 예약된 시간과 겹칩니다 (${clash.start}~${clash.end}, ${clash.owner}).`;
      state.reservations.push({ id: Util.uid('v'), roomId, date, start, end, owner });
      Store.save(KEYS.reservations, state.reservations);
      Render.reservations();
      return '';
    },
    deleteReservation(id) {
      const r = state.reservations.find((x) => x.id === id);
      if (!r || !confirm(`${Util.roomName(r.roomId)} ${r.date} ${r.start}~${r.end} 예약을 취소할까요?`)) return;
      state.reservations = state.reservations.filter((x) => x.id !== id);
      Store.save(KEYS.reservations, state.reservations);
      Render.reservations();
    }
  };

  /* ---------- 이벤트 위임 ---------- */
  const Events = {
    bind() {
      const showAnnErrors = (form, errors) => {
        Object.keys(ANN_RULES).forEach((k) => {
          const input = form.elements[k];
          Util.setText($(`ann-${k}-error`), errors[k]);
          if (errors[k]) input.setAttribute('aria-invalid', 'true');
          else input.removeAttribute('aria-invalid');
        });
        const first = Object.keys(ANN_RULES).find((k) => errors[k]);
        if (first) form.elements[first].focus();
      };

      $('ann-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = e.currentTarget;
        const el = f.elements;
        const errors = Actions.addAnnouncement({
          title: el.title.value, author: el.author.value, body: el.body.value, pinned: el.pinned.checked
        });
        showAnnErrors(f, errors);
        if (!Object.keys(errors).length) f.reset();
      });

      // 입력을 시작하면 해당 필드의 에러만 해제
      $('ann-form').addEventListener('input', (e) => {
        const k = e.target.name;
        if (k in ANN_RULES && e.target.getAttribute('aria-invalid')) {
          Util.setText($(`ann-${k}-error`), '');
          e.target.removeAttribute('aria-invalid');
        }
      });

      // aria-live 영역 출력: 같은 메시지가 반복돼도 다시 낭독되도록 비운 뒤 다음 프레임에 채운다.
      const announceResError = (msg) => {
        const live = $('res-error');
        Util.setText(live, '');
        if (msg) requestAnimationFrame(() => Util.setText(live, msg));
      };

      $('res-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = e.currentTarget;
        const msg = Actions.addReservation({
          roomId: f.roomId.value, date: f.date.value, start: f.start.value, end: f.end.value, owner: f.owner.value
        });
        announceResError(msg);
        if (!msg) { f.start.value = ''; f.end.value = ''; f.owner.value = ''; }
      });

      // 목록 삭제 버튼: 부모에서 위임
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const { action, id } = btn.dataset;
        if (action === 'delete-announcement') Actions.deleteAnnouncement(id);
        else if (action === 'delete-reservation') Actions.deleteReservation(id);
      });

      const applyFilter = () => {
        state.filter.date = $('filter-date').value;
        state.filter.roomId = $('filter-room').value;
        Render.reservations();
      };
      $('filter-date').addEventListener('change', applyFilter);
      $('filter-room').addEventListener('change', applyFilter);
      $('filter-reset').addEventListener('click', () => {
        $('filter-date').value = '';
        $('filter-room').value = '';
        applyFilter();
      });
    }
  };

  /* ---------- 초기화 ---------- */
  async function init() {
    let rooms = Store.load(KEYS.rooms);
    if (!rooms || !rooms.length) {
      const seed = await Csv.fetch('data/rooms.csv');
      rooms = seed && seed.length ? seed : DEFAULT_ROOMS;
      Store.save(KEYS.rooms, rooms);
    }
    state.rooms = rooms;

    let anns = Store.load(KEYS.announcements);
    if (!anns) {
      const seed = (await Csv.fetch('data/announcements.csv')) || [];
      anns = seed.map((a) => ({ ...a, pinned: a.pinned === 'true' }));
      Store.save(KEYS.announcements, anns);
    }
    state.announcements = anns;

    let res = Store.load(KEYS.reservations);
    if (!res) {
      res = (await Csv.fetch('data/reservations.csv')) || [];
    } else if (Store.load(SCHEMA_KEY) !== SCHEMA_VERSION) {
      res = Store.migrateReservations(res, state.rooms);
    }
    state.reservations = res;
    Store.save(KEYS.reservations, res);
    Store.save(SCHEMA_KEY, SCHEMA_VERSION);

    Events.bind();
    Render.all();
  }

  init();
})();
