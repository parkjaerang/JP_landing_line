# 일본 랜딩페이지

## 디렉터리구조
```
JP_landing-line/
│
├── index.html / index.css / index.js      # 메인 페이지
├── admin.html / admin.css / admin.js      # 어드민
├── admin-edit.js / admin-i18n.js
├── reservations.html / reservations.js    # 예약
├── common.css / common.js / coupon.js / gallery-edit.js
├── README.md
│
├── font/                                  # SST 폰트 패밀리
│
├── ceramique_LP/                          # 세라미크 LP
│   ├── ceramique_LP.html/css/js
│   └── ceramique_LP_img/
│
├── classone_LP/                           # 클래스원 LP
│   ├── classone_LP.html/css/js
│   ├── index.css
│   └── classone_LP_img/
│
├── kleamH_LP/                             # 클림 홍대 LP
│   ├── kleamH_LP.html/css/js
│   └── kleamH_LP_img/
│
├── kleamM_LP/                             # 클림 마포 LP
│   ├── kleamM_LP.html/css/js
│   └── kleamM_LP_img/
│
├── lovae_LP/                              # 로바에 LP
│   ├── lovae_LP.html/css/js
│   └── lovae_LP_img/
│
└── wooa_LP/                               # 우아 LP
    ├── wooa_LP.html/css/js
    └── wooa_LP_img/
```

## 백엔드 전환이 필요한 API 목록

> 현재는 모든 데이터가 **localStorage(해당 브라우저 1대 안)** 에만 저장됩니다.
> 각 파일에 `백엔드 전환 부분`을 주석으로 표시되어 있습니다.

---

### 1. 인증 — `admin.js`, `reservations.js`
> 비밀번호(`admin1234`)가 JS 소스에 평문 노출. 인증 상태는 `localStorage["lp_admin_authed"]`

