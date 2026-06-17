/* kleamM_LP 고유 스크립트(공통 기능은 ../common.js 참조) */

/* ===== SIGNATURE 자동 슬라이드(공통 initCardSlider 사용) ===== */
initCardSlider(document.querySelector('.sig_track'), '.sig_card', { interval: 2500 });

/* ===== 요금표 카테고리 토글 ===== */
/* 관리자 편집 모드(html.lp-admin)에서는 아코디언을 만들지 않는다.
   - 제목(.prog_title)을 토글 버튼/화살표 아이콘 없이 편집 가능한 텍스트로 두고
   - 본문(가격 목록)도 펼쳐진 상태로 유지해 한 번에 편집할 수 있게 한다. */
if (!document.documentElement.classList.contains('lp-admin')) {
document.querySelectorAll('.price_prog').forEach((prog) => {
    const title = prog.querySelector('.prog_title');
    if (!title) return;

    // 제목 텍스트를 span으로 감싸고 화살표 아이콘 추가
    const label = title.textContent.trim();
    title.innerHTML = '';
    const ttext = document.createElement('span');
    ttext.className = 'prog_ttext';
    ttext.textContent = label;
    const chevron = document.createElement('span');
    chevron.className = 'prog_chevron';
    chevron.setAttribute('aria-hidden', 'true');
    title.append(ttext, chevron);

    title.setAttribute('role', 'button');
    title.setAttribute('tabindex', '0');
    title.setAttribute('aria-expanded', 'false');

    // 제목 이후의 내용을 접을 수 있는 본문으로 래핑
    const body = document.createElement('div');
    body.className = 'prog_body';
    while (title.nextSibling) body.appendChild(title.nextSibling);
    prog.appendChild(body);

    function toggle() {
        const isOpen = prog.classList.toggle('open');
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
