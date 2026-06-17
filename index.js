// 6장씩 표시. 나머지는 "더보기"로 6장씩 추가 표시한다.
(function () {
    var STEP = 6;
    var gallery = document.querySelector(".gallery");
    var btn = document.querySelector(".more-btn");
    if (!gallery || !btn) return;

    var cards = Array.prototype.slice.call(gallery.querySelectorAll(".card"));
    var shown = 0;

    // 페이지 수 배지를 카드 수에 맞춰 자동 갱신
    var badge = document.querySelector(".count-badge");
    if (badge) {
        badge.textContent = cards.length + (cards.length === 1 ? " Page" : " Pages");
    }

    function render() {
        cards.forEach(function (card, i) {
            card.hidden = i >= shown;
        });
        btn.hidden = shown >= cards.length;
    }

    function showMore() {
        shown = Math.min(shown + STEP, cards.length);
        render();
    }

    shown = Math.min(STEP, cards.length);
    render();

    btn.addEventListener("click", showMore);
})();
