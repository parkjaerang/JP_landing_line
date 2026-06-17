/* kleamH_LP 고유 스크립트(공통 기능은 ../common.js 참조) */

/* ===== SIGNATURE 자동 슬라이드(공통 initCardSlider 사용) ===== */
initCardSlider(document.querySelector('.sig_track'), '.sig_card', { interval: 2500 });

/* ===== 요금 메뉴 아코디언 (제목 클릭 시 펼침/접힘) ===== */
/* 관리자 편집 모드(html.lp-admin)에서는 아코디언을 만들지 않는다.
   - 제목(.menu_cat_title)을 토글 버튼이 아닌 편집 가능한 텍스트로 그대로 두고
   - 본문(가격 목록)도 펼쳐진 상태로 유지해 한 번에 편집할 수 있게 한다. */
if (!document.documentElement.classList.contains('lp-admin')) {
document.querySelectorAll('.menu_cat').forEach((cat) => {
    const title = cat.querySelector('.menu_cat_title');
    if (!title) return;

    // 제목 다음의 모든 내용을 .menu_body 로 감싼다
    const body = document.createElement('div');
    body.className = 'menu_body';
    while (title.nextSibling) {
        body.appendChild(title.nextSibling);
    }
    cat.appendChild(body);

    // 클릭 유도 화살표 사인
    const arrow = document.createElement('span');
    arrow.className = 'menu_arrow';
    arrow.setAttribute('aria-hidden', 'true');
    title.appendChild(arrow);

    title.setAttribute('role', 'button');
    title.setAttribute('tabindex', '0');
    title.setAttribute('aria-expanded', 'false');

    function toggle() {
        const isOpen = cat.classList.toggle('open');
        title.setAttribute('aria-expanded', String(isOpen));
        body.style.maxHeight = isOpen ? body.scrollHeight + 'px' : '';
    }

    title.addEventListener('click', toggle);
    title.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
        }
    });
});
}
