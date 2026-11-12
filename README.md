# sonnetx.github.io

The About page text lives in `about.md`. Edit it as plain markdown and GitHub Pages builds it into `about.html` using `_layouts/about.html`. There is no About tab, since the name at the top of the sidebar links there. A hover note on a word in the text comes from `_includes/note.html`, as on brunch.

Books live in `_data/reading.yml`, split into `current`, `to_read`, `finished` and `shelved` (abandoned). The Reading page (`reading.html`) lists all four, and the popup over the word reading on About shows the current books, or the three most recent finished ones when nothing is current.

There is no Writing page for now, and the old `writing.html` and `blog.html` URLs redirect to the homepage. Community (`community.html`) has no tab either, and About links to it.

## Terminal / notebook design

Every page shares the workspace masthead, file-style navigation and command menu in `_includes/sidebar.html`, styled by `sidebar.css`. The include keeps its original filename so existing pages continue to work. Each page pulls it in with `{% include sidebar.html active="research" %}`, where `active` names the highlighted tab. Pages need the empty `---` front matter at the top so GitHub Pages runs the include.

The homepage is `index.html`, with its notebook layout in `notebook.css`. Shared fonts have local monospace and sans-serif fallbacks. `workspace.js` progressively enables the terminal and command menu (Ctrl/Cmd+K). Normal links work without JavaScript. Commands include `help`, `ls`, `whoami`, `clear`, and page names; `cd research` and `cd compute/` work too. Commands only navigate the fixed site directory; nothing executes in a shell.

Build with `jekyll build --destination /tmp/sonnetx-site`, or preview with `jekyll serve --host 0.0.0.0 --port 4000 --destination /tmp/sonnetx-site`. No additional dependencies are required.
