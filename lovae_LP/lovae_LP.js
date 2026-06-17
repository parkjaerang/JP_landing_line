/* lovae_LP 고유 스크립트(공통 기능은 ../common.js 참조) */

/* ===== SIGNATURE 자동 슬라이드(공통 initCardSlider 사용) ===== */
initCardSlider(document.querySelector('.sig_track'), '.sig_card', { interval: 2500 });

/* ===== REVIEW 슬라이드 (화살표 + 드래그) ===== */
(function () {
    const track = document.querySelector('.review_track');
    if (!track) return;

    const prevBtn = document.querySelector('.review_prev');
    const nextBtn = document.querySelector('.review_next');

    function step() {
        const card = track.querySelector('.review_card');
        return card ? card.offsetWidth + 16 : track.clientWidth;
    }

    if (prevBtn) prevBtn.addEventListener('click', () => {
        track.scrollBy({ left: -step(), behavior: 'smooth' });
    });
    if (nextBtn) nextBtn.addEventListener('click', () => {
        track.scrollBy({ left: step(), behavior: 'smooth' });
    });

    // 드래그로 좌우 스크롤
    let isDragging = false;
    let startX = 0;
    let startScroll = 0;
    let moved = false;

    track.addEventListener('pointerdown', (e) => {
        isDragging = true;
        moved = false;
        startX = e.clientX;
        startScroll = track.scrollLeft;
        track.style.scrollSnapType = 'none';
        track.classList.add('dragging');
        track.setPointerCapture(e.pointerId);
    });

    track.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 4) moved = true;
        track.scrollLeft = startScroll - dx;
    });

    function endDrag(e) {
        if (!isDragging) return;
        isDragging = false;
        track.classList.remove('dragging');
        track.style.scrollSnapType = '';
        try { track.releasePointerCapture(e.pointerId); } catch (_) {}
    }

    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);

    track.addEventListener('click', (e) => {
        if (moved) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);
})();

/* ===== 시술 타입: 탭 전환 ===== */
(function () {
    const root = document.getElementById('procedure_type');
    if (!root) return;

    const tabs = Array.from(root.querySelectorAll('.tab'));
    const panels = Array.from(root.querySelectorAll('.panel'));

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.target;
            tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
            panels.forEach((panel) => {
                panel.classList.toggle('is-active', '#' + panel.id === target);
            });
        });
    });

    // 각 패널 내 카테고리 서브탭 전환
    panels.forEach((panel) => {
        const subtabs = Array.from(panel.querySelectorAll('.subtab'));
        const cats = Array.from(panel.querySelectorAll('.proc-cat'));
        subtabs.forEach((st) => {
            st.addEventListener('click', () => {
                const target = st.dataset.target;
                subtabs.forEach((s) => s.classList.toggle('is-active', s === st));
                cats.forEach((c) => c.classList.toggle('is-active', c.id === target));
            });
        });
    });
})();
