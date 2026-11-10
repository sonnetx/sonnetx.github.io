(() => {
  'use strict';
  const data = document.getElementById('preview-data');
  if (!data) return;
  const states = JSON.parse(data.textContent);
  const byCode = new Map(states.map(state => [state.a, state]));
  const prices = states.map(state => state.p).sort((a, b) => a - b);
  const median = (prices[24] + prices[25]) / 2;
  const maxPrice = prices[prices.length - 1];
  const pushbackColors = { Low: '#dbe2d3', Moderate: '#9baf94', High: '#763e49' };
  const map = document.getElementById('state-map');
  const select = document.getElementById('state-select');
  const controls = document.querySelectorAll('[data-metric]');
  const query = new URLSearchParams(location.search);
  let selected = byCode.has(query.get('state')) ? query.get('state') : 'VA';
  let metric = query.get('metric') === 'pushback' ? 'pushback' : 'price';

  function text(id, value) { document.getElementById(id).textContent = value; }
  function updateAddress() {
    const url = new URL(location.href);
    if (selected === 'VA') url.searchParams.delete('state');
    else url.searchParams.set('state', selected);
    if (metric === 'price') url.searchParams.delete('metric');
    else url.searchParams.set('metric', metric);
    history.replaceState(null, '', url);
  }
  function render() {
    const state = byCode.get(selected);
    select.value = selected;
    text('state-name', state.n);
    text('state-code', state.a);
    text('state-price', state.p.toFixed(2));
    text('compare-state', state.n);
    text('compare-price', state.p.toFixed(2));
    text('median-price', median.toFixed(2));
    text('state-posture', state.posture);
    text('state-pushback', state.pushback);
    const difference = (state.p - median) / median * 100;
    text('price-context', Math.abs(difference).toFixed(0) + '% ' + (difference < 0 ? 'below' : 'above') + ' the median state');
    document.getElementById('state-bar').style.width = state.p / maxPrice * 100 + '%';
    document.getElementById('median-bar').style.width = median / maxPrice * 100 + '%';
    controls.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.metric === metric)));
    map.querySelectorAll('[data-state]').forEach(path => {
      const item = byCode.get(path.dataset.state);
      path.setAttribute('fill', metric === 'price' ? item.color : pushbackColors[item.pushback]);
      path.classList.toggle('is-selected', item.a === selected);
      path.querySelector('title').textContent = item.n + ': ' + (metric === 'price' ? item.p.toFixed(2) + ' cents per kWh' : item.pushback + ' public pushback');
    });
    map.querySelector('.map-annotation').style.display = selected === 'VA' ? '' : 'none';
    const legend = document.getElementById('map-legend');
    if (metric === 'price') {
      legend.innerHTML = '<span>Lower cost</span><i class="gradient-key" aria-hidden="true"></i><span>Higher cost</span>';
      text('map-title', 'US industrial electricity prices by state');
      text('map-description', 'Darker states have higher 2024 industrial electricity prices. Use the state selector to explore each state’s price and political context.');
      text('metric-caption', 'EIA 2024 industrial averages · cents / kWh · not datacenter-specific tariffs');
    } else {
      legend.replaceChildren();
      Object.entries(pushbackColors).forEach(([label, color]) => {
        const span = document.createElement('span');
        span.className = 'legend-chip';
        const chip = document.createElement('i');
        chip.style.background = color;
        chip.setAttribute('aria-hidden', 'true');
        span.append(chip, document.createTextNode(label));
        legend.append(span);
      });
      text('map-title', 'Public pushback against datacenter development by state');
      text('map-description', 'States are shaded by Low, Moderate or High provisional public pushback classifications. Use the state selector to read the category for every state.');
      text('metric-caption', 'October 2026 project records · provisional analyst classifications, not scores');
    }
    updateAddress();
  }
  select.addEventListener('change', () => { selected = select.value; render(); });
  map.addEventListener('click', event => {
    const path = event.target.closest('[data-state]');
    if (path) { selected = path.dataset.state; render(); }
  });
  controls.forEach(button => button.addEventListener('click', () => { metric = button.dataset.metric; render(); }));
  document.documentElement.classList.add('js-ready');
  document.getElementById('map-controls').hidden = false;
  render();
})();
