(function () {
  'use strict';

  var LANG_KEY = 'resume-lang';
  var DATA_VERSION = '20260316-2';
  var DEFAULT_LANG = 'zh';

  function escapeHtml(s) {
    if (!s) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function compactText(text, lang, maxZh, maxEn) {
    if (!text) return '';
    var clean = String(text).replace(/\s+/g, ' ').trim();
    var max = lang === 'en' ? maxEn : maxZh;
    if (clean.length <= max) return clean;
    return clean.slice(0, Math.max(1, max - 1)).trim() + '…';
  }

  function isMobileViewport() {
    return window.innerWidth < 700;
  }

  function fitSingleSilkPage(done) {
    var body = document.body;
    var level = 0;
    var maxLevel = 2;

    function applyLevel(nextLevel) {
      body.classList.remove('silk-fit-compact-1', 'silk-fit-compact-2');
      if (nextLevel >= 1) body.classList.add('silk-fit-compact-1');
      if (nextLevel >= 2) body.classList.add('silk-fit-compact-2');
    }

    function isOverflowing() {
      var page = document.querySelector('.page');
      var main = document.querySelector('.silk-main');
      var viewportH = window.innerHeight;
      var bodyOverflow = document.body.scrollHeight > viewportH + 2;
      var pageOverflow = page && page.scrollHeight > page.clientHeight + 2;
      var mainOverflow = main && main.scrollHeight > main.clientHeight + 2;
      return !!(bodyOverflow || pageOverflow || mainOverflow);
    }

    function step() {
      if (!isOverflowing() || level >= maxLevel) {
        if (typeof done === 'function') done();
        return;
      }
      level += 1;
      applyLevel(level);
      requestAnimationFrame(step);
    }

    applyLevel(0);
    requestAnimationFrame(step);
  }

  function getLang() {
    var hash = (window.location.hash || '').toLowerCase();
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
    if (lang === 'en') {
      window.location.hash = 'en';
    } else {
      window.location.hash = '';
    }
  }

  function renderContact(data, isMobile) {
    var contact = data.basics.contact || {};
    var parts = [];
    if (!isMobile && contact.phone) parts.push('<span>Tel: ' + escapeHtml(contact.phone) + '</span>');
    if (contact.email) parts.push('<span>Email: ' + escapeHtml(contact.email) + '</span>');
    if (contact.wechat) parts.push('<span>WeChat: ' + escapeHtml(contact.wechat) + '</span>');
    if (parts.length === 0 && contact.phone) parts.push('<span>Tel: ' + escapeHtml(contact.phone) + '</span>');
    return parts.join('');
  }

  function renderExperience(items, lang, isMobile) {
    if (!Array.isArray(items)) return '';
    var limit = isMobile ? 1 : 2;
    return items.slice(0, limit).map(function (item) {
      return (
        '<li class="exp-item">' +
        '<div class="exp-item-head">' +
        '<span class="exp-item-company">' + escapeHtml(item.company) + '</span>' +
        '<span class="exp-item-period">' + escapeHtml(item.period) + '</span>' +
        '</div>' +
        '<div class="exp-item-role">' + escapeHtml(item.role) + '</div>' +
        '<p class="exp-item-summary">' + escapeHtml(compactText(item.summary, lang, isMobile ? 30 : 38, isMobile ? 52 : 70)) + '</p>' +
        '</li>'
      );
    }).join('');
  }

  function renderTech(tech, isMobile) {
    if (!Array.isArray(tech)) return '';
    return tech.slice(0, isMobile ? 4 : 6).map(function (t) {
      return '<span class="tag">' + escapeHtml(t) + '</span>';
    }).join('');
  }

  function applyData(data) {
    var d = document;
    var lang = (data.meta && data.meta.lang) === 'en' ? 'en' : 'zh';
    var mobile = isMobileViewport();
    var basics = data.basics || {};
    var highlight = data.highlight || {};
    var skills = data.skills || {};
    var education = data.education || {};
    var experience = data.experience || {};

    d.getElementById('name').textContent = data.name || '';
    d.getElementById('basicsLine').textContent = [basics.genderAge, basics.location, basics.yearsExp].filter(Boolean).join(' · ');
    d.getElementById('targetRole').textContent = compactText(basics.targetRole || '', lang, mobile ? 18 : 26, mobile ? 30 : 52);
    d.getElementById('tagline').textContent = compactText(basics.tagline || '', lang, mobile ? 30 : 42, mobile ? 52 : 82);
    d.getElementById('contact').innerHTML = renderContact(data, mobile);

    d.getElementById('highlightTitle').textContent = highlight.title || '';
    d.getElementById('highlightCompany').textContent = compactText(highlight.company || '', lang, mobile ? 14 : 22, mobile ? 24 : 38);
    d.getElementById('highlightPeriod').textContent = compactText(highlight.period || '', lang, mobile ? 10 : 16, mobile ? 18 : 28);
    d.getElementById('highlightRole').textContent = compactText(highlight.role || '', lang, mobile ? 20 : 30, mobile ? 38 : 56);
    d.getElementById('metricPlay').textContent = compactText((highlight.metrics && highlight.metrics.play) || '', lang, mobile ? 20 : 26, mobile ? 34 : 58);
    d.getElementById('metricAppstore').textContent = compactText((highlight.metrics && highlight.metrics.appstore) || '', lang, mobile ? 20 : 26, mobile ? 34 : 58);
    d.getElementById('aiNote').textContent = compactText(highlight.aiNote || '', lang, mobile ? 24 : 34, mobile ? 42 : 66);

    d.getElementById('experienceTitle').textContent = (experience.title || '');
    d.getElementById('experienceList').innerHTML = renderExperience(experience.items || [], lang, mobile);

    d.getElementById('skillsTitle').textContent = skills.title || '';
    d.getElementById('skillsLead').textContent = compactText(skills.lead || '', lang, mobile ? 34 : 46, mobile ? 62 : 88);
    d.getElementById('skillsTech').innerHTML = renderTech(skills.tech || [], mobile);
    d.getElementById('skillsDomain').textContent = compactText(skills.domain || '', lang, mobile ? 32 : 44, mobile ? 58 : 92);

    d.getElementById('educationTitle').textContent = education.title || '';
    d.getElementById('educationContent').textContent = [
      education.school,
      education.degree,
      education.major,
      education.period
    ].filter(Boolean).join(mobile ? ' / ' : ' · ');

    d.getElementById('langSwitch').textContent = lang === 'en' ? '中文' : 'English';
    var modeSwitch = d.querySelector('.mode-switch');
    if (modeSwitch) {
      modeSwitch.textContent = lang === 'en' ? 'Classic' : '普通版';
    }
    if (data.meta && data.meta.title) {
      d.title = data.meta.title + (lang === 'en' ? ' (Silk)' : '（丝绸版）');
    }
    if (data.meta && data.meta.lang) {
      d.documentElement.lang = data.meta.lang === 'en' ? 'en' : 'zh-CN';
    }
    fitSingleSilkPage(function () {
      document.dispatchEvent(new CustomEvent('silk-content-ready'));
    });
  }

  function loadLang(lang, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'data/' + (lang === 'en' ? 'en' : 'zh') + '.json?v=' + encodeURIComponent(DATA_VERSION), true);
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
    xhr.onerror = function () {
      callback(new Error('Network error'));
    };
    xhr.send();
  }

  function init() {
    var lang = getLang();
    var switchBtn = document.getElementById('langSwitch');
    switchBtn.addEventListener('click', function () {
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
        if (lang !== 'zh') {
          loadLang('zh', function (e2, d2) {
            if (!e2) applyData(d2);
          });
        }
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
