# sonnetx.github.io

The About page text lives in `about.md`. Edit it as plain markdown and GitHub Pages builds it into `about.html` using `_layouts/about.html`.

Every page shares the sidebar in `_includes/sidebar.html`, styled by `sidebar.css`. Each page pulls it in with `{% include sidebar.html active="research" %}`, where `active` names the highlighted tab. The homepage bio sits in a `capture` block at the top of `index.html` and only shows on the homepage. Pages need the empty `---` front matter at the top so GitHub Pages runs the include.
