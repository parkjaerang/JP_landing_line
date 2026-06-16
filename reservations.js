/* =============================================================
   reservations.js  —  予約名簿(reservations.html)
   - admin と同じパスワードで保護(lp_admin_authed)
   - LPCoupon.Store から予約 / クーポンデータを読み込み表示
   ============================================================= */
(function () {
  "use strict";

  var ADMIN_PASSWORD = "admin1234";   // admin.js と同じパスワード
  var AUTH_KEY = "lp_admin_authed";

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
    if (authed()) { enter(); } else { showGate(); }
    document.getElementById("rv-logout").addEventListener("click", function () {
      setAuthed(false); location.href = "./admin.html";
    });
  });

  /* ---- ログインゲート ---- */
  function showGate() {
    var gate = document.createElement("div");
    gate.className = "rv-gate";
    gate.innerHTML =
      "<div class='rv-gate-box'><h2>예약 명단 로그인</h2><p>비밀번호를 입력하세요</p>" +
      "<input type='password' id='rv-pw' placeholder='비밀번호'>" +
      "<button id='rv-login'>로그인</button>" +
      "<p class='rv-gate-err' id='rv-pw-err'></p></div>";
    document.body.appendChild(gate);
    var pw = gate.querySelector("#rv-pw");
    var err = gate.querySelector("#rv-pw-err");
    function tryLogin() {
      if (pw.value === ADMIN_PASSWORD) { setAuthed(true); gate.remove(); enter(); }
      else { err.textContent = "비밀번호가 올바르지 않습니다"; pw.value = ""; pw.focus(); }
    }
    gate.querySelector("#rv-login").addEventListener("click", tryLogin);
    pw.addEventListener("keydown", function (e) { if (e.key === "Enter") tryLogin(); });
    pw.focus();
  }

  /* ---- メイン ---- */
  function enter() {
    document.getElementById("rv-app").hidden = false;
    migrate();   // 旧データに id / 連絡ステータス等のフィールドを補完

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
      if (!confirm("모든 예약·쿠폰 데이터를 삭제합니다. 계속하시겠습니까?")) return;
      try {
        localStorage.removeItem("lp_reservations_v1");
        localStorage.removeItem("lp_coupons_v1");
        localStorage.removeItem("lp_phone_index_v1");
      } catch (e) {}
      buildHospitalOptions();
      render();
    });
    // 連絡ステータス トグル(イベント委譲)
    document.getElementById("rv-table").addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("button.cstat") : null;
      if (btn) toggleContact(btn.getAttribute("data-id"));
    });
    render();
  }

  /* ---- 旧データの移行(id・連絡ステータス・クーポン確定フラグを補完) ---- */
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
        // 旧フロー(送信時に即 redeem)で既に使用済みのものは確定扱いにする
        var c = r.couponCode ? byCode[r.couponCode] : null;
        r.couponConfirmed = !!(r.couponUsed && c && c.used);
        changed = true;
      }
    });
    if (changed) { try { localStorage.setItem("lp_reservations_v1", JSON.stringify(list)); } catch (e) {} }
  }

  /* ---- 連絡ステータスの切替(클릭 トグル) ---- */
  function toggleContact(id) {
    var list = Store.getReservations();
    var r = null;
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { r = list[i]; break; } }
    if (!r) return;
    var done = r.contactStatus === "통화완료";
    if (!done) {
      // 미연락 → 통화완료:クーポンがあれば使用確定
      var patch = { contactStatus: "통화완료", contactedAt: new Date().toISOString() };
      if (r.couponCode && !r.couponConfirmed) {
        Store.confirmCoupon(r.couponCode, { hospital: r.hospital, name: r.name });
        patch.couponConfirmed = true;
      }
      Store.updateReservation(id, patch);
    } else {
      // 통화완료 → 미연락:クーポンを使用前に戻す
      if (r.couponCode && r.couponConfirmed &&
          !confirm("통화완료를 취소하면 이 예약의 쿠폰 사용도 취소되어 다시 사용 가능 상태로 돌아갑니다. 계속하시겠습니까?")) {
        return;
      }
      var patch2 = { contactStatus: "미연락", contactedAt: "" };
      if (r.couponCode && r.couponConfirmed) {
        Store.releaseCoupon(r.couponCode);
        patch2.couponConfirmed = false;
      }
      Store.updateReservation(id, patch2);
    }
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

  /* 병원 드롭다운 옵션을 데이터에서 동적 생성 */
  function buildHospitalOptions() {
    var sel = document.getElementById("rv-hospital");
    if (!sel) return;
    var names = {};
    getResv().forEach(function (r) { var n = hospName(r); if (n) names[n] = true; });
    getCoupons().forEach(function (c) { var n = couponHospName(c); if (n) names[n] = true; });
    var keys = Object.keys(names).sort();
    var cur = sel.value;
    sel.innerHTML = "<option value=''>전체 병원</option>" +
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
    var pending = resv.filter(function (r) { return r.couponCode && !r.couponConfirmed; }).length;
    var confirmed = resv.filter(function (r) { return r.couponConfirmed; }).length;
    var box = document.getElementById("rv-stats");
    box.innerHTML =
      stat(resv.length, "예약 합계") +
      stat(noContact, "미연락") +
      stat(pending, "쿠폰 사용 예정") +
      stat(confirmed, "쿠폰 사용 확정") +
      stat(coupons.length, "쿠폰 발급");
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
    if (!rows.length) { wrap.innerHTML = "<div class='rv-empty'>예약 데이터가 없습니다.</div>"; return; }
    var html = "<table><thead><tr>" +
      "<th class='col-date'>일시</th><th>이름</th><th>전화번호</th><th>이용 병원</th><th class='col-contact'>연락 상태</th><th>쿠폰</th><th>코드</th>" +
      "</tr></thead><tbody>";
    rows.forEach(function (r) {
      html += "<tr>" +
        "<td class='col-date'>" + fmtDateLines(r.createdAt) + "</td>" +
        "<td>" + esc(r.name) + "</td>" +
        "<td>" + esc(r.phone) + "</td>" +
        "<td>" + esc(r.hospitalName || r.hospital) + "</td>" +
        "<td class='col-contact'>" + contactCell(r) + "</td>" +
        "<td>" + couponCell(r) + "</td>" +
        "<td>" + (r.couponCode ? "<code class='code'>" + esc(r.couponCode) + "</code>" : "—") + "</td>" +
        "</tr>";
    });
    html += "</tbody></table>";
    wrap.innerHTML = html;
  }

  /* 連絡ステータス セル(클릭하면 토글) */
  function contactCell(r) {
    var done = r.contactStatus === "통화완료";
    return "<span class='cstat-wrap'>" +
             "<button class='cstat" + (done ? " done" : "") + "' data-id='" + esc(r.id) + "'>" +
               (done ? "✓ 통화완료" : "미연락") + "</button>" +
             (done && r.contactedAt ? "<span class='cstat-at'>" + esc(fmtDate(r.contactedAt)) + "</span>" : "") +
           "</span>";
  }

  /* クーポン セル(사용 안함 / 사용 예정 / 사용 확정) */
  function couponCell(r) {
    if (!r.couponCode) return "<span class='pill no'>사용 안함</span>";
    if (r.couponConfirmed) return "<span class='pill use'>5%OFF 사용</span>";
    return "<span class='pill pending'>사용 예정</span>";
  }

  function renderCoupons() {
    var q = filterText(), hsp = filterHospital();
    var rows = getCoupons().filter(function (c) {
      if (hsp && couponHospName(c) !== hsp) return false;
      if (q && (c.code + " " + c.phone + " " + (c.name || "")).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    var wrap = document.getElementById("rv-table");
    if (!rows.length) { wrap.innerHTML = "<div class='rv-empty'>쿠폰 발급 데이터가 없습니다.</div>"; return; }
    var html = "<table><thead><tr>" +
      "<th>코드</th><th>발급 전화번호</th><th>상태</th><th>발급 일시</th><th>사용 일시</th><th>사용 병원</th>" +
      "</tr></thead><tbody>";
    rows.forEach(function (c) {
      html += "<tr>" +
        "<td><code class='code'>" + esc(c.code) + "</code></td>" +
        "<td>" + esc(c.phone) + "</td>" +
        "<td>" + (c.used
            ? "<span class='pill use'>사용 완료</span>"
            : "<span class='pill no'>미사용</span>") + "</td>" +
        "<td>" + esc(fmtDate(c.issuedAt)) + "</td>" +
        "<td>" + esc(fmtDate(c.usedAt)) + "</td>" +
        "<td>" + esc(c.hospital || "—") + "</td>" +
        "</tr>";
    });
    html += "</tbody></table>";
    wrap.innerHTML = html;
  }

  /* ---- CSV ダウンロード ---- */
  function csvCell(v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }
  function downloadCsv() {
    var lines = [], name;
    if (currentTab === "resv") {
      name = "reservations.csv";
      lines.push(["일시", "이름", "전화번호", "이용 병원", "연락 상태", "통화 일시", "쿠폰", "코드"].map(csvCell).join(","));
      getResv().forEach(function (r) {
        var couponLabel = !r.couponCode ? "안함" : (r.couponConfirmed ? "사용 확정" : "사용 예정");
        lines.push([fmtDate(r.createdAt), r.name, r.phone, r.hospitalName || r.hospital,
          r.contactStatus || "미연락", fmtDate(r.contactedAt), couponLabel, r.couponCode || ""].map(csvCell).join(","));
      });
    } else {
      name = "coupons.csv";
      lines.push(["코드", "발급 전화번호", "상태", "발급 일시", "사용 일시", "사용 병원"].map(csvCell).join(","));
      getCoupons().forEach(function (c) {
        lines.push([c.code, c.phone, c.used ? "사용 완료" : "미사용",
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
