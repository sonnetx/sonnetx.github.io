# sonnetx.github.io

The About page text lives in `about.md`. Edit it as plain markdown and GitHub Pages builds it into `about.html` using `_layouts/about.html`. A hover note on a word in the text comes from `_includes/note.html`, as on brunch.

Books live in `_data/reading.yml`, split into `current`, `to_read`, `finished` and `shelved` (abandoned). The Reading page (`reading.html`) lists all four, and the popup over the word reading on About shows the current books, or the three most recent finished ones when nothing is current.

There is no Writing page for now, and the old `writing.html` and `blog.html` URLs redirect to the homepage. Community (`community.html`) has no tab either, and About links to it.

Every page shares the horizontal header in `_includes/sidebar.html` and the footer in `_includes/footer.html`. The legacy filenames `sidebar.html` and `sidebar.css` are retained, but `sidebar.css` now supplies the Swiss-grid design system; load it after page-local styles. Each page pulls in the header with `{% include sidebar.html active="research" %}`, where `active` names the highlighted tab, and provides a `main` element with `id="main-content"` for the skip link. The homepage bio lives in `index.html`. Metadata and the favicon are shared through `_includes/site-meta.html`. Pages need the empty `---` front matter at the top so GitHub Pages runs the includes.
