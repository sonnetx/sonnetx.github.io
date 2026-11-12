(() => {
    const destinations = {
        home: '/', research: '/research.html', projects: '/projects.html',
        compute: '/compute/', reading: '/reading.html', about: '/about.html',
        contact: '/contact.html', community: '/community.html'
    };
    const dialog = document.querySelector('.command-dialog');
    const trigger = document.querySelector('[data-open-command]');
    const caption = document.querySelector('.terminal-caption');
    if (caption) caption.textContent = '↳ yes, you can type in here. try whoami';
    if (dialog && typeof dialog.showModal === 'function') {
        trigger.hidden = false;
        const open = () => {
            if (!dialog.open) dialog.showModal();
            dialog.querySelector('input').focus();
        };
        trigger.addEventListener('click', open);
        dialog.querySelector('[data-close-command]').addEventListener('click', () => dialog.close());
        dialog.addEventListener('click', event => {
            if (event.target !== dialog) return;
            const box = dialog.getBoundingClientRect();
            if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
        });
        document.addEventListener('keydown', event => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                if (dialog.open) dialog.close(); else open();
            }
        });
        if (/Mac|iPhone|iPad/.test(navigator.platform)) trigger.querySelector('kbd').textContent = '⌘ K';
    }
    document.querySelectorAll('.command-form').forEach(form => {
        form.hidden = false;
        form.addEventListener('submit', event => {
            event.preventDefault();
            const input = form.elements.command;
            const raw = input.value.trim().toLowerCase();
            const command = raw.replace(/^cd\s+/, '').replace(/^(?:\.\/|~\/)/, '').replace(/\/$/, '');
            const output = form.parentElement.querySelector('.command-response');
            if (Object.hasOwn(destinations, command)) {
                window.location.assign(destinations[command]);
                return;
            }
            if (command === 'help' || command === 'ls') {
                output.textContent = 'Explore: ' + Object.keys(destinations).join(' · ') + '\nAlso try: whoami · clear';
            } else if (command === 'whoami') {
                output.textContent = 'Sonnet Xu — Stanford CS + math. Researching LLM evaluation, safety, and ML systems. Building tools to understand AI compute.';
            } else if (command === 'clear') {
                output.textContent = '';
            } else {
                output.textContent = 'Command not found: ' + raw + '. Try help, or click a directory above.';
            }
            input.value = '';
        });
    });
})();
