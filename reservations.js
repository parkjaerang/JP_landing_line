/* =============================================================
   reservations.js  —  예약 명단(reservations.html)
   - admin과 동일한 비밀번호로 보호(lp_admin_authed)
   - LPCoupon.Store에서 예약 / 쿠폰 데이터를 읽어와 표시
   ============================================================= */
(function () {
  "use strict";

  /* ★ 백엔드 전환 필요 (인증) / ★ 需改造为后端（认证）
     [KO] admin.js와 동일하게 비밀번호가 평문 노출. 서버 로그인 API로 교체하고,
          예약 명단(개인정보)은 인증된 요청에만 GET /api/reservations 로 제공하세요.
     [CN] 与 admin.js 一样密码明文暴露。应改为服务器登录接口，
          预约名单(个人信息)仅对已认证请求通过 GET /api/reservations 返回。 */
  var ADMIN_PASSWORD = "admin1234";   // admin.js와 동일한 비밀번호
  var AUTH_KEY = "lp_admin_authed";

  /* 편집 UI 한국어/일본어 전환(admin-i18n.js). 미로드 시 원문 그대로 반환 */
  function tr(s) { return window.LPI18n ? window.LPI18n.t(s) : s; }

  function authed() { try { return localStorage.getItem(AUTH_KEY) === "1"; } catch (e) { return false; } }
  function setAuthed(v) { try { v ? localStorage.setItem(AUTH_KEY, "1") : localStorage.removeItem(AUTH_KEY); } catch (e) {} }

  var Store = (window.LPCoupon && window.LPCoupon.Store) || null;
  var CFG = (window.LPCoupon && window.LPCoupon.LINE_CONFIG) || {};
  var currentTab = "resv";

  /* 쿠폰의 hospital(페이지키)을 예약과 동일한 표시명으로 변환 */
  function couponHospName(c) {
    return (CFG[c.hospital] && CFG[c.hospital].name) || c.hospital || "";
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (window.LPI18n) window.LPI18n.applyStatic();   // 정적 한국어 → 선택 언어로 교체
    setupLangButton();
    if (authed()) { enter(); } else { showGate(); }
    document.getElementById("rv-logout").addEventListener("click", function () {
      setAuthed(false); location.href = "./admin.html";
    });
  });

  /* 언어 전환 버튼(🌐) : 현재 언어에 맞는 라벨 표시 + 클릭 시 전환 */
  function setupLangButton() {
    var sel = document.getElementById("rv-lang");
    if (!sel) return;
    if (window.LPI18n) sel.innerHTML = window.LPI18n.langOptions();
    sel.addEventListener("change", function () {
      if (window.LPI18n) window.LPI18n.setLang(this.value);
    });
  }

  /* ---- 로그인 게이트 ---- */
  function showGate() {
    var gate = document.createElement("div");
    gate.className = "rv-gate";
    gate.innerHTML =
      "<div class='rv-gate-box'>" +
      "<select id='rv-gate-lang' class='rv-gate-lang'>" + (window.LPI18n ? window.LPI18n.langOptions() : "") + "</select>" +
      "<h2>" + tr("예약 명단 로그인") + "</h2><p>" + tr("비밀번호를 입력하세요") + "</p>" +
      "<input type='password' id='rv-pw' placeholder='" + tr("비밀번호") + "'>" +
      "<button id='rv-login'>" + tr("로그인") + "</button>" +
      "<p class='rv-gate-err' id='rv-pw-err'></p></div>";
    document.body.appendChild(gate);
    gate.querySelector("#rv-gate-lang").addEventListener("change", function () {
      if (window.LPI18n) window.LPI18n.setLang(this.value);   // 선택 → 새로고침 → 게이트가 새 언어로 재렌더링
    });
    var pw = gate.querySelector("#rv-pw");
    var err = gate.querySelector("#rv-pw-err");
    function tryLogin() {
      if (pw.value === ADMIN_PASSWORD) { setAuthed(true); gate.remove(); enter(); }
      else { err.textContent = tr("비밀번호가 올바르지 않습니다"); pw.value = ""; pw.focus(); }
    }
    gate.querySelector("#rv-login").addEventListener("click", tryLogin);
    pw.addEventListener("keydown", function (e) { if (e.key === "Enter") tryLogin(); });
    pw.focus();
  }

  /* ---- 메인 ---- */
  function enter() {
    document.getElementById("rv-app").hidden = false;
    migrate();   // 옛 데이터에 id / 연락 상태 등 필드를 보완

    document.querySelectorAll(".tab-sub button").forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll(".tab-sub button").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        currentTab = b.getAttribute("data-tab");
        render();
      });
    });
    document.getElementById("rv-search").addEventListener("input", render);
    buildHospitalOptions();
    document.getElementById("rv-hospital").addEventListener("change", render);
    document.getElementById("rv-status").addEventListener("change", render);
    document.getElementById("rv-csv").addEventListener("click", downloadCsv);
    document.getElementById("rv-clear").addEventListener("click", function () {
      if (!confirm(tr("모든 예약·쿠폰 데이터를 삭제합니다. 계속하시겠습니까?"))) return;
      /* ★ 백엔드 전환 필요 / ★ 需改造为后端
         [KO] localStorage 일괄 삭제 → 서버 데이터 삭제 API(DELETE /api/reservations,
              DELETE /api/coupons)로 교체. 운영에서는 전체 삭제 대신 권한·감사로그 필요.
         [CN] 清空 localStorage → 改为服务器删除接口(DELETE /api/reservations,
              DELETE /api/coupons)。生产环境应配合权限控制与审计日志，避免整表清空。 */
      try {
        localStorage.removeItem("lp_reservations_v1");
        localStorage.removeItem("lp_coupons_v1");
        localStorage.removeItem("lp_phone_index_v1");
      } catch (e) {}
      buildHospitalOptions();
      render();
    });
    // 연락 상태 토글 / 쿠폰 사용 취소(이벤트 위임)
    document.getElementById("rv-table").addEventListener("click", function (e) {
      if (!e.target.closest) return;
      var cstat = e.target.closest("button.cstat");
      if (cstat) { toggleContact(cstat.getAttribute("data-id")); return; }
      var cvoid = e.target.closest("button.cvoid");
      if (cvoid) { toggleCouponVoid(cvoid.getAttribute("data-id")); return; }
      var rdel = e.target.closest("button.rdel");
      if (rdel) { deleteReservation(rdel.getAttribute("data-id")); return; }
    });
    render();
  }

  /* ---- 옛 데이터 마이그레이션(id・연락 상태・쿠폰 확정 플래그 보완) ---- */
  function migrate() {
    if (!Store) return;
    var list = Store.getReservations();
    var byCode = {};
    getCoupons().forEach(function (c) { byCode[c.code] = c; });
    var changed = false;
    list.forEach(function (r) {
      if (!r.id) {
        r.id = (r.createdAt || "") + "-" + Math.random().toString(36).slice(2, 8);
        changed = true;
      }
      if (r.contactStatus === undefined) { r.contactStatus = "미연락"; changed = true; }
      if (r.contactedAt === undefined) { r.contactedAt = ""; changed = true; }
      if (r.couponConfirmed === undefined) {
        // 옛 플로우(전송 시 즉시 redeem)에서 이미 사용 완료된 것은 확정 처리한다
        var c = r.couponCode ? byCode[r.couponCode] : null;
        r.couponConfirmed = !!(r.couponUsed && c && c.used);
        changed = true;
      }
      // 쿠폰 사용 취소 상태: false | "manual"(관리자 수동 취소) | "auto"(타 병원 사용으로 자동 처리)
      if (r.couponVoided === undefined) { r.couponVoided = false; changed = true; }
    });
    if (changed) { try { localStorage.setItem("lp_reservations_v1", JSON.stringify(list)); } catch (e) {} }
  }

  /* ---- 연락 상태 전환(클릭 토글) ---- */
  function toggleContact(id) {
    var list = Store.getReservations();
    var r = null;
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { r = list[i]; break; } }
    if (!r) return;
    var done = r.contactStatus === "통화완료";
    if (!done) {
      // 미연락 → 통화완료: 쿠폰이 있고 사용 취소되지 않았으면 사용 확정
      // (수동으로 '사용 안함' 처리한 건은 통화완료 후에도 그대로 유지)
      var patch = { contactStatus: "통화완료", contactedAt: new Date().toISOString() };
      if (r.couponCode && !r.couponConfirmed && !r.couponVoided) {
        Store.confirmCoupon(r.couponCode, { hospital: r.hospital, name: r.name });
        patch.couponConfirmed = true;
      }
      Store.updateReservation(id, patch);
      // ★ 실제로 사용 확정된 경우에만 같은 쿠폰을 쓴 다른 "사용 예정" 예약을 자동 "사용 안함" 처리(쿠폰은 1인 1회·1院)
      if (r.couponCode && patch.couponConfirmed) voidOtherPending(r.couponCode, id);
    } else {
      // 통화완료 → 미연락: 쿠폰을 사용 전으로 되돌림
      if (r.couponCode && r.couponConfirmed &&
          !confirm(tr("통화완료를 취소하면 이 예약의 쿠폰 사용도 취소되어 다시 사용 가능 상태로 돌아갑니다. 계속하시겠습니까?"))) {
        return;
      }
      var patch2 = { contactStatus: "미연락", contactedAt: "" };
      if (r.couponCode && r.couponConfirmed) {
        Store.releaseCoupon(r.couponCode);
        patch2.couponConfirmed = false;
      }
      Store.updateReservation(id, patch2);
      // ★ 자동으로 "사용 안함" 처리됐던 다른 예약을 "사용 예정"으로 복원
      if (r.couponCode) restoreAutoVoided(r.couponCode, id);
    }
    render();
  }

  /* 같은 쿠폰 코드를 쓴 다른 "사용 예정" 예약을 "사용 안함(auto)"으로 자동 변경 */
  function voidOtherPending(code, exceptId) {
    Store.getReservations().forEach(function (o) {
      if (o.id !== exceptId && o.couponCode === code && !o.couponConfirmed && !o.couponVoided) {
        Store.updateReservation(o.id, { couponVoided: "auto" });
      }
    });
  }

  /* 자동(auto)으로 취소됐던 예약을 다시 "사용 예정"으로 복원(통화완료 취소 시) */
  function restoreAutoVoided(code, exceptId) {
    Store.getReservations().forEach(function (o) {
      if (o.id !== exceptId && o.couponCode === code && o.couponVoided === "auto") {
        Store.updateReservation(o.id, { couponVoided: false });
      }
    });
  }

  /* 같은 코드가 다른 예약에서 (취소되지 않고) 실제로 사용 확정됐는지 */
  function couponConfirmedElsewhere(code, exceptId) {
    var list = Store.getReservations();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== exceptId && list[i].couponCode === code &&
          list[i].couponConfirmed && !list[i].couponVoided) return true;
    }
    return false;
  }

  /* ---- 쿠폰 사용 취소 / 되돌리기 (사용 예정·사용 확정 ⇄ 사용 안함, 수동) ---- */
  function toggleCouponVoid(id) {
    var list = Store.getReservations();
    var r = null;
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { r = list[i]; break; } }
    if (!r || !r.couponCode) return;
    if (r.couponVoided === "auto") return; // 타 병원 사용으로 자동 처리된 건 수동 변경 불가

    if (!r.couponVoided) {
      // 사용 중(사용 예정 또는 통화완료·사용 확정) → 사용 안함(수동 취소)
      if (!confirm(tr("이 예약의 쿠폰 사용을 취소하고 '사용 안함'으로 변경하시겠습니까?"))) return;
      Store.updateReservation(id, { couponVoided: "manual" });
      if (r.couponConfirmed) {
        // 확정 상태였으면 쿠폰을 사용 해제 + 같은 코드의 자동 취소건을 사용 예정으로 복원
        Store.releaseCoupon(r.couponCode);
        restoreAutoVoided(r.couponCode, id);
      }
    } else {
      // 사용 안함(수동) → 되돌리기. 단, 같은 코드가 이미 타 병원에서 사용 중이면 불가
      if (couponConfirmedElsewhere(r.couponCode, id)) {
        alert(tr("이 쿠폰은 이미 다른 병원에서 사용되어 되돌릴 수 없습니다."));
        return;
      }
      Store.updateReservation(id, { couponVoided: false });
      if (r.couponConfirmed) {
        // 확정 상태로 되돌리는 경우: 쿠폰을 다시 사용 확정 + 같은 코드의 다른 예정건 자동 취소
        Store.confirmCoupon(r.couponCode, { hospital: r.hospital, name: r.name });
        voidOtherPending(r.couponCode, id);
      }
    }
    render();
  }

  /* ---- 예약 삭제 ---- */
  function deleteReservation(id) {
    var list = Store.getReservations();
    var r = null;
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { r = list[i]; break; } }
    if (!r) return;
    if (!confirm(tr("이 예약을 삭제하시겠습니까? 되돌릴 수 없습니다."))) return;
    // 사용 확정된 쿠폰이 있으면 해제하고, 자동 취소됐던 다른 예약을 복원
    if (r.couponCode && r.couponConfirmed && !r.couponVoided) {
      Store.releaseCoupon(r.couponCode);
      restoreAutoVoided(r.couponCode, id);
    }
    Store.deleteReservation(id);
    buildHospitalOptions();
    render();
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "/" + p(d.getMonth() + 1) + "/" + p(d.getDate()) +
           " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function fmtDateLines(iso) {
    var s = fmtDate(iso);
    if (!s) return "";
    var parts = s.split(" ");
    if (parts.length < 2) return esc(s);
    return "<span>" + esc(parts[0]) + '/' + esc(parts[1]) + "</span>";
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function getResv() {
    var list = Store ? Store.getReservations() : [];
    return list.slice().sort(function (a, b) {
      return (a.createdAt || "").localeCompare(b.createdAt || "");   // 먼저 등록된 순(오래된 순)
    });
  }
  function getCoupons() {
    var list = Store ? Store.getCoupons() : [];
    return list.slice().sort(function (a, b) {
      return (b.issuedAt || "").localeCompare(a.issuedAt || "");
    });
  }

  function filterText() { return (document.getElementById("rv-search").value || "").trim().toLowerCase(); }
  function filterHospital() { var el = document.getElementById("rv-hospital"); return el ? el.value : ""; }
  function filterStatus() { var el = document.getElementById("rv-status"); return el ? el.value : ""; }
  function hospName(r) { return r.hospitalName || r.hospital || ""; }

  /* 병원명 표시(HTML): Kleam 지점명(弘大店 / 明洞店)만 작게·진한 회색으로 */
  function hospNameHtml(r) {
    return esc(hospName(r)).replace(/(弘大店|明洞店)/g, "<span class='hosp-branch'>$1</span>");
  }

  /* 병원 드롭다운 옵션을 데이터에서 동적 생성 */
  function buildHospitalOptions() {
    var sel = document.getElementById("rv-hospital");
    if (!sel) return;
    var names = {};
    getResv().forEach(function (r) { var n = hospName(r); if (n) names[n] = true; });
    getCoupons().forEach(function (c) { var n = couponHospName(c); if (n) names[n] = true; });
    var keys = Object.keys(names).sort();
    var cur = sel.value;
    sel.innerHTML = "<option value=''>" + tr("전체 병원") + "</option>" +
      keys.map(function (n) { return "<option value='" + esc(n) + "'>" + esc(n) + "</option>"; }).join("");
    sel.value = cur;   // 갱신 후 선택값 유지
  }

  function render() {
    renderStats();
    if (currentTab === "resv") renderResv(); else renderCoupons();
  }

  function renderStats() {
    var resv = getResv();
    var coupons = getCoupons();
    var noContact = resv.filter(function (r) { return r.contactStatus !== "통화완료"; }).length;
    var pending = resv.filter(function (r) { return r.couponCode && !r.couponConfirmed && !r.couponVoided; }).length;
    var confirmed = resv.filter(function (r) { return r.couponConfirmed && !r.couponVoided; }).length;
    var box = document.getElementById("rv-stats");
    box.innerHTML =
      stat(resv.length, tr("예약 합계")) +
      stat(noContact, tr("미연락")) +
      stat(pending, tr("쿠폰 사용 예정")) +
      stat(confirmed, tr("쿠폰 사용 확정")) +
      stat(coupons.length, tr("쿠폰 발급"));
  }
  function stat(n, l) { return "<div class='rv-stat'><div class='n'>" + n + "</div><div class='l'>" + l + "</div></div>"; }

  function renderResv() {
    var q = filterText(), hsp = filterHospital(), st = filterStatus();
    var rows = getResv().filter(function (r) {
      if (hsp && hospName(r) !== hsp) return false;
      if (st && (r.contactStatus || "미연락") !== st) return false;
      if (q && (r.name + " " + r.phone + " " + hospName(r)).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    var wrap = document.getElementById("rv-table");
    if (!rows.length) { wrap.innerHTML = "<div class='rv-empty'>" + tr("예약 데이터가 없습니다.") + "</div>"; return; }
    var L = {
      date: tr("일시"), name: tr("이름"), phone: tr("전화번호"), hosp: tr("이용 병원"),
      contact: tr("연락 상태"), coupon: tr("쿠폰"), code: tr("코드")
    };
    var html = "<table><thead><tr>" +
      "<th class='col-date'>" + L.date + "</th><th>" + L.name + "</th><th>" + L.phone + "</th><th>" + L.hosp + "</th><th class='col-contact'>" + L.contact + "</th><th class='col-coupon'>" + L.coupon + "</th><th class='col-code'>" + L.code + "</th><th class='col-del'></th>" +
      "</tr></thead><tbody>";
    rows.forEach(function (r) {
      html += "<tr>" +
        "<td class='col-date' data-label='" + esc(L.date) + "'>" + fmtDateLines(r.createdAt) + "</td>" +
        "<td data-label='" + esc(L.name) + "'>" + esc(r.name) + "</td>" +
        "<td data-label='" + esc(L.phone) + "'>" + esc(r.phone) + "</td>" +
        "<td data-label='" + esc(L.hosp) + "'>" + hospNameHtml(r) + "</td>" +
        "<td class='col-contact' data-label='" + esc(L.contact) + "'>" + contactCell(r) + "</td>" +
        "<td class='col-coupon' data-label='" + esc(L.coupon) + "'>" + couponCell(r) + "</td>" +
        "<td class='col-code' data-label='" + esc(L.code) + "'>" + (r.couponCode && !r.couponVoided ? "<code class='code'>" + esc(r.couponCode) + "</code>" : "—") + "</td>" +
        "<td class='col-del'><button class='rdel' data-id='" + esc(r.id) + "' title='" + esc(tr("예약 삭제")) + "'>" + tr("삭제") + "</button></td>" +
        "</tr>";
    });
    html += "</tbody></table>";
    wrap.innerHTML = html;
  }

  /* 연락 상태 셀(클릭하면 토글) */
  function contactCell(r) {
    var done = r.contactStatus === "통화완료";
    return "<span class='cstat-wrap'>" +
             "<button class='cstat" + (done ? " done" : "") + "' data-id='" + esc(r.id) + "'>" +
               (done ? tr("✓ 통화완료") : tr("미연락")) + "</button>" +
             (done && r.contactedAt ? "<span class='cstat-at'>" + esc(fmtDate(r.contactedAt)) + "</span>" : "") +
           "</span>";
  }

  /* 쿠폰 셀(사용 안함 / 사용 예정 / 사용 확정 / 취소) */
  function couponCell(r) {
    if (!r.couponCode) return "<span class='pill no'>" + tr("사용 안함") + "</span>";
    if (r.couponVoided === "auto") {
      // 타 병원에서 사용되어 자동으로 사용 안함(수동 변경 불가)
      return "<span class='cstat-wrap'><span class='pill no'>" + tr("사용 안함") + "</span>" +
             "<span class='cstat-at'>" + tr("타 병원 사용") + "</span></span>";
    }
    if (r.couponVoided === "manual") {
      // 관리자가 취소함 → 되돌리기 버튼 제공
      return "<span class='cstat-wrap'><span class='pill no'>" + tr("사용 안함") + "</span>" +
             "<button class='cvoid' data-id='" + esc(r.id) + "'>" + tr("되돌리기") + "</button></span>";
    }
    if (r.couponConfirmed) {
      // 사용 확정 → 통화완료 후에도 사용 취소 버튼 제공
      return "<span class='cstat-wrap'><span class='pill use'>" + tr("쿠폰 사용") + "</span>" +
             "<button class='cvoid' data-id='" + esc(r.id) + "'>" + tr("사용 취소") + "</button></span>";
    }
    // 사용 예정 → 사용 취소 버튼 제공
    return "<span class='cstat-wrap'><span class='pill pending'>" + tr("사용 예정") + "</span>" +
           "<button class='cvoid' data-id='" + esc(r.id) + "'>" + tr("사용 취소") + "</button></span>";
  }

  function renderCoupons() {
    var q = filterText(), hsp = filterHospital();
    var rows = getCoupons().filter(function (c) {
      if (hsp && couponHospName(c) !== hsp) return false;
      if (q && (c.code + " " + c.phone + " " + (c.name || "")).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    var wrap = document.getElementById("rv-table");
    if (!rows.length) { wrap.innerHTML = "<div class='rv-empty'>" + tr("쿠폰 발급 데이터가 없습니다.") + "</div>"; return; }
    var L = {
      code: tr("코드"), phone: tr("발급 전화번호"), status: tr("상태"),
      issued: tr("발급 일시"), usedAt: tr("사용 일시"), hosp: tr("사용 병원")
    };
    var html = "<table><thead><tr>" +
      "<th>" + L.code + "</th><th>" + L.phone + "</th><th>" + L.status + "</th><th>" + L.issued + "</th><th>" + L.usedAt + "</th><th>" + L.hosp + "</th>" +
      "</tr></thead><tbody>";
    rows.forEach(function (c) {
      html += "<tr>" +
        "<td data-label='" + esc(L.code) + "'><code class='code'>" + esc(c.code) + "</code></td>" +
        "<td data-label='" + esc(L.phone) + "'>" + esc(c.phone) + "</td>" +
        "<td data-label='" + esc(L.status) + "'>" + (c.used
            ? "<span class='pill use'>" + tr("사용 완료") + "</span>"
            : "<span class='pill no'>" + tr("미사용") + "</span>") + "</td>" +
        "<td data-label='" + esc(L.issued) + "'>" + esc(fmtDate(c.issuedAt)) + "</td>" +
        "<td data-label='" + esc(L.usedAt) + "'>" + esc(fmtDate(c.usedAt)) + "</td>" +
        "<td data-label='" + esc(L.hosp) + "'>" + esc(c.hospital || "—") + "</td>" +
        "</tr>";
    });
    html += "</tbody></table>";
    wrap.innerHTML = html;
  }

  /* ---- CSV 다운로드 ---- */
  function csvCell(v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }
  function downloadCsv() {
    var lines = [], name;
    if (currentTab === "resv") {
      name = "reservations.csv";
      lines.push([tr("일시"), tr("이름"), tr("전화번호"), tr("이용 병원"), tr("연락 상태"), tr("통화 일시"), tr("쿠폰"), tr("코드")].map(csvCell).join(","));
      getResv().forEach(function (r) {
        var couponLabel = !r.couponCode ? tr("안함")
          : r.couponVoided ? tr("안함")
          : r.couponConfirmed ? tr("사용 확정")
          : tr("사용 예정");
        lines.push([fmtDate(r.createdAt), r.name, r.phone, r.hospitalName || r.hospital,
          tr(r.contactStatus || "미연락"), fmtDate(r.contactedAt), couponLabel, r.couponCode || ""].map(csvCell).join(","));
      });
    } else {
      name = "coupons.csv";
      lines.push([tr("코드"), tr("발급 전화번호"), tr("상태"), tr("발급 일시"), tr("사용 일시"), tr("사용 병원")].map(csvCell).join(","));
      getCoupons().forEach(function (c) {
        lines.push([c.code, c.phone, c.used ? tr("사용 완료") : tr("미사용"),
          fmtDate(c.issuedAt), fmtDate(c.usedAt), c.hospital || ""].map(csvCell).join(","));
      });
    }
    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
  }
})();
