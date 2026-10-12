var MGIcons = (function () {
    var paths = {
        enter: '<path d="M12 3h5v14h-5M2 10h10M8 6l4 4-4 4"/>',
        exit: '<path d="M8 3H3v14h5M8 10h10M14 6l4 4-4 4"/>',
        loop: '<path d="M16 7a6 6 0 0 0-10-2L3 8m0-4v4h4M4 13a6 6 0 0 0 10 2l3-3m0 4v-4h-4"/>',
        cursor: '<path d="M4 2l12 9-6 1-3 5-3-15zM11 13l3 5"/>',
        stagger: '<path d="M2 4h10M5 10h10M8 16h10"/>',
        diamond: '<path d="M10 3l6 7-6 7-6-7 6-7zM1 10h2m14 0h2"/>',
        film: '<rect x="3" y="3" width="14" height="14" rx="2"/><path d="M6 3v14M14 3v14M3 7h3M3 13h3M14 7h3M14 13h3"/>',
        parent: '<rect x="7" y="2" width="6" height="5" rx="1"/><rect x="1" y="13" width="6" height="5" rx="1"/><rect x="13" y="13" width="6" height="5" rx="1"/><path d="M10 7v3M4 13v-3h12v3"/>',
        align: '<path d="M3 2v16M6 5h11v3H6zM6 12h7v3H6z"/>',
        spark: '<path d="M10 2l2.2 5.8L18 10l-5.8 2.2L10 18l-2.2-5.8L2 10l5.8-2.2L10 2z"/>',
        layers: '<path d="M10 2l8 4-8 4-8-4 8-4zM2 10l8 4 8-4M2 14l8 4 8-4"/>',
        play: '<path d="M6 3l10 7-10 7V3z"/>',
        pause: '<path d="M7 4v12M13 4v12"/>',
        search: '<circle cx="8" cy="8" r="5"/><path d="M12 12l5 5"/>',
        replay: '<path d="M3 8a7 7 0 1 1 1 7M3 3v5h5"/>',
        plus: '<path d="M10 3v14M3 10h14"/>',
        check: '<path d="M4 10l4 4 8-8"/>',
        save: '<path d="M4 2h10l3 3v13H3V2h1zM6 2v6h8V3M6 18v-6h8v6"/>',
        folder: '<path d="M2 5h6l2 2h8v10H2V5z"/>',
        export: '<path d="M10 12V2M6 6l4-4 4 4M4 10v7h12v-7"/>',
        trash: '<path d="M4 6h12M8 6V3h4v3M6 6l1 11h6l1-11M9 9v5M11 9v5"/>',
        code: '<path d="M7 5l-5 5 5 5M13 5l5 5-5 5M11 3L9 17"/>',
        render: '<path d="M3 4h14v10H3zM6 17h8M10 14v3M7 7l6 2-6 2V7z"/>',
        edit: '<path d="M4 14l-1 4 4-1L17 7l-3-3L4 14zM12 6l3 3"/>',
        copy: '<rect x="6" y="6" width="11" height="11" rx="2"/><path d="M4 14H3V3h11v1"/>',
        eye: '<path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z"/><circle cx="10" cy="10" r="2"/>'
    };
    function svg(id) { return '<svg viewBox="0 0 20 20" aria-hidden="true">' + (paths[id] || paths.spark) + '</svg>'; }
    function hydrate(root) { (root || document).querySelectorAll('[data-symbol]').forEach(function (node) { node.innerHTML = svg(node.dataset.symbol); }); }
    return { svg: svg, hydrate: hydrate };
}());
