/* ceramique_LP 고유 스크립트(공통 기능은 ../common.js 참조) */

/* ===== SIGNATURE 자동 슬라이드(공통 initCardSlider 사용) ===== */
initCardSlider(document.querySelector('.sig_track'), '.sig_card', { interval: 2500 });

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
