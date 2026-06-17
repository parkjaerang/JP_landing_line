const lightbox = document.getElementById('lightbox');
const lightboxImg = lightbox.querySelector('.lightbox_img');
const lightboxClose = lightbox.querySelector('.lightbox_close');

document.querySelectorAll('.ba_img img').forEach((img) => {
    img.addEventListener('click', () => {
        lightboxImg.src = img.src;
        lightboxImg.alt = img.alt;
        lightbox.classList.remove('qr-mode');
        lightbox.classList.add('open');
        document.body.style.overflow = 'hidden';
    });
});

function closeLightbox() {
    lightbox.classList.remove('open', 'qr-mode');
    document.body.style.overflow = '';
}

lightboxClose.addEventListener('click', closeLightbox);

lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
});

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
            const eventSection = eventGrid.closest('section') || eventGrid;
            eventSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            visible += STEP;
        }
        renderCards();
    });

    renderCards();
}

/* ===== SIGNATURE 자동 슬라이드 ===== */
const sigTrack = document.querySelector('.sig_track');

if (sigTrack) {
    const INTERVAL = 2500;
    let timer = null;
    let paused = false;
    let isDragging = false;

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
            if (!paused && !isDragging) nextSlide();
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

/* ===== shorts: 탭 시 iframe 로드(facade) ===== */
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

document.querySelectorAll('.faq_item').forEach((item) => {
    const btn = item.querySelector('.faq_q');
    const answer = item.querySelector('.faq_a');

    btn.addEventListener('click', () => {
        const isOpen = item.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(isOpen));
        answer.style.maxHeight = isOpen ? answer.scrollHeight + 'px' : '';
    });
});

function initCardSlider(track, cardSelector, { interval = 2500, gap = 16 } = {}) {
    if (!track) return;

    let timer = null;
    let paused = false;
    let isDragging = false;
    let index = 0; // 현재 카드 인덱스

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
            if (!paused && !isDragging) nextSlide();
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

document.querySelectorAll('.doctors_wrap').forEach((wrap) => {
    initCardSlider(wrap, '.doctor_card', { interval: 3000 });
});
