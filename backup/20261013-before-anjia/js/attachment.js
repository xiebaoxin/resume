(function () {
  const LANG_KEY = 'resume-lang';
  const DEFAULT_LANG = 'zh';
  const DATA_VERSION = '20260313-2';
  const attachment = document.body.getAttribute('data-attachment') || 'portfolio';

  function getLang() {
    const hash = (window.location.hash || '').toLowerCase();
    if (hash === '#en' || hash === '#english') return 'en';
    if (hash === '#zh' || hash === '#cn') return 'zh';
    try {
      return localStorage.getItem(LANG_KEY) || DEFAULT_LANG;
    } catch (_) {
      return DEFAULT_LANG;
    }
  }

  function setLang(lang) {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (_) {}
    window.location.hash = lang === 'en' ? 'en' : '';
  }

  function escapeHtml(s) {
    if (!s) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function renderImage(src, className, alt, options) {
    var opts = options || {};
    var attrs = [
      'src="' + escapeHtml(src) + '"',
      'alt="' + escapeHtml(alt || '') + '"',
      'class="' + escapeHtml(className) + '"',
      'loading="' + (opts.loading || 'lazy') + '"',
      'decoding="' + (opts.decoding || 'async') + '"'
    ];
    if (opts.fetchPriority) {
      attrs.push('fetchpriority="' + escapeHtml(opts.fetchPriority) + '"');
    }
    return '<img ' + attrs.join(' ') + '>';
  }

  function renderPortfolio(data) {
    if (data.pageTitle) document.getElementById('pageTitle').textContent = data.pageTitle;
    var introEl = document.getElementById('pageIntro');
    if (introEl) {
      if (data.intro) {
        introEl.textContent = data.intro;
        introEl.style.display = '';
      } else {
        introEl.textContent = '';
        introEl.style.display = 'none';
      }
    }
    var showcaseEl = document.getElementById('portfolioShowcase');
    if (showcaseEl && data.showcase && data.showcase.src) {
      showcaseEl.innerHTML = renderImage(data.showcase.src, 'portfolio-showcase-img', '', {
        loading: 'lazy',
        decoding: 'async',
        fetchPriority: 'low'
      }) + '<figcaption class="portfolio-showcase-caption">' + escapeHtml(data.showcase.caption || '') + '</figcaption>';
      showcaseEl.style.display = '';
    } else if (showcaseEl) showcaseEl.style.display = 'none';
    var productList = document.getElementById('productImagesList');
    if (productList && data.productImages && data.productImages.length) {
      productList.innerHTML = data.productImages.map(function (item) {
        return '<figure class="project-image-fig">' + renderImage(item.src, 'project-image-img', '', {
          loading: 'lazy',
          decoding: 'async',
          fetchPriority: 'low'
        }) + '<figcaption class="project-image-caption">' + escapeHtml(item.caption) + '</figcaption></figure>';
      }).join('');
      productList.style.display = '';
    } else if (productList) productList.style.display = 'none';
    var list = document.getElementById('portfolioList');
    if (list && data.items && data.items.length) {
      list.innerHTML = data.items.map(function (item) {
        return '<li><span class="period">' + escapeHtml(item.period) + '</span><p class="desc">' + escapeHtml(item.desc) + '</p></li>';
      }).join('');
    }
  }

  function renderDetail(data) {
    var ui = data.ui || {};
    document.getElementById('pageTitle').textContent = data.pageTitle;
    document.getElementById('langSwitch').textContent = ui.langSwitch || 'English';
    document.getElementById('backLink').textContent = ui.backToResume || '← Back to Resume';
    document.getElementById('backLink').setAttribute('href', 'index.html');
    if (data.meta && data.meta.title) document.title = data.meta.title;
    if (data.meta && data.meta.lang) document.documentElement.lang = data.meta.lang === 'en' ? 'en' : 'zh-CN';

    var sections = data.sections || {};
    var s = sections.work;
    if (s && s.items && s.items.length) {
      document.getElementById('workTitle').textContent = s.title;
      document.getElementById('workList').innerHTML = s.items.map(function (item) {
        return '<li><div class="detail-item-head"><span class="detail-item-company">' + escapeHtml(item.company) + '</span><span class="detail-item-period">' + escapeHtml(item.period) + '</span></div><div class="detail-item-role">' + escapeHtml(item.role) + '</div><p class="detail-item-summary">' + escapeHtml(item.summary) + '</p></li>';
      }).join('');
    }
    s = sections.projects;
    if (s && s.items && s.items.length) {
      document.getElementById('projectsTitle').textContent = s.title;
      document.getElementById('projectsList').innerHTML = s.items.map(function (item) {
        return '<li><div class="project-name">' + escapeHtml(item.name) + '</div><p class="project-desc">' + escapeHtml(item.desc) + '</p></li>';
      }).join('');
    }
    s = sections.cursorScreenshots;
    if (s && s.items && s.items.length) {
      document.getElementById('cursorScreenshotsSection').style.display = '';
      document.getElementById('cursorScreenshotsTitle').textContent = s.title;
      document.getElementById('cursorScreenshotsList').innerHTML = s.items.map(function (item) {
        return '<figure class="project-image-fig">' + renderImage(item.src, 'project-image-img', '', {
          loading: 'lazy',
          decoding: 'async',
          fetchPriority: 'low'
        }) + '<figcaption class="project-image-caption">' + escapeHtml(item.caption) + '</figcaption></figure>';
      }).join('');
    } else {
      document.getElementById('cursorScreenshotsSection').style.display = 'none';
    }
    s = sections.skills;
    if (s) {
      document.getElementById('skillsTitle').textContent = s.title;
      if (s.tech && s.tech.length) {
        document.getElementById('skillsTech').innerHTML = s.tech.map(function (t) {
          return '<span class="tag">' + escapeHtml(t) + '</span>';
        }).join('');
      }
      if (s.tools) document.getElementById('skillsTools').textContent = s.tools;
      if (s.domain) document.getElementById('skillsDomain').textContent = s.domain;
    }
    s = sections.education;
    if (s) {
      document.getElementById('educationTitle').textContent = s.title;
      document.getElementById('educationContent').textContent = [s.school, s.degree, s.major, s.period].filter(Boolean).join(' · ');
    }
    s = sections.cert;
    var certSection = document.getElementById('certSection');
    if (certSection) {
      if (s && s.items && s.items.length) {
        certSection.style.display = '';
        document.getElementById('certTitle').textContent = s.title;
        document.getElementById('certList').innerHTML = s.items.map(function (item) {
          return '<li>' + escapeHtml(item) + '</li>';
        }).join('');
      } else {
        certSection.style.display = 'none';
      }
    }
  }

  function applyData(data) {
    if (attachment === 'portfolio') {
      var ui = data.ui || {};
      document.getElementById('langSwitch').textContent = ui.langSwitch || 'English';
      document.getElementById('backLink').textContent = ui.backToResume || '← Back to Resume';
      document.getElementById('backLink').setAttribute('href', 'index.html');
      if (data.meta && data.meta.title) document.title = data.meta.title;
      if (data.meta && data.meta.lang) document.documentElement.lang = data.meta.lang === 'en' ? 'en' : 'zh-CN';
      renderPortfolio(data);
    } else {
      renderDetail(data);
    }
  }

  function loadLang(lang, callback) {
    var file = attachment === 'portfolio' ? 'portfolio' : 'detail';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'data/' + file + '-' + (lang === 'en' ? 'en' : 'zh') + '.json?v=' + encodeURIComponent(DATA_VERSION), true);
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 400) {
        try {
          callback(null, JSON.parse(xhr.responseText));
        } catch (e) {
          callback(e);
        }
      } else {
        callback(new Error('HTTP ' + xhr.status));
      }
    };
    xhr.onerror = function () { callback(new Error('Network error')); };
    xhr.send();
  }

  function init() {
    var lang = getLang();
    document.getElementById('langSwitch').addEventListener('click', function () {
      var next = lang === 'zh' ? 'en' : 'zh';
      setLang(next);
      loadLang(next, function (err, data) {
        if (!err) {
          lang = next;
          applyData(data);
        }
      });
    });
    loadLang(lang, function (err, data) {
      if (err) {
        if (lang !== 'zh') loadLang('zh', function (e2, d2) { if (!e2) applyData(d2); });
        return;
      }
      applyData(data);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
