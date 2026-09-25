    // ==========================================
    // SVG Icons
    // ==========================================

    const ICONS = {
        home: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
        debug: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`,
        sun: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`,
        moon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
        minimize: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
        preview: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
        check: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
        book: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
        edit: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
        video: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
        zap: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
        undo: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
        stop: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>`,
        search: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
        download: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
        lightbulb: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-1 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`,
        checkCircle: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
        clear: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
        chevronRight: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
        chevronDown: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
        cloud: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`,
        cloudDownload: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 13v8l-4-4"/><path d="m12 21 4-4"/><path d="M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/></svg>`,
        cloudUpload: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>`,
        upload: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
        share: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
        camera: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
        copy: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
        sparkles: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>`,
        external: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
        git: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"/><path d="M12 12v3"/></svg>`,
        github: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>`,
        greasyfork: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2v4a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3V2"/><line x1="12" y1="9" x2="12" y2="22"/></svg>`,
        help: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        target: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
        database: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
        tools: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
        shield: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
        shieldCheck: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
        play: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
        fastForward: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/></svg>`,
        alertTriangle: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        info: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
        rotateCcw: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
        sliders: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,
        checkBadge: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
        clock: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        xCircle: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        clipboard: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`,
        keyboard: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10"/></svg>`,
        skipForward: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>`,
        close: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
        link: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
        lock: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
        unlock: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`,
        globe: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
        bell: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
        volume: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
        trash: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
        terminal: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
        bug: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>`,
        chatgpt: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M22.28 9.82a6 6 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6.06 6.06 0 0 0 4.98 4.18a6 6 0 0 0-4 2.9 6.05 6.05 0 0 0 .74 7.1 6 6 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.52 2.9A6 6 0 0 0 13.26 24a6.05 6.05 0 0 0 5.77-4.2 6 6 0 0 0 4-2.9 6.05 6.05 0 0 0-.75-7.08zm-9.02 12.61a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.8.8 0 0 0 .39-.68v-6.74l2.02 1.17a.07.07 0 0 1 .04.05v5.59a4.5 4.5 0 0 1-4.49 4.49zm-9.66-4.13a4.47 4.47 0 0 1-.54-3.01l.15.08 4.78 2.76a.77.77 0 0 0 .78 0l5.84-3.37v2.33a.08.08 0 0 1-.03.06L9.74 19.95a4.5 4.5 0 0 1-6.14-1.65zM2.34 7.9a4.49 4.49 0 0 1 2.37-1.98V11.6a.77.77 0 0 0 .38.68l5.82 3.35-2.02 1.17a.08.08 0 0 1-.07 0l-4.83-2.79A4.5 4.5 0 0 1 2.34 7.9zm16.1 3.85L12.6 8.38l2.02-1.16a.08.08 0 0 1 .07 0l4.83 2.79a4.5 4.5 0 0 1-.67 8.1v-5.67a.8.8 0 0 0-.41-.69zm2.01-3.02l-.14-.09-4.78-2.78a.78.78 0 0 0-.78 0L9.4 9.23V6.9a.07.07 0 0 1 .03-.06l4.83-2.79a4.5 4.5 0 0 1 6.68 4.66zM8.31 12.86l-2.02-1.16a.08.08 0 0 1-.04-.06V6.07a4.5 4.5 0 0 1 7.38-3.45l-.14.08L8.7 5.46a.8.8 0 0 0-.39.68v6.72zm1.3-1.9l2.42-1.4 2.43 1.4v2.8l-2.43 1.4-2.42-1.4z"/></svg>`,
        gemini: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"/></svg>`,
        perplexity: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`,
    };

    // Web Audio API Procedural Sound Engine (Zero external dependencies)
    let audioCtxInstance = null;
    function getAudioContext() {
        try {
            if (!audioCtxInstance) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) audioCtxInstance = new AudioCtx();
            }
            if (audioCtxInstance && audioCtxInstance.state === 'suspended') {
                audioCtxInstance.resume().catch(() => {});
            }
        } catch (_) {}
        return audioCtxInstance;
    }

    // Auto-resume AudioContext on user interaction
    if (typeof window !== 'undefined') {
        ['click', 'keydown', 'touchstart'].forEach(evt => {
            window.addEventListener(evt, () => {
                if (audioCtxInstance && audioCtxInstance.state === 'suspended') {
                    audioCtxInstance.resume().catch(() => {});
                }
            }, { passive: true, capture: true });
        });
    }

    function playToolkitSound(type) {
        if (!enableAudioAlerts) return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;

            if (type === 'quest_done' || type === 'complete') {
                // Bright, celebratory multi-tone ascending ding (D5 -> A5 -> D6 chime)
                const notes = [
                    { freq: 587.33, start: 0, dur: 0.25 },
                    { freq: 880.00, start: 0.1, dur: 0.35 },
                    { freq: 1174.66, start: 0.2, dur: 0.8 }
                ];
                notes.forEach(n => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(n.freq, now + n.start);

                    gain.gain.setValueAtTime(0.0001, now + n.start);
                    gain.gain.exponentialRampToValueAtTime(0.18, now + n.start + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);

                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now + n.start);
                    osc.stop(now + n.start + n.dur);
                });
            } else if (type === 'manual_intervention' || type === 'unknown') {
                // Gentle, distinctive two-tone alert chime (F5 -> D5 soft marimba tone)
                const notes = [
                    { freq: 698.46, start: 0, dur: 0.14 },
                    { freq: 587.33, start: 0.12, dur: 0.4 }
                ];
                notes.forEach(n => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(n.freq, now + n.start);

                    gain.gain.setValueAtTime(0.0001, now + n.start);
                    gain.gain.exponentialRampToValueAtTime(0.16, now + n.start + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);

                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now + n.start);
                    osc.stop(now + n.start + n.dur);
                });
            }
        } catch (e) {
            logDebug("Audio notification error: " + e.message);
        }
    }


    // Detect whether user is currently logged into Moodle
    function isUserLoggedIn() {
        if (window.location.pathname.includes('/login/')) return false;
        if (window.location.pathname.includes('/mod/') ||
            window.location.pathname.includes('/course/') ||
            window.location.pathname.includes('/my/')) {
            return true;
        }
        if (document.body && document.body.classList.contains('notloggedin')) return false;
        if (document.getElementById('page-login-index')) return false;
        if (document.querySelector('.usermenu, .usertext, #action-menu-toggle-0, .logininfo a[href*="/user/profile.php"]')) {
            return true;
        }
        if (window.M && window.M.cfg && typeof window.M.cfg.userId !== 'undefined') {
            return Number(window.M.cfg.userId) > 0;
        }
        return true;
    }

    // Reset all settings to safe defaults (turns off all aggressive features)
    function resetAllSettingsToDefault() {
        localStorage.setItem('amaes_auto_quiz_mode', 'false');
        localStorage.setItem('amaes_quiz_personality', 'passive');
        localStorage.setItem('amaes_auto_pick_quiz', 'true');
        localStorage.setItem('amaes_auto_next_quiz', 'false');
        localStorage.setItem('amaes_auto_next_verified', 'true');
        localStorage.setItem('amaes_auto_push_github', 'false');
        localStorage.setItem('amaes_auto_copy_search', 'true');
        localStorage.setItem('amaes_auto_cloud_sync', 'true');
        localStorage.setItem('amaes_auto_scrape_amauoed', 'true');
        localStorage.setItem('amaes_auto_harvest_grades', 'true');
        localStorage.setItem('amaes_enable_hotkeys', 'true');

        localStorage.setItem('amaes_auto_highlight_quiz', 'true');
        localStorage.setItem('amaes_copy_include_confidence', 'true');
        localStorage.setItem('amaes_auto_copy_ai', 'true');
        localStorage.setItem('amaes_smart_skip_quiz', 'false');
        localStorage.setItem('amaes_show_in_question_ai_btns', 'true');
        localStorage.setItem('amaes_ai_prompt_hint', 'true');
        localStorage.setItem('amaes_auto_community_share', 'true');
        localStorage.setItem('amaes_auto_min_quiz', 'false');
        localStorage.setItem('amaes_ai_quiz_enabled', 'true');
        localStorage.setItem('amaes_ai_auto_select', 'true');

        autoQuizMode = false;
        autoPickQuiz = true;
        autoNextVerified = true;
        autoNextQuiz = false;
        isWaitingForUserAnswer = false;
        smartSkipQuiz = false;
        autoHighlightQuiz = true;
        copyIncludeConfidence = true;
        autoScrapeAmauoed = true;
        autoCopyQuizForAI = true;
        autoCloudSync = true;
        autoHarvestGrades = true;
        showInQuestionAiBtns = true;
        aiPromptHint = true;
        enableKeyboardShortcuts = true;
        autoCommunityShare = true;
        autoMinimizeQuiz = false;
        enableAudioAlerts = true;
        aiQuizEnabled = true;
        aiAutoSelect = true;

        // Clear any running solver timers or state
        clearTimeout(autoNextTimer);
        autoNextTimer = null;
        clearTimeout(pageLoadSolverTimer);
        pageLoadSolverTimer = null;
        isSolverRunning = false;

        const updateCheck = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = val;
        };
        updateCheck('chk-auto-cloud-sync', true);
        updateCheck('chk-auto-scrape-amauoed', true);
        updateCheck('chk-auto-community-share', true);
        updateCheck('chk-auto-harvest-grades', true);
        updateCheck('chk-auto-hl-quiz', true);
        updateCheck('chk-copy-confidence', true);
        updateCheck('chk-auto-copy-ai', true);
        updateCheck('chk-smart-skip', false);
        updateCheck('chk-auto-min-quiz', false);
        updateCheck('chk-audio-alerts', true);
        updateCheck('chk-in-question-ai', true);
        updateCheck('chk-show-in-q-btns', true);
        updateCheck('chk-ai-hint', true);
        updateCheck('chk-ai-prompt-hint', true);
        updateCheck('chk-keyboard-shortcuts', true);
        updateCheck('chk-auto-pick', true);
        updateCheck('chk-auto-next-verified', true);
        updateCheck('chk-auto-next', false);
        updateCheck('chk-auto-dl-json', false);
        updateCheck('chk-auto-push-github', false);
        updateCheck('chk-auto-scrape-amauoed-quiz', true);

        // Update welcome modal checkboxes if open
        updateCheck('welcome-chk-sync', true);
        updateCheck('welcome-chk-share', true);
        updateCheck('welcome-chk-harvest', true);
        updateCheck('welcome-chk-hl', true);
        updateCheck('welcome-chk-copy', true);
        updateCheck('welcome-chk-skip', false);
        updateCheck('welcome-chk-hotkeys', true);
        updateCheck('welcome-chk-next', true);
        updateCheck('welcome-chk-submit', false);
        updateCheck('welcome-chk-dl', false);

        const btnPassive = document.getElementById('btn-personality-passive');
        const btnAggressive = document.getElementById('btn-personality-aggressive');
        const personalityDesc = document.getElementById('personality-desc');
        if (btnPassive && btnAggressive) {
            btnPassive.className = 'amaes-btn amaes-btn-blue';
            btnAggressive.className = 'amaes-btn amaes-btn-outline';
        }
        if (personalityDesc) {
            personalityDesc.innerHTML = '<b>Co-Pilot:</b> Auto-picks answers. On unknown question: pauses safely, auto-copies for AI, and waits.';
        }

        const btnMasterAutoQuiz = document.getElementById('btn-master-auto-quiz');
        if (btnMasterAutoQuiz) {
            btnMasterAutoQuiz.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            btnMasterAutoQuiz.innerHTML = `${ICONS.play} <span>Start Auto-Quiz</span>`;
        }

        const subtext = document.getElementById('amaes-autoquiz-subtext');
        if (subtext) {
            subtext.textContent = 'Auto-answers & advances. Pauses & copies on unknown questions.';
        }

        syncAutoQuizUI(false);

        // If on a quiz attempt page, re-highlight answers without selecting choices
        if (checkIsQuizAttemptPage()) {
            const courseInfo = detectCourseInfo();
            const subCode = courseInfo.subjectCode || 'CS6301';
            const cached = getCachedAnswers(subCode);
            if (cached && cached.length > 0) {
                highlightQuizAnswers(cached, false, true);
            }
        }

        setLog("Settings reset to defaults (Highlight ON, Auto-Quiz ready, Safe review enabled).", "var(--accent-blue)");
        showToast("Settings reset to safe defaults!");
    }

    // Remove toolkit-owned state without touching Moodle or other site data.
    function resetToolkitInstallation() {
        deleteContributorKey().catch(() => {});
        const removeOwnedState = (storage) => {
            if (!storage) return;
            const keys = [];
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key && key.startsWith('amaes_')) keys.push(key);
            }
            keys.forEach((key) => storage.removeItem(key));
        };

        removeOwnedState(localStorage);
        removeOwnedState(sessionStorage);
        resetAllSettingsToDefault();
        localStorage.removeItem('amaes_welcome_dismissed');
        localStorage.removeItem('amaes_terms_acknowledged');
        document.getElementById('amaes-welcome-modal')?.remove();
        if (typeof window._amaesUpdatePanelLockState === 'function') window._amaesUpdatePanelLockState();
        showToast("Toolkit data cleared. Reloading first-run setup...");
        setTimeout(() => window.location.reload(), 500);
    }

    // Helper to detect academic term from activity title, quiz name, or text
    function detectTermFromText(text) {
        if (!text || typeof text !== 'string') return null;
        const lower = text.toLowerCase();
        if (lower.includes('prelim') || lower.includes('preliminary') || /\bweek\s*[1-5]\b/i.test(lower)) {
            return 'Prelim';
        }
        if (lower.includes('midterm') || lower.includes('mid-term') || /\bweek\s*[6-9]\b/i.test(lower)) {
            return 'Midterm';
        }
        if (lower.includes('prefi') || lower.includes('pre-final') || lower.includes('prefinal') || /\bweek\s*(1[0-4])\b/i.test(lower)) {
            return 'Prefi';
        }
        if (lower.includes('final') || lower.includes('finals') || /\bweek\s*(1[5-9]|20)\b/i.test(lower)) {
            return 'Final';
        }
        return null;
    }

    // Calculates answer count breakdown per term (Prelim, Midterm, Prefi, Final)
    function getSubjectTermBreakdown(subCode) {
        const questions = getCachedAnswers(subCode) || [];
        const stats = {
            prelim: 0,
            midterm: 0,
            prefi: 0,
            final: 0,
            general: 0,
            total: questions.length
        };

        questions.forEach(q => {
            const term = q.period || q.term || detectTermFromText(q.sourceQuiz || q.quizTitle || q.question || q.qRaw || '');
            if (term === 'Prelim') stats.prelim++;
            else if (term === 'Midterm') stats.midterm++;
            else if (term === 'Prefi') stats.prefi++;
            else if (term === 'Final') stats.final++;
            else stats.general++;
        });

        return stats;
    }

    // Detects all enrolled courses visible on the Moodle dashboard or course catalog
    function detectDashboardCourses() {
        const results = [];
        const seen = new Set();
        const courseCards = document.querySelectorAll(`
            .dashboard-card,
            [data-region="card-item"],
            .course-info-container,
            .card.dashboard-card,
            .coursename,
            [data-region="course-content"],
            .coursebox
        `);

        courseCards.forEach(card => {
            const titleElem = card.querySelector('.coursename, .coursename .multiline, h3, h4, .text-truncate, a') || card;
            const cardText = (titleElem.innerText || card.innerText || '').trim();
            if (!cardText) return;

            let subCode = '';
            const codeMatch = cardText.match(/\b([A-Za-z]{2,6}\d{3,4}[A-Za-z]*)\b/) || cardText.match(/[-_]\s*([A-Za-z0-9]+)\b/);
            if (codeMatch) {
                subCode = codeMatch[1].toUpperCase();
            }

            let courseId = '';
            const linkElem = card.querySelector('a[href*="/course/view.php?id="], a[href*="id="]');
            if (linkElem && linkElem.href) {
                const idMatch = linkElem.href.match(/[?&]id=(\d+)/);
                if (idMatch) courseId = idMatch[1];
            }
            if (!courseId) {
                courseId = card.getAttribute('data-course-id') || card.getAttribute('data-courseid') || '';
            }

            const semPath = getSemesterBasePath();
            const courseUrl = linkElem && linkElem.href ? linkElem.href : (courseId ? `${window.location.origin}${semPath}course/view.php?id=${courseId}` : '');
            const gradesUrl = courseId ? `${window.location.origin}${semPath}grade/report/user/index.php?id=${courseId}` : '';

            if (subCode && subCode !== 'DEFAULT' && subCode !== 'GENERAL' && !seen.has(subCode)) {
                seen.add(subCode);
                const cached = getCachedAnswers(subCode);
                results.push({
                    code: subCode,
                    courseId,
                    courseUrl,
                    gradesUrl,
                    count: cached ? cached.length : 0,
                    title: cardText.split('\n')[0].trim()
                });
            }
        });

        return results;
    }

    // Injects verified DB indicators on home/dashboard course cards
    function injectDashboardCourseBadges() {
        if (!isUserLoggedIn()) return;

        // Clean up any stray badges accidentally injected inside course title anchors
        document.querySelectorAll('.coursename .amaes-home-db-badge, a .amaes-home-db-badge').forEach(b => b.remove());

        let courseCards = document.querySelectorAll(`
            .dashboard-card,
            [data-region="card-item"],
            .coursebox,
            .dashboard-card-list-item,
            .course-summaryitem
        `);

        if (courseCards.length === 0) {
            courseCards = document.querySelectorAll('.course-info-container');
        }

        if (courseCards.length === 0) return;

        const processedCards = new Set();

        courseCards.forEach(card => {
            const rootCard = card.closest('.dashboard-card, [data-region="card-item"], .coursebox, .dashboard-card-list-item, .course-summaryitem') || card;
            if (processedCards.has(rootCard)) return;
            processedCards.add(rootCard);

            const existingBadges = rootCard.querySelectorAll('.amaes-home-db-badge');
            if (existingBadges.length > 0) {
                // Keep only one badge, purge any duplicate badges
                existingBadges.forEach((b, idx) => { if (idx > 0) b.remove(); });
                return;
            }

            const titleElem = rootCard.querySelector('.coursename, .coursename .multiline, h3, h4, .text-truncate, a') || rootCard;
            const cardText = (titleElem.innerText || rootCard.innerText || '').trim();
            if (!cardText) return;

            let subCode = '';
            const codeMatch = cardText.match(/\b([A-Za-z]{2,6}\d{3,4}[A-Za-z]*)\b/) || cardText.match(/[-_]\s*([A-Za-z0-9]+)\b/);
            if (codeMatch) {
                subCode = codeMatch[1].toUpperCase();
            }

            if (!subCode) return;

            const cached = getCachedAnswers(subCode);
            const count = cached ? cached.length : 0;
            const termStats = getSubjectTermBreakdown(subCode);
            const readyTerms = [];
            if (termStats.prelim > 0) readyTerms.push('Prelim');
            if (termStats.midterm > 0) readyTerms.push('Mid');
            if (termStats.prefi > 0) readyTerms.push('Prefi');
            if (termStats.final > 0) readyTerms.push('Final');

            const badgeWrapper = document.createElement('div');
            badgeWrapper.className = 'amaes-home-db-badge-wrapper';
            badgeWrapper.style.cssText = `
                display: flex;
                align-items: center;
                margin-top: 4px;
                margin-bottom: 2px;
                pointer-events: none;
            `;

            const badge = document.createElement('span');
            badge.className = 'amaes-home-db-badge';
            badge.style.cssText = `
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 2px 7px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: 600;
                line-height: 1.3;
                cursor: default;
                user-select: none;
                pointer-events: none;
                ${count >= 100 || readyTerms.length === 4
                    ? 'background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.4); color: #059669;' 
                    : count > 0 
                    ? 'background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); color: #047857;' 
                    : 'background: rgba(148, 163, 184, 0.1); border: 1px solid rgba(148, 163, 184, 0.25); color: #64748b;'}
            `;

            if (readyTerms.length === 4 || count >= 100) {
                badge.innerHTML = `${ICONS.checkBadge} <span><b>All Terms Ready</b> • ${count} Qs</span>`;
                badge.title = `${subCode} Study Database: Complete question bank covering Prelim, Midterm, Prefi & Final (${count} verified questions).`;
            } else if (readyTerms.length > 0) {
                badge.innerHTML = `${ICONS.database} <span><b>${readyTerms.join('/')} Ready</b> • ${count} Qs</span>`;
                badge.title = `${subCode} Study Database: ${readyTerms.join(', ')} covered (${count} verified questions).`;
            } else if (count > 0) {
                badge.innerHTML = `${ICONS.database} <span><b>Verified DB</b> • ${count} Qs</span>`;
                badge.title = `${subCode} Study Database: ${count} verified questions available.`;
            } else {
                badge.innerHTML = `${ICONS.cloudDownload} <span>${subCode} • No Local DB</span>`;
                badge.title = `${subCode}: No verified answers cached in local database.`;
            }

            badgeWrapper.appendChild(badge);

            const targetContainer = rootCard.querySelector('.course-info-container, .card-body, [data-region="course-content"]') || rootCard;
            targetContainer.appendChild(badgeWrapper);
        });
    }

    // Displays an onboarding callout banner on the Moodle dashboard for new users
    function injectDashboardGuideBanner() {
        if (!isUserLoggedIn()) return;
        if (!window.location.pathname.includes('/my/') && !window.location.pathname.includes('courses.php')) return;
        if (document.getElementById('amaes-dashboard-guide-banner')) return;
        if (localStorage.getItem('amaes_guide_banner_dismissed') === 'true') return;

        const allDbs = getAllSavedSubjectDatabases();
        const totalCached = Object.values(allDbs).reduce((acc, list) => acc + (list ? list.length : 0), 0);
        if (totalCached > 50) return;

        const container = document.querySelector('#region-main, .course-wrapper, [data-region="courses-view"], .dashboard-card-deck') || document.body;
        if (!container) return;

        const dashCourses = detectDashboardCourses();
        const courseCount = dashCourses.length;

        const banner = document.createElement('div');
        banner.id = 'amaes-dashboard-guide-banner';
        banner.style.cssText = `
            margin: 12px 0;
            padding: 10px 14px;
            background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
            border: 1px solid rgba(59, 130, 246, 0.4);
            border-left: 4px solid var(--accent-blue, #3b82f6);
            border-radius: 8px;
            color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            font-size: 11.5px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            z-index: 10;
        `;

        banner.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                <span style="display: flex; align-items: center; justify-content: center; background: rgba(59, 130, 246, 0.2); color: #60a5fa; width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0;">
                    ${ICONS.cloudDownload}
                </span>
                <div>
                    <div style="font-weight: 700; color: #fff; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                        <span>Auto-Sync Database Ready</span>
                        <span style="font-size: 9.5px; background: rgba(16, 185, 129, 0.2); color: #34d399; padding: 1px 6px; border-radius: 4px; font-weight: 700;">100% Autonomous</span>
                    </div>
                    <div style="color: #cbd5e1; font-size: 11px; margin-top: 2px;">
                        ${courseCount > 0
                            ? `Detected <b>${courseCount} courses</b> (${dashCourses.map(c => c.code).join(', ')}). Open any course to auto-sync answers, or click below to pull verified databases now!`
                            : 'Open any enrolled course to automatically sync verified questions and answers from the community database!'}
                    </div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                ${courseCount > 0 ? `
                    <button id="btn-banner-sync-all" class="amaes-btn amaes-btn-green" style="font-size: 10.5px; padding: 5px 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                        ${ICONS.zap} <span>Sync All Courses Now</span>
                    </button>
                ` : ''}
                <button id="btn-banner-dismiss-guide" style="background: none; border: none; color: #94a3b8; font-size: 16px; cursor: pointer; padding: 2px 6px; line-height: 1;" title="Dismiss">&times;</button>
            </div>
        `;

        if (container === document.body) {
            banner.style.position = 'fixed';
            banner.style.top = '60px';
            banner.style.right = '20px';
            banner.style.maxWidth = '460px';
            banner.style.zIndex = '9999';
            document.body.appendChild(banner);
        } else {
            container.insertBefore(banner, container.firstChild);
        }

        const dismissBtn = banner.querySelector('#btn-banner-dismiss-guide');
        if (dismissBtn) {
            dismissBtn.onclick = () => {
                localStorage.setItem('amaes_guide_banner_dismissed', 'true');
                banner.remove();
            };
        }

        const syncAllBtn = banner.querySelector('#btn-banner-sync-all');
        if (syncAllBtn) {
            syncAllBtn.onclick = () => {
                syncAllBtn.disabled = true;
                syncAllBtn.innerHTML = `${ICONS.rotateCcw} <span>Syncing...</span>`;
                let completed = 0;
                let totalFound = 0;
                dashCourses.forEach(c => {
                    syncAnswersFromCloud(c.code).then(res => {
                        if (res && res.count) totalFound += res.count;
                    }).finally(() => {
                        completed++;
                        if (completed === dashCourses.length) {
                            showToast(`Auto-sync complete! Loaded ${totalFound} answers across ${completed} courses.`);
                            injectDashboardCourseBadges();
                            syncAllBtn.innerHTML = `${ICONS.check} <span>Synced!</span>`;
                            setTimeout(() => {
                                banner.remove();
                            }, 2500);
                        }
                    });
                });
            };
        }
    }

