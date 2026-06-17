/* classone_LP 고유 스크립트(공통 기능은 ../common.js 참조) */

/* ===== SIGNATURE 자동 슬라이드(공통 initCardSlider 사용) ===== */
initCardSlider(document.querySelector('.sig_track'), '.sig_card', { interval: 2500 });

/* ===== 시술 타입: 플랜 전환 + 탭 ===== */
(function () {
    const root = document.getElementById('procedure_type');
    if (!root) return;

    // 플랜 전환 (Standard / VIP)
    const planBtns = Array.from(root.querySelectorAll('.plan-switch-btn'));
    const planPanes = Array.from(root.querySelectorAll('.plan-pane'));

    planBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const plan = btn.dataset.plan;
            planBtns.forEach((b) => {
                const on = b === btn;
                b.classList.toggle('is-active', on);
                b.setAttribute('aria-selected', String(on));
            });
            planPanes.forEach((p) => {
                p.classList.toggle('is-active', p.dataset.pane === plan);
            });
        });
    });

    // 각 플랜 내 탭 전환
    planPanes.forEach((pane) => {
        const tabs = Array.from(pane.querySelectorAll('.tab'));
        const panels = Array.from(pane.querySelectorAll('.panel'));
        tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.target;
                tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
                panels.forEach((panel) => {
                    panel.classList.toggle('is-active', '#' + panel.id === target);
                });
            });
        });
    });
})();
