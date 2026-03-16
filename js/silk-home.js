(function () {
  'use strict';

  var LANG_KEY = 'resume-lang';
  var DATA_VERSION = '20260316-4';
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
    if (contact.phone) parts.push('<span>Tel: ' + escapeHtml(contact.phone) + '</span>');
    if (contact.email) parts.push('<span>Email: ' + escapeHtml(contact.email) + '</span>');
    if (contact.wechat) parts.push('<span>WeChat: ' + escapeHtml(contact.wechat) + '</span>');
    if (!isMobile && contact.resumeRepo && contact.resumeRepoLabel) {
      parts.push('<span>' + escapeHtml(contact.resumeRepoLabel) + '：<a href="' + escapeHtml(contact.resumeRepo) + '" target="_blank" rel="noopener noreferrer" class="contact-link">' + escapeHtml(contact.resumeRepo) + '</a></span>');
    }
    if (parts.length === 0 && contact.phone) parts.push('<span>Tel: ' + escapeHtml(contact.phone) + '</span>');
    return parts.join('');
  }

  function renderExperience(items, lang, isMobile, isShortMobile) {
    if (!Array.isArray(items)) return '';
    var limit = isShortMobile ? 1 : (isMobile ? 1 : 3);
    return items.slice(0, limit).map(function (item) {
      return (
        '<li class="exp-item">' +
        '<div class="exp-item-head">' +
        '<span class="exp-item-company">' + escapeHtml(item.company) + '</span>' +
        '<span class="exp-item-period">' + escapeHtml(item.period) + '</span>' +
        '</div>' +
        '<div class="exp-item-role">' + escapeHtml(item.role) + '</div>' +
        '<p class="exp-item-summary">' + escapeHtml(compactText(item.summary, lang, isShortMobile ? 24 : (isMobile ? 34 : 78), isShortMobile ? 46 : (isMobile ? 64 : 170))) + '</p>' +
        '</li>'
      );
    }).join('');
  }

  function renderProducts(items, lang, isMobile, isShortMobile) {
    if (!Array.isArray(items)) return '';
    var limit = isShortMobile ? 1 : (isMobile ? 1 : 2);
    return items.slice(0, limit).map(function (p) {
      var text = (p.name || '') + ' ' + compactText(p.desc || '', lang, isShortMobile ? 12 : (isMobile ? 18 : 42), isShortMobile ? 20 : (isMobile ? 34 : 90));
      return '<div class="product">' + escapeHtml(text) + '</div>';
    }).join('');
  }

  function renderTech(tech, isMobile, isShortMobile) {
    if (!Array.isArray(tech)) return '';
    return tech.slice(0, isShortMobile ? 3 : (isMobile ? 4 : 10)).map(function (t) {
      return '<span class="tag">' + escapeHtml(t) + '</span>';
    }).join('');
  }

  function applyData(data) {
    var d = document;
    var lang = (data.meta && data.meta.lang) === 'en' ? 'en' : 'zh';
    var mobile = isMobileViewport();
    var shortMobile = mobile && window.innerHeight < 720;
    var basics = data.basics || {};
    var highlight = data.highlight || {};
    var skills = data.skills || {};
    var education = data.education || {};
    var experience = data.experience || {};

    d.getElementById('name').textContent = data.name || '';
    d.getElementById('basicsLine').textContent = [basics.genderAge, basics.location, basics.yearsExp].filter(Boolean).join(' · ');
    d.getElementById('targetRole').textContent = compactText(basics.targetRole || '', lang, shortMobile ? 16 : (mobile ? 22 : 44), shortMobile ? 28 : (mobile ? 42 : 92));
    d.getElementById('tagline').textContent = compactText(basics.tagline || '', lang, shortMobile ? 24 : (mobile ? 40 : 110), shortMobile ? 40 : (mobile ? 72 : 220));
    d.getElementById('contact').innerHTML = renderContact(data, mobile);

    d.getElementById('highlightTitle').textContent = highlight.title || '';
    d.getElementById('highlightCompany').textContent = compactText(highlight.company || '', lang, shortMobile ? 10 : (mobile ? 14 : 36), shortMobile ? 18 : (mobile ? 24 : 72));
    d.getElementById('highlightPeriod').textContent = compactText(highlight.period || '', lang, shortMobile ? 8 : (mobile ? 10 : 24), shortMobile ? 14 : (mobile ? 20 : 48));
    d.getElementById('highlightRole').textContent = compactText(highlight.role || '', lang, shortMobile ? 12 : (mobile ? 16 : 40), shortMobile ? 22 : (mobile ? 32 : 88));
    d.getElementById('highlightProducts').innerHTML = renderProducts(highlight.products || [], lang, mobile, shortMobile);
    d.getElementById('metricPlay').textContent = compactText((highlight.metrics && highlight.metrics.play) || '', lang, shortMobile ? 14 : (mobile ? 20 : 52), shortMobile ? 24 : (mobile ? 34 : 118));
    d.getElementById('metricAppstore').textContent = compactText((highlight.metrics && highlight.metrics.appstore) || '', lang, shortMobile ? 14 : (mobile ? 20 : 52), shortMobile ? 24 : (mobile ? 34 : 118));
    d.getElementById('aiNote').textContent = compactText(highlight.aiNote || '', lang, shortMobile ? 10 : (mobile ? 18 : 44), shortMobile ? 18 : (mobile ? 34 : 100));

    d.getElementById('experienceTitle').textContent = (experience.title || '');
    d.getElementById('experienceList').innerHTML = renderExperience(experience.items || [], lang, mobile, shortMobile);

    d.getElementById('skillsTitle').textContent = skills.title || '';
    d.getElementById('skillsLead').textContent = compactText(skills.lead || '', lang, shortMobile ? 16 : (mobile ? 28 : 84), shortMobile ? 30 : (mobile ? 56 : 180));
    d.getElementById('skillsTech').innerHTML = renderTech(skills.tech || [], mobile, shortMobile);
    d.getElementById('skillsDomain').textContent = shortMobile ? '' : compactText(skills.domain || '', lang, mobile ? 24 : 76, mobile ? 52 : 168);

    d.getElementById('educationTitle').textContent = education.title || '';
    d.getElementById('educationContent').textContent = [
      education.school,
      education.degree,
      education.major,
      education.period
    ].filter(Boolean).join(' · ');

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
    setTimeout(function () {
      document.dispatchEvent(new CustomEvent('silk-content-ready'));
    }, 30);
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
