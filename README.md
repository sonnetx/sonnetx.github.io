# sonnetx.github.io

The About page text lives in `about.md`. Edit it as plain markdown and GitHub Pages builds it into `about.html` using `_layouts/about.html`. There is no About tab, since the name at the top of the sidebar links there. A hover note on a word in the text comes from `_includes/note.html`, as on brunch.

Books live in `_data/reading.yml`, split into `current` and `finished`. The Reading page (`reading.html`) lists both, and the popup over the word reading on About shows the current books, or the three most recent finished ones when nothing is current.

There is no Writing page for now, and the old `writing.html` and `blog.html` URLs redirect to the homepage. Community (`community.html`) has no tab either, and About links to it.

Every page shares the sidebar in `_includes/sidebar.html`, styled by `sidebar.css`. Each page pulls it in with `{% include sidebar.html active="research" %}`, where `active` names the highlighted tab. The homepage bio sits in a `capture` block at the top of `index.html` and only shows on the homepage. Pages need the empty `---` front matter at the top so GitHub Pages runs the include.
