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

## 구현된 API

### 인증
```
- `POST /api/auth/login` (비밀번호/계정 → 세션 토큰 또는 httpOnly 쿠키, JWT)
- `POST /api/auth/logout`
- `GET /api/auth/me` (세션 검증)
- 비밀번호 하드코딩 부분 변경
- 아래 **모든 관리자용 API**(예약·쿠폰 확정·콘텐츠 편집)는 이 인증으로 보호
```
| Method | Endpoint | 설명 |
| --- | --- | --- |
| POST | `/api/admin/login` | 어드민 로그인 |

### 콘텐츠
```
admin-edit.js는 각 LP의 섹션(hero / signature / event / doctors / info / ba)을 innerHTML 
통째로 스냅샷( 저장 쇼츠(YouTube), 지도 주소도 포함)해서 lp_override_v1::<페이지키>에
```
| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | `/api/pages/:pageKey/content` | 페이지 콘텐츠 불러오기 |
| PUT | `/api/pages/:pageKey/content` | 페이지 콘텐츠 저장 |
| GET | `/api/gallery` | 갤러리 조회 |
| PUT | `/api/gallery` | 갤러리 저장 |
| GET | `/api/hospitals` | 병원 설정 조회 |

### 예약
```
데이터 모델 (coupon.js): `Reservation { id, name, phone, hospital(페이지키), hospitalName,
              couponUsed(신청 시 입력), couponConfirmed(통화 후 확정),
              couponCode, contactStatus("미연락"|"통화완료"),
              contactedAt, createdAt }`
```
| Method | Endpoint | 설명 |
| --- | --- | --- |
| POST | `/api/reservations` | 예약 등록 |
| PATCH | `/api/reservations/:id` | 예약 갱신 |
| GET | `/api/reservations` | 예약 목록 |
| DELETE | `/api/reservations` | 예약 전체 삭제 |

### 쿠폰
```
coupon.js의 `Store` 객체가 그대로 API 스펙
데이터 모델: `Coupon { code(6자리, O/0/I/1 제외), phone, issuedAt,
         used, usedAt, held, heldAt, hospital, name }`
```
| Method | Endpoint | 설명 |
| --- | --- | --- |
| POST | `/api/coupons` | 쿠폰 발행 |
| GET | `/api/coupons/:code` | 쿠폰 유효성 검사 |
| GET | `/api/coupons` | 쿠폰 목록 |
| POST | `/api/coupons/:code/hold` | 사용 보류 |
| POST | `/api/coupons/:code/confirm` | 사용 확정 |
| POST | `/api/coupons/:code/release` | 보류 해제 |
| DELETE | `/api/coupons` | 쿠폰 전체 삭제 |

### 업로드
| Method | Endpoint | 설명 |
| --- | --- | --- |
| POST | `/api/upload` | 이미지 파일 업로드 |

###### 교체가 필요한 파일 : coupon.js, admin.js, admin-edit.js, gallery-edit.js, reservations.js — 각 파일에 localStorage → fetch() 교체 포인트가 주석으로 표시

## 전체 구조
| 페이지 | 역할 | 백엔드 의존 데이터 |
| --- | --- | --- |
| index.html | 갤러리 + 쿠폰 발급 팝업 | 쿠폰 발급, 갤러리 썸네일 |
| 6개 landing page (`wooa/kleamH/kleamM/classone/ceramique/lovae`) | 랜딩 + LINE 예약 모달 | 예약 접수, 쿠폰 검증, 콘텐츠 오버라이드 |
| admin.html | 관리자 로그인 + 편집 진입 | 인증, 콘텐츠/썸네일 편집 |
| reservations.html | 예약·쿠폰 명단 | 예약/쿠폰 조회·갱신·통계 |

### 현재 사용 중인 저장소 키 (= 백엔드 테이블로 전환 대상):
| localStorage 키 | 내용 | 파일 |
| --- | --- | --- |
| `lp_admin_authed` | 관리자 로그인 플래그 | admin.js, reservations.js |
| `lp_coupons_v1` | 쿠폰 전체 | coupon.js |
| `lp_phone_index_v1` | 전화번호→쿠폰코드 (1번호 1발급) | coupon.js |
| `lp_reservations_v1` | 예약 명단 | coupon.js |
| `lp_override_v1::<페이지키>` | LP 섹션별 콘텐츠 편집본 | admin-edit.js |
| `lp_gallery_v1` | 갤러리 카드 썸네일/로고 | gallery-edit.js |
| `lp_coupon_popup_seen` | 팝업 1회 노출 (sessionStorage, 그대로 둬도 무방) | coupon.js |