| Method | Endpoint | 설명 |
| --- | --- | --- |
| POST | `/api/auth/login` | 로그인 (비밀번호 → 세션 토큰 또는 httpOnly 쿠키) |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/auth/me` | 세션 검증 |

---

### 2. 쿠폰 — `coupon.js` > `Store` 객체
> `coupon.js`의 `Store` 객체 메서드가 그대로 API 스펙입니다.

```
데이터 모델: Coupon {
  code      : string   // 6자리 영숫자 (O/0/I/1 제외)
  phone     : string   // 발급 전화번호 (숫자만)
  issuedAt  : ISO8601
  used      : boolean
  usedAt    : ISO8601 | ""
  held      : boolean
  heldAt    : ISO8601 | ""
  hospital  : string   // 페이지키 (예: wooa_LP)
  name      : string   // 예약자 이름
}
```

| Method | Endpoint | 설명 | 현재 메서드 |
| --- | --- | --- | --- |
| POST | `/api/coupons` | 쿠폰 발행 (전화번호당 1회) | `issueCoupon` |
| GET | `/api/coupons/:code` | 쿠폰 유효성 검사 | `validateCoupon` |
| GET | `/api/coupons` | 쿠폰 전체 목록 | `getCoupons` |
| POST | `/api/coupons/:code/hold` | 예약 신청 시 사용 보류 | `holdCoupon` |
| POST | `/api/coupons/:code/confirm` | 통화완료 후 사용 확정 | `confirmCoupon` |
| POST | `/api/coupons/:code/release` | 통화완료 취소 → 보류 복원 | `releaseCoupon` |
| DELETE | `/api/coupons` | 쿠폰 전체 삭제 (관리자 전용) | — |

---

### 3. 예약 — `coupon.js` > `Store` 객체, `reservations.js`
```
데이터 모델: Reservation {
  id              : string              // createdAt + 랜덤 suffix
  name            : string
  phone           : string
  hospital        : string              // 페이지키
  hospitalName    : string              // 표시용 이름
  couponUsed      : boolean             // 신청 시 쿠폰 입력 여부
  couponConfirmed : boolean             // 통화완료 후 실제 사용 확정 여부
  couponVoided    : false | "manual" | "auto"
  couponCode      : string | ""
  contactStatus   : "미연락" | "통화완료"
  contactedAt     : ISO8601 | ""
  createdAt       : ISO8601
}
```

| Method | Endpoint | 설명 | 현재 메서드 |
| --- | --- | --- | --- |
| POST | `/api/reservations` | 예약 등록 | `addReservation` |
| PATCH | `/api/reservations/:id` | 예약 부분 갱신 | `updateReservation` |
| GET | `/api/reservations` | 예약 전체 목록 | `getReservations` |
| DELETE | `/api/reservations/:id` | 예약 1건 삭제 | `deleteReservation` |
| DELETE | `/api/reservations` | 예약 전체 삭제 (관리자 전용) | — |

---

### 4. 페이지 콘텐츠 (CMS) — `admin-edit.js`
> 관리자가 편집·저장해도 `localStorage`에만 기록되어 실제 방문자에게 반영되지 않음.
저장 대상 섹션: `hero`, `signature`, `event(요금표)`, `doctors`, `info(병원정보)`, `ba(Before&After)`, `footer`, `shorts(YouTube)`

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | `/api/pages/:pageKey/content` | LP 페이지 콘텐츠 불러오기 |
| PUT | `/api/pages/:pageKey/content` | LP 페이지 콘텐츠 저장 |

---

### 5. 갤러리 썸네일 — `gallery-edit.js`
> 카드 썸네일/로고를 base64로 localStorage에 저장

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | `/api/gallery` | 갤러리 카드 썸네일·로고 URL 조회 |
| PUT | `/api/gallery` | 갤러리 카드 썸네일·로고 URL 저장 |

---

### 6. 이미지 업로드 — `admin-edit.js`, `admin.js`
> 이미지를 base64(dataURL)로 읽어 HTML에 그대로 박아 저장 → localStorage 5MB 금방 초과.

| Method | Endpoint | 설명 |
| --- | --- | --- |
| POST | `/api/upload` | 이미지 파일 업로드 → CDN/스토리지 URL 반환 |

---

### 7. 병원 설정 (낮은 우선순위) — `coupon.js` > `LINE_CONFIG`
> 병원별 LINE URL / OA ID가 코드에 하드코딩되어 있음.

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | `/api/hospitals` | 병원별 LINE 설정 조회 |
| PUT | `/api/hospitals/:key` | 병원 LINE 설정 저장 |

---

**교체가 필요한 파일 요약:**

| 파일 | 교체 포인트 |
| --- | --- |
| `coupon.js` | `Store` 객체 전체 (쿠폰·예약), `LINE_CONFIG` |
| `admin.js` | 로그인 인증, 이미지 업로드 |
| `admin-edit.js` | `loadOverride` / `saveOverride`, `pickImage` |
| `gallery-edit.js` | `load` / `save` |
| `reservations.js` | 로그인 인증 |

---

## 전체 구조

| 페이지 | 역할 | 백엔드 의존 데이터 |
| --- | --- | --- |
| `index.html` | 갤러리 + 쿠폰 발급 팝업 | 쿠폰 발급, 갤러리 썸네일 |
| `wooa/kleamH/kleamM/classone/ceramique/lovae` | 랜딩 + LINE 예약 모달 | 예약 접수, 쿠폰 검증, 콘텐츠 오버라이드 |
| `admin.html` | 관리자 로그인 + 편집 진입 | 인증, 콘텐츠/썸네일 편집 |
| `reservations.html` | 예약·쿠폰 명단 | 예약/쿠폰 조회·갱신·통계 |

## 현재 사용 중인 localStorage 키 (= 백엔드 전환 대상)

| localStorage 키 | 내용 | 파일 |
| --- | --- | --- |
| `lp_admin_authed` | 관리자 로그인 플래그 | `admin.js`, `reservations.js` |
| `lp_coupons_v1` | 쿠폰 전체 | `coupon.js` |
| `lp_phone_index_v1` | 전화번호→쿠폰코드 (1번호 1발급) | `coupon.js` |
| `lp_reservations_v1` | 예약 명단 | `coupon.js` |
| `lp_override_v1::<페이지키>` | LP 섹션별 콘텐츠 편집본 | `admin-edit.js` |
| `lp_gallery_v1` | 갤러리 카드 썸네일/로고 | `gallery-edit.js` |
| `lp_coupon_hide_today` | 팝업 오늘 하루 안보기 (그대로 둬도 무방) | `coupon.js` |
