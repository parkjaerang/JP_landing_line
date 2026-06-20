/* =============================================================
   coupon.js  —  LINE 최초 한정 5%OFF 쿠폰 + 예약 플로우
   -------------------------------------------------------------
   ・index 페이지 : 쿠폰 수령 팝업(전화번호→6자리 코드 발행)
   ・각 LP 페이지 : LINE 버튼 → 예약 모달(이름/전화/쿠폰 사용)
                    → 쿠폰 검증·사용 처리 → QR + LINE 링크 표시
   ・예약은 localStorage에 기록되며 reservations.html에서 조회 가능
   ・저장은 localStorage만(같은 브라우저 내에서만 유효한 데모)
     ※실제 운영에서는 이 "Store" 계층을 백엔드 API로 교체하세요.
   ============================================================= */
(function () {
  "use strict";

  /* =====================================================================
     ▼▼▼ 병원별 LINE 설정 (관리자: 여기에 실제 값을 입력하세요) ▼▼▼
     - key      : LP 폴더/파일명 (getPageKey 와 일치)
     - name     : 표시 이름
     - lineUrl  : LINE 친구추가 URL   예) https://line.me/R/ti/p/@xxxx
     - oaId     : LINE 공식계정 ID    예) @xxxx
                  (oaId 가 있으면 쿠폰코드가 자동 입력된 메시지를 보낼 수 있음)
     lineUrl / oaId 가 비어 있으면 placeholder QR 이 표시됩니다.
     ===================================================================== */
  /* ★ 백엔드 전환 권장 (병원 설정) / ★ 建议改造为后端（医院配置）
     [KO] 병원별 LINE 정보가 코드에 하드코딩되어 있습니다. 관리자가 화면에서
          수정하려면 설정 조회 API(GET /api/hospitals)로 불러오세요. (우선순위 낮음)
     [CN] 各医院的 LINE 信息硬编码在代码中。若要让管理员在界面修改，
          应通过配置接口(GET /api/hospitals)读取。（优先级较低） */
  var LINE_CONFIG = {
    wooa_LP:      { name: "WOOA",            lineUrl: "", oaId: "" },
    kleamH_LP:    { name: "Kleam 弘大店",     lineUrl: "", oaId: "" },
    kleamM_LP:    { name: "Kleam 明洞店",     lineUrl: "", oaId: "" },
    classone_LP:  { name: "Classone",        lineUrl: "", oaId: "" },
    ceramique_LP: { name: "Ceramique",       lineUrl: "", oaId: "" },
    lovae_LP:     { name: "Lovae",           lineUrl: "", oaId: "" }
  };
  /* ▲▲▲ 설정 끝 ▲▲▲ */

  /* =============================================================
     ★ 백엔드 전환 필요 (쿠폰·예약 데이터) / ★ 需改造为后端（优惠券·预约数据）
     -------------------------------------------------------------
     [KO] 아래 3개 키는 모두 localStorage = "이 브라우저 1대 안"에서만 유효합니다.
          → 고객 휴대폰에서 발행한 쿠폰을 병원 PC에서 검증할 수 없고,
            고객이 넣은 예약이 관리자 화면에 보이지 않습니다(크로스 디바이스 불가).
          → 데이터베이스 + API로 교체해야 실제 운영이 가능합니다.
            쿠폰 테이블 / 전화번호 인덱스 / 예약 테이블로 분리하세요.
     [CN] 下面 3 个键都存在 localStorage = 仅在"这一台浏览器内"有效。
          → 顾客手机上发行的优惠券无法在医院电脑上核验，
            顾客提交的预约也不会出现在管理员界面（无法跨设备）。
          → 必须改为 数据库 + 接口 才能正式上线。
            拆分为 优惠券表 / 电话号索引 / 预约表。
     ============================================================= */
  /* ---- localStorage 키 ---- */
  var K_COUPONS = "lp_coupons_v1";        // { CODE: { code, phone, issuedAt, used, usedAt, held, heldAt, hospital, name } }
  var K_PHONES  = "lp_phone_index_v1";    // { phone: CODE }  전화번호→코드(번호당 1회 발행)
  var K_RESV    = "lp_reservations_v1";   // [ { id, name, phone, hospital, hospitalName, couponUsed(申込), couponConfirmed(確定), couponCode, contactStatus, contactedAt, createdAt } ]

  /* ---- localStorage 헬퍼 ---- */
  function lsGet(k)    { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function jget(k, def){ var r = lsGet(k); if (!r) return def; try { return JSON.parse(r); } catch (e) { return def; } }
  function jset(k, v)  { return lsSet(k, JSON.stringify(v)); }

  /* ---- 페이지 키(예: wooa_LP) ---- */
  function getPageKey() {
    var parts = location.pathname.split("/").filter(Boolean);
    var file = parts[parts.length - 1] || "";
    var key = file.replace(/\.html?$/i, "");
    if (!key || /^index$/i.test(key)) key = parts[parts.length - 2] || key;
    return decodeURIComponent(key);
  }

  /* ---- 전화번호 정규화(숫자만) ---- */
  function normPhone(p) { return String(p || "").replace(/[^0-9]/g, ""); }

  /* ---- 6자리 코드 생성(영문 대문자 + 숫자, 혼동되는 문자 O/0/I/1 제외) ---- */
  function randomCode() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // O,0,I,1 除外
    var s = "";
    var arr = (window.crypto && window.crypto.getRandomValues)
      ? window.crypto.getRandomValues(new Uint32Array(6))
      : null;
    for (var i = 0; i < 6; i++) {
      var r = arr ? arr[i] : Math.floor(Math.random() * 1e9);
      s += chars.charAt(r % chars.length);
    }
    return s;
  }
  function genUniqueCode() {
    var coupons = jget(K_COUPONS, {});
    var code, guard = 0;
    do { code = randomCode(); guard++; }
    while (coupons[code] && guard < 50);  // 기존(사용 완료 포함) 코드와 충돌하지 않도록
    return code;
  }

  /* =====================================================================
     Store : 쿠폰/예약 데이터 접근 계층(★ 백엔드 교체 포인트 / ★ 后端替换点)
     ---------------------------------------------------------------------
     [KO] 이 객체의 각 메서드가 그대로 백엔드 API 엔드포인트 명세가 됩니다.
          내부의 jget/jset(localStorage) 호출만 fetch()로 바꾸면 됩니다.
            issueCoupon     → POST   /api/coupons          (쿠폰 발행)
            validateCoupon  → GET    /api/coupons/:code    (유효성 검사)
            holdCoupon      → POST   /api/coupons/:code/hold     (사용 보류)
            confirmCoupon   → POST   /api/coupons/:code/confirm  (사용 확정)
            releaseCoupon   → POST   /api/coupons/:code/release  (보류 해제)
            addReservation  → POST   /api/reservations     (예약 등록)
            updateReservation → PATCH /api/reservations/:id (예약 갱신)
            getReservations → GET    /api/reservations     (예약 목록)
            getCoupons      → GET    /api/coupons          (쿠폰 목록)
          ※ 코드 발행/검증은 반드시 서버에서 처리해야 위변조를 막을 수 있습니다.
     [CN] 该对象的每个方法即是后端接口规范。只需把内部的
          jget/jset(localStorage) 调用替换为 fetch() 即可：
            issueCoupon     → POST   /api/coupons          (发行优惠券)
            validateCoupon  → GET    /api/coupons/:code    (校验有效性)
            holdCoupon      → POST   /api/coupons/:code/hold     (挂起待用)
            confirmCoupon   → POST   /api/coupons/:code/confirm  (确认使用)
            releaseCoupon   → POST   /api/coupons/:code/release  (释放挂起)
            addReservation  → POST   /api/reservations     (新增预约)
            updateReservation → PATCH /api/reservations/:id (更新预约)
            getReservations → GET    /api/reservations     (预约列表)
            getCoupons      → GET    /api/coupons          (优惠券列表)
          ※ 编码的发行/校验必须在服务器完成，以防伪造。
     ===================================================================== */
  var Store = {
    /* 전화번호로 쿠폰 발행(번호당 1회까지) */
    issueCoupon: function (rawPhone) {
      var phone = normPhone(rawPhone);
      if (phone.length < 8) return { ok: false, reason: "invalid" };
      var phones = jget(K_PHONES, {});
      if (phones[phone]) {
        return { ok: false, reason: "already", code: phones[phone] }; // 이미 발행됨
      }
      var code = genUniqueCode();
      var coupons = jget(K_COUPONS, {});
      coupons[code] = {
        code: code, phone: phone, issuedAt: new Date().toISOString(),
        used: false, usedAt: "", hospital: "", name: ""
      };
      phones[phone] = code;
      jset(K_COUPONS, coupons);
      jset(K_PHONES, phones);
      return { ok: true, code: code };
    },

    /* 코드 유효성 검사 */
    validateCoupon: function (rawCode) {
      var code = String(rawCode || "").trim().toUpperCase();
      if (!code) return { valid: false, reason: "empty" };
      var coupons = jget(K_COUPONS, {});
      var c = coupons[code];
      if (!c) return { valid: false, reason: "notfound" };
      if (c.used) return { valid: false, reason: "used" };
      return { valid: true, code: code };
    },

    /* 코드를 사용 완료로 처리(즉시 확정. 레거시용으로 잔존) */
    redeemCoupon: function (rawCode, info) {
      var code = String(rawCode || "").trim().toUpperCase();
      var coupons = jget(K_COUPONS, {});
      var c = coupons[code];
      if (!c || c.used) return false;
      c.used = true;
      c.usedAt = new Date().toISOString();
      c.hospital = (info && info.hospital) || "";
      c.name = (info && info.name) || "";
      jset(K_COUPONS, coupons);
      return true;
    },

    /* 예약 폼 전송 시: 쿠폰을 "보류(held)" 상태로 둔다(아직 사용 확정 안 함) */
    holdCoupon: function (rawCode, info) {
      var code = String(rawCode || "").trim().toUpperCase();
      var coupons = jget(K_COUPONS, {});
      var c = coupons[code];
      if (!c || c.used) return false;
      c.held = true;
      c.heldAt = new Date().toISOString();
      if (info && info.hospital) c.hospital = info.hospital;
      if (info && info.name) c.name = info.name;
      jset(K_COUPONS, coupons);
      return true;
    },

    /* 관리자가 "통화 완료"를 체크 → 쿠폰 사용 확정 */
    confirmCoupon: function (rawCode, info) {
      var code = String(rawCode || "").trim().toUpperCase();
      var coupons = jget(K_COUPONS, {});
      var c = coupons[code];
      if (!c) return false;
      c.used = true;
      c.held = false;
      c.usedAt = new Date().toISOString();
      if (info && info.hospital) c.hospital = info.hospital;
      if (info && info.name) c.name = info.name;
      jset(K_COUPONS, coupons);
      return true;
    },

    /* "통화 완료" 취소 → 쿠폰을 보류로 되돌림(다시 사용 가능 상태로) */
    releaseCoupon: function (rawCode) {
      var code = String(rawCode || "").trim().toUpperCase();
      var coupons = jget(K_COUPONS, {});
      var c = coupons[code];
      if (!c) return false;
      c.used = false;
      c.usedAt = "";
      c.held = true;
      jset(K_COUPONS, coupons);
      return true;
    },

    /* 예약을 기록(id를 부여해 반환) */
    addReservation: function (rec) {
      var list = jget(K_RESV, []);
      if (!rec.id) {
        rec.id = (rec.createdAt || new Date().toISOString()) + "-" +
                 Math.random().toString(36).slice(2, 8);
      }
      list.push(rec);
      jset(K_RESV, list);
      return rec;
    },

    /* 예약 레코드를 id로 부분 갱신 */
    updateReservation: function (id, patch) {
      var list = jget(K_RESV, []);
      var changed = false;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) {
          for (var k in patch) { if (patch.hasOwnProperty(k)) list[i][k] = patch[k]; }
          changed = true;
          break;
        }
      }
      if (changed) jset(K_RESV, list);
      return changed;
    },

    /* 예약 레코드를 id로 삭제 */
    deleteReservation: function (id) {
      var list = jget(K_RESV, []);
      var next = list.filter(function (r) { return r.id !== id; });
      if (next.length === list.length) return false;
      jset(K_RESV, next);
      return true;
    },

    getReservations: function () { return jget(K_RESV, []); },
    getCoupons: function () {
      var obj = jget(K_COUPONS, {});
      return Object.keys(obj).map(function (k) { return obj[k]; });
    }
  };

  /* ---- QR 이미지 URL(qrserver API로 텍스트/URL을 QR로 변환) ---- */
  function qrImageUrl(data, size) {
    var s = size || 220;
    return "https://api.qrserver.com/v1/create-qr-code/?size=" + s + "x" + s +
           "&margin=8&data=" + encodeURIComponent(data || "LINE設定待ち");
  }

  /* ---- LINE 메시지 전송 URL(oaId가 있으면 코드를 자동 입력) ---- */
  function buildLineUrl(cfg, prefillText) {
    if (cfg && cfg.oaId && prefillText) {
      return "https://line.me/R/oaMessage/" + encodeURIComponent(cfg.oaId) +
             "/?" + encodeURIComponent(prefillText);
    }
    if (cfg && cfg.lineUrl) return cfg.lineUrl;
    return "";
  }

  /* =====================================================================
     스타일 주입
     ===================================================================== */
  function injectStyle() {
    if (document.getElementById("lp-coupon-style")) return;
    var s = document.createElement("style");
    s.id = "lp-coupon-style";
    s.textContent =
      ".cp-mask{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(15,18,24,.55);backdrop-filter:blur(4px);padding:18px;" +
      "font-family:system-ui,-apple-system,'Segoe UI','Noto Sans JP',sans-serif}" +
      ".cp-box{background:#fff;border-radius:18px;width:min(94vw,380px);max-height:90vh;overflow:auto;" +
      "padding:26px 24px 22px;box-shadow:0 24px 70px rgba(0,0,0,.35);position:relative;text-align:center}" +
      ".cp-close{position:absolute;top:12px;right:14px;border:0;background:transparent;font-size:22px;" +
      "line-height:1;color:#9aa0a6;cursor:pointer}" +
      ".cp-badge{display:inline-block;background:#06c755;color:#fff;font-size:12px;font-weight:700;" +
      "padding:5px 12px;border-radius:999px;margin-bottom:12px}" +
      ".cp-box h3{font-size:19px;color:#1a1c1f;margin:0 0 6px;line-height:1.4}" +
      ".cp-box h3 b{color:#06c755}" +
      ".cp-box p.cp-sub{font-size:13px;color:#6b7077;margin:0 0 18px;line-height:1.6}" +
      ".cp-field{text-align:left;margin-bottom:12px}" +
      ".cp-field label{display:block;font-size:12px;font-weight:700;color:#3a3d42;margin-bottom:5px}" +
      ".cp-field input{width:100%;padding:12px;border:1px solid #d8dadf;border-radius:10px;font-size:15px;box-sizing:border-box}" +
      ".cp-field input:focus{outline:2px solid #06c755;border-color:transparent}" +
      ".cp-toggle{display:flex;gap:8px;margin-bottom:14px}" +
      ".cp-toggle button{flex:1;padding:11px;border:1px solid #d8dadf;border-radius:10px;background:#fff;" +
      "font-size:14px;font-weight:700;color:#3a3d42;cursor:pointer}" +
      ".cp-toggle button.on{background:#06c755;border-color:#06c755;color:#fff}" +
      ".cp-btn{width:100%;padding:13px;border:0;border-radius:10px;background:#06c755;color:#fff;" +
      "font-size:15px;font-weight:700;cursor:pointer;margin-top:4px}" +
      ".cp-btn.alt{background:#1a1c1f}" +
      ".cp-btn[disabled]{opacity:.5;cursor:not-allowed}" +
      ".cp-err{color:#e8553b;font-size:12.5px;margin:8px 0 0;min-height:15px;text-align:left}" +
      ".cp-code{font-size:30px;font-weight:800;letter-spacing:4px;color:#1a1c1f;background:#f1f5f2;" +
      "border:2px dashed #06c755;border-radius:12px;padding:16px;margin:6px 0 4px}" +
      ".cp-note{font-size:9px;color:#9aa0a6;margin-top:14px;line-height:1.6}" +
      ".cp-qr{width:200px;height:200px;margin:8px auto 4px;display:block;border-radius:10px}" +
      ".cp-tag{display:inline-block;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;margin-bottom:10px}" +
      ".cp-tag.use{background:#e6f7ee;color:#06a047}" +
      ".cp-tag.no{background:#eef0f3;color:#6b7077}" +
      ".cp-hide-today{display:block;margin:14px auto 0;border:0;background:transparent;color:#9aa0a6;" +
      "font-size:12px;text-decoration:underline;cursor:pointer;font-family:inherit}" +
      // index 우측 하단 재표시 버튼
      ".cp-fab{position:fixed;right:16px;bottom:16px;z-index:9000;background:#06c755;color:#fff;border:0;" +
      "border-radius:999px;padding:12px 18px;font-size:14px;font-weight:700;cursor:pointer;" +
      "box-shadow:0 6px 20px rgba(6,199,85,.4);font-family:system-ui,sans-serif}";
    document.head.appendChild(s);
  }

  /* ---- 모달 베이스 ---- */
  function openModal(buildInner) {
    injectStyle();
    var mask = document.createElement("div");
    mask.className = "cp-mask";
    var box = document.createElement("div");
    box.className = "cp-box";
    box.innerHTML = "<button class='cp-close' aria-label='close'>&times;</button>";
    mask.appendChild(box);
    document.body.appendChild(mask);

    function close() { mask.remove(); }
    box.querySelector(".cp-close").addEventListener("click", close);
    mask.addEventListener("click", function (e) { if (e.target === mask) close(); });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
    });

    var content = document.createElement("div");
    box.appendChild(content);
    buildInner(content, close, box);
    return { mask: mask, box: box, content: content, close: close };
  }

  /* =====================================================================
     ① index 페이지 : 쿠폰 수령 팝업
     ===================================================================== */
  function couponIssueView(content, close, hideToday) {
    content.innerHTML =
      "<span class='cp-badge'>初回限定</span>" +
      "<h3>このページから LINE で予約すると<br><b>5％OFF</b> クーポンプレゼント</h3>" +
      "<p class='cp-sub'>電話番号を入力するとクーポンコードを発行します。<br>" +
      "クーポンは<b>お一人様1回・1院のみ</b>ご利用いただけます。</p>" +
      "<div class='cp-field'><label>電話番号</label>" +
      "<input type='tel' id='cp-phone' inputmode='numeric' placeholder='' autocomplete='tel'></div>" +
      "<button class='cp-btn' id='cp-issue'>クーポンを受け取る</button>" +
      "<p class='cp-err' id='cp-err'></p>" +
      "<p class='cp-note'>※ 発行されたコードは、各病院ページの LINE 予約時にご入力ください。<br>" +
      "※ コードを忘れた場合は、同じ電話番号を再入力すると再確認できます。</p>" +
      (hideToday ? "<button type='button' class='cp-hide-today' id='cp-hide-today'>今日は表示しない</button>" : "");

    var phone = content.querySelector("#cp-phone");
    var err = content.querySelector("#cp-err");
    phone.focus();

    var hideBtn = content.querySelector("#cp-hide-today");
    if (hideBtn) hideBtn.addEventListener("click", function () { hideToday(); close(); });

    function doIssue() {
      err.textContent = "";
      var res = Store.issueCoupon(phone.value);
      if (res.ok) { couponResultView(content, res.code, false); return; }
      if (res.reason === "invalid") { err.textContent = "正しい電話番号を入力してください。"; return; }
      if (res.reason === "already") { couponResultView(content, res.code, true); return; }
      err.textContent = "発行に失敗しました。";
    }
    content.querySelector("#cp-issue").addEventListener("click", doIssue);
    phone.addEventListener("keydown", function (e) { if (e.key === "Enter") doIssue(); });
  }

  function couponResultView(content, code, already) {
    content.innerHTML =
      "<span class='cp-badge'>" + (already ? "発行済みクーポン" : "クーポン発行完了") + "</span>" +
      "<h3>" + (already ? "すでに発行されています" : "5％OFF クーポン") + "</h3>" +
      "<p class='cp-sub'>" + (already
        ? "この電話番号には下記のコードが発行済みです。"
        : "下記コードを病院ページの LINE 予約時にご入力ください。") + "</p>" +
      "<div class='cp-code'>" + code + "</div>" +
      "<button class='cp-btn' id='cp-copy'>コードをコピー</button>" +
      "<p class='cp-note'>※クーポンはお一人様1回・1院のみご利用いただけます。<br>" +
      "コードは大切に保管してください。</p>";
    content.querySelector("#cp-copy").addEventListener("click", function () {
      var btn = this;
      function done() { btn.textContent = "✓ コピーしました"; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(done, done);
      } else { done(); }
    });
  }

  function initIndexPopup() {
    var HIDE_KEY = "lp_coupon_hide_today";   // "오늘 하루 안보기" 누른 날짜(YYYY-M-D)

    function todayStr() {
      var d = new Date();
      return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    }
    function hiddenToday() {
      try { return localStorage.getItem(HIDE_KEY) === todayStr(); } catch (e) { return false; }
    }
    function hideToday() {
      try { localStorage.setItem(HIDE_KEY, todayStr()); } catch (e) {}
    }

    // 닫아도 매번 자동 표시. 단 "今日は表示しない"를 누른 당일은 제외
    function show() {
      openModal(function (content, close) { couponIssueView(content, close, hideToday); });
    }

    if (!hiddenToday()) {
      setTimeout(show, 700);
    }

    // 헤더의 5%OFF 배너 클릭 시 재표시
    var banner = document.querySelector(".discount");
    if (banner) { banner.style.cursor = "pointer"; banner.addEventListener("click", show); }

    // 우측 하단 상시 버튼
    injectStyle();
    var fab = document.createElement("button");
    fab.className = "cp-fab";
    fab.type = "button";
    fab.innerHTML = "🎟 5%OFFクーポン";
    fab.addEventListener("click", show);
    document.body.appendChild(fab);
  }

  /* =====================================================================
     ② 각 LP 페이지 : LINE 버튼 → 예약 모달
     ===================================================================== */
  function reservationView(content, close, pageKey, cfg) {
    var useCoupon = false;
    content.innerHTML =
      "<span class='cp-badge'>LINE 予約</span>" +
      "<h3>" + cfg.name + " へ LINE で予約</h3>" +
      "<p class='cp-sub'>お名前と電話番号をご入力ください。<br>" +
      "初回限定 <b>5％OFF</b> クーポンをお持ちの方はご利用いただけます。</p>" +
      "<div class='cp-field'><label>お名前</label>" +
      "<input type='text' id='cp-name' placeholder='' autocomplete='name'></div>" +
      "<div class='cp-field'><label>電話番号</label>" +
      "<input type='tel' id='cp-phone' inputmode='numeric' placeholder='' autocomplete='tel'></div>" +
      "<label style='display:block;text-align:left;font-size:12px;font-weight:700;color:#3a3d42;margin-bottom:5px'>" +
      "クーポンを使用しますか？</label>" +
      "<div class='cp-toggle'>" +
      "<button type='button' id='cp-use'>使用する</button>" +
      "<button type='button' id='cp-nouse' class='on'>使用しない</button></div>" +
      "<div class='cp-field' id='cp-code-wrap' style='display:none'><label>クーポンコード(6桁)</label>" +
      "<input type='text' id='cp-code' maxlength='6' placeholder='ABC234' style='text-transform:uppercase'></div>" +
      "<button class='cp-btn' id='cp-go'>LINE で予約に進む</button>" +
      "<p class='cp-err' id='cp-err'></p>";

    var btnUse = content.querySelector("#cp-use");
    var btnNo = content.querySelector("#cp-nouse");
    var codeWrap = content.querySelector("#cp-code-wrap");
    var err = content.querySelector("#cp-err");

    btnUse.addEventListener("click", function () {
      useCoupon = true; btnUse.classList.add("on"); btnNo.classList.remove("on");
      codeWrap.style.display = ""; content.querySelector("#cp-code").focus();
    });
    btnNo.addEventListener("click", function () {
      useCoupon = false; btnNo.classList.add("on"); btnUse.classList.remove("on");
      codeWrap.style.display = "none";
    });

    content.querySelector("#cp-go").addEventListener("click", function () {
      err.textContent = "";
      var name = content.querySelector("#cp-name").value.trim();
      var phone = normPhone(content.querySelector("#cp-phone").value);
      var codeInput = content.querySelector("#cp-code");
      var code = codeInput ? codeInput.value.trim().toUpperCase() : "";

      if (!name) { err.textContent = "お名前を入力してください。"; return; }
      if (phone.length < 8) { err.textContent = "正しい電話番号を入力してください。"; return; }

      if (useCoupon) {
        var v = Store.validateCoupon(code);
        if (!v.valid) {
          err.textContent =
            v.reason === "used"    ? "このクーポンは既に使用済みです。" :
            v.reason === "notfound"? "クーポンコードが見つかりません。" :
                                     "クーポンコードを入力してください。";
          return;
        }
        // ★ 여기서는 사용 확정하지 않는다. LINE 연락 완료까지 "보류"로 둔다
        Store.holdCoupon(code, { hospital: pageKey, name: name });
      }

      // 예약을 기록(couponConfirmed는 관리자의 "통화 완료" 체크로 true가 된다)
      Store.addReservation({
        name: name, phone: phone,
        hospital: pageKey, hospitalName: cfg.name,
        couponUsed: !!useCoupon,        // 신청 시 쿠폰을 입력했는지
        couponConfirmed: false,         // 실제로 사용 확정됐는지(LINE 연락 후)
        couponCode: useCoupon ? code : "",
        contactStatus: "미연락",         // 미연락 | 통화완료
        contactedAt: "",
        createdAt: new Date().toISOString()
      });

      reservationDoneView(content, close, cfg, {
        name: name, useCoupon: useCoupon, code: code
      });
    });
  }

  function reservationDoneView(content, close, cfg, info) {
    var prefill = "【LINE予約】\n病院: " + cfg.name + "\nお名前: " + info.name +
      (info.useCoupon ? "\nクーポン: " + info.code + "(初回5%OFF適用)" : "\nクーポン: 利用なし");
    var lineUrl = buildLineUrl(cfg, prefill);
    var qrData = lineUrl || ("LINE設定待ち / " + cfg.name);

    content.innerHTML =
      "<span class='cp-badge'>予約受付</span>" +
      "<span class='cp-tag " + (info.useCoupon ? "use" : "no") + "'>" +
        (info.useCoupon ? "🎟 5%OFFクーポン適用 (" + info.code + ")" : "クーポン利用なし") + "</span>" +
      "<h3>LINE で予約を完了してください</h3>" +
      "<p class='cp-sub'>下記の QR コードを読み取るか、ボタンから LINE を開いてください。<br>" +
      "メッセージにお名前" + (info.useCoupon ? "・クーポンコード" : "") + "が入力されます。</p>" +
      "<img class='cp-qr' src='" + qrImageUrl(qrData, 220) + "' alt='LINE QR'>" +
      (lineUrl
        ? "<a class='cp-btn' href='" + lineUrl + "' target='_blank' rel='noopener' style='display:block;text-decoration:none;box-sizing:border-box'>LINE を開く</a>"
        : "<button class='cp-btn' disabled>LINE 未設定(管理者へ連絡)</button>") +
      "<p class='cp-note'>" +
        (lineUrl ? "" : "※この病院の LINE 設定がまだのため QR はプレースホルダです。<br>") +
        "ご予約ありがとうございます。担当者がご対応いたします。</p>";
  }

  function initLPButtons() {
    var pageKey = getPageKey();
    var cfg = LINE_CONFIG[pageKey] || { name: pageKey, lineUrl: "", oaId: "" };
    var btns = document.querySelectorAll(".line_btn");
    if (!btns.length) return;
    btns.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        openModal(function (content, close) { reservationView(content, close, pageKey, cfg); });
      });
      // 내부 <a href="#">의 기본 이동도 막는다
      var a = btn.querySelector("a");
      if (a) a.addEventListener("click", function (e) { e.preventDefault(); });
    });
  }

  /* ---- 공개 API(reservations.html에서 사용) ---- */
  window.LPCoupon = {
    Store: Store,
    LINE_CONFIG: LINE_CONFIG,
    normPhone: normPhone
  };

  /* =====================================================================
     초기화
     ===================================================================== */
  document.addEventListener("DOMContentLoaded", function () {
    if (document.querySelector(".line_btn")) {
      initLPButtons();                          // LP 페이지
    } else if (document.body.hasAttribute("data-coupon-popup")) {
      initIndexPopup();                         // index 페이지
    }
  });
})();
