# sonnetx.github.io

The About page text lives in `about.md`. Edit it as plain markdown and GitHub Pages builds it into `about.html` using `_layouts/about.html`. There is no About tab, since the name at the top of the sidebar links there. A hover note on a word in the text comes from `_includes/note.html`, as on brunch.

Books live in `_data/reading.yml`, split into `current`, `to_read`, `finished` and `shelved` (abandoned). The Reading page (`reading.html`) lists all four, and the popup over the word reading on About shows the current books, or the three most recent finished ones when nothing is current.

There is no Writing page for now, and the old `writing.html` and `blog.html` URLs redirect to the homepage. Community (`community.html`) has no tab either, and About links to it.

Every page shares the editorial masthead in `_includes/sidebar.html` (the legacy filename is retained), styled by `sidebar.css`. Each page pulls it in with `{% include sidebar.html active="research" %}`, where `active` names the highlighted tab. The homepage layout is in `index.html` and `editorial.css`; the compute hub adds `compute/editorial-compute.css` without changing its interactive project map. Pages need the empty `---` front matter at the top so GitHub Pages runs the include. Each page's main element uses `id="main-content"` for the shared skip link.

Build locally with `jekyll build --destination /tmp/sonnetx-site`, or serve with `jekyll serve --host 0.0.0.0 --port 4000 --destination /tmp/sonnetx-site`. No new dependencies are required for the editorial redesign.
