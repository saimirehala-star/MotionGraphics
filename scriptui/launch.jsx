/* The single-file bundle injects its libraries above this launcher. */
(function (thisObj) {
    try {
        if (parseInt(app.version, 10) !== 23) { throw new Error('此版面向 AE 2023，请在 AE 2023 中运行。当前版本：' + app.version); }
        var previous = $.global.MotionGraphicsJSXSession;
        if (!(thisObj instanceof Panel) && previous) {
            try { if (previous.root.visible && previous.version === MotionGraphicsJSX.version) { MotionGraphicsJSX.session = previous; previous.root.active = true; return; } previous.root.close(); } catch (closedWindow) { /* Rebuild a closed palette. */ }
        }
        var session = MotionGraphicsJSX.create(thisObj);
        MotionGraphicsJSX.session = session;
        MotionGraphicsJSX.watch(session);
        if (session.root instanceof Window) {
            $.global.MotionGraphicsJSXSession = session;
            session.root.center(); session.root.show();
        } else { session.root.layout.layout(true); session.root.layout.resize(); }
    } catch (error) { alert('Motion Graphics 启动失败：\n' + (error.message || String(error)), 'Motion Graphics'); }
}(this));
