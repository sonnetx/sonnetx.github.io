(() => {
  const root = document.documentElement;
  const steps = [...document.querySelectorAll('.compute-step')];
  const scenes = [...document.querySelectorAll('[data-art]')];
  const tracks = [...document.querySelectorAll('.stack-track span')];
  const chapters = [...document.querySelectorAll('.chapter')];
  const chapterLinks = [...document.querySelectorAll('[data-chapter]')];
  const compute = document.querySelector('#compute');
  const count = document.querySelector('.stage-count');
  const category = document.querySelector('.stage-category');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let activeScene = -1;
  let framePending = false;

  if (!compute || !steps.length) return;
  steps.forEach(step => {
    const art = scenes.find(scene => scene.dataset.art === step.dataset.scene)?.cloneNode(true);
    if (!art) return;
    art.classList.remove('scene', 'is-active');
    art.removeAttribute('data-art');
    art.setAttribute('aria-hidden', 'true');
    art.setAttribute('focusable', 'false');
    art.querySelectorAll('[id]').forEach(element => {
      const oldId = element.id;
      const newId = `mobile-${oldId}`;
      element.id = newId;
      art.querySelectorAll('[fill]').forEach(shape => {
        if (shape.getAttribute('fill') === `url(#${oldId})`) shape.setAttribute('fill', `url(#${newId})`);
      });
    });
    const figure = document.createElement('div');
    figure.className = 'mobile-scene';
    figure.setAttribute('aria-hidden', 'true');
    figure.append(art);
    step.prepend(figure);
  });
  root.classList.add('story-ready');

  function updateStory() {
    framePending = false;
    const height = window.innerHeight;
    const scrollable = root.scrollHeight - height;
    const progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
    root.style.setProperty('--reading-progress', progress);
    if (!reducedMotion.matches) {
      root.style.setProperty('--orbit-angle', `${Math.min(window.scrollY * 0.025, 25)}deg`);
    }

    let currentChapter = '';
    chapters.forEach(chapter => {
      const bounds = chapter.getBoundingClientRect();
      if (bounds.top <= height * 0.4 && bounds.bottom > height * 0.4) currentChapter = chapter.id;
    });
    chapterLinks.forEach(link => {
      if (link.dataset.chapter === currentChapter) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });

    const computeBounds = compute.getBoundingClientRect();
    document.body.classList.toggle('compute-in-view', computeBounds.top <= 86 && computeBounds.bottom > 86);
    if (computeBounds.bottom < 0 || computeBounds.top > height) return;

    let nextScene = 0;
    steps.forEach((step, index) => {
      if (step.getBoundingClientRect().top <= height * 0.55) nextScene = index;
    });
    if (nextScene === activeScene) return;
    activeScene = nextScene;
    const step = steps[nextScene];
    scenes.forEach(scene => scene.classList.toggle('is-active', scene.dataset.art === step.dataset.scene));
    tracks.forEach((track, index) => track.classList.toggle('is-active', index <= nextScene));
    count.textContent = `${String(nextScene + 1).padStart(2, '0')} / 05`;
    category.textContent = step.dataset.category;
  }

  function scheduleUpdate() {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(updateStory);
  }

  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('pageshow', scheduleUpdate);
  window.addEventListener('load', scheduleUpdate);
  reducedMotion.addEventListener('change', scheduleUpdate);
  updateStory();
})();
