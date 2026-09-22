(function () {
  'use strict';

  const links = {
    chrome: 'https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag',
    edge: 'https://microsoftedge.microsoft.com/addons/detail/eeagobfjdenkkddmbclomhiblgggliao',
    firefox: 'https://addons.mozilla.org/en-US/firefox/addon/violentmonkey/',
    other: 'https://violentmonkey.github.io/get-it/'
  };
  const names = { chrome: 'Chrome / Chromium', edge: 'Microsoft Edge', firefox: 'Firefox', other: 'your browser' };
  const browserName = document.getElementById('browser-name');
  const managerLink = document.getElementById('manager-link');
  const statusCard = document.getElementById('status-card');
  const statusTitle = document.getElementById('status-title');
  const statusCopy = document.getElementById('status-copy');
  const checkResult = document.getElementById('check-result');
  const versionResult = document.getElementById('version-result');
  const scriptLink = document.getElementById('script-link');
  const activeActions = document.getElementById('active-actions');
  const toolkitStepTitle = document.getElementById('toolkit-step-title');
  const browserStep = document.getElementById('browser-step');
  const managerStep = document.getElementById('manager-step');
  const allowScriptsText = document.getElementById('allow-scripts-text');
  let detectedVersion = null;
  let latestVersion = null;

  function parseVersion(version) {
    const match = String(version || '').trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)$/);
    return match ? match.slice(1).map(Number) : null;
  }

  function compareVersions(left, right) {
    const a = parseVersion(left);
    const b = parseVersion(right);
    if (!a || !b) return null;
    for (let i = 0; i < 3; i++) {
      if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
    }
    return 0;
  }

  function renderVersionStatus() {
    if (!detectedVersion || !latestVersion) return;
    const comparison = compareVersions(detectedVersion, latestVersion);
    if (comparison === null) {
      versionResult.className = 'version-result outdated';
      versionResult.textContent = 'Installed version could not be compared with the latest release.';
      return;
    }
    if (comparison < 0) {
      versionResult.className = 'version-result outdated';
      versionResult.innerHTML = 'Update available: <strong>v' + latestVersion + '</strong> <a href="https://github.com/Acads-Tools/amaes-toolkit/releases/latest" target="_blank" rel="noreferrer">View release ↗</a>';
    } else if (comparison === 0) {
      versionResult.className = 'version-result current';
      versionResult.textContent = 'Up to date';
    } else {
      versionResult.className = 'version-result current';
      versionResult.textContent = 'Installed version is newer than the published release.';
    }
  }

  function announceDetected(event) {
    detectedVersion = event.detail && event.detail.version ? event.detail.version : 'installed';
    document.body.classList.add('toolkit-active');
    toolkitStepTitle.textContent = 'Toolkit Ready';
    activeActions.hidden = false;
    browserStep.classList.add('completed');
    managerStep.classList.add('completed');
    managerLink.textContent = 'Open Violentmonkey ↗';
    managerLink.classList.remove('completed-action');
    managerLink.removeAttribute('aria-disabled');
    if (statusCard) statusCard.dataset.state = 'found';
    if (statusTitle) statusTitle.textContent = 'AMAES Toolkit detected';
    if (statusCopy) statusCopy.textContent = 'Version ' + detectedVersion + ' is active on this page.';
    checkResult.textContent = 'Toolkit detected';
    renderVersionStatus();
  }

  function detectFromPageMarker() {
    const marker = document.documentElement.getAttribute('data-amaes-toolkit-version');
    if (marker) announceDetected({ detail: { version: marker } });
  }

  document.addEventListener('amaes-toolkit-detected', announceDetected);
  window.addEventListener('load', function () {
    detectFromPageMarker();
    setTimeout(function () {
      if (!detectedVersion) {
        if (statusCard) statusCard.dataset.state = 'missing';
        if (statusTitle) statusTitle.textContent = 'Toolkit not detected yet';
        if (statusCopy) statusCopy.textContent = 'Install it below, then refresh this page and check again.';
      }
    }, 1200);
  });

  function chooseBrowser(browser) {
    document.querySelectorAll('.browser-choice').forEach(function (button) {
      button.classList.toggle('selected', button.dataset.browser === browser);
    });
    browserName.textContent = names[browser];
    managerLink.href = links[browser] || links.other;
    managerLink.textContent = browser === 'chrome'
      ? 'Install from Chrome Web Store ↗'
      : browser === 'edge'
      ? 'Install from Edge Add-ons ↗'
      : browser === 'firefox'
      ? 'Install from Firefox Add-ons ↗'
      : 'Get Violentmonkey ↗';
    if (allowScriptsText) {
      if (browser === 'chrome') {
        allowScriptsText.innerHTML = '<strong>Chrome &amp; Brave:</strong> Open <code>chrome://extensions</code> or click the Extensions icon in your toolbar, turn <strong>Developer mode</strong> ON (top right), then toggle ON <strong>Allow access to user scripts</strong> for Violentmonkey.';
      } else if (browser === 'edge') {
        allowScriptsText.innerHTML = '<strong>Edge:</strong> Open <code>edge://extensions</code>, toggle <strong>Developer mode</strong> ON, and ensure user scripts are allowed.';
      } else if (browser === 'firefox') {
        allowScriptsText.innerHTML = '<strong>Firefox:</strong> Click <strong>Add to Firefox</strong>. Once added, click the Violentmonkey extension icon in your toolbar and ensure user scripts are enabled and allowed to run.';
      } else {
        allowScriptsText.innerHTML = 'In your browser extension settings, ensure <strong>Developer mode</strong> or <strong>Allow user scripts</strong> is turned <strong>ON</strong>.';
      }
    }
  }

  const ua = navigator.userAgent.toLowerCase();
  const detectedBrowser = ua.includes('edg/') ? 'edge' : ua.includes('firefox') ? 'firefox' : ua.includes('chrome') || ua.includes('chromium') ? 'chrome' : 'other';
  document.querySelectorAll('.browser-choice').forEach(function (button) {
    button.addEventListener('click', function () { chooseBrowser(button.dataset.browser); });
  });
  chooseBrowser(detectedBrowser);
  document.getElementById('check-button').addEventListener('click', function () {
    checkResult.style.color = '';
    checkResult.textContent = 'Checking…';
    detectFromPageMarker();
    if (!detectedVersion) {
      setTimeout(function () {
        checkResult.textContent = 'Not detected yet — make sure you clicked "Confirm installation" in Violentmonkey, then refresh this page.';
        checkResult.style.color = '#fbbf24';
      }, 250);
    } else {
      checkResult.textContent = 'Toolkit detected and active!';
    }
    renderVersionStatus();
  });

  fetch('https://api.github.com/repos/Acads-Tools/amaes-toolkit/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (response) { if (!response.ok) throw new Error('release lookup failed'); return response.json(); })
    .then(function (release) {
      document.getElementById('release-version').textContent = release.tag_name || 'latest stable';
      latestVersion = release.tag_name ? release.tag_name.replace(/^v/i, '') : null;
      renderVersionStatus();
      if (release.html_url) document.getElementById('release-version').parentElement.title = 'View ' + release.tag_name + ' on GitHub';
      const asset = (release.assets || []).find(function (item) { return item.name === 'amaes-toolkit.user.js'; });
      if (asset && asset.browser_download_url) {
        document.getElementById('script-link').href = asset.browser_download_url;
        document.getElementById('reinstall-link').href = asset.browser_download_url;
      }
    })
    .catch(function () { document.getElementById('release-version').textContent = 'latest stable'; });

  // Always open at the top on load/refresh and clear any lingering hash
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  window.scrollTo(0, 0);

  // Smooth scroll to sections without leaving hash in address bar
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Fullscreen QR Code Modal & Download
  const qrLink = document.getElementById('qr-card-link') || document.querySelector('.qr-download-link');
  const qrModal = document.getElementById('qr-modal');
  const qrModalClose = document.getElementById('qr-modal-close');
  const qrModalDismiss = document.getElementById('qr-modal-dismiss-btn');
  const qrModalFullscreen = document.getElementById('qr-modal-fullscreen-btn');
  const qrModalFullscreenText = document.getElementById('qr-modal-fullscreen-text');

  function openQrModal() {
    if (!qrModal) return;
    qrModal.hidden = false;
    requestAnimationFrame(function () {
      qrModal.classList.add('active');
    });
    document.body.style.overflow = 'hidden';
  }

  function closeQrModal() {
    if (!qrModal) return;
    qrModal.classList.remove('active');
    document.body.style.overflow = '';
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }
    setTimeout(function () {
      if (!qrModal.classList.contains('active')) {
        qrModal.hidden = true;
      }
    }, 250);
  }

  function toggleFullscreen() {
    if (!qrModal) return;
    if (!document.fullscreenElement) {
      const req = qrModal.requestFullscreen || qrModal.webkitRequestFullscreen || qrModal.msRequestFullscreen;
      if (req) {
        req.call(qrModal).catch(function () {});
      }
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (exit) {
        exit.call(document).catch(function () {});
      }
    }
  }

  function updateFullscreenButton() {
    if (!qrModalFullscreenText) return;
    qrModalFullscreenText.textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen';
  }

  if (qrLink) {
    qrLink.addEventListener('click', function () {
      openQrModal();
    });
  }

  if (qrModalClose) qrModalClose.addEventListener('click', closeQrModal);
  if (qrModalDismiss) qrModalDismiss.addEventListener('click', closeQrModal);
  if (qrModalFullscreen) qrModalFullscreen.addEventListener('click', toggleFullscreen);

  if (qrModal) {
    qrModal.addEventListener('click', function (e) {
      if (e.target === qrModal || e.target.classList.contains('qr-modal-container')) {
        closeQrModal();
      }
    });
  }

  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Escape' || e.key === 'Esc') && qrModal && qrModal.classList.contains('active')) {
      closeQrModal();
    }
  });

  document.addEventListener('fullscreenchange', updateFullscreenButton);
  document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
}());

