(function () {
  'use strict';

  var LANG_KEY = 'resume-lang';
  var DATA_VERSION = '20260316-1';
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

  function renderContact(data) {
    var contact = data.basics.contact || {};
    var parts = [
      '<span>Tel: ' + escapeHtml(contact.phone || '') + '</span>',
      '<span>Email: ' + escapeHtml(contact.email || '') + '</span>',
      '<span>WeChat: ' + escapeHtml(contact.wechat || '') + '</span>'
    ];
    return parts.join('');
  }

  function renderExperience(items, lang) {
    if (!Array.isArray(items)) return '';
    return items.slice(0, 2).map(function (item) {
      return (
        '<li class="exp-item">' +
        '<div class="exp-item-head">' +
        '<span class="exp-item-company">' + escapeHtml(item.company) + '</span>' +
        '<span class="exp-item-period">' + escapeHtml(item.period) + '</span>' +
        '</div>' +
        '<div class="exp-item-role">' + escapeHtml(item.role) + '</div>' +
        '<p class="exp-item-summary">' + escapeHtml(compactText(item.summary, lang, 44, 88)) + '</p>' +
        '</li>'
      );
    }).join('');
  }

  function renderTech(tech) {
    if (!Array.isArray(tech)) return '';
    return tech.slice(0, 8).map(function (t) {
      return '<span class="tag">' + escapeHtml(t) + '</span>';
    }).join('');
  }

  function applyData(data) {
    var d = document;
    var lang = (data.meta && data.meta.lang) === 'en' ? 'en' : 'zh';
    var basics = data.basics || {};
    var highlight = data.highlight || {};
    var skills = data.skills || {};
    var education = data.education || {};
    var experience = data.experience || {};

    d.getElementById('name').textContent = data.name || '';
    d.getElementById('basicsLine').textContent = [basics.genderAge, basics.location, basics.yearsExp].filter(Boolean).join(' · ');
    d.getElementById('targetRole').textContent = basics.targetRole || '';
    d.getElementById('tagline').textContent = compactText(basics.tagline || '', lang, 52, 120);
    d.getElementById('contact').innerHTML = renderContact(data);

    d.getElementById('highlightTitle').textContent = highlight.title || '';
    d.getElementById('highlightCompany').textContent = highlight.company || '';
    d.getElementById('highlightPeriod').textContent = highlight.period || '';
    d.getElementById('highlightRole').textContent = highlight.role || '';
    d.getElementById('metricPlay').textContent = compactText((highlight.metrics && highlight.metrics.play) || '', lang, 34, 76);
    d.getElementById('metricAppstore').textContent = compactText((highlight.metrics && highlight.metrics.appstore) || '', lang, 34, 76);
    d.getElementById('aiNote').textContent = compactText(highlight.aiNote || '', lang, 44, 92);

    d.getElementById('experienceTitle').textContent = (experience.title || '');
    d.getElementById('experienceList').innerHTML = renderExperience(experience.items || [], lang);

    d.getElementById('skillsTitle').textContent = skills.title || '';
    d.getElementById('skillsLead').textContent = compactText(skills.lead || '', lang, 58, 130);
    d.getElementById('skillsTech').innerHTML = renderTech(skills.tech || []);
    d.getElementById('skillsDomain').textContent = compactText(skills.domain || '', lang, 62, 140);

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
    document.dispatchEvent(new CustomEvent('silk-content-ready'));
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
