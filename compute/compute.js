/* Connections describe topic relationships and verified reuse of copied research. */
(function () {
  'use strict';
  const articles = Array.from(document.querySelectorAll('.directory .project'));
  const projects = new Map(articles.map(article => [article.id, article]));
  const graph = document.getElementById('graph');
  const nodes = document.getElementById('graph-nodes');
  const svg = document.getElementById('connections');
  const detail = document.getElementById('project-detail');
  const mapView = document.getElementById('map-view');
  const directory = document.getElementById('projects');
  const NS = 'http://www.w3.org/2000/svg';
  const edges = [
    {
      from: 'chip-supply-chain', to: 'datacenter-listings', type: 'topic', label: 'Accelerators', summary: 'Topic / Accelerator supply',
      text: 'The chip explorer examines accelerator components and suppliers. Listings measures accelerator capacity and costs at the campus level.'
    },
    {
      from: 'datacenter-map', to: 'datacenter-listings', type: 'data', label: 'Power and policy', summary: 'Data / State power and policy',
      text: 'Listings copies state power prices, siting ratings and policy records from Datacenter Map.'
    },
    {
      from: 'neoclouds', to: 'datacenter-listings', type: 'data', label: 'Provider profiles', summary: 'Data / Provider profiles',
      text: 'Listings uses provider names and summaries from the Neocloud Guide to link campus owners and tenants to company profiles.'
    },
    {
      from: 'ai-demand-supply', to: 'datacenter-listings', type: 'data', label: 'Cost benchmarks', summary: 'Data / Cost benchmarks',
      text: 'Listings copies GPU rental benchmarks, build costs, financing rates and useful lives from AI Demand and Supply.'
    },
    {
      from: 'neoclouds', to: 'ai-demand-supply', type: 'topic', label: 'Rental markets', summary: 'Topic / GPU rental markets',
      text: 'The Neocloud Guide describes GPU suppliers and rental markets. AI Demand and Supply models the revenue and financing behind compute spending.'
    }
  ];
  let view = location.hash === '#directory' ? 'directory' : 'map';
  let selected = projects.has(location.hash.slice(1)) ? location.hash.slice(1) : 'datacenter-listings';
  let connections = new URLSearchParams(location.search).get('connections') === 'data' ? 'data' : 'all';

  function element(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }
  function svgElement(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key, value]) => e.setAttribute(key, value));
    return e;
  }
  function visibleEdges() { return edges.filter(edge => connections === 'all' || edge.type === 'data'); }
  function writeAddress() {
    const query = new URLSearchParams(location.search);
    if (connections === 'data') query.set('connections', 'data');
    else query.delete('connections');
    const search = query.size ? '?' + query.toString() : '';
    history.replaceState(null, '', location.pathname + search + '#' + (view === 'directory' ? 'directory' : selected));
  }

  articles.forEach(article => {
    const button = element('button', 'node');
    button.type = 'button';
    button.dataset.project = article.id;
    button.setAttribute('aria-controls', 'project-detail');
    button.append(
      element('span', 'node-category', article.dataset.label),
      element('strong', '', article.dataset.short),
      element('span', 'node-question', article.dataset.question)
    );
    button.addEventListener('click', () => { selected = article.id; render(); });
    nodes.append(button);
  });

  function renderDetail() {
    const article = projects.get(selected);
    const title = element('h2', '', article.querySelector('h2').textContent);
    title.id = 'detail-title';
    detail.replaceChildren(
      article.querySelector('.project-category').cloneNode(true), title,
      article.querySelector('.project-description').cloneNode(true),
      article.querySelector('.project-links').cloneNode(true)
    );
    const related = visibleEdges().filter(edge => edge.from === selected || edge.to === selected);
    detail.append(element('h3', 'connection-heading', connections === 'data' ? 'Shared data' : 'Connected projects'));
    if (!related.length) {
      detail.append(element('p', 'no-connections', 'This project connects through its subject rather than copied datasets.'));
      const showAll = element('button', 'show-connections', 'Show topic connections');
      showAll.type = 'button';
      showAll.addEventListener('click', () => { connections = 'all'; render(); });
      detail.append(showAll);
    } else {
      const list = element('ul', 'related');
      related.forEach(edge => {
        const other = edge.from === selected ? edge.to : edge.from;
        const li = element('li');
        const button = element('button', '', projects.get(other).dataset.short);
        button.type = 'button';
        button.addEventListener('click', () => {
          selected = other;
          render();
          nodes.querySelector('[data-project="' + other + '"]').focus({ preventScroll: true });
        });
        const explanation = element('details');
        explanation.append(element('summary', '', edge.summary), element('p', '', edge.text));
        li.append(button, explanation);
        list.append(li);
      });
      detail.append(list);
    }
    detail.scrollTop = 0;
  }

  function drawEdges() {
    if (mapView.hidden) return;
    svg.replaceChildren();
    const box = graph.getBoundingClientRect();
    if (!box.width || !box.height) return;
    svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
    const defs = svgElement('defs', {});
    const marker = svgElement('marker', { id: 'data-arrow', viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 5, markerHeight: 5, orient: 'auto' });
    marker.append(svgElement('path', { d: 'M0 0 L8 4 L0 8 Z', fill: '#8fa8eb' }));
    defs.append(marker);
    svg.append(defs);
    function rect(id) {
      const r = nodes.querySelector('[data-project="' + id + '"]').getBoundingClientRect();
      return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height, cx: r.left - box.left + r.width / 2, cy: r.top - box.top + r.height / 2 };
    }
    visibleEdges().forEach(edge => {
      const a = rect(edge.from), b = rect(edge.to);
      const dx = b.cx - a.cx, dy = b.cy - a.cy;
      let start, end, d;
      if (Math.abs(dx) > Math.abs(dy) * .7) {
        start = { x: dx > 0 ? a.x + a.w : a.x, y: a.cy };
        end = { x: dx > 0 ? b.x : b.x + b.w, y: b.cy };
        const mid = (start.x + end.x) / 2;
        d = `M${start.x} ${start.y} C${mid} ${start.y} ${mid} ${end.y} ${end.x} ${end.y}`;
      } else {
        start = { x: a.cx, y: dy > 0 ? a.y + a.h : a.y };
        end = { x: b.cx, y: dy > 0 ? b.y : b.y + b.h };
        const mid = (start.y + end.y) / 2;
        d = `M${start.x} ${start.y} C${start.x} ${mid} ${end.x} ${mid} ${end.x} ${end.y}`;
      }
      const active = edge.from === selected || edge.to === selected;
      const path = svgElement('path', { d, class: 'edge edge-' + edge.type + (active ? ' active' : ' inactive'), 'data-type': edge.type });
      if (edge.type === 'data') path.setAttribute('marker-end', 'url(#data-arrow)');
      svg.append(path);
      const point = path.getPointAtLength(path.getTotalLength() / 2);
      const text = svgElement('text', { x: point.x, y: point.y - 7, 'text-anchor': 'middle', class: 'edge-label edge-' + edge.type + '-label' + (active ? '' : ' inactive') });
      text.textContent = edge.label;
      svg.append(text);
    });
  }

  function render() {
    mapView.hidden = view !== 'map';
    directory.hidden = view !== 'directory';
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
    document.querySelectorAll('[data-connections]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.connections === connections)));
    const connected = new Set([selected]);
    visibleEdges().forEach(edge => {
      if (edge.from === selected) connected.add(edge.to);
      if (edge.to === selected) connected.add(edge.from);
    });
    nodes.querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.project === selected));
      button.classList.toggle('disconnected', !connected.has(button.dataset.project));
    });
    renderDetail();
    drawEdges();
    writeAddress();
  }
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { view = button.dataset.view; render(); }));
  document.querySelectorAll('[data-connections]').forEach(button => button.addEventListener('click', () => { connections = button.dataset.connections; render(); }));
  document.querySelector('.skip').addEventListener('click', event => {
    event.preventDefault();
    view = 'directory'; render();
    directory.tabIndex = -1;
    directory.focus();
  });
  window.addEventListener('hashchange', () => {
    if (location.hash === '#directory') view = 'directory';
    else if (projects.has(location.hash.slice(1))) { selected = location.hash.slice(1); view = 'map'; }
    render();
  });
  document.getElementById('view-bar').hidden = false;
  new ResizeObserver(drawEdges).observe(graph);
  render();
})();
