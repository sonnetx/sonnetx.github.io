# sonnetx.github.io

The About page text lives in `about.md`. Edit it as plain markdown and GitHub Pages builds it into `about.html` using `_layouts/about.html`. There is no About tab, since the name at the top of the sidebar links there. A hover note on a word in the text comes from `_includes/note.html`, as on brunch.

Books live in `_data/reading.yml`, split into `current`, `to_read`, `finished` and `shelved` (abandoned). The Reading page (`reading.html`) lists all four, and the popup over the word reading on About shows the current books, or the three most recent finished ones when nothing is current.

There is no Writing page for now, and the old `writing.html` and `blog.html` URLs redirect to the homepage. Community (`community.html`) has no tab either, and About links to it.

Interior pages share the sidebar in `_includes/sidebar.html`, styled by `sidebar.css`. Each page pulls it in with `{% include sidebar.html active="research" %}`, where `active` names the highlighted tab. Pages need the empty `---` front matter at the top so GitHub Pages runs Liquid and includes.

## Observatory homepage (design version 2)

The homepage uses its own responsive header and `observatory.css`; the other pages keep their existing sidebar. `observatory.js` powers a 50-state compute preview with electricity-price and public-pushback views. State and metric selections are shareable via `?state=TX&metric=pushback`. Without JavaScript, the price map, Virginia profile, source note and project links remain available.

The chart uses a pinned local snapshot, not live API requests. Prices are **EIA 2024 industrial averages**, not datacenter tariffs. The median is the unweighted median of the 50 state prices, not a national electricity price. Political labels are provisional classifications from the Datacenter Map project. Data is adapted from Sonnet Xu's [Datacenter Map](https://sonnetx.github.io/datacenter-map/) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); US Atlas geometry derives from public-domain US Census boundaries. Preview paths are simplified, so use the full explorer for geographic detail. The other project illustrations are conceptual, not data charts.

Refresh with `python3 refresh_compute_preview.py --revision <reviewed-40-character-upstream-sha>`. This downloads the state records and geometry from that commit, regenerates `_data/compute_preview.json`, and updates its source revision and retrieval date. Review upstream classifications and date wording before publishing a newer snapshot. Build with `jekyll build --destination /tmp/sonnetx-site`.
