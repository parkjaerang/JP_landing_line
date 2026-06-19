/* wooa_LP 고유 스크립트(공통 기능은 ../common.js 참조) */

/* ===== SIGNATURE 자동 슬라이드 ===== */
const sigTrack = document.querySelector('.sig_track');

if (sigTrack) {
    const INTERVAL = 2500;
    let timer = null;
    let paused = false;
    let isDragging = false;
    let cooldown = false;        // 드래그 직후 잠깐 자동 슬라이드 정지
    let cooldownTimer = null;
    const RESUME_DELAY = 2000;   // 손을 뗀 뒤 자동 슬라이드 재개까지 대기(ms)

    // 드래그 등 사용자 조작 후 잠깐 자동 슬라이드를 멈춘다
    function holdAuto() {
        cooldown = true;
        clearTimeout(cooldownTimer);
        cooldownTimer = setTimeout(() => { cooldown = false; }, RESUME_DELAY);
    }

    // 양쪽 여백은 CSS의 .sig_track::before / ::after 로 가운데 정렬을 보장

    function nextSlide() {
        const card = sigTrack.querySelector('.sig_card');
        if (!card) return;
        const step = card.offsetWidth + 16; // 카드 폭 + gap
        const maxScroll = sigTrack.scrollWidth - sigTrack.clientWidth;
        if (sigTrack.scrollLeft >= maxScroll - 2) {
            sigTrack.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            sigTrack.scrollBy({ left: step, behavior: 'smooth' });
        }
    }

    function start() {
        if (timer) return;
        timer = setInterval(() => {
            if (!paused && !isDragging && !cooldown) nextSlide();
        }, INTERVAL);
    }

    function stop() {
        clearInterval(timer);
        timer = null;
    }

    // 호버 / 터치 시 일시정지
    sigTrack.addEventListener('mouseenter', () => { paused = true; });
    sigTrack.addEventListener('mouseleave', () => { paused = false; });
    sigTrack.addEventListener('touchstart', () => { paused = true; }, { passive: true });
    sigTrack.addEventListener('touchend', () => { paused = false; });

    // 드래그로 좌우 스크롤
    let startX = 0;
    let startScroll = 0;
    let moved = false;

    sigTrack.addEventListener('pointerdown', (e) => {
        clearTimeout(cooldownTimer);   // 진행 중이던 재개 대기 취소
        isDragging = true;
        moved = false;
        startX = e.clientX;
        startScroll = sigTrack.scrollLeft;
        sigTrack.style.scrollSnapType = 'none';
        sigTrack.classList.add('dragging');
        sigTrack.setPointerCapture(e.pointerId);
    });

    sigTrack.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 4) moved = true;
        sigTrack.scrollLeft = startScroll - dx;
    });

    function endDrag(e) {
        if (!isDragging) return;
        isDragging = false;
        holdAuto();   // 드래그 직후 잠깐 멈췄다가 자동 슬라이드 재개
        sigTrack.classList.remove('dragging');
        sigTrack.style.scrollSnapType = '';
        try { sigTrack.releasePointerCapture(e.pointerId); } catch (_) {}
    }

    sigTrack.addEventListener('pointerup', endDrag);
    sigTrack.addEventListener('pointercancel', endDrag);

    // 드래그 후 클릭 오작동 방지
    sigTrack.addEventListener('click', (e) => {
        if (moved) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);

    // 화면에 보이면 자동 슬라이드 시작
    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries, obs) => {
            if (entries.some((en) => en.isIntersecting)) { start(); obs.disconnect(); }
        }, { threshold: 0.2 });
        io.observe(sigTrack);
    } else {
        start();
    }
}

/* ===== 쇼츠: 탭 시 iframe 로드(파사드) ===== */
document.querySelectorAll('.short_item').forEach((item) => {
    item.addEventListener('click', () => {
        if (item.querySelector('iframe')) return;
        const id = item.dataset.id;
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0`;
        iframe.title = 'YouTube video player';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.referrerPolicy = 'strict-origin-when-cross-origin';
        iframe.allowFullscreen = true;
        item.appendChild(iframe);
    });
});
