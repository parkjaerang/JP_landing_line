/* =============================================================
   common.js — 전체 랜딩페이지 공통 스크립트
   -------------------------------------------------------------
   각 LP에서 중복되던 공통 기능을 여기에 모았습니다:
   ・라이트박스(비포애프터 이미지 확대 표시)
   ・이벤트 목록 "더보기 / 닫기" 토글
   ・initCardSlider(가로 자동 슬라이드 + 드래그)
   ・DOCTORS 슬라이더(.doctors_wrap)
   ・FAQ 아코디언
   ・비포애프터 Swiper(라이브러리가 없는 페이지에서는 동작하지 않음)
   ・Hero 배경 페이드(대상 요소가 없는 페이지에서는 동작하지 않음)

   ※ 페이지 고유 스크립트(각 LP의 *.js)보다 먼저 로드해야 한다.
     각 LP의 *.js는 여기의 initCardSlider를 사용한다.
   ============================================================= */

/* ===== 라이트박스(이미지 확대) ===== */
const lightbox = document.getElementById('lightbox');
const lightboxImg = lightbox ? lightbox.querySelector('.lightbox_img') : null;
const lightboxClose = lightbox ? lightbox.querySelector('.lightbox_close') : null;

function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('open', 'qr-mode');
    document.body.style.overflow = '';
}

if (lightbox && lightboxImg) {
    document.querySelectorAll('.ba_img img').forEach((img) => {
        img.addEventListener('click', () => {
            lightboxImg.src = img.src;
            lightboxImg.alt = img.alt;
            lightbox.classList.remove('qr-mode');
            lightbox.classList.add('open');
            document.body.style.overflow = 'hidden';
        });
    });

    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
    });
}

/* ===== 이벤트 목록 "더보기 / 닫기" ===== */
const eventGrid = document.querySelector('.event_grid');
const eventMore = document.querySelector('.event_more');

if (eventGrid && eventMore) {
    const STEP = 4;
    const cards = Array.from(eventGrid.querySelectorAll('.event_item'));
    let visible = STEP;

    function renderCards() {
        cards.forEach((card, i) => {
            card.classList.toggle('is-hidden', i >= visible);
        });
        const allShown = visible >= cards.length;
        eventMore.textContent = allShown ? '閉じる' : 'もっと見る';
        eventMore.setAttribute('aria-expanded', String(allShown));
    }

    eventMore.addEventListener('click', () => {
        if (visible >= cards.length) {
            visible = STEP;
            const section = eventGrid.closest('section') || eventGrid;
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            visible += STEP;
        }
        renderCards();
    });

    renderCards();
}

/* ===== 가로 카드 트랙: 자동 슬라이드 + 드래그 ===== */
function initCardSlider(track, cardSelector, { interval = 2500, gap = 16 } = {}) {
    if (!track) return;

    let timer = null;
    let paused = false;
    let isDragging = false;
    let cooldown = false;        // 드래그 직후 잠깐 자동 슬라이드 정지
    let cooldownTimer = null;
    const RESUME_DELAY = 2000;   // 손을 뗀 뒤 자동 슬라이드 재개까지 대기(ms)
    let index = 0; // 현재 카드 인덱스

    // 드래그 등 사용자 조작 후 잠깐 자동 슬라이드를 멈춘다
    function holdAuto() {
        cooldown = true;
        clearTimeout(cooldownTimer);
        cooldownTimer = setTimeout(function () { cooldown = false; }, RESUME_DELAY);
    }

    function nextSlide() {
        const cards = track.querySelectorAll(cardSelector);
        if (!cards.length) return;
        const step = cards[0].offsetWidth + gap; // 카드 폭 + gap
        // 마지막 카드 다음에는 처음으로 되돌아간다
        index = index >= cards.length - 1 ? 0 : index + 1;
        track.scrollTo({ left: step * index, behavior: 'smooth' });
    }

    function start() {
        if (timer) return;
        timer = setInterval(() => {
            if (!paused && !isDragging && !cooldown) nextSlide();
        }, interval);
    }

    // 호버 / 터치 시 일시정지
    track.addEventListener('mouseenter', () => { paused = true; });
    track.addEventListener('mouseleave', () => { paused = false; });
    track.addEventListener('touchstart', () => { paused = true; }, { passive: true });
    track.addEventListener('touchend', () => { paused = false; });

    // 드래그로 좌우 스크롤
    let startX = 0;
    let startScroll = 0;
    let moved = false;

    track.addEventListener('pointerdown', (e) => {
        clearTimeout(cooldownTimer);   // 진행 중이던 재개 대기 취소
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
        holdAuto();   // 드래그 직후 잠깐 멈췄다가 자동 슬라이드 재개
        track.classList.remove('dragging');
        track.style.scrollSnapType = '';
        try { track.releasePointerCapture(e.pointerId); } catch (_) {}
        // 드래그로 옮긴 위치에 맞춰 인덱스 동기화
        const card = track.querySelector(cardSelector);
        if (card) {
            const step = card.offsetWidth + gap;
            index = Math.round(track.scrollLeft / step);
        }
    }

    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);

    // 드래그 후 클릭 오작동 방지
    track.addEventListener('click', (e) => {
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
        io.observe(track);
    } else {
        start();
    }
}

/* ===== DOCTORS 가로 슬라이더 ===== */
document.querySelectorAll('.doctors_wrap').forEach((wrap) => {
    initCardSlider(wrap, '.doctor_card', { interval: 3000 });
});

/* ===== FAQ 아코디언 ===== */
document.querySelectorAll('.faq_item').forEach((item) => {
    const btn = item.querySelector('.faq_q');
    const answer = item.querySelector('.faq_a');
    if (!btn || !answer) return;

    btn.addEventListener('click', () => {
        const isOpen = item.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(isOpen));
        answer.style.maxHeight = isOpen ? answer.scrollHeight + 'px' : '';
    });
});

/* ===== 비포애프터 Swiper(라이브러리가 없는 페이지에서는 동작하지 않음) ===== */
if (window.Swiper) {
    document.querySelectorAll('.sectionSwiper').forEach((sec) => {
        const el = sec.querySelector('.bnaSwiper');
        if (!el) return;
        new Swiper(el, {
            loop: el.querySelectorAll('.swiper-slide').length > 1,
            navigation: {
                nextEl: sec.querySelector('.swiper-button-next'),
                prevEl: sec.querySelector('.swiper-button-prev'),
            },
        });
    });
}

/* ===== Hero 배경 페이드(대상 요소가 없는 페이지에서는 동작하지 않음) ===== */
(() => {
    const slides = document.querySelectorAll('#hero_intro .hero_bg');
    if (slides.length < 2) return;
    let i = 0;
    // 주기 3초 = 페이드아웃 0.9 + 페이드인 0.9 + 노출 유지 1.2초
    setInterval(() => {
        slides[i].classList.remove('is-active');
        i = (i + 1) % slides.length;
        slides[i].classList.add('is-active');
    }, 3000);
})();
