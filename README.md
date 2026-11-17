# sonnetx.github.io

The About page text lives in `about.md`. Edit it as plain markdown and GitHub Pages builds it into `about.html` using `_layouts/about.html`. It has a tab in the sidebar, and the name at the top of the sidebar links there too. A hover note on a word in the text comes from `_includes/note.html`, as on brunch.

Books live in `_data/reading.yml`, split into `current`, `to_read`, `finished` and `shelved` (abandoned). Each book has an `added` date for when it went into its list. The Reading page (`reading.html`) lists all four with those dates, and the popup over the word reading on About shows the current books, or the three most recent finished ones when nothing is current.

There is no Writing page for now, and the old `writing.html` and `blog.html` URLs redirect to the homepage. The old Compute page is gone too, and `compute/` redirects to Projects. Community (`community.html`) has no tab, and About links to it.

Projects (`projects.html`) is a list with one row per project, each with a small 16:10 image from `photos/projects/` (1000x625 JPEGs), followed by Open Source repo cards. A comment above the list shows how to add a project. The `preference-first/` folder holds a copy of the Preference-First Medical AI demo, taken unchanged from `demo/index.html` in that project's repo, and has no front matter so GitHub Pages serves it as is.

Every page shares the sidebar in `_includes/sidebar.html`, styled by `sidebar.css`. Each page pulls it in with `{% include sidebar.html active="research" %}`, where `active` names the highlighted tab. The homepage bio sits in a `capture` block at the top of `index.html` and only shows on the homepage. Pages need the empty `---` front matter at the top so GitHub Pages runs the include.
